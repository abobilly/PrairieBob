import type { Camera } from '@/lib/ldtk/camera'
import type { LayerInstance, TileInstance, EntityInstance } from '@/lib/ldtk/layer-instance'
import { getIntGridValue, hasTileFlipX, hasTileFlipY } from '@/lib/ldtk/layer-instance'
import { EntityRenderer } from '@/components/EntityRenderer'

interface LayerRendererProps {
  layer: LayerInstance
  camera: Camera
  ctx: CanvasRenderingContext2D
  showGrid?: boolean
}

type WorldBounds = { left: number; right: number; top: number; bottom: number }

const tilesetImageCache = new Map<string, HTMLImageElement>()

export function renderLayer({ layer, camera, ctx, showGrid = false }: LayerRendererProps) {
  if (!layer.visible) return

  switch (layer.__type) {
    case 'Tiles':
    case 'AutoLayer':
      renderTileLayer(layer, camera, ctx)
      if (showGrid) renderGrid(layer, camera, ctx)
      break
    case 'IntGrid':
      renderIntGridLayer(layer, camera, ctx)
      if (showGrid) renderGrid(layer, camera, ctx)
      break
    case 'Entities':
      renderEntityLayer(layer, camera, ctx)
      break
  }
}

function renderTileLayer(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D) {
  const tiles = layer.__type === 'AutoLayer' ? layer.autoLayerTiles : layer.gridTiles
  if (!tiles || tiles.length === 0) return

  const image = getTilesetImage(layer.__tilesetRelPath)
  const gridSize = getGridSize(layer)
  const offsetX = layer.__pxTotalOffsetX || 0
  const offsetY = layer.__pxTotalOffsetY || 0
  const bounds = getWorldBounds(camera)
  const layerOpacity = getLayerOpacity(layer)

  ctx.save()
  ctx.imageSmoothingEnabled = false

  for (const tile of tiles) {
    const worldX = tile.px[0] + offsetX
    const worldY = tile.px[1] + offsetY
    if (!isRectVisible(worldX, worldY, gridSize, gridSize, bounds)) continue

    const screenPos = camera.worldToScreen(worldX, worldY)
    const destSize = gridSize * camera.zoom
    const alpha = Number.isFinite(tile.a) ? tile.a : 1
    drawTileInstance(ctx, tile, image, screenPos.x, screenPos.y, destSize, layerOpacity * alpha, gridSize)
  }

  ctx.restore()
}

function renderIntGridLayer(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D) {
  if (!layer.intGridCsv || layer.intGridCsv.length === 0) return

  const gridSize = getGridSize(layer)
  const offsetX = layer.__pxTotalOffsetX || 0
  const offsetY = layer.__pxTotalOffsetY || 0
  const bounds = getWorldBounds(camera)
  const layerOpacity = getLayerOpacity(layer)

  const startX = clamp(Math.floor((bounds.left - offsetX) / gridSize), 0, layer.__cWid - 1)
  const endX = clamp(Math.ceil((bounds.right - offsetX) / gridSize), 0, layer.__cWid - 1)
  const startY = clamp(Math.floor((bounds.top - offsetY) / gridSize), 0, layer.__cHei - 1)
  const endY = clamp(Math.ceil((bounds.bottom - offsetY) / gridSize), 0, layer.__cHei - 1)

  ctx.save()
  ctx.lineWidth = 1 / camera.zoom

  for (let cy = startY; cy <= endY; cy++) {
    for (let cx = startX; cx <= endX; cx++) {
      const value = getIntGridValue(layer, cx, cy)
      if (value <= 0) continue

      const worldX = cx * gridSize + offsetX
      const worldY = cy * gridSize + offsetY
      const screenPos = camera.worldToScreen(worldX, worldY)
      const size = gridSize * camera.zoom

      ctx.fillStyle = getIntGridColor(value)
      ctx.globalAlpha = 0.35 * layerOpacity
      ctx.fillRect(screenPos.x, screenPos.y, size, size)

      ctx.globalAlpha = 0.8 * layerOpacity
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.strokeRect(screenPos.x, screenPos.y, size, size)
    }
  }

  ctx.restore()
}

function renderEntityLayer(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D) {
  const entities = layer.entityInstances
  if (!entities || entities.length === 0) return

  const bounds = getWorldBounds(camera)
  const visible = entities.filter((entity) => isEntityVisible(entity, bounds))
  if (visible.length === 0) return

  EntityRenderer({ entities: visible, camera, ctx })
}

function drawTileInstance(
  ctx: CanvasRenderingContext2D,
  tile: TileInstance,
  image: HTMLImageElement | null,
  screenX: number,
  screenY: number,
  destSize: number,
  alpha: number,
  srcSize: number
) {
  ctx.save()
  ctx.globalAlpha = alpha

  if (image) {
    const flipX = hasTileFlipX(tile)
    const flipY = hasTileFlipY(tile)
    if (flipX || flipY) {
      ctx.translate(screenX + destSize / 2, screenY + destSize / 2)
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
      ctx.drawImage(
        image,
        tile.src[0],
        tile.src[1],
        srcSize,
        srcSize,
        -destSize / 2,
        -destSize / 2,
        destSize,
        destSize
      )
    } else {
      ctx.drawImage(
        image,
        tile.src[0],
        tile.src[1],
        srcSize,
        srcSize,
        screenX,
        screenY,
        destSize,
        destSize
      )
    }
  } else {
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(screenX, screenY, destSize, destSize)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.lineWidth = 1
    ctx.strokeRect(screenX, screenY, destSize, destSize)
  }

  ctx.restore()
}

function renderGrid(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D) {
  const gridSize = getGridSize(layer)
  if (!Number.isFinite(gridSize) || gridSize <= 0) return

  const offsetX = layer.__pxTotalOffsetX || 0
  const offsetY = layer.__pxTotalOffsetY || 0
  const bounds = getWorldBounds(camera)
  const startX = Math.floor((bounds.left - offsetX) / gridSize) * gridSize + offsetX
  const endX = Math.ceil((bounds.right - offsetX) / gridSize) * gridSize + offsetX
  const startY = Math.floor((bounds.top - offsetY) / gridSize) * gridSize + offsetY
  const endY = Math.ceil((bounds.bottom - offsetY) / gridSize) * gridSize + offsetY

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1 / camera.zoom
  ctx.beginPath()

  for (let x = startX; x <= endX; x += gridSize) {
    const screenX = camera.worldToScreen(x, 0).x
    ctx.moveTo(screenX, 0)
    ctx.lineTo(screenX, camera.height)
  }
  for (let y = startY; y <= endY; y += gridSize) {
    const screenY = camera.worldToScreen(0, y).y
    ctx.moveTo(0, screenY)
    ctx.lineTo(camera.width, screenY)
  }

  ctx.stroke()
  ctx.restore()
}

function getTilesetImage(path: string | null): HTMLImageElement | null {
  if (!path) return null

  const cached = tilesetImageCache.get(path)
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0) {
      return cached
    }
    return null
  }

  const image = new Image()
  image.src = path
  tilesetImageCache.set(path, image)
  return null
}

function getLayerOpacity(layer: LayerInstance): number {
  if (Number.isFinite(layer.__opacity)) {
    return clamp(layer.__opacity, 0, 1)
  }
  return 1
}

function getGridSize(layer: LayerInstance): number {
  return layer.__gridSize > 0 ? layer.__gridSize : 1
}

function getWorldBounds(camera: Camera): WorldBounds {
  const start = camera.screenToWorld(0, 0)
  const end = camera.screenToWorld(camera.width, camera.height)
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)
  return { left, right, top, bottom }
}

function isRectVisible(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: WorldBounds
): boolean {
  return x + width >= bounds.left &&
    x <= bounds.right &&
    y + height >= bounds.top &&
    y <= bounds.bottom
}

function isEntityVisible(entity: EntityInstance, bounds: WorldBounds): boolean {
  const worldX = Number.isFinite(entity.__worldX) ? entity.__worldX : entity.px[0]
  const worldY = Number.isFinite(entity.__worldY) ? entity.__worldY : entity.px[1]
  return isRectVisible(worldX, worldY, entity.width, entity.height, bounds)
}

function getIntGridColor(value: number): string {
  const hue = Math.abs(value * 47) % 360
  return `hsl(${hue}, 70%, 55%)`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
