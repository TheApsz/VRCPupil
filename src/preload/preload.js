const { contextBridge, ipcRenderer } = require('electron')

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
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),

  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close')
}

contextBridge.exposeInMainWorld('vrcpupil', api)
