import { useEffect, useRef, useState } from 'react'
import { LevelData, Tool, EntityData } from '@/lib/types'
import { getTileFromTileset } from '@/lib/tileset'
import { toast } from 'sonner'

interface MapCanvasProps {
  mapData: LevelData
  tileset: HTMLCanvasElement | null
  currentTool: Tool
  selectedTileId: number
  activeLayerIndex: number
  zoom: number
  panX: number
  panY: number
  gridVisible: boolean
  selectedEntityId: string | null
  onPanChange: (x: number, y: number) => void
  onPaint: (layerIndex: number, x: number, y: number, tileId: number) => void
  onBatchPaint?: (layerIndex: number, tiles: Array<{ x: number; y: number; tileId: number }>) => void
  onEntityPlace: (entity: EntityData) => void
  onEntitySelect: (id: string | null) => void
  onEntityMove: (id: string, x: number, y: number) => void
}

export function MapCanvas({
  mapData,
  tileset,
  currentTool,
  selectedTileId,
  activeLayerIndex,
  zoom,
  panX,
  panY,
  gridVisible,
  selectedEntityId,
  onPanChange,
  onPaint,
  onBatchPaint,
  onEntityPlace,
  onEntitySelect,
  onEntityMove,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [isPainting, setIsPainting] = useState(false)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingEntity, setIsDraggingEntity] = useState(false)
  const [rectangleStart, setRectangleStart] = useState<{ x: number; y: number } | null>(null)
  const [rectangleEnd, setRectangleEnd] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    renderCanvas()
  }, [mapData, tileset, zoom, panX, panY, gridVisible, selectedEntityId, cursorPos, rectangleStart, rectangleEnd])

  const renderCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !tileset) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    const tileSize = mapData.tileSize
    const tilesPerRow = 16

    for (const layer of mapData.layers) {
      if (!layer.visible) continue

      if (layer.type === 'tilelayer' && layer.data) {
        for (let i = 0; i < layer.data.length; i++) {
          const tileId = layer.data[i]
          if (tileId === 0) continue

          const x = (i % mapData.width) * tileSize
          const y = Math.floor(i / mapData.width) * tileSize

          if (layer.name === 'Collision') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
            ctx.fillRect(x, y, tileSize, tileSize)
          } else {
            const tileCanvas = getTileFromTileset(tileset, tileId, tileSize, tilesPerRow)
            ctx.drawImage(tileCanvas, x, y)
          }
        }
      }

      if (layer.type === 'objectgroup' && layer.objects) {
        for (const obj of layer.objects) {
          const isSelected = obj.id === selectedEntityId
          
          ctx.fillStyle = isSelected ? 'rgba(255, 200, 0, 0.5)' : 'rgba(100, 150, 255, 0.4)'
          ctx.fillRect(obj.x, obj.y, obj.width, obj.height)
          
          ctx.strokeStyle = isSelected ? 'rgba(255, 200, 0, 1)' : 'rgba(100, 150, 255, 0.8)'
          ctx.lineWidth = isSelected ? 2 : 1
          ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)

          ctx.fillStyle = '#fff'
          ctx.font = '10px Inter'
          ctx.fillText(obj.type, obj.x + 2, obj.y + 12)
        }
      }
    }

    if (gridVisible) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= mapData.width * tileSize; x += tileSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, mapData.height * tileSize)
        ctx.stroke()
      }
      for (let y = 0; y <= mapData.height * tileSize; y += tileSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(mapData.width * tileSize, y)
        ctx.stroke()
      }
    }

    if (cursorPos && currentTool === 'brush' && selectedTileId > 0) {
      const tileCanvas = getTileFromTileset(tileset, selectedTileId, tileSize, tilesPerRow)
      ctx.globalAlpha = 0.6
      ctx.drawImage(tileCanvas, cursorPos.x * tileSize, cursorPos.y * tileSize)
      ctx.globalAlpha = 1
    }

    if (rectangleStart && rectangleEnd && currentTool === 'rectangle' && selectedTileId > 0) {
      const startX = Math.min(rectangleStart.x, rectangleEnd.x)
      const startY = Math.min(rectangleStart.y, rectangleEnd.y)
      const endX = Math.max(rectangleStart.x, rectangleEnd.x)
      const endY = Math.max(rectangleStart.y, rectangleEnd.y)

      ctx.globalAlpha = 0.6
      const tileCanvas = getTileFromTileset(tileset, selectedTileId, tileSize, tilesPerRow)
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          ctx.drawImage(tileCanvas, x * tileSize, y * tileSize)
        }
      }
      ctx.globalAlpha = 1

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(
        startX * tileSize,
        startY * tileSize,
        (endX - startX + 1) * tileSize,
        (endY - startY + 1) * tileSize
      )
    }

    ctx.restore()
  }

  const screenToWorld = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = (screenX - rect.left - panX) / zoom
    const y = (screenY - rect.top - panY) / zoom

    return { x, y }
  }

  const worldToTile = (worldX: number, worldY: number) => {
    return {
      x: Math.floor(worldX / mapData.tileSize),
      y: Math.floor(worldY / mapData.tileSize),
    }
  }

  const floodFill = (startX: number, startY: number, targetTileId: number, replacementTileId: number) => {
    const layer = mapData.layers[activeLayerIndex]
    if (layer.type !== 'tilelayer' || !layer.data) return []

    if (targetTileId === replacementTileId) return []

    const filled: Array<{ x: number; y: number }> = []
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break

      const key = `${current.x},${current.y}`
      if (visited.has(key)) continue
      if (current.x < 0 || current.x >= mapData.width || current.y < 0 || current.y >= mapData.height) continue

      const index = current.y * mapData.width + current.x
      if (layer.data[index] !== targetTileId) continue

      visited.add(key)
      filled.push({ x: current.x, y: current.y })

      queue.push({ x: current.x + 1, y: current.y })
      queue.push({ x: current.x - 1, y: current.y })
      queue.push({ x: current.x, y: current.y + 1 })
      queue.push({ x: current.x, y: current.y - 1 })
    }

    return filled
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY)
    const tile = worldToTile(world.x, world.y)

    if (e.button === 1) {
      setIsPanning(true)
      setLastMousePos({ x: e.clientX, y: e.clientY })
      return
    }

    if (e.button === 0) {
      const layer = mapData.layers[activeLayerIndex]
      
      if (layer.type === 'objectgroup') {
        const clickedEntity = layer.objects?.find(
          obj => world.x >= obj.x && world.x <= obj.x + obj.width &&
                 world.y >= obj.y && world.y <= obj.y + obj.height
        )
        
        if (clickedEntity) {
          onEntitySelect(clickedEntity.id)
          setIsDraggingEntity(true)
        } else {
          onEntitySelect(null)
        }
      } else if (layer.type === 'tilelayer') {
        if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
          if (currentTool === 'brush') {
            setIsPainting(true)
            onPaint(activeLayerIndex, tile.x, tile.y, selectedTileId)
          } else if (currentTool === 'fill' && layer.data) {
            const index = tile.y * mapData.width + tile.x
            const targetTileId = layer.data[index]
            const tilesToFill = floodFill(tile.x, tile.y, targetTileId, selectedTileId)
            
            if (tilesToFill.length > 0) {
              if (onBatchPaint) {
                onBatchPaint(activeLayerIndex, tilesToFill.map(({ x, y }) => ({ x, y, tileId: selectedTileId })))
              } else {
                tilesToFill.forEach(({ x, y }) => {
                  onPaint(activeLayerIndex, x, y, selectedTileId)
                })
              }
              toast.success(`Filled ${tilesToFill.length} tiles`)
            }
          } else if (currentTool === 'rectangle') {
            setRectangleStart(tile)
            setRectangleEnd(tile)
          } else if (currentTool === 'eraser') {
            setIsPainting(true)
            onPaint(activeLayerIndex, tile.x, tile.y, 0)
          }
        }
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const world = screenToWorld(e.clientX, e.clientY)
    const tile = worldToTile(world.x, world.y)

    if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
      setCursorPos(tile)
    } else {
      setCursorPos(null)
    }

    if (isPanning) {
      const dx = e.clientX - lastMousePos.x
      const dy = e.clientY - lastMousePos.y
      onPanChange(panX + dx, panY + dy)
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }

    if (isPainting && (currentTool === 'brush' || currentTool === 'eraser')) {
      if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
        onPaint(activeLayerIndex, tile.x, tile.y, currentTool === 'eraser' ? 0 : selectedTileId)
      }
    }

    if (rectangleStart && currentTool === 'rectangle') {
      if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
        setRectangleEnd(tile)
      }
    }

    if (isDraggingEntity && selectedEntityId) {
      onEntityMove(selectedEntityId, world.x, world.y)
    }
  }

  const handleMouseUp = () => {
    if (rectangleStart && rectangleEnd && currentTool === 'rectangle') {
      const startX = Math.min(rectangleStart.x, rectangleEnd.x)
      const startY = Math.min(rectangleStart.y, rectangleEnd.y)
      const endX = Math.max(rectangleStart.x, rectangleEnd.x)
      const endY = Math.max(rectangleStart.y, rectangleEnd.y)

      const tiles: Array<{ x: number; y: number; tileId: number }> = []
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          tiles.push({ x, y, tileId: selectedTileId })
        }
      }

      if (tiles.length > 0) {
        if (onBatchPaint) {
          onBatchPaint(activeLayerIndex, tiles)
        } else {
          tiles.forEach(({ x, y, tileId }) => {
            onPaint(activeLayerIndex, x, y, tileId)
          })
        }
        const width = endX - startX + 1
        const height = endY - startY + 1
        toast.success(`Rectangle drawn: ${width}×${height} (${tiles.length} tiles)`)
      }

      setRectangleStart(null)
      setRectangleEnd(null)
    }

    setIsPanning(false)
    setIsPainting(false)
    setIsDraggingEntity(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.25, Math.min(4, zoom * delta))
    onPanChange(panX, panY)
  }

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  )
}
