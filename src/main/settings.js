const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')

const DEFAULT_PARAMETER = ''

function settingsFile () {
  return path.join(app.getPath('userData'), 'settings.json')
}

// VRChat parameter names are letters, numbers and underscores only.
function cleanParameter (name) {
  const cleaned = String(name ?? '').replace(/[^A-Za-z0-9_]/g, '')
  return cleaned || DEFAULT_PARAMETER
}

function loadSettings () {
  const defaults = { avatarParameter: DEFAULT_PARAMETER }
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))
    return { ...defaults, ...saved, avatarParameter: cleanParameter(saved.avatarParameter) }
  } catch {
    return defaults
  }
}

function saveSettings (settings) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
}

module.exports = { cleanParameter, loadSettings, saveSettings }
