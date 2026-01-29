"use strict";
/**
 * PrairieBob - Electron Preload Script
 *
 * This script runs in a sandboxed context and exposes a safe API
 * to the renderer (React) via contextBridge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods to renderer
electron_1.contextBridge.exposeInMainWorld('electron', {
    // ============== File System ==============
    fs: {
        readFile: (filePath) => electron_1.ipcRenderer.invoke('fs:readFile', filePath),
        readFileBase64: (filePath) => electron_1.ipcRenderer.invoke('fs:readFileBase64', filePath),
        writeFileBase64: (filePath, base64) => electron_1.ipcRenderer.invoke('fs:writeFileBase64', filePath, base64),
        writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('fs:writeFile', filePath, content),
        exists: (filePath) => electron_1.ipcRenderer.invoke('fs:exists', filePath),
        readDir: (dirPath) => electron_1.ipcRenderer.invoke('fs:readDir', dirPath),
        mkdir: (dirPath) => electron_1.ipcRenderer.invoke('fs:mkdir', dirPath),
    },
    app: {
        getPaths: () => electron_1.ipcRenderer.invoke('app:getPaths'),
    },
    // ============== Dialogs ==============
    dialog: {
        openFile: (options) => electron_1.ipcRenderer.invoke('dialog:openFile', options),
        saveFile: (options) => electron_1.ipcRenderer.invoke('dialog:saveFile', options),
        openDirectory: () => electron_1.ipcRenderer.invoke('dialog:openDirectory'),
    },
    // ============== Editor State ==============
    editor: {
        setUnsaved: (unsaved) => electron_1.ipcRenderer.send('editor:setUnsaved', unsaved),
    },
    // ============== Menu Events ==============
    // These let the renderer respond to native menu actions
    onMenuSave: (callback) => {
        electron_1.ipcRenderer.on('menu:save', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:save', callback);
    },
    onMenuUndo: (callback) => {
        electron_1.ipcRenderer.on('menu:undo', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:undo', callback);
    },
    onMenuRedo: (callback) => {
        electron_1.ipcRenderer.on('menu:redo', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:redo', callback);
    },
    onMenuCut: (callback) => {
        electron_1.ipcRenderer.on('menu:cut', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:cut', callback);
    },
    onMenuCopy: (callback) => {
        electron_1.ipcRenderer.on('menu:copy', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:copy', callback);
    },
    onMenuPaste: (callback) => {
        electron_1.ipcRenderer.on('menu:paste', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:paste', callback);
    },
    onMenuSelectAll: (callback) => {
        electron_1.ipcRenderer.on('menu:selectAll', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:selectAll', callback);
    },
    onMenuToggleGrid: (callback) => {
        electron_1.ipcRenderer.on('menu:toggleGrid', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:toggleGrid', callback);
    },
    onMenuZoomIn: (callback) => {
        electron_1.ipcRenderer.on('menu:zoomIn', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:zoomIn', callback);
    },
    onMenuZoomOut: (callback) => {
        electron_1.ipcRenderer.on('menu:zoomOut', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:zoomOut', callback);
    },
    onMenuZoomReset: (callback) => {
        electron_1.ipcRenderer.on('menu:zoomReset', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:zoomReset', callback);
    },
    onMenuExport: (callback) => {
        electron_1.ipcRenderer.on('menu:export', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:export', callback);
    },
    onMenuValidate: (callback) => {
        electron_1.ipcRenderer.on('menu:validate', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:validate', callback);
    },
    onMenuShowShortcuts: (callback) => {
        electron_1.ipcRenderer.on('menu:showShortcuts', callback);
        return () => electron_1.ipcRenderer.removeListener('menu:showShortcuts', callback);
    },
    // ============== Project/Room Events ==============
    onProjectOpened: (callback) => {
        electron_1.ipcRenderer.on('project:opened', (_, path) => callback(path));
        return () => electron_1.ipcRenderer.removeAllListeners('project:opened');
    },
    onRoomOpened: (callback) => {
        electron_1.ipcRenderer.on('room:opened', (_, data) => callback(data));
        return () => electron_1.ipcRenderer.removeAllListeners('room:opened');
    },
    onRoomSaveAs: (callback) => {
        electron_1.ipcRenderer.on('room:saveAs', (_, path) => callback(path));
        return () => electron_1.ipcRenderer.removeAllListeners('room:saveAs');
    },
    // ============== Agent IPC ==============
    agent: {
        start: () => electron_1.ipcRenderer.invoke('agent:start'),
        send: (prompt) => electron_1.ipcRenderer.invoke('agent:send', prompt),
        abort: () => electron_1.ipcRenderer.invoke('agent:abort'),
        stop: () => electron_1.ipcRenderer.invoke('agent:stop'),
        isConnected: () => electron_1.ipcRenderer.invoke('agent:isConnected'),
    },
    onAgentMessage: (callback) => {
        const handler = (_, message) => callback(message);
        electron_1.ipcRenderer.on('agent:message', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:message', handler);
    },
    onAgentDelta: (callback) => {
        const handler = (_, delta) => callback(delta);
        electron_1.ipcRenderer.on('agent:delta', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:delta', handler);
    },
    onAgentState: (callback) => {
        const handler = (_, state) => callback(state);
        electron_1.ipcRenderer.on('agent:state', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:state', handler);
    },
    onAgentError: (callback) => {
        const handler = (_, error) => callback(error);
        electron_1.ipcRenderer.on('agent:error', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:error', handler);
    },
    onAgentTool: (callback) => {
        const handler = (_, toolName, args) => callback(toolName, args);
        electron_1.ipcRenderer.on('agent:tool', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:tool', handler);
    },
});
