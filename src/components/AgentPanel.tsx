import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Terminal as TerminalIcon, Bot, Send, Loader2, Plug, PlugZap } from 'lucide-react';
import { useProjectStore } from '@/stores';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
}

export function AgentPanel() {
  const [activeTab, setActiveTab] = useState<'chat' | 'terminal'>('chat');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get store actions for tool handlers
  const { paintTiles, fillArea, placeEntity, mapData, tilesets } = useProjectStore();

  // Setup IPC event listeners for agent communication
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return;

    const unsubMessage = window.electron.onAgentMessage((msg) => {
      setMessages(prev => [...prev, {
        role: msg.role as AgentMessage['role'],
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        toolName: msg.toolName,
      }]);
      setStreamingContent('');
    });

    const unsubDelta = window.electron.onAgentDelta((delta) => {
      setStreamingContent(prev => prev + delta);
    });

    const unsubState = window.electron.onAgentState((state) => {
      setIsLoading(state !== 'idle');
    });

    const unsubError = window.electron.onAgentError((error) => {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error}`,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    });

    const unsubTool = window.electron.onAgentTool((toolName, args) => {
      // Handle tool calls from the agent
      handleToolCall(toolName, args);
    });

    return () => {
      unsubMessage();
      unsubDelta();
      unsubState();
      unsubError();
      unsubTool();
    };
  }, []);

  // Handle tool calls from the agent in the main process
  const handleToolCall = useCallback((toolName: string, args: Record<string, unknown>) => {
    switch (toolName) {
      case 'paint_tiles': {
        const layer = args.layer as string;
        const tiles = args.tiles as Array<{ x: number; y: number; tileId: number }>;
        const layerIndex = mapData?.layers.findIndex(l => l.name === layer) ?? 0;
        paintTiles(layerIndex, tiles);
        break;
      }
      case 'fill_layer': {
        const layer = args.layer as string;
        const tileId = args.tileId as number;
        const region = args.region as { x: number; y: number; width: number; height: number } | undefined;
        const layerIndex = mapData?.layers.findIndex(l => l.name === layer) ?? 0;
        if (region) {
          const tiles: Array<{ x: number; y: number; tileId: number }> = [];
          for (let y = region.y; y < region.y + region.height; y++) {
            for (let x = region.x; x < region.x + region.width; x++) {
              tiles.push({ x, y, tileId });
            }
          }
          paintTiles(layerIndex, tiles);
        } else if (mapData) {
          fillArea(layerIndex, 0, 0, tileId);
        }
        break;
      }
      case 'place_entity': {
        const type = args.type as string;
        const x = args.x as number;
        const y = args.y as number;
        const properties = args.properties as Record<string, string | number | boolean> | undefined;
        const baseSize = mapData?.tileSize || 32;
        const size = type === 'ladder' ? { width: baseSize, height: baseSize * 2 } : { width: baseSize, height: baseSize };
        placeEntity({
          id: `${type}_${Date.now()}`,
          type: type as 'spawn_point' | 'door' | 'npc' | 'trigger' | 'prop' | 'stairs' | 'ladder' | 'portal',
          x,
          y,
          width: size.width,
          height: size.height,
          properties: properties || {},
        });
        break;
      }
    }
  }, [mapData, paintTiles, fillArea, placeEntity]);

  // Initialize agent service via IPC
  const connectAgent = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: 'Agent only available in Electron environment.',
        timestamp: new Date(),
      }]);
      return;
    }

    if (isConnected) return;
    setIsLoading(true);

    try {
      const result = await window.electron.agent.start();

      if (result.success) {
        setIsConnected(true);
      } else {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Failed to connect: ${result.error}. Make sure Copilot CLI is installed.`,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Failed to connect agent:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // Disconnect agent on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.electron) {
        window.electron.agent.stop();
      }
    };
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (activeTab === 'terminal' && terminalRef.current && !terminalInstance.current) {
      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#eaeaea',
          cursor: '#f97316',
          cursorAccent: '#1a1a2e',
          selectionBackground: '#f9731644',
        },
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 13,
        cursorBlink: true,
      });

      fitAddon.current = new FitAddon();
      term.loadAddon(fitAddon.current);
      term.open(terminalRef.current);
      fitAddon.current.fit();

      term.writeln('\x1b[38;5;208m╔══════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[38;5;208m║\x1b[0m  \x1b[1;33mPrairieBob Terminal\x1b[0m                 \x1b[38;5;208m║\x1b[0m');
      term.writeln('\x1b[38;5;208m╚══════════════════════════════════════╝\x1b[0m');
      term.writeln('');
      term.writeln('Type \x1b[1;36mprairiebob --help\x1b[0m for available commands.');
      term.writeln('');
      term.write('\x1b[1;32m❯\x1b[0m ');

      let currentLine = '';

      term.onKey(({ key, domEvent }) => {
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

        if (domEvent.key === 'Enter') {
          term.writeln('');
          handleTerminalCommand(term, currentLine.trim());
          currentLine = '';
          term.write('\x1b[1;32m❯\x1b[0m ');
        } else if (domEvent.key === 'Backspace') {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            term.write('\b \b');
          }
        } else if (printable) {
          currentLine += key;
          term.write(key);
        }
      });

      terminalInstance.current = term;

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.current?.fit();
      });
      resizeObserver.observe(terminalRef.current);

      return () => {
        resizeObserver.disconnect();
        term.dispose();
        terminalInstance.current = null;
      };
    }
  }, [activeTab]);

  const handleTerminalCommand = async (term: Terminal, command: string) => {
    if (!command) return;

    const parts = command.split(' ');
    const cmd = parts[0];

    // Helper to send to agent and stream response to terminal
    const askAgent = async (prompt: string) => {
      if (!isConnected) {
        term.writeln('\x1b[1;33mConnecting to agent...\x1b[0m');
        await connectAgent();
      }

      if (!isConnected && typeof window !== 'undefined' && window.electron) {
        const connected = await window.electron.agent.isConnected();
        if (!connected) {
          term.writeln('\x1b[1;31mFailed to connect to agent.\x1b[0m');
          return;
        }
      }

      term.writeln('\x1b[1;35m[Agent]\x1b[0m');

      try {
        await window.electron.agent.send(prompt);
      } catch (error) {
        term.writeln(`\x1b[1;31mError: ${error}\x1b[0m`);
      }
    };

    if (cmd === 'prairiebob' || cmd === 'pb') {
      const subCmd = parts[1];

      switch (subCmd) {
        case '--help':
        case 'help':
          term.writeln('\x1b[1;33mPrairieBob CLI Commands:\x1b[0m');
          term.writeln('');
          term.writeln('  \x1b[1;36mlist\x1b[0m layers|tilesets|entities  List resources');
          term.writeln('  \x1b[1;36mpaint\x1b[0m --layer --tile --at      Paint tiles');
          term.writeln('  \x1b[1;36mfill\x1b[0m --layer --tile            Fill layer');
          term.writeln('  \x1b[1;36mspawn\x1b[0m --entity --at            Place entity');
          term.writeln('  \x1b[1;36mexport\x1b[0m --format                Export map');
          term.writeln('  \x1b[1;36mask\x1b[0m <natural language>         Ask agent');
          term.writeln('');
          term.writeln('  Or just type naturally - it goes to the agent!');
          break;

        case 'list': {
          const resource = parts[2] || 'info';
          if (resource === 'layers') {
            term.writeln('\x1b[1;33mLayers:\x1b[0m');
            mapData?.layers.forEach((l, i) => {
              term.writeln(`  ${i === 0 ? '→' : ' '} ${l.name} (${l.type})`);
            });
          } else if (resource === 'tilesets') {
            term.writeln('\x1b[1;33mTilesets:\x1b[0m');
            tilesets.forEach(ts => {
              term.writeln(`  • ${ts.name} (${ts.totalTiles} tiles)`);
            });
          } else if (resource === 'entities') {
            const entities = mapData?.layers.find(l => l.name === 'Entities')?.objects || [];
            term.writeln('\x1b[1;33mEntities:\x1b[0m');
            if (entities.length === 0) term.writeln('  (none)');
            else entities.forEach(e => term.writeln(`  • ${e.id} (${e.type})`));
          } else {
            term.writeln(`\x1b[1;33mMap:\x1b[0m ${mapData?.width}×${mapData?.height}, ${mapData?.layers.length} layers, ${tilesets.length} tilesets`);
          }
          break;
        }

        case 'ask': {
          const question = parts.slice(2).join(' ');
          if (question) {
            await askAgent(question);
          } else {
            term.writeln('\x1b[1;31mUsage:\x1b[0m pb ask <question>');
          }
          break;
        }

        case 'fill': {
          const layerIdx = parts.indexOf('--layer');
          const tileIdx = parts.indexOf('--tile');
          const layer = layerIdx !== -1 ? parts[layerIdx + 1] : 'Floor';
          const tile = tileIdx !== -1 ? parts[tileIdx + 1] : null;
          if (!tile) { term.writeln('\x1b[1;31mUsage:\x1b[0m pb fill --layer Floor --tile 5'); break; }
          await askAgent(`Fill the ${layer} layer with tile ID ${tile}`);
          break;
        }

        case 'paint': {
          const layerIdx = parts.indexOf('--layer');
          const tileIdx = parts.indexOf('--tile');
          const atIdx = parts.indexOf('--at');
          const layer = layerIdx !== -1 ? parts[layerIdx + 1] : 'Floor';
          const tile = tileIdx !== -1 ? parts[tileIdx + 1] : null;
          const at = atIdx !== -1 ? parts[atIdx + 1] : null;
          if (!tile || !at) { term.writeln('\x1b[1;31mUsage:\x1b[0m pb paint --layer Floor --tile 5 --at 3,4'); break; }
          await askAgent(`Paint tile ${tile} on ${layer} at ${at}`);
          break;
        }

        case 'spawn': {
          const entityIdx = parts.indexOf('--entity');
          const atIdx = parts.indexOf('--at');
          const entity = entityIdx !== -1 ? parts[entityIdx + 1] : null;
          const at = atIdx !== -1 ? parts[atIdx + 1] : null;
          if (!entity || !at) { term.writeln('\x1b[1;31mUsage:\x1b[0m pb spawn --entity door --at 100,50'); break; }
          await askAgent(`Place a ${entity} at pixel position ${at}`);
          break;
        }

        case 'export': {
          const formatIdx = parts.indexOf('--format');
          const format = formatIdx !== -1 ? parts[formatIdx + 1] : 'kimbar';
          await askAgent(`Export the map as ${format}`);
          break;
        }

        default:
          if (subCmd) {
            await askAgent(parts.slice(1).join(' '));
          } else {
            term.writeln('Type \x1b[1;36mpb help\x1b[0m for commands');
          }
      }
    } else if (cmd === 'clear' || cmd === 'cls') {
      term.clear();
    } else {
      // Any other input goes to agent
      await askAgent(command);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (typeof window === 'undefined' || !window.electron) return;

    const prompt = input.trim();
    setInput('');

    if (!isConnected) {
      // Auto-connect on first message
      await connectAgent();
    }

    try {
      await window.electron.agent.send(prompt);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col pb-compact-panel">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'terminal')} className="flex flex-col h-full">
        {/* Compact console tabs */}
        <div className="pb-console-tabs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-console-tab ${activeTab === 'chat' ? 'active' : ''}`}
          >
            <Bot size={10} className="inline mr-1" />
            Agent
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`pb-console-tab ${activeTab === 'terminal' ? 'active' : ''}`}
          >
            <TerminalIcon size={10} className="inline mr-1" />
            Term
          </button>
          <div className="ml-auto flex items-center pr-2">
            <button
              onClick={connectAgent}
              disabled={isConnected || isLoading}
              className="pb-icon-btn-xs"
              title={isConnected ? 'Connected' : 'Connect to agent'}
            >
              {isConnected ? (
                <PlugZap size={10} className="text-green-500" />
              ) : (
                <Plug size={10} />
              )}
            </button>
          </div>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden">
          {/* Compact messages area */}
          <div className="pb-console-messages flex-1 overflow-y-auto">
            {messages.length === 0 && !isConnected && (
              <div className="text-center text-[10px] py-4 opacity-50">
                <Bot size={16} className="mx-auto mb-1" />
                <p>Connect to agent</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`pb-console-msg ${msg.role}`}
              >
                {msg.role === 'tool' && msg.toolName && (
                  <span className="text-green-500">⚙ </span>
                )}
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            ))}
            {streamingContent && (
              <div className="pb-console-msg assistant">
                <span className="whitespace-pre-wrap">{streamingContent}</span>
                <span className="inline-block w-1 h-3 bg-accent animate-pulse ml-1" />
              </div>
            )}
            {isLoading && !streamingContent && (
              <div className="pb-console-msg system flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Compact input */}
          <div className="pb-console-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent..."
              title="Message input"
              className="pb-console-input"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="pb-console-send-btn"
              title="Send message"
            >
              <Send size={10} />
            </button>
          </div>
        </TabsContent>

        <TabsContent value="terminal" className="flex-1 m-0 p-0 overflow-hidden">
          <div ref={terminalRef} className="h-full w-full" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
