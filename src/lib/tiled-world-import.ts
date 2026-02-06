/**
 * Tiled .world File Import
 *
 * Reads Tiled world files (.world) and converts room positions
 * into SpudTile WorldLayout room positions.
 *
 * Tiled .world format:
 * ```json
 * {
 *   "maps": [
 *     { "fileName": "../rooms/room1.tmx", "x": 0, "y": 0, "width": 320, "height": 240 },
 *     { "fileName": "../rooms/room2.tmx", "x": 320, "y": 0, "width": 320, "height": 240 }
 *   ],
 *   "type": "world"
 * }
 * ```
 *
 * Import strategy:
 * - We scale Tiled pixel coords down to canvas positions (1 pixel → configurable scale)
 * - Room IDs are derived from file names (strip path + extension)
 * - Only rooms that exist in the roomRegistry are imported
 * - Positions merge with existing layout (imported positions override)
 */

import type { RoomPosition } from './world-layout'

// ============== Types ==============

/** A single map entry in a Tiled .world file. */
interface TiledWorldMap {
  fileName: string
  x: number
  y: number
  width?: number
  height?: number
}

/** Parsed Tiled .world file. */
interface TiledWorldFile {
  maps: TiledWorldMap[]
  type?: string
}

// ============== Constants ==============

/**
 * Scale factor to convert Tiled pixel positions to World View positions.
 * Tiled worlds use pixel coords (e.g. 0, 320, 640...) which can be very large.
 * We scale down to make room rectangles fit nicely in the canvas.
 */
const DEFAULT_SCALE = 0.5

// ============== Import ==============

/**
 * Parse a Tiled .world file and extract room positions.
 *
 * @param worldContent - Raw JSON string content of the .world file
 * @param knownRoomIds - Set of room IDs that exist in the project (for filtering)
 * @param scale - Scale factor for pixel → canvas conversion (default 0.5)
 * @returns Array of room positions to merge into WorldLayout
 */
export function importTiledWorldPositions(
  worldContent: string,
  knownRoomIds: Set<string>,
  scale = DEFAULT_SCALE,
): RoomPosition[] {
  try {
    const world = JSON.parse(worldContent) as TiledWorldFile

    if (!Array.isArray(world.maps)) {
      console.warn('[tiled-world] .world file has no maps array')
      return []
    }

    const positions: RoomPosition[] = []

    for (const map of world.maps) {
      const roomId = extractRoomId(map.fileName)
      if (!roomId) continue

      // Only import if this room exists in our registry
      if (!knownRoomIds.has(roomId)) continue

      positions.push({
        roomId,
        x: Math.round(map.x * scale),
        y: Math.round(map.y * scale),
      })
    }

    return positions
  } catch (err) {
    console.warn('[tiled-world] Failed to parse .world file:', err)
    return []
  }
}

/**
 * Scan a directory for .world files (Tiled world definitions).
 */
export async function findWorldFiles(
  dirPath: string,
): Promise<string[]> {
  if (!window.electron?.fs) return []

  try {
    const exists = await window.electron.fs.exists(dirPath)
    if (!exists) return []

    const worldFiles: string[] = []

    // Read directory recursively looking for .world files
    await scanDirForWorldFiles(dirPath, worldFiles)

    return worldFiles
  } catch (err) {
    console.warn('[tiled-world] Failed to scan for .world files:', err)
    return []
  }
}

async function scanDirForWorldFiles(
  dirPath: string,
  results: string[],
): Promise<void> {
  if (!window.electron?.fs) return

  try {
    const entries = await window.electron.fs.readDir(dirPath)

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`

      if (entry.isDirectory) {
        // Recurse into subdirectories (max 2 levels deep for performance)
        if (dirPath.split('/').length - dirPath.indexOf('/content/') < 10) {
          await scanDirForWorldFiles(fullPath, results)
        }
      } else if (entry.name.endsWith('.world')) {
        results.push(fullPath)
      }
    }
  } catch {
    // Ignore unreadable directories
  }
}

// ============== Helpers ==============

/**
 * Extract a room ID from a Tiled world map fileName.
 * "rooms/my_room.tmx" → "my_room"
 * "../rooms/scotus_zones/megalevel.tmx" → "megalevel"
 */
function extractRoomId(fileName: string): string {
  if (!fileName) return ''

  // Normalize separators
  const normalized = fileName.replace(/\\/g, '/')

  // Get filename without path
  const lastSlash = normalized.lastIndexOf('/')
  const baseName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized

  // Strip extension
  const dotIndex = baseName.lastIndexOf('.')
  return dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName
}
