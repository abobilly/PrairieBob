/**
 * SpudTile - Electron Main Process
 * 
 * This is the Node.js backend that creates windows, handles native dialogs,
 * and bridges filesystem access to the React renderer.
 */

import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// Use require for agent-main since we rename .js to .cjs after compilation
const { registerAgentIPC } = require('./agent-main.cjs');

// Auto-updater (only functional in packaged builds)
let autoUpdater: any = null;
if (app.isPackaged) {
    try {
        autoUpdater = require('electron-updater').autoUpdater;
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
    } catch (err) {
        console.log('Auto-updater not available:', err);
    }
}

// Set unique app name to avoid conflicts with other Electron apps
app.name = 'SpudTile';
app.setAppUserModelId('com.spudtile.tileeditor');

// Development vs production paths
// Use dev server only if VITE_DEV_SERVER_URL is explicitly set
const isDev = !!process.env.VITE_DEV_SERVER_URL;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

// Icon path - SpudTile logo
const iconPath = path.join(__dirname, '../public/icons/spudtile.ico');

let mainWindow: BrowserWindow | null = null;

// Track current project state
let currentProjectPath: string | null = null;
let currentRoomPath: string | null = null;
let hasUnsavedChanges = false;
let projectWatcher: fs.FSWatcher | null = null;
let watchedRootPath: string | null = null;

type FileChangeEventType = 'change' | 'rename';

const WATCHED_EXTENSIONS = new Set([
    '.json',
    '.ldtk',
    '.tmx',
    '.tsx',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
]);

const WATCH_IGNORED_SEGMENTS = new Set([
    'node_modules',
    '.git',
    'dist',
    'dist-electron',
    'release',
]);

interface AppSettings {
    bobTilePath?: string;
}

const SETTINGS_FILENAME = 'spudtile.settings.json';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1024,
        minHeight: 768,
        title: 'SpudTile',
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
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open DevTools only in dev server mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Update title when project changes
    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
        updateWindowTitle();
    });

    mainWindow.on('closed', () => {
        stopProjectWatcher();
        mainWindow = null;
    });

    // Build native menu
    const menu = buildMenu();
    Menu.setApplicationMenu(menu);
}

function updateWindowTitle() {
    if (!mainWindow) return;

    let title = 'SpudTile';
    if (currentRoomPath) {
        const roomName = path.basename(currentRoomPath, path.extname(currentRoomPath));
        title = `${roomName} - SpudTile`;
    }
    if (hasUnsavedChanges) {
        title = `● ${title}`;
    }
    mainWindow.setTitle(title);
}

function normalizeWatchPath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
}

function shouldEmitFileChange(filePath: string): boolean {
    const normalized = normalizeWatchPath(filePath);
    const segments = normalized.split('/');
    if (segments.some((segment) => WATCH_IGNORED_SEGMENTS.has(segment))) {
        return false;
    }

    const extension = path.extname(normalized);
    return WATCHED_EXTENSIONS.has(extension);
}

function stopProjectWatcher() {
    if (!projectWatcher) return;
    projectWatcher.close();
    projectWatcher = null;
    watchedRootPath = null;
}

function startProjectWatcher(rootPath: string): boolean {
    const resolvedRoot = path.resolve(rootPath);
    if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
        return false;
    }

    if (watchedRootPath === resolvedRoot && projectWatcher) {
        return true;
    }

    stopProjectWatcher();

    try {
        projectWatcher = fs.watch(
            resolvedRoot,
            { recursive: true },
            (eventType, filename) => {
                if (!mainWindow || !filename) return;
                const relativePath = filename.toString();
                const changedPath = path.resolve(resolvedRoot, relativePath);
                if (!shouldEmitFileChange(changedPath)) return;

                const safeEventType: FileChangeEventType = eventType === 'rename' ? 'rename' : 'change';
                mainWindow.webContents.send('project:file-changed', {
                    path: changedPath,
                    eventType: safeEventType,
                });
            },
        );

        projectWatcher.on('error', (err) => {
            console.warn('[watcher] file watch error:', err);
        });

        watchedRootPath = resolvedRoot;
        return true;
    } catch (err) {
        console.warn('[watcher] failed to start:', err);
        stopProjectWatcher();
        return false;
    }
}

function getSettingsPath(): string {
    return path.join(app.getPath('userData'), SETTINGS_FILENAME);
}

function readSettings(): AppSettings {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) return {};
    try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed as AppSettings : {};
    } catch {
        return {};
    }
}

function writeSettings(settings: AppSettings): void {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

function getBobTileCandidatePaths(): string[] {
    const candidates = new Set<string>();
    const settings = readSettings();
    if (settings.bobTilePath) {
        candidates.add(settings.bobTilePath);
    }

    const devPathFromCwd = path.resolve(process.cwd(), 'bobtile', 'publish', 'BobTile.exe');
    candidates.add(devPathFromCwd);

    const devPathFromBuild = path.resolve(__dirname, '../../bobtile/publish/BobTile.exe');
    candidates.add(devPathFromBuild);

    const packagedPath = path.join(process.resourcesPath, 'bobtile', 'BobTile.exe');
    candidates.add(packagedPath);

    const siblingReleasePath = path.resolve(process.cwd(), 'release', 'win-unpacked', 'BobTile.exe');
    candidates.add(siblingReleasePath);

    return [...candidates];
}

function findExistingBobTilePath(): string | null {
    for (const candidate of getBobTileCandidatePaths()) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

async function promptForBobTilePath(): Promise<string | null> {
    const choice = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'BobTile Not Found',
        message: 'BobTile.exe was not found automatically.',
        detail: 'Locate BobTile.exe once and SpudTile will remember it.',
        buttons: ['Locate BobTile.exe', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
    });

    if (choice.response !== 0) {
        return null;
    }

    const selected = await dialog.showOpenDialog(mainWindow!, {
        title: 'Locate BobTile.exe',
        filters: [{ name: 'BobTile Executable', extensions: ['exe'] }],
        properties: ['openFile'],
    });

    if (selected.canceled || selected.filePaths.length === 0) {
        return null;
    }

    const selectedPath = selected.filePaths[0];
    const settings = readSettings();
    settings.bobTilePath = selectedPath;
    writeSettings(settings);
    return selectedPath;
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
                    click: () => { void handleLaunchBobTile(); },
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
                    label: 'About SpudTile',
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

async function handleLaunchBobTile(): Promise<boolean> {
    let bobTilePath = findExistingBobTilePath();
    if (!bobTilePath) {
        bobTilePath = await promptForBobTilePath();
    }

    if (!bobTilePath) {
        return false;
    }

    try {
        const { spawn } = require('child_process');
        spawn(bobTilePath, [], { detached: true, stdio: 'ignore' }).unref();
        mainWindow?.webContents.send('tool:bobtile-launched', { path: bobTilePath });
        return true;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dialog.showErrorBox(
            'Failed to Launch BobTile',
            `SpudTile found BobTile but could not launch it.\n\nPath: ${bobTilePath}\n\nError: ${message}`
        );
        return false;
    }
}

function showAboutDialog() {
    dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'About SpudTile',
        message: 'SpudTile',
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

ipcMain.handle('fs:writeFileBase64', async (_, filePath: string, base64: string) => {
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return true;
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

ipcMain.handle('fs:removeFile', async (_, filePath: string) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return true;
});

// App paths for renderer (sample/resources)
ipcMain.handle('app:getPaths', async () => {
    return {
        appPath: app.getAppPath(),
        resourcesPath: process.resourcesPath,
        isPackaged: app.isPackaged,
    };
});

ipcMain.handle('watcher:start', async (_, rootPath: string) => {
    if (typeof rootPath !== 'string' || rootPath.trim().length === 0) {
        return false;
    }
    return startProjectWatcher(rootPath);
});

ipcMain.handle('watcher:stop', async () => {
    stopProjectWatcher();
    return true;
});

ipcMain.handle('tools:launchBobTile', async () => {
    return handleLaunchBobTile();
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

// ============== Auto-Update ==============

function setupAutoUpdater() {
    if (!autoUpdater) return;

    // Skip if app-update.yml is missing (e.g. unpacked --dir builds)
    const updateConfigPath = path.join(__dirname, '../resources/app-update.yml');
    if (!fs.existsSync(updateConfigPath)) {
        console.log('Auto-update config not found, skipping update check');
        return;
    }

    autoUpdater.on('update-available', (info: any) => {
        console.log('Update available:', info.version);
        mainWindow?.webContents.send('update:available', info.version);
        dialog.showMessageBox(mainWindow!, {
            type: 'info',
            title: 'Update Available',
            message: `SpudTile v${info.version} is available!`,
            detail: 'It will be installed automatically when you close the app.',
            buttons: ['OK'],
        });
    });

    autoUpdater.on('update-downloaded', (info: any) => {
        console.log('Update downloaded:', info.version);
        mainWindow?.webContents.send('update:downloaded', info.version);
    });

    autoUpdater.on('error', (err: Error) => {
        console.log('Auto-update error:', err.message);
    });

    // Check for updates (silently)
    autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
        console.log('Update check failed:', err.message);
    });
}

// ============== App Lifecycle ==============

app.whenReady().then(() => {
    // Register agent IPC handlers before creating window
    registerAgentIPC();
    createWindow();
    // Check for updates after window is ready
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    stopProjectWatcher();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
