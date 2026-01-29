import { useEffect, useState } from 'react'
import { LevelData, Tool, EntityType, EntityData } from '@/lib/types'
import { createTilesetCanvas } from '@/lib/tileset'
import { Toolbar } from '@/components/Toolbar'
import { MapCanvas } from '@/components/MapCanvas'
import { LayerPanel } from '@/components/LayerPanel'
import { TilesetPanel } from '@/components/TilesetPanel'
import { EntityPalette } from '@/components/EntityPalette'
import { PropertiesPanel } from '@/components/PropertiesPanel'
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

function App() {
  const [mapData, setMapData] = useState<LevelData>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('prairiebob-map')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* ignore */ }
    }
    return DEFAULT_MAP
  })

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('prairiebob-map', JSON.stringify(mapData))
  }, [mapData])

  const [tileset, setTileset] = useState<HTMLCanvasElement | null>(null)
  const [currentTool, setCurrentTool] = useState<Tool>('brush')
  const [selectedTileId, setSelectedTileId] = useState(1)
  const [activeLayerIndex, setActiveLayerIndex] = useState(0)
  const [zoom, setZoom] = useState(2)
  const [panX, setPanX] = useState(100)
  const [panY, setPanY] = useState(100)
  const [gridVisible, setGridVisible] = useState(true)
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)

  useEffect(() => {
    const tilesetCanvas = createTilesetCanvas()
    setTileset(tilesetCanvas)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault()
          handleSave()
        } else if (e.key === 'e') {
          e.preventDefault()
          handleExport()
        }
        return
      }

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
        case 'g':
          setGridVisible(prev => !prev)
          break
        case 'delete':
          if (selectedEntityId) {
            handleEntityDelete(selectedEntityId)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEntityId])

  const handlePaint = (layerIndex: number, x: number, y: number, tileId: number) => {
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

  const handleSave = () => {
    if (!mapData) return

    setMapData(current => {
      if (!current) return {
        id: 'test_room',
        width: 30,
        height: 20,
        tileSize: 16,
        layers: [],
        metadata: { editedAt: new Date().toISOString(), exportedFrom: 'prairiebob', version: '1.0.0' }
      }

      return {
        ...current,
        metadata: {
          ...current.metadata,
          editedAt: new Date().toISOString(),
        },
      }
    })

    toast.success('Map saved!')
  }

  const handleExport = () => {
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