/**
 * Copilot Agent Service
 * 
 * Manages the Copilot SDK client and sessions for the PrairieBob editor.
 * Runs in the Electron main process and communicates with renderer via IPC.
 */

import { CopilotClient, CopilotSession, defineTool, SessionEvent } from '@github/copilot-sdk';
import { z } from 'zod';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
}

export interface AgentServiceConfig {
  model?: string;
  onMessage?: (message: AgentMessage) => void;
  onDelta?: (delta: string) => void;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: 'idle' | 'thinking' | 'executing') => void;
}

// PrairieBob-specific tools the agent can use
const createPrairieBobTools = (handlers: {
  paintTiles: (layer: string, tiles: Array<{ x: number; y: number; tileId: number }>) => void;
  fillLayer: (layer: string, tileId: number, region?: { x: number; y: number; width: number; height: number }) => void;
  placeEntity: (type: string, x: number, y: number, properties?: Record<string, unknown>) => void;
  exportMap: (format: string) => Promise<string>;
  getMapInfo: () => { width: number; height: number; layers: string[]; entities: string[] };
  listTiles: (tileset?: string) => Array<{ id: number; name: string }>;
}) => [
  defineTool('paint_tiles', {
    description: 'Paint tiles on a specific layer of the map. Use this to place individual tiles or patterns.',
    parameters: z.object({
      layer: z.string().describe('Layer name (e.g., "Floor", "Walls", "Trim")'),
      tiles: z.array(z.object({
        x: z.number().describe('X coordinate in tiles'),
        y: z.number().describe('Y coordinate in tiles'),
        tileId: z.number().describe('Tile ID to paint'),
      })).describe('Array of tiles to paint'),
    }),
    handler: async ({ layer, tiles }) => {
      handlers.paintTiles(layer, tiles);
      return { success: true, painted: tiles.length };
    },
  }),

  defineTool('fill_layer', {
    description: 'Fill an entire layer or region with a specific tile. Great for floors or backgrounds.',
    parameters: z.object({
      layer: z.string().describe('Layer name to fill'),
      tileId: z.number().describe('Tile ID to fill with'),
      region: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }).optional().describe('Optional region to fill. If not provided, fills entire layer.'),
    }),
    handler: async ({ layer, tileId, region }) => {
      handlers.fillLayer(layer, tileId, region);
      return { success: true, layer, tileId, region: region || 'entire layer' };
    },
  }),

  defineTool('place_entity', {
    description: 'Place an entity (spawn point, door, NPC, trigger, prop) on the map.',
    parameters: z.object({
      type: z.enum(['spawn_point', 'door', 'npc', 'trigger', 'prop']).describe('Entity type'),
      x: z.number().describe('X position in pixels'),
      y: z.number().describe('Y position in pixels'),
      properties: z.record(z.unknown()).optional().describe('Entity properties (e.g., targetRoom for doors)'),
    }),
    handler: async ({ type, x, y, properties }) => {
      handlers.placeEntity(type, x, y, properties);
      return { success: true, type, position: { x, y } };
    },
  }),

  defineTool('export_map', {
    description: 'Export the current map to a file format.',
    parameters: z.object({
      format: z.enum(['kimbar', 'tiled', 'json']).describe('Export format'),
    }),
    handler: async ({ format }) => {
      const path = await handlers.exportMap(format);
      return { success: true, format, path };
    },
  }),

  defineTool('get_map_info', {
    description: 'Get information about the current map including dimensions, layers, and entities.',
    parameters: z.object({}),
    handler: async () => {
      return handlers.getMapInfo();
    },
  }),

  defineTool('list_tiles', {
    description: 'List available tiles from the loaded tilesets.',
    parameters: z.object({
      tileset: z.string().optional().describe('Filter by tileset name'),
    }),
    handler: async ({ tileset }) => {
      return handlers.listTiles(tileset);
    },
  }),
];

export class AgentService {
  private client: CopilotClient | null = null;
  private session: CopilotSession | null = null;
  private config: AgentServiceConfig;
  private unsubscribe: (() => void) | null = null;

  constructor(config: AgentServiceConfig = {}) {
    this.config = {
      model: 'gpt-5',
      ...config,
    };
  }

  async start(toolHandlers?: Parameters<typeof createPrairieBobTools>[0]): Promise<void> {
    if (this.client) {
      console.warn('AgentService already started');
      return;
    }

    this.client = new CopilotClient({
      autoStart: true,
      autoRestart: true,
    });

    await this.client.start();

    const tools = toolHandlers ? createPrairieBobTools(toolHandlers) : [];

    this.session = await this.client.createSession({
      model: this.config.model,
      streaming: true,
      tools,
      systemMessage: {
        content: `
<prairiebob_context>
You are the PrairieBob AI assistant, embedded in a tile map editor for 2D game development.
You help users edit maps, place tiles, manage entities, and export their work.

Available layers: Floor, Walls, Trim, Overlays, Collision, Entities
Entity types: spawn_point, door, npc, trigger, prop

When users ask to paint or fill tiles, use the appropriate tools.
When users describe what they want visually, translate that into tile operations.
Be concise and action-oriented. Execute commands rather than just explaining how.
</prairiebob_context>
`,
      },
    });

    this.setupEventHandlers();

    this.config.onMessage?.({
      role: 'system',
      content: 'PrairieBob Agent connected. I can help you edit maps, paint tiles, place entities, and more.',
      timestamp: new Date(),
    });
  }

  private setupEventHandlers(): void {
    if (!this.session) return;

    this.unsubscribe = this.session.on((event: SessionEvent) => {
      switch (event.type) {
        case 'assistant.message_delta':
          this.config.onDelta?.(event.data.deltaContent);
          break;

        case 'assistant.message':
          this.config.onStateChange?.('idle');
          this.config.onMessage?.({
            role: 'assistant',
            content: event.data.content,
            timestamp: new Date(),
          });
          break;

        case 'tool.execution_start':
          this.config.onStateChange?.('executing');
          this.config.onToolCall?.(event.data.toolName, event.data.arguments);
          this.config.onMessage?.({
            role: 'tool',
            content: `Executing: ${event.data.toolName}`,
            timestamp: new Date(),
            toolName: event.data.toolName,
          });
          break;

        case 'tool.execution_end':
          this.config.onMessage?.({
            role: 'tool',
            content: `✓ ${event.data.toolName} completed`,
            timestamp: new Date(),
            toolName: event.data.toolName,
          });
          break;

        case 'session.idle':
          this.config.onStateChange?.('idle');
          break;

        case 'error':
          this.config.onError?.(new Error(event.data.message));
          break;
      }
    });
  }

  async send(prompt: string): Promise<void> {
    if (!this.session) {
      throw new Error('AgentService not started. Call start() first.');
    }

    this.config.onStateChange?.('thinking');
    this.config.onMessage?.({
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    });

    await this.session.send({ prompt });
  }

  async sendAndWait(prompt: string, timeout?: number): Promise<string | undefined> {
    if (!this.session) {
      throw new Error('AgentService not started. Call start() first.');
    }

    this.config.onStateChange?.('thinking');
    this.config.onMessage?.({
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    });

    const result = await this.session.sendAndWait({ prompt }, timeout);
    return result?.data.content;
  }

  async abort(): Promise<void> {
    await this.session?.abort();
    this.config.onStateChange?.('idle');
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    await this.session?.destroy();
    await this.client?.stop();
    this.session = null;
    this.client = null;
  }

  isConnected(): boolean {
    return this.client?.getState() === 'connected';
  }
}

// Singleton instance for the app
let agentServiceInstance: AgentService | null = null;

export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService();
  }
  return agentServiceInstance;
}

export function resetAgentService(): void {
  agentServiceInstance?.stop();
  agentServiceInstance = null;
}
