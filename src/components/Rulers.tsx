import type { Camera } from '@/lib/ldtk/camera'

interface RulersProps {
  camera: Camera
  ctx: CanvasRenderingContext2D
  gridSize: number
  showGrid: boolean
  showRulers: boolean
}

const MIN_LINE_SPACING = 8
const MIN_LABEL_SPACING = 48
const RULER_TICK_SMALL = 4
const RULER_TICK_LARGE = 8

const getStep = (base: number, zoom: number, minSpacing: number) => {
  let step = Math.max(1, base)
  while (step * zoom < minSpacing) {
    step *= 2
  }
  return step
}

export function Rulers({ camera, ctx, gridSize, showGrid, showRulers }: RulersProps) {
  if (!Number.isFinite(gridSize) || gridSize <= 0) return

  const zoom = camera.zoom || 1
  const lineStep = getStep(gridSize, zoom, MIN_LINE_SPACING)
  const labelStep = getStep(lineStep, zoom, MIN_LABEL_SPACING)
  const { x: worldLeft, y: worldTop } = camera.screenToWorld(0, 0)
  const { x: worldRight, y: worldBottom } = camera.screenToWorld(camera.width, camera.height)

  const startX = Math.floor(worldLeft / lineStep) * lineStep
  const endX = Math.ceil(worldRight / lineStep) * lineStep
  const startY = Math.floor(worldTop / lineStep) * lineStep
  const endY = Math.ceil(worldBottom / lineStep) * lineStep

  const toScreenX = (x: number) => camera.worldToScreen(x, 0).x
  const toScreenY = (y: number) => camera.worldToScreen(0, y).y

  if (showGrid) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1 / zoom
    ctx.beginPath()
    for (let x = startX; x <= endX; x += lineStep) {
      const screenX = toScreenX(x)
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, camera.height)
    }
    for (let y = startY; y <= endY; y += lineStep) {
      const screenY = toScreenY(y)
      ctx.moveTo(0, screenY)
      ctx.lineTo(camera.width, screenY)
    }
    ctx.stroke()
    ctx.restore()
  }

  if (showRulers) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 1
    ctx.font = '10px Inter'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    for (let x = startX; x <= endX; x += lineStep) {
      const screenX = toScreenX(x)
      const isLabel = Math.abs(x % labelStep) < 0.0001
      const tick = isLabel ? RULER_TICK_LARGE : RULER_TICK_SMALL
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, tick)
      ctx.stroke()

      if (isLabel) {
        ctx.fillText(`${Math.round(x)}`, screenX, tick + 2)
      }
    }

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

    for (let y = startY; y <= endY; y += lineStep) {
      const screenY = toScreenY(y)
      const isLabel = Math.abs(y % labelStep) < 0.0001
      const tick = isLabel ? RULER_TICK_LARGE : RULER_TICK_SMALL
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(tick, screenY)
      ctx.stroke()

      if (isLabel) {
        ctx.fillText(`${Math.round(y)}`, tick + 2, screenY)
      }
    }

    ctx.restore()
  }
}
