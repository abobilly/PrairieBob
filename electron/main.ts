/**
 * PrairieBob - Electron Main Process
 * 
 * This is the Node.js backend that creates windows, handles native dialogs,
 * and bridges filesystem access to the React renderer.
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Set unique app name to avoid conflicts with other Electron apps
app.name = 'PrairieBob';
app.setAppUserModelId('com.prairiebob.tileeditor');

// Development vs production paths
const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Icon path - use the icon pack
const iconPath = path.join(__dirname, '../pbob_icon_pack/prairiebob.ico');

let mainWindow: BrowserWindow | null = null;

// Track current project state
let currentProjectPath: string | null = null;
let currentRoomPath: string | null = null;
let hasUnsavedChanges = false;

function createWindow() {
    mainWindow = new BrowserWindow({
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
    } else {
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
    Menu.setApplicationMenu(menu);
}

function updateWindowTitle() {
    if (!mainWindow) return;

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

function buildMenu(): Menu {
    const template: Electron.MenuItemConstructorOptions[] = [
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

    return Menu.buildFromTemplate(template);
}

// ============== IPC Handlers ==============

async function handleOpenProject() {
    const result = await dialog.showOpenDialog(mainWindow!, {
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
    const result = await dialog.showOpenDialog(mainWindow!, {
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
        } catch (err) {
            dialog.showErrorBox('Error', `Failed to open room: ${err}`);
        }
    }
}

async function handleSaveAs() {
    const result = await dialog.showSaveDialog(mainWindow!, {
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
    } else {
        dialog.showErrorBox('BobTile Not Found',
            `Could not find BobTile at:\n${bobTilePath}\n\nBuild it first with: cd ../bobtile && .\\build.ps1 -Release`);
    }
}

function showAboutDialog() {
    dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'About PrairieBob',
        message: 'PrairieBob',
        detail: 'AI-assisted tile editor for pixel art games.\n\nVersion 0.1.0\n\nIntegrates with BobTile for atlas packing.',
    });
}

// ============== IPC Bridge ==============

// File operations exposed to renderer
ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
});

ipcMain.handle('fs:readFileBase64', async (_, filePath: string) => {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
});

ipcMain.handle('fs:exists', async (_, filePath: string) => {
    return fs.existsSync(filePath);
});

ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    return fs.readdirSync(dirPath, { withFileTypes: true }).map(d => ({
        name: d.name,
        isDirectory: d.isDirectory(),
    }));
});

ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
});

ipcMain.handle('dialog:openFile', async (_, options) => {
    return dialog.showOpenDialog(mainWindow!, options);
});

ipcMain.handle('dialog:saveFile', async (_, options) => {
    return dialog.showSaveDialog(mainWindow!, options);
});

ipcMain.handle('dialog:openDirectory', async () => {
    return dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
});

// Track unsaved changes
ipcMain.on('editor:setUnsaved', (_, unsaved: boolean) => {
    hasUnsavedChanges = unsaved;
    updateWindowTitle();
});

// ============== App Lifecycle ==============

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
