/**
 * Project Store - Zustand store for project/map data
 * Manages: layers, tilesets, map data, entities, undo/redo history
 * 
 * Uses Immer for immutable updates and built-in undo/redo (Tiled-style)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  LevelData,
  Layer,
  EntityData,
  LoadedTileset,
  TilesetConfig,
  DEBUG_TILESET_ID,
} from '@/lib/types'
import {
  createDebugTileset,
  loadTilesetFromPath,
  getNextFirstGid,
  tilesetToConfig,
} from '@/lib/tileset'
import { toast } from 'sonner'

// Config file path
const CONFIG_PATH = 'c:/Users/andre/lawchuck/artbob/PrairieBob/prairiebob.config.json'

const MAX_HISTORY = 100

interface HistoryEntry {
  mapData: LevelData
  description: string
}

const DEFAULT_MAP: LevelData = {
  id: 'test_room',
  width: 30,
  height: 20,
  tileSize: 32,
  layers: [
    { name: 'Floor', type: 'tilelayer', visible: true, locked: false, opacity: 1, data: new Array(30 * 20).fill(0) },
    { name: 'Walls', type: 'tilelayer', visible: true, locked: false, opacity: 1, data: new Array(30 * 20).fill(0) },
    { name: 'Trim', type: 'tilelayer', visible: true, locked: false, opacity: 1, data: new Array(30 * 20).fill(0) },
    { name: 'Overlays', type: 'tilelayer', visible: true, locked: false, opacity: 1, data: new Array(30 * 20).fill(0) },
    { name: 'Collision', type: 'tilelayer', visible: true, locked: false, opacity: 1, data: new Array(30 * 20).fill(0) },
    { name: 'Entities', type: 'objectgroup', visible: true, locked: false, opacity: 1, objects: [] },
  ],
  metadata: {
    editedAt: new Date().toISOString(),
    exportedFrom: 'prairiebob',
    version: '1.0.0',
  },
}

interface ProjectState {
  // Map data
  mapData: LevelData
  currentRoomPath: string | null
  hasUnsavedChanges: boolean

  // History (undo/redo)
  past: HistoryEntry[]
  future: HistoryEntry[]

  // Tilesets
  tilesets: LoadedTileset[]
  isLoadingTileset: boolean

  // Computed
  canUndo: boolean
  canRedo: boolean
}

interface ProjectActions {
  // Map operations
  setMapData: (data: LevelData, recordHistory?: boolean, description?: string) => void
  setCurrentRoomPath: (path: string | null) => void
  setHasUnsavedChanges: (value: boolean) => void

  // History
  undo: () => void
  redo: () => void
  clearHistory: () => void

  // Tile painting
  paintTile: (layerIndex: number, x: number, y: number, tileId: number) => void
  paintTiles: (layerIndex: number, tiles: Array<{ x: number; y: number; tileId: number }>) => void
  eraseTile: (layerIndex: number, x: number, y: number) => void
  fillArea: (layerIndex: number, startX: number, startY: number, tileId: number) => void

  // Layer operations
  toggleLayerVisible: (index: number) => void
  toggleLayerLocked: (index: number) => void
  setLayerOpacity: (index: number, opacity: number) => void
  reorderLayers: (fromIndex: number, toIndex: number) => void
  addLayer: (name: string, type: 'tilelayer' | 'objectgroup') => void
  deleteLayer: (index: number) => void
  renameLayer: (index: number, name: string) => void

  // Entity operations
  placeEntity: (entity: EntityData) => void
  updateEntity: (id: string, updates: Partial<EntityData>) => void
  moveEntity: (id: string, x: number, y: number) => void
  deleteEntity: (id: string) => void

  // Tileset operations
  initTilesets: () => Promise<void>
  addTileset: (config: { name: string; sourcePath: string; tileSize: number }) => Promise<void>
  removeTileset: (id: string) => Promise<void>
  saveTilesetsToConfig: () => Promise<void>
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      mapData: DEFAULT_MAP,
      currentRoomPath: null,
      hasUnsavedChanges: false,
      past: [],
      future: [],
      tilesets: [],
      isLoadingTileset: false,
      canUndo: false,
      canRedo: false,

      // Map operations
      setMapData: (data, recordHistory = true, description = 'Edit') => {
        set((state) => {
          if (recordHistory) {
            // Push current state to past
            state.past.push({ mapData: state.mapData, description })
            if (state.past.length > MAX_HISTORY) {
              state.past.shift()
            }
            // Clear future on new edit
            state.future = []
          }
          state.mapData = data
          state.hasUnsavedChanges = true
          state.canUndo = state.past.length > 0
          state.canRedo = state.future.length > 0
        })
      },

      setCurrentRoomPath: (path) => set({ currentRoomPath: path }),
      setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),

      // History
      undo: () => {
        set((state) => {
          if (state.past.length === 0) return

          const entry = state.past.pop()!
          state.future.unshift({ mapData: state.mapData, description: 'Undo' })
          state.mapData = entry.mapData
          state.canUndo = state.past.length > 0
          state.canRedo = state.future.length > 0
        })
      },

      redo: () => {
        set((state) => {
          if (state.future.length === 0) return

          const entry = state.future.shift()!
          state.past.push({ mapData: state.mapData, description: 'Redo' })
          state.mapData = entry.mapData
          state.canUndo = state.past.length > 0
          state.canRedo = state.future.length > 0
        })
      },

      clearHistory: () => set({ past: [], future: [], canUndo: false, canRedo: false }),

      // Tile painting
      paintTile: (layerIndex, x, y, tileId) => {
        set((state) => {
          const layer = state.mapData.layers[layerIndex]
          if (layer?.type === 'tilelayer' && layer.data) {
            const index = y * state.mapData.width + x
            if (index >= 0 && index < layer.data.length) {
              // Record history
              state.past.push({ mapData: JSON.parse(JSON.stringify(state.mapData)), description: 'Paint' })
              if (state.past.length > MAX_HISTORY) state.past.shift()
              state.future = []

              layer.data[index] = tileId
              state.hasUnsavedChanges = true
              state.canUndo = true
              state.canRedo = false
            }
          }
        })
      },

      paintTiles: (layerIndex, tiles) => {
        set((state) => {
          const layer = state.mapData.layers[layerIndex]
          if (layer?.type === 'tilelayer' && layer.data) {
            // Record history once for batch
            state.past.push({ mapData: JSON.parse(JSON.stringify(state.mapData)), description: 'Paint batch' })
            if (state.past.length > MAX_HISTORY) state.past.shift()
            state.future = []

            for (const { x, y, tileId } of tiles) {
              const index = y * state.mapData.width + x
              if (index >= 0 && index < layer.data.length) {
                layer.data[index] = tileId
              }
            }
            state.hasUnsavedChanges = true
            state.canUndo = true
            state.canRedo = false
          }
        })
      },

      eraseTile: (layerIndex, x, y) => {
        get().paintTile(layerIndex, x, y, 0)
      },

      fillArea: (layerIndex, startX, startY, tileId) => {
        set((state) => {
          const layer = state.mapData.layers[layerIndex]
          if (layer?.type !== 'tilelayer' || !layer.data) return

          const { width, height } = state.mapData
          const startIndex = startY * width + startX
          const targetTileId = layer.data[startIndex]

          if (targetTileId === tileId) return // Already filled

          // Record history
          state.past.push({ mapData: JSON.parse(JSON.stringify(state.mapData)), description: 'Fill' })
          if (state.past.length > MAX_HISTORY) state.past.shift()
          state.future = []

          // Flood fill algorithm
          const visited = new Set<number>()
          const stack = [{ x: startX, y: startY }]

          while (stack.length > 0) {
            const { x, y } = stack.pop()!
            const index = y * width + x

            if (x < 0 || x >= width || y < 0 || y >= height) continue
            if (visited.has(index)) continue
            if (layer.data![index] !== targetTileId) continue

            visited.add(index)
            layer.data![index] = tileId

            stack.push({ x: x + 1, y })
            stack.push({ x: x - 1, y })
            stack.push({ x, y: y + 1 })
            stack.push({ x, y: y - 1 })
          }

          state.hasUnsavedChanges = true
          state.canUndo = true
          state.canRedo = false
        })
      },

      // Layer operations
      toggleLayerVisible: (index) => {
        set((state) => {
          if (state.mapData.layers[index]) {
            state.mapData.layers[index].visible = !state.mapData.layers[index].visible
          }
        })
      },

      toggleLayerLocked: (index) => {
        set((state) => {
          if (state.mapData.layers[index]) {
            state.mapData.layers[index].locked = !state.mapData.layers[index].locked
          }
        })
      },

      setLayerOpacity: (index, opacity) => {
        set((state) => {
          if (state.mapData.layers[index]) {
            state.mapData.layers[index].opacity = Math.max(0, Math.min(1, opacity))
          }
        })
      },

      reorderLayers: (fromIndex, toIndex) => {
        set((state) => {
          const layers = state.mapData.layers
          const [removed] = layers.splice(fromIndex, 1)
          layers.splice(toIndex, 0, removed)
        })
      },

      addLayer: (name, type) => {
        set((state) => {
          const { width, height } = state.mapData
          const newLayer: Layer = {
            name,
            type,
            visible: true,
            locked: false,
            opacity: 1,
            ...(type === 'tilelayer'
              ? { data: new Array(width * height).fill(0) }
              : { objects: [] }
            ),
          }
          state.mapData.layers.push(newLayer)
          state.hasUnsavedChanges = true
        })
      },

      deleteLayer: (index) => {
        set((state) => {
          if (state.mapData.layers.length > 1) {
            state.mapData.layers.splice(index, 1)
            state.hasUnsavedChanges = true
          }
        })
      },

      renameLayer: (index, name) => {
        set((state) => {
          if (state.mapData.layers[index]) {
            state.mapData.layers[index].name = name
            state.hasUnsavedChanges = true
          }
        })
      },

      // Entity operations
      placeEntity: (entity) => {
        set((state) => {
          const entityLayer = state.mapData.layers.find(l => l.type === 'objectgroup')
          if (entityLayer) {
            if (!entityLayer.objects) entityLayer.objects = []
            entityLayer.objects.push(entity)
            state.hasUnsavedChanges = true
          }
        })
      },

      updateEntity: (id, updates) => {
        set((state) => {
          const entityLayer = state.mapData.layers.find(l => l.type === 'objectgroup')
          if (entityLayer?.objects) {
            const entity = entityLayer.objects.find(o => o.id === id)
            if (entity) {
              Object.assign(entity, updates)
              state.hasUnsavedChanges = true
            }
          }
        })
      },

      moveEntity: (id, x, y) => {
        get().updateEntity(id, { x, y })
      },

      deleteEntity: (id) => {
        set((state) => {
          const entityLayer = state.mapData.layers.find(l => l.type === 'objectgroup')
          if (entityLayer?.objects) {
            entityLayer.objects = entityLayer.objects.filter(o => o.id !== id)
            state.hasUnsavedChanges = true
          }
        })
      },

      // Tileset operations
      initTilesets: async () => {
        const debugTileset = createDebugTileset()
        let loadedTilesets: LoadedTileset[] = [debugTileset]

        try {
          if (window.electron) {
            const configExists = await window.electron.fs.exists(CONFIG_PATH)
            if (configExists) {
              const configContent = await window.electron.fs.readFile(CONFIG_PATH)
              const config = JSON.parse(configContent)

              if (config.tilesets && Array.isArray(config.tilesets)) {
                for (const tilesetConfig of config.tilesets as TilesetConfig[]) {
                  if (tilesetConfig.id === DEBUG_TILESET_ID) continue

                  try {
                    const loaded = await loadTilesetFromPath(
                      tilesetConfig,
                      window.electron.fs.readFileBase64
                    )
                    loadedTilesets.push(loaded)
                    console.log(`Loaded tileset: ${tilesetConfig.name}`)
                  } catch (err) {
                    console.warn(`Failed to load tileset ${tilesetConfig.name}:`, err)
                    loadedTilesets.push({
                      ...tilesetConfig,
                      canvas: document.createElement('canvas'),
                      imageWidth: 0,
                      imageHeight: 0,
                      tilesPerRow: 0,
                      totalTiles: 0,
                      status: 'error',
                      error: `Failed to load: ${tilesetConfig.sourcePath}`,
                    })
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('Failed to load tileset config:', err)
        }

        set({ tilesets: loadedTilesets })
      },

      addTileset: async (config) => {
        if (!window.electron) {
          toast.error('Tileset import requires Electron')
          return
        }

        set({ isLoadingTileset: true })

        try {
          const { tilesets } = get()
          const nextFirstGid = getNextFirstGid(tilesets)

          const newTileset = await loadTilesetFromPath(
            {
              id: `tileset_${Date.now()}`,
              name: config.name,
              sourcePath: config.sourcePath,
              tileSize: config.tileSize,
              firstGid: nextFirstGid,
            },
            window.electron.fs.readFileBase64
          )

          // Bypass Immer for DOM elements (canvas) - use direct state update
          set({ tilesets: [...get().tilesets, newTileset] })

          await get().saveTilesetsToConfig()
          toast.success(`Loaded tileset: ${newTileset.name} (${newTileset.totalTiles} tiles)`)
        } catch (err) {
          console.error('Failed to load tileset:', err)
          toast.error('Failed to load tileset')
        } finally {
          set({ isLoadingTileset: false })
        }
      },

      removeTileset: async (id) => {
        if (id === DEBUG_TILESET_ID) {
          toast.error('Cannot remove the Debug tileset')
          return
        }

        set((state) => {
          state.tilesets = state.tilesets.filter(ts => ts.id !== id)
        })

        await get().saveTilesetsToConfig()
        toast.success('Tileset removed')
      },

      saveTilesetsToConfig: async () => {
        if (!window.electron) return

        try {
          const { tilesets } = get()
          let config: Record<string, unknown> = {}

          const configExists = await window.electron.fs.exists(CONFIG_PATH)
          if (configExists) {
            const content = await window.electron.fs.readFile(CONFIG_PATH)
            config = JSON.parse(content)
          }

          const tilesetConfigs = tilesets
            .filter(ts => ts.id !== DEBUG_TILESET_ID && ts.status === 'ready')
            .map(ts => tilesetToConfig(ts))

          config.tilesets = tilesetConfigs

          await window.electron.fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 4))
          console.log('Saved tilesets to config')
        } catch (err) {
          console.error('Failed to save tilesets to config:', err)
        }
      },
    })),
    { name: 'project-store' }
  )
)

// Selectors
export const useMapData = () => useProjectStore((s) => s.mapData)
export const useLayers = () => useProjectStore((s) => s.mapData.layers)
export const useTilesets = () => useProjectStore((s) => s.tilesets)
export const useCanUndo = () => useProjectStore((s) => s.canUndo)
export const useCanRedo = () => useProjectStore((s) => s.canRedo)
export const useHasUnsavedChanges = () => useProjectStore((s) => s.hasUnsavedChanges)
