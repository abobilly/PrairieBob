/**
 * SpudTile - Electron Preload Script
 * 
 * This script runs in a sandboxed context and exposes a safe API
 * to the renderer (React) via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electron', {
    // ============== File System ==============
    fs: {
        readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
        readFileBase64: (filePath: string) => ipcRenderer.invoke('fs:readFileBase64', filePath),
        writeFileBase64: (filePath: string, base64: string) => ipcRenderer.invoke('fs:writeFileBase64', filePath, base64),
        writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
        exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath),
        readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
        mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
        removeFile: (filePath: string) => ipcRenderer.invoke('fs:removeFile', filePath),
    },

    app: {
        getPaths: () => ipcRenderer.invoke('app:getPaths'),
    },

    watcher: {
        start: (rootPath: string) => ipcRenderer.invoke('watcher:start', rootPath),
        stop: () => ipcRenderer.invoke('watcher:stop'),
    },

    tools: {
        launchBobTile: () => ipcRenderer.invoke('tools:launchBobTile'),
    },

    // ============== Dialogs ==============
    dialog: {
        openFile: (options?: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:openFile', options),
        saveFile: (options?: Electron.SaveDialogOptions) => ipcRenderer.invoke('dialog:saveFile', options),
        openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    },

    // ============== Editor State ==============
    editor: {
        setUnsaved: (unsaved: boolean) => ipcRenderer.send('editor:setUnsaved', unsaved),
    },

    // ============== Menu Events ==============
    // These let the renderer respond to native menu actions
    onMenuSave: (callback: () => void) => {
        ipcRenderer.on('menu:save', callback);
        return () => ipcRenderer.removeListener('menu:save', callback);
    },
    onMenuUndo: (callback: () => void) => {
        ipcRenderer.on('menu:undo', callback);
        return () => ipcRenderer.removeListener('menu:undo', callback);
    },
    onMenuRedo: (callback: () => void) => {
        ipcRenderer.on('menu:redo', callback);
        return () => ipcRenderer.removeListener('menu:redo', callback);
    },
    onMenuCut: (callback: () => void) => {
        ipcRenderer.on('menu:cut', callback);
        return () => ipcRenderer.removeListener('menu:cut', callback);
    },
    onMenuCopy: (callback: () => void) => {
        ipcRenderer.on('menu:copy', callback);
        return () => ipcRenderer.removeListener('menu:copy', callback);
    },
    onMenuPaste: (callback: () => void) => {
        ipcRenderer.on('menu:paste', callback);
        return () => ipcRenderer.removeListener('menu:paste', callback);
    },
    onMenuSelectAll: (callback: () => void) => {
        ipcRenderer.on('menu:selectAll', callback);
        return () => ipcRenderer.removeListener('menu:selectAll', callback);
    },
    onMenuToggleGrid: (callback: () => void) => {
        ipcRenderer.on('menu:toggleGrid', callback);
        return () => ipcRenderer.removeListener('menu:toggleGrid', callback);
    },
    onMenuZoomIn: (callback: () => void) => {
        ipcRenderer.on('menu:zoomIn', callback);
        return () => ipcRenderer.removeListener('menu:zoomIn', callback);
    },
    onMenuZoomOut: (callback: () => void) => {
        ipcRenderer.on('menu:zoomOut', callback);
        return () => ipcRenderer.removeListener('menu:zoomOut', callback);
    },
    onMenuZoomReset: (callback: () => void) => {
        ipcRenderer.on('menu:zoomReset', callback);
        return () => ipcRenderer.removeListener('menu:zoomReset', callback);
    },
    onMenuExport: (callback: () => void) => {
        ipcRenderer.on('menu:export', callback);
        return () => ipcRenderer.removeListener('menu:export', callback);
    },
    onMenuValidate: (callback: () => void) => {
        ipcRenderer.on('menu:validate', callback);
        return () => ipcRenderer.removeListener('menu:validate', callback);
    },
    onMenuShowShortcuts: (callback: () => void) => {
        ipcRenderer.on('menu:showShortcuts', callback);
        return () => ipcRenderer.removeListener('menu:showShortcuts', callback);
    },

    // ============== Project/Room Events ==============
    onProjectOpened: (callback: (path: string) => void) => {
        ipcRenderer.on('project:opened', (_, path) => callback(path));
        return () => ipcRenderer.removeAllListeners('project:opened');
    },
    onRoomOpened: (callback: (data: { path: string; content: string }) => void) => {
        ipcRenderer.on('room:opened', (_, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('room:opened');
    },
    onRoomSaveAs: (callback: (path: string) => void) => {
        ipcRenderer.on('room:saveAs', (_, path) => callback(path));
        return () => ipcRenderer.removeAllListeners('room:saveAs');
    },
    onSpudtileOpened: (callback: (path: string) => void) => {
        ipcRenderer.on('spudtile:opened', (_, path) => callback(path));
        return () => ipcRenderer.removeAllListeners('spudtile:opened');
    },
    onProjectFileChanged: (callback: (change: { path: string; eventType: 'change' | 'rename' }) => void) => {
        const handler = (
            _: Electron.IpcRendererEvent,
            change: { path: string; eventType: 'change' | 'rename' },
        ) => callback(change);
        ipcRenderer.on('project:file-changed', handler);
        return () => ipcRenderer.removeListener('project:file-changed', handler);
    },

    // ============== Agent IPC ==============
    agent: {
        start: (projectPath?: string) => ipcRenderer.invoke('agent:start', projectPath),
        send: (prompt: string) => ipcRenderer.invoke('agent:send', prompt),
        abort: () => ipcRenderer.invoke('agent:abort'),
        stop: () => ipcRenderer.invoke('agent:stop'),
        isConnected: () => ipcRenderer.invoke('agent:isConnected'),
        getAuthStatus: () => ipcRenderer.invoke('agent:getAuthStatus'),
        setContext: (context: Record<string, unknown>) => ipcRenderer.invoke('agent:setContext', context),
    },
    onAgentMessage: (callback: (message: { role: string; content: string; timestamp: string; toolName?: string }) => void) => {
        const handler = (_: Electron.IpcRendererEvent, message: { role: string; content: string; timestamp: string; toolName?: string }) => callback(message);
        ipcRenderer.on('agent:message', handler);
        return () => ipcRenderer.removeListener('agent:message', handler);
    },
    onAgentDelta: (callback: (delta: string) => void) => {
        const handler = (_: Electron.IpcRendererEvent, delta: string) => callback(delta);
        ipcRenderer.on('agent:delta', handler);
        return () => ipcRenderer.removeListener('agent:delta', handler);
    },
    onAgentState: (callback: (state: 'idle' | 'thinking' | 'executing') => void) => {
        const handler = (_: Electron.IpcRendererEvent, state: 'idle' | 'thinking' | 'executing') => callback(state);
        ipcRenderer.on('agent:state', handler);
        return () => ipcRenderer.removeListener('agent:state', handler);
    },
    onAgentError: (callback: (error: string) => void) => {
        const handler = (_: Electron.IpcRendererEvent, error: string) => callback(error);
        ipcRenderer.on('agent:error', handler);
        return () => ipcRenderer.removeListener('agent:error', handler);
    },
    onAgentTool: (callback: (toolName: string, args: Record<string, unknown>) => void) => {
        const handler = (_: Electron.IpcRendererEvent, toolName: string, args: Record<string, unknown>) => callback(toolName, args);
        ipcRenderer.on('agent:tool', handler);
        return () => ipcRenderer.removeListener('agent:tool', handler);
    },
});

// TypeScript declaration for the exposed API
declare global {
    interface Window {
        electron: {
            fs: {
                readFile: (filePath: string) => Promise<string>;
                readFileBase64: (filePath: string) => Promise<string>;
                writeFileBase64: (filePath: string, base64: string) => Promise<boolean>;
                writeFile: (filePath: string, content: string) => Promise<boolean>;
                exists: (filePath: string) => Promise<boolean>;
                readDir: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
                mkdir: (dirPath: string) => Promise<boolean>;
                removeFile: (filePath: string) => Promise<boolean>;
            };
            app: {
                getPaths: () => Promise<{ appPath: string; resourcesPath: string; isPackaged: boolean }>;
            };
            watcher: {
                start: (rootPath: string) => Promise<boolean>;
                stop: () => Promise<boolean>;
            };
            tools: {
                launchBobTile: () => Promise<boolean>;
            };
            dialog: {
                openFile: (options?: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
                saveFile: (options?: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
                openDirectory: () => Promise<Electron.OpenDialogReturnValue>;
            };
            editor: {
                setUnsaved: (unsaved: boolean) => void;
            };
            agent: {
                start: (projectPath?: string) => Promise<{ success: boolean; error?: string; alreadyStarted?: boolean; authRequired?: boolean; authStatus?: { isAuthenticated: boolean; authType?: string; host?: string; login?: string; statusMessage?: string }; resumedSessionId?: string | null; sessionId?: string }>;
                send: (prompt: string) => Promise<{ success: boolean; error?: string }>;
                abort: () => Promise<{ success: boolean; error?: string }>;
                stop: () => Promise<{ success: boolean; error?: string }>;
                isConnected: () => Promise<boolean>;
                getAuthStatus: () => Promise<{ success: boolean; error?: string; authStatus?: { isAuthenticated: boolean; authType?: string; host?: string; login?: string; statusMessage?: string } }>;
            };
            onMenuSave: (callback: () => void) => () => void;
            onMenuUndo: (callback: () => void) => () => void;
            onMenuRedo: (callback: () => void) => () => void;
            onMenuCut: (callback: () => void) => () => void;
            onMenuCopy: (callback: () => void) => () => void;
            onMenuPaste: (callback: () => void) => () => void;
            onMenuSelectAll: (callback: () => void) => () => void;
            onMenuToggleGrid: (callback: () => void) => () => void;
            onMenuZoomIn: (callback: () => void) => () => void;
            onMenuZoomOut: (callback: () => void) => () => void;
            onMenuZoomReset: (callback: () => void) => () => void;
            onMenuExport: (callback: () => void) => () => void;
            onMenuValidate: (callback: () => void) => () => void;
            onMenuShowShortcuts: (callback: () => void) => () => void;
            onProjectOpened: (callback: (path: string) => void) => () => void;
            onRoomOpened: (callback: (data: { path: string; content: string }) => void) => () => void;
            onRoomSaveAs: (callback: (path: string) => void) => () => void;
            onSpudtileOpened: (callback: (path: string) => void) => () => void;
            onProjectFileChanged: (callback: (change: { path: string; eventType: 'change' | 'rename' }) => void) => () => void;
            onAgentMessage: (callback: (message: { role: string; content: string; timestamp: string; toolName?: string }) => void) => () => void;
            onAgentDelta: (callback: (delta: string) => void) => () => void;
            onAgentState: (callback: (state: 'idle' | 'thinking' | 'executing') => void) => () => void;
            onAgentError: (callback: (error: string) => void) => () => void;
            onAgentTool: (callback: (toolName: string, args: Record<string, unknown>) => void) => () => void;
        };
    }
}
