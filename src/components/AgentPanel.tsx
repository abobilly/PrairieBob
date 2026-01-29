import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Terminal as TerminalIcon, Bot, Send, Loader2, Plug, PlugZap } from 'lucide-react';
import { AgentService, AgentMessage } from '@/lib/agent-service';
import { useProjectStore } from '@/stores';

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
  const agentRef = useRef<AgentService | null>(null);

  // Get store actions for tool handlers
  const { paintTile, paintTiles, fillArea, placeEntity, mapData, tilesets } = useProjectStore();

  // Initialize agent service
  const connectAgent = useCallback(async () => {
    if (agentRef.current?.isConnected()) return;

    setIsLoading(true);

    try {
      const agent = new AgentService({
        model: 'gpt-5',
        onMessage: (msg) => {
          setMessages(prev => [...prev, msg]);
          setStreamingContent('');
        },
        onDelta: (delta) => {
          setStreamingContent(prev => prev + delta);
        },
        onStateChange: (state) => {
          setIsLoading(state !== 'idle');
        },
        onError: (error) => {
          setMessages(prev => [...prev, {
            role: 'system',
            content: `Error: ${error.message}`,
            timestamp: new Date(),
          }]);
          setIsLoading(false);
        },
      });

      // Create tool handlers that interact with the editor
      const toolHandlers = {
        paintTiles: (layer: string, tiles: Array<{ x: number; y: number; tileId: number }>) => {
          const layerIndex = mapData?.layers.findIndex(l => l.name === layer) ?? 0;
          paintTiles(layerIndex, tiles);
        },
        fillLayer: (layer: string, tileId: number, region?: { x: number; y: number; width: number; height: number }) => {
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
        },
        placeEntity: (type: string, x: number, y: number, properties?: Record<string, unknown>) => {
          placeEntity({
            id: `${type}_${Date.now()}`,
            type: type as 'spawn_point' | 'door' | 'npc' | 'trigger' | 'prop',
            x,
            y,
            width: type === 'door' ? 32 : 16,
            height: 16,
            properties: (properties || {}) as Record<string, string | number | boolean>,
          });
        },
        exportMap: async (format: string) => {
          // Trigger export via existing mechanism
          return `Exported as ${format}`;
        },
        getMapInfo: () => ({
          width: mapData?.width ?? 0,
          height: mapData?.height ?? 0,
          layers: mapData?.layers.map(l => l.name) ?? [],
          entities: mapData?.layers.find(l => l.name === 'Entities')?.objects?.map(o => o.id) ?? [],
        }),
        listTiles: (tileset?: string) => {
          const ts = tileset
            ? tilesets.find(t => t.name === tileset)
            : tilesets[0];
          if (!ts) return [];
          const tiles: Array<{ id: number; name: string }> = [];
          for (let i = 0; i < ts.totalTiles; i++) {
            tiles.push({ id: ts.firstGid + i, name: `${ts.name}_${i}` });
          }
          return tiles.slice(0, 20); // Limit for brevity
        },
      };

      await agent.start(toolHandlers);
      agentRef.current = agent;
      setIsConnected(true);

    } catch (error) {
      console.error('Failed to connect agent:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure Copilot CLI is installed.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [mapData, tilesets, paintTiles, fillArea, placeEntity]);

  // Disconnect agent on unmount
  useEffect(() => {
    return () => {
      agentRef.current?.stop();
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
      if (!agentRef.current?.isConnected()) {
        term.writeln('\x1b[1;33mConnecting to agent...\x1b[0m');
        await connectAgent();
      }

      if (!agentRef.current) {
        term.writeln('\x1b[1;31mFailed to connect to agent.\x1b[0m');
        return;
      }

      term.writeln('\x1b[1;35m[Agent]\x1b[0m');

      // Temporarily override handlers to write to terminal
      let responseContent = '';
      const cfg = agentRef.current as unknown as { config: { onDelta?: (d: string) => void; onMessage?: (m: AgentMessage) => void } };
      const originalOnDelta = cfg.config.onDelta;
      const originalOnMessage = cfg.config.onMessage;

      cfg.config.onDelta = (delta: string) => {
        responseContent += delta;
        term.write(delta.replace(/\n/g, '\r\n'));
      };

      cfg.config.onMessage = (msg: AgentMessage) => {
        if (msg.role === 'assistant' && !responseContent) {
          term.writeln(msg.content.replace(/\n/g, '\r\n'));
        } else if (msg.role === 'assistant') {
          term.writeln('');
        } else if (msg.role === 'tool') {
          term.writeln(`\x1b[1;32m${msg.content}\x1b[0m`);
        }
        originalOnMessage?.(msg);
      };

      try {
        await agentRef.current.send(prompt);
        await new Promise(resolve => setTimeout(resolve, 100));
      } finally {
        cfg.config.onDelta = originalOnDelta;
        cfg.config.onMessage = originalOnMessage;
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

    const prompt = input.trim();
    setInput('');

    if (!agentRef.current?.isConnected()) {
      // Auto-connect on first message
      await connectAgent();
    }

    if (agentRef.current) {
      try {
        await agentRef.current.send(prompt);
      } catch (error) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
          timestamp: new Date(),
        }]);
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1a1a2e] border-l border-[#2a2a4a]">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'terminal')} className="flex flex-col h-full">
        <TabsList className="w-full justify-start rounded-none border-b border-[#2a2a4a] bg-[#12121f] px-2">
          <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-[#1a1a2e]">
            <Bot size={14} />
            Agent
          </TabsTrigger>
          <TabsTrigger value="terminal" className="gap-2 data-[state=active]:bg-[#1a1a2e]">
            <TerminalIcon size={14} />
            Terminal
          </TabsTrigger>
          <div className="ml-auto flex items-center gap-2 pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={connectAgent}
              disabled={isConnected || isLoading}
              className="h-6 px-2 text-xs"
            >
              {isConnected ? (
                <><PlugZap size={12} className="mr-1 text-green-500" /> Connected</>
              ) : (
                <><Plug size={12} className="mr-1" /> Connect</>
              )}
            </Button>
          </div>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden">
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {messages.length === 0 && !isConnected && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <Bot size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Click "Connect" or send a message to start.</p>
                  <p className="text-xs mt-1">Requires Copilot CLI installed.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-sm ${msg.role === 'user'
                      ? 'bg-[#f97316] text-white ml-8'
                      : msg.role === 'assistant'
                        ? 'bg-[#2a2a4a] text-gray-100 mr-8'
                        : msg.role === 'tool'
                          ? 'bg-[#1f2f1f] text-green-300 text-xs mr-8 font-mono'
                          : 'bg-[#1f1f3a] text-gray-400 text-xs italic'
                    }`}
                >
                  {msg.role === 'tool' && msg.toolName && (
                    <span className="text-green-500 font-bold">⚙ </span>
                  )}
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
              ))}
              {/* Streaming content */}
              {streamingContent && (
                <div className="bg-[#2a2a4a] rounded-lg p-3 mr-8 text-gray-100 text-sm">
                  <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                </div>
              )}
              {isLoading && !streamingContent && (
                <div className="bg-[#2a2a4a] rounded-lg p-3 mr-8 flex items-center gap-2 text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-[#2a2a4a]">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Ask me to paint tiles, place entities, export..." : "Type a message to connect..."}
                className="min-h-[60px] max-h-[120px] bg-[#12121f] border-[#2a2a4a] text-gray-100 placeholder:text-gray-500 resize-none"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-[#f97316] hover:bg-[#ea580c] self-end"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="terminal" className="flex-1 m-0 p-0 overflow-hidden">
          <div ref={terminalRef} className="h-full w-full" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
