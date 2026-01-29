/**
 * Global type declarations for Electron IPC bridge
 * These types match the API exposed in electron/preload.ts
 */

export interface ElectronAPI {
    fs: {
        readFile: (path: string) => Promise<string>;
        readFileBase64: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
        readDir: (path: string) => Promise<string[]>;
        mkdir: (path: string) => Promise<boolean>;
    };
    dialog: {
        openFile: (options: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string; content?: string }>;
        saveFile: (options: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string }>;
        openDirectory: () => Promise<{ canceled: boolean; filePath?: string }>;
    };
    editor: {
        setUnsaved: (unsaved: boolean) => void;
        launchBobTile: () => Promise<boolean>;
    };
    // Menu event listeners - return unsubscribe function
    onMenuSave: (callback: () => void) => () => void;
    onMenuUndo: (callback: () => void) => () => void;
    onMenuRedo: (callback: () => void) => () => void;
    onMenuToggleGrid: (callback: () => void) => () => void;
    onMenuZoomIn: (callback: () => void) => () => void;
    onMenuZoomOut: (callback: () => void) => () => void;
    onMenuZoomReset: (callback: () => void) => () => void;
    onMenuExport: (callback: () => void) => () => void;
    onRoomOpened: (callback: (data: { path: string; content: string }) => void) => () => void;
    onRoomSaveAs: (callback: (path: string) => void) => () => void;
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}

export { };
