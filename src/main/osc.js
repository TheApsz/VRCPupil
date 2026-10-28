const dgram = require('node:dgram')

const VRCHAT_HOST = '127.0.0.1'
const VRCHAT_PORT = 9000

const DEFAULT_PARAMETER = 'pupilDialation'
let parameterAddress = '/avatar/parameters/' + DEFAULT_PARAMETER

const LISTEN_HOST = '127.0.0.1'
const LISTEN_PORTS = [9001, 9002, 9003]
const RECENT_MS = 5000

const PARAM_PREFIX = '/avatar/parameters/'
const parameters = new Map()
let avatarId = null

const socket = dgram.createSocket('udp4')
socket.on('error', (err) => console.log('osc: send failed', err.message))

let listenPort = null
let listenFailed = false
let lastPacketAt = 0
let paused = false

let pupilMin = 0
let pupilMax = 1

let autoRange = false
let autoMin = null
let autoMax = null
const AUTO_SPAN_MIN = 0.05

const SMOOTH_HZ = 30
const DEFAULT_CONSTRICT_MS = 180
const DEFAULT_DILATE_MS = 1400
let constrictMs = DEFAULT_CONSTRICT_MS
let dilateMs = DEFAULT_DILATE_MS

let target = null
let smoothed = null
let smoothTimer = null
let lastStepAt = 0

const OSC_DEADZONE = 0.005
let lastSentValue = null

function forgetLastSent () {
  lastSentValue = null
}

function clamp01 (value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(1, Math.max(0, number))
}

function oscString (str) {
  const raw = Buffer.from(str + '\0', 'utf8')
  return Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4)])
}

function sendPupilDilation (value) {
  const raw = clamp01(value)

  trackAutoRange(raw)

  target = mapPupil(raw)
  if (smoothed === null) smoothed = target
  startSmoothing()

  return { value: smoothed, target, range: getPupilRange() }
}

function setAvatarParameter (name) {
  if (!name) return
  parameterAddress = '/avatar/parameters/' + name
  forgetLastSent()
}

function setPaused (value) {
  if (paused !== Boolean(value)) forgetLastSent()
  paused = Boolean(value)
}

function currentRange () {
  if (!autoRange || autoMin === null) return { min: pupilMin, max: pupilMax }

  const high = Math.max(autoMax, autoMin + AUTO_SPAN_MIN)
  return { min: autoMin, max: Math.min(1, high) }
}

function resetAutoRange () {
  autoMin = null
  autoMax = null
}

function trackAutoRange (raw) {
  if (!autoRange) return

  if (autoMin === null) {
    autoMin = raw
    autoMax = raw
    forgetLastSent()
    return
  }

  if (raw < autoMin) {
    autoMin = raw
    forgetLastSent()
  } else if (raw > autoMax) {
    autoMax = raw
    forgetLastSent()
  }
}

function getPupilRange () {
  const range = currentRange()
  return { min: range.min, max: range.max, auto: autoRange }
}

function setSmoothing (options = {}) {
  const constrain = (value, fallback) => {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return fallback
    return Math.min(5000, Math.max(20, number))
  }

  constrictMs = constrain(options.constrict, constrictMs)
  dilateMs = constrain(options.dilate, dilateMs)
}

function getSmoothing () {
  return { constrict: constrictMs, dilate: dilateMs }
}

function setAutoRange (value) {
  const next = Boolean(value)
  if (next === autoRange) return

  autoRange = next
  resetAutoRange()
  smoothed = null
  forgetLastSent()
}

function setPupilRange (min, max) {
  const low = Math.min(1, Math.max(0, Number(min) || 0))
  const high = Math.min(1, Math.max(0, Number(max) || 0))
  pupilMin = Math.min(low, high)
  pupilMax = Math.max(low, high)
  forgetLastSent()
}

function mapPupil (value) {
  const raw = clamp01(value)
  const { min, max } = currentRange()
  const span = max - min
  if (span <= 0) return raw
  return clamp01((raw - min) / span)
}

function startSmoothing () {
  if (smoothTimer) return
  lastStepAt = Date.now()
  smoothTimer = setInterval(stepSmoothing, 1000 / SMOOTH_HZ)
  smoothTimer.unref?.()
}

function stepSmoothing () {
  const now = Date.now()
  const dt = Math.min(0.25, (now - lastStepAt) / 1000)
  lastStepAt = now

  if (target === null) return
  if (smoothed === null) smoothed = target

  const tauMs = target < smoothed ? constrictMs : dilateMs
  const alpha = 1 - Math.exp(-dt * 1000 / tauMs)
  smoothed += (target - smoothed) * alpha

  if (Math.abs(target - smoothed) < 0.001) smoothed = target

  if (paused) return
  if (lastSentValue !== null && Math.abs(smoothed - lastSentValue) < OSC_DEADZONE) return

  lastSentValue = smoothed
  writePacket(smoothed)
}

function writePacket (amount) {
  const arg = Buffer.alloc(4)
  arg.writeFloatBE(amount, 0)

  const packet = Buffer.concat([oscString(parameterAddress), oscString(',f'), arg])
  socket.send(packet, VRCHAT_PORT, VRCHAT_HOST)
}

function isPaused () {
  return paused
}

function readString (buffer, offset) {
  let end = offset
  while (end < buffer.length && buffer[end] !== 0) end++

  const text = buffer.toString('utf8', offset, end)
  const consumed = end - offset + 1
  return { text, next: offset + consumed + ((4 - (consumed % 4)) % 4) }
}

function decode (buffer) {
  if (buffer.length < 4) return null

  const address = readString(buffer, 0)
  if (!address.text.startsWith('/')) return null
  if (address.next >= buffer.length) return { address: address.text, args: [] }

  const tags = readString(buffer, address.next)
  const args = []
  let offset = tags.next

  for (const tag of tags.text.slice(1)) {
    if (offset > buffer.length) break

    if (tag === 'i') { args.push(buffer.readInt32BE(offset)); offset += 4 } else if (tag === 'f') { args.push(buffer.readFloatBE(offset)); offset += 4 } else if (tag === 'd') { args.push(buffer.readDoubleBE(offset)); offset += 8 } else if (tag === 's') {
      const str = readString(buffer, offset)
      args.push(str.text)
      offset = str.next
    } else if (tag === 'T') { args.push(true) } else if (tag === 'F') { args.push(false) } else { break }
  }

  return { address: address.text, args }
}

function ingest (message) {
  if (!message) return

  if (message.address === '/avatar/change') {
    avatarId = typeof message.args[0] === 'string' ? message.args[0] : null
    parameters.clear()
    forgetLastSent()
    return
  }

  if (!message.address.startsWith(PARAM_PREFIX) || message.args.length === 0) return

  const name = message.address.slice(PARAM_PREFIX.length)
  if (!name) return

  const raw = message.args[0]
  parameters.set(name, {
    name,
    value: typeof raw === 'boolean' ? (raw ? 1 : 0) : raw,
    lastSeen: Date.now()
  })
}

function getDiscoveredParameters () {
  return [...parameters.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function bindListener (index) {
  if (index >= LISTEN_PORTS.length) {
    listenFailed = true
    console.log('osc: no listen port available')
    return
  }

  const port = LISTEN_PORTS[index]
  const listener = dgram.createSocket('udp4')
  let bound = false

  listener.on('listening', () => {
    bound = true
    listenPort = port
    console.log(`osc: listening on ${LISTEN_HOST}:${port}`)
  })
  listener.on('message', (msg) => {
    const now = Date.now()
    if (lastPacketAt && now - lastPacketAt > RECENT_MS) resetAutoRange()
    lastPacketAt = now
    ingest(decode(msg))
  })
  listener.on('error', (err) => {
    if (bound) {
      console.log('osc: listener error', err.message)
      return
    }
    listener.close()
    bindListener(index + 1)
  })
  listener.bind(port, LISTEN_HOST)
}

function startOscListener () {
  bindListener(0)
}

function getOscStatus (vrchatRunning) {
  const discovered = getDiscoveredParameters()
  const base = {
    port: listenPort,
    avatarId,
    parameters: discovered,
    pupilRange: getPupilRange(),
    smoothing: getSmoothing()
  }

  if (listenFailed) return { ...base, state: 'Error', port: null }
  if (!vrchatRunning) return { ...base, state: 'False' }

  const recent = Date.now() - lastPacketAt < RECENT_MS
  return { ...base, state: recent ? 'True' : 'Waiting' }
}

module.exports = {
  DEFAULT_PARAMETER,
  sendPupilDilation,
  setAvatarParameter,
  setPupilRange,
  setAutoRange,
  getPupilRange,
  setSmoothing,
  getSmoothing,
  mapPupil,
  setPaused,
  isPaused,
  startOscListener,
  getOscStatus,
  getDiscoveredParameters
}
