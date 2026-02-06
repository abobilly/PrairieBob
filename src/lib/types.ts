export interface ProjectConfig {
  linkedProjects: LinkedProject[]
  defaultProject: string
}

export interface LinkedProject {
  name: string
  rootPath: string
  contentPath: string
  specsPath: string
  tileSize: number
  paths: {
    tilesets: string
    tiledRooms: string
    characters: string
    roomEntries: string
  }
}

export interface Character {
  id: string
  name: string
}

export type Tool = 'brush' | 'fill' | 'rectangle' | 'line' | 'eraser' | 'select' | 'eyedropper' | 'pan'

export type EntityType = 'spawn_point' | 'door' | 'npc' | 'trigger' | 'prop' | 'stairs' | 'ladder' | 'portal'

export type LayerType = 'tilelayer' | 'objectgroup'

export interface Layer {
  name: string
  type: LayerType
  visible: boolean
  locked: boolean
  opacity?: number  // 0-1, defaults to 1 (from Tiled)
  data?: number[]
  objects?: EntityData[]
}

/**
 * Multi-tile stamp for painting patterns (stolen from Tiled)
 * Supports selecting NxM tile regions in the tileset panel
 */
export interface TileStamp {
  width: number           // Width in tiles
  height: number          // Height in tiles
  tiles: number[][]       // 2D array of global tile IDs [row][col]
  tilesetId: string | null  // Source tileset (for preview rendering)
}

export interface EntityData {
  id: string
  type: EntityType
  x: number
  y: number
  width: number
  height: number
  properties: Record<string, string | number | boolean>
}

export interface LevelData {
  id: string
  width: number
  height: number
  tileSize: number
  layers: Layer[]
  metadata: {
    editedAt: string
    exportedFrom: string
    version: string
  }
}

export interface Interaction {
  id: string
  type: 'door' | 'chest' | 'switch'
  states: {
    [stateName: string]: {
      tiles: number[][]
      collision: boolean
    }
  }
  defaultState: string
}

export interface EntityDefinitionState {
  tileId: number
  collision?: boolean
}

export interface EntityDefinitionAnimation {
  frames: number[]
  fps?: number
  loop?: boolean
}

export interface EntityDefinitionPreview {
  showInEditor?: boolean
  animateInPreview?: boolean
  previewAnimation?: string
  loop?: boolean
}

export interface EntityDefinitionBehavior {
  onLoad?: string
  onInteract?: string
  wander?: {
    enabled?: boolean
    speedTilesPerSecond?: number
    changeDirectionMs?: number
  }
}

export interface EntityDefinitionFile {
  id: string
  type?: EntityType | string
  displayName?: string
  tileset?: string
  tileSize?: number
  size?: {
    width: number
    height: number
  }
  defaultState?: string
  states?: Record<string, EntityDefinitionState>
  defaultAnimation?: string
  animations?: Record<string, EntityDefinitionAnimation>
  triggers?: {
    onLoad?: string
    onInteract?: string
  }
  behavior?: EntityDefinitionBehavior
  preview?: EntityDefinitionPreview
}

export interface InteractionDefinitionState {
  tiles: number[][]
  collision: boolean
}

export interface InteractionDefinitionFile {
  id: string
  type: string
  tileSize?: number
  size?: {
    width: number
    height: number
  }
  states: Record<string, InteractionDefinitionState>
  transitions?: Record<string, { duration: number }>
  defaultState: string
}

export interface EditorState {
  currentTool: Tool
  selectedTileId: number
  activeLayerIndex: number
  zoom: number
  panX: number
  panY: number
  gridVisible: boolean
  selectedEntityId: string | null
}

// ============== Tileset System ==============

/** Persistable tileset configuration (saved to spudtile.config.json) */
export interface TilesetConfig {
  id: string
  name: string
  sourcePath: string
  tileSize: number
  firstGid: number
}

/** Runtime tileset with loaded image data */
export interface LoadedTileset extends TilesetConfig {
  canvas: HTMLCanvasElement
  imageWidth: number
  imageHeight: number
  tilesPerRow: number
  totalTiles: number
  status: 'loading' | 'ready' | 'error'
  error?: string
}

/** Debug tileset marker (procedurally generated, not from file) */
export const DEBUG_TILESET_ID = '__debug__'

/**
 * Tile selection for clipboard operations (copy/paste)
 * Stores a rectangular region of tiles with position info
 */
export interface TileSelection {
  x: number           // Top-left tile X
  y: number           // Top-left tile Y
  width: number       // Width in tiles
  height: number      // Height in tiles
  tiles: number[][]   // 2D array of tile IDs [row][col]
  layerIndex: number  // Source layer
}

// ============== Layer Grouping ==============

export interface LayerGroup {
  id: string
  name: string
  type: 'static' | 'dynamic' | 'meta'
  layerIds: string[]
  collapsed: boolean
  visible: boolean
  locked: boolean
  color?: string
}

export const META_GROUP_PATTERNS = {
  visual: { pattern: /^(floor|wall|trim|overlay|decor)/i, color: '#4CAF50', name: 'Visual' },
  collision: { pattern: /^(collision|solid|block)/i, color: '#F44336', name: 'Collision' },
  entities: { pattern: /^(entities|objects|triggers|spawns)/i, color: '#2196F3', name: 'Entities' },
} as const

// ============== Tile Actions / State Machine ==============

export interface TileState {
  name: string
  tileId: number
  duration?: number
  nextState?: string
}

export type TriggerType =
  | 'on_interact'
  | 'on_step'
  | 'on_adjacent'
  | 'on_timer'
  | 'on_signal'
  | 'on_state_enter'
  | 'on_state_exit'

export interface TileTrigger {
  type: TriggerType
  targetAction?: string
  targetTilePos?: { x: number; y: number }
  parameters?: Record<string, unknown>
}

export type EffectType =
  | 'change_state'
  | 'emit_signal'
  | 'play_sound'
  | 'spawn_entity'
  | 'teleport'
  | 'damage'
  | 'dialog'
  | 'custom'

export interface TileEffect {
  type: EffectType
  parameters: Record<string, unknown>
}

export interface TileActionGroup {
  id: string
  name: string
  states: TileState[]
  defaultState: string
  triggers: TileTrigger[]
  effects: TileEffect[]
}

// ============== Baked Tileset ==============

export interface CollisionShape {
  type: 'rect' | 'polygon'
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface BakedTileset {
  format: 'spudtile-tileset'
  version: 1
  name: string
  tileWidth: number
  tileHeight: number
  columns: number
  tileCount: number
  spacing: number
  margin: number
  imageDataUrl: string
  tiles: {
    [tileId: number]: {
      properties?: Record<string, unknown>
      animation?: { frames: { tileId: number; duration: number }[] }
      collision?: { shapes: CollisionShape[] }
      actionGroup?: TileActionGroup
    }
  }
  tags: string[]
  author?: string
  license?: string
  description?: string
  createdAt: string
  sourceProject?: string
}

// ============== Game Preview ==============

export interface PreviewViewport {
  width: number
  height: number
  zoom: number
  x: number
  y: number
}
