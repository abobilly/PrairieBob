/**
 * Kimbar project shim.
 *
 * Builds a synthetic ProjectConfig for the Kimbar project without
 * requiring an on-disk project.json. Reads the scotus tileset contract
 * to derive tileset definitions and resolves paths to the megalevel TMX.
 */

/** Shape matching ProjectConfig in projectStore (not exported from there) */
export interface KimbarProjectConfig {
  name: string
  version: string
  tileSize: number
  paths: {
    maps: string
    tilesets: string
    interactions: string
    entities?: string
  }
  tilesets: Array<{
    id: string
    file: string
    tileSize: number
    columns?: number
    tileCount?: number
  }>
}

interface TilesetContractAtlas {
  id: string
  path: string
  columns: number
}

interface TilesetContract {
  atlases: TilesetContractAtlas[]
  tiles?: unknown[]
}

/** Known Kimbar tileset tile counts (derived from scotus_tileset_contract.json) */
const KIMBAR_TILESET_TILE_COUNTS: Record<string, number> = {
  scotus_floors: 32,
  scotus_structures: 48,
  scotus_decor: 16,
}

/**
 * Try to read and parse the scotus_tileset_contract.json from the Kimbar
 * dist directory. Returns null if unavailable.
 */
async function loadTilesetContract(kimbarRoot: string): Promise<TilesetContract | null> {
  if (!window.electron?.fs) return null
  const contractPath = `${kimbarRoot}/dist/content/tiled/scotus_tileset_contract.json`
  try {
    const content = await window.electron.fs.readFile(contractPath)
    return JSON.parse(content) as TilesetContract
  } catch {
    return null
  }
}

/**
 * Build a synthetic ProjectConfig for the Kimbar project.
 *
 * Reads the scotus tileset contract to derive tileset definitions.
 * Falls back to hardcoded values if the contract is unavailable.
 */
export async function buildKimbarProjectConfig(kimbarRoot: string): Promise<KimbarProjectConfig> {
  const contract = await loadTilesetContract(kimbarRoot)

  const tilesets: KimbarProjectConfig['tilesets'] = []

  if (contract?.atlases?.length) {
    for (const atlas of contract.atlases) {
      tilesets.push({
        id: atlas.id,
        file: `dist/content/tiled/${atlas.path}`,
        tileSize: 32,
        columns: atlas.columns,
        tileCount: KIMBAR_TILESET_TILE_COUNTS[atlas.id],
      })
    }
  } else {
    // Hardcoded fallback
    tilesets.push(
      { id: 'scotus_floors', file: 'dist/content/tiled/tiles/scotus_floors.png', tileSize: 32, columns: 16, tileCount: 32 },
      { id: 'scotus_structures', file: 'dist/content/tiled/tiles/scotus_structures.png', tileSize: 32, columns: 16, tileCount: 48 },
      { id: 'scotus_decor', file: 'dist/content/tiled/tiles/scotus_decor.png', tileSize: 32, columns: 16, tileCount: 16 },
    )
  }

  return {
    name: 'Kimbar',
    version: '1.0.0',
    tileSize: 32,
    paths: {
      maps: 'dist/content/tiled/rooms/scotus_zones',
      tilesets: 'dist/content/tiled/tiles',
      interactions: '',
      entities: '',
    },
    tilesets,
  }
}

/**
 * Resolve the path to the megalevel TMX within a Kimbar root.
 */
export function getMegalevelPath(kimbarRoot: string): string {
  return `${kimbarRoot}/dist/content/tiled/rooms/scotus_zones/megalevel.tmx`
}
