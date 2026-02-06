/**
 * Kimbar character registry loader.
 *
 * Resolves characterId -> spriteKey -> spritesheet path and
 * optionally loads character spec JSON for animation frame data.
 * Uses linked-project rootPath to locate Kimbar generated assets.
 */

import type { Character } from '@/lib/types'

export interface KimbarCharacterEntry {
  id: string
  name?: string
  spriteKey: string
  specUrl?: string
}

export interface KimbarCharacterSpec {
  id: string
  name?: string
  anims?: Record<string, { frames: number[]; frameRate?: number; repeat?: number }>
}

export interface KimbarRegistryState {
  rootPath: string | null
  characters: KimbarCharacterEntry[]
  specs: Map<string, KimbarCharacterSpec>
  loaded: boolean
}

let registryState: KimbarRegistryState = {
  rootPath: null,
  characters: [],
  specs: new Map(),
  loaded: false,
}

/**
 * Set the Kimbar project root path. Call before loadRegistry.
 */
export function setKimbarRootPath(rootPath: string): void {
  if (registryState.rootPath === rootPath && registryState.loaded) return
  registryState = {
    rootPath,
    characters: [],
    specs: new Map(),
    loaded: false,
  }
}

export function getKimbarRootPath(): string | null {
  return registryState.rootPath
}

/**
 * Attempt to auto-detect the Kimbar project root by checking
 * common sibling-directory locations relative to a base path.
 */
export async function detectKimbarRoot(basePath: string): Promise<string | null> {
  if (!window.electron?.fs) return null

  const candidates = [
    // Sibling of PrairieBob's parent
    basePath.replace(/[\\/][^\\/]+[\\/][^\\/]+$/, '/badgey.org/kimbar'),
    // Direct sibling
    basePath.replace(/[\\/][^\\/]+$/, '/kimbar'),
    // Known development location
    'C:/Users/andre/lawchuck/badgey.org/kimbar',
  ]

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, '/')
    const testPath = `${normalized}/public/generated/registry/characters.json`
    try {
      if (await window.electron.fs.exists(testPath)) {
        return normalized
      }
    } catch {
      // skip
    }
  }
  return null
}

/**
 * Load the Kimbar characters.json registry from disk.
 */
export async function loadKimbarRegistry(): Promise<KimbarCharacterEntry[]> {
  if (registryState.loaded) return registryState.characters
  if (!registryState.rootPath || !window.electron?.fs) return []

  const registryPath = `${registryState.rootPath}/public/generated/registry/characters.json`
  try {
    const content = await window.electron.fs.readFile(registryPath)
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      registryState.characters = parsed.filter(
        (entry: unknown) =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).id === 'string' &&
          typeof (entry as Record<string, unknown>).spriteKey === 'string',
      ) as KimbarCharacterEntry[]
    }
    registryState.loaded = true
  } catch (err) {
    console.warn('[kimbar/registry] Failed to load characters.json:', err)
  }

  return registryState.characters
}

/**
 * Get all Kimbar characters as SpudTile Character[] for the property panel.
 */
export function getKimbarCharacters(): Character[] {
  return registryState.characters.map((entry) => ({
    id: entry.id,
    name: entry.name || formatCharacterId(entry.id),
  }))
}

function formatCharacterId(id: string): string {
  return id
    .replace(/^(char|npc)\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Resolve a characterId to its spritesheet PNG path on disk.
 */
export function resolveSpritePath(characterId: string): string | null {
  if (!registryState.rootPath) return null
  const entry = registryState.characters.find((c) => c.id === characterId)
  const spriteKey = entry?.spriteKey ?? characterId
  return `${registryState.rootPath}/public/generated/sprites/${spriteKey}.png`
}

/**
 * Resolve a characterId to its character spec JSON path.
 */
export function resolveSpecPath(characterId: string): string | null {
  if (!registryState.rootPath) return null
  const entry = registryState.characters.find((c) => c.id === characterId)
  if (entry?.specUrl) {
    return `${registryState.rootPath}/public${entry.specUrl}`
  }
  return `${registryState.rootPath}/public/generated/characters/${characterId}.json`
}

/**
 * Load a character spec JSON for animation frame data.
 * Caches specs after first load.
 */
export async function loadCharacterSpec(characterId: string): Promise<KimbarCharacterSpec | null> {
  const cached = registryState.specs.get(characterId)
  if (cached) return cached

  if (!window.electron?.fs) return null
  const specPath = resolveSpecPath(characterId)
  if (!specPath) return null

  try {
    const content = await window.electron.fs.readFile(specPath)
    const parsed = JSON.parse(content)
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.id === 'string') {
      const spec = parsed as KimbarCharacterSpec
      registryState.specs.set(characterId, spec)
      return spec
    }
  } catch {
    // spec unavailable - will fall back to ULPC defaults
  }

  return null
}

/**
 * Check whether the Kimbar registry has been loaded.
 */
export function isKimbarRegistryLoaded(): boolean {
  return registryState.loaded
}

/**
 * Reset state (for testing / hot reload).
 */
export function resetKimbarRegistry(): void {
  registryState = {
    rootPath: null,
    characters: [],
    specs: new Map(),
    loaded: false,
  }
}
