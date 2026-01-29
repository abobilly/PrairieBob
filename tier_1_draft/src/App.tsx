import { useEffect, useState, useCallback } from 'react'
import { LevelData, Tool, EntityType, EntityData } from '@/lib/types'
import { createTilesetCanvas } from '@/lib/tileset'
import { Toolbar } from '@/components/Toolbar'
import { MapCanvas } from '@/components/MapCanvas'
import { LayerPanel } from '@/components/LayerPanel'
import { TilesetPanel } from '@/components/TilesetPanel'
import { EntityPalette } from '@/components/EntityPalette'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { useHistory } from '@/hooks/useHistory'
import { getFileSystemAdapter } from '@/lib/fs-adapter'
import { Toaster, toast } from 'sonner'

const DEFAULT_MAP: LevelData = {
  id: 'test_room',
  width: 30,
  height: 20,
  tileSize: 16,
  layers: [
    { name: 'Floor', type: 'tilelayer', visible: true, locked: false, data: new Array(30 * 20).fill(0) },
    { name: 'Walls', type: 'tilelayer', visible: true, locked: false, data: new Array(30 * 20).fill(0) },
    { name: 'Trim', type: 'tilelayer', visible: true, locked: false, data: new Array(30 * 20).fill(0) },
    { name: 'Overlays', type: 'tilelayer', visible: true, locked: false, data: new Array(30 * 20).fill(0) },
    { name: 'Collision', type: 'tilelayer', visible: true, locked: false, data: new Array(30 * 20).fill(0) },
    { name: 'Entities', type: 'objectgroup', visible: true, locked: false, objects: [] },
  ],
  metadata: {
    editedAt: new Date().toISOString(),
    exportedFrom: 'prairiebob',
    version: '1.0.0',
  },
}

// Zoom constraints (borrowed from Tiled's defaults)
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

function App() {
  // Use history hook for undo/redo
  const {
    state: mapData,
    setState: setMapData,
    undo,
    redo,
    canUndo,
    canRedo
  } = useHistory<LevelData>(DEFAULT_MAP)

  const [currentRoomPath, setCurrentRoomPath] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [tileset, setTileset] = useState<HTMLCanvasElement | null>(null)
  const [currentTool, setCurrentTool] = useState<Tool>('brush')
  const [selectedTileId, setSelectedTileId] = useState(1)
  const [activeLayerIndex, setActiveLayerIndex] = useState(0)
  const [zoom, setZoom] = useState(2)
  const [panX, setPanX] = useState(100)
  const [panY, setPanY] = useState(100)
  const [gridVisible, setGridVisible] = useState(true)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  const fsAdapter = getFileSystemAdapter()

  // Mark unsaved changes when map data changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      fsAdapter.setUnsavedChanges(true)
    }
  }, [hasUnsavedChanges, fsAdapter])

  useEffect(() => {
    const tilesetCanvas = createTilesetCanvas()
    setTileset(tilesetCanvas)
  }, [])

  // ============== Zoom Controls ==============
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
  }, [])

  // ============== Save/Export ==============
  const handleSave = useCallback(async () => {
    if (!mapData) return

    const updatedMap = {
      ...mapData,
      metadata: {
        ...mapData.metadata,
        editedAt: new Date().toISOString(),
      },
    }

    if (currentRoomPath) {
      await fsAdapter.saveRoom(currentRoomPath, updatedMap)
      setHasUnsavedChanges(false)
      toast.success('Room saved!')
    } else {
      // No path yet, trigger Save As
      const path = await fsAdapter.saveRoomAs(updatedMap)
      if (path) {
        setCurrentRoomPath(path)
        setHasUnsavedChanges(false)
        toast.success('Room saved!')
      }
    }
  }, [mapData, currentRoomPath, fsAdapter])

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
      window.electron.onMenuUndo(() => undo()),
      window.electron.onMenuRedo(() => redo()),
      window.electron.onMenuToggleGrid(() => setGridVisible(v => !v)),
      window.electron.onMenuZoomIn(() => handleZoomIn()),
      window.electron.onMenuZoomOut(() => handleZoomOut()),
      window.electron.onMenuZoomReset(() => handleZoomReset()),
      window.electron.onMenuExport(() => handleExport()),
      window.electron.onRoomOpened(({ path, content }) => {
        try {
          const data = JSON.parse(content) as LevelData
          setMapData(data, false) // Don't record in history
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
  }, [handleSave, handleExport, handleZoomIn, handleZoomOut, handleZoomReset, undo, redo, mapData, fsAdapter, setMapData])

  // ============== Keyboard Shortcuts ==============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            handleZoomIn()
            break
          case '-':
            e.preventDefault()
            handleZoomOut()
            break
          case '0':
            e.preventDefault()
            handleZoomReset()
            break
        }
        return
      }

      // Tool shortcuts (single keys)
      switch (e.key.toLowerCase()) {
        case 'b':
          setCurrentTool('brush')
          break
        case 'f':
          setCurrentTool('fill')
          break
        case 'r':
          setCurrentTool('rectangle')
          break
        case 'e':
          setCurrentTool('eraser')
          break
        case 's':
          setCurrentTool('select')
          break
        case 'i':
          // Eyedropper - sample tile under cursor (TODO: implement in MapCanvas)
          setCurrentTool('eyedropper' as Tool)
          break
        case 'g':
          setGridVisible(prev => !prev)
          break
        case 'delete':
        case 'backspace':
          if (selectedEntityId) {
            handleEntityDelete(selectedEntityId)
          }
          break
      }
    }

    // Mouse wheel zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          handleZoomIn()
        } else {
          handleZoomOut()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [selectedEntityId, handleSave, handleExport, undo, redo, handleZoomIn, handleZoomOut, handleZoomReset])

  // ============== Paint Operations ==============
  const handlePaint = (layerIndex: number, x: number, y: number, tileId: number) => {
    setHasUnsavedChanges(true)
    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      const newMapData = { ...current }
      const layer = newMapData.layers[layerIndex]

      if (layer.type === 'tilelayer' && layer.data) {
        const newData = [...layer.data]
        const index = y * current.width + x

        if (currentTool === 'eraser') {
          newData[index] = 0
        } else {
          newData[index] = tileId
        }

        layer.data = newData
      }

      return newMapData
    })
  }

  const handleBatchPaint = (layerIndex: number, tiles: Array<{ x: number; y: number; tileId: number }>) => {
    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      const newMapData = { ...current }
      const layer = newMapData.layers[layerIndex]

      if (layer.type === 'tilelayer' && layer.data) {
        const newData = [...layer.data]

        tiles.forEach(({ x, y, tileId }) => {
          const index = y * current.width + x
          if (index >= 0 && index < newData.length) {
            newData[index] = tileId
          }
        })

        layer.data = newData
      }

      return newMapData
    })
  }

  const handleEntityPlace = (entity: EntityData) => {
    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      const newMapData = { ...current }
      const entityLayer = newMapData.layers.find(l => l.name === 'Entities')

      if (entityLayer && entityLayer.type === 'objectgroup') {
        if (!entityLayer.objects) entityLayer.objects = []
        entityLayer.objects.push(entity)
      }

      return newMapData
    })

    toast.success(`${entity.type} placed`)
  }

  const handleEntitySelect = (id: string | null) => {
    setSelectedEntityId(id)
  }

  const handleEntityUpdate = (id: string, updates: Partial<EntityData>) => {
    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      const newMapData = { ...current }
      const entityLayer = newMapData.layers.find(l => l.name === 'Entities')

      if (entityLayer && entityLayer.type === 'objectgroup' && entityLayer.objects) {
        const objIndex = entityLayer.objects.findIndex(o => o.id === id)
        if (objIndex !== -1) {
          entityLayer.objects[objIndex] = {
            ...entityLayer.objects[objIndex],
            ...updates,
          }
        }
      }

      return newMapData
    })
  }

  const handleEntityMove = (id: string, x: number, y: number) => {
    handleEntityUpdate(id, { x, y })
  }

  const handleEntityDelete = (id: string) => {
    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      const newMapData = { ...current }
      const entityLayer = newMapData.layers.find(l => l.name === 'Entities')

      if (entityLayer && entityLayer.type === 'objectgroup' && entityLayer.objects) {
        entityLayer.objects = entityLayer.objects.filter(o => o.id !== id)
      }

      return newMapData
    })

    setSelectedEntityId(null)
    toast.success('Entity deleted')
  }

  const handleEntityTypeSelect = (type: EntityType) => {
    const entityId = `${type}_${Date.now()}`
    const entity: EntityData = {
      id: entityId,
      type,
      x: 100,
      y: 100,
      width: type === 'door' ? 32 : 16,
      height: 16,
      properties: type === 'door' ? { interactionId: 'door_wooden' } : {},
    }

    handleEntityPlace(entity)
    setSelectedEntityId(entityId)
  }

  const handleLayerToggle = (index: number, prop: 'visible' | 'locked') => {
    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      const newMapData = { ...current }
      newMapData.layers[index][prop] = !newMapData.layers[index][prop]
      return newMapData
    })
  }

  const selectedEntity = mapData?.layers
    .find(l => l.name === 'Entities')
    ?.objects?.find(o => o.id === selectedEntityId) || null

  if (!mapData) return null

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Toaster position="top-right" />

      <Toolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        gridVisible={gridVisible}
        onGridToggle={() => setGridVisible(prev => !prev)}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onExport={handleExport}
        onSave={handleSave}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-border p-4 overflow-y-auto bg-card">
          <TilesetPanel
            tileset={tileset}
            selectedTileId={selectedTileId}
            onTileSelect={setSelectedTileId}
          />
          <EntityPalette onEntityTypeSelect={handleEntityTypeSelect} />
        </div>

        <div className="flex-1 bg-background">
          <MapCanvas
            mapData={mapData}
            tileset={tileset}
            currentTool={currentTool}
            selectedTileId={selectedTileId}
            activeLayerIndex={activeLayerIndex}
            zoom={zoom}
            panX={panX}
            panY={panY}
            gridVisible={gridVisible}
            selectedEntityId={selectedEntityId}
            onPanChange={(x, y) => {
              setPanX(x)
              setPanY(y)
            }}
            onPaint={handlePaint}
            onBatchPaint={handleBatchPaint}
            onEntityPlace={handleEntityPlace}
            onEntitySelect={handleEntitySelect}
            onEntityMove={handleEntityMove}
          />
        </div>

        <div className="w-64 border-l border-border p-4 space-y-4 overflow-y-auto bg-card">
          <LayerPanel
            layers={mapData.layers}
            activeLayerIndex={activeLayerIndex}
            onLayerSelect={setActiveLayerIndex}
            onLayerToggle={handleLayerToggle}
          />
          <PropertiesPanel
            selectedEntity={selectedEntity}
            onEntityUpdate={handleEntityUpdate}
            onEntityDelete={handleEntityDelete}
          />
        </div>
      </div>

      <div className="px-4 py-2 bg-primary border-t border-border flex gap-4 text-sm font-mono">
        <span>Tool: {currentTool}</span>
        <span>Layer: {mapData.layers[activeLayerIndex]?.name}</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span className="ml-auto">kimbar - Connected</span>
      </div>
    </div>
  )
}

export default App