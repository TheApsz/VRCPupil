const { contextBridge, ipcRenderer } = require('electron')

// The renderer only ever sees this object, as `window.vrcpupil`.
// Keep it small and explicit: every future feature (brightness, OSC,
// settings) adds one named method here instead of exposing anything raw.
const api = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  ping: () => ipcRenderer.invoke('app:ping'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  sendDilation: (value) => ipcRenderer.invoke('osc:send', value),
  onOscStatus: (callback) => ipcRenderer.on('osc:status', (event, status) => callback(status)),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setAvatarParameter: (name) => ipcRenderer.invoke('settings:setAvatarParameter', name),

  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close')
}

contextBridge.exposeInMainWorld('vrcpupil', api)
