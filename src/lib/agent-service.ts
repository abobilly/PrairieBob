/**
 * Copilot Agent Service
 * 
 * Manages the Copilot SDK client and sessions for the PrairieBob editor.
 * Runs in the Electron main process and communicates with renderer via IPC.
 */

import { CopilotClient, CopilotSession, defineTool, SessionEvent } from '@github/copilot-sdk';
import { z } from 'zod';
import type { LDtkProject } from './ldtk/project';
import type { EntityDef, LayerDef } from './ldtk/types';
import type { EntityInstance, LayerInstance } from './ldtk/layer-instance';
import type { Level } from './ldtk/level';

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

export interface LDtkEntityFieldSuggestion {
  identifier: string;
  type: string;
  isArray?: boolean;
  canBeNull?: boolean;
  doc?: string;
}

export interface LDtkEntitySuggestion {
  identifier: string;
  width?: number;
  height?: number;
  tags?: string[];
  fields?: LDtkEntityFieldSuggestion[];
  notes?: string;
}

export interface LDtkAutoLayerRuleSuggestion {
  layerIdentifier: string;
  groupName?: string;
  ruleName: string;
  description: string;
  tileIds?: number[];
  notes?: string;
}

export interface LDtkAgentHandlers {
  getProject?: () => LDtkProject | null;
  project?: LDtkProject | null;
  getActiveLevelIid?: () => string | null;
  suggestEntityDef?: (suggestion: LDtkEntitySuggestion) => void | Promise<void>;
  suggestAutoLayerRule?: (suggestion: LDtkAutoLayerRuleSuggestion) => void | Promise<void>;
}

export interface PrairieBobToolHandlers {
  paintTiles: (layer: string, tiles: Array<{ x: number; y: number; tileId: number }>) => void;
  fillLayer: (layer: string, tileId: number, region?: { x: number; y: number; width: number; height: number }) => void;
  placeEntity: (type: string, x: number, y: number, properties?: Record<string, unknown>) => void;
  exportMap: (format: string) => Promise<string>;
  getMapInfo: () => { width: number; height: number; layers: string[]; entities: string[] };
  listTiles: (tileset?: string) => Array<{ id: number; name: string }>;
  ldtk?: LDtkAgentHandlers;
}

const LAYER_TYPE_SCHEMA = z.enum(['IntGrid', 'Entities', 'Tiles', 'AutoLayer']);

const ldtkEntityFieldSchema = z.object({
  identifier: z.string().describe('Field identifier'),
  type: z.string().describe('LDtk field type (Int, Float, Bool, String, Text, Color, Point, Enum, FilePath, Tile, EntityRef, Array)'),
  isArray: z.boolean().optional().describe('Whether the field is an array'),
  canBeNull: z.boolean().optional().describe('Whether the field can be null'),
  doc: z.string().optional().describe('Optional field documentation'),
});

const ldtkEntitySuggestionSchema = z.object({
  identifier: z.string().describe('Entity identifier'),
  width: z.number().optional().describe('Entity width in pixels'),
  height: z.number().optional().describe('Entity height in pixels'),
  tags: z.array(z.string()).optional().describe('Tags for the entity'),
  fields: z.array(ldtkEntityFieldSchema).optional().describe('Custom fields'),
  notes: z.string().optional().describe('Additional design notes'),
});

const ldtkRuleSuggestionSchema = z.object({
  layerIdentifier: z.string().describe('Layer identifier the rule applies to'),
  groupName: z.string().optional().describe('Auto-layer rule group name'),
  ruleName: z.string().describe('Rule identifier or label'),
  description: z.string().describe('Rule intent'),
  tileIds: z.array(z.number()).optional().describe('Candidate tile IDs'),
  notes: z.string().optional().describe('Additional notes'),
});

function getLDtkProject(ldtk?: LDtkAgentHandlers): LDtkProject | null {
  return ldtk?.getProject?.() ?? ldtk?.project ?? null;
}

function summarizeLayerDefs(layers: LayerDef[]) {
  return layers.map((layer) => ({
    uid: layer.uid,
    identifier: layer.identifier,
    type: layer.type,
    gridSize: layer.gridSize,
    tilesetDefUid: layer.tilesetDefUid,
    autoRuleGroupCount: layer.autoRuleGroups.length,
    intGridValueCount: layer.intGridValues.length,
  }));
}

function summarizeEntityDefs(entities: EntityDef[]) {
  return entities.map((entity) => ({
    uid: entity.uid,
    identifier: entity.identifier,
    size: { width: entity.width, height: entity.height },
    tags: entity.tags,
    fieldCount: entity.fieldDefs.length,
  }));
}

function summarizeLayerInstance(layer: LayerInstance) {
  return {
    iid: layer.iid,
    layerDefUid: layer.layerDefUid,
    identifier: layer.__identifier,
    type: layer.__type,
    gridSize: layer.__gridSize,
    tilesetDefUid: layer.__tilesetDefUid,
    entityCount: layer.entityInstances.length,
    tileCount: layer.gridTiles.length + layer.autoLayerTiles.length,
    intGridValueCount: layer.intGridCsv.length,
    visible: layer.visible,
  };
}

function summarizeEntityInstance(entity: EntityInstance) {
  return {
    iid: entity.iid,
    identifier: entity.__identifier,
    defUid: entity.defUid,
    position: { x: entity.px[0], y: entity.px[1] },
    size: { width: entity.width, height: entity.height },
    tags: entity.__tags,
  };
}

function summarizeProject(project: LDtkProject) {
  const worlds = project.worlds.map((world) => ({
    identifier: world.identifier,
    iid: world.iid,
    worldLayout: world.worldLayout,
    levelCount: world.levels.length,
  }));

  const levels = project.worlds.flatMap((world) =>
    world.levels.map((level) => ({
      world: world.identifier,
      uid: level.uid,
      iid: level.iid,
      identifier: level.identifier,
      size: { width: level.pxWid, height: level.pxHei },
      worldX: level.worldX,
      worldY: level.worldY,
      worldDepth: level.worldDepth,
      layerCount: level.layerInstances.length,
    }))
  );

  return {
    filePath: project.filePath,
    jsonVersion: project.jsonVersion,
    worlds,
    levels,
    layerDefs: summarizeLayerDefs(project.defs.layers),
    entityDefs: summarizeEntityDefs(project.defs.entities),
    tilesetCount: project.defs.tilesets.length,
    enumCount: project.defs.enums.length + project.defs.externalEnums.length,
  };
}

function buildLDtkContext(ldtk?: LDtkAgentHandlers): string {
  const project = getLDtkProject(ldtk);
  const summary = project ? JSON.stringify(summarizeProject(project), null, 2) : 'No LDtk project loaded.';

  return `
<ldtk_context>
LDtk project structure:
- Project contains defs (layers, entities, tilesets, enums) and worlds.
- Worlds contain levels. Levels contain layerInstances; entity layers contain entityInstances.
- Use LDtk tools to query levels, layers, entities, and to suggest new definitions.

Current LDtk project summary:
${summary}

LDtk tools:
- ldtk_project_summary
- ldtk_list_levels
- ldtk_list_layer_defs
- ldtk_list_entity_defs
- ldtk_list_level_layers
- ldtk_list_level_entities
- ldtk_suggest_entity_def
- ldtk_suggest_autolayer_rule
</ldtk_context>
`;
}

// PrairieBob-specific tools the agent can use
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createPrairieBobTools = (handlers: PrairieBobToolHandlers): ReturnType<typeof defineTool<any>>[] => {
  const tools: ReturnType<typeof defineTool<any>>[] = [
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
        properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe('Entity properties (e.g., targetRoom for doors)'),
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

  const ldtkHandlers = handlers.ldtk;
  const getProject = () => getLDtkProject(ldtkHandlers);
  const missingProjectResult = { success: false, error: 'No LDtk project available.' };

  const resolveWorlds = (project: LDtkProject, worldIdentifier?: string) => {
    if (!worldIdentifier) {
      return project.worlds;
    }
    const match = project.worlds.find((world) => world.identifier === worldIdentifier);
    return match ? [match] : [];
  };

  const findLevel = (
    project: LDtkProject,
    options: { levelIid?: string; levelIdentifier?: string; world?: string }
  ): { world: string; level: Level } | null => {
    const worlds = resolveWorlds(project, options.world);
    if (worlds.length === 0) {
      return null;
    }

    const preferredIid = options.levelIid ?? ldtkHandlers?.getActiveLevelIid?.();
    if (preferredIid) {
      for (const world of worlds) {
        const match = world.levels.find((level) => level.iid === preferredIid);
        if (match) {
          return { world: world.identifier, level: match };
        }
      }
    }

    if (options.levelIdentifier) {
      for (const world of worlds) {
        const match = world.levels.find((level) => level.identifier === options.levelIdentifier);
        if (match) {
          return { world: world.identifier, level: match };
        }
      }
    }

    const allLevels = worlds.flatMap((world) =>
      world.levels.map((level) => ({ world: world.identifier, level }))
    );
    if (allLevels.length === 1) {
      return allLevels[0];
    }

    return null;
  };

  tools.push(
    defineTool('ldtk_project_summary', {
      description: 'Get a summary of the current LDtk project structure.',
      parameters: z.object({}),
      handler: async () => {
        const project = getProject();
        if (!project) {
          return missingProjectResult;
        }
        return { success: true, summary: summarizeProject(project) };
      },
    }),

    defineTool('ldtk_list_levels', {
      description: 'List LDtk levels across worlds. Optionally filter by world identifier.',
      parameters: z.object({
        world: z.string().optional().describe('World identifier to filter'),
      }),
      handler: async ({ world }) => {
        const project = getProject();
        if (!project) {
          return missingProjectResult;
        }

        const worlds = resolveWorlds(project, world);
        if (world && worlds.length === 0) {
          return { success: false, error: `World "${world}" not found.` };
        }

        const levels = worlds.flatMap((entry) =>
          entry.levels.map((level) => ({
            world: entry.identifier,
            uid: level.uid,
            iid: level.iid,
            identifier: level.identifier,
            size: { width: level.pxWid, height: level.pxHei },
            worldX: level.worldX,
            worldY: level.worldY,
            worldDepth: level.worldDepth,
            layerCount: level.layerInstances.length,
          }))
        );

        return { success: true, levels };
      },
    }),

    defineTool('ldtk_list_layer_defs', {
      description: 'List LDtk layer definitions, optionally filtered by layer type.',
      parameters: z.object({
        type: LAYER_TYPE_SCHEMA.optional().describe('Layer type filter'),
      }),
      handler: async ({ type }) => {
        const project = getProject();
        if (!project) {
          return missingProjectResult;
        }
        const layers = type
          ? project.defs.layers.filter((layer) => layer.type === type)
          : project.defs.layers;
        return { success: true, layers: summarizeLayerDefs(layers) };
      },
    }),

    defineTool('ldtk_list_entity_defs', {
      description: 'List LDtk entity definitions, optionally filtered by tag.',
      parameters: z.object({
        tag: z.string().optional().describe('Filter by entity tag'),
      }),
      handler: async ({ tag }) => {
        const project = getProject();
        if (!project) {
          return missingProjectResult;
        }

        const entities = tag
          ? project.defs.entities.filter((entity) => entity.tags.includes(tag))
          : project.defs.entities;
        return { success: true, entities: summarizeEntityDefs(entities) };
      },
    }),

    defineTool('ldtk_list_level_layers', {
      description: 'List layer instances for a specific LDtk level.',
      parameters: z.object({
        levelIid: z.string().optional().describe('Level IID'),
        levelIdentifier: z.string().optional().describe('Level identifier'),
        world: z.string().optional().describe('World identifier'),
      }),
      handler: async ({ levelIid, levelIdentifier, world }) => {
        const project = getProject();
        if (!project) {
          return missingProjectResult;
        }

        if (world && resolveWorlds(project, world).length === 0) {
          return { success: false, error: `World "${world}" not found.` };
        }

        const match = findLevel(project, { levelIid, levelIdentifier, world });
        if (!match) {
          return {
            success: false,
            error: 'Level not found. Provide levelIid or levelIdentifier, or ensure an active level is set.',
          };
        }

        const layers = match.level.layerInstances.map((layer) => summarizeLayerInstance(layer));
        return { success: true, level: { world: match.world, iid: match.level.iid, identifier: match.level.identifier }, layers };
      },
    }),

    defineTool('ldtk_list_level_entities', {
      description: 'List entity instances for a specific LDtk level, optionally filtered by layer or entity identifier.',
      parameters: z.object({
        levelIid: z.string().optional().describe('Level IID'),
        levelIdentifier: z.string().optional().describe('Level identifier'),
        world: z.string().optional().describe('World identifier'),
        layerIdentifier: z.string().optional().describe('Layer identifier to filter'),
        entityIdentifier: z.string().optional().describe('Entity identifier to filter'),
      }),
      handler: async ({ levelIid, levelIdentifier, world, layerIdentifier, entityIdentifier }) => {
        const project = getProject();
        if (!project) {
          return missingProjectResult;
        }

        if (world && resolveWorlds(project, world).length === 0) {
          return { success: false, error: `World "${world}" not found.` };
        }

        const match = findLevel(project, { levelIid, levelIdentifier, world });
        if (!match) {
          return {
            success: false,
            error: 'Level not found. Provide levelIid or levelIdentifier, or ensure an active level is set.',
          };
        }

        const layers = layerIdentifier
          ? match.level.layerInstances.filter((layer) => layer.__identifier === layerIdentifier)
          : match.level.layerInstances;

        if (layerIdentifier && layers.length === 0) {
          return { success: false, error: `Layer "${layerIdentifier}" not found in level.` };
        }

        const entities = layers.flatMap((layer) =>
          layer.entityInstances
            .filter((entity) => !entityIdentifier || entity.__identifier === entityIdentifier)
            .map((entity) => ({
              layerIdentifier: layer.__identifier,
              ...summarizeEntityInstance(entity),
            }))
        );

        return {
          success: true,
          level: { world: match.world, iid: match.level.iid, identifier: match.level.identifier },
          entities,
        };
      },
    }),

    defineTool('ldtk_suggest_entity_def', {
      description: 'Suggest a new LDtk entity definition to add to the project.',
      parameters: ldtkEntitySuggestionSchema,
      handler: async (suggestion) => {
        if (ldtkHandlers?.suggestEntityDef) {
          await ldtkHandlers.suggestEntityDef(suggestion);
        }
        return { success: true, recorded: Boolean(ldtkHandlers?.suggestEntityDef), suggestion };
      },
    }),

    defineTool('ldtk_suggest_autolayer_rule', {
      description: 'Suggest a new LDtk auto-layer rule to add to a layer definition.',
      parameters: ldtkRuleSuggestionSchema,
      handler: async (suggestion) => {
        if (ldtkHandlers?.suggestAutoLayerRule) {
          await ldtkHandlers.suggestAutoLayerRule(suggestion);
        }
        return { success: true, recorded: Boolean(ldtkHandlers?.suggestAutoLayerRule), suggestion };
      },
    })
  );

  return tools;
};

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

  async start(toolHandlers?: PrairieBobToolHandlers): Promise<void> {
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
    const ldtkContext = buildLDtkContext(toolHandlers?.ldtk);

    this.session = await this.client.createSession({
      model: this.config.model,
      streaming: true,
      tools,
      systemMessage: {
        content: `
<prairiebob_context>
You are the PrairieBob AI assistant, embedded in a tile map editor for 2D game development.
You help users edit maps, place tiles, manage entities, and export their work.

Available layers (legacy defaults): Floor, Walls, Trim, Overlays, Collision, Entities
Entity types (legacy defaults): spawn_point, door, npc, trigger, prop

When users ask to paint or fill tiles, use the appropriate tools.
When users describe what they want visually, translate that into tile operations.
Be concise and action-oriented. Execute commands rather than just explaining how.
</prairiebob_context>
${ldtkContext}
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
          this.config.onToolCall?.(event.data.toolName, event.data.arguments as Record<string, unknown>);
          this.config.onMessage?.({
            role: 'tool',
            content: `Executing: ${event.data.toolName}`,
            timestamp: new Date(),
            toolName: event.data.toolName,
          });
          break;

        case 'session.idle':
          this.config.onStateChange?.('idle');
          break;

        case 'session.error':
          this.config.onError?.(new Error(String((event.data as { message?: string }).message || 'Unknown error')));
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
