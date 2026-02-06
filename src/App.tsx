/**
 * PrairieBob Main App
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
  Crosshair,
  FolderOpen,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Save,
  SlidersHorizontal,
  SwatchBook,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import type { EntityInstance, LayerInstance, Level, TileInstance } from '@/lib/ldtk'
import { DEBUG_TILESET_ID, type Layer, type LevelData, type LoadedTileset, type TileStamp } from '@/lib/types'
import { resolveTileId } from '@/lib/tileset'
import { ToolPalette } from '@/components/ToolPalette'
import { TilesetPanel } from '@/components/TilesetPanel'
import { LevelCanvas } from '@/components/LevelCanvas'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { LayerPanel } from '@/components/LayerPanel'
import { EntityPalette } from '@/components/EntityPalette'
import { TilesetImportDialog, TilesetImportResult } from '@/components/TilesetImportDialog'
import { AgentPanel } from '@/components/AgentPanel'
import { ProjectSelector } from '@/components/ProjectSelector'
import { NewProjectWizard } from '@/components/NewProjectWizard'
import { getFileSystemAdapter } from '@/lib/fs-adapter'
import { Toaster, toast } from 'sonner'
import { NotificationContainer } from '@/components/Notification'
import { DialogContainer } from '@/components/Dialog'
import { useEditorStore, useProjectStore, useUIStore } from '@/stores'
import { useToolStore } from '@/stores/toolStore'
import { useLdtkToolStore } from '@/stores/ldtkToolStore'

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

function pickLayerTileset(layer: Layer, tilesets: LoadedTileset[]): LoadedTileset | null {
  if (!layer.data) return null
  const tileId = layer.data.find((value) => value > 0)
  if (!tileId) return null
  return resolveTileId(tileId, tilesets)?.tileset ?? null
}

function buildTileInstances(
  mapData: LevelData,
  layer: Layer,
  tilesets: LoadedTileset[],
  layerTileset: LoadedTileset | null
): TileInstance[] {
  if (!layer.data || !layerTileset) return []
  const tiles: TileInstance[] = []

  for (let index = 0; index < layer.data.length; index += 1) {
    const tileId = layer.data[index]
    if (tileId <= 0) continue

    const resolved = resolveTileId(tileId, tilesets)
    if (!resolved || resolved.tileset.id !== layerTileset.id) continue

    const localTileId = resolved.localTileId
    const col = localTileId % layerTileset.tilesPerRow
    const row = Math.floor(localTileId / layerTileset.tilesPerRow)
    const x = index % mapData.width
    const y = Math.floor(index / mapData.width)

    tiles.push({
      t: tileId,
      px: [x * mapData.tileSize, y * mapData.tileSize],
      src: [col * layerTileset.tileSize, row * layerTileset.tileSize],
      f: 0,
      a: 1,
    })
  }

  return tiles
}

function buildEntityInstances(layer: Layer, tileSize: number): EntityInstance[] {
  if (!layer.objects) return []
  return layer.objects.map((entity, index) => ({
    iid: entity.id || `${layer.name}-${index}`,
    defUid: 0,
    __identifier: entity.id || entity.type,
    __grid: [Math.floor(entity.x / tileSize), Math.floor(entity.y / tileSize)],
    px: [entity.x, entity.y],
    width: entity.width,
    height: entity.height,
    __pivot: [0, 0],
    __worldX: entity.x,
    __worldY: entity.y,
    __tags: [],
    __tile: null,
    __smartColor: DEFAULT_ENTITY_COLOR,
    fieldInstances: [],
  }))
}

function buildLdtkLevel(mapData: LevelData, tilesets: LoadedTileset[]): Level {
  const tileSize = mapData.tileSize
  const layerInstances: LayerInstance[] = mapData.layers.map((layer, index) => {
    const isEntityLayer = layer.type === 'objectgroup'
    const layerTileset = isEntityLayer ? null : pickLayerTileset(layer, tilesets)
    const tilesetPath =
      layerTileset && layerTileset.sourcePath !== 'procedural'
        ? layerTileset.sourcePath
        : null

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
        : buildTileInstances(mapData, layer, tilesets, layerTileset),
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

function App() {
  const [tileStamp, setTileStamp] = useState<TileStamp>(DEFAULT_STAMP)

  const {
    activeTilesetId,
    activeLayerIndex,
    selectedEntityId,
    setActiveTilesetId,
    setActiveLayerIndex,
    setSelectedEntityId,
  } = useEditorStore()

  const {
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
    toggleLayerVisible,
    toggleLayerLocked,
    setLayerOpacity,
    reorderLayers,
    addLayer,
    deleteLayer,
    renameLayer,
    updateEntity,
    deleteEntity,
    initTilesets,
    addTileset,
    removeTileset,
    saveMap,
  } = useProjectStore()

  const {
    panels,
    tilesetZoom,
    importDialogOpen,
    pendingImportPath,
    openProjectSelector,
    openImportDialog,
    closeImportDialog,
    togglePanelCollapsed,
    setTilesetZoom,
  } = useUIStore()

  // Use individual selectors to avoid creating new objects every render
  const selectedTileId = useToolStore((s) => s.selectedTileId)
  const zoom = useToolStore((s) => s.zoom)
  const setZoom = useToolStore((s) => s.setZoom)
  const resetViewport = useToolStore((s) => s.resetViewport)
  const setSelectedTileId = useToolStore((s) => s.setSelectedTileId)
  const setActiveLayer = useToolStore((s) => s.setActiveLayer)

  const activeToolId = useLdtkToolStore((state) => state.activeToolId)

  const fsAdapter = getFileSystemAdapter()
  const level = useMemo(() => buildLdtkLevel(mapData, tilesets), [mapData, tilesets])
  const effectiveTileId = selectedTileId ?? tilesets[0]?.firstGid ?? 1

  const leftPanelOpen = !panels.left.collapsed
  const rightPanelOpen = !panels.right.collapsed
  const bottomPanelOpen = !panels.bottom.collapsed

  // Guard against multiple initTilesets calls
  const tilesetsInitRef = useRef(false)
  const autoSelectedNonDebugTilesetRef = useRef(false)

  // Effect: Initialize tilesets if empty
  useEffect(() => {
    if (tilesets.length === 0 && !tilesetsInitRef.current) {
      tilesetsInitRef.current = true
      initTilesets()
    }
  }, [tilesets.length, initTilesets])

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
      setSelectedTileId(nextTileset.firstGid)
      setTileStamp({
        width: 1,
        height: 1,
        tiles: [[nextTileset.firstGid]],
        tilesetId: nextTileset.id,
      })
    }
  }, [tilesets, activeTilesetId, selectedTileId, setActiveTilesetId, setSelectedTileId])

  // Sync active layer name to tool store — only when layer index changes
  const activeLayerName = level.layerInstances[activeLayerIndex]?.__identifier
  useEffect(() => {
    if (activeLayerName) {
      setActiveLayer(activeLayerName)
    }
  }, [activeLayerName, setActiveLayer])

  useEffect(() => {
    if (hasUnsavedChanges) {
      fsAdapter.setUnsavedChanges(true)
    }
  }, [hasUnsavedChanges, fsAdapter])

  const handleAddTileset = useCallback(async () => {
    if (!window.electron) {
      toast.error('Tileset import requires Electron')
      return
    }

    const result = await window.electron.dialog.openFile({
      title: 'Open Tileset Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    })

    if (result.canceled || !result.filePath) return

    openImportDialog(result.filePath)
  }, [openImportDialog])

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
      setActiveTilesetId(newTileset.id)
      setSelectedTileId(newTileset.firstGid)
      setTileStamp({
        width: 1,
        height: 1,
        tiles: [[newTileset.firstGid]],
        tilesetId: newTileset.id,
      })
    }
  }, [pendingImportPath, closeImportDialog, addTileset, setActiveTilesetId, setSelectedTileId])

  const handleRemoveTileset = useCallback(async (tilesetId: string) => {
    await removeTileset(tilesetId)

    if (activeTilesetId === tilesetId) {
      const remaining = useProjectStore.getState().tilesets
      const nextTileset = getPreferredTileset(remaining)
      setActiveTilesetId(nextTileset?.id || null)
      if (nextTileset) {
        setSelectedTileId(nextTileset.firstGid)
        setTileStamp({
          width: 1,
          height: 1,
          tiles: [[nextTileset.firstGid]],
          tilesetId: nextTileset.id,
        })
      }
    }
  }, [activeTilesetId, removeTileset, setActiveTilesetId, setSelectedTileId])

  const handleTileSelect = useCallback((globalTileId: number) => {
    setSelectedTileId(globalTileId)

    const resolved = resolveTileId(globalTileId, tilesets)
    const nextTilesetId = resolved?.tileset.id ?? activeTilesetId
    if (nextTilesetId) {
      setActiveTilesetId(nextTilesetId)
    }

    setTileStamp({
      width: 1,
      height: 1,
      tiles: [[globalTileId]],
      tilesetId: nextTilesetId ?? null,
    })
  }, [tilesets, activeTilesetId, setActiveTilesetId, setSelectedTileId])

  const handleStampSelect = useCallback((stamp: TileStamp) => {
    setTileStamp(stamp)
    if (stamp.tilesetId) {
      setActiveTilesetId(stamp.tilesetId)
    }
  }, [setActiveTilesetId])

  const handleSave = useCallback(async () => {
    await saveMap()
  }, [saveMap])

  const handleZoomIn = useCallback(() => {
    setZoom(zoom * 1.2)
  }, [setZoom, zoom])

  const handleZoomOut = useCallback(() => {
    setZoom(zoom / 1.2)
  }, [setZoom, zoom])

  const handleRecenter = useCallback(() => {
    resetViewport()
  }, [resetViewport])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [handleSave, undo, redo])

  useEffect(() => {
    if (!window.electron) return

    const cleanups = [
      window.electron.onMenuSave(() => handleSave()),
      window.electron.onMenuUndo(() => { undo(); toast.info('Undo') }),
      window.electron.onMenuRedo(() => { redo(); toast.info('Redo') }),
      window.electron.onRoomOpened(({ path, content }) => {
        try {
          const data = JSON.parse(content)
          setMapData(data, false)
          setCurrentRoomPath(path)
          setHasUnsavedChanges(false)
          toast.success(`Opened ${path.split(/[/\\]/).pop()}`)
        } catch (err) {
          toast.error('Failed to parse room file')
        }
      }),
      window.electron.onRoomSaveAs(async (path) => {
        if (mapData) {
          await fsAdapter.saveRoom(path, mapData)
          setCurrentRoomPath(path)
          setHasUnsavedChanges(false)
          toast.success('Room saved!')
        }
      }),
    ]

    return () => cleanups.forEach(cleanup => cleanup())
  }, [handleSave, undo, redo, mapData, fsAdapter, setMapData, setCurrentRoomPath, setHasUnsavedChanges])

  const handleLayerToggle = useCallback((index: number, prop: 'visible' | 'locked') => {
    if (prop === 'visible') {
      toggleLayerVisible(index)
    } else {
      toggleLayerLocked(index)
    }
  }, [toggleLayerVisible, toggleLayerLocked])

  const selectedEntity = mapData.layers
    .find(layer => layer.type === 'objectgroup')
    ?.objects?.find(entity => entity.id === selectedEntityId) || null

  return (
    <div className="pb-app h-screen w-screen overflow-hidden flex flex-col">
      <Toaster position="top-right" theme="dark" />
      <NotificationContainer />
      <DialogContainer />

      <TilesetImportDialog
        open={importDialogOpen}
        filePath={pendingImportPath}
        onClose={closeImportDialog}
        onConfirm={handleImportConfirm}
      />

      <div className="pb-toolbar">
        <span className="pb-toolbar-brand">PrairieBob</span>
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
        </div>
        <div className="pb-toolbar-divider" />
        <div className="pb-toolbar-group">
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => { undo(); toast.info('Undo') }}
            title="Undo"
            disabled={!canUndo}
          >
            <Undo2 size={18} />
            <span>Undo</span>
          </button>
          <button
            className="pb-tool-btn pb-tool-btn-labeled"
            onClick={() => { redo(); toast.info('Redo') }}
            title="Redo"
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
        {projectName && (
          <span className="pb-toolbar-chip">
            {projectName}
          </span>
        )}
        <span className="pb-toolbar-chip">
          Tool: {activeToolId}
        </span>
      </div>

      <PanelGroup orientation="vertical" className="flex-1 min-h-0">
        <Panel id="main-area">
          <PanelGroup orientation="horizontal" className="h-full">
            {leftPanelOpen ? (
              <Panel
                id="left-sidebar"
                defaultSize="20%"
                minSize="15%"
                maxSize="30%"
                className="pb-panel pb-panel-palette border-r border-[var(--pb-border)]"
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
                <div className="pb-panel-content h-full min-h-0 flex flex-col gap-3">
                  <div className="min-h-[170px] max-h-[260px] flex-shrink-0">
                    <ToolPalette />
                  </div>
                  <div className="flex-1 min-h-[280px]">
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
              <Panel id="left-collapsed" defaultSize="44px" minSize="44px" maxSize="44px">
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

            <Panel id="canvas" className="min-w-0">
              <div className="flex-1 pb-canvas-area min-w-0 overflow-hidden relative">
                <LevelCanvas level={level} tileStamp={tileStamp} />
              </div>
            </Panel>

            <PanelResizeHandle className="panel-resize-handle" />

            {rightPanelOpen ? (
              <Panel
                id="right-sidebar"
                defaultSize="20%"
                minSize="15%"
                maxSize="30%"
                className="pb-panel pb-panel-inspector border-l border-[var(--pb-border)]"
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
                  <PropertiesPanel
                    selectedEntity={selectedEntity}
                    onEntityUpdate={updateEntity}
                    onEntityDelete={(id) => {
                      deleteEntity(id)
                      setSelectedEntityId(null)
                      toast.success('Entity deleted')
                    }}
                  />
                  <div className="min-h-[160px] max-h-[320px]">
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
                    />
                  </div>
                  <div className="flex-1 min-h-[140px]">
                    <EntityPalette />
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel id="right-collapsed" defaultSize="44px" minSize="44px" maxSize="44px">
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
              defaultSize="18%"
              minSize="10%"
              maxSize="40%"
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
          <span className="text-[var(--pb-text-muted)]">Tile ID:</span> {effectiveTileId}
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
    </div>
  )
}

export default App
