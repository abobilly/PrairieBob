export interface NpcZone {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface NpcWanderConfig {
  x: number
  y: number
  width: number
  height: number
  homeX: number
  homeY: number
  zoneId?: string | null
  zoneDeviationTiles?: number
}

export interface NpcWanderState {
  x: number
  y: number
  width: number
  height: number
  currentDirX: number
  currentDirY: number
  speedTilesPerSecond: number
}

export interface BoundsRect {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeDeviationTiles(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return clamp(Math.floor(value), 0, 64)
}

export function resolveNpcWanderBounds(
  config: NpcWanderConfig,
  zonesById: Map<string, NpcZone>,
  tileSize: number,
): BoundsRect {
  const safeTileSize = Math.max(1, tileSize)
  const deviation = normalizeDeviationTiles(config.zoneDeviationTiles) * safeTileSize
  const zone = config.zoneId ? zonesById.get(config.zoneId) : undefined

  if (zone) {
    return {
      x: zone.x - deviation,
      y: zone.y - deviation,
      width: Math.max(1, zone.width + deviation * 2),
      height: Math.max(1, zone.height + deviation * 2),
    }
  }

  return {
    x: config.homeX - deviation,
    y: config.homeY - deviation,
    width: Math.max(1, config.width + deviation * 2),
    height: Math.max(1, config.height + deviation * 2),
  }
}

export function isRectInsideBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: BoundsRect,
): boolean {
  return (
    x >= bounds.x &&
    y >= bounds.y &&
    x + width <= bounds.x + bounds.width &&
    y + height <= bounds.y + bounds.height
  )
}

export function clampRectToBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: BoundsRect,
): { x: number; y: number } {
  const maxX = bounds.x + Math.max(0, bounds.width - width)
  const maxY = bounds.y + Math.max(0, bounds.height - height)
  return {
    x: clamp(x, bounds.x, maxX),
    y: clamp(y, bounds.y, maxY),
  }
}

export function chooseNpcWanderDirection(
  state: NpcWanderState,
  bounds: BoundsRect,
  tileSize: number,
  rng: () => number = Math.random,
): { x: number; y: number } {
  const step = Math.max(1, tileSize * Math.max(0.1, state.speedTilesPerSecond * 0.2))
  const candidates: Array<{ x: number; y: number }> = [
    { x: state.currentDirX, y: state.currentDirY },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]

  const unique: Array<{ x: number; y: number }> = []
  const keys = new Set<string>()
  for (const dir of candidates) {
    const key = `${dir.x},${dir.y}`
    if (keys.has(key)) continue
    keys.add(key)
    unique.push(dir)
  }

  const valid = unique.filter((dir) => {
    const nextX = state.x + dir.x * step
    const nextY = state.y + dir.y * step
    return isRectInsideBounds(nextX, nextY, state.width, state.height, bounds)
  })

  if (valid.length === 0) {
    return { x: 0, y: 0 }
  }

  const index = clamp(Math.floor(rng() * valid.length), 0, valid.length - 1)
  return valid[index]
}
