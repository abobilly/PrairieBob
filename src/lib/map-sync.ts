import type { Level } from './ldtk/level'
import type { EntityInstance, LayerInstance, TileInstance } from './ldtk/layer-instance'
import { hasTileFlipX, hasTileFlipY } from './ldtk/layer-instance'
import { setTileFlipFlags } from './tileset'
import type { EntityData, EntityType, Layer, LevelData } from './types'

const FALLBACK_ENTITY_TYPE: EntityType = 'prop'

function toInteger(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

function toPositiveInteger(value: number, fallback: number): number {
  const next = toInteger(value)
  return next > 0 ? next : fallback
}

function toGridCoord(pixel: number, offset: number, gridSize: number): number {
  return Math.round((pixel - offset) / Math.max(gridSize, 1))
}

function buildTileLayerData(
  sourceLayer: Layer,
  layerInstance: LayerInstance,
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
): number[] {
  const width = toPositiveInteger(layerInstance.__cWid, mapWidth)
  const height = toPositiveInteger(layerInstance.__cHei, mapHeight)
  const nextData = new Array(width * height).fill(0)
  const gridSize = toPositiveInteger(layerInstance.__gridSize, tileSize)
  const offsetX = toInteger(layerInstance.__pxTotalOffsetX)
  const offsetY = toInteger(layerInstance.__pxTotalOffsetY)
  const tiles: TileInstance[] = [...layerInstance.autoLayerTiles, ...layerInstance.gridTiles]

  for (const tile of tiles) {
    const tileId = Math.max(0, toInteger(tile.t))
    if (tileId <= 0) continue
    const gridX = toGridCoord(tile.px[0], offsetX, gridSize)
    const gridY = toGridCoord(tile.px[1], offsetY, gridSize)
    if (gridX < 0 || gridY < 0 || gridX >= width || gridY >= height) continue
    const index = gridY * width + gridX
    nextData[index] = setTileFlipFlags(tileId, hasTileFlipX(tile), hasTileFlipY(tile))
  }

  return nextData
}

function toFallbackEntity(entity: EntityInstance): EntityData {
  return {
    id: entity.iid,
    type: FALLBACK_ENTITY_TYPE,
    x: toInteger(entity.px[0]),
    y: toInteger(entity.px[1]),
    width: toPositiveInteger(entity.width, 32),
    height: toPositiveInteger(entity.height, 32),
    properties: {},
  }
}

function mergeEntity(
  sourceEntity: EntityData | undefined,
  instanceEntity: EntityInstance,
): EntityData {
  if (!sourceEntity) {
    return toFallbackEntity(instanceEntity)
  }
  return {
    ...sourceEntity,
    x: toInteger(instanceEntity.px[0]),
    y: toInteger(instanceEntity.px[1]),
    width: toPositiveInteger(instanceEntity.width, sourceEntity.width || 32),
    height: toPositiveInteger(instanceEntity.height, sourceEntity.height || 32),
  }
}

function buildEntityObjects(sourceLayer: Layer, layerInstance: LayerInstance): EntityData[] {
  const sourceObjects = sourceLayer.objects ?? []
  const sourceById = new Map(sourceObjects.map((entity) => [entity.id, entity]))
  return layerInstance.entityInstances.map((entity) =>
    mergeEntity(sourceById.get(entity.iid), entity)
  )
}

function findLayerInstance(sourceLayer: Layer, layerInstances: LayerInstance[]): LayerInstance | null {
  return layerInstances.find((instance) =>
    instance.__identifier === sourceLayer.name
  ) ?? null
}

export function syncMapDataWithLevelEdits(
  sourceMapData: LevelData,
  level: Level | null | undefined,
): LevelData {
  const layerInstances = level?.layerInstances ?? []
  if (layerInstances.length === 0) return sourceMapData

  const nextLayers = sourceMapData.layers.map((layer) => {
    const layerInstance = findLayerInstance(layer, layerInstances)
    if (!layerInstance) return layer

    if (layer.type === 'objectgroup' || layerInstance.__type === 'Entities') {
      return {
        ...layer,
        objects: buildEntityObjects(layer, layerInstance),
      }
    }

    return {
      ...layer,
      data: buildTileLayerData(
        layer,
        layerInstance,
        sourceMapData.width,
        sourceMapData.height,
        sourceMapData.tileSize,
      ),
    }
  })

  return {
    ...sourceMapData,
    layers: nextLayers,
  }
}
