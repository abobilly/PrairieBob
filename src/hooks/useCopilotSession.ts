/**
 * useCopilotSession - React hook for GitHub Copilot SDK integration
 * 
 * Provides real-time streaming of Copilot responses via IPC events from the
 * Electron main process. Follows 2026 ACP (Agent Client Protocol) standards.
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export type AgentState = 'idle' | 'thinking' | 'executing';

export interface AgentMessage {
  role: string;
  content: string;
  timestamp: string;
  toolName?: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface UseCopilotSessionResult {
  // State
  isConnected: boolean;
  state: AgentState;
  messages: AgentMessage[];
  pendingContent: string;
  error: string | null;
  activeTool: ToolCall | null;

  // Actions
  start: () => Promise<void>;
  send: (prompt: string) => Promise<void>;
  abort: () => Promise<void>;
  stop: () => Promise<void>;
  setContext: (context: Record<string, unknown>) => Promise<void>;
  clearMessages: () => void;
}

export function useCopilotSession(): UseCopilotSessionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<AgentState>('idle');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pendingContent, setPendingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolCall | null>(null);
  
  // Track cleanups
  const cleanupRefs = useRef<(() => void)[]>([]);

  // Check initial connection status
  useEffect(() => {
    window.electron?.agent.isConnected().then(setIsConnected);
  }, []);

  // Subscribe to IPC events
  useEffect(() => {
    if (!window.electron) return;
    
    const cleanups: (() => void)[] = [];

    // Message events (complete messages)
    cleanups.push(
      window.electron.onAgentMessage((message: AgentMessage) => {
        setMessages(prev => [...prev, message]);
        setPendingContent(''); // Clear pending when complete message arrives
        if (message.role === 'assistant' && !message.toolName) {
          setState('idle');
        }
      })
    );

    // Delta events (streaming tokens)
    cleanups.push(
      window.electron.onAgentDelta((delta: string) => {
        setPendingContent(prev => prev + delta);
      })
    );

    // State change events
    cleanups.push(
      window.electron.onAgentState((newState: AgentState) => {
        setState(newState);
        if (newState === 'idle') {
          setActiveTool(null);
        }
      })
    );

    // Error events
    cleanups.push(
      window.electron.onAgentError((errorMsg: string) => {
        setError(errorMsg);
        setState('idle');
        setActiveTool(null);
      })
    );

    // Tool call events
    cleanups.push(
      window.electron.onAgentTool((toolName: string, args: Record<string, unknown>) => {
        setActiveTool({ name: toolName, args });
        setState('executing');
      })
    );

    cleanupRefs.current = cleanups;

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, []);

  // Actions
  const start = useCallback(async () => {
    if (!window.electron) return;
    try {
      setError(null);
      await window.electron.agent.start();
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsConnected(false);
    }
  }, []);

  const send = useCallback(async (prompt: string) => {
    if (!window.electron) return;
    try {
      setError(null);
      setPendingContent('');
      setState('thinking');
      
      // Add user message immediately
      setMessages(prev => [...prev, {
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString()
      }]);
      
      await window.electron.agent.send(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('idle');
    }
  }, []);

  const abort = useCallback(async () => {
    if (!window.electron) return;
    try {
      await window.electron.agent.abort();
      setState('idle');
      setPendingContent('');
      setActiveTool(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const stop = useCallback(async () => {
    if (!window.electron) return;
    try {
      await window.electron.agent.stop();
      setIsConnected(false);
      setState('idle');
      setPendingContent('');
      setActiveTool(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const setContext = useCallback(async (context: Record<string, unknown>) => {
    if (!window.electron) return;
    try {
      await window.electron.agent.setContext(context);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingContent('');
    setError(null);
    setActiveTool(null);
  }, []);

  return {
    isConnected,
    state,
    messages,
    pendingContent,
    error,
    activeTool,
    start,
    send,
    abort,
    stop,
    setContext,
    clearMessages,
  };
}
