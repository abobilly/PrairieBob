/**
 * Tileset Baker — Creates self-contained .spudtile tileset packages
 *
 * Bundles tileset image + metadata into a single redistributable file.
 */

import type { BakedTileset, LoadedTileset, TileActionGroup, CollisionShape } from './types'

export interface BakeOptions {
  name: string
  author?: string
  license?: string
  description?: string
  tags?: string[]
  mode: 'embedded' | 'sidecar'
  includeProperties?: boolean
  includeActionGroups?: boolean
  tileProperties?: Record<number, Record<string, unknown>>
  tileActionGroups?: Record<number, TileActionGroup>
}

/**
 * Convert a canvas to a base64 data URL (PNG)
 */
function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

/**
 * Estimate the file size of a baked tileset
 */
export function estimateBakedSize(tileset: LoadedTileset, options: BakeOptions): number {
  // Rough estimate: base64 is ~133% of binary PNG size
  const imageSize = tileset.canvas.toDataURL('image/png').length
  const metadataSize = 500 // rough estimate for JSON overhead
  return imageSize + metadataSize
}

/**
 * Bake a LoadedTileset into a BakedTileset object
 */
export function bakeTileset(
  tileset: LoadedTileset,
  options: BakeOptions
): BakedTileset {
  const tiles: BakedTileset['tiles'] = {}

  // Add tile properties if requested
  if (options.includeProperties && options.tileProperties) {
    for (const [tileIdStr, props] of Object.entries(options.tileProperties)) {
      const tileId = Number(tileIdStr)
      tiles[tileId] = { ...tiles[tileId], properties: props }
    }
  }

  // Add tile action groups if requested
  if (options.includeActionGroups && options.tileActionGroups) {
    for (const [tileIdStr, group] of Object.entries(options.tileActionGroups)) {
      const tileId = Number(tileIdStr)
      tiles[tileId] = { ...tiles[tileId], actionGroup: group }
    }
  }

  return {
    format: 'spudtile-tileset',
    version: 1,
    name: options.name || tileset.name,
    tileWidth: tileset.tileSize,
    tileHeight: tileset.tileSize,
    columns: tileset.tilesPerRow,
    tileCount: tileset.totalTiles,
    spacing: 0,
    margin: 0,
    imageDataUrl: canvasToDataUrl(tileset.canvas),
    tiles,
    tags: options.tags || [],
    author: options.author,
    license: options.license,
    description: options.description,
    createdAt: new Date().toISOString(),
    sourceProject: undefined,
  }
}

/**
 * Serialize a BakedTileset to JSON string
 */
export function serializeBakedTileset(baked: BakedTileset): string {
  return JSON.stringify(baked, null, 2)
}

/**
 * Deserialize a .spudtile JSON file into a BakedTileset
 */
export function deserializeBakedTileset(json: string): BakedTileset | null {
  try {
    const data = JSON.parse(json) as BakedTileset
    if (data.format !== 'spudtile-tileset' || data.version !== 1) {
      console.error('Invalid .spudtile format or version')
      return null
    }
    return data
  } catch {
    console.error('Failed to parse .spudtile JSON')
    return null
  }
}

/**
 * Import a baked tileset: decode the image and return a LoadedTileset-compatible object.
 * This creates a canvas from the embedded base64 data.
 */
export async function importBakedTileset(
  baked: BakedTileset,
  targetImagePath: string
): Promise<{
  config: { id: string; name: string; sourcePath: string; tileSize: number }
  imageDataUrl: string
}> {
  return {
    config: {
      id: baked.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: baked.name,
      sourcePath: targetImagePath,
      tileSize: baked.tileWidth,
    },
    imageDataUrl: baked.imageDataUrl,
  }
}

/**
 * Convert base64 data URL to a Uint8Array for writing to disk
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
