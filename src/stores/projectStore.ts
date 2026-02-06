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
  EntityDefinitionFile,
  InteractionDefinitionFile,
  LayerGroup,
  TileActionGroup,
} from '@/lib/types'
import type { LDtkProject } from '@/lib/ldtk/project'
import {
  createDebugTileset,
  loadTilesetFromPath,
  getNextFirstGid,
  stripTileFlipFlags,
  tilesetToConfig,
} from '@/lib/tileset'
import { loadRoomDataFromFile, type RoomTilesetReference } from '@/lib/room-loader'
import {
  parseEntityDefinitionFile,
  parseInteractionDefinitionFile,
} from '@/lib/entity-definitions'
import { toast } from 'sonner'
import {
  setKimbarRootPath,
  detectKimbarRoot,
  loadKimbarRegistry,
} from '@/lib/kimbar/registry'
import { clearSpriteCache, preloadCharacterSprite } from '@/lib/kimbar/sprite-resolver'

const CONFIG_FILENAME = 'spudtile.config.json'
const LEGACY_CONFIG_FILENAME = 'prairiebob.config.json'
const SAMPLE_PROJECT_RELATIVE_PATH = 'samples/cottage'

async function resolveWritableConfigPath(): Promise<string> {
  if (window.electron?.app?.getPaths) {
    const { appPath, resourcesPath, isPackaged } = await window.electron.app.getPaths()
    const basePath = isPackaged ? resourcesPath : appPath
    return `${basePath}/${CONFIG_FILENAME}`
  }
  return CONFIG_FILENAME
}

async function resolveReadableConfigPath(): Promise<string> {
  const writablePath = await resolveWritableConfigPath()
  if (!window.electron?.fs) return writablePath

  if (await window.electron.fs.exists(writablePath)) {
    return writablePath
  }

  const legacyPath = writablePath.replace(CONFIG_FILENAME, LEGACY_CONFIG_FILENAME)
  if (await window.electron.fs.exists(legacyPath)) {
    return legacyPath
  }

  return writablePath
}

async function resolveSampleProjectPath(): Promise<string> {
  if (window.electron?.app?.getPaths) {
    const { appPath, resourcesPath, isPackaged } = await window.electron.app.getPaths()
    return isPackaged
      ? `${resourcesPath}/samples/cottage`
      : `${appPath}/samples/cottage`
  }
  return SAMPLE_PROJECT_RELATIVE_PATH
}

/**
 * Detect and initialize the Kimbar linked project for character sprite loading.
 * Runs in the background - does not block project load.
 */
async function initKimbarLinkedProject(projectPath: string): Promise<void> {
  try {
    clearSpriteCache()
    const kimbarRoot = await detectKimbarRoot(projectPath)
    if (!kimbarRoot) {
      console.log('[projectStore] No Kimbar linked project detected')
      return
    }

    setKimbarRootPath(kimbarRoot)
    const characters = await loadKimbarRegistry()
    console.log(`[projectStore] Kimbar registry loaded: ${characters.length} characters from ${kimbarRoot}`)

    // Preload player sprite (char.kim) eagerly
    const kimEntry = characters.find((c) => c.id === 'char.kim')
    if (kimEntry) {
      preloadCharacterSprite('char.kim')
    }
  } catch (err) {
    console.warn('[projectStore] Failed to initialize Kimbar linked project:', err)
  }
}

const MAX_HISTORY = 100

function normalizeTileLayerData(data: number[] | undefined, width: number, height: number): number[] {
  const expectedSize = Math.max(1, width * height)
  if (!Array.isArray(data)) {
    return new Array(expectedSize).fill(0)
  }
  if (data.length === expectedSize) {
    return [...data]
  }
  if (data.length > expectedSize) {
    return data.slice(0, expectedSize)
  }
  return [...data, ...new Array(expectedSize - data.length).fill(0)]
}

function isCollisionLayerName(name: string): boolean {
  return name.trim().toLowerCase() === 'collision'
}

function hasBlockingTiles(data: number[]): boolean {
  return data.some((tileId) => stripTileFlipFlags(tileId) > 0)
}

function generateCollisionOutlineData(level: LevelData): number[] {
  const width = Math.max(1, level.width)
  const height = Math.max(1, level.height)
  const size = width * height
  const occupied = new Array<boolean>(size).fill(false)

  for (const layer of level.layers) {
    if (layer.type !== 'tilelayer') continue
    if (isCollisionLayerName(layer.name)) continue
    const data = normalizeTileLayerData(layer.data, width, height)
    for (let index = 0; index < size; index += 1) {
      if (stripTileFlipFlags(data[index]) > 0) {
        occupied[index] = true
      }
    }
  }

  const collision = new Array<number>(size).fill(0)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (!occupied[index]) continue
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]
      const touchesExterior = neighbors.some(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true
        return !occupied[ny * width + nx]
      })
      if (touchesExterior) {
        collision[index] = 1
      }
    }
  }

  return collision
}

function ensureCollisionLayer(level: LevelData): LevelData {
  const width = Math.max(1, level.width)
  const height = Math.max(1, level.height)
  const layers = [...level.layers]
  const generatedOutline = generateCollisionOutlineData(level)
  const collisionLayerIndex = layers.findIndex(
    (layer) => layer.type === 'tilelayer' && isCollisionLayerName(layer.name)
  )

  if (collisionLayerIndex === -1) {
    layers.push({
      name: 'Collision',
      type: 'tilelayer',
      visible: true,
      locked: false,
      opacity: 1,
      data: generatedOutline,
    })
    return { ...level, layers }
  }

  const existing = layers[collisionLayerIndex]
  const normalizedData = normalizeTileLayerData(existing.data, width, height)
  const shouldAutofillOutline = !hasBlockingTiles(normalizedData) && hasBlockingTiles(generatedOutline)
  const normalized = {
    ...existing,
    type: 'tilelayer' as const,
    data: shouldAutofillOutline ? generatedOutline : normalizedData,
  }
  layers[collisionLayerIndex] = normalized
  return { ...level, layers }
}

interface ProjectConfig {
  name: string
  version: string
  tileSize: number
  paths: {
    maps: string
    tilesets: string
    interactions: string
    entities?: string
    exports?: string
  }
  tilesets: Array<{
    id: string
    file: string
    tileSize: number
    columns?: number
    tileCount?: number
  }>
}

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
    exportedFrom: 'spudtile',
    version: '1.0.0',
  },
}

interface ProjectState {
  // Project info
  projectPath: string | null
  projectName: string | null
  projectConfig: ProjectConfig | null
  project: LDtkProject | null

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

  // Project-driven definitions
  entityDefinitions: Record<string, EntityDefinitionFile>
  interactionDefinitions: Record<string, InteractionDefinitionFile>

  // Layer groups
  layerGroups: LayerGroup[]

  // Tile actions
  tileActionGroups: TileActionGroup[]

  // Computed
  canUndo: boolean
  canRedo: boolean
}

interface ProjectActions {
  // Project operations
  loadProject: (projectPath: string) => Promise<void>
  loadSampleProject: () => Promise<void>
  createNewProject: (options: {
    name: string
    path: string
    tileSize: number
    mapWidth: number
    mapHeight: number
    layers: string[]
    tileset?: {
      id: string
      file: string
      sourcePath: string
      tileSize: number
      columns: number
      tileCount: number
    } | null
  }) => Promise<void>

  // Map operations
  setMapData: (data: LevelData, recordHistory?: boolean, description?: string) => void
  loadMap: (mapId: string) => Promise<void>
  saveMap: () => Promise<void>
  refreshCurrentRoomFromDisk: () => Promise<boolean>
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
  loadRoomTilesets: (
    references: RoomTilesetReference[],
    options?: { replaceExisting?: boolean; persist?: boolean }
  ) => Promise<LoadedTileset[]>
  removeTileset: (id: string) => Promise<void>
  saveTilesetsToConfig: () => Promise<void>

  // Layer grouping
  createLayerGroup: (name: string) => void
  deleteLayerGroup: (id: string) => void
  moveLayerToGroup: (layerName: string, groupId: string | null) => void
  toggleGroupVisibility: (id: string) => void
  toggleGroupLock: (id: string) => void
  renameLayerGroup: (id: string, name: string) => void
  toggleGroupCollapsed: (id: string) => void

  // Tile actions
  addTileActionGroup: (group: TileActionGroup) => void
  updateTileActionGroup: (id: string, group: Partial<TileActionGroup>) => void
  deleteTileActionGroup: (id: string) => void
}

interface ProjectAssetPaths {
  maps: string
  tilesets: string
  interactions: string
  entities: string
  exports: string
}

interface LoadedProjectDefinitions {
  entityDefinitions: Record<string, EntityDefinitionFile>
  interactionDefinitions: Record<string, InteractionDefinitionFile>
}

function normalizeProjectAssetPaths(paths: ProjectConfig['paths']): ProjectAssetPaths {
  return {
    maps: paths.maps || 'maps',
    tilesets: paths.tilesets || 'tilesets',
    interactions: paths.interactions || 'interactions',
    entities: paths.entities || 'entities',
    exports: paths.exports || 'exports',
  }
}

function isSupportedRoomFileName(name: string): boolean {
  const lowered = name.toLowerCase()
  return lowered.endsWith('.tmx') || lowered.endsWith('.ldtk') || lowered.endsWith('.json')
}

function roomFilePriority(name: string): number {
  const lowered = name.toLowerCase()
  if (lowered.endsWith('.tmx')) return 0
  if (lowered.endsWith('.ldtk')) return 1
  return 2
}

async function loadJsonDefinitionFiles<T extends { id: string }>(
  dirPath: string,
  parser: (value: unknown) => T | null,
): Promise<Record<string, T>> {
  const result: Record<string, T> = {}
  if (!window.electron) return result

  const exists = await window.electron.fs.exists(dirPath)
  if (!exists) return result

  let entries: Array<{ name: string; isDirectory: boolean }> = []
  try {
    entries = await window.electron.fs.readDir(dirPath)
  } catch (err) {
    console.warn('[projectStore] Failed to read definition directory:', dirPath, err)
    return result
  }

  const jsonFiles = entries.filter((entry) => !entry.isDirectory && entry.name.toLowerCase().endsWith('.json'))
  for (const file of jsonFiles) {
    const filePath = `${dirPath}/${file.name}`
    try {
      const content = await window.electron.fs.readFile(filePath)
      const parsedJson = JSON.parse(content)
      const parsedDef = parser(parsedJson)
      if (!parsedDef) continue
      result[parsedDef.id] = parsedDef
    } catch (err) {
      console.warn('[projectStore] Failed to parse definition file:', filePath, err)
    }
  }
  return result
}

async function loadProjectDefinitions(
  projectPath: string,
  paths: ProjectAssetPaths,
): Promise<LoadedProjectDefinitions> {
  const entitiesDir = `${projectPath}/${paths.entities}`
  const interactionsDir = `${projectPath}/${paths.interactions}`
  const [entityDefinitions, interactionDefinitions] = await Promise.all([
    loadJsonDefinitionFiles(entitiesDir, parseEntityDefinitionFile),
    loadJsonDefinitionFiles(interactionsDir, parseInteractionDefinitionFile),
  ])
  return { entityDefinitions, interactionDefinitions }
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      projectPath: null,
      projectName: null,
      projectConfig: null,
      project: null,
      mapData: DEFAULT_MAP,
      currentRoomPath: null,
      hasUnsavedChanges: false,
      past: [],
      future: [],
      tilesets: [],
      isLoadingTileset: false,
      entityDefinitions: {},
      interactionDefinitions: {},
      layerGroups: [],
      tileActionGroups: [],
      canUndo: false,
      canRedo: false,

      // Load a project from a folder containing project.json
      loadProject: async (projectPath: string) => {
        if (!window.electron) {
          toast.error('Project loading requires Electron')
          return
        }

        try {
          const projectJsonPath = `${projectPath}/project.json`
          const exists = await window.electron.fs.exists(projectJsonPath)
          if (!exists) {
            toast.error(`No project.json found in ${projectPath}`)
            return
          }

          const content = await window.electron.fs.readFile(projectJsonPath)
          const rawConfig: ProjectConfig = JSON.parse(content)
          const normalizedPaths = normalizeProjectAssetPaths(rawConfig.paths)
          const config: ProjectConfig = {
            ...rawConfig,
            paths: normalizedPaths,
          }

          // Load tilesets from project
          const debugTileset = createDebugTileset()
          const loadedTilesets: LoadedTileset[] = [debugTileset]

          for (const tilesetRef of config.tilesets) {
            const tilesetPath = `${projectPath}/${tilesetRef.file}`
            try {
              const loaded = await loadTilesetFromPath(
                {
                  id: tilesetRef.id,
                  name: tilesetRef.id,
                  sourcePath: tilesetPath,
                  tileSize: tilesetRef.tileSize,
                  firstGid: getNextFirstGid(loadedTilesets),
                },
                window.electron.fs.readFileBase64
              )
              loadedTilesets.push(loaded)
              console.log(`Loaded tileset: ${tilesetRef.id}`)
            } catch (err) {
              console.warn(`Failed to load tileset ${tilesetRef.id}:`, err)
            }
          }

          // Load first supported map in the maps folder (.tmx, .ldtk, .json)
          const mapsPath = `${projectPath}/${normalizedPaths.maps}`
          let mapData = DEFAULT_MAP
          let mapPath: string | null = null
          let mapTilesetReferences: RoomTilesetReference[] = []

          try {
            const mapEntries = await window.electron.fs.readDir(mapsPath)
            const roomFiles = mapEntries
              .filter((entry) => !entry.isDirectory && isSupportedRoomFileName(entry.name))
              .map((entry) => entry.name)
              .sort((a, b) => roomFilePriority(a) - roomFilePriority(b) || a.localeCompare(b))

            for (const roomFile of roomFiles) {
              const candidatePath = `${mapsPath}/${roomFile}`
              try {
                const loaded = await loadRoomDataFromFile(candidatePath, window.electron.fs.readFile)
                mapData = ensureCollisionLayer(loaded.data)
                mapPath = candidatePath
                mapTilesetReferences = loaded.tilesets
                console.log(`[projectStore] Loaded room map: ${roomFile} (${loaded.sourceFormat})`)
                break
              } catch (err) {
                console.warn(`[projectStore] Skipping room candidate "${roomFile}":`, err)
              }
            }
          } catch (err) {
            console.warn(`[projectStore] Failed to read maps directory "${mapsPath}":`, err)
          }

          let effectiveTilesets = loadedTilesets
          if (mapTilesetReferences.length > 0) {
            const sortedRoomTilesets = [...mapTilesetReferences].sort((a, b) => a.firstGid - b.firstGid)
            const loadedRoomTilesets: LoadedTileset[] = []

            for (const ref of sortedRoomTilesets) {
              try {
                const loaded = await loadTilesetFromPath(
                  {
                    id: ref.id,
                    name: ref.name,
                    sourcePath: ref.sourcePath,
                    tileSize: ref.tileSize,
                    firstGid: ref.firstGid,
                  },
                  window.electron.fs.readFileBase64
                )
                loadedRoomTilesets.push(loaded)
              } catch (err) {
                console.warn(`[projectStore] Failed to load room tileset "${ref.name}" from ${ref.sourcePath}:`, err)
              }
            }

            if (loadedRoomTilesets.length > 0) {
              effectiveTilesets = loadedRoomTilesets
            } else {
              console.warn('[projectStore] Room map parsed, but no room tilesets could be loaded. Falling back to project.json tilesets.')
            }
          }

          const { entityDefinitions, interactionDefinitions } = await loadProjectDefinitions(
            projectPath,
            normalizedPaths,
          )

          set({
            projectPath,
            projectName: config.name,
            projectConfig: config,
            tilesets: effectiveTilesets,
            entityDefinitions,
            interactionDefinitions,
            mapData,
            currentRoomPath: mapPath,
            hasUnsavedChanges: false,
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,
          })

          console.log('[projectStore] Project loaded:', config.name)
          console.log('[projectStore] Tilesets loaded:', effectiveTilesets.length)
          console.log('[projectStore] Entity definitions loaded:', Object.keys(entityDefinitions).length)
          console.log('[projectStore] Interaction definitions loaded:', Object.keys(interactionDefinitions).length)
          console.log('[projectStore] MapData:', mapData?.id)

          // Track in recent projects
          const { addRecentProject, closeProjectSelector } = await import('./uiStore').then(m => m.useUIStore.getState())
          addRecentProject(projectPath, config.name)
          closeProjectSelector()

          toast.success(`Loaded project: ${config.name}`)

          // Try to initialize Kimbar linked project for character sprites
          initKimbarLinkedProject(projectPath)
        } catch (err) {
          console.error('Failed to load project:', err)
          toast.error('Failed to load project')
        }
      },

      // Load the sample project
      loadSampleProject: async () => {
        console.log('[projectStore] loadSampleProject called')
        const samplePath = await resolveSampleProjectPath()
        console.log('[projectStore] samplePath:', samplePath)
        if (window.electron) {
          const exists = await window.electron.fs.exists(samplePath)
          console.log('[projectStore] samplePath exists:', exists)
          if (!exists) {
            toast.error(`Sample project not found at: ${samplePath}`)
            return
          }
        }
        await get().loadProject(samplePath)
      },

      // Create a new project
      createNewProject: async ({ name, path, tileSize, mapWidth, mapHeight, layers, tileset }) => {
        if (!window.electron) {
          toast.error('Project creation requires Electron')
          return
        }

        try {
          // Create folder structure
          await window.electron.fs.mkdir(`${path}/maps`)
          await window.electron.fs.mkdir(`${path}/tilesets`)
          await window.electron.fs.mkdir(`${path}/entities`)
          await window.electron.fs.mkdir(`${path}/interactions`)
          await window.electron.fs.mkdir(`${path}/exports`)

          // Determine which tileset to use
          const tilesetConfig = tileset || {
            id: 'kim_leaf',
            file: 'tilesets/kim_leaf.png',
            sourcePath: 'kim_leaf.png',
            tileSize: 32,
            columns: 16,
            tileCount: 1053,
          }

          // Create project.json
          const projectConfig: ProjectConfig = {
            name,
            version: '1.0.0',
            tileSize,
            paths: {
              maps: 'maps',
              tilesets: 'tilesets',
              interactions: 'interactions',
              entities: 'entities',
              exports: 'exports',
            },
            tilesets: [
              {
                id: tilesetConfig.id,
                file: tilesetConfig.file,
                tileSize: tilesetConfig.tileSize,
                columns: tilesetConfig.columns,
                tileCount: tilesetConfig.tileCount,
              },
            ],
          }

          await window.electron.fs.writeFile(
            `${path}/project.json`,
            JSON.stringify(projectConfig, null, 2)
          )

          // Copy tileset into project tilesets folder
          try {
            if (window.electron.app?.getPaths) {
              const { appPath, resourcesPath, isPackaged } = await window.electron.app.getPaths()
              const sourcePath = isPackaged
                ? `${resourcesPath}/tilesets/${tilesetConfig.sourcePath}`
                : `${appPath}/public/tilesets/${tilesetConfig.sourcePath}`

              // Extract just the filename for the target
              const targetFilename = tilesetConfig.file.split('/').pop() || 'tileset.png'
              const targetPath = `${path}/tilesets/${targetFilename}`

              const base64 = await window.electron.fs.readFileBase64(sourcePath)
              await window.electron.fs.writeFileBase64(targetPath, base64)
            }
          } catch (err) {
            console.warn('Failed to copy tileset:', err)
            toast.error('Failed to copy tileset - you may need to add one manually')
          }

          // Create default map
          const defaultLayers: Layer[] = layers.map(layerName => {
            if (layerName === 'Entities') {
              return {
                name: layerName,
                type: 'objectgroup' as const,
                visible: true,
                locked: false,
                opacity: 1,
                objects: [],
              }
            }
            return {
              name: layerName,
              type: 'tilelayer' as const,
              visible: true,
              locked: false,
              opacity: 1,
              data: new Array(mapWidth * mapHeight).fill(0),
            }
          })

          const defaultMap: LevelData = {
            id: 'main',
            width: mapWidth,
            height: mapHeight,
            tileSize,
            layers: defaultLayers,
            metadata: {
              editedAt: new Date().toISOString(),
              exportedFrom: 'spudtile',
              version: '1.0.0',
            },
          }

          await window.electron.fs.writeFile(
            `${path}/maps/main.json`,
            JSON.stringify(defaultMap, null, 2)
          )

          // Now load the project
          await get().loadProject(path)
        } catch (err) {
          console.error('Failed to create project:', err)
          toast.error(`Failed to create project: ${err}`)
        }
      },

      // Load a specific map by ID
      loadMap: async (mapId: string) => {
        const { projectPath, projectConfig } = get()
        if (!window.electron || !projectPath || !projectConfig) return

        const mapPath = `${projectPath}/${projectConfig.paths.maps}/${mapId}.json`
        try {
          const content = await window.electron.fs.readFile(mapPath)
          const mapData = ensureCollisionLayer(JSON.parse(content))
          set({
            mapData,
            currentRoomPath: mapPath,
            hasUnsavedChanges: false,
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,
          })
          toast.success(`Loaded map: ${mapId}`)
        } catch (err) {
          toast.error(`Failed to load map: ${mapId}`)
        }
      },

      // Save the current map
      saveMap: async () => {
        const { mapData, currentRoomPath, projectPath, projectConfig } = get()
        if (!window.electron || !mapData) return

        // Update metadata
        const updatedMap = {
          ...mapData,
          metadata: {
            ...mapData.metadata,
            editedAt: new Date().toISOString(),
            exportedFrom: 'spudtile',
          },
        }

        let savePath = currentRoomPath
        if (!savePath && projectPath && projectConfig) {
          savePath = `${projectPath}/${projectConfig.paths.maps}/${mapData.id}.json`
        }

        if (savePath) {
          await window.electron.fs.writeFile(savePath, JSON.stringify(updatedMap, null, 2))
          set({ mapData: updatedMap, currentRoomPath: savePath, hasUnsavedChanges: false })
          toast.success('Map saved!')
        }
      },

      refreshCurrentRoomFromDisk: async () => {
        const { currentRoomPath, projectPath, projectConfig } = get()
        if (!window.electron || !currentRoomPath) {
          return false
        }

        try {
          const loaded = await loadRoomDataFromFile(currentRoomPath, window.electron.fs.readFile)
          if (loaded.tilesets.length > 0) {
            await get().loadRoomTilesets(loaded.tilesets, {
              replaceExisting: true,
              persist: false,
            })
          }

          let entityDefinitions = get().entityDefinitions
          let interactionDefinitions = get().interactionDefinitions
          if (projectPath && projectConfig?.paths) {
            const normalizedPaths = normalizeProjectAssetPaths(projectConfig.paths)
            const loadedDefinitions = await loadProjectDefinitions(projectPath, normalizedPaths)
            entityDefinitions = loadedDefinitions.entityDefinitions
            interactionDefinitions = loadedDefinitions.interactionDefinitions
          }

          set({
            mapData: ensureCollisionLayer(loaded.data),
            entityDefinitions,
            interactionDefinitions,
            hasUnsavedChanges: false,
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,
          })
          return true
        } catch (err) {
          console.error('Failed to refresh room from disk:', err)
          return false
        }
      },

      // Map operations
      setMapData: (data, recordHistory = true, description = 'Edit') => {
        const normalizedData = ensureCollisionLayer(data)
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
          state.mapData = normalizedData
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
        console.log('[projectStore] initTilesets called')
        const debugTileset = createDebugTileset()
        let loadedTilesets: LoadedTileset[] = [debugTileset]
        console.log('[projectStore] Created debug tileset:', debugTileset.id, 'status:', debugTileset.status)

        try {
          if (window.electron) {
            const configPath = await resolveReadableConfigPath()
            const configExists = await window.electron.fs.exists(configPath)
            console.log('[projectStore] Config exists:', configExists, 'at', configPath)
            if (configExists) {
              const configContent = await window.electron.fs.readFile(configPath)
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

        console.log('[projectStore] Setting tilesets:', loadedTilesets.length, loadedTilesets.map(t => ({ id: t.id, status: t.status })))
        set({ tilesets: loadedTilesets })

        // Try to auto-detect Kimbar for standalone mode
        initKimbarLinkedProject('.')
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

      loadRoomTilesets: async (references, options) => {
        if (!window.electron || references.length === 0) {
          return []
        }

        const replaceExisting = options?.replaceExisting ?? true
        const persist = options?.persist ?? false
        const sorted = [...references].sort((a, b) => a.firstGid - b.firstGid)
        const loadedFromRoom: LoadedTileset[] = []

        for (let index = 0; index < sorted.length; index += 1) {
          const ref = sorted[index]
          try {
            const loaded = await loadTilesetFromPath(
              {
                id: ref.id || `room_tileset_${index + 1}`,
                name: ref.name,
                sourcePath: ref.sourcePath,
                tileSize: ref.tileSize,
                firstGid: ref.firstGid,
              },
              window.electron.fs.readFileBase64
            )
            loadedFromRoom.push(loaded)
          } catch (err) {
            console.warn(`Failed to load room tileset "${ref.name}" from ${ref.sourcePath}:`, err)
          }
        }

        if (loadedFromRoom.length === 0) {
          toast.error('Room opened, but tilesets could not be loaded')
          return []
        }

        const nextTilesets = replaceExisting
          ? loadedFromRoom
          : [...get().tilesets.filter((ts) => ts.id !== DEBUG_TILESET_ID), ...loadedFromRoom]

        set({ tilesets: nextTilesets })

        if (persist) {
          await get().saveTilesetsToConfig()
        }

        return loadedFromRoom
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
          const readConfigPath = await resolveReadableConfigPath()
          const writeConfigPath = await resolveWritableConfigPath()

          const configExists = await window.electron.fs.exists(readConfigPath)
          if (configExists) {
            const content = await window.electron.fs.readFile(readConfigPath)
            config = JSON.parse(content)
          }

          const tilesetConfigs = tilesets
            .filter(ts => ts.id !== DEBUG_TILESET_ID && ts.status === 'ready')
            .map(ts => tilesetToConfig(ts))

          config.tilesets = tilesetConfigs

          await window.electron.fs.writeFile(writeConfigPath, JSON.stringify(config, null, 4))
          console.log('Saved tilesets to config at', writeConfigPath)
        } catch (err) {
          console.error('Failed to save tilesets to config:', err)
        }
      },

      // Layer grouping actions
      createLayerGroup: (name: string) => {
        set((state) => {
          const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          state.layerGroups.push({
            id,
            name,
            type: 'static',
            layerIds: [],
            collapsed: false,
            visible: true,
            locked: false,
          })
        })
      },

      deleteLayerGroup: (id: string) => {
        set((state) => {
          state.layerGroups = state.layerGroups.filter((g) => g.id !== id)
        })
      },

      moveLayerToGroup: (layerName: string, groupId: string | null) => {
        set((state) => {
          // Remove from all groups first
          for (const group of state.layerGroups) {
            group.layerIds = group.layerIds.filter((lid) => lid !== layerName)
          }
          // Add to target group if specified
          if (groupId) {
            const target = state.layerGroups.find((g) => g.id === groupId)
            if (target) {
              target.layerIds.push(layerName)
            }
          }
        })
      },

      toggleGroupVisibility: (id: string) => {
        set((state) => {
          const group = state.layerGroups.find((g) => g.id === id)
          if (group) {
            group.visible = !group.visible
            // Also toggle all child layers
            for (const layer of state.mapData.layers) {
              if (group.layerIds.includes(layer.name)) {
                layer.visible = group.visible
              }
            }
          }
        })
      },

      toggleGroupLock: (id: string) => {
        set((state) => {
          const group = state.layerGroups.find((g) => g.id === id)
          if (group) {
            group.locked = !group.locked
            for (const layer of state.mapData.layers) {
              if (group.layerIds.includes(layer.name)) {
                layer.locked = group.locked
              }
            }
          }
        })
      },

      renameLayerGroup: (id: string, name: string) => {
        set((state) => {
          const group = state.layerGroups.find((g) => g.id === id)
          if (group) group.name = name
        })
      },

      toggleGroupCollapsed: (id: string) => {
        set((state) => {
          const group = state.layerGroups.find((g) => g.id === id)
          if (group) group.collapsed = !group.collapsed
        })
      },

      // Tile action group actions
      addTileActionGroup: (group: TileActionGroup) => {
        set((state) => {
          state.tileActionGroups.push(group)
        })
      },

      updateTileActionGroup: (id: string, updates: Partial<TileActionGroup>) => {
        set((state) => {
          const idx = state.tileActionGroups.findIndex((g) => g.id === id)
          if (idx !== -1) {
            Object.assign(state.tileActionGroups[idx], updates)
          }
        })
      },

      deleteTileActionGroup: (id: string) => {
        set((state) => {
          state.tileActionGroups = state.tileActionGroups.filter((g) => g.id !== id)
        })
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
export const useLayerGroups = () => useProjectStore((s) => s.layerGroups)
export const useTileActionGroups = () => useProjectStore((s) => s.tileActionGroups)
