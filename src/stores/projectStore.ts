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
  TileActionAssignment,
} from '@/lib/types'
import type { LDtkProject } from '@/lib/ldtk/project'
import {
  createDebugTileset,
  loadTilesetFromPath,
  getNextFirstGid,
  tilesetToConfig,
} from '@/lib/tileset'
import { deserializeActionGroups, serializeActionGroups } from '@/lib/tile-actions'
import { loadRoomDataFromFile, type RoomTilesetReference } from '@/lib/room-loader'
import {
  isCollisionLayerName,
  resolveCollisionSourcesFromMetadata,
  withCollisionSourceConfig,
  getAutoWallsLinkedLayers,
  type CollisionStrategy,
} from '@/lib/collision-model'
import {
  type WorldLayout,
  type RoomPosition,
  type DoorConnection,
  createEmptyLayout,
  loadWorldLayout,
  saveWorldLayout,
  setRoomPosition,
  addConnection,
  removeConnection,
} from '@/lib/world-layout'
import { extractDoors } from '@/lib/door-extraction'
import { importTiledWorldPositions, findWorldFiles } from '@/lib/tiled-world-import'
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
import { buildKimbarProjectConfig, getMegalevelPath } from '@/lib/kimbar/project-shim'

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

async function initKimbarLinkedProjectAtRoot(kimbarRoot: string): Promise<void> {
  try {
    clearSpriteCache()
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

function ensureCollisionLayer(level: LevelData): LevelData {
  const width = Math.max(1, level.width)
  const height = Math.max(1, level.height)
  const layers = [...level.layers]
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
      data: new Array(width * height).fill(0),
    })
    const withLayer = { ...level, layers }
    return withCollisionSourceConfig(withLayer, resolveCollisionSourcesFromMetadata(withLayer))
  }

  const existing = layers[collisionLayerIndex]
  const normalizedData = normalizeTileLayerData(existing.data, width, height)
  const normalized = {
    ...existing,
    type: 'tilelayer' as const,
    data: normalizedData,
  }
  layers[collisionLayerIndex] = normalized
  const withLayer = { ...level, layers }
  return withCollisionSourceConfig(withLayer, resolveCollisionSourcesFromMetadata(withLayer))
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
  tileActionGroups?: unknown[]
  layerGroups?: LayerGroup[]
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
  isKimbarProject: boolean
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
  dirtyEntityDefinitionIds: string[]
  dirtyInteractionDefinitionIds: string[]
  deletedEntityDefinitionIds: string[]
  deletedInteractionDefinitionIds: string[]

  // Layer groups
  layerGroups: LayerGroup[]
  layerGroupsDirty: boolean

  // Tile actions
  tileActionGroups: TileActionGroup[]
  customTileActionGroups: TileActionGroup[]
  customTileActionGroupsDirty: boolean

  /** Per-cell tile action assignments, keyed by "layerName:x:y". */
  tileActionAssignments: Record<string, TileActionAssignment>

  // Room registry (multi-room / world view)
  roomRegistry: RoomFileEntry[]
  worldLayout: WorldLayout

  // Computed
  canUndo: boolean
  canRedo: boolean
}

/** A discovered room file in the project maps directory. */
export interface RoomFileEntry {
  /** File name without extension (used as room ID). */
  id: string
  /** Display name derived from file name. */
  name: string
  /** Absolute file path. */
  filePath: string
  /** File extension (e.g. 'tmx', 'json'). */
  format: string
}

interface ProjectActions {
  // Project operations
  loadProject: (projectPath: string) => Promise<void>
  loadKimbarProject: (kimbarRoot: string) => Promise<void>
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
  saveMap: (mapDataOverride?: LevelData) => Promise<void>
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
  setCollisionSourceLayerEnabled: (layerName: string, enabled: boolean) => void
  setCollisionDerivedOverlayVisible: (visible: boolean) => void
  setCollisionStrategy: (strategy: CollisionStrategy) => void

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
  assignTileAction: (layerName: string, x: number, y: number, actionGroupId: string) => void
  removeTileAction: (layerName: string, x: number, y: number) => void
  clearTileActionsForLayer: (layerName: string) => void

  // Room registry / world layout
  scanRoomFiles: () => Promise<void>
  loadWorldLayoutFromDisk: () => Promise<void>
  saveWorldLayoutToDisk: () => Promise<void>
  syncDoorConnections: () => Promise<void>
  importTiledWorldFile: (worldFilePath: string) => Promise<number>
  autoImportTiledWorlds: () => Promise<void>
  updateRoomPosition: (roomId: string, x: number, y: number) => void
  addDoorConnection: (connection: DoorConnection) => void
  removeDoorConnection: (connectionId: string) => void
  openRoom: (roomId: string) => Promise<void>
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
  entityDefinitionFilePaths: Record<string, string>
  interactionDefinitionFilePaths: Record<string, string>
}

/** Dynamic group ID prefix — all pattern-derived groups use this. */
const DYNAMIC_GROUP_PREFIX = 'dynamic-group-'

/**
 * Extended patterns for dynamic layer grouping.
 * These augment the META_GROUP_PATTERNS from types.ts with an additional
 * entity-by-type pattern that catches objectgroup layers.
 */
const DYNAMIC_GROUP_RULES: Array<{
  id: string
  name: string
  color: string
  matchLayer: (layer: Layer) => boolean
}> = [
  {
    id: `${DYNAMIC_GROUP_PREFIX}visual`,
    name: 'Visual',
    color: '#4CAF50',
    matchLayer: (layer) =>
      layer.type === 'tilelayer' && /^(floor|wall|trim|overlay|decor)/i.test(layer.name),
  },
  {
    id: `${DYNAMIC_GROUP_PREFIX}collision`,
    name: 'Collision',
    color: '#F44336',
    matchLayer: (layer) =>
      layer.type === 'tilelayer' && /(collision|collide|solid|block)/i.test(layer.name),
  },
  {
    id: `${DYNAMIC_GROUP_PREFIX}entities`,
    name: 'Entities',
    color: '#2196F3',
    matchLayer: (layer) => {
      if (layer.type === 'objectgroup') return true
      return /(entities|entity|objects|spawns|spawn|npcs|npc|doors|door|triggers|portal|portals)/i.test(layer.name)
    },
  },
]

function normalizeLayerName(name: string): string {
  return name.trim().toLowerCase()
}

/** Derive dynamic layer groups from layer names using pattern rules. */
function deriveDynamicLayerGroups(level: LevelData): LayerGroup[] {
  const groups: LayerGroup[] = []
  for (const rule of DYNAMIC_GROUP_RULES) {
    const matching = level.layers
      .filter(rule.matchLayer)
      .map((layer) => layer.name)
    if (matching.length > 0) {
      groups.push({
        id: rule.id,
        name: rule.name,
        type: 'dynamic',
        layerIds: matching,
        collapsed: false,
        visible: true,
        locked: false,
        color: rule.color,
      })
    }
  }
  return groups
}

function isDynamicLayerGroup(group: LayerGroup): boolean {
  return group.type === 'dynamic' || group.id.startsWith(DYNAMIC_GROUP_PREFIX)
}

/** Merge: keep manual (static) groups, regenerate dynamic groups from current layers. */
function mergeAutoLayerGroups(
  existingGroups: LayerGroup[],
  level: LevelData,
): LayerGroup[] {
  // Preserve collapsed/visible/locked state from existing dynamic groups
  const existingDynamic = new Map(
    existingGroups.filter(isDynamicLayerGroup).map((g) => [g.id, g]),
  )
  const manualGroups = existingGroups.filter((group) => !isDynamicLayerGroup(group))
  const freshDynamic = deriveDynamicLayerGroups(level)

  // Carry forward UI state from previous dynamic groups
  const mergedDynamic = freshDynamic.map((group) => {
    const prev = existingDynamic.get(group.id)
    if (prev) {
      return { ...group, collapsed: prev.collapsed, visible: prev.visible, locked: prev.locked }
    }
    return group
  })

  return [...manualGroups, ...mergedDynamic]
}

function findFirstTileId(tiles: number[][]): number {
  for (const row of tiles) {
    for (const tileId of row) {
      if (Number.isFinite(tileId)) return Math.max(0, Math.floor(tileId))
    }
  }
  return 0
}

function deriveTileActionGroupsFromDefinitions(
  interactionDefinitions: Record<string, InteractionDefinitionFile>,
  entityDefinitions: Record<string, EntityDefinitionFile>,
): TileActionGroup[] {
  const groups: TileActionGroup[] = []

  const interactionIds = Object.keys(interactionDefinitions).sort((a, b) => a.localeCompare(b))
  for (const interactionId of interactionIds) {
    const def = interactionDefinitions[interactionId]
    const states = Object.entries(def.states).map(([stateName, stateDef]) => ({
      name: stateName,
      tileId: findFirstTileId(stateDef.tiles),
      // Use transition duration if present so action previews have timing context.
      duration: def.transitions?.[`${stateName}→${stateName === 'open' ? 'closed' : 'open'}`]?.duration,
    }))

    if (states.length === 0) continue
    const stateNames = states.map((state) => state.name)
    const defaultState = stateNames.includes(def.defaultState) ? def.defaultState : stateNames[0]
    groups.push({
      id: `interaction:${interactionId}`,
      name: `${interactionId} (${normalizeLayerName(def.type || 'interaction')})`,
      states,
      defaultState,
      triggers: [
        {
          type: 'on_interact',
          parameters: { interactionId },
        },
      ],
      effects: [
        {
          type: 'change_state',
          parameters: {
            interactionId,
            mode: stateNames.includes('open') && stateNames.includes('closed') ? 'toggle' : 'cycle',
            states: stateNames,
          },
        },
      ],
    })
  }

  const entityIds = Object.keys(entityDefinitions).sort((a, b) => a.localeCompare(b))
  for (const entityId of entityIds) {
    const def = entityDefinitions[entityId]
    if (!def.states || Object.keys(def.states).length === 0) continue
    if (groups.some((group) => group.id === `entity:${entityId}`)) continue

    const states = Object.entries(def.states).map(([stateName, stateDef]) => ({
      name: stateName,
      tileId: Number.isFinite(stateDef.tileId) ? Math.max(0, Math.floor(stateDef.tileId)) : 0,
    }))
    const defaultState = states.some((state) => state.name === def.defaultState)
      ? (def.defaultState as string)
      : states[0]?.name
    if (!defaultState) continue

    groups.push({
      id: `entity:${entityId}`,
      name: `${entityId} (entity)`,
      states,
      defaultState,
      triggers: def.triggers?.onInteract
        ? [{ type: 'on_interact', parameters: { entityId } }]
        : [],
      effects: [],
    })
  }

  return groups
}

function isInteractionGroupId(id: string): boolean {
  return id.startsWith('interaction:')
}

function isEntityGroupId(id: string): boolean {
  return id.startsWith('entity:')
}

function isDefinitionBackedGroupId(id: string): boolean {
  return isInteractionGroupId(id) || isEntityGroupId(id)
}

function combineTileActionGroups(
  interactionDefinitions: Record<string, InteractionDefinitionFile>,
  entityDefinitions: Record<string, EntityDefinitionFile>,
  customTileActionGroups: TileActionGroup[],
): TileActionGroup[] {
  const derived = deriveTileActionGroupsFromDefinitions(interactionDefinitions, entityDefinitions)
  if (customTileActionGroups.length === 0) {
    return derived
  }

  const derivedIds = new Set(derived.map((group) => group.id))
  const uniqueCustom = customTileActionGroups.filter((group) => !derivedIds.has(group.id))
  return [...derived, ...uniqueCustom]
}

function syncInteractionDefinitionFromActionGroup(
  group: TileActionGroup,
  interactionDefinitions: Record<string, InteractionDefinitionFile>,
): void {
  if (!group.id.startsWith('interaction:')) return
  const interactionId = group.id.slice('interaction:'.length)
  if (!interactionId) return
  const target = interactionDefinitions[interactionId]
  if (!target) return

  const nextStates: InteractionDefinitionFile['states'] = {}
  for (const state of group.states) {
    const existing = target.states[state.name]
    const existingHeight = Math.max(1, existing?.tiles.length ?? target.size?.height ?? 1)
    const existingWidth = Math.max(
      1,
      existing?.tiles.reduce((max, row) => Math.max(max, row.length), 0) ?? target.size?.width ?? 1,
    )
    const nextTile = Math.max(0, Math.floor(state.tileId))
    nextStates[state.name] = {
      tiles: Array.from({ length: existingHeight }, () => Array.from({ length: existingWidth }, () => nextTile)),
      collision: existing?.collision ?? false,
    }
  }
  if (Object.keys(nextStates).length === 0) {
    return
  }

  target.states = nextStates
  if (!Object.prototype.hasOwnProperty.call(nextStates, target.defaultState)) {
    target.defaultState = group.defaultState && nextStates[group.defaultState]
      ? group.defaultState
      : Object.keys(nextStates)[0]
  } else {
    target.defaultState = group.defaultState || target.defaultState
  }
}

function syncEntityDefinitionFromActionGroup(
  group: TileActionGroup,
  entityDefinitions: Record<string, EntityDefinitionFile>,
): void {
  if (!group.id.startsWith('entity:')) return
  const entityId = group.id.slice('entity:'.length)
  if (!entityId) return
  const target = entityDefinitions[entityId]
  if (!target) return

  const existingStates = target.states ?? {}
  const nextStates: NonNullable<EntityDefinitionFile['states']> = {}
  for (const state of group.states) {
    const existing = existingStates[state.name]
    nextStates[state.name] = {
      tileId: Math.max(0, Math.floor(state.tileId)),
      collision: existing?.collision,
    }
  }
  if (Object.keys(nextStates).length === 0) {
    return
  }

  target.states = nextStates
  if (!Object.prototype.hasOwnProperty.call(nextStates, target.defaultState ?? '')) {
    target.defaultState = group.defaultState && nextStates[group.defaultState]
      ? group.defaultState
      : Object.keys(nextStates)[0]
  } else {
    target.defaultState = group.defaultState || target.defaultState
  }
}

function addUniqueId(target: string[], id: string): void {
  if (!target.includes(id)) {
    target.push(id)
  }
}

function removeId(target: string[], id: string): void {
  const index = target.indexOf(id)
  if (index !== -1) {
    target.splice(index, 1)
  }
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

interface LoadedJsonDefinitions<T extends { id: string }> {
  definitions: Record<string, T>
  filePaths: Record<string, string>
}

type DefinitionParser<T extends { id: string }> = (value: unknown) => T | null

async function loadJsonDefinitionFiles<T extends { id: string }>(
  dirPath: string,
  parser: DefinitionParser<T>,
): Promise<LoadedJsonDefinitions<T>> {
  const definitions: Record<string, T> = {}
  const filePaths: Record<string, string> = {}
  if (!window.electron) return { definitions, filePaths }

  const exists = await window.electron.fs.exists(dirPath)
  if (!exists) return { definitions, filePaths }

  let entries: Array<{ name: string; isDirectory: boolean }> = []
  try {
    entries = await window.electron.fs.readDir(dirPath)
  } catch (err) {
    console.warn('[projectStore] Failed to read definition directory:', dirPath, err)
    return { definitions, filePaths }
  }

  const jsonFiles = entries.filter((entry) => !entry.isDirectory && entry.name.toLowerCase().endsWith('.json'))
  for (const file of jsonFiles) {
    const filePath = `${dirPath}/${file.name}`
    try {
      const content = await window.electron.fs.readFile(filePath)
      const parsedJson = JSON.parse(content)
      const parsedDef = parser(parsedJson)
      if (!parsedDef) continue
      definitions[parsedDef.id] = parsedDef
      filePaths[parsedDef.id] = filePath
    } catch (err) {
      console.warn('[projectStore] Failed to parse definition file:', filePath, err)
    }
  }
  return { definitions, filePaths }
}

async function loadProjectDefinitions(
  projectPath: string,
  paths: ProjectAssetPaths,
): Promise<LoadedProjectDefinitions> {
  const entitiesDir = `${projectPath}/${paths.entities}`
  const interactionsDir = `${projectPath}/${paths.interactions}`
  const [entitiesLoaded, interactionsLoaded] = await Promise.all([
    loadJsonDefinitionFiles(entitiesDir, parseEntityDefinitionFile),
    loadJsonDefinitionFiles(interactionsDir, parseInteractionDefinitionFile),
  ])
  return {
    entityDefinitions: entitiesLoaded.definitions,
    interactionDefinitions: interactionsLoaded.definitions,
    entityDefinitionFilePaths: entitiesLoaded.filePaths,
    interactionDefinitionFilePaths: interactionsLoaded.filePaths,
  }
}

async function loadPersistedCustomTileActionGroups(projectPath: string): Promise<TileActionGroup[]> {
  if (!window.electron) return []
  const configPath = `${projectPath}/project.json`
  try {
    const exists = await window.electron.fs.exists(configPath)
    if (!exists) return []
    const content = await window.electron.fs.readFile(configPath)
    const parsed = JSON.parse(content) as ProjectConfig
    if (!Array.isArray(parsed.tileActionGroups)) return []
    return deserializeActionGroups(parsed.tileActionGroups).filter((group) => !isDefinitionBackedGroupId(group.id))
  } catch (err) {
    console.warn('[projectStore] Failed loading persisted custom tile actions:', err)
    return []
  }
}

async function persistDefinitionChanges<T extends { id: string }>(
  directoryPath: string,
  definitions: Record<string, T>,
  dirtyIds: string[],
  deletedIds: string[],
  parser: DefinitionParser<T>,
): Promise<{ saved: number; deleted: number }> {
  if (!window.electron) return { saved: 0, deleted: 0 }
  if (dirtyIds.length === 0 && deletedIds.length === 0) return { saved: 0, deleted: 0 }

  await window.electron.fs.mkdir(directoryPath)
  const loaded = await loadJsonDefinitionFiles(directoryPath, parser)
  const idToFilePath = loaded.filePaths
  const uniqueDirty = Array.from(new Set(dirtyIds))
  const uniqueDeleted = Array.from(new Set(deletedIds))

  let saved = 0
  let deleted = 0

  for (const id of uniqueDeleted) {
    const filePath = idToFilePath[id] ?? `${directoryPath}/${id}.json`
    if (await window.electron.fs.exists(filePath)) {
      await window.electron.fs.removeFile(filePath)
      deleted += 1
    }
  }

  for (const id of uniqueDirty) {
    const definition = definitions[id]
    if (!definition) continue
    const filePath = idToFilePath[id] ?? `${directoryPath}/${id}.json`
    await window.electron.fs.writeFile(filePath, `${JSON.stringify(definition, null, 2)}\n`)
    saved += 1
  }

  return { saved, deleted }
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      projectPath: null,
      projectName: null,
      isKimbarProject: false,
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
      dirtyEntityDefinitionIds: [],
      dirtyInteractionDefinitionIds: [],
      deletedEntityDefinitionIds: [],
      deletedInteractionDefinitionIds: [],
      layerGroups: [],
      layerGroupsDirty: false,
      tileActionGroups: [],
      customTileActionGroups: [],
      customTileActionGroupsDirty: false,
      tileActionAssignments: {},
      roomRegistry: [],
      worldLayout: createEmptyLayout(),
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
          const dynamicLayerGroups = deriveDynamicLayerGroups(mapData)
          const persistedLayerGroups = Array.isArray(config.layerGroups)
            ? (config.layerGroups as LayerGroup[]).filter((g) => !isDynamicLayerGroup(g))
            : []
          const defaultLayerGroups = [...persistedLayerGroups, ...dynamicLayerGroups]
          const persistedCustomTileActionGroups = Array.isArray(config.tileActionGroups)
            ? deserializeActionGroups(config.tileActionGroups)
              .filter((group) => !isDefinitionBackedGroupId(group.id))
            : []
          const defaultTileActionGroups = combineTileActionGroups(
            interactionDefinitions,
            entityDefinitions,
            persistedCustomTileActionGroups,
          )

          set({
            projectPath,
            projectName: config.name,
            isKimbarProject: false,
            projectConfig: config,
            tilesets: effectiveTilesets,
            entityDefinitions,
            interactionDefinitions,
            dirtyEntityDefinitionIds: [],
            dirtyInteractionDefinitionIds: [],
            deletedEntityDefinitionIds: [],
            deletedInteractionDefinitionIds: [],
            layerGroups: defaultLayerGroups,
            layerGroupsDirty: false,
            tileActionGroups: defaultTileActionGroups,
            customTileActionGroups: persistedCustomTileActionGroups,
            customTileActionGroupsDirty: false,
            tileActionAssignments: mapData.tileActionAssignments ?? {},
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

          // Scan room files and load world layout for world view
          const store = get()
          void Promise.all([
            store.scanRoomFiles(),
            store.loadWorldLayoutFromDisk(),
          ]).then(() => store.autoImportTiledWorlds())
            .then(() => store.syncDoorConnections())
        } catch (err) {
          console.error('Failed to load project:', err)
          toast.error('Failed to load project')
        }
      },

      // Load the Kimbar project directly (no project.json needed)
      loadKimbarProject: async (kimbarRoot: string) => {
        if (!window.electron) {
          toast.error('Kimbar loading requires Electron')
          return
        }

        try {
          const config = await buildKimbarProjectConfig(kimbarRoot)

          // Load tilesets from config
          const loadedTilesets: LoadedTileset[] = []
          for (const tilesetRef of config.tilesets) {
            const tilesetPath = `${kimbarRoot}/${tilesetRef.file}`
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
              console.log(`[projectStore] Kimbar tileset loaded: ${tilesetRef.id}`)
            } catch (err) {
              console.warn(`[projectStore] Failed to load Kimbar tileset ${tilesetRef.id}:`, err)
            }
          }

          // Load megalevel TMX
          const megalevelPath = getMegalevelPath(kimbarRoot)
          let mapData = DEFAULT_MAP
          let mapPath: string | null = null
          let effectiveTilesets = loadedTilesets

          try {
            const loaded = await loadRoomDataFromFile(megalevelPath, window.electron.fs.readFile)
            mapData = ensureCollisionLayer(loaded.data)
            mapPath = megalevelPath

            // Force all tile layers visible (megalevel.tmx has Floor visible="0")
            mapData = {
              ...mapData,
              layers: mapData.layers.map(layer =>
                layer.type === 'tilelayer' ? { ...layer, visible: true } : layer
              ),
            }

            // Use TMX tileset references if available (preserves correct firstGid mapping)
            if (loaded.tilesets.length > 0) {
              const sortedRoomTilesets = [...loaded.tilesets].sort((a, b) => a.firstGid - b.firstGid)
              const loadedRoomTilesets: LoadedTileset[] = []
              for (const ref of sortedRoomTilesets) {
                try {
                  const ts = await loadTilesetFromPath(
                    {
                      id: ref.id,
                      name: ref.name,
                      sourcePath: ref.sourcePath,
                      tileSize: ref.tileSize,
                      firstGid: ref.firstGid,
                    },
                    window.electron.fs.readFileBase64
                  )
                  loadedRoomTilesets.push(ts)
                } catch (err) {
                  console.warn(`[projectStore] Failed to load Kimbar room tileset "${ref.name}":`, err)
                }
              }
              if (loadedRoomTilesets.length > 0) {
                effectiveTilesets = loadedRoomTilesets
              }
            }

            console.log(`[projectStore] Kimbar megalevel loaded (${loaded.sourceFormat})`)
          } catch (err) {
            console.warn('[projectStore] Failed to load Kimbar megalevel:', err)
            toast.error('Failed to load Kimbar megalevel TMX')
            return
          }

          set({
            projectPath: kimbarRoot,
            projectName: config.name,
            isKimbarProject: true,
            projectConfig: config as unknown as ProjectConfig,
            tilesets: effectiveTilesets,
            entityDefinitions: {},
            interactionDefinitions: {},
            dirtyEntityDefinitionIds: [],
            dirtyInteractionDefinitionIds: [],
            deletedEntityDefinitionIds: [],
            deletedInteractionDefinitionIds: [],
            layerGroups: deriveDynamicLayerGroups(mapData),
            layerGroupsDirty: false,
            tileActionGroups: [],
            customTileActionGroups: [],
            customTileActionGroupsDirty: false,
            tileActionAssignments: mapData.tileActionAssignments ?? {},
            mapData,
            currentRoomPath: mapPath,
            hasUnsavedChanges: false,
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,
          })

          console.log('[projectStore] Kimbar project loaded')
          console.log('[projectStore] Tilesets:', effectiveTilesets.length)

          // Track in recent projects and close selector
          const { addRecentProject, closeProjectSelector } = await import('./uiStore').then(m => m.useUIStore.getState())
          addRecentProject(kimbarRoot, 'Kimbar')
          closeProjectSelector()

          toast.success('Loaded Kimbar project')

          // Initialize character sprite registry
          await initKimbarLinkedProjectAtRoot(kimbarRoot)

          // Scan room files and load world layout
          const store = get()
          void Promise.all([
            store.scanRoomFiles(),
            store.loadWorldLayoutFromDisk(),
          ]).then(() => store.autoImportTiledWorlds())
            .then(() => store.syncDoorConnections())
        } catch (err) {
          console.error('[projectStore] Failed to load Kimbar project:', err)
          toast.error('Failed to load Kimbar project')
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
          const {
            entityDefinitions,
            interactionDefinitions,
            layerGroups,
            customTileActionGroups,
            dirtyEntityDefinitionIds,
            dirtyInteractionDefinitionIds,
            deletedEntityDefinitionIds,
            deletedInteractionDefinitionIds,
            customTileActionGroupsDirty,
            layerGroupsDirty,
          } = get()
          const hasProjectDefinitionChanges =
            customTileActionGroupsDirty ||
            layerGroupsDirty ||
            dirtyEntityDefinitionIds.length > 0 ||
            dirtyInteractionDefinitionIds.length > 0 ||
            deletedEntityDefinitionIds.length > 0 ||
            deletedInteractionDefinitionIds.length > 0
          set({
            mapData,
            tileActionAssignments: mapData.tileActionAssignments ?? {},
            layerGroups: mergeAutoLayerGroups(layerGroups, mapData),
            tileActionGroups: combineTileActionGroups(
              interactionDefinitions,
              entityDefinitions,
              customTileActionGroups,
            ),
            currentRoomPath: mapPath,
            hasUnsavedChanges: hasProjectDefinitionChanges,
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
      saveMap: async (mapDataOverride) => {
        const {
          mapData,
          currentRoomPath,
          projectPath,
          projectConfig,
          entityDefinitions,
          interactionDefinitions,
          dirtyEntityDefinitionIds,
          dirtyInteractionDefinitionIds,
          deletedEntityDefinitionIds,
          deletedInteractionDefinitionIds,
          customTileActionGroups,
          customTileActionGroupsDirty,
          layerGroups,
          layerGroupsDirty,
          tileActionAssignments,
        } = get()
        const sourceMapData = mapDataOverride ?? mapData
        if (!window.electron || !sourceMapData) return

        // Update metadata — include tile action assignments in map data
        const hasAssignments = Object.keys(tileActionAssignments).length > 0
        const updatedMap = {
          ...sourceMapData,
          ...(hasAssignments ? { tileActionAssignments } : {}),
          metadata: {
            ...sourceMapData.metadata,
            editedAt: new Date().toISOString(),
            exportedFrom: 'spudtile',
          },
        }

        let savePath = currentRoomPath
        if (!savePath && projectPath && projectConfig) {
          savePath = `${projectPath}/${projectConfig.paths.maps}/${sourceMapData.id}.json`
        }

        if (savePath) {
          await window.electron.fs.writeFile(savePath, JSON.stringify(updatedMap, null, 2))

          let definitionSaveFailed = false
          let customGroupSaveFailed = false
          let definitionSaveSummary: string | null = null

          if (
            customTileActionGroupsDirty ||
            layerGroupsDirty ||
            dirtyEntityDefinitionIds.length > 0 ||
            dirtyInteractionDefinitionIds.length > 0 ||
            deletedEntityDefinitionIds.length > 0 ||
            deletedInteractionDefinitionIds.length > 0
          ) {
            if (!projectPath || !projectConfig?.paths) {
              definitionSaveFailed = true
              toast.error('Map saved, but definition files could not be resolved')
            } else {
              const normalizedPaths = normalizeProjectAssetPaths(projectConfig.paths)
              const entitiesDir = `${projectPath}/${normalizedPaths.entities}`
              const interactionsDir = `${projectPath}/${normalizedPaths.interactions}`

              if (customTileActionGroupsDirty || layerGroupsDirty) {
                try {
                  const projectJsonPath = `${projectPath}/project.json`
                  let nextProjectConfig: ProjectConfig = projectConfig
                  if (await window.electron.fs.exists(projectJsonPath)) {
                    const rawConfig = await window.electron.fs.readFile(projectJsonPath)
                    nextProjectConfig = JSON.parse(rawConfig) as ProjectConfig
                  }
                  if (customTileActionGroupsDirty) {
                    nextProjectConfig = {
                      ...nextProjectConfig,
                      tileActionGroups: serializeActionGroups(customTileActionGroups),
                    }
                  }
                  if (layerGroupsDirty) {
                    const manualGroups = layerGroups.filter((g) => !isDynamicLayerGroup(g))
                    nextProjectConfig = {
                      ...nextProjectConfig,
                      layerGroups: manualGroups,
                    }
                  }
                  await window.electron.fs.writeFile(projectJsonPath, `${JSON.stringify(nextProjectConfig, null, 2)}\n`)
                  set({ projectConfig: nextProjectConfig })
                } catch (err) {
                  customGroupSaveFailed = true
                  console.error('[projectStore] Failed saving custom tile action groups:', err)
                  toast.error('Map saved, but custom tile action groups failed to save')
                }
              }

              try {
                const [entityResult, interactionResult] = await Promise.all([
                  persistDefinitionChanges(
                    entitiesDir,
                    entityDefinitions,
                    dirtyEntityDefinitionIds,
                    deletedEntityDefinitionIds,
                    parseEntityDefinitionFile,
                  ),
                  persistDefinitionChanges(
                    interactionsDir,
                    interactionDefinitions,
                    dirtyInteractionDefinitionIds,
                    deletedInteractionDefinitionIds,
                    parseInteractionDefinitionFile,
                  ),
                ])

                const totalSaved = entityResult.saved + interactionResult.saved
                const totalDeleted = entityResult.deleted + interactionResult.deleted
                if (totalSaved > 0 || totalDeleted > 0) {
                  definitionSaveSummary = `${totalSaved} definition(s) saved, ${totalDeleted} deleted`
                }
              } catch (err) {
                definitionSaveFailed = true
                console.error('[projectStore] Failed saving definition files:', err)
                toast.error('Map saved, but definition files failed to save')
              }
            }
          }

          set({
            mapData: updatedMap,
            currentRoomPath: savePath,
            hasUnsavedChanges: definitionSaveFailed || customGroupSaveFailed,
            ...((definitionSaveFailed || customGroupSaveFailed)
              ? {}
              : {
                  dirtyEntityDefinitionIds: [],
                  dirtyInteractionDefinitionIds: [],
                  deletedEntityDefinitionIds: [],
                  deletedInteractionDefinitionIds: [],
                  customTileActionGroupsDirty: false,
                  layerGroupsDirty: false,
                }),
          })
          toast.success(
            definitionSaveSummary
              ? `Map saved (${definitionSaveSummary})`
              : 'Map saved!'
          )
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
          let persistedCustomTileActionGroups = get().customTileActionGroups
          if (projectPath && projectConfig?.paths) {
            const normalizedPaths = normalizeProjectAssetPaths(projectConfig.paths)
            const loadedDefinitions = await loadProjectDefinitions(projectPath, normalizedPaths)
            entityDefinitions = loadedDefinitions.entityDefinitions
            interactionDefinitions = loadedDefinitions.interactionDefinitions
            persistedCustomTileActionGroups = await loadPersistedCustomTileActionGroups(projectPath)
          }

          const refreshedMapData = ensureCollisionLayer(loaded.data)
          const previousLayerGroups = get().layerGroups
          set({
            mapData: refreshedMapData,
            tileActionAssignments: refreshedMapData.tileActionAssignments ?? {},
            entityDefinitions,
            interactionDefinitions,
            layerGroups: mergeAutoLayerGroups(previousLayerGroups, refreshedMapData),
            tileActionGroups: combineTileActionGroups(
              interactionDefinitions,
              entityDefinitions,
              persistedCustomTileActionGroups,
            ),
            customTileActionGroups: persistedCustomTileActionGroups,
            hasUnsavedChanges: false,
            dirtyEntityDefinitionIds: [],
            dirtyInteractionDefinitionIds: [],
            deletedEntityDefinitionIds: [],
            deletedInteractionDefinitionIds: [],
            customTileActionGroupsDirty: false,
            layerGroupsDirty: false,
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
          state.mapData = withCollisionSourceConfig(
            state.mapData,
            resolveCollisionSourcesFromMetadata(state.mapData),
          )
          state.layerGroups = mergeAutoLayerGroups(state.layerGroups, state.mapData)
          state.hasUnsavedChanges = true
        })
      },

      deleteLayer: (index) => {
        set((state) => {
          if (state.mapData.layers.length > 1) {
            const removedLayerName = state.mapData.layers[index]?.name
            state.mapData.layers.splice(index, 1)
            if (removedLayerName) {
              for (const group of state.layerGroups) {
                group.layerIds = group.layerIds.filter((layerName) => layerName !== removedLayerName)
              }
              const config = resolveCollisionSourcesFromMetadata(state.mapData)
              if (config.linkedLayerNames.includes(removedLayerName)) {
                state.mapData = withCollisionSourceConfig(state.mapData, {
                  ...config,
                  linkedLayerNames: config.linkedLayerNames.filter((layerName) => layerName !== removedLayerName),
                })
              }
            }
            state.layerGroups = mergeAutoLayerGroups(state.layerGroups, state.mapData)
            state.hasUnsavedChanges = true
          }
        })
      },

      renameLayer: (index, name) => {
        set((state) => {
          if (state.mapData.layers[index]) {
            const previousName = state.mapData.layers[index].name
            state.mapData.layers[index].name = name
            for (const group of state.layerGroups) {
              group.layerIds = group.layerIds.map((layerName) => layerName === previousName ? name : layerName)
            }
            const collisionConfig = resolveCollisionSourcesFromMetadata(state.mapData)
            if (collisionConfig.linkedLayerNames.includes(previousName)) {
              const nextLinked = collisionConfig.linkedLayerNames
                .map((layerName) => (layerName === previousName ? name : layerName))
                .filter((layerName, idx, arr) => arr.indexOf(layerName) === idx)
                .sort((a, b) => a.localeCompare(b))
              state.mapData = withCollisionSourceConfig(state.mapData, {
                ...collisionConfig,
                linkedLayerNames: nextLinked,
              })
            }
            state.layerGroups = mergeAutoLayerGroups(state.layerGroups, state.mapData)
            state.hasUnsavedChanges = true
          }
        })
      },

      setCollisionSourceLayerEnabled: (layerName, enabled) => {
        set((state) => {
          const layer = state.mapData.layers.find((entry) => entry.name === layerName)
          if (!layer || layer.type !== 'tilelayer' || isCollisionLayerName(layer.name)) return

          const config = resolveCollisionSourcesFromMetadata(state.mapData)
          const linked = new Set(config.linkedLayerNames)
          if (enabled) {
            linked.add(layerName)
          } else {
            linked.delete(layerName)
          }

          state.mapData = withCollisionSourceConfig(state.mapData, {
            ...config,
            linkedLayerNames: Array.from(linked).sort((a, b) => a.localeCompare(b)),
          })
          state.hasUnsavedChanges = true
        })
      },

      setCollisionDerivedOverlayVisible: (visible) => {
        set((state) => {
          const config = resolveCollisionSourcesFromMetadata(state.mapData)
          state.mapData = withCollisionSourceConfig(state.mapData, {
            ...config,
            showDerivedOverlay: visible,
          })
          state.hasUnsavedChanges = true
        })
      },

      setCollisionStrategy: (strategy) => {
        set((state) => {
          const config = resolveCollisionSourcesFromMetadata(state.mapData)
          let linkedLayerNames: string[]
          let showDerivedOverlay: boolean
          if (strategy === 'manual') {
            linkedLayerNames = []
            showDerivedOverlay = false
          } else if (strategy === 'auto_walls') {
            linkedLayerNames = getAutoWallsLinkedLayers(state.mapData)
            showDerivedOverlay = true
          } else {
            linkedLayerNames = config.linkedLayerNames
            showDerivedOverlay = config.showDerivedOverlay
          }
          state.mapData = withCollisionSourceConfig(state.mapData, {
            linkedLayerNames,
            showDerivedOverlay,
            strategy,
          })
          state.hasUnsavedChanges = true
        })
      },

      // Entity operations
      placeEntity: (entity) => {
        set((state) => {
          const entityLayer = state.mapData.layers.find((layer) => layer.type === 'objectgroup')
          if (entityLayer) {
            if (!entityLayer.objects) entityLayer.objects = []
            entityLayer.objects.push(entity)
            state.hasUnsavedChanges = true
          }
        })
      },

      updateEntity: (id, updates) => {
        set((state) => {
          for (const layer of state.mapData.layers) {
            if (layer.type !== 'objectgroup' || !layer.objects) continue
            const entity = layer.objects.find((candidate) => candidate.id === id)
            if (entity) {
              Object.assign(entity, updates)
              state.hasUnsavedChanges = true
              break
            }
          }
        })
      },

      moveEntity: (id, x, y) => {
        get().updateEntity(id, { x, y })
      },

      deleteEntity: (id) => {
        set((state) => {
          for (const layer of state.mapData.layers) {
            if (layer.type !== 'objectgroup' || !layer.objects) continue
            const nextObjects = layer.objects.filter((candidate) => candidate.id !== id)
            if (nextObjects.length !== layer.objects.length) {
              layer.objects = nextObjects
              state.hasUnsavedChanges = true
              break
            }
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
          state.layerGroupsDirty = true
          state.hasUnsavedChanges = true
        })
      },

      deleteLayerGroup: (id: string) => {
        set((state) => {
          state.layerGroups = state.layerGroups.filter((g) => g.id !== id)
          state.layerGroupsDirty = true
          state.hasUnsavedChanges = true
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
          state.layerGroupsDirty = true
          state.hasUnsavedChanges = true
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
          state.layerGroupsDirty = true
          state.hasUnsavedChanges = true
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
          syncInteractionDefinitionFromActionGroup(group, state.interactionDefinitions)
          syncEntityDefinitionFromActionGroup(group, state.entityDefinitions)
          if (isInteractionGroupId(group.id)) {
            const interactionId = group.id.slice('interaction:'.length)
            if (interactionId && state.interactionDefinitions[interactionId]) {
              addUniqueId(state.dirtyInteractionDefinitionIds, interactionId)
              removeId(state.deletedInteractionDefinitionIds, interactionId)
              state.hasUnsavedChanges = true
            }
          }
          if (isEntityGroupId(group.id)) {
            const entityId = group.id.slice('entity:'.length)
            if (entityId && state.entityDefinitions[entityId]) {
              addUniqueId(state.dirtyEntityDefinitionIds, entityId)
              removeId(state.deletedEntityDefinitionIds, entityId)
              state.hasUnsavedChanges = true
            }
          }
          if (!isDefinitionBackedGroupId(group.id)) {
            state.customTileActionGroups.push(group)
            state.customTileActionGroupsDirty = true
            state.hasUnsavedChanges = true
          }
        })
      },

      updateTileActionGroup: (id: string, updates: Partial<TileActionGroup>) => {
        set((state) => {
          const idx = state.tileActionGroups.findIndex((g) => g.id === id)
          if (idx !== -1) {
            Object.assign(state.tileActionGroups[idx], updates)
            syncInteractionDefinitionFromActionGroup(state.tileActionGroups[idx], state.interactionDefinitions)
            syncEntityDefinitionFromActionGroup(state.tileActionGroups[idx], state.entityDefinitions)
            if (isInteractionGroupId(id)) {
              const interactionId = id.slice('interaction:'.length)
              if (interactionId && state.interactionDefinitions[interactionId]) {
                addUniqueId(state.dirtyInteractionDefinitionIds, interactionId)
                removeId(state.deletedInteractionDefinitionIds, interactionId)
                state.hasUnsavedChanges = true
              }
            }
            if (isEntityGroupId(id)) {
              const entityId = id.slice('entity:'.length)
              if (entityId && state.entityDefinitions[entityId]) {
                addUniqueId(state.dirtyEntityDefinitionIds, entityId)
                removeId(state.deletedEntityDefinitionIds, entityId)
                state.hasUnsavedChanges = true
              }
            }
            if (!isDefinitionBackedGroupId(id)) {
              const customIdx = state.customTileActionGroups.findIndex((group) => group.id === id)
              if (customIdx !== -1) {
                Object.assign(state.customTileActionGroups[customIdx], updates)
                state.customTileActionGroupsDirty = true
                state.hasUnsavedChanges = true
              }
            }
          }
        })
      },

      deleteTileActionGroup: (id: string) => {
        set((state) => {
          state.tileActionGroups = state.tileActionGroups.filter((g) => g.id !== id)
          if (isInteractionGroupId(id)) {
            const interactionId = id.slice('interaction:'.length)
            if (interactionId && state.interactionDefinitions[interactionId]) {
              delete state.interactionDefinitions[interactionId]
              addUniqueId(state.deletedInteractionDefinitionIds, interactionId)
              removeId(state.dirtyInteractionDefinitionIds, interactionId)
              state.hasUnsavedChanges = true
            }
          }
          if (!isDefinitionBackedGroupId(id)) {
            const beforeCount = state.customTileActionGroups.length
            state.customTileActionGroups = state.customTileActionGroups.filter((group) => group.id !== id)
            if (state.customTileActionGroups.length !== beforeCount) {
              state.customTileActionGroupsDirty = true
              state.hasUnsavedChanges = true
            }
          }
        })
      },

      // ============== Tile Action Assignments ==============

      assignTileAction: (layerName: string, x: number, y: number, actionGroupId: string) => {
        set((state) => {
          const key = `${layerName}:${x}:${y}`
          state.tileActionAssignments[key] = { actionGroupId }
          state.hasUnsavedChanges = true
        })
      },

      removeTileAction: (layerName: string, x: number, y: number) => {
        set((state) => {
          const key = `${layerName}:${x}:${y}`
          delete state.tileActionAssignments[key]
          state.hasUnsavedChanges = true
        })
      },

      clearTileActionsForLayer: (layerName: string) => {
        set((state) => {
          const prefix = `${layerName}:`
          for (const key of Object.keys(state.tileActionAssignments)) {
            if (key.startsWith(prefix)) {
              delete state.tileActionAssignments[key]
            }
          }
          state.hasUnsavedChanges = true
        })
      },

      // ============== Room Registry / World Layout ==============

      scanRoomFiles: async () => {
        const { projectPath, projectConfig } = get()
        if (!window.electron || !projectPath || !projectConfig?.paths) return

        const normalizedPaths = normalizeProjectAssetPaths(projectConfig.paths)
        const mapsDir = `${projectPath}/${normalizedPaths.maps}`

        try {
          const exists = await window.electron.fs.exists(mapsDir)
          if (!exists) {
            set({ roomRegistry: [] })
            return
          }

          const entries = await window.electron.fs.readDir(mapsDir)
          const roomFiles: RoomFileEntry[] = entries
            .filter((entry) => !entry.isDirectory)
            .filter((entry) => /\.(tmx|json|ldtk)$/i.test(entry.name))
            .map((entry) => {
              const dotIndex = entry.name.lastIndexOf('.')
              const baseName = dotIndex > 0 ? entry.name.slice(0, dotIndex) : entry.name
              const ext = dotIndex > 0 ? entry.name.slice(dotIndex + 1).toLowerCase() : ''
              return {
                id: baseName,
                name: baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                filePath: `${mapsDir}/${entry.name}`,
                format: ext,
              }
            })
            .sort((a, b) => a.id.localeCompare(b.id))

          set({ roomRegistry: roomFiles })
          console.log(`[projectStore] Scanned ${roomFiles.length} room files in ${mapsDir}`)
        } catch (err) {
          console.warn('[projectStore] Failed to scan room files:', err)
          set({ roomRegistry: [] })
        }
      },

      loadWorldLayoutFromDisk: async () => {
        const { projectPath } = get()
        if (!projectPath) return
        const layout = await loadWorldLayout(projectPath)
        set({ worldLayout: layout })
      },

      saveWorldLayoutToDisk: async () => {
        const { projectPath, worldLayout } = get()
        if (!projectPath) return
        await saveWorldLayout(projectPath, worldLayout)
      },

      syncDoorConnections: async () => {
        const { roomRegistry, worldLayout } = get()
        if (!window.electron || roomRegistry.length === 0) return

        const roomIds = new Set(roomRegistry.map((r) => r.id))
        const autoConnections: DoorConnection[] = []

        for (const room of roomRegistry) {
          try {
            const result = await loadRoomDataFromFile(room.filePath, window.electron.fs.readFile)
            const doors = extractDoors(result.data)

            for (const door of doors) {
              if (!door.targetRoom || !roomIds.has(door.targetRoom)) continue

              autoConnections.push({
                id: `auto:${room.id}:${door.entityId}`,
                sourceRoomId: room.id,
                sourceEntityId: door.entityId,
                targetRoomId: door.targetRoom,
                targetEntityId: door.targetEntityId,
                connectionType: door.entityType,
              })
            }
          } catch (err) {
            console.warn(`[projectStore] Failed to extract doors from ${room.id}:`, err)
          }
        }

        // Merge: keep manual connections (no auto: prefix), replace all auto connections
        set((state) => {
          const manualConnections = state.worldLayout.connections.filter(
            (c) => !c.id.startsWith('auto:')
          )
          state.worldLayout.connections = [...manualConnections, ...autoConnections]
        })

        // Persist the merged layout
        const store = get()
        await saveWorldLayout(store.projectPath!, store.worldLayout)
        console.log(`[projectStore] Synced ${autoConnections.length} auto door connections`)
      },

      importTiledWorldFile: async (worldFilePath: string) => {
        if (!window.electron?.fs) return 0

        try {
          const content = await window.electron.fs.readFile(worldFilePath)
          const { roomRegistry } = get()
          const knownIds = new Set(roomRegistry.map((r) => r.id))
          const positions = importTiledWorldPositions(content, knownIds)

          if (positions.length === 0) return 0

          set((state) => {
            for (const pos of positions) {
              setRoomPosition(state.worldLayout, pos.roomId, pos.x, pos.y)
            }
          })

          const store = get()
          await saveWorldLayout(store.projectPath!, store.worldLayout)
          console.log(`[projectStore] Imported ${positions.length} room positions from ${worldFilePath}`)
          return positions.length
        } catch (err) {
          console.warn('[projectStore] Failed to import .world file:', err)
          return 0
        }
      },

      autoImportTiledWorlds: async () => {
        const { projectPath, worldLayout } = get()
        if (!projectPath) return

        // Skip if we already have saved room positions
        if (worldLayout.rooms.length > 0) return

        const worldFiles = await findWorldFiles(projectPath)
        if (worldFiles.length === 0) return

        let totalImported = 0
        const store = get()
        for (const wf of worldFiles) {
          const count = await store.importTiledWorldFile(wf)
          totalImported += count
        }

        if (totalImported > 0) {
          console.log(`[projectStore] Auto-imported ${totalImported} room positions from ${worldFiles.length} .world file(s)`)
        }
      },

      updateRoomPosition: (roomId: string, x: number, y: number) => {
        set((state) => {
          setRoomPosition(state.worldLayout, roomId, x, y)
        })
      },

      addDoorConnection: (connection: DoorConnection) => {
        set((state) => {
          addConnection(state.worldLayout, connection)
        })
      },

      removeDoorConnection: (connectionId: string) => {
        set((state) => {
          removeConnection(state.worldLayout, connectionId)
        })
      },

      openRoom: async (roomId: string) => {
        const { roomRegistry } = get()
        const entry = roomRegistry.find((r) => r.id === roomId)
        if (!entry) {
          toast.error(`Room not found: ${roomId}`)
          return
        }

        if (!window.electron) return

        try {
          const loaded = await loadRoomDataFromFile(entry.filePath, window.electron.fs.readFile)
          const mapData = ensureCollisionLayer(loaded.data)

          const {
            entityDefinitions,
            interactionDefinitions,
            customTileActionGroups,
            layerGroups,
          } = get()

          set({
            mapData,
            currentRoomPath: entry.filePath,
            layerGroups: mergeAutoLayerGroups(layerGroups, mapData),
            tileActionGroups: combineTileActionGroups(
              interactionDefinitions,
              entityDefinitions,
              customTileActionGroups,
            ),
            hasUnsavedChanges: false,
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,
          })

          // Exit world view and open room in normal editor
          const { exitWorldView } = await import('./editorStore').then(m => m.useEditorStore.getState())
          exitWorldView()

          toast.success(`Opened room: ${entry.name}`)
        } catch (err) {
          console.error(`[projectStore] Failed to open room ${roomId}:`, err)
          toast.error(`Failed to open room: ${roomId}`)
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
export const useLayerGroups = () => useProjectStore((s) => s.layerGroups)
export const useTileActionGroups = () => useProjectStore((s) => s.tileActionGroups)
export const useRoomRegistry = () => useProjectStore((s) => s.roomRegistry)
export const useWorldLayout = () => useProjectStore((s) => s.worldLayout)
