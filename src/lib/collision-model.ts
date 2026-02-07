import type { LevelData, Layer } from './types'
const TILE_FLIP_HORIZONTAL_FLAG = 0x80000000
const TILE_FLIP_VERTICAL_FLAG = 0x40000000
const TILE_FLIP_DIAGONAL_FLAG = 0x20000000
const TILE_ALL_TRANSFORM_FLAGS =
  TILE_FLIP_HORIZONTAL_FLAG | TILE_FLIP_VERTICAL_FLAG | TILE_FLIP_DIAGONAL_FLAG

function stripTileFlipFlags(tileId: number): number {
  const value = tileId >>> 0
  return (value & ~TILE_ALL_TRANSFORM_FLAGS) >>> 0
}

export type CollisionStrategy = 'auto_walls' | 'custom' | 'manual'

export interface CollisionSourceConfig {
  linkedLayerNames: string[]
  showDerivedOverlay: boolean
  strategy: CollisionStrategy
}

interface CollisionMetadataShape {
  collision?: {
    linkedLayerNames?: unknown
    showDerivedOverlay?: unknown
    strategy?: unknown
  }
}

function isTileLayer(layer: Layer): boolean {
  return layer.type === 'tilelayer'
}

export function isCollisionLayerName(name: string): boolean {
  return name.trim().toLowerCase() === 'collision'
}

function normalizeTileData(layer: Layer, width: number, height: number): number[] {
  const expectedSize = Math.max(1, width * height)
  if (!Array.isArray(layer.data)) {
    return new Array(expectedSize).fill(0)
  }
  if (layer.data.length === expectedSize) return [...layer.data]
  if (layer.data.length > expectedSize) return layer.data.slice(0, expectedSize)
  return [...layer.data, ...new Array(expectedSize - layer.data.length).fill(0)]
}

const AUTO_WALLS_PATTERN = /(wall|walls|furniture|boundary|block|solid)/i

export function getAutoWallsLinkedLayers(level: LevelData): string[] {
  return level.layers
    .filter((layer) => isTileLayer(layer) && !isCollisionLayerName(layer.name))
    .filter((layer) => AUTO_WALLS_PATTERN.test(layer.name))
    .map((layer) => layer.name)
}

function getDefaultLinkedLayers(level: LevelData): string[] {
  return level.layers
    .filter((layer) => isTileLayer(layer) && !isCollisionLayerName(layer.name))
    .filter((layer) => /(wall|walls|boundary|block|solid)/i.test(layer.name))
    .map((layer) => layer.name)
}

function isValidStrategy(value: unknown): value is CollisionStrategy {
  return value === 'auto_walls' || value === 'custom' || value === 'manual'
}

export function resolveCollisionSourcesFromMetadata(level: LevelData): CollisionSourceConfig {
  const metadata = (level.metadata ?? {}) as CollisionMetadataShape
  const collisionMeta = metadata.collision
  const hasExplicitLinked = Boolean(collisionMeta && Array.isArray(collisionMeta.linkedLayerNames))

  const strategy: CollisionStrategy = isValidStrategy(collisionMeta?.strategy)
    ? collisionMeta.strategy
    : hasExplicitLinked ? 'custom' : 'auto_walls'

  let linkedLayerNames: string[]
  if (strategy === 'manual') {
    linkedLayerNames = []
  } else if (strategy === 'auto_walls') {
    linkedLayerNames = getAutoWallsLinkedLayers(level)
  } else {
    linkedLayerNames = (hasExplicitLinked
      ? (collisionMeta?.linkedLayerNames as unknown[])
      : getDefaultLinkedLayers(level))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .filter((name) => !isCollisionLayerName(name))
  }

  const allowedNames = new Set(
    level.layers.filter((layer) => isTileLayer(layer) && !isCollisionLayerName(layer.name)).map((layer) => layer.name)
  )

  const deduped = Array.from(new Set(linkedLayerNames))
    .filter((name) => allowedNames.has(name))
    .sort((a, b) => a.localeCompare(b))

  const showDerivedOverlay = strategy === 'manual'
    ? false
    : typeof collisionMeta?.showDerivedOverlay === 'boolean'
      ? collisionMeta.showDerivedOverlay
      : true

  return {
    linkedLayerNames: deduped,
    showDerivedOverlay,
    strategy,
  }
}

export function withCollisionSourceConfig(level: LevelData, config: CollisionSourceConfig): LevelData {
  return {
    ...level,
    metadata: {
      ...level.metadata,
      collision: {
        linkedLayerNames: [...config.linkedLayerNames],
        showDerivedOverlay: config.showDerivedOverlay,
        strategy: config.strategy,
      },
    },
  }
}

export function deriveCollisionFromLinkedLayers(
  level: LevelData,
  config: CollisionSourceConfig,
): number[] {
  const width = Math.max(1, level.width)
  const height = Math.max(1, level.height)
  const size = width * height
  const derived = new Array<number>(size).fill(0)
  const linked = new Set(config.linkedLayerNames)

  for (const layer of level.layers) {
    if (!isTileLayer(layer) || isCollisionLayerName(layer.name) || !linked.has(layer.name)) continue
    const data = normalizeTileData(layer, width, height)
    for (let index = 0; index < size; index += 1) {
      if (stripTileFlipFlags(data[index] ?? 0) > 0) {
        derived[index] = 1
      }
    }
  }

  return derived
}

export function mergeCollisionMaps(
  manualCollisionData: number[] | undefined,
  derivedCollisionData: number[],
): number[] {
  const size = derivedCollisionData.length
  const merged = new Array<number>(size).fill(0)
  for (let index = 0; index < size; index += 1) {
    const manualBlocked = stripTileFlipFlags(manualCollisionData?.[index] ?? 0) > 0
    const derivedBlocked = stripTileFlipFlags(derivedCollisionData[index] ?? 0) > 0
    merged[index] = manualBlocked || derivedBlocked ? 1 : 0
  }
  return merged
}

export function getCollisionLayer(level: LevelData): Layer | null {
  return level.layers.find(
    (layer) => isTileLayer(layer) && isCollisionLayerName(layer.name)
  ) ?? null
}

export function buildCollisionModel(level: LevelData): {
  config: CollisionSourceConfig
  manual: number[]
  derived: number[]
  merged: number[]
} {
  const width = Math.max(1, level.width)
  const height = Math.max(1, level.height)
  const size = width * height
  const config = resolveCollisionSourcesFromMetadata(level)
  const collisionLayer = getCollisionLayer(level)
  const manual = collisionLayer ? normalizeTileData(collisionLayer, width, height) : new Array(size).fill(0)
  const derived = deriveCollisionFromLinkedLayers(level, config)
  const merged = mergeCollisionMaps(manual, derived)
  return { config, manual, derived, merged }
}
