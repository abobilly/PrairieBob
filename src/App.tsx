/**
 * PrairieBob Main App
 * 
 * UX patterns stolen from:
 * - Tiled: Resizable panels, stamp brushes, undo/redo
 * - LDtk: Modern state management, visual polish
 * - Ogmo: Layer organization
 * - YATE: Tileset organization
 */

import { useEffect, useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelBottomClose, PanelBottomOpen } from 'lucide-react'
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
import { NotificationContainer } from '@/components/Notification'
import { DialogContainer } from '@/components/Dialog'

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
    togglePanelCollapsed,
    setTilesetZoom,
  } = useUIStore()

  const fsAdapter = getFileSystemAdapter()

  // Panel visibility from store
  const leftPanelOpen = !panels.left.collapsed
  const rightPanelOpen = !panels.right.collapsed
  const bottomPanelOpen = !panels.bottom.collapsed

  // ============== Initialize ==============
  useEffect(() => {
    console.log('[App] Mount - projectName:', projectName, 'tilesets:', tilesets.length, 'mapData.layers:', mapData?.layers?.length)
    // Don't auto-load - let the project selector handle it
    // The ProjectSelector shows by default (showProjectSelector: true in uiStore)
  }, [])

  useEffect(() => {
    // Fallback: init tilesets if project loading didn't happen
    console.log('[App] tilesets effect - count:', tilesets.length)
    if (tilesets.length === 0) {
      console.log('[App] No tilesets, calling initTilesets()')
      initTilesets()
    }
  }, [initTilesets, tilesets.length])

  useEffect(() => {
    console.log('[App] activeTilesetId effect - tilesets:', tilesets.length, 'activeTilesetId:', activeTilesetId)
    if (tilesets.length > 0 && !activeTilesetId) {
      console.log('[App] Setting activeTilesetId to:', tilesets[0].id)
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
        if (currentTool !== 'pan') {
          setPreviousTool(currentTool)
          setTool('pan')
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
        case 'p':
          setTool('pan')
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

  // Debug: log that we're rendering the main UI
  console.log('[App] Rendering main UI - mapData:', mapData?.id, 'layers:', mapData?.layers?.length, 'tilesets:', tilesets.length)

  return (
    <div className="pb-app h-screen w-screen overflow-hidden flex flex-col">
      <Toaster position="top-right" theme="dark" />
      <NotificationContainer />
      <DialogContainer />

      {/* Tileset Import Dialog */}
      <TilesetImportDialog
        open={importDialogOpen}
        filePath={pendingImportPath}
        onClose={closeImportDialog}
        onConfirm={handleImportConfirm}
      />

      {/* Toolbar */}
      <Toolbar
        currentTool={currentTool}
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

      {/* Main Content - LDtk-style Panels */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top section: left panel + canvas + right panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Left Panel - Tilesets */}
          {leftPanelOpen && (
            <div className="w-72 pb-panel border-r border-[var(--pb-border)] flex flex-col shrink-0">
              <div className="pb-panel-header">
                <span className="pb-panel-title">Tilesets</span>
                <button
                  onClick={() => togglePanelCollapsed('left')}
                  className="pb-panel-btn"
                  title="Close Tileset Panel"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <div className="pb-panel-content">
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
            </div>
          )}

          {/* Left panel toggle when collapsed */}
          {!leftPanelOpen && (
            <button
              onClick={() => togglePanelCollapsed('left')}
              className="pb-panel-toggle border-r border-[var(--pb-border)]"
              title="Open Tileset Panel"
            >
              <PanelLeftOpen className="w-4 h-4 text-[var(--pb-text-muted)]" />
            </button>
          )}

          {/* Center Panel - Canvas */}
          <div className="flex-1 pb-canvas-area min-w-0 overflow-hidden">
            <MapCanvas
              mapData={mapData}
              tilesets={tilesets}
              currentTool={currentTool}
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
          </div>

          {/* Right panel toggle when collapsed */}
          {!rightPanelOpen && (
            <button
              onClick={() => togglePanelCollapsed('right')}
              className="pb-panel-toggle border-l border-[var(--pb-border)]"
              title="Open Layers Panel"
            >
              <PanelRightOpen className="w-4 h-4 text-[var(--pb-text-muted)]" />
            </button>
          )}

          {/* Right Panel - Layers & Properties */}
          {rightPanelOpen && (
            <div className="w-72 pb-panel border-l border-[var(--pb-border)] flex flex-col shrink-0">
              <div className="pb-panel-header">
                <span className="pb-panel-title">Layers</span>
                <button
                  onClick={() => togglePanelCollapsed('right')}
                  className="pb-panel-btn"
                  title="Close Layers Panel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              <div className="pb-panel-content space-y-4">
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
            </div>
          )}
        </div>

        {/* Bottom panel toggle when collapsed */}
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

        {/* Bottom Panel - Agent/Terminal */}
        {bottomPanelOpen && (
          <div className="h-64 pb-panel border-t border-[var(--pb-border)] flex flex-col shrink-0">
            <div className="pb-panel-header">
              <span className="pb-panel-title">Agent</span>
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
          </div>
        )}
      </div>

      {/* Status Bar (LDtk-style) */}
      <div className="pb-statusbar">
        {projectName && <span className="pb-statusbar-accent">{projectName}</span>}
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Tool:</span> {currentTool}
        </span>
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Layer:</span> {mapData.layers[activeLayerIndex]?.name}
        </span>
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Zoom:</span> {Math.round(zoom * 100)}%
        </span>
        <span className="pb-statusbar-item">
          <span className="text-[var(--pb-text-muted)]">Tile:</span> {selectedTileId}
        </span>
        {stamp.width > 1 || stamp.height > 1 ? (
          <span className="pb-statusbar-item">
            <span className="text-[var(--pb-text-muted)]">Stamp:</span> {stamp.width}×{stamp.height}
          </span>
        ) : null}
        <span className="pb-statusbar-right">
          {hasUnsavedChanges ? (
            <span className="pb-statusbar-unsaved">● Unsaved</span>
          ) : (
            <span className="text-[var(--pb-success)]">✓ Saved</span>
          )}
        </span>
      </div>

      {/* Startup Dialogs */}
      <ProjectSelector />
      <NewProjectWizard />
    </div>
  )
}

export default App
