const { desktopCapturer } = require('electron')
const { execFile } = require('node:child_process')

const PROCESS_NAME = 'VRChat.exe'
const WINDOW_TITLE = /^VRChat/

function isVRChatRunning () {
  return new Promise((resolve) => {
    const args = ['/FI', `IMAGENAME eq ${PROCESS_NAME}`, '/FO', 'CSV', '/NH']
    execFile('tasklist', args, { windowsHide: true }, (err, stdout) => {
      resolve(!err && stdout.toLowerCase().includes(PROCESS_NAME.toLowerCase()))
    })
  })
}

async function findVRChatWindow () {
  if (!(await isVRChatRunning())) return null

  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1, height: 1 }
  })
  return sources.find((source) => WINDOW_TITLE.test(source.name)) || null
}

module.exports = { findVRChatWindow, isVRChatRunning }
