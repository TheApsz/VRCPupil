let on = false
let cache = null

const SELECTORS = {
  raw: '[data-dbg="raw"]',
  target: '[data-dbg="target"]',
  smooth: '[data-dbg="smooth"]',
  range: '[data-dbg="range"]',
  tau: '[data-dbg="tau"]'
}

const latest = {
  raw: null,
  target: null,
  smooth: null,
  range: null,
  tau: null
}

function rows () {
  if (!cache) {
    cache = {}
    for (const key of Object.keys(SELECTORS)) cache[key] = $(SELECTORS[key])
  }
  return cache
}

function fixed (value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '--'
}

function windowText (range) {
  if (!range) return '--'

  const low = Number(range.min).toFixed(2)
  const high = Number(range.max).toFixed(2)
  return `${low} – ${high}${range.auto ? ' · auto' : ''}`
}

function render () {
  const row = rows()

  row.raw.text(fixed(latest.raw))
  row.target.text(fixed(latest.target))
  row.smooth.text(fixed(latest.smooth))
  row.range.text(windowText(latest.range))
  row.tau.text(latest.tau ? `${latest.tau.constrict} / ${latest.tau.dilate}` : '--')
}

export function updateDebug (values) {
  Object.assign(latest, values)
  if (on) render()
}

export function setDebug (next) {
  on = Boolean(next)
  $('#debug').toggleClass('on', on)
  if (on) render()
}

export function toggleDebug () {
  setDebug(!on)
}

export function isDebug () {
  return on
}

$(function () {
  $('#appVersion').on('click', toggleDebug)

  const pupil = window.vrcpupil
  if (!pupil) return

  pupil.onOscStatus((status) => updateDebug({ tau: status.smoothing }))
})
