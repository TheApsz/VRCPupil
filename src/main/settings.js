const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')
const { DEFAULT_PARAMETER } = require('./osc.js')

function settingsFile () {
  return path.join(app.getPath('userData'), 'settings.json')
}

function cleanParameter (name) {
  const cleaned = String(name ?? '').replace(/[^A-Za-z0-9_]/g, '')
  return cleaned || DEFAULT_PARAMETER
}

function flag (value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

const MIN_RANGE_GAP = 0.01

function clamp01 (value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(1, Math.max(0, number))
}

function fixRange (min, max) {
  let low = clamp01(min, 0)
  let high = clamp01(max, 1)

  if (low > high) [low, high] = [high, low]

  if (high - low < MIN_RANGE_GAP) {
    high = Math.min(1, low + MIN_RANGE_GAP)
    low = Math.min(low, high - MIN_RANGE_GAP)
  }

  return { pupilMin: low, pupilMax: high }
}

const MIN_UPDATE_RATE = 3
const MAX_UPDATE_RATE = 60
const DEFAULT_UPDATE_RATE = 10

function fixUpdateRate (value) {
  if (value === null || value === undefined || value === '') return DEFAULT_UPDATE_RATE

  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_UPDATE_RATE
  return Math.min(MAX_UPDATE_RATE, Math.max(MIN_UPDATE_RATE, Math.round(number)))
}

function loadSettings () {
  const defaults = {
    avatarParameter: DEFAULT_PARAMETER,
    closeToTray: true,
    startWithWindows: false,
    pupilMin: 0,
    pupilMax: 1,
    autoRange: false,
    updateRate: DEFAULT_UPDATE_RATE
  }

  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
    return {
      ...defaults,
      ...saved,
      avatarParameter: cleanParameter(saved.avatarParameter),
      closeToTray: flag(saved.closeToTray, defaults.closeToTray),
      startWithWindows: flag(saved.startWithWindows, defaults.startWithWindows),
      autoRange: flag(saved.autoRange, defaults.autoRange),
      updateRate: fixUpdateRate(saved.updateRate ?? defaults.updateRate),
      ...fixRange(saved.pupilMin ?? defaults.pupilMin, saved.pupilMax ?? defaults.pupilMax)
    }
  } catch {
    return defaults
  }
}

function saveSettings (settings) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
}

module.exports = {
  MAX_UPDATE_RATE,
  MIN_UPDATE_RATE,
  cleanParameter,
  fixRange,
  fixUpdateRate,
  loadSettings,
  saveSettings
}
