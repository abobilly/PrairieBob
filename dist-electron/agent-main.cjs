"use strict";
/**
 * Copilot Agent - Electron Main Process (Stub)
 *
 * Temporary stub while SDK package issues are resolved.
 * Provides IPC handlers that return placeholder responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAgentIPC = registerAgentIPC;
const electron_1 = require("electron");
// Get main window to send events to renderer
function getMainWindow() {
    const windows = electron_1.BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
}
// Send message to renderer
function sendToRenderer(channel, ...args) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
    }
}
// Register IPC handlers (stubbed)
function registerAgentIPC() {
    // Start the agent (stub)
    electron_1.ipcMain.handle('agent:start', async () => {
        console.log('[Agent] Start requested (stubbed)');
        sendToRenderer('agent:message', {
            role: 'system',
            content: 'AI Agent is currently disabled. SDK integration in progress.',
            timestamp: new Date().toISOString(),
        });
        return { success: false, error: 'Agent SDK temporarily disabled' };
    });
    // Send a message (stub)
    electron_1.ipcMain.handle('agent:send', async (_, prompt) => {
        console.log('[Agent] Send:', prompt);
        sendToRenderer('agent:message', {
            role: 'user',
            content: prompt,
            timestamp: new Date().toISOString(),
        });
        sendToRenderer('agent:message', {
            role: 'assistant',
            content: 'AI Agent is currently disabled. This feature is coming soon!',
            timestamp: new Date().toISOString(),
        });
        return { success: false, error: 'Agent SDK temporarily disabled' };
    });
    // Abort (stub)
    electron_1.ipcMain.handle('agent:abort', async () => {
        return { success: true };
    });
    // Stop (stub)
    electron_1.ipcMain.handle('agent:stop', async () => {
        return { success: true };
    });
    // Check if connected (stub)
    electron_1.ipcMain.handle('agent:isConnected', () => {
        return false;
    });
    console.log('[Agent] IPC handlers registered (stubbed mode)');
}
