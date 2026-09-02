const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('artDesktop', Object.freeze({
    isDesktop: true,
    getOpenFilePath: () => ipcRenderer.invoke('art-get-open-file-path'),
    readArtFile: (filePath) => ipcRenderer.invoke('art-read-art-file', filePath),
    chooseOpenArtFile: () => ipcRenderer.invoke('art-choose-open-art-file'),
    onCommand: (callback) => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, action) => callback(action);
        ipcRenderer.on('art-desktop-command', listener);
        return () => ipcRenderer.removeListener('art-desktop-command', listener);
    },
    onOpenArtFile: (callback) => {
        if (typeof callback !== 'function') return () => {};
        const listener = (_event, filePath) => callback(filePath);
        ipcRenderer.on('art-open-art-file', listener);
        return () => ipcRenderer.removeListener('art-open-art-file', listener);
    }
}));
