import { useEffect, useRef, useState, useCallback } from 'react'
import { LevelData, Tool, EntityData, LoadedTileset, TileStamp, TileSelection } from '@/lib/types'
import { resolveTileId } from '@/lib/tileset'
import { toast } from 'sonner'

interface MapCanvasProps {
  mapData: LevelData
  tilesets: LoadedTileset[]
  currentTool: Tool
  selectedTileId: number
  stamp: TileStamp              // Multi-tile stamp support (Tiled-style)
  activeLayerIndex: number
  zoom: number
  panX: number
  panY: number
  gridVisible: boolean
  selectedEntityId: string | null
  onPanChange: (x: number, y: number) => void
  onZoomChange: (zoom: number) => void
  onZoomToPoint: (zoom: number, screenX: number, screenY: number) => void  // Zoom to cursor (Tiled-style)
  onPaint: (layerIndex: number, x: number, y: number, tileId: number) => void
  onBatchPaint?: (layerIndex: number, tiles: Array<{ x: number; y: number; tileId: number }>) => void
  onFill?: (layerIndex: number, startX: number, startY: number, tileId: number) => void
  onEntityPlace: (entity: EntityData) => void
  onEntitySelect: (id: string | null) => void
  onEntityMove: (id: string, x: number, y: number) => void
  onTileSelect?: (globalTileId: number) => void
  onCursorTileChange?: (x: number | null, y: number | null) => void
  // Selection/clipboard support (stolen from Tiled)
  selection: TileSelection | null
  onSelectionChange: (selection: TileSelection | null) => void
}

export function MapCanvas({
  mapData,
  tilesets,
  currentTool,
  selectedTileId,
  stamp,
  activeLayerIndex,
  zoom,
  panX,
  panY,
  gridVisible,
  selectedEntityId,
  onPanChange,
  onZoomChange,
  onZoomToPoint,
  onPaint,
  onBatchPaint,
  onFill,
  onEntityPlace,
  onEntitySelect,
  onEntityMove,
  onTileSelect,
  onCursorTileChange,
  selection,
  onSelectionChange,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [isPainting, setIsPainting] = useState(false)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingEntity, setIsDraggingEntity] = useState(false)
  const [rectangleStart, setRectangleStart] = useState<{ x: number; y: number } | null>(null)
  const [rectangleEnd, setRectangleEnd] = useState<{ x: number; y: number } | null>(null)
  // Line tool state
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null)
  const [lineEnd, setLineEnd] = useState<{ x: number; y: number } | null>(null)
  // Selection state for copy/paste (drag tracking only - actual selection from props)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null)

  const tileSize = Math.max(1, Math.round(mapData.tileSize))

  // Bresenham's line algorithm for pixel-perfect lines (from Tiled)
  const getLinePoints = useCallback((x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> => {
    const points: Array<{ x: number; y: number }> = []
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx - dy

    let x = x0
    let y = y0

    while (true) {
      points.push({ x, y })
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }
    return points
  }, [])

  // Helper function to draw a tile from its global ID
  const drawTileFromGlobalId = (
    ctx: CanvasRenderingContext2D,
    globalTileId: number,
    x: number,
    y: number,
    tileSize: number
  ) => {
    const resolved = resolveTileId(globalTileId, tilesets)
    if (resolved) {
      const { tileset, localTileId } = resolved
      const col = localTileId % tileset.tilesPerRow
      const row = Math.floor(localTileId / tileset.tilesPerRow)

      ctx.drawImage(
        tileset.canvas,
        col * tileset.tileSize,
        row * tileset.tileSize,
        tileset.tileSize,
        tileset.tileSize,
        x,
        y,
        tileSize,
        tileSize
      )
    } else {
      // Missing tileset - draw magenta placeholder
      ctx.fillStyle = '#FF00FF'
      ctx.fillRect(x, y, tileSize, tileSize)
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, tileSize, tileSize)
      // Draw X
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + tileSize, y + tileSize)
      ctx.moveTo(x + tileSize, y)
      ctx.lineTo(x, y + tileSize)
      ctx.stroke()
    }
  }

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || tilesets.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.max(1, Math.floor(rect.width))
    const displayHeight = Math.max(1, Math.floor(rect.height))
    const pixelWidth = Math.max(1, Math.floor(displayWidth * dpr))
    const pixelHeight = Math.max(1, Math.floor(displayHeight * dpr))

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false

    // tileSize already normalized above

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
            // Use multi-tileset rendering
            drawTileFromGlobalId(ctx, tileId, x, y, tileSize)
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

    // Cursor preview for brush tool - now supports multi-tile stamps (Tiled-style)
    if (cursorPos && currentTool === 'brush') {
      ctx.globalAlpha = 0.5

      // Draw entire stamp pattern at cursor position
      for (let sy = 0; sy < stamp.height; sy++) {
        for (let sx = 0; sx < stamp.width; sx++) {
          const tileId = stamp.tiles[sy]?.[sx] ?? 0
          if (tileId > 0) {
            const drawX = (cursorPos.x + sx) * tileSize
            const drawY = (cursorPos.y + sy) * tileSize
            // Only draw if within map bounds
            if (cursorPos.x + sx < mapData.width && cursorPos.y + sy < mapData.height) {
              drawTileFromGlobalId(ctx, tileId, drawX, drawY, tileSize)
            }
          }
        }
      }

      // Draw stamp outline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2 / zoom
      ctx.strokeRect(
        cursorPos.x * tileSize,
        cursorPos.y * tileSize,
        stamp.width * tileSize,
        stamp.height * tileSize
      )
      ctx.globalAlpha = 1
    }

    // Eraser preview
    if (cursorPos && currentTool === 'eraser') {
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#FF0000'
      ctx.fillRect(cursorPos.x * tileSize, cursorPos.y * tileSize, tileSize, tileSize)
      ctx.globalAlpha = 1
    }

    // Eyedropper preview
    if (cursorPos && currentTool === 'eyedropper') {
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2 / zoom
      ctx.strokeRect(cursorPos.x * tileSize, cursorPos.y * tileSize, tileSize, tileSize)
    }

    // Rectangle preview
    if (rectangleStart && rectangleEnd && currentTool === 'rectangle' && selectedTileId > 0) {
      const startX = Math.min(rectangleStart.x, rectangleEnd.x)
      const startY = Math.min(rectangleStart.y, rectangleEnd.y)
      const endX = Math.max(rectangleStart.x, rectangleEnd.x)
      const endY = Math.max(rectangleStart.y, rectangleEnd.y)

      ctx.globalAlpha = 0.6
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          drawTileFromGlobalId(ctx, selectedTileId, x * tileSize, y * tileSize, tileSize)
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

    // Line tool preview (Tiled-style)
    if (lineStart && lineEnd && currentTool === 'line' && selectedTileId > 0) {
      const linePoints = getLinePoints(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y)
      ctx.globalAlpha = 0.6
      for (const pt of linePoints) {
        if (pt.x >= 0 && pt.x < mapData.width && pt.y >= 0 && pt.y < mapData.height) {
          drawTileFromGlobalId(ctx, selectedTileId, pt.x * tileSize, pt.y * tileSize, tileSize)
        }
      }
      ctx.globalAlpha = 1

      // Draw line indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2 / zoom
      ctx.beginPath()
      ctx.moveTo(lineStart.x * tileSize + tileSize / 2, lineStart.y * tileSize + tileSize / 2)
      ctx.lineTo(lineEnd.x * tileSize + tileSize / 2, lineEnd.y * tileSize + tileSize / 2)
      ctx.stroke()
    }

    // Selection rectangle preview (for copy/paste)
    if (selection && currentTool === 'select') {
      ctx.strokeStyle = 'rgba(0, 150, 255, 1)'
      ctx.lineWidth = 2 / zoom
      ctx.setLineDash([4 / zoom, 4 / zoom])
      ctx.strokeRect(
        selection.x * tileSize,
        selection.y * tileSize,
        selection.width * tileSize,
        selection.height * tileSize
      )
      ctx.setLineDash([])

      // Fill with semi-transparent blue
      ctx.fillStyle = 'rgba(0, 150, 255, 0.1)'
      ctx.fillRect(
        selection.x * tileSize,
        selection.y * tileSize,
        selection.width * tileSize,
        selection.height * tileSize
      )
    }

    // Selection in-progress preview
    if (selectionStart && selectionEnd && currentTool === 'select') {
      const startX = Math.min(selectionStart.x, selectionEnd.x)
      const startY = Math.min(selectionStart.y, selectionEnd.y)
      const endX = Math.max(selectionStart.x, selectionEnd.x)
      const endY = Math.max(selectionStart.y, selectionEnd.y)

      ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)'
      ctx.lineWidth = 2 / zoom
      ctx.setLineDash([4 / zoom, 4 / zoom])
      ctx.strokeRect(
        startX * tileSize,
        startY * tileSize,
        (endX - startX + 1) * tileSize,
        (endY - startY + 1) * tileSize
      )
      ctx.setLineDash([])
    }

    ctx.restore()
  }, [mapData, tilesets, zoom, panX, panY, gridVisible, selectedEntityId, cursorPos, rectangleStart, rectangleEnd, lineStart, lineEnd, selection, selectionStart, selectionEnd, selectedTileId, currentTool, stamp, tileSize])

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      renderCanvas()
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [renderCanvas])

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
      x: Math.floor(worldX / tileSize),
      y: Math.floor(worldY / tileSize),
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
            // Paint entire stamp pattern (multi-tile support from Tiled)
            if (stamp.width === 1 && stamp.height === 1) {
              // Single tile - just paint it
              onPaint(activeLayerIndex, tile.x, tile.y, selectedTileId)
            } else if (onBatchPaint) {
              // Multi-tile stamp - batch paint
              const tiles: Array<{ x: number; y: number; tileId: number }> = []
              for (let sy = 0; sy < stamp.height; sy++) {
                for (let sx = 0; sx < stamp.width; sx++) {
                  const tx = tile.x + sx
                  const ty = tile.y + sy
                  const tileId = stamp.tiles[sy]?.[sx] ?? 0
                  if (tileId > 0 && tx < mapData.width && ty < mapData.height) {
                    tiles.push({ x: tx, y: ty, tileId })
                  }
                }
              }
              if (tiles.length > 0) {
                onBatchPaint(activeLayerIndex, tiles)
              }
            }
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
          } else if (currentTool === 'line') {
            // Line tool start (Tiled-style)
            setLineStart(tile)
            setLineEnd(tile)
          } else if (currentTool === 'select') {
            // Start selection rectangle for copy/paste
            setSelectionStart(tile)
            setSelectionEnd(tile)
            onSelectionChange(null)  // Clear existing selection
          } else if (currentTool === 'eraser') {
            setIsPainting(true)
            onPaint(activeLayerIndex, tile.x, tile.y, 0)
          } else if (currentTool === 'eyedropper' && layer.data) {
            // Eyedropper: sample the tile under cursor
            const index = tile.y * mapData.width + tile.x
            const sampledTileId = layer.data[index]
            if (sampledTileId > 0 && onTileSelect) {
              onTileSelect(sampledTileId)
              toast.success(`Sampled tile ${sampledTileId}`)
            } else if (sampledTileId === 0) {
              toast.info('Empty tile (no tile to sample)')
            }
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

    // Line tool drag
    if (lineStart && currentTool === 'line') {
      if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
        setLineEnd(tile)
      }
    }

    // Selection drag
    if (selectionStart && currentTool === 'select') {
      if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
        setSelectionEnd(tile)
      }
    }

    if (isDraggingEntity && selectedEntityId) {
      onEntityMove(selectedEntityId, world.x, world.y)
    }
  }

  const handleMouseUp = () => {
    // Rectangle tool commit
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

    // Line tool commit (stolen from Tiled/Aseprite)
    if (lineStart && lineEnd && currentTool === 'line') {
      const linePoints = getLinePoints(lineStart.x, lineStart.y, lineEnd.x, lineEnd.y)
      const tiles: Array<{ x: number; y: number; tileId: number }> = []

      for (const point of linePoints) {
        if (point.x >= 0 && point.x < mapData.width && point.y >= 0 && point.y < mapData.height) {
          tiles.push({ x: point.x, y: point.y, tileId: selectedTileId })
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
        toast.success(`Line drawn: ${tiles.length} tiles`)
      }

      setLineStart(null)
      setLineEnd(null)
    }

    // Selection tool commit
    if (selectionStart && selectionEnd && currentTool === 'select') {
      const startX = Math.min(selectionStart.x, selectionEnd.x)
      const startY = Math.min(selectionStart.y, selectionEnd.y)
      const endX = Math.max(selectionStart.x, selectionEnd.x)
      const endY = Math.max(selectionStart.y, selectionEnd.y)

      const layer = mapData.layers[activeLayerIndex]
      if (layer.type === 'tilelayer' && layer.data) {
        const width = endX - startX + 1
        const height = endY - startY + 1
        const tiles: number[][] = []

        for (let y = 0; y < height; y++) {
          const row: number[] = []
          for (let x = 0; x < width; x++) {
            const mapX = startX + x
            const mapY = startY + y
            const index = mapY * mapData.width + mapX
            row.push(layer.data[index])
          }
          tiles.push(row)
        }

        onSelectionChange({
          x: startX,
          y: startY,
          width,
          height,
          tiles,
          layerIndex: activeLayerIndex
        })
        toast.success(`Selected ${width}×${height} area (${width * height} tiles)`)
      }

      setSelectionStart(null)
      setSelectionEnd(null)
    }

    setIsPanning(false)
    setIsPainting(false)
    setIsDraggingEntity(false)
  }

  // Right-click eyedropper (stolen from Tiled/Photoshop)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const layer = mapData.layers[activeLayerIndex]
    if (layer.type !== 'tilelayer' || !layer.data) return

    const world = screenToWorld(e.clientX, e.clientY)
    const tile = worldToTile(world.x, world.y)

    if (tile.x >= 0 && tile.x < mapData.width && tile.y >= 0 && tile.y < mapData.height) {
      const index = tile.y * mapData.width + tile.x
      const sampledTileId = layer.data[index]
      if (sampledTileId > 0 && onTileSelect) {
        onTileSelect(sampledTileId)
        toast.success(`Sampled tile ${sampledTileId}`)
      }
    }
  }, [mapData, activeLayerIndex, onTileSelect])

  // Wheel zoom with zoom-to-cursor (Ctrl/⌘ + wheel). Plain wheel pans.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Ctrl/⌘ + wheel => zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.25, Math.min(4, zoom * delta))
      onZoomToPoint(newZoom, screenX, screenY)
      return
    }

    // Plain wheel => pan
    e.preventDefault()
    onPanChange(panX - e.deltaX, panY - e.deltaY)
  }, [zoom, onZoomToPoint, onPanChange, panX, panY])

  // Notify parent of cursor position changes
  useEffect(() => {
    if (onCursorTileChange) {
      onCursorTileChange(cursorPos?.x ?? null, cursorPos?.y ?? null)
    }
  }, [cursorPos, onCursorTileChange])

  // Get cursor class based on current tool
  const getCursorClass = () => {
    if (isPanning) return 'cursor-grabbing'
    switch (currentTool) {
      case 'select': return 'cursor-grab'
      case 'eyedropper': return 'cursor-crosshair'
      default: return 'cursor-crosshair'
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      className={`w-full h-full ${getCursorClass()}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    />
  )
}
