const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('node:path')
const { findVRChatWindow, isVRChatRunning } = require('./vrchat.js')
const { sendPupilDilation, setAvatarParameter, startOscListener, getOscStatus } = require('./osc.js')
const { cleanParameter, loadSettings, saveSettings } = require('./settings.js')

// Only one copy of the app may run at a time. This will matter a lot later:
// two instances would both fight over the OSC port.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let mainWindow = null

  function createWindow () {
    mainWindow = new BrowserWindow({
      width: 1191, // 16:9 at 670px tall
      height: 670,
      show: false,
      title: 'VRCPupil',
      frame: false, // frameless: title bar + window controls hidden (drag regions live in the UI)
      resizable: false, // fixed 16:9 layout, no resize handles
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    mainWindow.once('ready-to-show', () => mainWindow.show())

    // F12 toggles DevTools (no application menu needed).
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
    })

    // Dev aid: mirror the renderer's console into the terminal so errors
    // aren't invisible while no DevTools is open. Electron 44 hands the
    // details on the event object itself (the old positional args are
    // deprecated and trigger a warning).
    mainWindow.webContents.on('console-message', (event) => {
      if (app.isPackaged) return
      if (event.message) {
        console.log(`[renderer] ${event.message} (${event.sourceId || '?'}:${event.lineNumber ?? 0})`)
      }
    })

    mainWindow.on('closed', () => { mainWindow = null })

    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'))
  }

  // Second launch: focus the existing window instead of opening a new one.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // IPC surface. Everything the renderer is allowed to ask main for lives here.
    // Future features (brightness control, OSC settings, config) add handlers here.
    ipcMain.handle('app:ping', () => ({ pong: true, time: Date.now() }))
    ipcMain.handle('app:version', () => app.getVersion())
    ipcMain.handle('osc:send', (event, value) => sendPupilDilation(value))

    const settings = loadSettings()
    setAvatarParameter(settings.avatarParameter)
    ipcMain.handle('settings:get', () => settings)
    ipcMain.handle('settings:setAvatarParameter', (event, name) => {
      settings.avatarParameter = cleanParameter(name)
      setAvatarParameter(settings.avatarParameter)
      saveSettings(settings)
      return settings.avatarParameter
    })

    // Screen capture never shows a picker: the renderer's getDisplayMedia() is
    // answered here with the VRChat window, or denied when VRChat isn't open.
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      const source = await findVRChatWindow()
      callback(source ? { video: source } : {})
    })

    ipcMain.handle('window:minimize', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    })
    ipcMain.handle('window:close', (event) => {
      BrowserWindow.fromWebContents(event.sender)?.close()
    })

    createWindow()

    startOscListener()
    setInterval(async () => {
      const running = await isVRChatRunning()
      mainWindow?.webContents.send('osc:status', getOscStatus(running))
    }, 2000)

    app.on('activate', () => {
      // macOS: clicking the dock icon with no windows open re-creates one.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
