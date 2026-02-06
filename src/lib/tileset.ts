import type { LoadedTileset, TilesetConfig } from './types'
import { DEBUG_TILESET_ID } from './types'

/** Default tile size for new projects (32px for kimbar) */
export const DEFAULT_TILE_SIZE = 32

/** TMX/Tiled global-ID transform flags */
export const TILE_FLIP_HORIZONTAL_FLAG = 0x80000000
export const TILE_FLIP_VERTICAL_FLAG = 0x40000000
export const TILE_FLIP_DIAGONAL_FLAG = 0x20000000
const TILE_ALL_TRANSFORM_FLAGS =
  TILE_FLIP_HORIZONTAL_FLAG | TILE_FLIP_VERTICAL_FLAG | TILE_FLIP_DIAGONAL_FLAG

/** Common tile sizes for the import dialog */
export const COMMON_TILE_SIZES = [8, 16, 24, 32, 48, 64] as const

// ============== Debug Tileset (Procedural) ==============

/**
 * Creates a procedural debug tileset for testing when no real tileset is loaded.
 * This is always available as the first tileset with firstGid=1.
 */
export function createDebugTileset(): LoadedTileset {
  const canvas = document.createElement('canvas')
  const tileSize = 32
  const tilesPerRow = 8
  const rows = 8

  canvas.width = tileSize * tilesPerRow  // 256
  canvas.height = tileSize * rows         // 256

  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Color palette for debug tiles
    const colors = [
      'transparent',  // 0: empty
      '#6B7280',      // 1: stone gray
      '#92400E',      // 2: wood brown
      '#E5E7EB',      // 3: marble white
      '#374151',      // 4: wall dark
      '#7C2D12',      // 5: door red
      '#8B5A2B',      // 6: tan brown
      '#D2B48C',      // 7: light tan
      '#4B5563',      // 8: dark gray
      '#059669',      // 9: grass green
      '#2563EB',      // 10: water blue
      '#DC2626',      // 11: lava red
      '#7C3AED',      // 12: magic purple
      '#F59E0B',      // 13: gold yellow
      '#EC4899',      // 14: highlight pink
      '#10B981',      // 15: success green
    ]

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < tilesPerRow; col++) {
        const index = row * tilesPerRow + col
        const x = col * tileSize
        const y = row * tileSize

        // Tile 0 is empty (transparent)
        if (index === 0) continue

        // Use cycling colors
        const colorIndex = index % colors.length
        ctx.fillStyle = colors[colorIndex] || '#D1D5DB'
        ctx.fillRect(x, y, tileSize, tileSize)

        // Add grid lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.strokeRect(x, y, tileSize, tileSize)

        // Add tile number for debugging
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(index), x + tileSize / 2, y + tileSize / 2)
      }
    }
  }

  return {
    id: DEBUG_TILESET_ID,
    name: 'Debug',
    sourcePath: 'procedural',
    tileSize,
    firstGid: 1,
    canvas,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    tilesPerRow,
    totalTiles: tilesPerRow * rows,
    status: 'ready',
  }
}

// ============== PNG Tileset Loading ==============

export interface TilesetLoadOptions {
  id?: string
  name?: string
  sourcePath: string
  tileSize?: number
  firstGid?: number
}

/**
 * Load a PNG tileset from a file path (Electron) or File object (browser).
 * Returns a LoadedTileset with auto-detected dimensions.
 */
export async function loadTilesetFromPath(
  options: TilesetLoadOptions,
  readFileBase64: (path: string) => Promise<string>
): Promise<LoadedTileset> {
  const {
    sourcePath,
    tileSize = DEFAULT_TILE_SIZE,
    firstGid = 1,
  } = options

  // Generate ID and name from path if not provided
  const fileName = sourcePath.split(/[/\\]/).pop() || 'Untitled'
  const baseName = fileName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
  const id = options.id || `tileset_${Date.now()}`
  const name = options.name || baseName

  // Read file as base64
  const base64Data = await readFileBase64(sourcePath)

  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const imageWidth = img.width
      const imageHeight = img.height
      const tilesPerRow = Math.floor(imageWidth / tileSize)
      const rows = Math.floor(imageHeight / tileSize)
      const totalTiles = tilesPerRow * rows

      // Convert to canvas for consistent tile extraction
      const canvas = document.createElement('canvas')
      canvas.width = imageWidth
      canvas.height = imageHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      resolve({
        id,
        name,
        sourcePath,
        tileSize,
        firstGid,
        canvas,
        imageWidth,
        imageHeight,
        tilesPerRow,
        totalTiles,
        status: 'ready',
      })
    }

    img.onerror = () => {
      reject(new Error(`Failed to load tileset image: ${sourcePath}`))
    }

    // Load from base64 data URL
    img.src = `data:image/png;base64,${base64Data}`
  })
}

/**
 * Load a tileset from a File object (browser file picker).
 */
export async function loadTilesetFromFile(
  file: File,
  options: Omit<TilesetLoadOptions, 'sourcePath'>
): Promise<LoadedTileset> {
  const { tileSize = DEFAULT_TILE_SIZE, firstGid = 1 } = options

  const baseName = file.name.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
  const id = options.id || `tileset_${Date.now()}`
  const name = options.name || baseName

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const img = new Image()

      img.onload = () => {
        const imageWidth = img.width
        const imageHeight = img.height
        const tilesPerRow = Math.floor(imageWidth / tileSize)
        const rows = Math.floor(imageHeight / tileSize)
        const totalTiles = tilesPerRow * rows

        const canvas = document.createElement('canvas')
        canvas.width = imageWidth
        canvas.height = imageHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)

        resolve({
          id,
          name,
          sourcePath: file.name,
          tileSize,
          firstGid,
          canvas,
          imageWidth,
          imageHeight,
          tilesPerRow,
          totalTiles,
          status: 'ready',
        })
      }

      img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
      img.src = reader.result as string
    }

    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

// ============== Tile ID Resolution ==============

/**
 * Resolve a global tile ID to the correct tileset and local tile ID.
 * Returns null if the tile ID doesn't belong to any loaded tileset.
 */
export function resolveTileId(
  globalTileId: number,
  tilesets: LoadedTileset[]
): { tileset: LoadedTileset; localTileId: number } | null {
  const normalizedTileId = stripTileFlipFlags(globalTileId)
  if (normalizedTileId <= 0) return null

  // Sort by firstGid descending to find the right tileset
  const sorted = [...tilesets]
    .filter(ts => ts.status === 'ready')
    .sort((a, b) => b.firstGid - a.firstGid)

  for (const ts of sorted) {
    if (normalizedTileId >= ts.firstGid && normalizedTileId < ts.firstGid + ts.totalTiles) {
      return {
        tileset: ts,
        localTileId: normalizedTileId - ts.firstGid,
      }
    }
  }

  return null
}

/**
 * Remove TMX/Tiled transform flags from a global tile id.
 */
export function stripTileFlipFlags(globalTileId: number): number {
  const value = globalTileId >>> 0
  return (value & ~TILE_ALL_TRANSFORM_FLAGS) >>> 0
}

export function hasTileFlipXFlag(globalTileId: number): boolean {
  return ((globalTileId >>> 0) & TILE_FLIP_HORIZONTAL_FLAG) !== 0
}

export function hasTileFlipYFlag(globalTileId: number): boolean {
  return ((globalTileId >>> 0) & TILE_FLIP_VERTICAL_FLAG) !== 0
}

export function hasTileFlipDiagonalFlag(globalTileId: number): boolean {
  return ((globalTileId >>> 0) & TILE_FLIP_DIAGONAL_FLAG) !== 0
}

/**
 * Apply TMX/Tiled transform flags to a tile id while preserving its base gid.
 */
export function setTileFlipFlags(
  globalTileId: number,
  flipX: boolean,
  flipY: boolean,
  flipDiagonal = false
): number {
  let value = stripTileFlipFlags(globalTileId) >>> 0
  if (flipX) value = (value | TILE_FLIP_HORIZONTAL_FLAG) >>> 0
  if (flipY) value = (value | TILE_FLIP_VERTICAL_FLAG) >>> 0
  if (flipDiagonal) value = (value | TILE_FLIP_DIAGONAL_FLAG) >>> 0
  return value
}

/**
 * Calculate the next available firstGid for a new tileset.
 */
export function getNextFirstGid(tilesets: LoadedTileset[]): number {
  if (tilesets.length === 0) return 1

  const maxGid = tilesets.reduce((max, ts) =>
    Math.max(max, ts.firstGid + ts.totalTiles), 0)

  return maxGid
}

/**
 * Convert TilesetConfig (persistable) to the format needed for loading.
 */
export function configToLoadOptions(config: TilesetConfig): TilesetLoadOptions {
  return {
    id: config.id,
    name: config.name,
    sourcePath: config.sourcePath,
    tileSize: config.tileSize,
    firstGid: config.firstGid,
  }
}

/**
 * Extract persistable TilesetConfig from a LoadedTileset.
 */
export function tilesetToConfig(tileset: LoadedTileset): TilesetConfig {
  return {
    id: tileset.id,
    name: tileset.name,
    sourcePath: tileset.sourcePath,
    tileSize: tileset.tileSize,
    firstGid: tileset.firstGid,
  }
}

// ============== Tile Extraction (Legacy Compat) ==============

/**
 * Extract a single tile from a tileset canvas.
 * Kept for compatibility with existing MapCanvas code.
 */
export function getTileFromTileset(
  tileset: HTMLCanvasElement,
  tileId: number,
  tileSize: number,
  tilesPerRow: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = tileSize
  canvas.height = tileSize

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const col = tileId % tilesPerRow
  const row = Math.floor(tileId / tilesPerRow)

  ctx.drawImage(
    tileset,
    col * tileSize,
    row * tileSize,
    tileSize,
    tileSize,
    0,
    0,
    tileSize,
    tileSize
  )

  return canvas
}

// Legacy alias for backward compatibility
export const createTilesetCanvas = createDebugTileset
