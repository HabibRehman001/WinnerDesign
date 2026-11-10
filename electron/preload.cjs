const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('winner', {
  onOpenProject: (callback) => {
    const listener = (_event, text) => callback(text)
    ipcRenderer.on('open-project', listener)
    return () => ipcRenderer.removeListener('open-project', listener)
  },
})
