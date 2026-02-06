/**
 * ULPC spritesheet frame resolver and cache.
 *
 * Loads ULPC-format spritesheets (13 columns, 64px frames) and
 * provides directional idle/walk frame extraction for preview
 * rendering in both the editor canvas and run/test overlay.
 */

import { resolveSpritePath, loadCharacterSpec, type KimbarCharacterSpec } from './registry'

// ULPC standard layout: 13 columns per row, 64x64 pixel frames
const ULPC_COLS = 13
const ULPC_FRAME_SIZE = 64

// Default ULPC directional animation rows (0-indexed)
// These match the Kimbar char.kim.json frame indices:
//   idle_up=91  (row 7), idle_left=104 (row 8),
//   idle_down=117 (row 9), idle_right=130 (row 10)
const ULPC_DEFAULTS = {
  idle_up: { row: 7, count: 1 },
  idle_left: { row: 8, count: 1 },
  idle_down: { row: 9, count: 1 },
  idle_right: { row: 10, count: 1 },
  walk_up: { row: 7, count: 9 },
  walk_left: { row: 8, count: 9 },
  walk_down: { row: 9, count: 9 },
  walk_right: { row: 10, count: 9 },
} as const

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface SpriteFrame {
  canvas: HTMLCanvasElement
  x: number
  y: number
  size: number
}

export interface DirectionalFrames {
  idle: Record<Direction, number[]>
  walk: Record<Direction, number[]>
}

// Cache: characterId -> loaded spritesheet canvas
const spritesheetCache = new Map<string, HTMLCanvasElement | null>()
const loadingSet = new Set<string>()

// Cache: characterId -> directional frame indices
const frameCache = new Map<string, DirectionalFrames>()

/**
 * Convert a ULPC frame index to pixel coordinates.
 */
export function frameToPixel(frameIndex: number): { x: number; y: number } {
  const col = frameIndex % ULPC_COLS
  const row = Math.floor(frameIndex / ULPC_COLS)
  return { x: col * ULPC_FRAME_SIZE, y: row * ULPC_FRAME_SIZE }
}

/**
 * Get the ULPC frame size (64px).
 */
export function getUlpcFrameSize(): number {
  return ULPC_FRAME_SIZE
}

/**
 * Build directional frame indices from a character spec,
 * falling back to ULPC standard layout.
 */
export function buildDirectionalFrames(spec: KimbarCharacterSpec | null): DirectionalFrames {
  const anims = spec?.anims
  const directions: Direction[] = ['up', 'down', 'left', 'right']

  const idle: Record<Direction, number[]> = { up: [], down: [], left: [], right: [] }
  const walk: Record<Direction, number[]> = { up: [], down: [], left: [], right: [] }

  for (const dir of directions) {
    const idleKey = `idle_${dir}` as keyof typeof ULPC_DEFAULTS
    const walkKey = `walk_${dir}` as keyof typeof ULPC_DEFAULTS

    // Try spec first
    if (anims?.[idleKey]?.frames?.length) {
      idle[dir] = anims[idleKey].frames
    } else {
      const def = ULPC_DEFAULTS[idleKey]
      idle[dir] = [def.row * ULPC_COLS]
    }

    if (anims?.[walkKey]?.frames?.length) {
      walk[dir] = anims[walkKey].frames
    } else {
      const def = ULPC_DEFAULTS[walkKey]
      walk[dir] = Array.from({ length: def.count }, (_, i) => def.row * ULPC_COLS + i)
    }
  }

  return { idle, walk }
}

/**
 * Load a ULPC spritesheet PNG as an HTMLCanvasElement.
 * Returns null if the sprite cannot be loaded.
 * Non-blocking: returns null on first call and loads in background.
 */
export function getSpritesheet(characterId: string): HTMLCanvasElement | null {
  if (spritesheetCache.has(characterId)) {
    return spritesheetCache.get(characterId) ?? null
  }

  if (loadingSet.has(characterId)) return null

  const path = resolveSpritePath(characterId)
  if (!path) return null

  loadingSet.add(characterId)
  loadSpritesheetAsync(characterId, path)
  return null
}

/**
 * Synchronous check: is a spritesheet already loaded?
 */
export function hasSpritesheet(characterId: string): boolean {
  return spritesheetCache.has(characterId) && spritesheetCache.get(characterId) !== null
}

/**
 * Get cached directional frames for a character.
 * Loads spec in background if not cached.
 */
export function getDirectionalFrames(characterId: string): DirectionalFrames {
  if (frameCache.has(characterId)) {
    return frameCache.get(characterId)!
  }

  // Build with ULPC defaults first, upgrade when spec loads
  const defaultFrames = buildDirectionalFrames(null)
  frameCache.set(characterId, defaultFrames)

  // Try to load spec asynchronously to upgrade frames
  loadCharacterSpec(characterId).then((spec) => {
    if (spec) {
      frameCache.set(characterId, buildDirectionalFrames(spec))
    }
  })

  return defaultFrames
}

/**
 * Get a single idle frame for a direction (for editor preview).
 */
export function getIdleFrame(characterId: string, direction: Direction): SpriteFrame | null {
  const sheet = getSpritesheet(characterId)
  if (!sheet) return null

  const frames = getDirectionalFrames(characterId)
  const frameIndex = frames.idle[direction]?.[0]
  if (frameIndex === undefined) return null

  const { x, y } = frameToPixel(frameIndex)
  return { canvas: sheet, x, y, size: ULPC_FRAME_SIZE }
}

/**
 * Get the current walk animation frame for a direction (for test mode).
 */
export function getWalkFrame(
  characterId: string,
  direction: Direction,
  elapsedMs: number,
  fps = 10,
): SpriteFrame | null {
  const sheet = getSpritesheet(characterId)
  if (!sheet) return null

  const frames = getDirectionalFrames(characterId)
  const walkFrames = frames.walk[direction]
  if (!walkFrames || walkFrames.length === 0) return null

  const frameDuration = 1000 / Math.max(1, fps)
  const frameIndex = Math.floor(elapsedMs / frameDuration) % walkFrames.length
  const globalFrame = walkFrames[frameIndex]
  const { x, y } = frameToPixel(globalFrame)

  return { canvas: sheet, x, y, size: ULPC_FRAME_SIZE }
}

/**
 * Preload a spritesheet for a character (returns a promise).
 */
export async function preloadSpritesheet(characterId: string): Promise<HTMLCanvasElement | null> {
  if (spritesheetCache.has(characterId)) {
    return spritesheetCache.get(characterId) ?? null
  }

  const path = resolveSpritePath(characterId)
  if (!path) return null

  return loadSpritesheetAsync(characterId, path)
}

/**
 * Preload sprite data (sheet + spec) for a character.
 */
export async function preloadCharacterSprite(characterId: string): Promise<void> {
  await Promise.all([
    preloadSpritesheet(characterId),
    loadCharacterSpec(characterId).then((spec) => {
      if (spec) {
        frameCache.set(characterId, buildDirectionalFrames(spec))
      }
    }),
  ])
}

async function loadSpritesheetAsync(
  characterId: string,
  path: string,
): Promise<HTMLCanvasElement | null> {
  try {
    if (!window.electron?.fs?.readFileBase64) {
      spritesheetCache.set(characterId, null)
      return null
    }

    const base64 = await window.electron.fs.readFileBase64(path)
    const img = new Image()
    img.src = `data:image/png;base64,${base64}`
    await img.decode()

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
    }

    spritesheetCache.set(characterId, canvas)
    loadingSet.delete(characterId)
    return canvas
  } catch (err) {
    console.warn(`[kimbar/sprite-resolver] Failed to load spritesheet for ${characterId}:`, err)
    spritesheetCache.set(characterId, null)
    loadingSet.delete(characterId)
    return null
  }
}

/**
 * Clear all caches (for hot reload / project switch).
 */
export function clearSpriteCache(): void {
  spritesheetCache.clear()
  loadingSet.clear()
  frameCache.clear()
}
