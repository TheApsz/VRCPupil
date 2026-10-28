const { app, BrowserWindow, ipcMain, session, Tray, Menu } = require('electron')
const path = require('node:path')
const { findVRChatWindow, isVRChatRunning } = require('./vrchat.js')
const { sendPupilDilation, setAvatarParameter, setAutoRange, setPupilRange, startOscListener, getOscStatus, setPaused, isPaused } = require('./osc.js')
const { cleanParameter, fixRange, fixUpdateRate, loadSettings, saveSettings } = require('./settings.js')

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let mainWindow = null
  let tray = null
  let isQuitting = false

  const startHidden = process.argv.includes('--hidden')

  function createWindow () {
    mainWindow = new BrowserWindow({
      width: 1191,
      height: 720,
      show: false,
      title: 'VRCPupil',
      frame: false,
      resizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    mainWindow.once('ready-to-show', () => {
      if (!startHidden) mainWindow.show()
    })

    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
    })

    mainWindow.webContents.on('console-message', (event) => {
      if (app.isPackaged) return
      if (event.message) {
        console.log(`[renderer] ${event.message} (${event.sourceId || '?'}:${event.lineNumber ?? 0})`)
      }
    })

    mainWindow.on('closed', () => { mainWindow = null })

    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'))
  }

  function showWindow () {
    if (!mainWindow) {
      createWindow()
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }

  async function createTray () {
    let icon = await app.getFileIcon(process.execPath, { size: 'normal' })
    if (icon.isEmpty()) icon = await app.getFileIcon(process.execPath, { size: 'small' })
    console.log(`tray: icon ${icon.getSize().width}x${icon.getSize().height}`)

    tray = new Tray(icon)
    tray.setToolTip('VRCPupil')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show VRCPupil', click: () => showWindow() },
      {
        label: 'Pause output',
        type: 'checkbox',
        checked: isPaused(),
        click: (item) => setPaused(item.checked)
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ]))
    tray.on('click', () => {
      if (mainWindow && mainWindow.isVisible()) mainWindow.hide()
      else showWindow()
    })
  }

  function applyStartWithWindows (enabled) {
    const args = app.isPackaged ? ['--hidden'] : [app.getAppPath(), '--hidden']
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      path: process.execPath,
      args
    })
  }

  app.on('second-instance', () => showWindow())

  app.on('before-quit', () => { isQuitting = true })

  app.whenReady().then(async () => {
    const settings = loadSettings()
    ipcMain.handle('app:ping', () => ({ pong: true, time: Date.now() }))
    ipcMain.handle('app:version', () => app.getVersion())
    ipcMain.handle('osc:send', (event, value) => sendPupilDilation(value))
    setAvatarParameter(settings.avatarParameter)
    setPupilRange(settings.pupilMin, settings.pupilMax)
    setAutoRange(settings.autoRange)

    ipcMain.handle('settings:get', () => settings)
    ipcMain.handle('settings:setAvatarParameter', (event, name) => {
      settings.avatarParameter = cleanParameter(name)
      setAvatarParameter(settings.avatarParameter)
      saveSettings(settings)
      return settings.avatarParameter
    })
    ipcMain.handle('settings:update', (event, patch) => {
      if (!patch || typeof patch !== 'object') return settings

      if ('closeToTray' in patch) settings.closeToTray = Boolean(patch.closeToTray)
      if ('autoRange' in patch) {
        settings.autoRange = Boolean(patch.autoRange)
        setAutoRange(settings.autoRange)
        if (!settings.autoRange) setPupilRange(settings.pupilMin, settings.pupilMax)
      }
      if ('updateRate' in patch) {
        settings.updateRate = fixUpdateRate(patch.updateRate)
      }
      if ('startWithWindows' in patch) {
        settings.startWithWindows = Boolean(patch.startWithWindows)
        applyStartWithWindows(settings.startWithWindows)
      }
      if ('pupilMin' in patch || 'pupilMax' in patch) {
        Object.assign(settings, fixRange(
          'pupilMin' in patch ? patch.pupilMin : settings.pupilMin,
          'pupilMax' in patch ? patch.pupilMax : settings.pupilMax
        ))
        setPupilRange(settings.pupilMin, settings.pupilMax)
      }

      saveSettings(settings)
      return settings
    })

    applyStartWithWindows(settings.startWithWindows)

    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      const source = await findVRChatWindow()

      if (!source) {
        try {
          callback({})
        } catch {}
        return
      }

      callback({ video: source })
    })

    ipcMain.handle('window:minimize', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    })
    ipcMain.handle('window:close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      if (settings.closeToTray) {
        win.hide()
        return
      }

      isQuitting = true
      app.quit()
    })

    createWindow()
    await createTray()

    startOscListener()
    setInterval(async () => {
      const running = await isVRChatRunning()
      const status = getOscStatus(running)
      mainWindow?.webContents.send('osc:status', status)

      const port = status.port ? ` on :${status.port}` : ''
      tray?.setToolTip(`VRCPupil — OSC ${status.state}${port}`)
    }, 2000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) app.quit()
  })
}
