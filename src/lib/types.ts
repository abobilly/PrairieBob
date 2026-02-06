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
