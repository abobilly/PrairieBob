/**
 * FileSystemAdapter - Abstraction for file operations
 * 
 * This allows the app to work in both:
 * - Electron (full filesystem access via IPC)
 * - Browser fallback (localStorage + File System Access API)
 */

import type { LevelData } from './types';

export interface FileSystemAdapter {
    // Room operations
    openRoom(): Promise<{ path: string; data: LevelData } | null>;
    saveRoom(path: string, data: LevelData): Promise<boolean>;
    saveRoomAs(data: LevelData): Promise<string | null>;

    // Project operations
    openProject(): Promise<string | null>;
    readProjectConfig(projectPath: string): Promise<unknown | null>;

    // Generic file operations
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<boolean>;
    exists(path: string): Promise<boolean>;
    readDir(path: string): Promise<Array<{ name: string; isDirectory: boolean }>>;

    // State
    setUnsavedChanges(unsaved: boolean): void;
}

/**
 * Electron implementation - uses IPC bridge
 */
export class ElectronFSAdapter implements FileSystemAdapter {
    async openRoom(): Promise<{ path: string; data: LevelData } | null> {
        const result = await window.electron!.dialog.openFile({
            title: 'Open Room',
            filters: [
                { name: 'Room Files', extensions: ['json', 'tmx'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        const path = result.filePath;
        const content = await window.electron!.fs.readFile(path);
        const data = JSON.parse(content) as LevelData;

        return { path, data };
    }

    async saveRoom(path: string, data: LevelData): Promise<boolean> {
        const content = JSON.stringify(data, null, 2);
        await window.electron!.fs.writeFile(path, content);
        this.setUnsavedChanges(false);
        return true;
    }

    async saveRoomAs(data: LevelData): Promise<string | null> {
        const result = await window.electron!.dialog.saveFile({
            title: 'Save Room As',
            filters: [{ name: 'JSON Room', extensions: ['json'] }],
        });

        if (result.canceled || !result.filePath) {
            return null;
        }

        await this.saveRoom(result.filePath, data);
        return result.filePath;
    }

    async openProject(): Promise<string | null> {
        const result = await window.electron!.dialog.openDirectory();
        if (result.canceled || !result.filePath) {
            return null;
        }
        return result.filePath;
    }

    async readProjectConfig(projectPath: string): Promise<unknown | null> {
        const configPath = `${projectPath}/prairiebob.config.json`;
        if (await this.exists(configPath)) {
            const content = await this.readFile(configPath);
            return JSON.parse(content);
        }
        return null;
    }

    async readFile(path: string): Promise<string> {
        return window.electron!.fs.readFile(path);
    }

    async writeFile(path: string, content: string): Promise<boolean> {
        await window.electron!.fs.writeFile(path, content);
        return true;
    }

    async exists(path: string): Promise<boolean> {
        return window.electron!.fs.exists(path);
    }

    async readDir(path: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
        const names = await window.electron!.fs.readDir(path);
        // Convert string[] to the expected format
        // In a real implementation, preload should return the full info
        return names.map(name => ({ name, isDirectory: name.endsWith('/') }));
    }

    setUnsavedChanges(unsaved: boolean): void {
        window.electron!.editor.setUnsaved(unsaved);
    }
}

/**
 * Browser fallback - uses localStorage + File System Access API
 */
export class BrowserFSAdapter implements FileSystemAdapter {
    private readonly STORAGE_KEY = 'prairiebob-current-room';

    async openRoom(): Promise<{ path: string; data: LevelData } | null> {
        // Try File System Access API first
        if ('showOpenFilePicker' in window) {
            try {
                const [handle] = await (window as any).showOpenFilePicker({
                    types: [{
                        description: 'Room Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const file = await handle.getFile();
                const content = await file.text();
                const data = JSON.parse(content) as LevelData;
                return { path: file.name, data };
            } catch {
                return null; // User cancelled
            }
        }

        // Fallback to localStorage
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            return { path: 'local-storage', data: JSON.parse(saved) };
        }
        return null;
    }

    async saveRoom(path: string, data: LevelData): Promise<boolean> {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        return true;
    }

    async saveRoomAs(data: LevelData): Promise<string | null> {
        // Try File System Access API
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: `${data.id}.json`,
                    types: [{
                        description: 'JSON Room',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(JSON.stringify(data, null, 2));
                await writable.close();
                return handle.name;
            } catch {
                return null;
            }
        }

        // Fallback: download as file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        return data.id + '.json';
    }

    async openProject(): Promise<string | null> {
        console.warn('Project opening not available in browser mode');
        return null;
    }

    async readProjectConfig(): Promise<unknown | null> {
        return null;
    }

    async readFile(): Promise<string> {
        throw new Error('Direct file reading not available in browser mode');
    }

    async writeFile(): Promise<boolean> {
        throw new Error('Direct file writing not available in browser mode');
    }

    async exists(): Promise<boolean> {
        return false;
    }

    async readDir(): Promise<Array<{ name: string; isDirectory: boolean }>> {
        return [];
    }

    setUnsavedChanges(): void {
        // No-op in browser
    }
}

/**
 * Factory function - returns appropriate adapter based on environment
 */
export function createFileSystemAdapter(): FileSystemAdapter {
    if (typeof window !== 'undefined' && window.electron) {
        return new ElectronFSAdapter();
    }
    return new BrowserFSAdapter();
}

// Singleton instance
let fsAdapter: FileSystemAdapter | null = null;

export function getFileSystemAdapter(): FileSystemAdapter {
    if (!fsAdapter) {
        fsAdapter = createFileSystemAdapter();
    }
    return fsAdapter;
}
