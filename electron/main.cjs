const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

const windows = new Set()
let pendingFile = null

function projectFromArgv(argv) {
  return argv.find((arg) => arg.toLowerCase().endsWith('.winner') && fs.existsSync(arg)) ?? null
}

function sendProject(win, filePath) {
  if (!filePath || !fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  win.webContents.send('open-project', text)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: 'Winner Design',
    backgroundColor: '#1E222A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  windows.add(win)
  win.on('closed', () => windows.delete(win))
  const startUrl = process.env.ELECTRON_START_URL
  const dist = path.join(__dirname, '../dist/index.html')
  const file = pendingFile || projectFromArgv(process.argv)
  pendingFile = null
  win.webContents.once('did-finish-load', () => sendProject(win, file))
  if (startUrl) win.loadURL(startUrl)
  else if (fs.existsSync(dist)) win.loadFile(dist)
  else win.loadURL('http://localhost:5173')
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const file = projectFromArgv(argv)
    const win = windows.values().next().value
    if (win && file) sendProject(win, file)
    if (win) win.focus()
  })
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    const win = windows.values().next().value
    if (win) sendProject(win, filePath)
    else pendingFile = filePath
  })
  app.whenReady().then(createWindow)
  app.on('activate', () => {
    if (windows.size === 0) createWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

ipcMain.handle('ping', () => 'winner-design')
