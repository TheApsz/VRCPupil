const dgram = require('node:dgram')

// VRChat listens for OSC on 127.0.0.1:9000 by default.
const VRCHAT_HOST = '127.0.0.1'
const VRCHAT_PORT = 9000
let parameterAddress = '/avatar/parameters/pupilDialation'

// Ports we try for VRChat's replies, in order. The first one that binds wins.
const LISTEN_HOST = '127.0.0.1'
const LISTEN_PORTS = [9001, 9002, 9003]
// VRChat counts as connected while it has sent us something this recently.
const RECENT_MS = 5000

const socket = dgram.createSocket('udp4')
socket.on('error', (err) => console.log('osc: send failed', err.message))

let listenPort = null
let listenFailed = false
let lastPacketAt = 0

// OSC strings are null-terminated and padded to a multiple of 4 bytes.
function oscString (str) {
  const raw = Buffer.from(str + '\0', 'utf8')
  return Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4)])
}

function sendPupilDilation (value) {
  const amount = Math.min(1, Math.max(0, Number(value) || 0))
  const arg = Buffer.alloc(4)
  arg.writeFloatBE(amount, 0)

  const packet = Buffer.concat([oscString(parameterAddress), oscString(',f'), arg])
  socket.send(packet, VRCHAT_PORT, VRCHAT_HOST)
}

function setAvatarParameter (name) {
  parameterAddress = '/avatar/parameters/' + name
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
  listener.on('message', () => {
    lastPacketAt = Date.now()
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
  if (listenFailed) return { state: 'Error', port: null }
  if (!vrchatRunning) return { state: 'False', port: listenPort }

  const recent = Date.now() - lastPacketAt < RECENT_MS
  return { state: recent ? 'True' : 'Waiting', port: listenPort }
}

module.exports = { sendPupilDilation, setAvatarParameter, startOscListener, getOscStatus }
