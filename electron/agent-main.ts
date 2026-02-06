/**
 * Copilot Agent - Electron Main Process
 * 
 * Integrates @github/copilot-sdk for AI-assisted tile map editing.
 * Uses ACP (Agent Client Protocol) for real-time streaming.
 */

import { ipcMain, BrowserWindow, app } from 'electron';
import type { CopilotClient as CopilotClientType, CopilotSession as CopilotSessionType, SessionConfig } from '@github/copilot-sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';

// SDK client and session state
type CopilotSdkModule = typeof import('@github/copilot-sdk');

let sdkModulePromise: Promise<CopilotSdkModule> | null = null;
let client: CopilotClientType | null = null;
let session: CopilotSessionType | null = null;
let currentProjectPath: string | null = null;
let eventUnsubscribers: (() => void)[] = [];
const DEFAULT_MODEL = 'claude-sonnet-4.5';

function loadCopilotSdk(): Promise<CopilotSdkModule> {
    if (!sdkModulePromise) {
        // Keep native dynamic import in CJS output to load ESM-only package.
        sdkModulePromise = Function('return import("@github/copilot-sdk")')() as Promise<CopilotSdkModule>;
    }
    return sdkModulePromise;
}

type PersistedSessionState = {
    sessionId: string;
    model: string;
    updatedAt: string;
};

function getCopilotConfigDir(): string {
    return path.join(app.getPath('userData'), 'copilot');
}

function getSessionStatePath(): string {
    return path.join(app.getPath('userData'), 'copilot-session.json');
}

function ensureDirectory(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
}

function loadPersistedSessionState(): PersistedSessionState | null {
    try {
        const statePath = getSessionStatePath();
        if (!fs.existsSync(statePath)) return null;
        const raw = fs.readFileSync(statePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedSessionState>;
        if (!parsed || typeof parsed.sessionId !== 'string' || parsed.sessionId.length === 0) {
            return null;
        }
        return {
            sessionId: parsed.sessionId,
            model: typeof parsed.model === 'string' && parsed.model.length > 0 ? parsed.model : DEFAULT_MODEL,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function persistSessionState(state: PersistedSessionState): void {
    const statePath = getSessionStatePath();
    const payload = JSON.stringify(state, null, 2);
    fs.writeFileSync(statePath, payload, 'utf-8');
}

function clearPersistedSessionState(): void {
    const statePath = getSessionStatePath();
    if (fs.existsSync(statePath)) {
        fs.unlinkSync(statePath);
    }
}

// Get main window to send events to renderer
function getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
}

// Send message to renderer
function sendToRenderer(channel: string, ...args: unknown[]) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
    }
}

// Update agent state in renderer
function updateState(state: 'idle' | 'thinking' | 'executing') {
    sendToRenderer('agent:state', state);
}

// Register IPC handlers with real SDK integration
export function registerAgentIPC() {
    // Start the agent and create a session
    ipcMain.handle('agent:start', async (_event, projectPath?: string) => {
        try {
            if (client && session) {
                console.log('[Agent] Already connected');
                return { success: true, alreadyStarted: true };
            }

            console.log('[Agent] Initializing CopilotClient...');
            currentProjectPath = projectPath || process.cwd();
            const copilotConfigDir = getCopilotConfigDir();
            ensureDirectory(copilotConfigDir);
            const sdk = await loadCopilotSdk();

            // Initialize SDK client using logged-in user auth + persistent local config dir.
            client = new sdk.CopilotClient({
                cwd: currentProjectPath,
                useLoggedInUser: true,
                cliArgs: ['--config-dir', copilotConfigDir],
            });
            await client.start();

            const authStatus = await client.getAuthStatus();
            if (!authStatus.isAuthenticated) {
                await client.stop();
                client = null;
                updateState('idle');
                return {
                    success: false,
                    authRequired: true,
                    error: 'Copilot CLI is not authenticated. Run `copilot login` once in a terminal, then reconnect.',
                    authStatus,
                };
            }

            const sessionConfig: SessionConfig = {
                model: DEFAULT_MODEL,
                infiniteSessions: { enabled: true },
                configDir: copilotConfigDir,
                workingDirectory: currentProjectPath,
            };

            const persistedState = loadPersistedSessionState();
            if (persistedState?.sessionId) {
                try {
                    session = await client.resumeSession(persistedState.sessionId, sessionConfig);
                    console.log('[Agent] Resumed session:', persistedState.sessionId);
                } catch (resumeError) {
                    console.warn('[Agent] Failed to resume persisted session. Creating a new one.', resumeError);
                    clearPersistedSessionState();
                    session = await client.createSession(sessionConfig);
                }
            } else {
                session = await client.createSession(sessionConfig);
            }

            persistSessionState({
                sessionId: session.sessionId,
                model: sessionConfig.model ?? DEFAULT_MODEL,
                updatedAt: new Date().toISOString(),
            });

            // Set up event listeners for streaming
            // Subscribe to message deltas (streaming tokens)
            eventUnsubscribers.push(
                session.on('assistant.message_delta', (event) => {
                    sendToRenderer('agent:delta', event.data.deltaContent);
                })
            );

            // Subscribe to complete messages
            eventUnsubscribers.push(
                session.on('assistant.message', (event) => {
                    sendToRenderer('agent:message', {
                        role: 'assistant',
                        content: event.data.content,
                        timestamp: new Date().toISOString(),
                    });
                    updateState('idle');
                })
            );

            // Subscribe to tool calls
            eventUnsubscribers.push(
                session.on('tool.execution_start', (event) => {
                    updateState('executing');
                    sendToRenderer('agent:tool', event.data.toolName, event.data.arguments);
                })
            );

            // Subscribe to tool completion
            eventUnsubscribers.push(
                session.on('tool.execution_complete', () => {
                    updateState('thinking');
                })
            );

            // Subscribe to errors
            eventUnsubscribers.push(
                session.on('session.error', (event) => {
                    sendToRenderer('agent:error', event.data.message);
                    updateState('idle');
                })
            );

            // Subscribe to session idle (turn complete)
            eventUnsubscribers.push(
                session.on('session.idle', () => {
                    updateState('idle');
                })
            );

            sendToRenderer('agent:message', {
                role: 'system',
                content: 'AI Agent connected. Ready to assist with tile map editing.',
                timestamp: new Date().toISOString(),
            });

            updateState('idle');
            console.log('[Agent] SDK session started successfully');
            return {
                success: true,
                authStatus,
                resumedSessionId: persistedState?.sessionId ?? null,
                sessionId: session.sessionId,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[Agent] Failed to start:', errorMessage);
            sendToRenderer('agent:error', errorMessage);
            return { success: false, error: errorMessage };
        }
    });

    // Send a message to the agent
    ipcMain.handle('agent:send', async (_event, prompt: string) => {
        if (!session) {
            return { success: false, error: 'Agent not connected. Call agent:start first.' };
        }

        try {
            console.log('[Agent] Sending prompt:', prompt.substring(0, 100) + '...');
            updateState('thinking');

            // Send prompt - events will stream via the handlers set up above
            await session.send({ prompt });

            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[Agent] Send failed:', errorMessage);
            sendToRenderer('agent:error', errorMessage);
            updateState('idle');
            return { success: false, error: errorMessage };
        }
    });

    // Abort current operation
    ipcMain.handle('agent:abort', async () => {
        if (session) {
            try {
                await session.abort();
                updateState('idle');
                return { success: true };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return { success: false, error: errorMessage };
            }
        }
        return { success: true };
    });

    // Stop the agent and clean up
    ipcMain.handle('agent:stop', async () => {
        try {
            // Unsubscribe from all events
            eventUnsubscribers.forEach(unsub => unsub());
            eventUnsubscribers = [];

            if (session) {
                await session.destroy();
                session = null;
            }
            if (client) {
                await client.stop();
                client = null;
            }
            currentProjectPath = null;
            
            sendToRenderer('agent:message', {
                role: 'system',
                content: 'AI Agent disconnected.',
                timestamp: new Date().toISOString(),
            });

            console.log('[Agent] Stopped and cleaned up');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[Agent] Stop failed:', errorMessage);
            return { success: false, error: errorMessage };
        }
    });

    // Check if connected
    ipcMain.handle('agent:isConnected', () => {
        return !!(client && session);
    });

    // Retrieve auth status from the SDK/CLI.
    ipcMain.handle('agent:getAuthStatus', async () => {
        const copilotConfigDir = getCopilotConfigDir();
        ensureDirectory(copilotConfigDir);

        let tempClient: CopilotClientType | null = null;
        try {
            const sdk = await loadCopilotSdk();
            tempClient = new sdk.CopilotClient({
                cwd: currentProjectPath || process.cwd(),
                useLoggedInUser: true,
                cliArgs: ['--config-dir', copilotConfigDir],
            });
            await tempClient.start();
            const authStatus = await tempClient.getAuthStatus();
            await tempClient.stop();
            tempClient = null;
            return { success: true, authStatus };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (tempClient) {
                await tempClient.stop().catch(() => {});
            }
            return { success: false, error: message };
        }
    });

    // Set project context for the agent
    ipcMain.handle('agent:setContext', async (_event, context: { projectPath?: string; currentLevel?: string; currentLayer?: string }) => {
        if (!session) {
            return { success: false, error: 'Agent not connected' };
        }

        try {
            if (context.projectPath) {
                currentProjectPath = context.projectPath;
            }
            // Context can be used to inform the agent about current editing state
            console.log('[Agent] Context updated:', context);
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
    });

    console.log('[Agent] IPC handlers registered (SDK mode)');
}
