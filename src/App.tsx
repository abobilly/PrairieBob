/**
 * PrairieBob Main App
 * 
 * UX patterns stolen from:
 * - Tiled: Resizable panels, stamp brushes, undo/redo
 * - LDtk: Modern state management, visual polish
 * - Ogmo: Layer organization
 * - YATE: Tileset organization
 */

import { useEffect, useCallback } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { EntityType, EntityData } from '@/lib/types'
import { resolveTileId } from '@/lib/tileset'
import { Toolbar } from '@/components/Toolbar'
import { MapCanvas } from '@/components/MapCanvas'
import { LayerPanel } from '@/components/LayerPanel'
import { TilesetPanel } from '@/components/TilesetPanel'
import { EntityPalette } from '@/components/EntityPalette'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { TilesetImportDialog, TilesetImportResult } from '@/components/TilesetImportDialog'
import { AgentPanel } from '@/components/AgentPanel'
import { ProjectSelector } from '@/components/ProjectSelector'
import { NewProjectWizard } from '@/components/NewProjectWizard'
import { getFileSystemAdapter } from '@/lib/fs-adapter'
import { Toaster, toast } from 'sonner'

// Zustand stores
import {
  useEditorStore,
  useProjectStore,
  useUIStore,
} from '@/stores'

// CSS for resize handles
import './styles/panels.css'

function App() {
  // ============== Zustand Store Access ==============
  const {
    currentTool,
    previousTool,
    zoom,
    panX,
    panY,
    gridVisible,
    selectedTileId,
    stamp,
    activeTilesetId,
    activeLayerIndex,
    selectedEntityId,
    spaceHeld,
    setTool,
    setPreviousTool,
    setZoom,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomToPoint,
    setPan,
    nudgePan,
    toggleGrid,
    setSelectedTileId,
    setStamp,
    setActiveTilesetId,
    setActiveLayerIndex,
    setSelectedEntityId,
    setSpaceHeld,
    setShiftHeld,
    setCtrlHeld,
    setCursorTile,
    selection,
    clipboard,
    setSelection,
    copySelection,
    clearSelection,
  } = useEditorStore()

  const {
    mapData,
    currentRoomPath,
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
    paintTile,
    paintTiles,
    fillArea,
    toggleLayerVisible,
    toggleLayerLocked,
    setLayerOpacity,
    reorderLayers,
    addLayer,
    deleteLayer,
    renameLayer,
    placeEntity,
    updateEntity,
    moveEntity,
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
    showProjectSelector,
    showNewProjectWizard,
    openImportDialog,
    closeImportDialog,
    setPanelSize,
    setTilesetZoom,
  } = useUIStore()

  const fsAdapter = getFileSystemAdapter()

  // Defensive: persisted UI state may contain older/corrupted values (e.g. null/object)
  // react-resizable-panels expects size constraints to be number|string.
  const leftPanelSize = typeof (panels as any)?.left?.size === 'number' && Number.isFinite((panels as any).left.size)
    ? (panels as any).left.size
    : 20
  const leftPanelMinSize = typeof (panels as any)?.left?.minSize === 'number' && Number.isFinite((panels as any).left.minSize)
    ? (panels as any).left.minSize
    : 15
  const leftPanelMaxSize = typeof (panels as any)?.left?.maxSize === 'number' && Number.isFinite((panels as any).left.maxSize)
    ? (panels as any).left.maxSize
    : 40

  const rightPanelSize = typeof (panels as any)?.right?.size === 'number' && Number.isFinite((panels as any).right.size)
    ? (panels as any).right.size
    : 20
  const rightPanelMinSize = typeof (panels as any)?.right?.minSize === 'number' && Number.isFinite((panels as any).right.minSize)
    ? (panels as any).right.minSize
    : 15
  const rightPanelMaxSize = typeof (panels as any)?.right?.maxSize === 'number' && Number.isFinite((panels as any).right.maxSize)
    ? (panels as any).right.maxSize
    : 35

  // ============== Initialize ==============
  useEffect(() => {
    // Don't auto-load - let the project selector handle it
    // The ProjectSelector shows by default (showProjectSelector: true in uiStore)
  }, [])

  useEffect(() => {
    // Fallback: init tilesets if project loading didn't happen
    if (tilesets.length === 0) {
      initTilesets()
    }
  }, [initTilesets, tilesets.length])

  useEffect(() => {
    if (tilesets.length > 0 && !activeTilesetId) {
      setActiveTilesetId(tilesets[0].id)
    }
  }, [tilesets, activeTilesetId, setActiveTilesetId])

  // Mark unsaved changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      fsAdapter.setUnsavedChanges(true)
    }
  }, [hasUnsavedChanges, fsAdapter])

  // ============== Tileset Management ==============
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

    // Select first tile of new tileset
    const newTileset = useProjectStore.getState().tilesets.slice(-1)[0]
    if (newTileset) {
      setActiveTilesetId(newTileset.id)
      setSelectedTileId(newTileset.firstGid)
    }
  }, [pendingImportPath, closeImportDialog, addTileset, setActiveTilesetId, setSelectedTileId])

  const handleRemoveTileset = useCallback(async (tilesetId: string) => {
    await removeTileset(tilesetId)

    // If we removed the active tileset, switch to the first one
    if (activeTilesetId === tilesetId) {
      const remaining = useProjectStore.getState().tilesets
      setActiveTilesetId(remaining[0]?.id || null)
      setSelectedTileId(remaining[0]?.firstGid || 1)
    }
  }, [activeTilesetId, removeTileset, setActiveTilesetId, setSelectedTileId])

  // Handle tile selection (from TilesetPanel)
  const handleTileSelect = useCallback((globalTileId: number) => {
    setSelectedTileId(globalTileId)
    const resolved = resolveTileId(globalTileId, tilesets)
    if (resolved) {
      setActiveTilesetId(resolved.tileset.id)
    }
    // If in eyedropper mode, switch back to brush
    if (currentTool === 'eyedropper') {
      setTool('brush')
    }
  }, [tilesets, currentTool, setSelectedTileId, setActiveTilesetId, setTool])

  // ============== Save/Export ==============
  const handleSave = useCallback(async () => {
    await saveMap()
  }, [saveMap])

  const handleExport = useCallback(() => {
    if (!mapData) return

    const json = JSON.stringify(mapData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapData.id}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Map exported!')
  }, [mapData])

  // ============== Electron Menu Events ==============
  useEffect(() => {
    if (!window.electron) return

    const cleanups = [
      window.electron.onMenuSave(() => handleSave()),
      window.electron.onMenuUndo(() => { undo(); toast.info('Undo') }),
      window.electron.onMenuRedo(() => { redo(); toast.info('Redo') }),
      window.electron.onMenuToggleGrid(() => toggleGrid()),
      window.electron.onMenuZoomIn(() => zoomIn()),
      window.electron.onMenuZoomOut(() => zoomOut()),
      window.electron.onMenuZoomReset(() => zoomReset()),
      window.electron.onMenuExport(() => handleExport()),
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
  }, [handleSave, handleExport, undo, redo, toggleGrid, zoomIn, zoomOut, zoomReset, mapData, fsAdapter, setMapData, setCurrentRoomPath, setHasUnsavedChanges])

  // ============== Keyboard Shortcuts ==============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track modifier keys
      if (e.key === ' ' && !spaceHeld) {
        e.preventDefault()
        setSpaceHeld(true)
        // Temporarily switch to pan mode (Tiled/Photoshop style)
        if (currentTool !== 'select') {
          setPreviousTool(currentTool)
        }
      }
      if (e.key === 'Shift') setShiftHeld(true)
      if (e.key === 'Control' || e.key === 'Meta') setCtrlHeld(true)

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault()
            handleSave()
            break
          case 'e':
            e.preventDefault()
            handleExport()
            break
          case 'c':
            // Copy selection (stolen from Tiled/Photoshop)
            if (selection) {
              e.preventDefault()
              copySelection()
              toast.success(`Copied ${selection.width}×${selection.height} tiles`)
            }
            break
          case 'v':
            // Paste clipboard (stolen from Tiled/Photoshop)
            if (clipboard && mapData) {
              e.preventDefault()
              // Paste at current selection position or (0,0)
              const pasteX = selection?.x ?? 0
              const pasteY = selection?.y ?? 0
              const tiles: Array<{ x: number; y: number; tileId: number }> = []

              for (let dy = 0; dy < clipboard.height; dy++) {
                for (let dx = 0; dx < clipboard.width; dx++) {
                  const mapX = pasteX + dx
                  const mapY = pasteY + dy
                  if (mapX >= 0 && mapX < mapData.width && mapY >= 0 && mapY < mapData.height) {
                    const tileId = clipboard.tiles[dy][dx]
                    tiles.push({ x: mapX, y: mapY, tileId })
                  }
                }
              }

              if (tiles.length > 0) {
                paintTiles(activeLayerIndex, tiles)
                toast.success(`Pasted ${clipboard.width}×${clipboard.height} tiles at (${pasteX}, ${pasteY})`)
              }
            }
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
          case '=':
          case '+':
            e.preventDefault()
            zoomIn()
            break
          case '-':
            e.preventDefault()
            zoomOut()
            break
          case '0':
            e.preventDefault()
            zoomReset()
            break
        }
        return
      }

      // Arrow key pan (nudge by 1 tile = 32px)
      const NUDGE = 32 * zoom
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          nudgePan(0, NUDGE)
          break
        case 'ArrowDown':
          e.preventDefault()
          nudgePan(0, -NUDGE)
          break
        case 'ArrowLeft':
          e.preventDefault()
          nudgePan(NUDGE, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          nudgePan(-NUDGE, 0)
          break
      }

      // Tool shortcuts (single keys)
      switch (e.key.toLowerCase()) {
        case 'b':
          setTool('brush')
          break
        case 'f':
          setTool('fill')
          break
        case 'r':
          setTool('rectangle')
          break
        case 'l':
          setTool('line')
          break
        case 'e':
          setTool('eraser')
          break
        case 's':
          setTool('select')
          break
        case 'i':
          setTool('eyedropper')
          break
        case 'g':
          toggleGrid()
          break
        case 'escape':
          // Clear selection (stolen from Photoshop/Tiled)
          if (selection) {
            clearSelection()
            toast.info('Selection cleared')
          }
          break
        case 'delete':
        case 'backspace':
          if (selectedEntityId) {
            deleteEntity(selectedEntityId)
            setSelectedEntityId(null)
            toast.success('Entity deleted')
          }
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpaceHeld(false)
        // Restore previous tool
        if (previousTool) {
          setTool(previousTool)
          setPreviousTool(null)
        }
      }
      if (e.key === 'Shift') setShiftHeld(false)
      if (e.key === 'Control' || e.key === 'Meta') setCtrlHeld(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    spaceHeld, previousTool, currentTool, selectedEntityId, zoom,
    handleSave, handleExport, undo, redo, zoomIn, zoomOut, zoomReset,
    nudgePan, toggleGrid, setTool, setPreviousTool,
    setSpaceHeld, setShiftHeld, setCtrlHeld, deleteEntity, setSelectedEntityId,
    selection, clipboard, copySelection, clearSelection, paintTiles, activeLayerIndex, mapData,
  ])

  // ============== Paint Operations ==============
  const handlePaint = useCallback((layerIndex: number, x: number, y: number, tileId: number) => {
    if (currentTool === 'eraser') {
      paintTile(layerIndex, x, y, 0)
    } else {
      paintTile(layerIndex, x, y, tileId)
    }
  }, [currentTool, paintTile])

  const handleBatchPaint = useCallback((layerIndex: number, tiles: Array<{ x: number; y: number; tileId: number }>) => {
    paintTiles(layerIndex, tiles)
  }, [paintTiles])

  // ============== Entity Operations ==============
  const handleEntityPlace = useCallback((entity: EntityData) => {
    placeEntity(entity)
    toast.success(`${entity.type} placed`)
  }, [placeEntity])

  const handleEntityTypeSelect = useCallback((type: EntityType) => {
    const entityId = `${type}_${Date.now()}`
    const baseSize = mapData?.tileSize || 32

    const getEntityDimensions = () => {
      switch (type) {
        case 'ladder':
          return { width: baseSize, height: baseSize * 2 }
        default:
          return { width: baseSize, height: baseSize }
      }
    }

    const getEntityProperties = () => {
      switch (type) {
        case 'door':
          return { interactionId: 'door_wooden', targetRoom: '', targetSpawn: '' }
        case 'portal':
          return { targetRoom: '', targetSpawn: '', portalType: 'default' }
        case 'stairs':
        case 'ladder':
          return { targetRoom: '', targetSpawn: '', direction: 'up' }
        default:
          return {}
      }
    }

    const { width, height } = getEntityDimensions()
    const entity: EntityData = {
      id: entityId,
      type,
      x: 100,
      y: 100,
      width,
      height,
      properties: getEntityProperties(),
    }

    handleEntityPlace(entity)
    setSelectedEntityId(entityId)
  }, [handleEntityPlace, setSelectedEntityId])

  const handleLayerToggle = useCallback((index: number, prop: 'visible' | 'locked') => {
    if (prop === 'visible') {
      toggleLayerVisible(index)
    } else {
      toggleLayerLocked(index)
    }
  }, [toggleLayerVisible, toggleLayerLocked])

  const selectedEntity = mapData?.layers
    .find(l => l.name === 'Entities')
    ?.objects?.find(o => o.id === selectedEntityId) || null

  // Show loading state if mapData isn't ready yet
  if (!mapData) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">PrairieBob</h1>
          <p className="text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Toaster position="top-right" />

      {/* Tileset Import Dialog */}
      <TilesetImportDialog
        open={importDialogOpen}
        filePath={pendingImportPath}
        onClose={closeImportDialog}
        onConfirm={handleImportConfirm}
      />

      {/* Toolbar */}
      <Toolbar
        currentTool={spaceHeld ? 'select' : currentTool}
        onToolChange={setTool}
        gridVisible={gridVisible}
        onGridToggle={toggleGrid}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => { undo(); toast.info('Undo') }}
        onRedo={() => { redo(); toast.info('Redo') }}
        onExport={handleExport}
        onSave={handleSave}
      />

      {/* Main Content - Resizable Panels (Tiled-style) */}
      <PanelGroup orientation="vertical" className="flex-1">
        <Panel defaultSize={75} minSize={40}>
          <PanelGroup orientation="horizontal" className="h-full">
            {/* Left Panel - Tilesets */}
            <Panel
              defaultSize={leftPanelSize}
              minSize={leftPanelMinSize}
              maxSize={leftPanelMaxSize}
              collapsible
              onResize={(size) => setPanelSize('left', size.asPercentage)}
              className="bg-card"
            >
              <div className="h-full overflow-y-auto p-4">
                <TilesetPanel
                  tilesets={tilesets}
                  activeTilesetId={activeTilesetId}
                  selectedTileId={selectedTileId}
                  stamp={stamp}
                  tilesetZoom={tilesetZoom}
                  onTilesetSelect={setActiveTilesetId}
                  onTileSelect={handleTileSelect}
                  onStampSelect={setStamp}
                  onTilesetZoomChange={setTilesetZoom}
                  onAddTileset={handleAddTileset}
                  onRemoveTileset={handleRemoveTileset}
                />
                <EntityPalette onEntityTypeSelect={handleEntityTypeSelect} />
              </div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="panel-resize-handle" />

            {/* Center Panel - Canvas */}
            <Panel className="bg-background">
              <MapCanvas
                mapData={mapData}
                tilesets={tilesets}
                currentTool={spaceHeld ? 'select' : currentTool}
                selectedTileId={selectedTileId}
                stamp={stamp}
                activeLayerIndex={activeLayerIndex}
                zoom={zoom}
                panX={panX}
                panY={panY}
                gridVisible={gridVisible}
                selectedEntityId={selectedEntityId}
                onPanChange={setPan}
                onZoomChange={setZoom}
                onZoomToPoint={zoomToPoint}
                onPaint={handlePaint}
                onBatchPaint={handleBatchPaint}
                onFill={fillArea}
                onEntityPlace={handleEntityPlace}
                onEntitySelect={setSelectedEntityId}
                onEntityMove={moveEntity}
                onTileSelect={handleTileSelect}
                onCursorTileChange={setCursorTile}
                selection={selection}
                onSelectionChange={setSelection}
              />
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="panel-resize-handle" />

            {/* Right Panel - Layers & Properties */}
            <Panel
              defaultSize={rightPanelSize}
              minSize={rightPanelMinSize}
              maxSize={rightPanelMaxSize}
              collapsible
              onResize={(size) => setPanelSize('right', size.asPercentage)}
              className="bg-card"
            >
              <div className="h-full overflow-y-auto p-4 space-y-4">
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
                <PropertiesPanel
                  selectedEntity={selectedEntity}
                  onEntityUpdate={updateEntity}
                  onEntityDelete={(id) => {
                    deleteEntity(id)
                    setSelectedEntityId(null)
                    toast.success('Entity deleted')
                  }}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Resize Handle - Vertical */}
        <PanelResizeHandle className="panel-resize-handle-horizontal" />

        {/* Bottom Panel - Agent/Terminal */}
        <Panel defaultSize={25} minSize={15} maxSize={50} collapsible className="bg-card">
          <AgentPanel />
        </Panel>
      </PanelGroup>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-primary border-t border-border flex gap-4 text-sm font-mono">
        {projectName && <span className="text-accent font-semibold">{projectName}</span>}
        <span>Tool: {spaceHeld ? 'pan (space)' : currentTool}</span>
        <span>Layer: {mapData.layers[activeLayerIndex]?.name}</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span>Tile: {selectedTileId}</span>
        {stamp.width > 1 || stamp.height > 1 ? (
          <span>Stamp: {stamp.width}×{stamp.height}</span>
        ) : null}
        <span>Tilesets: {tilesets.filter(ts => ts.status === 'ready').length}</span>
        <span className="ml-auto">
          {hasUnsavedChanges ? '● Unsaved' : 'Saved'}
        </span>
      </div>

      {/* Startup Dialogs */}
      <ProjectSelector />
      <NewProjectWizard />
    </div>
  )
}

export default App
