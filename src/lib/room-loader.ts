import type { EntityData, EntityType, Layer, LevelData } from './types'

export type RoomSourceFormat = 'spudtile-json' | 'tiled-json' | 'ldtk' | 'tmx'

export type ReadFileFn = (path: string) => Promise<string>

export interface RoomLoadResult {
  data: LevelData
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
    return {
      data: parseTmx(path, trimmed),
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
      sourceFormat: 'spudtile-json',
      warnings: [],
    }
  }

  if (isLdtkProjectJson(parsed)) {
    const result = await parseLdtkProject(path, parsed, readFile)
    return {
      data: result,
      sourceFormat: 'ldtk',
      warnings: [],
    }
  }

  if (isTiledJsonMap(parsed)) {
    return {
      data: parseTiledJson(path, parsed),
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
  const normalized = typeof value === 'string' ? value.toLowerCase() : ''
  return ENTITY_TYPES.has(normalized as EntityType) ? (normalized as EntityType) : 'prop'
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
  return {
    id,
    type,
    x: toNumber(entity.x, 0),
    y: toNumber(entity.y, 0),
    width: Math.max(0, toNumber(entity.width, 16)),
    height: Math.max(0, toNumber(entity.height, 16)),
    properties: normalizeProperties(entity.properties),
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

async function parseLdtkProject(path: string, value: Record<string, unknown>, readFile?: ReadFileFn): Promise<LevelData> {
  const worlds = Array.isArray(value.worlds) ? value.worlds : []
  const rootLevels = Array.isArray(value.levels) ? value.levels : []

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
        data[y * width + x] = stripTileFlags(toInt(tile.t, 0))
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
    id: typeof levelCandidate.identifier === 'string' && levelCandidate.identifier.length > 0
      ? levelCandidate.identifier
      : fileNameWithoutExtension(path),
    width,
    height,
    tileSize,
    layers,
    metadata: makeMetadata('ldtk'),
  }
}

function isTiledJsonMap(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  return Array.isArray(value.layers) && ('tilewidth' in value || 'tileheight' in value || 'tilesets' in value)
}

function parseTiledJson(path: string, value: Record<string, unknown>): LevelData {
  const width = Math.max(1, toInt(value.width, 1))
  const height = Math.max(1, toInt(value.height, 1))
  const tileSize = Math.max(1, toInt(value.tilewidth, 16))
  const rawLayers = Array.isArray(value.layers) ? value.layers : []

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
            return {
              id: String(object.id ?? `${name}_${objectIndex + 1}`),
              type: normalizeEntityType(object.type ?? object.name),
              x: toNumber(object.x, 0),
              y: toNumber(object.y, 0),
              width: Math.max(0, toNumber(object.width, tileSize)),
              height: Math.max(0, toNumber(object.height, tileSize)),
              properties: normalizeProperties(object.properties),
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
          data[i] = stripTileFlags(toInt(layer.data[i], 0))
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
              data[mapY * width + mapX] = stripTileFlags(toInt(chunkData[sourceIndex], 0))
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
    id: typeof value.name === 'string' && value.name.length > 0 ? value.name : fileNameWithoutExtension(path),
    width,
    height,
    tileSize,
    layers,
    metadata: makeMetadata('tiled-json'),
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
    .map((item) => stripTileFlags(toInt(item, 0)))
}

function parseTmx(path: string, content: string): LevelData {
  const mapMatch = content.match(/<map\b([^>]*)>/i)
  if (!mapMatch) {
    throw new Error('Invalid TMX map: missing <map> root element.')
  }

  const mapAttrs = parseXmlAttributes(mapMatch[1])
  const width = Math.max(1, toInt(mapAttrs.width, 1))
  const height = Math.max(1, toInt(mapAttrs.height, 1))
  const tileSize = Math.max(1, toInt(mapAttrs.tilewidth, 16))

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
          data[index] = stripTileFlags(toInt(tileAttrs.gid, 0))
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
      const properties = parseTmxProperties(objectBody)
      objects.push({
        id: objectAttrs.id ?? fallbackId,
        type: normalizeEntityType(typeCandidate),
        x: toNumber(objectAttrs.x, 0),
        y: toNumber(objectAttrs.y, 0),
        width: Math.max(0, toNumber(objectAttrs.width, tileSize)),
        height: Math.max(0, toNumber(objectAttrs.height, tileSize)),
        properties,
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
    id: fileNameWithoutExtension(path),
    width,
    height,
    tileSize,
    layers,
    metadata: makeMetadata('tmx'),
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
