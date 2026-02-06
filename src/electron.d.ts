/**
 * Global type declarations for Electron IPC bridge
 * These types match the API exposed in electron/preload.ts
 */

export interface DirEntry {
    name: string;
    isDirectory: boolean;
}

export interface AgentMessage {
    role: string;
    content: string;
    timestamp: string;
    toolName?: string;
}

export interface AgentResult {
    success: boolean;
    error?: string;
    alreadyStarted?: boolean;
    authRequired?: boolean;
    authStatus?: {
        isAuthenticated: boolean;
        authType?: string;
        host?: string;
        login?: string;
        statusMessage?: string;
    };
    resumedSessionId?: string | null;
    sessionId?: string;
}

export interface ElectronAPI {
    fs: {
        readFile: (path: string) => Promise<string>;
        readFileBase64: (path: string) => Promise<string>;
        writeFileBase64: (path: string, base64: string) => Promise<boolean>;
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
        readDir: (path: string) => Promise<DirEntry[]>;
        mkdir: (path: string) => Promise<boolean>;
    };
    app: {
        getPaths: () => Promise<{ appPath: string; resourcesPath: string; isPackaged: boolean }>;
    };
    watcher: {
        start: (rootPath: string) => Promise<boolean>;
        stop: () => Promise<boolean>;
    };
    dialog: {
        openFile: (options: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string; content?: string }>;
        saveFile: (options: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string }>;
        openDirectory: () => Promise<{ canceled: boolean; filePath?: string }>;
    };
    editor: {
        setUnsaved: (unsaved: boolean) => void;
    };
    tools: {
        launchBobTile: () => Promise<boolean>;
    };
    // Agent API for Copilot SDK communication
    agent: {
        start: (projectPath?: string) => Promise<AgentResult>;
        send: (prompt: string) => Promise<AgentResult>;
        abort: () => Promise<AgentResult>;
        stop: () => Promise<AgentResult>;
        isConnected: () => Promise<boolean>;
        getAuthStatus: () => Promise<{ success: boolean; error?: string; authStatus?: AgentResult['authStatus'] }>;
        setContext: (context: Record<string, unknown>) => Promise<AgentResult>;
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
    onProjectOpened: (callback: (path: string) => void) => () => void;
    onRoomOpened: (callback: (data: { path: string; content: string }) => void) => () => void;
    onRoomSaveAs: (callback: (path: string) => void) => () => void;
    onProjectFileChanged: (callback: (change: { path: string; eventType: 'change' | 'rename' }) => void) => () => void;
    // Agent event listeners
    onAgentMessage: (callback: (message: AgentMessage) => void) => () => void;
    onAgentDelta: (callback: (delta: string) => void) => () => void;
    onAgentState: (callback: (state: 'idle' | 'thinking' | 'executing') => void) => () => void;
    onAgentError: (callback: (error: string) => void) => () => void;
    onAgentTool: (callback: (toolName: string, args: Record<string, unknown>) => void) => () => void;
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}

export { };
