/**
 * SpudTile Main App
 *
 * UX patterns stolen from:
 * - Tiled: Resizable panels, stamp brushes, undo/redo
 * - LDtk: Modern state management, visual polish
 * - Ogmo: Layer organization
 * - YATE: Tileset organization
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Moon,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  Package,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RefreshCw,
  Redo2,
  Save,
  SlidersHorizontal,
  SwatchBook,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type { EntityInstance, LayerInstance, Level, TileInstance } from '@/lib/ldtk'
import { DEBUG_TILESET_ID, type EntityData, type Layer, type LevelData, type LoadedTileset, type TileStamp } from '@/lib/types'
import {
  hasTileFlipXFlag,
  hasTileFlipYFlag,
  resolveTileId,
  setTileFlipFlags,
  stripTileFlipFlags,
} from '@/lib/tileset'
import { loadRoomDataFromContent } from '@/lib/room-loader'
import { resolveCollisionSourcesFromMetadata } from '@/lib/collision-model'
import { syncMapDataWithLevelEdits } from '@/lib/map-sync'
import { ToolPalette } from '@/components/ToolPalette'
import { TilesetPanel } from '@/components/TilesetPanel'
import { LevelCanvas } from '@/components/LevelCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { LayerPanel } from '@/components/LayerPanel'
import { EntityPalette } from '@/components/EntityPalette'
import { TilesetImportDialog, TilesetImportResult } from '@/components/TilesetImportDialog'
import { AgentPanel } from '@/components/AgentPanel'
import { RunTestOverlay } from '@/components/RunTestOverlay'
import { ProjectSelector } from '@/components/ProjectSelector'
import { NewProjectWizard } from '@/components/NewProjectWizard'
import { GamePreview } from '@/components/GamePreview'
import { TileActionsPanel } from '@/components/TileActionsPanel'
import { BakeTilesetDialog } from '@/components/BakeTilesetDialog'
import { WorldViewCanvas as SpudWorldViewCanvas } from '@/components/WorldViewCanvas'
import { WorldMinimap } from '@/components/WorldMinimap'
import { ToolContextBar } from '@/components/ToolContextBar'
import { getFileSystemAdapter } from '@/lib/fs-adapter'
import { deserializeBakedTileset } from '@/lib/tileset-baker'
import { Toaster, toast } from 'sonner'
import { NotificationContainer } from '@/components/Notification'
import { DialogContainer } from '@/components/Dialog'
import { useEditorStore, useProjectStore, useUIStore } from '@/stores'
import { detectKimbarRoot } from '@/lib/kimbar/registry'
import { useToolStore } from '@/stores/toolStore'
import { useLdtkToolStore } from '@/stores/ldtkToolStore'
import { useFileWatcher, type FileWatcherChange } from '@/hooks/useFileWatcher'

// CSS for resize handles
import './styles/panels.css'

const DEFAULT_BG_COLOR = '#1f2430'
const DEFAULT_ENTITY_COLOR = '#8aa4ff'

const DEFAULT_STAMP: TileStamp = {
  width: 1,
  height: 1,
  tiles: [[1]],
  tilesetId: null,
}

function getPreferredTileset(tilesets: LoadedTileset[]): LoadedTileset | null {
  if (tilesets.length === 0) return null
  const firstNonDebug = tilesets.find((tileset) => tileset.id !== DEBUG_TILESET_ID)
  return firstNonDebug ?? tilesets[0]
}

function buildTileInstances(
  mapData: LevelData,
  layer: Layer,
  tilesets: LoadedTileset[],
): TileInstance[] {
  if (!layer.data) return []
  const tiles: TileInstance[] = []

  for (let index = 0; index < layer.data.length; index += 1) {
    const rawTileId = layer.data[index]
    const baseTileId = stripTileFlipFlags(rawTileId)
    if (baseTileId <= 0) continue

    const resolved = resolveTileId(baseTileId, tilesets)
    if (!resolved) continue

    const localTileId = resolved.localTileId
    const col = localTileId % resolved.tileset.tilesPerRow
    const row = Math.floor(localTileId / resolved.tileset.tilesPerRow)
    const x = index % mapData.width
    const y = Math.floor(index / mapData.width)

    tiles.push({
      t: baseTileId,
      px: [x * mapData.tileSize, y * mapData.tileSize],
      src: [col * resolved.tileset.tileSize, row * resolved.tileset.tileSize],
      f: (hasTileFlipXFlag(rawTileId) ? 1 : 0) | (hasTileFlipYFlag(rawTileId) ? 2 : 0),
      a: 1,
    })
  }

  return tiles
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  npc: '#60a5fa',         // blue
  spawn_point: '#4ade80', // green
  door: '#fb923c',        // orange
  portal: '#fb923c',      // orange
  stairs: '#fb923c',      // orange
  ladder: '#fb923c',      // orange
  trigger: '#c084fc',     // purple
  prop: '#94a3b8',        // slate
}

function entityDisplayLabel(entity: { id: string; type: string; properties: Record<string, unknown> }): string {
  const typeName = entity.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const charId = entity.properties.characterId as string | undefined
  const name = entity.properties.name as string | undefined
  if (charId) return `${typeName}: ${charId}`
  if (name) return `${typeName}: ${name}`
  return `${typeName} [${entity.id}]`
}

function buildEntityInstances(layer: Layer, tileSize: number): EntityInstance[] {
  if (!layer.objects) return []
  return layer.objects.map((entity, index) => ({
    iid: entity.id || `${layer.name}-${index}`,
    defUid: 0,
    __identifier: entityDisplayLabel(entity),
    __grid: [Math.floor(entity.x / tileSize), Math.floor(entity.y / tileSize)],
    px: [entity.x, entity.y],
    width: entity.width,
    height: entity.height,
    __pivot: [0, 0],
    __worldX: entity.x,
    __worldY: entity.y,
    __tags: [],
    __tile: null,
    __smartColor: ENTITY_TYPE_COLORS[entity.type] || DEFAULT_ENTITY_COLOR,
    fieldInstances: [],
  }))
}

function buildLdtkLevel(mapData: LevelData, tilesets: LoadedTileset[]): Level {
  const tileSize = mapData.tileSize
  const layerInstances: LayerInstance[] = mapData.layers.map((layer, index) => {
    const isEntityLayer = layer.type === 'objectgroup'
    const tilesetPath = null

    return {
      iid: `${mapData.id}-${layer.name}`,
      layerDefUid: index + 1,
      __identifier: layer.name,
      __type: isEntityLayer ? 'Entities' : 'Tiles',
      levelId: 1,
      __gridSize: tileSize,
      __opacity: layer.opacity ?? 1,
      __pxTotalOffsetX: 0,
      __pxTotalOffsetY: 0,
      __tilesetDefUid: null,
      __tilesetRelPath: tilesetPath,
      __cWid: mapData.width,
      __cHei: mapData.height,
      intGridCsv: new Array(mapData.width * mapData.height).fill(0),
      autoLayerTiles: [],
      gridTiles: isEntityLayer
        ? []
        : buildTileInstances(mapData, layer, tilesets),
      entityInstances: isEntityLayer ? buildEntityInstances(layer, tileSize) : [],
      seed: 0,
      overrideTilesetUid: null,
      visible: layer.visible,
      optionalRules: [],
      pxOffsetX: 0,
      pxOffsetY: 0,
    }
  })

  return {
    uid: 1,
    iid: mapData.id,
    identifier: mapData.id,
    worldX: 0,
    worldY: 0,
    worldDepth: 0,
    pxWid: mapData.width * tileSize,
    pxHei: mapData.height * tileSize,
    __bgColor: DEFAULT_BG_COLOR,
    bgColor: null,
    bgRelPath: null,
    bgPos: null,
    bgPivotX: 0.5,
    bgPivotY: 0.5,
    externalRelPath: null,
    useAutoIdentifier: false,
    layerInstances,
    fieldInstances: [],
    __neighbours: [],
    __smartColor: DEFAULT_BG_COLOR,
  }
}

function findEntityById(mapData: LevelData, entityId: string | null): EntityData | null {
  if (!entityId) return null
  return (
    mapData.layers
      .filter((layer) => layer.type === 'objectgroup')
      .flatMap((layer) => layer.objects ?? [])
      .find((entity) => entity.id === entityId) ?? null
  )
}

function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase()
}

function getDirectoryFromPath(filePath: string | null): string | null {
  if (!filePath) return null
  const slashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (slashIndex <= 0) return null
  return filePath.slice(0, slashIndex)
}

function shouldRefreshForExternalChange(
  changedPath: string,
  currentRoomPath: string,
  tilesets: LoadedTileset[]
): boolean {
  const normalizedChanged = normalizePathForCompare(changedPath)
  const normalizedRoomPath = normalizePathForCompare(currentRoomPath)
  if (normalizedChanged === normalizedRoomPath) return true

  const watchedTilesetPaths = tilesets
    .filter((tileset) => tileset.sourcePath !== 'procedural')
    .map((tileset) => normalizePathForCompare(tileset.sourcePath))
  if (watchedTilesetPaths.includes(normalizedChanged)) return true

  if (
    normalizedChanged.endsWith('/project.json') ||
    normalizedChanged.endsWith('/spudtile.config.json') ||
    normalizedChanged.endsWith('/prairiebob.config.json')
  ) {
    return true
  }

  const extensionMatch = /\.([a-z0-9]+)$/.exec(normalizedChanged)
  const extension = extensionMatch?.[1] ?? ''
  const isMapFile = extension === 'json' || extension === 'ldtk' || extension === 'tmx' || extension === 'tsx'
  const isImageFile = extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'gif' || extension === 'webp'

  if (normalizedChanged.includes('/maps/') && isMapFile) return true
  if (normalizedChanged.includes('/entities/') && extension === 'json') return true
  if (normalizedChanged.includes('/tilesets/') && (isMapFile || isImageFile)) return true

  return false
}

function applyFlipToTileId(tileId: number, flipX: boolean, flipY: boolean): number {
  if (tileId <= 0) return tileId
  return setTileFlipFlags(tileId, flipX, flipY)
}

function applyFlipToStamp(stamp: TileStamp, flipX: boolean, flipY: boolean): TileStamp {
  return {
    ...stamp,
    tiles: stamp.tiles.map((row) => row.map((tileId) => applyFlipToTileId(tileId, flipX, flipY))),
  }
}

function getPanelSizePercent(panelSize: unknown, fallback: number): number {
  let next: number | null = null
  if (typeof panelSize === 'number' && Number.isFinite(panelSize)) {
    next = panelSize
  }
  if (next === null && typeof panelSize === 'object' && panelSize !== null) {
    const maybe = panelSize as {
      asPercentage?: number
      inPercentage?: number
      percentage?: number
      size?: number
      value?: number
    }
    const candidates = [maybe.asPercentage, maybe.inPercentage, maybe.percentage, maybe.size, maybe.value]
    next = candidates.find((value) => typeof value === 'number' && Number.isFinite(value)) ?? null
  }
  if (next === null) {
    next = fallback
  }
  if (next > 0 && next <= 1) {
    next *= 100
  }
  if (next > 100) {
    // Guard against stale pixel-like values accidentally fed into percent-based APIs.
    next = fallback
  }
  if (!Number.isFinite(next)) {
    return fallback
  }
  return Math.min(Math.max(next, 5), 95)
}

function clampPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function normalizePanelPercent(value: unknown, fallback: number, min: number, max: number): number {
  return clampPercent(getPanelSizePercent(value, fallback), min, max)
}

function asPercent(value: number): string {
  // react-resizable-panels v4 interprets numeric sizes as pixels; use explicit percent strings.
  return `${value}%`
}

function App() {
  const [tileStamp, setTileStamp] = useState<TileStamp>(DEFAULT_STAMP)
  const [isRunTestOpen, setIsRunTestOpen] = useState(false)
  const [isBakeDialogOpen, setIsBakeDialogOpen] = useState(false)
  const [inspectorPropertiesCollapsed, setInspectorPropertiesCollapsed] = useState(true)

  const previewMode = useEditorStore((s) => s.previewMode)
  const enterPreview = useEditorStore((s) => s.enterPreview)
  const exitPreview = useEditorStore((s) => s.exitPreview)
  const worldViewMode = useEditorStore((s) => s.worldViewMode)
  const toggleWorldView = useEditorStore((s) => s.toggleWorldView)
  const exitWorldView = useEditorStore((s) => s.exitWorldView)
  const roomRegistry = useProjectStore((s) => s.roomRegistry)

  const {
    activeTilesetId,
    activeLayerIndex,
    selectedEntityId,
    setActiveTilesetId,
    setActiveLayerIndex,
    setSelectedEntityId,
  } = useEditorStore()

  const {
    projectPath,
    currentRoomPath,
    mapData,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    tilesets,
    projectName,
    undo,
    redo,
    setMapData,
    setCurrentRoomPath,
    setHasUnsavedChanges,
    refreshCurrentRoomFromDisk,
    toggleLayerVisible,
    toggleLayerLocked,
    setLayerOpacity,
    reorderLayers,
    addLayer,
    deleteLayer,
    renameLayer,
    setCollisionSourceLayerEnabled,
    setCollisionDerivedOverlayVisible,
    paintTiles,
    fillArea,
    placeEntity,
    updateEntity,
    deleteEntity,
    initTilesets,
    addTileset,
    loadRoomTilesets,
    removeTileset,
    saveMap,
    loadProject,
  } = useProjectStore()

  // Keep these selectors separate to avoid runtime regressions from partial/stale store object destructuring.
  const layerGroups = useProjectStore((state) => state.layerGroups)
  const createLayerGroup = useProjectStore((state) => state.createLayerGroup)
  const deleteLayerGroup = useProjectStore((state) => state.deleteLayerGroup)
  const moveLayerToGroup = useProjectStore((state) => state.moveLayerToGroup)
  const toggleGroupVisibility = useProjectStore((state) => state.toggleGroupVisibility)
  const toggleGroupLock = useProjectStore((state) => state.toggleGroupLock)
  const toggleGroupCollapsed = useProjectStore((state) => state.toggleGroupCollapsed)
  const tileActionGroups = useProjectStore((state) => state.tileActionGroups)
  const addTileActionGroup = useProjectStore((state) => state.addTileActionGroup)
  const updateTileActionGroup = useProjectStore((state) => state.updateTileActionGroup)
  const deleteTileActionGroup = useProjectStore((state) => state.deleteTileActionGroup)

  const {
    panels,
    theme,
    tilesetZoom,
    importDialogOpen,
    pendingImportPath,
    openProjectSelector,
    openImportDialog,
    closeImportDialog,
    setPanelSize,
    setTheme,
    togglePanelCollapsed,
    setTilesetZoom,
    resetPanelLayout,
  } = useUIStore()

  // Use individual selectors to avoid creating new objects every render
  const selectedTileId = useToolStore((s) => s.selectedTileId)
  const tileFlipX = useToolStore((s) => s.tileFlipX)
  const tileFlipY = useToolStore((s) => s.tileFlipY)
  const zoom = useToolStore((s) => s.zoom)
  const setZoom = useToolStore((s) => s.setZoom)
  const resetViewport = useToolStore((s) => s.resetViewport)
  const setSelectedTileId = useToolStore((s) => s.setSelectedTileId)
  const setTileFlipX = useToolStore((s) => s.setTileFlipX)
  const setTileFlipY = useToolStore((s) => s.setTileFlipY)
  const setActiveLayer = useToolStore((s) => s.setActiveLayer)
  const setSelectedIntGridValue = useToolStore((s) => s.setSelectedIntGridValue)

  const activeToolId = useLdtkToolStore((state) => state.activeToolId)
  const undoCount = useProjectStore((state) => state.past.length)
  const redoCount = useProjectStore((state) => state.future.length)

  const fsAdapter = getFileSystemAdapter()
  const level = useMemo(() => buildLdtkLevel(mapData, tilesets), [mapData, tilesets])
  const effectiveTileId = selectedTileId ?? tilesets[0]?.firstGid ?? 1
  const effectiveBaseTileId = stripTileFlipFlags(effectiveTileId)
  const collisionSourceConfig = useMemo(
    () => resolveCollisionSourcesFromMetadata(mapData),
    [mapData]
  )

  const LEFT_MIN = 24
  const LEFT_MAX = 60
  const RIGHT_MIN = 22
  const RIGHT_MAX = 60
  const BOTTOM_MIN = 8
  const BOTTOM_MAX = 60

  const leftPanelOpen = !panels.left.collapsed
  const rightPanelOpen = !panels.right.collapsed
  const bottomPanelOpen = !panels.bottom.collapsed
  const leftPanelDefaultSize = normalizePanelPercent(panels.left.size, 26, LEFT_MIN, 45)
  const leftPanelMinSize = LEFT_MIN
  const leftPanelMaxSize = normalizePanelPercent(panels.left.maxSize, 45, leftPanelMinSize, LEFT_MAX)
  const rightPanelDefaultSize = normalizePanelPercent(panels.right.size, 25, RIGHT_MIN, 45)
  const rightPanelMinSize = RIGHT_MIN
  const rightPanelMaxSize = normalizePanelPercent(panels.right.maxSize, 45, rightPanelMinSize, RIGHT_MAX)
  const bottomPanelDefaultSize = normalizePanelPercent(panels.bottom.size, 24, 12, 45)
  const bottomPanelMinSize = BOTTOM_MIN
  const bottomPanelMaxSize = normalizePanelPercent(panels.bottom.maxSize, 45, bottomPanelMinSize, BOTTOM_MAX)
  const resolvedTheme = useMemo<'dark' | 'light'>(() => {
    if (theme === 'light' || theme === 'dark') return theme
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    }
    return 'dark'
  }, [theme])
  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])
  const handleLeftPanelResize = useCallback((panelSize: unknown) => {
    const size = normalizePanelPercent(panelSize, leftPanelDefaultSize, leftPanelMinSize, leftPanelMaxSize)
    setPanelSize('left', Number(size.toFixed(2)))
  }, [setPanelSize, leftPanelDefaultSize, leftPanelMinSize, leftPanelMaxSize])
  const handleRightPanelResize = useCallback((panelSize: unknown) => {
    const size = normalizePanelPercent(panelSize, rightPanelDefaultSize, rightPanelMinSize, rightPanelMaxSize)
    setPanelSize('right', Number(size.toFixed(2)))
  }, [setPanelSize, rightPanelDefaultSize, rightPanelMinSize, rightPanelMaxSize])
  const handleBottomPanelResize = useCallback((panelSize: unknown) => {
    const size = normalizePanelPercent(panelSize, bottomPanelDefaultSize, bottomPanelMinSize, bottomPanelMaxSize)
    setPanelSize('bottom', Number(size.toFixed(2)))
  }, [setPanelSize, bottomPanelDefaultSize, bottomPanelMinSize, bottomPanelMaxSize])

  useEffect(() => {
    const leftSize = getPanelSizePercent(panels.left.size, leftPanelDefaultSize)
    const rightSize = getPanelSizePercent(panels.right.size, rightPanelDefaultSize)

    let repaired = false
    if (leftSize < leftPanelMinSize - 0.5) {
      setPanelSize('left', leftPanelDefaultSize)
      repaired = true
    }
    if (rightSize < rightPanelMinSize - 0.5) {
      setPanelSize('right', rightPanelDefaultSize)
      repaired = true
    }

    if (repaired) {
      toast.info('Layout was auto-repaired after invalid panel sizing.')
    }
  }, [
    panels.left.size,
    panels.right.size,
    leftPanelDefaultSize,
    rightPanelDefaultSize,
    leftPanelMinSize,
    rightPanelMinSize,
    setPanelSize,
  ])

  // Guard against multiple initTilesets calls
  const tilesetsInitRef = useRef(false)
  const autoSelectedNonDebugTilesetRef = useRef(false)
  const externalChangeNoticeShownRef = useRef(false)

  // Effect: Initialize tilesets if empty
  useEffect(() => {
    if (tilesets.length === 0 && !tilesetsInitRef.current) {
      tilesetsInitRef.current = true
      initTilesets()
    }
  }, [tilesets.length, initTilesets])

  // Effect: Auto-load Kimbar project at startup if enabled
  const kimbarAutoLoadAttemptedRef = useRef(false)
  useEffect(() => {
    if (kimbarAutoLoadAttemptedRef.current) return
    const { autoLoadKimbar } = useUIStore.getState()
    if (!autoLoadKimbar) return
    kimbarAutoLoadAttemptedRef.current = true

    const { loadKimbarProject } = useProjectStore.getState()
    void (async () => {
      try {
        if (!window.electron?.app?.getPaths) return
        const paths = await window.electron.app.getPaths()
        const kimbarRoot = await detectKimbarRoot(paths.appPath) ?? await detectKimbarRoot(paths.resourcesPath)
        if (kimbarRoot) {
          await loadKimbarProject(kimbarRoot)
        }
      } catch (err) {
        console.warn('[App] Kimbar auto-load failed:', err)
      }
    })()
  }, [])

  // Pick a default tileset/tile with non-debug preference when available
  useEffect(() => {
    const defaultTileset = getPreferredTileset(tilesets)
    if (!defaultTileset) return
    const hasActiveTileset = !!activeTilesetId && tilesets.some((ts) => ts.id === activeTilesetId)

    let nextTileset: LoadedTileset | null = null

    if (!hasActiveTileset) {
      nextTileset = defaultTileset
    } else if (
      !autoSelectedNonDebugTilesetRef.current &&
      activeTilesetId === DEBUG_TILESET_ID &&
      defaultTileset.id !== DEBUG_TILESET_ID
    ) {
      // Promote from debug tileset once when a real tileset appears.
      nextTileset = defaultTileset
      autoSelectedNonDebugTilesetRef.current = true
    }

    if (!nextTileset) return

    setActiveTilesetId(nextTileset.id)

    if (selectedTileId === null || activeTilesetId === DEBUG_TILESET_ID) {
      const nextTileId = applyFlipToTileId(nextTileset.firstGid, tileFlipX, tileFlipY)
      setSelectedTileId(nextTileId)
      setTileStamp({
        width: 1,
        height: 1,
        tiles: [[nextTileId]],
        tilesetId: nextTileset.id,
      })
    }
  }, [
    tilesets,
    activeTilesetId,
    selectedTileId,
    tileFlipX,
    tileFlipY,
    setActiveTilesetId,
    setSelectedTileId,
  ])

  // Sync active layer name to tool store — only when layer index changes
  const activeLayerName = level.layerInstances[activeLayerIndex]?.__identifier
  useEffect(() => {
    if (activeLayerName) {
      setActiveLayer(activeLayerName)
    }
  }, [activeLayerName, setActiveLayer])

  useEffect(() => {
    fsAdapter.setUnsavedChanges(hasUnsavedChanges)
  }, [hasUnsavedChanges, fsAdapter])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      externalChangeNoticeShownRef.current = false
    }
  }, [hasUnsavedChanges])

  /** Import a .spudtile file from a filesystem path (reused by Open dialog + OS file association). */
  const importSpudtileFromPath = useCallback(async (filePath: string) => {
    if (!window.electron) return
    try {
      const json = await window.electron.fs.readFile(filePath)
      const baked = deserializeBakedTileset(json)
      if (!baked) {
        toast.error('Invalid .spudtile file')
        return
      }

      const { projectPath, projectConfig } = useProjectStore.getState()
      const tilesetsDir = projectPath && projectConfig?.paths
        ? `${projectPath}/${projectConfig.paths.tilesets ?? 'tilesets'}`
        : null

      const safeName = baked.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const targetDir = tilesetsDir ?? (filePath.replace(/[/\\][^/\\]+$/, ''))
      const pngPath = `${targetDir}/${safeName}.png`

      const base64Data = baked.imageDataUrl.split(',')[1]
      if (!base64Data) {
        toast.error('No image data in .spudtile file')
        return
      }
      await window.electron.fs.writeFileBase64(pngPath, base64Data)

      await addTileset({
        name: baked.name,
        sourcePath: pngPath,
        tileSize: baked.tileWidth,
      })

      const newTileset = useProjectStore.getState().tilesets.slice(-1)[0]
      if (newTileset) {
        const nextTileId = applyFlipToTileId(newTileset.firstGid, tileFlipX, tileFlipY)
        setActiveTilesetId(newTileset.id)
        setSelectedTileId(nextTileId)
        setTileStamp({
          width: 1,
          height: 1,
          tiles: [[nextTileId]],
          tilesetId: newTileset.id,
        })
      }

      toast.success(`Imported .spudtile: ${baked.name}`)
    } catch (err) {
      console.error('Failed to import .spudtile:', err)
      toast.error('Failed to import .spudtile file')
    }
  }, [addTileset, tileFlipX, tileFlipY, setActiveTilesetId, setSelectedTileId])

  const handleAddTileset = useCallback(async () => {
    if (!window.electron) {
      toast.error('Tileset import requires Electron')
      return
    }

    const result = await window.electron.dialog.openFile({
      title: 'Open Tileset',
      filters: [
        { name: 'All Tilesets', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'spudtile'] },
        { name: 'SpudTile Package', extensions: ['spudtile'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      ],
    })

    if (result.canceled || !result.filePath) return

    // Branch: .spudtile import vs raw image
    if (result.filePath.toLowerCase().endsWith('.spudtile')) {
      await importSpudtileFromPath(result.filePath)
    } else {
      openImportDialog(result.filePath)
    }
  }, [openImportDialog, importSpudtileFromPath])

  const handleImportConfirm = useCallback(async (importResult: TilesetImportResult) => {
    if (!pendingImportPath) return

    closeImportDialog()

    await addTileset({
      name: importResult.name,
      sourcePath: pendingImportPath,
      tileSize: importResult.tileSize,
    })

    const newTileset = useProjectStore.getState().tilesets.slice(-1)[0]
    if (newTileset) {
      const nextTileId = applyFlipToTileId(newTileset.firstGid, tileFlipX, tileFlipY)
      setActiveTilesetId(newTileset.id)
      setSelectedTileId(nextTileId)
      setTileStamp({
        width: 1,
        height: 1,
        tiles: [[nextTileId]],
        tilesetId: newTileset.id,
      })
    }
  }, [
    pendingImportPath,
    closeImportDialog,
    addTileset,
    tileFlipX,
    tileFlipY,
    setActiveTilesetId,
    setSelectedTileId,
  ])

  const handleRemoveTileset = useCallback(async (tilesetId: string) => {
    await removeTileset(tilesetId)

    if (activeTilesetId === tilesetId) {
      const remaining = useProjectStore.getState().tilesets
      const nextTileset = getPreferredTileset(remaining)
      setActiveTilesetId(nextTileset?.id || null)
      if (nextTileset) {
        const nextTileId = applyFlipToTileId(nextTileset.firstGid, tileFlipX, tileFlipY)
        setSelectedTileId(nextTileId)
        setTileStamp({
          width: 1,
          height: 1,
          tiles: [[nextTileId]],
          tilesetId: nextTileset.id,
        })
      }
    }
  }, [activeTilesetId, removeTileset, tileFlipX, tileFlipY, setActiveTilesetId, setSelectedTileId])

  const handleTileSelect = useCallback((globalTileId: number) => {
    const flippedTileId = applyFlipToTileId(globalTileId, tileFlipX, tileFlipY)
    setSelectedTileId(flippedTileId)

    const resolved = resolveTileId(flippedTileId, tilesets)
    const nextTilesetId = resolved?.tileset.id ?? activeTilesetId
    if (nextTilesetId) {
      setActiveTilesetId(nextTilesetId)
    }

    setTileStamp({
      width: 1,
      height: 1,
      tiles: [[flippedTileId]],
      tilesetId: nextTilesetId ?? null,
    })
  }, [tilesets, activeTilesetId, tileFlipX, tileFlipY, setActiveTilesetId, setSelectedTileId])

  const handleStampSelect = useCallback((stamp: TileStamp) => {
    const nextStamp = applyFlipToStamp(stamp, tileFlipX, tileFlipY)
    setTileStamp(nextStamp)
    if (nextStamp.tilesetId) {
      setActiveTilesetId(nextStamp.tilesetId)
    }
    const firstTile = nextStamp.tiles[0]?.find((tileId) => stripTileFlipFlags(tileId) > 0) ?? null
    if (firstTile !== null) {
      setSelectedTileId(firstTile)
    }
  }, [tileFlipX, tileFlipY, setActiveTilesetId, setSelectedTileId])

  const handleSave = useCallback(async () => {
    const latestMapData = useProjectStore.getState().mapData
    const syncedMapData = syncMapDataWithLevelEdits(latestMapData, level)
    setMapData(syncedMapData, false, 'Sync canvas edits')
    await saveMap(syncedMapData)
  }, [level, saveMap, setMapData])

  const handleRefreshFromDisk = useCallback(async (source: 'manual' | 'watch' = 'manual') => {
    if (!currentRoomPath) {
      if (source === 'manual') {
        toast.info('Open a room first')
      }
      return
    }

    const refreshed = await refreshCurrentRoomFromDisk()
    if (!refreshed) {
      if (source === 'manual') {
        toast.error('Failed to refresh from disk')
      }
      return
    }

    const nextTilesets = useProjectStore.getState().tilesets
    const nextDefaultTileset = getPreferredTileset(nextTilesets)
    if (nextDefaultTileset) {
      const nextTileId = applyFlipToTileId(nextDefaultTileset.firstGid, tileFlipX, tileFlipY)
      setActiveTilesetId(nextDefaultTileset.id)
      setSelectedTileId(nextTileId)
      setTileStamp({
        width: 1,
        height: 1,
        tiles: [[nextTileId]],
        tilesetId: nextDefaultTileset.id,
      })
    }

    setSelectedEntityId(null)
    externalChangeNoticeShownRef.current = false
    toast.success(source === 'watch' ? 'Project updated from disk' : 'Refreshed from disk')
  }, [
    currentRoomPath,
    refreshCurrentRoomFromDisk,
    tileFlipX,
    tileFlipY,
    setActiveTilesetId,
    setSelectedEntityId,
    setSelectedTileId,
  ])

  const handleToggleFlipX = useCallback(() => {
    const nextFlipX = !tileFlipX
    setTileFlipX(nextFlipX)
    if (selectedTileId !== null) {
      setSelectedTileId(applyFlipToTileId(selectedTileId, nextFlipX, tileFlipY))
    }
    setTileStamp((prev) => applyFlipToStamp(prev, nextFlipX, tileFlipY))
  }, [tileFlipX, tileFlipY, selectedTileId, setTileFlipX, setSelectedTileId])

  const handleToggleFlipY = useCallback(() => {
    const nextFlipY = !tileFlipY
    setTileFlipY(nextFlipY)
    if (selectedTileId !== null) {
      setSelectedTileId(applyFlipToTileId(selectedTileId, tileFlipX, nextFlipY))
    }
    setTileStamp((prev) => applyFlipToStamp(prev, tileFlipX, nextFlipY))
  }, [tileFlipX, tileFlipY, selectedTileId, setTileFlipY, setSelectedTileId])

  const handleLaunchBobTile = useCallback(async () => {
    if (!window.electron?.tools?.launchBobTile) {
      toast.error('BobTile launcher is unavailable in this build')
      return
    }

    const launched = await window.electron.tools.launchBobTile()
    if (launched) {
      toast.success('BobTile launched')
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom(zoom * 1.2)
  }, [setZoom, zoom])

  const handleZoomOut = useCallback(() => {
    setZoom(zoom / 1.2)
  }, [setZoom, zoom])

  const handleRecenter = useCallback(() => {
    resetViewport()
  }, [resetViewport])

  const handleAgentToolCall = useCallback((toolName: string, args: Record<string, unknown>) => {
    const getLayerIndex = (layerName: string) => mapData.layers.findIndex((layer) => layer.name === layerName)

    switch (toolName) {
      case 'paint_tiles': {
        const layer = typeof args.layer === 'string' ? args.layer : ''
        const layerIndex = getLayerIndex(layer)
        const tiles = Array.isArray(args.tiles)
          ? args.tiles.filter((tile): tile is { x: number; y: number; tileId: number } =>
            typeof tile === 'object' &&
            tile !== null &&
            typeof (tile as Record<string, unknown>).x === 'number' &&
            typeof (tile as Record<string, unknown>).y === 'number' &&
            typeof (tile as Record<string, unknown>).tileId === 'number')
          : []
        if (layerIndex >= 0 && tiles.length > 0) {
          paintTiles(layerIndex, tiles)
        }
        break
      }

      case 'fill_layer': {
        const layer = typeof args.layer === 'string' ? args.layer : ''
        const layerIndex = getLayerIndex(layer)
        const tileId = typeof args.tileId === 'number' ? args.tileId : null
        const region = typeof args.region === 'object' && args.region !== null
          ? args.region as { x: number; y: number; width: number; height: number }
          : undefined

        if (layerIndex < 0 || tileId === null) break

        if (region) {
          const tiles: Array<{ x: number; y: number; tileId: number }> = []
          for (let y = region.y; y < region.y + region.height; y += 1) {
            for (let x = region.x; x < region.x + region.width; x += 1) {
              tiles.push({ x, y, tileId })
            }
          }
          if (tiles.length > 0) {
            paintTiles(layerIndex, tiles)
          }
        } else {
          const fullLayerTiles: Array<{ x: number; y: number; tileId: number }> = []
          for (let y = 0; y < mapData.height; y += 1) {
            for (let x = 0; x < mapData.width; x += 1) {
              fullLayerTiles.push({ x, y, tileId })
            }
          }
          if (fullLayerTiles.length > 0) {
            paintTiles(layerIndex, fullLayerTiles)
          } else {
            fillArea(layerIndex, 0, 0, tileId)
          }
        }
        break
      }

      case 'place_entity': {
        const type = typeof args.type === 'string' ? args.type : null
        const x = typeof args.x === 'number' ? args.x : null
        const y = typeof args.y === 'number' ? args.y : null
        const properties = (typeof args.properties === 'object' && args.properties !== null
          ? args.properties
          : {}) as Record<string, string | number | boolean>

        if (!type || x === null || y === null) break

        const baseSize = mapData.tileSize || 32
        const size = type === 'ladder'
          ? { width: baseSize, height: baseSize * 2 }
          : { width: baseSize, height: baseSize }

        placeEntity({
          id: `${type}_${Date.now()}`,
          type: type as 'spawn_point' | 'door' | 'npc' | 'trigger' | 'prop' | 'stairs' | 'ladder' | 'portal',
          x,
          y,
          width: size.width,
          height: size.height,
          properties,
        })
        break
      }
    }
  }, [mapData.layers, mapData.width, mapData.height, mapData.tileSize, paintTiles, fillArea, placeEntity])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F5 toggle preview mode
      if (e.key === 'F5') {
        e.preventDefault()
        if (previewMode) exitPreview()
        else enterPreview()
        return
      }

      // W toggle world view (only when not typing in an input)
      if (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        const isTyping = target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        if (!isTyping) {
          e.preventDefault()
          toggleWorldView()
          return
        }
      }

      if (!e.ctrlKey && !e.metaKey) return

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault()
          handleSave()
          break
        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            redo()
            toast.info('Redo')
          } else {
            undo()
            toast.info('Undo')
          }
          break
        case 'y':
          e.preventDefault()
          redo()
          toast.info('Redo')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, undo, redo, previewMode, enterPreview, exitPreview, toggleWorldView])

  const fileWatchRoot = useMemo(
    () => projectPath ?? getDirectoryFromPath(currentRoomPath),
    [projectPath, currentRoomPath]
  )

  const handleWatchedFileChanges = useCallback((changes: FileWatcherChange[]) => {
    if (!currentRoomPath) return

    const shouldRefresh = changes.some((change) =>
      shouldRefreshForExternalChange(change.path, currentRoomPath, tilesets)
    )
    if (!shouldRefresh) return

    if (hasUnsavedChanges) {
      if (!externalChangeNoticeShownRef.current) {
        externalChangeNoticeShownRef.current = true
        toast.info('External changes detected. Click Refresh to reload from disk.')
      }
      return
    }

    void handleRefreshFromDisk('watch')
  }, [currentRoomPath, tilesets, hasUnsavedChanges, handleRefreshFromDisk])

  useFileWatcher({
    rootPath: fileWatchRoot,
    onFilesChanged: handleWatchedFileChanges,
    debounceMs: 300,
    enabled: !!fileWatchRoot,
  })

  useEffect(() => {
    if (!window.electron) return

    const cleanups = [
      window.electron.onMenuSave(() => handleSave()),
      window.electron.onMenuUndo(() => { undo(); toast.info('Undo') }),
      window.electron.onMenuRedo(() => { redo(); toast.info('Redo') }),
      window.electron.onProjectOpened((path) => {
        void loadProject(path)
      }),
      window.electron.onRoomOpened(({ path, content }) => {
        void (async () => {
          try {
            const loaded = await loadRoomDataFromContent(path, content, window.electron?.fs?.readFile)
            if (loaded.tilesets.length > 0) {
              const importedTilesets = await loadRoomTilesets(loaded.tilesets, {
                replaceExisting: true,
                persist: false,
              })

              const firstRoomTileset = importedTilesets[0]
              if (firstRoomTileset) {
                const nextTileId = applyFlipToTileId(firstRoomTileset.firstGid, tileFlipX, tileFlipY)
                setActiveTilesetId(firstRoomTileset.id)
                setSelectedTileId(nextTileId)
                setTileStamp({
                  width: 1,
                  height: 1,
                  tiles: [[nextTileId]],
                  tilesetId: firstRoomTileset.id,
                })
              }
            }
            setMapData(loaded.data, false)
            setCurrentRoomPath(path)
            setHasUnsavedChanges(false)
            toast.success(`Opened ${path.split(/[/\\]/).pop()}`)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to parse room file'
            toast.error(message)
          }
        })()
      }),
      window.electron.onRoomSaveAs(async (path) => {
        if (mapData) {
          await fsAdapter.saveRoom(path, mapData)
          setCurrentRoomPath(path)
          setHasUnsavedChanges(false)
          toast.success('Room saved!')
        }
      }),
      window.electron.onAgentTool((toolName, args) => {
        handleAgentToolCall(toolName, args)
      }),
      window.electron.onSpudtileOpened?.((filePath) => {
        void importSpudtileFromPath(filePath)
      }),
    ].filter(Boolean) as Array<() => void>

    return () => cleanups.forEach(cleanup => cleanup())
  }, [
    handleSave,
    undo,
    redo,
    mapData,
    fsAdapter,
    setMapData,
    setCurrentRoomPath,
    setHasUnsavedChanges,
    handleAgentToolCall,
    importSpudtileFromPath,
    loadRoomTilesets,
    tileFlipX,
    tileFlipY,
    setActiveTilesetId,
    setSelectedTileId,
    loadProject,
  ])

  const handleLayerToggle = useCallback((index: number, prop: 'visible' | 'locked') => {
    if (prop === 'visible') {
      toggleLayerVisible(index)
    } else {
      toggleLayerLocked(index)
    }
  }, [toggleLayerVisible, toggleLayerLocked])

  const syncCanvasEntitiesIntoMap = useCallback((description: string) => {
    const latestMapData = useProjectStore.getState().mapData
    const syncedMapData = syncMapDataWithLevelEdits(latestMapData, level)
    setMapData(syncedMapData, false, description)
    return syncedMapData
  }, [level, setMapData])

  const selectedEntity = useMemo(
    () => findEntityById(mapData, selectedEntityId),
    [mapData, selectedEntityId]
  )

  useEffect(() => {
    if (!selectedEntityId) return
    if (selectedEntity) return
    const syncedMapData = syncCanvasEntitiesIntoMap('Sync selected entity from canvas')
    const resolved = findEntityById(syncedMapData, selectedEntityId)
    if (!resolved) {
      setSelectedEntityId(null)
    }
  }, [selectedEntityId, selectedEntity, syncCanvasEntitiesIntoMap, setSelectedEntityId])

  const handleEntityPicked = useCallback((entityId: string) => {
    if (!entityId) return
    setSelectedEntityId(entityId)
  }, [setSelectedEntityId])

  const handleEntityUpdate = useCallback((id: string, updates: Partial<EntityData>) => {
    if (!findEntityById(useProjectStore.getState().mapData, id)) {
      syncCanvasEntitiesIntoMap('Sync entity edits from canvas')
    }
    updateEntity(id, updates)
  }, [syncCanvasEntitiesIntoMap, updateEntity])

  const handleEntityDelete = useCallback((id: string) => {
    if (!findEntityById(useProjectStore.getState().mapData, id)) {
      syncCanvasEntitiesIntoMap('Sync entity delete from canvas')
    }
    deleteEntity(id)
    setSelectedEntityId(null)
    toast.success('Entity deleted')
  }, [syncCanvasEntitiesIntoMap, deleteEntity, setSelectedEntityId])

  return (
    <div data-theme={resolvedTheme} className="pb-app h-screen w-screen overflow-hidden flex flex-col">
      <Toaster position="top-right" theme={resolvedTheme} />
      <NotificationContainer />
      <DialogContainer />

      <TilesetImportDialog
        open={importDialogOpen}
        filePath={pendingImportPath}
        onClose={closeImportDialog}
        onConfirm={handleImportConfirm}
      />

      <div className="pb-toolbar">
        <span className="pb-toolbar-brand">SpudTile</span>
        <div className="pb-toolbar-group">
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={openProjectSelector}
            title="Open Project"
          >
            <FolderOpen size={18} />
            <span>Open</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={handleSave}
            title="Save"
          >
            <Save size={18} />
            <span>Save</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => { void handleRefreshFromDisk('manual') }}
            title={currentRoomPath ? 'Refresh from disk' : 'Open a room first'}
            disabled={!currentRoomPath}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
        <div className="pb-toolbar-divider" />
        <div className="pb-toolbar-group">
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => { undo(); toast.info('Undo') }}
            title={`Undo (${undoCount} available)`}
            disabled={!canUndo}
          >
            <Undo2 size={18} />
            <span>Undo</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => { redo(); toast.info('Redo') }}
            title={`Redo (${redoCount} available)`}
            disabled={!canRedo}
          >
            <Redo2 size={18} />
            <span>Redo</span>
          </button>
        </div>
        <div className="pb-toolbar-divider" />
        <div className="pb-toolbar-group">
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut size={16} />
            <span>Zoom -</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn size={16} />
            <span>Zoom +</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={handleRecenter}
            title="Go to origin (0,0)"
          >
            <Crosshair size={16} />
            <span>Origin</span>
          </button>
        </div>
        <div className="pb-toolbar-divider" />
        <div className="pb-toolbar-group">
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => setIsRunTestOpen(true)}
            title="Start play mode (WASD to move)"
          >
            <Play size={16} />
            <span>Start</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => { void handleLaunchBobTile() }}
            title="Launch BobTile"
          >
            <ExternalLink size={16} />
            <span>BobTile</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => enterPreview()}
            title="Game Preview (F5)"
          >
            <Eye size={16} />
            <span>Preview</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => setIsBakeDialogOpen(true)}
            title="Export baked tileset"
          >
            <Package size={16} />
            <span>Bake</span>
          </button>
          {roomRegistry.length >= 2 && (
            <button
              className={`pb-tool-btn pb-tool-btn-labeled${worldViewMode ? ' pb-tool-btn-active' : ''}`}
              onClick={toggleWorldView}
              title="Toggle World View (W)"
            >
              <Globe size={16} />
              <span>{worldViewMode ? 'Editor' : 'World'}</span>
            </button>
          )}
        </div>
        <div className="pb-toolbar-divider" />
        <div className="pb-toolbar-group">
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={resetPanelLayout}
            title="Reset panel layout"
          >
            <Crosshair size={16} />
            <span>Layout</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={handleToggleTheme}
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
        {projectName && (
          <span className="pb-toolbar-chip">
            {projectName}
          </span>
        )}
        <span className="pb-toolbar-chip">
          Tool: {activeToolId}
        </span>
      </div>
      <ToolContextBar
        activeToolId={activeToolId}
        activeLayerName={activeLayerName ?? null}
        hasSelectedTile={selectedTileId !== null}
        tileFlipX={tileFlipX}
        tileFlipY={tileFlipY}
        onToggleFlipX={handleToggleFlipX}
        onToggleFlipY={handleToggleFlipY}
      />

      <PanelGroup orientation="vertical" className="flex-1 min-h-0">
        <Panel id="main-area">
          <PanelGroup
            key={`layout-${leftPanelOpen ? 'L1' : 'L0'}-${rightPanelOpen ? 'R1' : 'R0'}`}
            orientation="horizontal"
            className="h-full"
          >
            {leftPanelOpen ? (
              <Panel
                id="left-sidebar"
                defaultSize={asPercent(leftPanelDefaultSize)}
                minSize={asPercent(leftPanelMinSize)}
                maxSize={asPercent(leftPanelMaxSize)}
                onResize={handleLeftPanelResize}
                className="pb-panel pb-panel-palette border-r border-[var(--pb-border)] min-w-[260px]"
              >
                <div className="pb-panel-header pb-panel-header-palette">
                  <div className="pb-panel-title-wrap">
                    <SwatchBook className="pb-panel-title-icon" size={14} />
                    <div className="pb-panel-title-copy">
                      <span className="pb-panel-kicker">Workspace</span>
                      <span className="pb-panel-title">Palette</span>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePanelCollapsed('left')}
                    className="pb-panel-btn"
                    title="Close Palette"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
                <div className="pb-panel-content h-full min-h-0 flex flex-col gap-3 overflow-hidden">
                  <div className="min-h-[240px] max-h-[340px] flex-shrink-0 overflow-hidden">
                    <ToolPalette />
                  </div>
                  <div className="flex-1 min-h-[280px] overflow-hidden">
                    <TilesetPanel
                      tilesets={tilesets}
                      activeTilesetId={activeTilesetId}
                      selectedTileId={effectiveTileId}
                      stamp={tileStamp}
                      tilesetZoom={tilesetZoom}
                      onTilesetSelect={setActiveTilesetId}
                      onTileSelect={handleTileSelect}
                      onStampSelect={handleStampSelect}
                      onTilesetZoomChange={setTilesetZoom}
                      onAddTileset={handleAddTileset}
                      onRemoveTileset={handleRemoveTileset}
                    />
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel
                id="left-collapsed"
                defaultSize={asPercent(3.2)}
                minSize={asPercent(2.4)}
                maxSize={asPercent(6)}
              >
                <button
                  onClick={() => togglePanelCollapsed('left')}
                  className="pb-panel-toggle pb-panel-toggle-side h-full border-r border-[var(--pb-border)]"
                  title="Open Palette"
                >
                  <PanelLeftOpen className="w-4 h-4 text-[var(--pb-text-muted)]" />
                  <span className="pb-panel-toggle-label">Palette</span>
                </button>
              </Panel>
            )}

            <PanelResizeHandle className="panel-resize-handle" />

            <Panel id="canvas" className="min-w-0 h-full">
              <div className="h-full pb-canvas-area min-w-0 overflow-hidden relative">
                {worldViewMode ? (
                  <SpudWorldViewCanvas />
                ) : (
                  <>
                    <LevelCanvas
                      level={level}
                      tileStamp={tileStamp}
                      mapData={mapData}
                      onTilePicked={handleTileSelect}
                      onEntityPicked={handleEntityPicked}
                      onIntGridPicked={setSelectedIntGridValue}
                    />
                    <WorldMinimap />
                  </>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="panel-resize-handle" />

            {rightPanelOpen ? (
              <Panel
                id="right-sidebar"
                defaultSize={asPercent(rightPanelDefaultSize)}
                minSize={asPercent(rightPanelMinSize)}
                maxSize={asPercent(rightPanelMaxSize)}
                onResize={handleRightPanelResize}
                className="pb-panel pb-panel-inspector border-l border-[var(--pb-border)] min-w-[260px]"
              >
                <div className="pb-panel-header pb-panel-header-inspector">
                  <div className="pb-panel-title-wrap">
                    <SlidersHorizontal className="pb-panel-title-icon" size={14} />
                    <div className="pb-panel-title-copy">
                      <span className="pb-panel-kicker">Edit</span>
                      <span className="pb-panel-title">Inspector</span>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePanelCollapsed('right')}
                    className="pb-panel-btn"
                    title="Close Inspector"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>
                <div className="pb-panel-content h-full min-h-0 flex flex-col gap-3">
                  <div className="shrink-0 rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-input)] overflow-hidden">
                    <button
                      className="w-full h-8 px-2 flex items-center gap-2 border-b border-[var(--pb-border-subtle)] text-left hover:bg-[var(--pb-bg-hover)]"
                      onClick={() => setInspectorPropertiesCollapsed((prev) => !prev)}
                      title={inspectorPropertiesCollapsed ? 'Expand properties' : 'Collapse properties'}
                    >
                      {inspectorPropertiesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="text-[10px] font-semibold uppercase tracking-wide">Properties</span>
                      <span className="ml-auto text-[10px] text-[var(--pb-text-muted)] truncate max-w-[180px]">
                        {selectedEntity ? `${selectedEntity.type}: ${selectedEntity.id}` : 'No entity selected'}
                      </span>
                    </button>
                    {!inspectorPropertiesCollapsed && (
                      <div className="max-h-[40vh] overflow-y-auto">
                        <PropertiesPanel
                          selectedEntity={selectedEntity}
                          onEntityUpdate={handleEntityUpdate}
                          onEntityDelete={handleEntityDelete}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-h-[160px] flex-1">
                    <LayerPanel
                      layers={mapData.layers}
                      activeLayerIndex={activeLayerIndex}
                      onLayerSelect={setActiveLayerIndex}
                      onLayerToggle={handleLayerToggle}
                      onLayerReorder={reorderLayers}
                      onLayerAdd={addLayer}
                      onLayerDelete={deleteLayer}
                      onLayerRename={renameLayer}
                      onLayerOpacityChange={setLayerOpacity}
                      layerGroups={layerGroups}
                      onCreateGroup={createLayerGroup}
                      onDeleteGroup={deleteLayerGroup}
                      onToggleGroupVisibility={toggleGroupVisibility}
                      onToggleGroupLock={toggleGroupLock}
                      onToggleGroupCollapsed={toggleGroupCollapsed}
                      onMoveLayerToGroup={moveLayerToGroup}
                      collisionSourceLayerNames={collisionSourceConfig.linkedLayerNames}
                      collisionDerivedOverlayVisible={collisionSourceConfig.showDerivedOverlay}
                      onSetCollisionSourceLayerEnabled={setCollisionSourceLayerEnabled}
                      onSetCollisionDerivedOverlayVisible={setCollisionDerivedOverlayVisible}
                    />
                  </div>
                  <TileActionsPanel
                    actionGroups={tileActionGroups}
                    onAdd={addTileActionGroup}
                    onUpdate={updateTileActionGroup}
                    onDelete={deleteTileActionGroup}
                  />
                  <div className="flex-1 min-h-[140px]">
                    <EntityPalette />
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel
                id="right-collapsed"
                defaultSize={asPercent(3.2)}
                minSize={asPercent(2.4)}
                maxSize={asPercent(6)}
              >
                <button
                  onClick={() => togglePanelCollapsed('right')}
                  className="pb-panel-toggle pb-panel-toggle-side h-full border-l border-[var(--pb-border)]"
                  title="Open Inspector"
                >
                  <PanelRightOpen className="w-4 h-4 text-[var(--pb-text-muted)]" />
                  <span className="pb-panel-toggle-label">Inspector</span>
                </button>
              </Panel>
            )}
          </PanelGroup>
        </Panel>

        {bottomPanelOpen && (
          <>
            <PanelResizeHandle className="panel-resize-handle" />
            <Panel
              id="bottom-panel"
              defaultSize={asPercent(bottomPanelDefaultSize)}
              minSize={asPercent(bottomPanelMinSize)}
              maxSize={asPercent(bottomPanelMaxSize)}
              onResize={handleBottomPanelResize}
              className="pb-panel pb-panel-agent border-t border-[var(--pb-border)]"
            >
              <div className="pb-panel-header pb-panel-header-agent">
                <div className="pb-panel-title-wrap">
                  <Bot className="pb-panel-title-icon" size={14} />
                  <div className="pb-panel-title-copy">
                    <span className="pb-panel-kicker">Assistant</span>
                    <span className="pb-panel-title">Agent</span>
                  </div>
                </div>
                <button
                  onClick={() => togglePanelCollapsed('bottom')}
                  className="pb-panel-btn"
                  title="Close Agent Panel"
                >
                  <PanelBottomClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden pb-agent-panel">
                <AgentPanel />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {!bottomPanelOpen && (
        <button
          onClick={() => togglePanelCollapsed('bottom')}
          className="pb-panel-toggle pb-panel-toggle-bottom border-t border-[var(--pb-border)]"
          title="Open Agent Panel"
        >
          <PanelBottomOpen className="w-4 h-4 text-[var(--pb-text-muted)]" />
          <span className="text-xs text-[var(--pb-text-muted)]">Agent</span>
        </button>
      )}

      <div className="pb-statusbar">
        {projectName && <span className="pb-statusbar-accent">{projectName}</span>}
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Tool:</span> {activeToolId}
        </span>
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Layer:</span> {mapData.layers[activeLayerIndex]?.name}
        </span>
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Zoom:</span> {Math.round(zoom * 100)}%
        </span>
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Tile ID:</span> {effectiveBaseTileId}
          {(tileFlipX || tileFlipY) ? ` (${tileFlipX ? 'FlipX' : ''}${tileFlipX && tileFlipY ? ',' : ''}${tileFlipY ? 'FlipY' : ''})` : ''}
        </span>
        {tileStamp.width > 1 || tileStamp.height > 1 ? (
          <span className="pb-statusbar-item">
            <span className="text-[var(--pb-text-muted)]">Stamp:</span> {tileStamp.width}×{tileStamp.height}
          </span>
        ) : null}
        <span className="pb-statusbar-right">
          {hasUnsavedChanges ? (
            <span className="pb-statusbar-unsaved">● Unsaved</span>
          ) : (
            <span className="pb-statusbar-saved">✓ Saved</span>
          )}
        </span>
      </div>

      <ProjectSelector />
      <NewProjectWizard />
      <RunTestOverlay
        open={isRunTestOpen}
        mapData={mapData}
        tilesets={tilesets}
        onClose={() => setIsRunTestOpen(false)}
      />
      {previewMode && <GamePreview />}
      <BakeTilesetDialog
        open={isBakeDialogOpen}
        onOpenChange={setIsBakeDialogOpen}
        tilesets={tilesets}
      />
    </div>
  )
}

export default App
