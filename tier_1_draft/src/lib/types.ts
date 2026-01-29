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

export type Tool = 'brush' | 'fill' | 'rectangle' | 'eraser' | 'select' | 'eyedropper'

export type EntityType = 'spawn_point' | 'door' | 'npc' | 'trigger' | 'prop'

export type LayerType = 'tilelayer' | 'objectgroup'

export interface Layer {
  name: string
  type: LayerType
  visible: boolean
  locked: boolean
  data?: number[]
  objects?: EntityData[]
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
