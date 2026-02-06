import type { EntityData, EntityType, Layer, LevelData } from './types'
import { resolveKimbarEntityType, normalizeEntityProperties } from './kimbar/entity-compat'

export type RoomSourceFormat = 'spudtile-json' | 'tiled-json' | 'ldtk' | 'tmx'

export type ReadFileFn = (path: string) => Promise<string>

export interface RoomTilesetReference {
  id: string
  name: string
  sourcePath: string
  tileSize: number
  firstGid: number
  tileCount?: number
  columns?: number
}

export interface RoomLoadResult {
  data: LevelData
  tilesets: RoomTilesetReference[]
  sourceFormat: RoomSourceFormat
  warnings: string[]
}

const ENTITY_TYPES: Set<EntityType> = new Set([
  'spawn_point',
  'door',
  'npc',
  'trigger',
  'prop',
  'stairs',
  'ladder',
  'portal',
])

const FLIP_HORIZONTAL_FLAG = 0x80000000
const FLIP_VERTICAL_FLAG = 0x40000000
const FLIP_DIAGONAL_FLAG = 0x20000000

export async function loadRoomDataFromFile(path: string, readFile: ReadFileFn): Promise<RoomLoadResult> {
  const content = await readFile(path)
  return loadRoomDataFromContent(path, content, readFile)
}

export async function loadRoomDataFromContent(
  path: string,
  content: string,
  readFile?: ReadFileFn
): Promise<RoomLoadResult> {
  const extension = getFileExtension(path)
  const trimmed = content.trim()

  if (extension === 'tsx') {
    throw new Error('TSX is a tileset definition file. Open a TMX/LDTK/JSON map file instead.')
  }

  if (extension === 'tmx' || looksLikeXml(trimmed)) {
    const parsed = await parseTmx(path, trimmed, readFile)
    return {
      data: parsed.data,
      tilesets: parsed.tilesets,
      sourceFormat: 'tmx',
      warnings: [],
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    throw new Error(`Unsupported room format for "${path}": expected JSON or TMX XML (${String(err)}).`)
  }

  if (isSpudTileLevel(parsed)) {
    return {
      data: normalizeSpudTileLevel(parsed),
      tilesets: [],
      sourceFormat: 'spudtile-json',
      warnings: [],
    }
  }

  if (isLdtkProjectJson(parsed)) {
    const result = await parseLdtkProject(path, parsed, readFile)
    return {
      data: result.data,
      tilesets: result.tilesets,
      sourceFormat: 'ldtk',
      warnings: [],
    }
  }

  if (isTiledJsonMap(parsed)) {
    const result = await parseTiledJson(path, parsed, readFile)
    return {
      data: result.data,
      tilesets: result.tilesets,
      sourceFormat: 'tiled-json',
      warnings: [],
    }
  }

  throw new Error(`Unrecognized map JSON format for "${path}".`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback))
}

function normalizeEntityType(value: unknown): EntityType {
  const raw = typeof value === 'string' ? value : ''
  const lowered = raw.toLowerCase()
  if (ENTITY_TYPES.has(lowered as EntityType)) return lowered as EntityType
  // Try Kimbar-style type aliases (PlayerSpawn, Door, NPC, EncounterTrigger)
  const kimbarType = resolveKimbarEntityType(raw)
  if (kimbarType) return kimbarType
  return 'prop'
}

function normalizeTileData(values: number[], width: number, height: number): number[] {
  const size = Math.max(1, width * height)
  if (values.length === size) return values
  if (values.length > size) return values.slice(0, size)
  return values.concat(new Array(size - values.length).fill(0))
}

function stripTileFlags(gid: number): number {
  if (gid <= 0) return 0
  const mask = ~(FLIP_HORIZONTAL_FLAG | FLIP_VERTICAL_FLAG | FLIP_DIAGONAL_FLAG)
  return gid & mask
}

function fileNameWithoutExtension(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const base = normalized.split('/').pop() ?? filePath
  return base.replace(/\.[^.]+$/, '')
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeMetadata(source: string): LevelData['metadata'] {
  return {
    editedAt: nowIso(),
    exportedFrom: source,
    version: '1.0.0',
  }
}

function isSpudTileLevel(value: unknown): value is LevelData {
  if (!isRecord(value)) return false
  return Array.isArray(value.layers) &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    typeof value.tileSize === 'number'
}

function normalizeSpudTileLevel(level: LevelData): LevelData {
  const width = Math.max(1, toInt(level.width, 1))
  const height = Math.max(1, toInt(level.height, 1))
  const tileSize = Math.max(1, toInt(level.tileSize, 16))

  const layers: Layer[] = (Array.isArray(level.layers) ? level.layers : []).map((layer, index) => {
    const name = typeof layer.name === 'string' && layer.name.trim().length > 0
      ? layer.name
      : `Layer_${index}`
    const visible = layer.visible !== false
    const locked = layer.locked === true
    const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1

    if (layer.type === 'objectgroup') {
      const objects: EntityData[] = Array.isArray(layer.objects)
        ? layer.objects.map((entity, entityIndex) => normalizeEntity(entity, entityIndex))
        : []
      return { name, type: 'objectgroup', visible, locked, opacity, objects }
    }

    const data = normalizeTileData(
      Array.isArray(layer.data) ? layer.data.map((tileId) => toInt(tileId, 0)) : [],
      width,
      height
    )
    return { name, type: 'tilelayer', visible, locked, opacity, data }
  })

  return {
    id: typeof level.id === 'string' && level.id.length > 0 ? level.id : 'room',
    width,
    height,
    tileSize,
    layers,
    metadata: level.metadata ?? makeMetadata('spudtile'),
  }
}

function normalizeEntity(value: unknown, index: number): EntityData {
  const entity = isRecord(value) ? value : {}
  const fallbackId = `entity_${index + 1}`
  const typeValue = entity.type ?? entity.name ?? 'prop'
  const type = normalizeEntityType(typeValue)
  const id = typeof entity.id === 'string' && entity.id.trim().length > 0
    ? entity.id
    : fallbackId
  const rawProperties = normalizeProperties(entity.properties)
  return {
    id,
    type,
    x: toNumber(entity.x, 0),
    y: toNumber(entity.y, 0),
    width: Math.max(0, toNumber(entity.width, 16)),
    height: Math.max(0, toNumber(entity.height, 16)),
    properties: normalizeEntityProperties(type, rawProperties),
  }
}

function normalizeProperties(value: unknown): Record<string, string | number | boolean> {
  if (Array.isArray(value)) {
    const fromArray: Record<string, string | number | boolean> = {}
    for (const item of value) {
      if (!isRecord(item)) continue
      const name = typeof item.name === 'string' ? item.name : ''
      if (!name) continue
      const rawValue = 'value' in item ? item.value : undefined
      if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        fromArray[name] = rawValue
      }
    }
    return fromArray
  }

  if (isRecord(value)) {
    const properties: Record<string, string | number | boolean> = {}
    for (const [key, raw] of Object.entries(value)) {
      if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
        properties[key] = raw
      }
    }
    return properties
  }

  return {}
}

function isLdtkProjectJson(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  if ('jsonVersion' in value && 'defs' in value && ('worlds' in value || 'levels' in value)) {
    return true
  }
  return false
}

function resolvePath(baseFilePath: string, relativePath: string): string {
  if (/^[a-zA-Z]:[\\/]/.test(relativePath) || relativePath.startsWith('/')) {
    return relativePath
  }
  const normalizedBase = baseFilePath.replace(/\\/g, '/')
  const dir = normalizedBase.includes('/') ? normalizedBase.slice(0, normalizedBase.lastIndexOf('/')) : ''
  const joined = `${dir}/${relativePath}`.replace(/\\/g, '/')
  const parts = joined.split('/')
  const normalizedParts: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      normalizedParts.pop()
      continue
    }
    normalizedParts.push(part)
  }
  const prefix = /^[a-zA-Z]:/.test(normalizedParts[0] ?? '') ? '' : '/'
  return `${prefix}${normalizedParts.join('/')}`
}

async function parseLdtkProject(
  path: string,
  value: Record<string, unknown>,
  readFile?: ReadFileFn
): Promise<{ data: LevelData; tilesets: RoomTilesetReference[] }> {
  const worlds = Array.isArray(value.worlds) ? value.worlds : []
  const rootLevels = Array.isArray(value.levels) ? value.levels : []
  const ldtkDefs = isRecord(value.defs) ? value.defs : {}
  const ldtkTilesets = Array.isArray(ldtkDefs.tilesets) ? ldtkDefs.tilesets : []
  const tilesets: RoomTilesetReference[] = []
  const ldtkTilesetFirstGidByUid = new Map<number, number>()
  let nextFirstGid = 1

  for (const [index, rawTileset] of ldtkTilesets.entries()) {
    if (!isRecord(rawTileset)) continue
    const uid = toInt(rawTileset.uid, 0)
    const relPath = typeof rawTileset.relPath === 'string' ? rawTileset.relPath : null
    if (!relPath || uid <= 0) continue

    const tileSize = Math.max(1, toInt(rawTileset.tileGridSize, 16))
    const columns = Math.max(1, toInt(rawTileset.cWid, 0))
    const rows = Math.max(1, toInt(rawTileset.cHei, 0))
    const tileCount = Math.max(1, columns * rows)
    const firstGid = nextFirstGid
    nextFirstGid += tileCount

    ldtkTilesetFirstGidByUid.set(uid, firstGid)
    tilesets.push({
      id: `ldtk_${uid}`,
      name: typeof rawTileset.identifier === 'string' && rawTileset.identifier.length > 0
        ? rawTileset.identifier
        : `ldtk_tileset_${index + 1}`,
      sourcePath: resolvePath(path, relPath),
      tileSize,
      firstGid,
      tileCount,
      columns,
    })
  }

  let levelCandidate: Record<string, unknown> | null = null

  if (worlds.length > 0 && isRecord(worlds[0]) && Array.isArray(worlds[0].levels) && worlds[0].levels.length > 0) {
    const firstLevel = worlds[0].levels[0]
    if (isRecord(firstLevel)) {
      levelCandidate = firstLevel
    }
  } else if (rootLevels.length > 0 && isRecord(rootLevels[0])) {
    levelCandidate = rootLevels[0]
  }

  if (!levelCandidate) {
    throw new Error('LDtk project does not contain any levels.')
  }

  if (!Array.isArray(levelCandidate.layerInstances) && typeof levelCandidate.externalRelPath === 'string') {
    if (!readFile) {
      throw new Error('LDtk level uses external level data, but no file reader was provided.')
    }
    const externalPath = resolvePath(path, levelCandidate.externalRelPath)
    const externalContent = await readFile(externalPath)
    const parsedExternal = JSON.parse(externalContent)
    if (isRecord(parsedExternal)) {
      levelCandidate = parsedExternal
    }
  }

  const tileSize = Math.max(
    1,
    toInt(
      levelCandidate.layerInstances &&
      Array.isArray(levelCandidate.layerInstances) &&
      levelCandidate.layerInstances[0] &&
      isRecord(levelCandidate.layerInstances[0])
        ? levelCandidate.layerInstances[0].__gridSize
        : value.defaultGridSize,
      16
    )
  )

  const width = Math.max(
    1,
    toInt(levelCandidate.pxWid, tileSize * 16) / tileSize
  )
  const height = Math.max(
    1,
    toInt(levelCandidate.pxHei, tileSize * 16) / tileSize
  )

  const layers: Layer[] = []
  const layerInstances = Array.isArray(levelCandidate.layerInstances) ? levelCandidate.layerInstances : []
  for (const [layerIndex, rawLayer] of layerInstances.entries()) {
    if (!isRecord(rawLayer)) continue
    const name = typeof rawLayer.__identifier === 'string' && rawLayer.__identifier.length > 0
      ? rawLayer.__identifier
      : `Layer_${layerIndex}`
    const opacity = typeof rawLayer.__opacity === 'number' ? rawLayer.__opacity : 1
    const visible = rawLayer.visible !== false
    const layerType = typeof rawLayer.__type === 'string' ? rawLayer.__type : 'Tiles'

    const entityInstances = Array.isArray(rawLayer.entityInstances) ? rawLayer.entityInstances : []
    const isEntityLayer = layerType === 'Entities' || entityInstances.length > 0
    if (isEntityLayer) {
      const objects: EntityData[] = entityInstances
        .filter((entry) => isRecord(entry))
        .map((entry, entityIndex) => {
          const px = Array.isArray(entry.px) ? entry.px : [0, 0]
          return {
            id: typeof entry.iid === 'string' && entry.iid.length > 0 ? entry.iid : `${name}_${entityIndex + 1}`,
            type: normalizeEntityType(entry.__identifier),
            x: toNumber(px[0], toNumber(entry.__worldX, 0)),
            y: toNumber(px[1], toNumber(entry.__worldY, 0)),
            width: Math.max(0, toNumber(entry.width, tileSize)),
            height: Math.max(0, toNumber(entry.height, tileSize)),
            properties: {},
          }
        })
      layers.push({
        name,
        type: 'objectgroup',
        visible,
        locked: false,
        opacity,
        objects,
      })
      continue
    }

    const data = new Array(width * height).fill(0)
    const intGrid = Array.isArray(rawLayer.intGridCsv) ? rawLayer.intGridCsv : []
    if (intGrid.length === data.length) {
      for (let i = 0; i < data.length; i += 1) {
        data[i] = toInt(intGrid[i], 0)
      }
    }

    const tileSources: Array<unknown[]> = []
    if (Array.isArray(rawLayer.gridTiles)) tileSources.push(rawLayer.gridTiles)
    if (Array.isArray(rawLayer.autoLayerTiles)) tileSources.push(rawLayer.autoLayerTiles)

    for (const source of tileSources) {
      for (const tile of source) {
        if (!isRecord(tile)) continue
        const px = Array.isArray(tile.px) ? tile.px : [0, 0]
        const x = Math.floor(toNumber(px[0], 0) / tileSize)
        const y = Math.floor(toNumber(px[1], 0) / tileSize)
        if (x < 0 || x >= width || y < 0 || y >= height) continue
        const localTileId = stripTileFlags(toInt(tile.t, 0))
        const tilesetUid = toInt(rawLayer.__tilesetDefUid, 0)
        const layerFirstGid = ldtkTilesetFirstGidByUid.get(tilesetUid) ?? 1
        data[y * width + x] = layerFirstGid + localTileId
      }
    }

    layers.push({
      name,
      type: 'tilelayer',
      visible,
      locked: false,
      opacity,
      data: normalizeTileData(data, width, height),
    })
  }

  return {
    data: {
      id: typeof levelCandidate.identifier === 'string' && levelCandidate.identifier.length > 0
        ? levelCandidate.identifier
        : fileNameWithoutExtension(path),
      width,
      height,
      tileSize,
      layers,
      metadata: makeMetadata('ldtk'),
    },
    tilesets,
  }
}

function isTiledJsonMap(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  return Array.isArray(value.layers) && ('tilewidth' in value || 'tileheight' in value || 'tilesets' in value)
}

async function parseTiledJson(
  path: string,
  value: Record<string, unknown>,
  readFile?: ReadFileFn
): Promise<{ data: LevelData; tilesets: RoomTilesetReference[] }> {
  const width = Math.max(1, toInt(value.width, 1))
  const height = Math.max(1, toInt(value.height, 1))
  const tileSize = Math.max(1, toInt(value.tilewidth, 16))
  const rawLayers = Array.isArray(value.layers) ? value.layers : []
  const tilesets = await parseTiledJsonTilesets(path, value, tileSize, readFile)

  const layers: Layer[] = rawLayers
    .filter((layer) => isRecord(layer))
    .map((layer, index) => {
      const name = typeof layer.name === 'string' && layer.name.length > 0 ? layer.name : `Layer_${index}`
      const opacity = typeof layer.opacity === 'number' ? layer.opacity : 1
      const visible = layer.visible !== false
      const type = typeof layer.type === 'string' ? layer.type : 'tilelayer'

      if (type === 'objectgroup') {
        const objects: EntityData[] = Array.isArray(layer.objects)
          ? layer.objects.map((objectValue, objectIndex) => {
            const object = isRecord(objectValue) ? objectValue : {}
            const entityType = normalizeEntityType(object.type ?? object.name)
            const rawProps = normalizeProperties(object.properties)
            return {
              id: String(object.id ?? `${name}_${objectIndex + 1}`),
              type: entityType,
              x: toNumber(object.x, 0),
              y: toNumber(object.y, 0),
              width: Math.max(0, toNumber(object.width, tileSize)),
              height: Math.max(0, toNumber(object.height, tileSize)),
              properties: normalizeEntityProperties(entityType, rawProps),
            }
          })
          : []
        return {
          name,
          type: 'objectgroup',
          visible,
          locked: false,
          opacity,
          objects,
        }
      }

      const data = new Array(width * height).fill(0)
      if (Array.isArray(layer.data)) {
        for (let i = 0; i < Math.min(data.length, layer.data.length); i += 1) {
          data[i] = toInt(layer.data[i], 0)
        }
      }

      if (Array.isArray(layer.chunks)) {
        for (const chunkValue of layer.chunks) {
          if (!isRecord(chunkValue) || !Array.isArray(chunkValue.data)) continue
          const chunkX = toInt(chunkValue.x, 0)
          const chunkY = toInt(chunkValue.y, 0)
          const chunkWidth = Math.max(1, toInt(chunkValue.width, width))
          const chunkHeight = Math.max(1, toInt(chunkValue.height, height))
          const chunkData = chunkValue.data
          for (let localY = 0; localY < chunkHeight; localY += 1) {
            for (let localX = 0; localX < chunkWidth; localX += 1) {
              const mapX = chunkX + localX
              const mapY = chunkY + localY
              if (mapX < 0 || mapX >= width || mapY < 0 || mapY >= height) continue
              const sourceIndex = localY * chunkWidth + localX
              data[mapY * width + mapX] = toInt(chunkData[sourceIndex], 0)
            }
          }
        }
      }

      return {
        name,
        type: 'tilelayer',
        visible,
        locked: false,
        opacity,
        data: normalizeTileData(data, width, height),
      }
    })

  return {
    data: {
      id: typeof value.name === 'string' && value.name.length > 0 ? value.name : fileNameWithoutExtension(path),
      width,
      height,
      tileSize,
      layers,
      metadata: makeMetadata('tiled-json'),
    },
    tilesets,
  }
}

function looksLikeXml(text: string): boolean {
  return text.startsWith('<?xml') || text.startsWith('<map')
}

function getFileExtension(filePath: string): string {
  const match = /(?:\.([^.\\/]+))?$/.exec(filePath)
  return (match?.[1] ?? '').toLowerCase()
}

function parseXmlAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g
  let match = regex.exec(raw)
  while (match) {
    attrs[match[1]] = match[2]
    match = regex.exec(raw)
  }
  return attrs
}

function parseCsvNumbers(raw: string): number[] {
  return raw
    .trim()
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => toInt(item, 0))
}

function createTilesetIdFromPath(sourcePath: string, fallbackPrefix: string, index: number): string {
  const baseName = fileNameWithoutExtension(sourcePath)
  const safe = baseName.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  return safe.length > 0 ? safe.toLowerCase() : `${fallbackPrefix}_${index + 1}`
}

function parseTileCount(
  tileCount: unknown,
  columns: unknown,
  imageWidth: unknown,
  imageHeight: unknown,
  tileSize: number
): number | undefined {
  const direct = toInt(tileCount, 0)
  if (direct > 0) return direct
  const cols = toInt(columns, 0)
  if (cols > 0) {
    const rows = Math.max(1, Math.floor(toInt(imageHeight, 0) / tileSize))
    return cols * rows
  }
  const width = toInt(imageWidth, 0)
  const height = toInt(imageHeight, 0)
  if (width > 0 && height > 0) {
    const c = Math.max(1, Math.floor(width / tileSize))
    const r = Math.max(1, Math.floor(height / tileSize))
    return c * r
  }
  return undefined
}

function parseInlineTmxTileset(
  mapPath: string,
  firstGid: number,
  attrs: Record<string, string>,
  body: string,
  defaultTileSize: number,
  index: number
): RoomTilesetReference | null {
  const imageMatch = body.match(/<image\b([^>]*)\/?>/i)
  if (!imageMatch) return null
  const imageAttrs = parseXmlAttributes(imageMatch[1])
  const imageSource = imageAttrs.source
  if (!imageSource) return null

  const tileSize = Math.max(1, toInt(attrs.tilewidth, defaultTileSize))
  const sourcePath = resolvePath(mapPath, imageSource)
  const columns = Math.max(1, toInt(attrs.columns, Math.floor(toInt(imageAttrs.width, 0) / tileSize) || 1))
  const tileCount = parseTileCount(attrs.tilecount, attrs.columns, imageAttrs.width, imageAttrs.height, tileSize)
  const name = attrs.name && attrs.name.length > 0 ? attrs.name : fileNameWithoutExtension(sourcePath)

  return {
    id: createTilesetIdFromPath(sourcePath, 'tmx_tileset', index),
    name,
    sourcePath,
    tileSize,
    firstGid,
    tileCount,
    columns,
  }
}

function parseTsxToTilesetReference(
  tsxPath: string,
  tsxContent: string,
  firstGid: number,
  defaultTileSize: number,
  index: number
): RoomTilesetReference | null {
  const tsxMatch = tsxContent.match(/<tileset\b([^>]*)>/i)
  if (!tsxMatch) return null
  const tsxAttrs = parseXmlAttributes(tsxMatch[1])
  const imageMatch = tsxContent.match(/<image\b([^>]*)\/?>/i)
  if (!imageMatch) return null
  const imageAttrs = parseXmlAttributes(imageMatch[1])
  const imageSource = imageAttrs.source
  if (!imageSource) return null

  const tileSize = Math.max(1, toInt(tsxAttrs.tilewidth, defaultTileSize))
  const sourcePath = resolvePath(tsxPath, imageSource)
  const columns = Math.max(1, toInt(tsxAttrs.columns, Math.floor(toInt(imageAttrs.width, 0) / tileSize) || 1))
  const tileCount = parseTileCount(tsxAttrs.tilecount, tsxAttrs.columns, imageAttrs.width, imageAttrs.height, tileSize)
  const name = tsxAttrs.name && tsxAttrs.name.length > 0 ? tsxAttrs.name : fileNameWithoutExtension(sourcePath)

  return {
    id: createTilesetIdFromPath(sourcePath, 'tsx_tileset', index),
    name,
    sourcePath,
    tileSize,
    firstGid,
    tileCount,
    columns,
  }
}

async function parseTmxTilesets(
  mapPath: string,
  mapXml: string,
  defaultTileSize: number,
  readFile?: ReadFileFn
): Promise<RoomTilesetReference[]> {
  const references: RoomTilesetReference[] = []
  const tilesetRegex = /<tileset\b([^>]*?)(?:\/>|>([\s\S]*?)<\/tileset>)/gi
  let match = tilesetRegex.exec(mapXml)
  let index = 0
  while (match) {
    const attrs = parseXmlAttributes(match[1])
    const body = match[2] ?? ''
    const firstGid = Math.max(1, toInt(attrs.firstgid, 1))

    if (attrs.source) {
      const externalPath = resolvePath(mapPath, attrs.source)
      if (readFile) {
        try {
          const tsxContent = await readFile(externalPath)
          const ref = parseTsxToTilesetReference(externalPath, tsxContent, firstGid, defaultTileSize, index)
          if (ref) references.push(ref)
        } catch {
          // Skip unreadable TSX references; map data can still load.
        }
      }
    } else {
      const ref = parseInlineTmxTileset(mapPath, firstGid, attrs, body, defaultTileSize, index)
      if (ref) references.push(ref)
    }

    index += 1
    match = tilesetRegex.exec(mapXml)
  }

  return references.sort((a, b) => a.firstGid - b.firstGid)
}

async function parseTiledJsonTilesets(
  mapPath: string,
  map: Record<string, unknown>,
  defaultTileSize: number,
  readFile?: ReadFileFn
): Promise<RoomTilesetReference[]> {
  const rawTilesets = Array.isArray(map.tilesets) ? map.tilesets : []
  const references: RoomTilesetReference[] = []

  for (const [index, rawTileset] of rawTilesets.entries()) {
    if (!isRecord(rawTileset)) continue
    const firstGid = Math.max(1, toInt(rawTileset.firstgid, 1))

    if (typeof rawTileset.source === 'string' && rawTileset.source.length > 0) {
      const tsxPath = resolvePath(mapPath, rawTileset.source)
      if (!readFile) continue
      try {
        const tsxContent = await readFile(tsxPath)
        const ref = parseTsxToTilesetReference(tsxPath, tsxContent, firstGid, defaultTileSize, index)
        if (ref) references.push(ref)
      } catch {
        // Skip unreadable source tilesets.
      }
      continue
    }

    if (typeof rawTileset.image === 'string' && rawTileset.image.length > 0) {
      const tileSize = Math.max(1, toInt(rawTileset.tilewidth, defaultTileSize))
      const sourcePath = resolvePath(mapPath, rawTileset.image)
      const columns = Math.max(1, toInt(rawTileset.columns, Math.floor(toInt(rawTileset.imagewidth, 0) / tileSize) || 1))
      const tileCount = parseTileCount(
        rawTileset.tilecount,
        rawTileset.columns,
        rawTileset.imagewidth,
        rawTileset.imageheight,
        tileSize
      )
      const name = typeof rawTileset.name === 'string' && rawTileset.name.length > 0
        ? rawTileset.name
        : fileNameWithoutExtension(sourcePath)
      references.push({
        id: createTilesetIdFromPath(sourcePath, 'tiled_tileset', index),
        name,
        sourcePath,
        tileSize,
        firstGid,
        tileCount,
        columns,
      })
    }
  }

  return references.sort((a, b) => a.firstGid - b.firstGid)
}

async function parseTmx(
  path: string,
  content: string,
  readFile?: ReadFileFn
): Promise<{ data: LevelData; tilesets: RoomTilesetReference[] }> {
  const mapMatch = content.match(/<map\b([^>]*)>/i)
  if (!mapMatch) {
    throw new Error('Invalid TMX map: missing <map> root element.')
  }

  const mapAttrs = parseXmlAttributes(mapMatch[1])
  const width = Math.max(1, toInt(mapAttrs.width, 1))
  const height = Math.max(1, toInt(mapAttrs.height, 1))
  const tileSize = Math.max(1, toInt(mapAttrs.tilewidth, 16))
  const tilesets = await parseTmxTilesets(path, content, tileSize, readFile)

  const layers: Layer[] = []

  const tileLayerRegex = /<layer\b([^>]*)>([\s\S]*?)<\/layer>/gi
  let tileLayerMatch = tileLayerRegex.exec(content)
  while (tileLayerMatch) {
    const attrs = parseXmlAttributes(tileLayerMatch[1])
    const layerBody = tileLayerMatch[2]
    const name = attrs.name ?? `Layer_${layers.length + 1}`
    const visible = attrs.visible !== '0'
    const opacity = attrs.opacity !== undefined ? toNumber(attrs.opacity, 1) : 1
    const layerWidth = Math.max(1, toInt(attrs.width, width))
    const layerHeight = Math.max(1, toInt(attrs.height, height))
    const data = new Array(width * height).fill(0)

    const dataMatch = layerBody.match(/<data\b([^>]*)>([\s\S]*?)<\/data>/i)
    if (dataMatch) {
      const dataAttrs = parseXmlAttributes(dataMatch[1])
      const dataBody = dataMatch[2]
      const chunkRegex = /<chunk\b([^>]*)>([\s\S]*?)<\/chunk>/gi
      let chunkMatch = chunkRegex.exec(dataBody)
      if (chunkMatch) {
        while (chunkMatch) {
          const chunkAttrs = parseXmlAttributes(chunkMatch[1])
          const chunkX = toInt(chunkAttrs.x, 0)
          const chunkY = toInt(chunkAttrs.y, 0)
          const chunkWidth = Math.max(1, toInt(chunkAttrs.width, layerWidth))
          const chunkHeight = Math.max(1, toInt(chunkAttrs.height, layerHeight))
          const chunkData = parseCsvNumbers(chunkMatch[2])
          for (let localY = 0; localY < chunkHeight; localY += 1) {
            for (let localX = 0; localX < chunkWidth; localX += 1) {
              const mapX = chunkX + localX
              const mapY = chunkY + localY
              if (mapX < 0 || mapX >= width || mapY < 0 || mapY >= height) continue
              const sourceIndex = localY * chunkWidth + localX
              data[mapY * width + mapX] = toInt(chunkData[sourceIndex], 0)
            }
          }
          chunkMatch = chunkRegex.exec(dataBody)
        }
      } else if (!dataAttrs.encoding || dataAttrs.encoding === 'csv') {
        const csvValues = parseCsvNumbers(dataBody)
        for (let i = 0; i < Math.min(csvValues.length, data.length); i += 1) {
          data[i] = csvValues[i]
        }
      } else {
        const tileRegex = /<tile\b([^>]*)\/>/gi
        let tileMatch = tileRegex.exec(dataBody)
        let index = 0
        while (tileMatch && index < data.length) {
          const tileAttrs = parseXmlAttributes(tileMatch[1])
          data[index] = toInt(tileAttrs.gid, 0)
          index += 1
          tileMatch = tileRegex.exec(dataBody)
        }
      }
    }

    layers.push({
      name,
      type: 'tilelayer',
      visible,
      locked: false,
      opacity,
      data: normalizeTileData(data, width, height),
    })

    tileLayerMatch = tileLayerRegex.exec(content)
  }

  const objectGroupRegex = /<objectgroup\b([^>]*)>([\s\S]*?)<\/objectgroup>/gi
  let objectGroupMatch = objectGroupRegex.exec(content)
  while (objectGroupMatch) {
    const attrs = parseXmlAttributes(objectGroupMatch[1])
    const groupBody = objectGroupMatch[2]
    const name = attrs.name ?? `Entities_${layers.length + 1}`
    const visible = attrs.visible !== '0'
    const opacity = attrs.opacity !== undefined ? toNumber(attrs.opacity, 1) : 1

    const objects: EntityData[] = []
    const objectRegex = /<object\b([^>]*?)(?:\/>|>([\s\S]*?)<\/object>)/gi
    let objectMatch = objectRegex.exec(groupBody)
    while (objectMatch) {
      const objectAttrs = parseXmlAttributes(objectMatch[1])
      const objectBody = objectMatch[2] ?? ''

      const fallbackId = `${name}_${objects.length + 1}`
      const typeCandidate = objectAttrs.type || objectAttrs.name || 'prop'
      const tmxEntityType = normalizeEntityType(typeCandidate)
      const tmxProperties = normalizeEntityProperties(tmxEntityType, parseTmxProperties(objectBody))
      objects.push({
        id: objectAttrs.id ?? fallbackId,
        type: tmxEntityType,
        x: toNumber(objectAttrs.x, 0),
        y: toNumber(objectAttrs.y, 0),
        width: Math.max(0, toNumber(objectAttrs.width, tileSize)),
        height: Math.max(0, toNumber(objectAttrs.height, tileSize)),
        properties: tmxProperties,
      })

      objectMatch = objectRegex.exec(groupBody)
    }

    layers.push({
      name,
      type: 'objectgroup',
      visible,
      locked: false,
      opacity,
      objects,
    })

    objectGroupMatch = objectGroupRegex.exec(content)
  }

  return {
    data: {
      id: fileNameWithoutExtension(path),
      width,
      height,
      tileSize,
      layers,
      metadata: makeMetadata('tmx'),
    },
    tilesets,
  }
}

function parseTmxProperties(xml: string): Record<string, string | number | boolean> {
  const properties: Record<string, string | number | boolean> = {}
  const propertyRegex = /<property\b([^>]*?)(?:\/>|>([\s\S]*?)<\/property>)/gi
  let propertyMatch = propertyRegex.exec(xml)
  while (propertyMatch) {
    const attrs = parseXmlAttributes(propertyMatch[1])
    const name = attrs.name
    if (!name) {
      propertyMatch = propertyRegex.exec(xml)
      continue
    }

    let value: string | number | boolean = attrs.value ?? (propertyMatch[2] ?? '')
    const type = attrs.type ?? 'string'
    if (type === 'int' || type === 'float') {
      value = Number(value)
      if (!Number.isFinite(value)) value = 0
    } else if (type === 'bool' || type === 'boolean') {
      value = String(value).toLowerCase() === 'true' || String(value) === '1'
    }
    properties[name] = value
    propertyMatch = propertyRegex.exec(xml)
  }
  return properties
}
