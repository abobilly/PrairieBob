import type { Camera } from '@/lib/ldtk/camera'
import type { EntityInstance, FieldInstance } from '@/lib/ldtk/layer-instance'

interface FieldRendererProps {
  field: FieldInstance
  entity: EntityInstance
  camera: Camera
  ctx: CanvasRenderingContext2D
}

type ParsedFieldType = {
  baseType: string
  isArray: boolean
  enumName?: string
}

const BASE_FONT_SIZE = 12
const MAX_TEXT_LENGTH = 40
const MAX_ARRAY_ITEMS = 3
const LABEL_PADDING = 4
const LABEL_GAP = 6

const TYPE_COLORS: Record<string, string> = {
  String: '#f5f5f5',
  Text: '#f5f5f5',
  Int: '#ffd166',
  Float: '#ffd166',
  Bool: '#8bd17c',
  Color: '#ff6b6b',
  Point: '#7aa2ff',
  Enum: '#4dd0e1',
  FilePath: '#c792ea',
  Path: '#a1c181',
  EntityRef: '#ffb703',
  Tile: '#90caf9',
  default: '#ffffff',
}

const TYPE_PREFIX: Record<string, string> = {
  FilePath: 'file',
  Enum: 'enum',
  EntityRef: 'ref',
}

const parseFieldType = (rawType: string): ParsedFieldType => {
  const arrayMatch = rawType.match(/^Array<(.+)>$/)
  const isArray = Boolean(arrayMatch)
  const innerType = arrayMatch ? arrayMatch[1] : rawType

  if (
    innerType.startsWith('Enum.') ||
    innerType.startsWith('LocalEnum.') ||
    innerType.startsWith('ExternEnum.')
  ) {
    const [, enumName] = innerType.split('.', 2)
    return { baseType: 'Enum', isArray, enumName }
  }

  return { baseType: innerType, isArray }
}

const getEntityWorldPos = (entity: EntityInstance) => {
  const worldX = Number.isFinite(entity.__worldX) ? entity.__worldX : entity.px[0]
  const worldY = Number.isFinite(entity.__worldY) ? entity.__worldY : entity.px[1]
  return { x: worldX, y: worldY }
}

const getEntityScreenRect = (entity: EntityInstance, camera: Camera) => {
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

const getColorValue = (value: unknown): string => {
  if (typeof value === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(value)) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, '0')}`
  }

  return '#000000'
}

const normalizePoint = (value: unknown): { x: number; y: number } => {
  if (Array.isArray(value) && value.length >= 2) {
    return {
      x: Number(value[0]) || 0,
      y: Number(value[1]) || 0,
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.x === 'number' || typeof record.y === 'number') {
      return {
        x: typeof record.x === 'number' ? record.x : 0,
        y: typeof record.y === 'number' ? record.y : 0,
      }
    }
    if (typeof record.cx === 'number' || typeof record.cy === 'number') {
      return {
        x: typeof record.cx === 'number' ? record.cx : 0,
        y: typeof record.cy === 'number' ? record.cy : 0,
      }
    }
  }

  return { x: 0, y: 0 }
}

const clampFontSize = (zoom: number) => {
  const scale = Math.max(0.8, Math.min(1.4, 1 / (zoom || 1)))
  return Math.round(BASE_FONT_SIZE * scale)
}

const truncateText = (value: string) => {
  const sanitized = value.replace(/\s+/g, ' ').trim()
  if (sanitized.length <= MAX_TEXT_LENGTH) return sanitized
  return `${sanitized.slice(0, MAX_TEXT_LENGTH - 3)}...`
}

const formatEntityRef = (value: unknown) => {
  if (!value) return '--'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const candidates = [
      record.__identifier,
      record.identifier,
      record.entityIid,
      record.iid,
      record.levelIid,
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate
      }
    }
  }

  return String(value)
}

const formatScalarValue = (value: unknown, parsed: ParsedFieldType): string => {
  if (value === null || value === undefined) return '--'

  switch (parsed.baseType) {
    case 'Bool':
      return value ? 'true' : 'false'
    case 'Int':
    case 'Float':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : '--'
    case 'Color':
      return getColorValue(value)
    case 'Point': {
      const point = normalizePoint(value)
      return `${Math.round(point.x)}, ${Math.round(point.y)}`
    }
    case 'FilePath': {
      const rawValue = typeof value === 'string' ? value : String(value)
      const fileName = rawValue.split(/[\\/]/).filter(Boolean).pop() ?? rawValue
      return fileName
    }
    case 'EntityRef':
      return formatEntityRef(value)
    default:
      return typeof value === 'string' ? value : String(value)
  }
}

const formatArrayValue = (values: unknown[], parsed: ParsedFieldType) => {
  if (values.length === 0) return '--empty--'
  const limitedValues = values.slice(0, MAX_ARRAY_ITEMS).map((entry) =>
    truncateText(formatScalarValue(entry, parsed))
  )
  let joined = limitedValues.join(', ')
  if (values.length > MAX_ARRAY_ITEMS) {
    joined = `${joined} (+${values.length - MAX_ARRAY_ITEMS})`
  }
  return joined
}

const getFieldColor = (parsed: ParsedFieldType) =>
  TYPE_COLORS[parsed.baseType] ?? TYPE_COLORS.default

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string
) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const headLength = 8
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const drawPointOverlay = (
  ctx: CanvasRenderingContext2D,
  entity: EntityInstance,
  camera: Camera,
  values: unknown[],
  color: string
) => {
  const { x: worldX, y: worldY } = getEntityWorldPos(entity)
  const originWorld = {
    x: worldX + entity.width * 0.5,
    y: worldY + entity.height * 0.5,
  }
  const originScreen = camera.worldToScreen(originWorld.x, originWorld.y)

  for (const entry of values) {
    const point = normalizePoint(entry)
    const targetWorld = { x: worldX + point.x, y: worldY + point.y }
    const targetScreen = camera.worldToScreen(targetWorld.x, targetWorld.y)
    drawArrow(ctx, originScreen, targetScreen, color)
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(targetScreen.x, targetScreen.y, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export function renderField({ field, entity, camera, ctx }: FieldRendererProps) {
  const parsed = parseFieldType(field.__type)
  const values = parsed.isArray && Array.isArray(field.__value) ? field.__value : [field.__value]
  const fieldColor = getFieldColor(parsed)
  const prefix = TYPE_PREFIX[parsed.baseType]

  if (parsed.baseType === 'Point') {
    drawPointOverlay(ctx, entity, camera, values, fieldColor)
  }

  const rawValue = parsed.isArray
    ? formatArrayValue(values, parsed)
    : truncateText(formatScalarValue(field.__value, parsed))
  const displayValue = prefix ? `${prefix}: ${rawValue}` : rawValue
  const label = field.__identifier ? `${field.__identifier}: ${displayValue}` : displayValue

  const rect = getEntityScreenRect(entity, camera)
  const fontSize = clampFontSize(camera.zoom)
  const lineHeight = fontSize + LABEL_PADDING * 2
  const fieldIndex = Math.max(
    0,
    entity.fieldInstances?.findIndex((instance) => instance.defUid === field.defUid) ?? 0
  )
  const boxX = rect.x
  const boxY = rect.y - LABEL_GAP - lineHeight * (fieldIndex + 1)

  ctx.save()
  ctx.font = `${fontSize}px Inter`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const textMetrics = ctx.measureText(label)
  const swatchColor = parsed.baseType === 'Color' ? getColorValue(values[0]) : null
  const swatchSize = swatchColor ? fontSize : 0
  const swatchGap = swatchColor ? LABEL_PADDING : 0
  const boxWidth = textMetrics.width + LABEL_PADDING * 2 + swatchSize + swatchGap

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.fillRect(boxX, boxY, boxWidth, lineHeight)
  ctx.strokeStyle = fieldColor
  ctx.lineWidth = 1
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, lineHeight - 1)

  let textX = boxX + LABEL_PADDING
  if (swatchColor) {
    const swatchX = boxX + LABEL_PADDING
    const swatchY = boxY + LABEL_PADDING * 0.5
    ctx.fillStyle = swatchColor
    ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize)
    textX = swatchX + swatchSize + LABEL_PADDING
  }

  const textY = boxY + LABEL_PADDING
  ctx.fillStyle = fieldColor
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.lineWidth = 3
  ctx.strokeText(label, textX, textY)
  ctx.fillText(label, textX, textY)
  ctx.restore()
}
