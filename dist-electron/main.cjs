"use strict";
/**
 * PrairieBob - Electron Main Process
 *
 * This is the Node.js backend that creates windows, handles native dialogs,
 * and bridges filesystem access to the React renderer.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Use require for agent-main since we rename .js to .cjs after compilation
const { registerAgentIPC } = require('./agent-main.cjs');
// Set unique app name to avoid conflicts with other Electron apps
electron_1.app.name = 'PrairieBob';
electron_1.app.setAppUserModelId('com.prairiebob.tileeditor');
// Development vs production paths
// Use dev server only if VITE_DEV_SERVER_URL is explicitly set
const isDev = !!process.env.VITE_DEV_SERVER_URL;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
// Icon path - use the icon pack
const iconPath = path.join(__dirname, '../pbob_icon_pack/prairiebob.ico');
let mainWindow = null;
// Track current project state
let currentProjectPath = null;
let currentRoomPath = null;
let hasUnsavedChanges = false;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1024,
        minHeight: 768,
        title: 'PrairieBob',
        icon: iconPath,
        backgroundColor: '#1a1a2e',
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    // Load app
    if (isDev) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    // Update title when project changes
    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
        updateWindowTitle();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Build native menu
    const menu = buildMenu();
    electron_1.Menu.setApplicationMenu(menu);
}
function updateWindowTitle() {
    if (!mainWindow)
        return;
    let title = 'PrairieBob';
    if (currentRoomPath) {
        const roomName = path.basename(currentRoomPath, path.extname(currentRoomPath));
        title = `${roomName} - PrairieBob`;
    }
    if (hasUnsavedChanges) {
        title = `● ${title}`;
    }
    mainWindow.setTitle(title);
}
function buildMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Project...',
                    accelerator: 'CmdOrCtrl+Shift+O',
                    click: () => handleOpenProject(),
                },
                {
                    label: 'Open Room...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => handleOpenRoom(),
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow?.webContents.send('menu:save'),
                },
                {
                    label: 'Save As...',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => handleSaveAs(),
                },
                { type: 'separator' },
                {
                    label: 'Export to Kimbar...',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => mainWindow?.webContents.send('menu:export'),
                },
                { type: 'separator' },
                {
                    label: 'Recent Projects',
                    submenu: [], // TODO: populate from settings
                },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => mainWindow?.webContents.send('menu:undo'),
                },
                {
                    label: 'Redo',
                    accelerator: 'CmdOrCtrl+Y',
                    click: () => mainWindow?.webContents.send('menu:redo'),
                },
                { type: 'separator' },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => mainWindow?.webContents.send('menu:cut'),
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => mainWindow?.webContents.send('menu:copy'),
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => mainWindow?.webContents.send('menu:paste'),
                },
                { type: 'separator' },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => mainWindow?.webContents.send('menu:selectAll'),
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Grid',
                    accelerator: 'G',
                    click: () => mainWindow?.webContents.send('menu:toggleGrid'),
                },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+=',
                    click: () => mainWindow?.webContents.send('menu:zoomIn'),
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => mainWindow?.webContents.send('menu:zoomOut'),
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => mainWindow?.webContents.send('menu:zoomReset'),
                },
                { type: 'separator' },
                { role: 'toggleDevTools' },
                { role: 'reload' },
            ],
        },
        {
            label: 'Tools',
            submenu: [
                {
                    label: 'Launch BobTile...',
                    click: () => handleLaunchBobTile(),
                },
                { type: 'separator' },
                {
                    label: 'Validate Room',
                    click: () => mainWindow?.webContents.send('menu:validate'),
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Keyboard Shortcuts',
                    click: () => mainWindow?.webContents.send('menu:showShortcuts'),
                },
                { type: 'separator' },
                {
                    label: 'About PrairieBob',
                    click: () => showAboutDialog(),
                },
            ],
        },
    ];
    return electron_1.Menu.buildFromTemplate(template);
}
// ============== IPC Handlers ==============
async function handleOpenProject() {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Open Project Folder',
        properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        currentProjectPath = result.filePaths[0];
        mainWindow?.webContents.send('project:opened', currentProjectPath);
        updateWindowTitle();
    }
}
async function handleOpenRoom() {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Open Room',
        filters: [
            { name: 'Room Files', extensions: ['json', 'tmx', 'ldtk'] },
            { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            currentRoomPath = filePath;
            mainWindow?.webContents.send('room:opened', { path: filePath, content });
            updateWindowTitle();
        }
        catch (err) {
            electron_1.dialog.showErrorBox('Error', `Failed to open room: ${err}`);
        }
    }
}
async function handleSaveAs() {
    const result = await electron_1.dialog.showSaveDialog(mainWindow, {
        title: 'Save Room As',
        filters: [
            { name: 'JSON Room', extensions: ['json'] },
        ],
    });
    if (!result.canceled && result.filePath) {
        mainWindow?.webContents.send('room:saveAs', result.filePath);
    }
}
function handleLaunchBobTile() {
    const bobTilePath = path.resolve(__dirname, '../../bobtile/publish/BobTile.exe');
    if (fs.existsSync(bobTilePath)) {
        const { spawn } = require('child_process');
        spawn(bobTilePath, [], { detached: true, stdio: 'ignore' }).unref();
    }
    else {
        electron_1.dialog.showErrorBox('BobTile Not Found', `Could not find BobTile at:\n${bobTilePath}\n\nBuild it first with: cd ../bobtile && .\\build.ps1 -Release`);
    }
}
function showAboutDialog() {
    electron_1.dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About PrairieBob',
        message: 'PrairieBob',
        detail: 'AI-assisted tile editor for pixel art games.\n\nVersion 0.1.0\n\nIntegrates with BobTile for atlas packing.',
    });
}
// ============== IPC Bridge ==============
// File operations exposed to renderer
electron_1.ipcMain.handle('fs:readFile', async (_, filePath) => {
    return fs.readFileSync(filePath, 'utf-8');
});
electron_1.ipcMain.handle('fs:readFileBase64', async (_, filePath) => {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
});
electron_1.ipcMain.handle('fs:writeFileBase64', async (_, filePath, base64) => {
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return true;
});
electron_1.ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
});
electron_1.ipcMain.handle('fs:exists', async (_, filePath) => {
    return fs.existsSync(filePath);
});
electron_1.ipcMain.handle('fs:readDir', async (_, dirPath) => {
    return fs.readdirSync(dirPath, { withFileTypes: true }).map(d => ({
        name: d.name,
        isDirectory: d.isDirectory(),
    }));
});
electron_1.ipcMain.handle('fs:mkdir', async (_, dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
});
// App paths for renderer (sample/resources)
electron_1.ipcMain.handle('app:getPaths', async () => {
    return {
        appPath: electron_1.app.getAppPath(),
        resourcesPath: process.resourcesPath,
        isPackaged: electron_1.app.isPackaged,
    };
});
electron_1.ipcMain.handle('dialog:openFile', async (_, options) => {
    return electron_1.dialog.showOpenDialog(mainWindow, options);
});
electron_1.ipcMain.handle('dialog:saveFile', async (_, options) => {
    return electron_1.dialog.showSaveDialog(mainWindow, options);
});
electron_1.ipcMain.handle('dialog:openDirectory', async () => {
    return electron_1.dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
});
// Track unsaved changes
electron_1.ipcMain.on('editor:setUnsaved', (_, unsaved) => {
    hasUnsavedChanges = unsaved;
    updateWindowTitle();
});
// ============== App Lifecycle ==============
electron_1.app.whenReady().then(() => {
    // Register agent IPC handlers before creating window
    registerAgentIPC();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
