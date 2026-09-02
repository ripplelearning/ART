const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const isDevelopment = !app.isPackaged;
let mainWindow = null;
let pendingArtifactPath = null;

function getArtifactPath(argv = []) {
    return argv.find((argument) => path.extname(argument).toLowerCase() === '.art') || null;
}

function getRendererUrl() {
    return `file://${path.join(__dirname, '..', 'index.html')}`;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 1000,
        minWidth: 960,
        minHeight: 700,
        show: false,
        backgroundColor: '#ffffff',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) {
            void shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith(getRendererUrl())) event.preventDefault();
    });
    mainWindow.loadURL(getRendererUrl());

    if (isDevelopment) mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.on('closed', () => { mainWindow = null; });
}

function deliverArtifactPath(filePath) {
    if (!filePath || !mainWindow || mainWindow.isDestroyed()) {
        pendingArtifactPath = filePath || pendingArtifactPath;
        return;
    }
    mainWindow.webContents.send('art-open-art-file', filePath);
}

function handleOpenArtifact(filePath) {
    if (!filePath || path.extname(filePath).toLowerCase() !== '.art') return;
    if (!fs.existsSync(filePath)) {
        void dialog.showErrorBox('ART file unavailable', `The file could not be found:\n${filePath}`);
        return;
    }
    deliverArtifactPath(filePath);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
        handleOpenArtifact(getArtifactPath(commandLine));
    });

    app.whenReady().then(() => {
        ipcMain.handle('art-get-open-file-path', () => pendingArtifactPath);
        ipcMain.handle('art-read-art-file', (_event, filePath) => {
            if (!filePath || path.extname(filePath).toLowerCase() !== '.art') throw new Error('Only .art files can be opened by ART.');
            return fs.promises.readFile(filePath, 'utf8');
        });
        ipcMain.handle('art-choose-open-art-file', async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: [{ name: 'ART Project Files', extensions: ['art'] }]
            });
            return result.canceled ? null : result.filePaths[0] || null;
        });
        createWindow();
        handleOpenArtifact(getArtifactPath(process.argv));
        mainWindow.webContents.once('did-finish-load', () => {
            if (pendingArtifactPath) {
                deliverArtifactPath(pendingArtifactPath);
                pendingArtifactPath = null;
            }
        });
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}
