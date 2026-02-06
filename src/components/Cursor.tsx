import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Tool } from '@/lib/types'
import { useToolStore } from '@/stores/toolStore'

interface CursorProps {
  containerRef: RefObject<HTMLElement>
}

type ToolId = Tool | 'tile' | 'entity' | 'intgrid'

const TOOL_COLORS: Record<ToolId, string> = {
  brush: '#00d9ff',
  fill: '#00d9ff',
  rectangle: '#00d9ff',
  line: '#00d9ff',
  eraser: '#ef4444',
  select: '#f59e0b',
  eyedropper: '#a855f7',
  pan: '#e8e8f0',
  tile: '#00d9ff',
  entity: '#4caf50',
  intgrid: '#6366f1',
}

const BRUSH_TOOLS = new Set<ToolId>(['brush', 'eraser', 'tile', 'intgrid'])

const getCursorSize = (tool: ToolId, brushSize: number) => {
  const baseSize = 24
  if (!BRUSH_TOOLS.has(tool)) return baseSize
  const radius = Math.max(2, Math.round(brushSize / 2))
  return Math.max(baseSize, radius * 2 + 12)
}

const drawCrosshair = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const center = size / 2
  const arm = Math.max(6, Math.round(size * 0.25))
  const gap = 3

  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(center - arm, center)
  ctx.lineTo(center - gap, center)
  ctx.moveTo(center + gap, center)
  ctx.lineTo(center + arm, center)
  ctx.moveTo(center, center - arm)
  ctx.lineTo(center, center - gap)
  ctx.moveTo(center, center + gap)
  ctx.lineTo(center, center + arm)
  ctx.stroke()
}

const drawCircleCursor = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const radius = Math.max(4, Math.round(size * 0.2))
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2)
  ctx.stroke()
}

const drawSelectionBox = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const box = Math.max(10, Math.round(size * 0.35))
  const start = (size - box) / 2
  ctx.strokeStyle = color
  ctx.setLineDash([4, 2])
  ctx.strokeRect(start, start, box, box)
  ctx.setLineDash([])
}

const drawLineIcon = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const span = Math.max(8, Math.round(size * 0.3))
  const center = size / 2
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(center - span, center + span)
  ctx.lineTo(center + span, center - span)
  ctx.stroke()
}

const drawRectIcon = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const box = Math.max(10, Math.round(size * 0.3))
  const start = (size - box) / 2
  ctx.strokeStyle = color
  ctx.strokeRect(start, start, box, box)
}

const drawFillIcon = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const box = Math.max(6, Math.round(size * 0.2))
  const start = size / 2 - box / 2
  ctx.fillStyle = color
  ctx.fillRect(start, start, box, box)
}

const drawEyedropperIcon = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const span = Math.max(6, Math.round(size * 0.2))
  const center = size / 2
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(center - span, center + span)
  ctx.lineTo(center + span, center - span)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(center + span, center - span, 2, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

const drawPanArrows = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const center = size / 2
  const arm = Math.max(6, Math.round(size * 0.25))
  const head = 4
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.moveTo(center - arm, center)
  ctx.lineTo(center + arm, center)
  ctx.moveTo(center, center - arm)
  ctx.lineTo(center, center + arm)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(center + arm, center)
  ctx.lineTo(center + arm - head, center - head)
  ctx.moveTo(center + arm, center)
  ctx.lineTo(center + arm - head, center + head)
  ctx.moveTo(center - arm, center)
  ctx.lineTo(center - arm + head, center - head)
  ctx.moveTo(center - arm, center)
  ctx.lineTo(center - arm + head, center + head)
  ctx.moveTo(center, center + arm)
  ctx.lineTo(center - head, center + arm - head)
  ctx.moveTo(center, center + arm)
  ctx.lineTo(center + head, center + arm - head)
  ctx.moveTo(center, center - arm)
  ctx.lineTo(center - head, center - arm + head)
  ctx.moveTo(center, center - arm)
  ctx.lineTo(center + head, center - arm + head)
  ctx.stroke()
}

const drawEraserIcon = (ctx: CanvasRenderingContext2D, size: number, color: string) => {
  const box = Math.max(8, Math.round(size * 0.25))
  const start = size / 2 - box / 2
  ctx.strokeStyle = color
  ctx.strokeRect(start, start, box, box)
}

const drawBrushPreview = (ctx: CanvasRenderingContext2D, size: number, brushSize: number, color: string) => {
  const radius = Math.max(2, Math.round(brushSize / 2))
  ctx.strokeStyle = color
  ctx.setLineDash([4, 2])
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
}

export function Cursor({ containerRef }: CursorProps) {
  const activeTool = useToolStore((state) => state.activeTool as ToolId)
  const brushSize = useToolStore((state) => state.brushSize)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  const cursorSize = useMemo(() => getCursorSize(activeTool, brushSize), [activeTool, brushSize])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        setPosition(null)
        return
      }
      setPosition({ x, y })
    }

    const handleLeave = () => {
      setPosition(null)
    }

    container.addEventListener('mousemove', handleMove)
    container.addEventListener('mouseenter', handleMove)
    container.addEventListener('mouseleave', handleLeave)

    return () => {
      container.removeEventListener('mousemove', handleMove)
      container.removeEventListener('mouseenter', handleMove)
      container.removeEventListener('mouseleave', handleLeave)
    }
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (position) {
      container.classList.add('pb-cursor-hidden')
    } else {
      container.classList.remove('pb-cursor-hidden')
    }
    return () => container.classList.remove('pb-cursor-hidden')
  }, [containerRef, position])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pixelRatio = window.devicePixelRatio || 1
    canvas.width = cursorSize * pixelRatio
    canvas.height = cursorSize * pixelRatio
    canvas.style.width = `${cursorSize}px`
    canvas.style.height = `${cursorSize}px`
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    ctx.clearRect(0, 0, cursorSize, cursorSize)

    const color = TOOL_COLORS[activeTool] ?? '#e8e8f0'
    const isBrushTool = BRUSH_TOOLS.has(activeTool)
    if (activeTool === 'pan') {
      drawPanArrows(ctx, cursorSize, color)
      return
    }

    if (isBrushTool) {
      drawCircleCursor(ctx, cursorSize, color)
    } else if (activeTool === 'select') {
      drawCrosshair(ctx, cursorSize, color)
    }

    switch (activeTool) {
      case 'select':
        drawSelectionBox(ctx, cursorSize, color)
        break
      case 'line':
        drawLineIcon(ctx, cursorSize, color)
        break
      case 'rectangle':
        drawRectIcon(ctx, cursorSize, color)
        break
      case 'fill':
        drawFillIcon(ctx, cursorSize, color)
        break
      case 'eyedropper':
        drawEyedropperIcon(ctx, cursorSize, color)
        break
      case 'eraser':
        drawEraserIcon(ctx, cursorSize, color)
        break
    }

    if (isBrushTool && brushSize > 1) {
      drawBrushPreview(ctx, cursorSize, brushSize, color)
    }
  }, [activeTool, brushSize, cursorSize])

  if (!position) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
