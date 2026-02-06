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
    ctx.lineWidth = 1 / zoom
    for (let x = startX; x <= endX; x += lineStep) {
      const screenX = toScreenX(x)
      const isAxis = Math.abs(x) < 0.0001
      const isMajor = Math.abs(x % labelStep) < 0.0001
      ctx.strokeStyle = isAxis
        ? 'rgba(0, 217, 255, 0.16)'
        : isMajor
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(255, 255, 255, 0.03)'
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, camera.height)
      ctx.stroke()
    }
    for (let y = startY; y <= endY; y += lineStep) {
      const screenY = toScreenY(y)
      const isAxis = Math.abs(y) < 0.0001
      const isMajor = Math.abs(y % labelStep) < 0.0001
      ctx.strokeStyle = isAxis
        ? 'rgba(0, 217, 255, 0.16)'
        : isMajor
          ? 'rgba(255, 255, 255, 0.06)'
          : 'rgba(255, 255, 255, 0.03)'
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(camera.width, screenY)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (showRulers) {
    ctx.save()
    ctx.strokeStyle = 'rgba(186, 204, 224, 0.8)'
    ctx.fillStyle = 'rgba(236, 244, 255, 0.96)'
    ctx.lineWidth = 1
    ctx.font = '11px JetBrains Mono'
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
        const label = `${Math.round(x)}`
        ctx.strokeStyle = 'rgba(10, 16, 24, 0.95)'
        ctx.lineWidth = 3
        ctx.strokeText(label, screenX, tick + 2)
        ctx.fillText(label, screenX, tick + 2)
        ctx.strokeStyle = 'rgba(186, 204, 224, 0.8)'
        ctx.lineWidth = 1
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
        const label = `${Math.round(y)}`
        ctx.strokeStyle = 'rgba(10, 16, 24, 0.95)'
        ctx.lineWidth = 3
        ctx.strokeText(label, tick + 2, screenY)
        ctx.fillText(label, tick + 2, screenY)
        ctx.strokeStyle = 'rgba(186, 204, 224, 0.8)'
        ctx.lineWidth = 1
      }
    }

    ctx.restore()
  }
}
