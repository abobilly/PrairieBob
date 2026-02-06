import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { World } from '@/lib/ldtk/world'
import type { Level } from '@/lib/ldtk/level'
import { Camera, MAX_ZOOM, MIN_ZOOM } from '@/lib/ldtk/camera'
import { getWorldBounds } from '@/lib/ldtk/world'
import { getLevelWorldCenter } from '@/lib/ldtk/level'

const DEFAULT_BG = '#1f2430'
const GRID_COLOR = 'rgba(255, 255, 255, 0.05)'
const LINK_COLOR = 'rgba(102, 146, 255, 0.6)'
const LEVEL_STROKE = 'rgba(255, 255, 255, 0.45)'
const LEVEL_HOVER = '#9fb3ff'
const LEVEL_SELECTED = '#ffd166'
const LABEL_COLOR = 'rgba(255, 255, 255, 0.9)'
const LABEL_SHADOW = 'rgba(0, 0, 0, 0.5)'
const DRAG_THRESHOLD = 4

type DragState = {
  level: Level
  offsetX: number
  offsetY: number
  startScreenX: number
  startScreenY: number
  moved: boolean
}

type PanState = {
  startScreenX: number
  startScreenY: number
  startPanX: number
  startPanY: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function useCamera() {
  const cameraRef = useRef<Camera | null>(null)
  if (!cameraRef.current) {
    cameraRef.current = new Camera(1, 1)
  }
  return cameraRef.current
}

export function WorldCanvas({ world }: { world: World }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camera = useCamera()
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [cursor, setCursor] = useState('grab')
  const [hoveredLevelId, setHoveredLevelId] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const fittedRef = useRef<string | null>(null)

  const gridSize = useMemo(() => {
    const gridX = Math.max(1, Math.round(world.worldGridWidth || 1))
    const gridY = Math.max(1, Math.round(world.worldGridHeight || gridX))
    return { x: gridX, y: gridY }
  }, [world.worldGridWidth, world.worldGridHeight])

  const setPan = useCallback((x: number, y: number) => {
    setPanX(x)
    setPanY(y)
  }, [])

  const zoomToPoint = useCallback(
    (nextZoom: number, screenX: number, screenY: number) => {
      const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
      const worldX = (screenX - panX) / zoom
      const worldY = (screenY - panY) / zoom
      const nextPanX = screenX - worldX * clamped
      const nextPanY = screenY - worldY * clamped
      setZoom(clamped)
      setPan(nextPanX, nextPanY)
    },
    [panX, panY, zoom, setPan]
  )

  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const localX = screenX - rect.left
      const localY = screenY - rect.top
      return camera.screenToWorld(localX, localY)
    },
    [camera]
  )

  const getLevelAt = useCallback(
    (worldX: number, worldY: number) => {
      const matches = world.levels.filter((level) => (
        worldX >= level.worldX &&
        worldX < level.worldX + level.pxWid &&
        worldY >= level.worldY &&
        worldY < level.worldY + level.pxHei
      ))
      if (matches.length === 0) return null
      matches.sort((a, b) => b.worldDepth - a.worldDepth)
      return matches[0]
    },
    [world.levels]
  )

  const snapPosition = useCallback(
    (value: number, size: number) => Math.round(value / size) * size,
    []
  )

  const fitToWorld = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const bounds = getWorldBounds(world)
    if (bounds.width <= 0 || bounds.height <= 0) return
    camera.width = rect.width
    camera.height = rect.height
    const fitBounds = {
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
    }
    camera.fitBounds(fitBounds)
    setZoom(camera.zoom)
    setPan(camera.panX, camera.panY)
  }, [camera, setPan, world])

  useEffect(() => {
    if (fittedRef.current === world.iid) return
    fitToWorld()
    fittedRef.current = world.iid
  }, [fitToWorld, world.iid])

  useEffect(() => {
    if (dragRef.current || panRef.current) return
    setCursor(hoveredLevelId ? 'pointer' : 'grab')
  }, [hoveredLevelId])

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const gridPixelX = gridSize.x * camera.zoom
      const gridPixelY = gridSize.y * camera.zoom
      if (gridPixelX < 4 && gridPixelY < 4) return
      const topLeft = camera.screenToWorld(0, 0)
      const bottomRight = camera.screenToWorld(camera.width, camera.height)
      const startX = Math.floor(topLeft.x / gridSize.x) * gridSize.x
      const startY = Math.floor(topLeft.y / gridSize.y) * gridSize.y
      const endX = bottomRight.x
      const endY = bottomRight.y
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1

      for (let x = startX; x <= endX; x += gridSize.x) {
        const screenX = camera.worldToScreen(x, 0).x
        ctx.beginPath()
        ctx.moveTo(screenX, 0)
        ctx.lineTo(screenX, camera.height)
        ctx.stroke()
      }

      for (let y = startY; y <= endY; y += gridSize.y) {
        const screenY = camera.worldToScreen(0, y).y
        ctx.beginPath()
        ctx.moveTo(0, screenY)
        ctx.lineTo(camera.width, screenY)
        ctx.stroke()
      }
    },
    [camera, gridSize.x, gridSize.y]
  )

  const drawArrow = useCallback(
    (ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      const headLength = 8
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(to.x, to.y)
      ctx.lineTo(
        to.x - headLength * Math.cos(angle - Math.PI / 6),
        to.y - headLength * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        to.x - headLength * Math.cos(angle + Math.PI / 6),
        to.y - headLength * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()
    },
    []
  )

  const drawLinks = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const linkPairs = new Set<string>()
      for (const level of world.levels) {
        for (const link of level.__neighbours ?? []) {
          const target = world.levels.find((candidate) => candidate.iid === link.levelIid)
          if (!target) continue
          const ids = [level.iid, target.iid].sort().join('|')
          if (linkPairs.has(ids)) continue
          linkPairs.add(ids)
          const fromCenter = getLevelWorldCenter(level)
          const toCenter = getLevelWorldCenter(target)
          const fromScreen = camera.worldToScreen(fromCenter.x, fromCenter.y)
          const toScreen = camera.worldToScreen(toCenter.x, toCenter.y)
          ctx.strokeStyle = LINK_COLOR
          ctx.fillStyle = LINK_COLOR
          ctx.lineWidth = 1.5
          drawArrow(ctx, fromScreen, toScreen)
        }
      }
    },
    [camera, drawArrow, world.levels]
  )

  const drawLevels = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const levels = [...world.levels].sort((a, b) => a.worldDepth - b.worldDepth)
      for (const level of levels) {
        const screenPos = camera.worldToScreen(level.worldX, level.worldY)
        const width = level.pxWid * camera.zoom
        const height = level.pxHei * camera.zoom
        const isHovered = hoveredLevelId === level.iid
        const isSelected = selectedLevelId === level.iid
        const fillColor = level.__bgColor || level.__smartColor || '#3b4150'
        ctx.fillStyle = fillColor
        ctx.fillRect(screenPos.x, screenPos.y, width, height)
        ctx.strokeStyle = isSelected ? LEVEL_SELECTED : isHovered ? LEVEL_HOVER : LEVEL_STROKE
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeRect(screenPos.x, screenPos.y, width, height)

        if (width > 24 && height > 18) {
          ctx.save()
          ctx.fillStyle = LABEL_COLOR
          ctx.shadowColor = LABEL_SHADOW
          ctx.shadowBlur = 2
          ctx.font = '12px sans-serif'
          ctx.fillText(level.identifier, screenPos.x + 6, screenPos.y + 14)
          ctx.restore()
        }

        if (width > 60 && height > 28) {
          ctx.save()
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
          ctx.font = '10px sans-serif'
          ctx.fillText(`(${level.worldX}, ${level.worldY})`, screenPos.x + 6, screenPos.y + height - 6)
          ctx.restore()
        }
      }
    },
    [camera, hoveredLevelId, selectedLevelId, world.levels]
  )

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

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

    camera.width = displayWidth
    camera.height = displayHeight
    camera.setZoom(zoom)
    camera.setPan(panX, panY)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = DEFAULT_BG
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    drawGrid(ctx)
    drawLinks(ctx)
    drawLevels(ctx)
  }, [camera, drawGrid, drawLevels, drawLinks, panX, panY, zoom])

  useEffect(() => {
    let frameId = 0
    const tick = () => {
      renderCanvas()
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [renderCanvas])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const worldPos = screenToWorld(event.clientX, event.clientY)
    const level = getLevelAt(worldPos.x, worldPos.y)
    if (level) {
      dragRef.current = {
        level,
        offsetX: worldPos.x - level.worldX,
        offsetY: worldPos.y - level.worldY,
        startScreenX: event.clientX,
        startScreenY: event.clientY,
        moved: false,
      }
      setCursor('grabbing')
      return
    }
    panRef.current = {
      startScreenX: event.clientX,
      startScreenY: event.clientY,
      startPanX: panX,
      startPanY: panY,
    }
    setCursor('grabbing')
  }, [getLevelAt, panX, panY, screenToWorld])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(event.clientX, event.clientY)
    const dragState = dragRef.current
    if (dragState) {
      const nextX = snapPosition(worldPos.x - dragState.offsetX, gridSize.x)
      const nextY = snapPosition(worldPos.y - dragState.offsetY, gridSize.y)
      dragState.level.worldX = nextX
      dragState.level.worldY = nextY
      const deltaX = event.clientX - dragState.startScreenX
      const deltaY = event.clientY - dragState.startScreenY
      if (!dragState.moved && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
        dragState.moved = true
      }
      return
    }
    const panState = panRef.current
    if (panState) {
      const deltaX = event.clientX - panState.startScreenX
      const deltaY = event.clientY - panState.startScreenY
      setPan(panState.startPanX + deltaX, panState.startPanY + deltaY)
      return
    }
    const hovered = getLevelAt(worldPos.x, worldPos.y)
    setHoveredLevelId(hovered?.iid ?? null)
  }, [getLevelAt, gridSize.x, gridSize.y, screenToWorld, setPan, snapPosition])

  const handleMouseUp = useCallback(() => {
    const dragState = dragRef.current
    if (dragState) {
      if (!dragState.moved) {
        setSelectedLevelId(dragState.level.iid)
      }
      dragRef.current = null
    }
    if (panRef.current) {
      panRef.current = null
    }
    setCursor(hoveredLevelId ? 'pointer' : 'grab')
  }, [hoveredLevelId])

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
  }, [])

  const handleWheel = useCallback((event: WheelEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    event.preventDefault()
    if (event.ctrlKey || event.metaKey) {
      const rect = canvas.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      const delta = event.deltaY > 0 ? 0.9 : 1.1
      zoomToPoint(zoom * delta, screenX, screenY)
      return
    }
    setPan(panX - event.deltaX, panY - event.deltaY)
  }, [panX, panY, setPan, zoom, zoomToPoint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  )
}
