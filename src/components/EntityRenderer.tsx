import type { Camera } from '@/lib/ldtk/camera'
import type { EntityInstance } from '@/lib/ldtk/layer-instance'

export interface EntitySpriteTile {
  canvas: HTMLCanvasElement
  sourceX: number
  sourceY: number
  sourceSize: number
  tileX: number
  tileY: number
}

export interface EntitySpriteFrame {
  tiles: EntitySpriteTile[]
  widthTiles: number
  heightTiles: number
}

interface EntityRendererProps {
  entities: EntityInstance[]
  camera: Camera
  ctx: CanvasRenderingContext2D
  showNames?: boolean
  getEntitySpriteFrame?: (entity: EntityInstance) => EntitySpriteFrame | null
}

type ScreenRect = { x: number; y: number; width: number; height: number }

const DEFAULT_COLOR = '#8aa4ff'

const getEntityWorldPos = (entity: EntityInstance) => {
  const worldX = Number.isFinite(entity.__worldX) ? entity.__worldX : entity.px[0]
  const worldY = Number.isFinite(entity.__worldY) ? entity.__worldY : entity.px[1]
  return { x: worldX, y: worldY }
}

const getEntityScreenRect = (entity: EntityInstance, camera: Camera): ScreenRect => {
  const pivotX = entity.__pivot?.[0] ?? 0
  const pivotY = entity.__pivot?.[1] ?? 0
  const { x: worldX, y: worldY } = getEntityWorldPos(entity)
  const screenPos = camera.worldToScreen(worldX, worldY)
  const width = Math.max(1, entity.width * camera.zoom)
  const height = Math.max(1, entity.height * camera.zoom)
  return {
    x: screenPos.x - width * pivotX,
    y: screenPos.y - height * pivotY,
    width,
    height,
  }
}

const getEntityColor = (entity: EntityInstance) => entity.__smartColor || DEFAULT_COLOR

const drawEntityTile = (ctx: CanvasRenderingContext2D, rect: ScreenRect, color: string) => {
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = 0.2
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.moveTo(rect.x, rect.y)
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height)
  ctx.moveTo(rect.x + rect.width, rect.y)
  ctx.lineTo(rect.x, rect.y + rect.height)
  ctx.stroke()
  ctx.restore()
}

const drawEntitySprite = (ctx: CanvasRenderingContext2D, rect: ScreenRect, sprite: EntitySpriteFrame, color: string) => {
  if (!sprite.tiles.length) {
    drawEntityTile(ctx, rect, color)
    return
  }

  const tileWidth = rect.width / Math.max(1, sprite.widthTiles)
  const tileHeight = rect.height / Math.max(1, sprite.heightTiles)

  ctx.save()
  const previousSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  for (const tile of sprite.tiles) {
    const drawX = rect.x + tile.tileX * tileWidth
    const drawY = rect.y + tile.tileY * tileHeight
    ctx.drawImage(
      tile.canvas,
      tile.sourceX,
      tile.sourceY,
      tile.sourceSize,
      tile.sourceSize,
      drawX,
      drawY,
      tileWidth,
      tileHeight,
    )
  }
  ctx.imageSmoothingEnabled = previousSmoothing
  ctx.globalAlpha = 0.85
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}

const drawEntityPlaceholder = (ctx: CanvasRenderingContext2D, rect: ScreenRect, color: string) => {
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = 0.1
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.globalAlpha = 0.8
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}

const drawEntityLabel = (ctx: CanvasRenderingContext2D, rect: ScreenRect, label: string, color: string) => {
  ctx.save()
  ctx.font = '10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = color
  const x = rect.x + rect.width / 2
  const y = rect.y - 2
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.lineWidth = 3
  ctx.strokeText(label, x, y)
  ctx.fillText(label, x, y)
  ctx.restore()
}

export function EntityRenderer({
  entities,
  camera,
  ctx,
  showNames = true,
  getEntitySpriteFrame,
}: EntityRendererProps) {
  for (const entity of entities) {
    const rect = getEntityScreenRect(entity, camera)
    const color = getEntityColor(entity)
    const spriteFrame = getEntitySpriteFrame?.(entity) ?? null

    if (spriteFrame) {
      drawEntitySprite(ctx, rect, spriteFrame, color)
    } else if (entity.__tile) {
      drawEntityTile(ctx, rect, color)
    } else {
      drawEntityPlaceholder(ctx, rect, color)
    }

    if (showNames && entity.__identifier) {
      drawEntityLabel(ctx, rect, entity.__identifier.slice(0, 24), color)
    }
  }
}
