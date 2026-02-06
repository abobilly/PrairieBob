import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, LocateFixed, Plus, Search, Minus } from 'lucide-react'
import type { Level } from '@/lib/ldtk/level'
import type { EntityInstance, LayerInstance, TileInstance } from '@/lib/ldtk/layer-instance'
import type { IntGridValueDef } from '@/lib/ldtk/types'
import { Camera, MAX_ZOOM, MIN_ZOOM } from '@/lib/ldtk/camera'
import {
  PanTool,
  TileTool,
  LineTool,
  RectTool,
  EllipseTool,
  IntGridTool,
  EntityTool,
  SelectionTool,
  type ToolContext,
  type ToolLayer,
  hasTileFlipX,
  hasTileFlipY,
} from '@/lib/ldtk'
import { EntityRenderer } from '@/components/EntityRenderer'
import { Rulers } from '@/components/Rulers'
import { useProjectStore } from '@/stores'
import { useToolStore } from '@/stores/toolStore'
import { useLdtkToolStore } from '@/stores/ldtkToolStore'
import type { EntityData, LevelData, LoadedTileset, TileStamp } from '@/lib/types'
import { resolveTileId, setTileFlipFlags } from '@/lib/tileset'
import {
  resolveEditorEntityFrameSequence,
  resolveFrameIndex,
  type EntityDefinitionMap,
  type InteractionDefinitionMap,
  type SpriteFrameSource,
} from '@/lib/entity-definitions'

const DEFAULT_BG_COLOR = '#1f2430'
const DEFAULT_INTGRID_ALPHA = 0.35
const MINIMAP_WIDTH = 196
const MINIMAP_HEIGHT = 132
const MINIMAP_PADDING = 8

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

type RenderableTool = { render: (ctx: CanvasRenderingContext2D, camera: Camera) => void }

const isAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]|^\\\\|^\//.test(value)

const getDirectoryPath = (path: string) => path.replace(/[\\/][^\\/]+$/, '')

const joinPath = (base: string, rel: string) => {
  const trimmedBase = base.replace(/[\\/]+$/, '')
  const trimmedRel = rel.replace(/^[/\\]+/, '')
  const separator = trimmedBase.includes('\\') ? '\\' : '/'
  return `${trimmedBase}${separator}${trimmedRel}`
}

const intToHex = (value: number) => `#${Math.max(0, Math.min(0xffffff, value)).toString(16).padStart(6, '0')}`

const isTileLayer = (layer: LayerInstance) => layer.__type === 'Tiles' || layer.__type === 'AutoLayer'

const buildTileData = (layer: LayerInstance) => {
  const size = layer.__cWid * layer.__cHei
  const data = new Array(size).fill(0)
  const gridSize = layer.__gridSize || 1

  const applyTiles = (tiles: TileInstance[]) => {
    for (const tile of tiles) {
      const gridX = Math.floor(tile.px[0] / gridSize)
      const gridY = Math.floor(tile.px[1] / gridSize)
      if (gridX < 0 || gridY < 0 || gridX >= layer.__cWid || gridY >= layer.__cHei) continue
      data[gridY * layer.__cWid + gridX] = setTileFlipFlags(
        tile.t,
        hasTileFlipX(tile),
        hasTileFlipY(tile)
      )
    }
  }

  applyTiles(layer.autoLayerTiles)
  applyTiles(layer.gridTiles)
  return data
}

const createBounds = (x: number, y: number, width: number, height: number): Bounds => ({
  x,
  y,
  width: Math.max(1, width),
  height: Math.max(1, height),
})

const mergeBounds = (target: Bounds | null, next: Bounds): Bounds => {
  if (!target) return next
  const minX = Math.min(target.x, next.x)
  const minY = Math.min(target.y, next.y)
  const maxX = Math.max(target.x + target.width, next.x + next.width)
  const maxY = Math.max(target.y + target.height, next.y + next.height)
  return createBounds(minX, minY, maxX - minX, maxY - minY)
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const isCollisionLayerIdentifier = (identifier: string) => identifier.trim().toLowerCase() === 'collision'

async function loadImageCanvas(path: string): Promise<HTMLCanvasElement> {
  const img = new Image()

  if (window?.electron?.fs?.readFileBase64) {
    const base64 = await window.electron.fs.readFileBase64(path)
    img.src = `data:image/png;base64,${base64}`
  } else {
    img.src = path
  }

  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(img, 0, 0)
  }
  return canvas
}

function buildEntityLookup(mapData: LevelData): Map<string, EntityData> {
  const lookup = new Map<string, EntityData>()
  for (const layer of mapData.layers) {
    if (layer.type !== 'objectgroup' || !layer.objects) continue
    for (const entity of layer.objects) {
      lookup.set(entity.id, entity)
    }
  }
  return lookup
}

function resolveFrameToTileset(
  source: SpriteFrameSource,
  frameTileId: number,
  tilesets: LoadedTileset[],
): { tileset: LoadedTileset; localTileId: number } | null {
  if (source.kind === 'local') {
    const tileset = tilesets.find((entry) => entry.id === source.tilesetId)
    if (!tileset) return null
    return { tileset, localTileId: frameTileId }
  }
  const resolved = resolveTileId(frameTileId, tilesets)
  if (!resolved) return null
  return {
    tileset: resolved.tileset,
    localTileId: resolved.localTileId,
  }
}

interface ResolvedEntitySpriteTile {
  canvas: HTMLCanvasElement
  sourceX: number
  sourceY: number
  sourceSize: number
  tileX: number
  tileY: number
}

interface ResolvedEntitySprite {
  tiles: ResolvedEntitySpriteTile[]
  widthTiles: number
  heightTiles: number
}

export function LevelCanvas({
  level,
  tileStamp,
  mapData,
  onTilePicked,
  onEntityPicked,
  onIntGridPicked,
}: {
  level: Level
  tileStamp: TileStamp
  mapData: LevelData
  onTilePicked?: (tileId: number) => void
  onEntityPicked?: (entityId: string) => void
  onIntGridPicked?: (value: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera | null>(null)
  const minimapTransformRef = useRef<{
    bounds: Bounds
    scale: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const toolContextRef = useRef<ToolContext>({
    viewport: { zoom: 1, panX: 0, panY: 0 },
    setPan: () => {},
  })
  const tilesetCache = useRef(new Map<string, HTMLCanvasElement>())
  const tilesetLoading = useRef(new Set<string>())
  const activeToolLayerRef = useRef<ToolLayer | null>(null)

  const project = useProjectStore((s) => s.project)
  const tilesets = useProjectStore((s) => s.tilesets)
  const entityDefinitions = useProjectStore((s) => s.entityDefinitions)
  const interactionDefinitions = useProjectStore((s) => s.interactionDefinitions)
  const projectDir = project?.filePath ? getDirectoryPath(project.filePath) : null

  const zoom = useToolStore((s) => s.zoom)
  const panX = useToolStore((s) => s.panX)
  const panY = useToolStore((s) => s.panY)
  const setPan = useToolStore((s) => s.setPan)
  const setZoom = useToolStore((s) => s.setZoom)
  const selectedTileIds = useToolStore((s) => s.selectedTileIds)
  const selectedEntityDefUid = useToolStore((s) => s.selectedEntityDefUid)
  const selectedIntGridValue = useToolStore((s) => s.selectedIntGridValue)
  const activeLayerKey = useToolStore((s) => s.activeLayer)
  const setActiveTool = useToolStore((s) => s.setActiveTool)

  const activeToolId = useLdtkToolStore((s) => s.activeToolId)
  const setActiveToolId = useLdtkToolStore((s) => s.setActiveToolId)

  const [cursor, setCursor] = useState('crosshair')

  if (!cameraRef.current) {
    cameraRef.current = new Camera(1, 1)
  }

  const layers = level.layerInstances ?? []
  const sourceEntitiesById = useMemo(() => buildEntityLookup(mapData), [mapData])

  const resolveEntitySprite = useCallback((entity: EntityInstance, elapsedMs: number): ResolvedEntitySprite | null => {
    const sourceEntity = sourceEntitiesById.get(entity.iid)
    if (!sourceEntity) return null

    const sequence = resolveEditorEntityFrameSequence(
      sourceEntity,
      entityDefinitions as EntityDefinitionMap,
      interactionDefinitions as InteractionDefinitionMap,
    )
    if (!sequence || sequence.source.frameTileIds.length === 0) return null

    const spriteTiles: ResolvedEntitySpriteTile[] = []
    if (sequence.frameInterpretation === 'timeline') {
      const frameIndex = sequence.animate
        ? resolveFrameIndex(
          sequence.source.frameTileIds.length,
          elapsedMs,
          sequence.fps,
          sequence.loop,
        )
        : 0
      const frameTileId = sequence.source.frameTileIds[frameIndex] ?? sequence.source.frameTileIds[0]
      if (frameTileId === undefined) return null

      const resolvedFrame = resolveFrameToTileset(sequence.source, frameTileId, tilesets)
      if (!resolvedFrame) return null
      spriteTiles.push({
        canvas: resolvedFrame.tileset.canvas,
        sourceX: (resolvedFrame.localTileId % resolvedFrame.tileset.tilesPerRow) * resolvedFrame.tileset.tileSize,
        sourceY: Math.floor(resolvedFrame.localTileId / resolvedFrame.tileset.tilesPerRow) * resolvedFrame.tileset.tileSize,
        sourceSize: resolvedFrame.tileset.tileSize,
        tileX: 0,
        tileY: 0,
      })
    } else {
      for (let index = 0; index < sequence.source.frameTileIds.length; index += 1) {
        const frameTileId = sequence.source.frameTileIds[index]
        const resolvedFrame = resolveFrameToTileset(sequence.source, frameTileId, tilesets)
        if (!resolvedFrame) continue
        spriteTiles.push({
          canvas: resolvedFrame.tileset.canvas,
          sourceX: (resolvedFrame.localTileId % resolvedFrame.tileset.tilesPerRow) * resolvedFrame.tileset.tileSize,
          sourceY: Math.floor(resolvedFrame.localTileId / resolvedFrame.tileset.tilesPerRow) * resolvedFrame.tileset.tileSize,
          sourceSize: resolvedFrame.tileset.tileSize,
          tileX: index % sequence.widthTiles,
          tileY: Math.floor(index / sequence.widthTiles),
        })
      }
    }

    if (spriteTiles.length === 0) return null

    return {
      tiles: spriteTiles,
      widthTiles: sequence.widthTiles,
      heightTiles: sequence.heightTiles,
    }
  }, [sourceEntitiesById, entityDefinitions, interactionDefinitions, tilesets])

  const contentBounds = useMemo<Bounds>(() => {
    let aggregate: Bounds | null = null

    for (const layer of layers) {
      const layerGridSize = layer.__gridSize || 1
      const layerBounds = createBounds(
        layer.__pxTotalOffsetX,
        layer.__pxTotalOffsetY,
        layer.__cWid * layerGridSize,
        layer.__cHei * layerGridSize
      )
      aggregate = mergeBounds(aggregate, layerBounds)

      if (layer.__type === 'Entities') {
        for (const entity of layer.entityInstances) {
          const entityBounds = createBounds(
            entity.px[0],
            entity.px[1],
            entity.width || layerGridSize,
            entity.height || layerGridSize
          )
          aggregate = mergeBounds(aggregate, entityBounds)
        }
      }
    }

    if (aggregate) return aggregate

    return createBounds(
      level.worldX || 0,
      level.worldY || 0,
      level.pxWid || 1,
      level.pxHei || 1
    )
  }, [layers, level.pxHei, level.pxWid, level.worldX, level.worldY])

  const layerDefs = useMemo(
    () => project?.defs.layers ?? [],
    [project]
  )

  const layerByType = useMemo(() => {
    const reversed = [...layers].reverse()
    const collisionLayer = reversed.find(
      (layer) => isTileLayer(layer) && isCollisionLayerIdentifier(layer.__identifier)
    ) ?? null
    return {
      tile: reversed.find((layer) => isTileLayer(layer)) ?? null,
      intgrid: reversed.find((layer) => layer.__type === 'IntGrid') ?? collisionLayer,
      entity: reversed.find((layer) => layer.__type === 'Entities') ?? null,
      collision: collisionLayer,
    }
  }, [layers])

  const activeLayerInstance = useMemo(() => {
    if (!activeLayerKey) return null
    return layers.find((layer) =>
      layer.iid === activeLayerKey ||
      layer.__identifier === activeLayerKey ||
      String(layer.layerDefUid) === activeLayerKey
    ) ?? null
  }, [layers, activeLayerKey])

  const toolLayers = useMemo(() => {
    const tileLayer = activeLayerInstance && isTileLayer(activeLayerInstance)
      ? activeLayerInstance
      : layerByType.tile
    const intGridLayer = (activeLayerInstance?.__type === 'IntGrid' || (activeLayerInstance && isCollisionLayerIdentifier(activeLayerInstance.__identifier)))
      ? activeLayerInstance
      : layerByType.intgrid
    const entityLayer = activeLayerInstance?.__type === 'Entities'
      ? activeLayerInstance
      : layerByType.entity

    return {
      tile: tileLayer,
      intgrid: intGridLayer,
      entity: entityLayer,
    }
  }, [activeLayerInstance, layerByType])

  const toToolLayer = useCallback((layer: LayerInstance | null): ToolLayer | null => {
    if (!layer) return null
    if (layer.__type === 'Entities') {
      return {
        type: 'objectgroup',
        width: layer.__cWid,
        height: layer.__cHei,
        objects: layer.entityInstances.map((entity) => ({
          id: entity.iid,
          x: entity.px[0],
          y: entity.px[1],
          width: entity.width,
          height: entity.height,
        })),
      }
    }
    if (layer.__type === 'IntGrid') {
      return {
        type: 'intgrid',
        width: layer.__cWid,
        height: layer.__cHei,
        intGrid: layer.intGridCsv,
      }
    }
    return {
      type: 'tilelayer',
      width: layer.__cWid,
      height: layer.__cHei,
      data: buildTileData(layer),
    }
  }, [])

  const activeToolLayer = useMemo<ToolLayer | null>(() => {
    if (activeToolId === 'tile') return toToolLayer(toolLayers.tile)
    if (activeToolId === 'intgrid') return toToolLayer(toolLayers.intgrid ?? layerByType.collision ?? toolLayers.tile)
    if (activeToolId === 'entity') return toToolLayer(toolLayers.entity)
    if (activeToolId === 'select') {
      const fallbackLayer =
        activeLayerInstance ??
        toolLayers.entity ??
        toolLayers.intgrid ??
        layerByType.collision ??
        toolLayers.tile
      return toToolLayer(fallbackLayer)
    }
    return null
  }, [activeToolId, toolLayers, layerByType.collision, activeLayerInstance, toToolLayer])

  const gridSize = useMemo(() => {
    return (
      activeLayerInstance?.__gridSize ??
      layerByType.tile?.__gridSize ??
      layerByType.intgrid?.__gridSize ??
      level.layerInstances?.[0]?.__gridSize ??
      16
    )
  }, [activeLayerInstance, layerByType, level.layerInstances])

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current
    const camera = cameraRef.current
    if (!canvas || !camera) return { x: screenX, y: screenY }
    const rect = canvas.getBoundingClientRect()
    const localX = screenX - rect.left
    const localY = screenY - rect.top
    return camera.screenToWorld(localX, localY)
  }, [])

  const worldToTile = useCallback((worldX: number, worldY: number) => {
    const layer = toolLayers.tile ?? toolLayers.intgrid ?? null
    if (!layer) return { x: 0, y: 0 }
    const size = layer.__gridSize || 1
    const localX = worldX - layer.__pxTotalOffsetX
    const localY = worldY - layer.__pxTotalOffsetY
    return {
      x: Math.floor(localX / size),
      y: Math.floor(localY / size),
    }
  }, [toolLayers])

  const getTilesetPath = useCallback((layer: LayerInstance) => {
    const relPath = layer.__tilesetRelPath ?? null
    if (!relPath) return null
    if (isAbsolutePath(relPath)) return relPath
    if (projectDir) return joinPath(projectDir, relPath)
    return relPath
  }, [projectDir])

  const getTilesetCanvas = useCallback((layer: LayerInstance) => {
    const path = getTilesetPath(layer)
    if (!path) return null
    const cached = tilesetCache.current.get(path)
    if (cached) return cached
    if (tilesetLoading.current.has(path)) return null
    tilesetLoading.current.add(path)
    loadImageCanvas(path)
      .then((canvas) => {
        tilesetCache.current.set(path, canvas)
      })
      .catch((err) => {
        console.warn('[LevelCanvas] Failed to load tileset', path, err)
      })
      .finally(() => {
        tilesetLoading.current.delete(path)
      })
    return null
  }, [getTilesetPath])

  const toolsRef = useRef<{
    pan: PanTool
    tile: TileTool
    line: LineTool
    rect: RectTool
    ellipse: EllipseTool
    intgrid: IntGridTool
    entity: EntityTool
    select: SelectionTool
  } | null>(null)

  if (!toolsRef.current) {
    const context = toolContextRef.current
    toolsRef.current = {
      pan: new PanTool(context),
      tile: new TileTool(context),
      line: new LineTool(context),
      rect: new RectTool(context),
      ellipse: new EllipseTool(context),
      intgrid: new IntGridTool(context),
      entity: new EntityTool(context),
      select: new SelectionTool(context),
    }
  }

  useEffect(() => {
    setActiveTool(activeToolId)
  }, [activeToolId, setActiveTool])

  const clampPanToContent = useCallback((nextPanX: number, nextPanY: number, atZoom = zoom) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: nextPanX, y: nextPanY }

    const rect = canvas.getBoundingClientRect()
    const viewportWidth = Math.max(1, rect.width)
    const viewportHeight = Math.max(1, rect.height)
    const safeZoom = clamp(atZoom, MIN_ZOOM, MAX_ZOOM)

    const contentPixelWidth = Math.max(1, contentBounds.width * safeZoom)
    const contentPixelHeight = Math.max(1, contentBounds.height * safeZoom)
    const contentLeft = contentBounds.x * safeZoom
    const contentTop = contentBounds.y * safeZoom
    const margin = Math.max(64, 2 * gridSize * safeZoom)

    let minPanX = viewportWidth - (contentLeft + contentPixelWidth) - margin
    let maxPanX = -contentLeft + margin
    let minPanY = viewportHeight - (contentTop + contentPixelHeight) - margin
    let maxPanY = -contentTop + margin

    // Keep smaller maps centered so accidental pan/zoom interactions do not "lose" the level.
    if (contentPixelWidth + margin * 2 <= viewportWidth) {
      const centeredX = viewportWidth * 0.5 - (contentLeft + contentPixelWidth * 0.5)
      minPanX = centeredX
      maxPanX = centeredX
    }
    if (contentPixelHeight + margin * 2 <= viewportHeight) {
      const centeredY = viewportHeight * 0.5 - (contentTop + contentPixelHeight * 0.5)
      minPanY = centeredY
      maxPanY = centeredY
    }

    return {
      x: clamp(nextPanX, minPanX, maxPanX),
      y: clamp(nextPanY, minPanY, maxPanY),
    }
  }, [contentBounds, gridSize, zoom])

  const applyPan = useCallback((nextPanX: number, nextPanY: number, atZoom = zoom) => {
    const clampedPan = clampPanToContent(nextPanX, nextPanY, atZoom)
    setPan(clampedPan.x, clampedPan.y)
  }, [clampPanToContent, setPan, zoom])

  const applyZoomToPoint = useCallback((nextZoom: number, screenX: number, screenY: number) => {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const worldX = (screenX - panX) / zoom
    const worldY = (screenY - panY) / zoom
    const rawPanX = screenX - worldX * clampedZoom
    const rawPanY = screenY - worldY * clampedZoom
    const clampedPan = clampPanToContent(rawPanX, rawPanY, clampedZoom)
    setZoom(clampedZoom)
    setPan(clampedPan.x, clampedPan.y)
  }, [panX, panY, zoom, clampPanToContent, setPan, setZoom])

  useEffect(() => {
    const context = toolContextRef.current
    context.viewport = { zoom, panX, panY }
    context.setPan = (x, y) => applyPan(x, y, zoom)
    context.setZoom = setZoom
    context.zoomToPoint = applyZoomToPoint
    context.screenToWorld = screenToWorld
    context.worldToTile = worldToTile
    context.tileSize = gridSize
    context.getActiveLayer = () => activeToolLayerRef.current
    context.onPickTile = (tileId) => {
      if (tileId > 0) {
        onTilePicked?.(tileId)
      }
    }
    context.onPickEntity = onEntityPicked
    context.onPickIntGrid = onIntGridPicked
    context.resolveTileSource = (tileId) => {
      const resolved = resolveTileId(tileId, tilesets)
      if (!resolved) return null
      const col = resolved.localTileId % resolved.tileset.tilesPerRow
      const row = Math.floor(resolved.localTileId / resolved.tileset.tilesPerRow)
      return {
        x: col * resolved.tileset.tileSize,
        y: row * resolved.tileset.tileSize,
      }
    }
  }, [
    zoom,
    panX,
    panY,
    applyPan,
    setZoom,
    applyZoomToPoint,
    screenToWorld,
    worldToTile,
    gridSize,
    onTilePicked,
    onEntityPicked,
    onIntGridPicked,
    tilesets,
  ])

  useEffect(() => {
    activeToolLayerRef.current = activeToolLayer
  }, [activeToolLayer])

  const centerViewportOnWorld = useCallback((worldX: number, worldY: number, nextZoom = zoom) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    setZoom(clampedZoom)
    applyPan(
      rect.width * 0.5 - worldX * clampedZoom,
      rect.height * 0.5 - worldY * clampedZoom,
      clampedZoom,
    )
  }, [applyPan, setZoom, zoom])

  useEffect(() => {
    const clamped = clampPanToContent(panX, panY, zoom)
    const driftX = Math.abs(clamped.x - panX)
    const driftY = Math.abs(clamped.y - panY)
    if (driftX > 0.5 || driftY > 0.5) {
      setPan(clamped.x, clamped.y)
    }
  }, [clampPanToContent, panX, panY, zoom, setPan])

  const fitViewportToContent = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const safeWidth = Math.max(contentBounds.width, 1)
    const safeHeight = Math.max(contentBounds.height, 1)
    const fitZoom = Math.min((rect.width * 0.9) / safeWidth, (rect.height * 0.9) / safeHeight)
    const targetZoom = clamp(fitZoom, MIN_ZOOM, MAX_ZOOM)
    centerViewportOnWorld(
      contentBounds.x + contentBounds.width * 0.5,
      contentBounds.y + contentBounds.height * 0.5,
      targetZoom
    )
  }, [centerViewportOnWorld, contentBounds])

  const jumpToOrigin = useCallback(() => {
    centerViewportOnWorld(0, 0, zoom)
  }, [centerViewportOnWorld, zoom])

  useEffect(() => {
    if (!toolsRef.current) return
    toolsRef.current.tile.setLayer(toolLayers.tile)
    toolsRef.current.line.setLayer(toolLayers.tile)
    toolsRef.current.rect.setLayer(toolLayers.tile)
    toolsRef.current.ellipse.setLayer(toolLayers.tile)
    toolsRef.current.intgrid.setLayer(toolLayers.intgrid ?? layerByType.collision ?? toolLayers.tile)
    toolsRef.current.entity.setLayer(toolLayers.entity)
    toolsRef.current.tile.setSelectedTiles(selectedTileIds)
    toolsRef.current.line.setSelectedTiles(selectedTileIds)
    toolsRef.current.rect.setSelectedTiles(selectedTileIds)
    toolsRef.current.ellipse.setSelectedTiles(selectedTileIds)
    toolsRef.current.tile.setTileStamp(tileStamp.tiles)
    toolsRef.current.intgrid.selectedValue = selectedIntGridValue
    toolsRef.current.entity.setSelectedEntityDef(selectedEntityDefUid)
  }, [toolLayers, selectedTileIds, tileStamp, selectedIntGridValue, selectedEntityDefUid, layerByType.collision])

  const getActiveTool = useCallback(() => {
    const tools = toolsRef.current
    if (!tools) return null
    switch (activeToolId) {
      case 'pan':
        return tools.pan
      case 'intgrid':
        return tools.intgrid
      case 'entity':
        return tools.entity
      case 'select':
        return tools.select
      case 'line':
        return tools.line
      case 'rect':
        return tools.rect
      case 'ellipse':
        return tools.ellipse
      case 'tile':
      default:
        return tools.tile
    }
  }, [activeToolId])

  const updateCursor = useCallback(() => {
    const tool = getActiveTool()
    setCursor(tool?.getCursor() ?? 'crosshair')
  }, [getActiveTool])

  useEffect(() => {
    updateCursor()
  }, [updateCursor])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select'
    }

    let temporaryPanSource: string | null = null

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isEditableTarget(event.target)) return
      if (activeToolId === 'pan') return
      temporaryPanSource = activeToolId
      setActiveToolId('pan')
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (!temporaryPanSource) return
      setActiveToolId(temporaryPanSource)
      temporaryPanSource = null
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [activeToolId, setActiveToolId])

  const renderTiles = useCallback(
    (ctx: CanvasRenderingContext2D, layer: LayerInstance, tiles: TileInstance[]) => {
      const tilesetCanvas = getTilesetCanvas(layer)
      const gridSize = layer.__gridSize || 1
      const offsetX = layer.__pxTotalOffsetX
      const offsetY = layer.__pxTotalOffsetY

      for (const tile of tiles) {
        const x = tile.px[0] + offsetX
        const y = tile.px[1] + offsetY
        const alpha = Number.isFinite(tile.a) ? tile.a : 1
        const flipX = hasTileFlipX(tile)
        const flipY = hasTileFlipY(tile)

        ctx.save()
        ctx.globalAlpha = layer.__opacity * alpha
        ctx.translate(x + (flipX ? gridSize : 0), y + (flipY ? gridSize : 0))
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)

        if (tilesetCanvas) {
          ctx.drawImage(
            tilesetCanvas,
            tile.src[0],
            tile.src[1],
            gridSize,
            gridSize,
            0,
            0,
            gridSize,
            gridSize
          )
        } else {
          ctx.fillStyle = 'rgba(255, 0, 255, 0.4)'
          ctx.fillRect(0, 0, gridSize, gridSize)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
          ctx.lineWidth = 1 / (cameraRef.current?.zoom || 1)
          ctx.strokeRect(0, 0, gridSize, gridSize)
        }

        ctx.restore()
      }
    },
    [getTilesetCanvas]
  )

  const renderIntGrid = useCallback(
    (ctx: CanvasRenderingContext2D, layer: LayerInstance, values: IntGridValueDef[] | undefined) => {
      const gridSize = layer.__gridSize || 1
      const offsetX = layer.__pxTotalOffsetX
      const offsetY = layer.__pxTotalOffsetY
      const colorMap = new Map<number, string>()

      values?.forEach((value) => {
        colorMap.set(value.value, intToHex(value.color))
      })

      for (let y = 0; y < layer.__cHei; y++) {
        for (let x = 0; x < layer.__cWid; x++) {
          const value = layer.intGridCsv[y * layer.__cWid + x] ?? 0
          if (value === 0) continue
          const color = colorMap.get(value) ?? `hsla(${(value * 53) % 360}, 65%, 55%, ${DEFAULT_INTGRID_ALPHA})`
          ctx.save()
          ctx.globalAlpha = layer.__opacity
          ctx.fillStyle = color
          ctx.fillRect(
            x * gridSize + offsetX,
            y * gridSize + offsetY,
            gridSize,
            gridSize
          )
          ctx.restore()
        }
      }
    },
    []
  )

  const renderCollisionLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: LayerInstance) => {
      const gridSize = layer.__gridSize || 1
      const offsetX = layer.__pxTotalOffsetX
      const offsetY = layer.__pxTotalOffsetY
      const tiles = [...layer.autoLayerTiles, ...layer.gridTiles]

      ctx.save()
      ctx.globalAlpha = Math.max(0.08, Math.min(1, layer.__opacity)) * 0.18
      ctx.fillStyle = 'rgba(244, 63, 94, 0.6)'
      for (const tile of tiles) {
        ctx.fillRect(tile.px[0] + offsetX, tile.px[1] + offsetY, gridSize, gridSize)
      }
      ctx.restore()
    },
    []
  )

  const renderLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: LayerInstance) => {
      if (!layer.visible) return
      if (isTileLayer(layer)) {
        if (isCollisionLayerIdentifier(layer.__identifier)) {
          renderCollisionLayer(ctx, layer)
          return
        }
        renderTiles(ctx, layer, layer.autoLayerTiles)
        renderTiles(ctx, layer, layer.gridTiles)
        return
      }
      if (layer.__type === 'IntGrid') {
        const def = layerDefs.find((candidate) => candidate.uid === layer.layerDefUid)
        renderIntGrid(ctx, layer, def?.intGridValues)
      }
    },
    [layerDefs, renderTiles, renderIntGrid, renderCollisionLayer]
  )

  const renderEntities = useCallback(
    (ctx: CanvasRenderingContext2D, camera: Camera, elapsedMs: number) => {
      for (const layer of layers) {
        if (!layer.visible || layer.__type !== 'Entities') continue
        ctx.save()
        ctx.globalAlpha = layer.__opacity
        EntityRenderer({
          entities: layer.entityInstances,
          camera,
          ctx,
          getEntitySpriteFrame: (entity) => resolveEntitySprite(entity, elapsedMs),
        })
        ctx.restore()
      }
    },
    [layers, resolveEntitySprite]
  )

  const renderActiveTool = useCallback(
    (ctx: CanvasRenderingContext2D, camera: Camera) => {
      const tool = getActiveTool()
      if (!tool) return
      if (activeToolId === 'select') {
        const renderable = tool as RenderableTool
        renderable.render?.(ctx, camera)
        return
      }
      const renderable = tool as RenderableTool
      if (!renderable.render) return
      ctx.save()
      ctx.translate(camera.panX, camera.panY)
      ctx.scale(camera.zoom, camera.zoom)
      renderable.render(ctx, camera)
      ctx.restore()
    },
    [activeToolId, getActiveTool]
  )

  const renderMinimap = useCallback((camera: Camera) => {
    const minimap = minimapRef.current
    if (!minimap) return

    if (minimap.width !== MINIMAP_WIDTH || minimap.height !== MINIMAP_HEIGHT) {
      minimap.width = MINIMAP_WIDTH
      minimap.height = MINIMAP_HEIGHT
    }

    const ctx = minimap.getContext('2d')
    if (!ctx) return

    const mapWidth = MINIMAP_WIDTH
    const mapHeight = MINIMAP_HEIGHT
    const safeWidth = Math.max(contentBounds.width, 1)
    const safeHeight = Math.max(contentBounds.height, 1)
    const scale = Math.min(
      (mapWidth - MINIMAP_PADDING * 2) / safeWidth,
      (mapHeight - MINIMAP_PADDING * 2) / safeHeight
    )
    const scaledWidth = safeWidth * scale
    const scaledHeight = safeHeight * scale
    const offsetX = (mapWidth - scaledWidth) * 0.5
    const offsetY = (mapHeight - scaledHeight) * 0.5

    minimapTransformRef.current = {
      bounds: contentBounds,
      scale,
      offsetX,
      offsetY,
    }

    const toMiniX = (worldX: number) => (worldX - contentBounds.x) * scale + offsetX
    const toMiniY = (worldY: number) => (worldY - contentBounds.y) * scale + offsetY

    ctx.clearRect(0, 0, mapWidth, mapHeight)
    ctx.fillStyle = 'rgba(11, 16, 24, 0.95)'
    ctx.fillRect(0, 0, mapWidth, mapHeight)

    ctx.fillStyle = 'rgba(44, 64, 96, 0.45)'
    ctx.fillRect(offsetX, offsetY, scaledWidth, scaledHeight)

    for (const layer of layers) {
      if (!layer.visible) continue
      const layerGridSize = layer.__gridSize || 1
      const layerX = toMiniX(layer.__pxTotalOffsetX)
      const layerY = toMiniY(layer.__pxTotalOffsetY)
      const layerWidth = layer.__cWid * layerGridSize * scale
      const layerHeight = layer.__cHei * layerGridSize * scale
      if (layer.__type === 'Entities') {
        ctx.strokeStyle = 'rgba(95, 194, 255, 0.85)'
      } else if (layer.__type === 'IntGrid') {
        ctx.strokeStyle = 'rgba(128, 255, 171, 0.7)'
      } else {
        ctx.strokeStyle = 'rgba(222, 231, 243, 0.5)'
      }
      ctx.lineWidth = 1
      ctx.strokeRect(layerX, layerY, Math.max(layerWidth, 1), Math.max(layerHeight, 1))

      if (layer.__type === 'Entities') {
        ctx.fillStyle = 'rgba(95, 194, 255, 0.95)'
        for (const entity of layer.entityInstances) {
          const ex = toMiniX(entity.px[0])
          const ey = toMiniY(entity.px[1])
          const ew = Math.max((entity.width || layerGridSize) * scale, 2)
          const eh = Math.max((entity.height || layerGridSize) * scale, 2)
          ctx.fillRect(ex, ey, ew, eh)
        }
      }
    }

    const worldTopLeft = camera.screenToWorld(0, 0)
    const worldBottomRight = camera.screenToWorld(camera.width, camera.height)
    const viewportX = toMiniX(worldTopLeft.x)
    const viewportY = toMiniY(worldTopLeft.y)
    const viewportWidth = (worldBottomRight.x - worldTopLeft.x) * scale
    const viewportHeight = (worldBottomRight.y - worldTopLeft.y) * scale

    ctx.fillStyle = 'rgba(0, 210, 255, 0.15)'
    ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight)
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.95)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight)

    ctx.strokeStyle = 'rgba(122, 148, 184, 0.7)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, mapWidth - 1, mapHeight - 1)
  }, [contentBounds, layers])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const camera = cameraRef.current
    if (!canvas || !camera) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.max(1, Math.floor(rect.width))
    const displayHeight = Math.max(1, Math.floor(rect.height))
    const pixelWidth = Math.max(1, Math.floor(displayWidth * dpr))
    const pixelHeight = Math.max(1, Math.floor(displayHeight * dpr))

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    camera.width = displayWidth
    camera.height = displayHeight
    camera.setZoom(zoom)
    camera.setPan(panX, panY)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = level.__bgColor || DEFAULT_BG_COLOR
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    ctx.save()
    ctx.translate(camera.panX, camera.panY)
    ctx.scale(camera.zoom, camera.zoom)
    ctx.imageSmoothingEnabled = false

    for (const layer of layers) {
      renderLayer(ctx, layer)
    }

    ctx.restore()

    renderEntities(ctx, camera, performance.now())

    Rulers({
      camera,
      ctx,
      gridSize,
      showGrid: true,
      showRulers: true,
    })

    renderActiveTool(ctx, camera)
    renderMinimap(camera)
  }, [level.__bgColor, layers, gridSize, panX, panY, zoom, renderLayer, renderEntities, renderActiveTool, renderMinimap])

  useEffect(() => {
    let frameId = 0
    const tick = () => {
      renderCanvas()
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [renderCanvas])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const tool = getActiveTool()
    if (!tool) return
    tool.onMouseDown(event.nativeEvent)
    updateCursor()
  }, [getActiveTool, updateCursor])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const tool = getActiveTool()
    if (!tool) return
    const world = screenToWorld(event.clientX, event.clientY)
    toolContextRef.current.lastMouseWorld = world
    tool.onMouseMove(event.nativeEvent)
    updateCursor()
  }, [getActiveTool, screenToWorld, updateCursor])

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const tool = getActiveTool()
    if (!tool) return
    tool.onMouseUp()
    updateCursor()
  }, [getActiveTool, updateCursor])

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
  }, [])

  const handleWheel = useCallback((event: WheelEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      const delta = event.deltaY > 0 ? 0.9 : 1.1
      applyZoomToPoint(zoom * delta, screenX, screenY)
      return
    }

    event.preventDefault()
    applyPan(panX - event.deltaX, panY - event.deltaY, zoom)
  }, [applyPan, applyZoomToPoint, panX, panY, zoom])

  const handleZoomInClick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    applyZoomToPoint(zoom * 1.2, canvas.clientWidth * 0.5, canvas.clientHeight * 0.5)
  }, [zoom, applyZoomToPoint])

  const handleZoomOutClick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    applyZoomToPoint(zoom / 1.2, canvas.clientWidth * 0.5, canvas.clientHeight * 0.5)
  }, [zoom, applyZoomToPoint])

  const handleMinimapPointer = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.type === 'mousemove' && event.buttons !== 1) return
    const transform = minimapTransformRef.current
    if (!transform) return

    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const worldX = transform.bounds.x + (localX - transform.offsetX) / transform.scale
    const worldY = transform.bounds.y + (localY - transform.offsetY) / transform.scale
    centerViewportOnWorld(worldX, worldY)
  }, [centerViewportOnWorld])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div ref={containerRef} className="pb-level-canvas">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      />

      <div className="pb-canvas-hud">
        <button
          type="button"
          className="pb-canvas-hud-btn"
          title="Zoom out"
          onClick={handleZoomOutClick}
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          className="pb-canvas-hud-zoom"
          title="Current zoom level"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="pb-canvas-hud-btn"
          title="Zoom in"
          onClick={handleZoomInClick}
        >
          <Plus size={13} />
        </button>
        <button
          type="button"
          className="pb-canvas-hud-btn"
          title="Fit view to content"
          onClick={fitViewportToContent}
        >
          <Search size={13} />
        </button>
        <button
          type="button"
          className="pb-canvas-hud-btn"
          title="Go to origin (0,0)"
          onClick={jumpToOrigin}
        >
          <Crosshair size={13} />
        </button>
      </div>

      <div className="pb-minimap-shell">
        <div className="pb-minimap-title">
          <LocateFixed size={11} />
          <span>Minimap</span>
        </div>
        <canvas
          ref={minimapRef}
          className="pb-minimap-canvas"
          onMouseDown={handleMinimapPointer}
          onMouseMove={handleMinimapPointer}
          onContextMenu={handleContextMenu}
        />
      </div>
    </div>
  )
}
