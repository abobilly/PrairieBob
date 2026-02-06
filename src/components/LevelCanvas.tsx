import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, LocateFixed, Plus, Search, Minus } from 'lucide-react'
import type { Level } from '@/lib/ldtk/level'
import type { LayerInstance, TileInstance } from '@/lib/ldtk/layer-instance'
import type { IntGridValueDef } from '@/lib/ldtk/types'
import { Camera, MAX_ZOOM, MIN_ZOOM } from '@/lib/ldtk/camera'
import {
  PanTool,
  TileTool,
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
import type { TileStamp } from '@/lib/types'
import { resolveTileId } from '@/lib/tileset'

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
      data[gridY * layer.__cWid + gridX] = tile.t
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

export function LevelCanvas({ level, tileStamp }: { level: Level; tileStamp: TileStamp }) {
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
  const projectDir = project?.filePath ? getDirectoryPath(project.filePath) : null

  const zoom = useToolStore((s) => s.zoom)
  const panX = useToolStore((s) => s.panX)
  const panY = useToolStore((s) => s.panY)
  const setPan = useToolStore((s) => s.setPan)
  const setZoom = useToolStore((s) => s.setZoom)
  const zoomToPoint = useToolStore((s) => s.zoomToPoint)
  const selectedTileIds = useToolStore((s) => s.selectedTileIds)
  const selectedEntityDefUid = useToolStore((s) => s.selectedEntityDefUid)
  const selectedIntGridValue = useToolStore((s) => s.selectedIntGridValue)
  const activeLayerKey = useToolStore((s) => s.activeLayer)
  const setActiveTool = useToolStore((s) => s.setActiveTool)

  const activeToolId = useLdtkToolStore((s) => s.activeToolId)

  const [cursor, setCursor] = useState('crosshair')

  if (!cameraRef.current) {
    cameraRef.current = new Camera(1, 1)
  }

  const layers = level.layerInstances ?? []

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
    return {
      tile: reversed.find((layer) => isTileLayer(layer)) ?? null,
      intgrid: reversed.find((layer) => layer.__type === 'IntGrid') ?? null,
      entity: reversed.find((layer) => layer.__type === 'Entities') ?? null,
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
    const intGridLayer = activeLayerInstance?.__type === 'IntGrid'
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

  const activeToolLayer = useMemo<ToolLayer | null>(() => {
    if (activeToolId === 'tile' && toolLayers.tile) {
      return {
        type: 'tilelayer',
        width: toolLayers.tile.__cWid,
        height: toolLayers.tile.__cHei,
        data: buildTileData(toolLayers.tile),
      }
    }
    if (activeToolId === 'intgrid' && toolLayers.intgrid) {
      return {
        type: 'intgrid',
        width: toolLayers.intgrid.__cWid,
        height: toolLayers.intgrid.__cHei,
        intGrid: toolLayers.intgrid.intGridCsv,
      }
    }
    if (activeToolId === 'entity' && toolLayers.entity) {
      return {
        type: 'objectgroup',
        width: toolLayers.entity.__cWid,
        height: toolLayers.entity.__cHei,
        objects: toolLayers.entity.entityInstances.map((entity) => ({
          id: entity.iid,
          x: entity.px[0],
          y: entity.px[1],
          width: entity.width,
          height: entity.height,
        })),
      }
    }
    return null
  }, [activeToolId, toolLayers])

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
    intgrid: IntGridTool
    entity: EntityTool
    select: SelectionTool
  } | null>(null)

  if (!toolsRef.current) {
    const context = toolContextRef.current
    toolsRef.current = {
      pan: new PanTool(context),
      tile: new TileTool(context),
      intgrid: new IntGridTool(context),
      entity: new EntityTool(context),
      select: new SelectionTool(context),
    }
  }

  useEffect(() => {
    setActiveTool(activeToolId)
  }, [activeToolId, setActiveTool])

  useEffect(() => {
    const context = toolContextRef.current
    context.viewport = { zoom, panX, panY }
    context.setPan = setPan
    context.setZoom = setZoom
    context.zoomToPoint = zoomToPoint
    context.screenToWorld = screenToWorld
    context.worldToTile = worldToTile
    context.tileSize = gridSize
    context.getActiveLayer = () => activeToolLayerRef.current
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
  }, [zoom, panX, panY, setPan, setZoom, zoomToPoint, screenToWorld, worldToTile, gridSize, tilesets])

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
    setPan(
      rect.width * 0.5 - worldX * clampedZoom,
      rect.height * 0.5 - worldY * clampedZoom
    )
  }, [setPan, setZoom, zoom])

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
    toolsRef.current.intgrid.setLayer(toolLayers.intgrid)
    toolsRef.current.entity.setLayer(toolLayers.entity)
    toolsRef.current.tile.setSelectedTiles(selectedTileIds)
    toolsRef.current.tile.setTileStamp(tileStamp.tiles)
    toolsRef.current.intgrid.selectedValue = selectedIntGridValue
    toolsRef.current.entity.setSelectedEntityDef(selectedEntityDefUid)
  }, [toolLayers, selectedTileIds, tileStamp, selectedIntGridValue, selectedEntityDefUid])

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

  const renderLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: LayerInstance) => {
      if (!layer.visible) return
      if (isTileLayer(layer)) {
        renderTiles(ctx, layer, layer.autoLayerTiles)
        renderTiles(ctx, layer, layer.gridTiles)
        return
      }
      if (layer.__type === 'IntGrid') {
        const def = layerDefs.find((candidate) => candidate.uid === layer.layerDefUid)
        renderIntGrid(ctx, layer, def?.intGridValues)
      }
    },
    [layerDefs, renderTiles, renderIntGrid]
  )

  const renderEntities = useCallback(
    (ctx: CanvasRenderingContext2D, camera: Camera) => {
      for (const layer of layers) {
        if (!layer.visible || layer.__type !== 'Entities') continue
        ctx.save()
        ctx.globalAlpha = layer.__opacity
        EntityRenderer({ entities: layer.entityInstances, camera, ctx })
        ctx.restore()
      }
    },
    [layers]
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

    renderEntities(ctx, camera)

    Rulers({
      camera,
      ctx,
      gridSize,
      showGrid: true,
      showRulers: true,
    })

    renderActiveTool(ctx, camera)
    renderMinimap(camera)
  }, [level.__bgColor, layers, gridSize, panX, zoom, renderLayer, renderEntities, renderActiveTool, renderMinimap])

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
      zoomToPoint(zoom * delta, screenX, screenY)
      return
    }

    event.preventDefault()
    setPan(panX - event.deltaX, panY - event.deltaY)
  }, [panX, panY, setPan, zoom, zoomToPoint])

  const handleZoomInClick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    zoomToPoint(zoom * 1.2, canvas.clientWidth * 0.5, canvas.clientHeight * 0.5)
  }, [zoom, zoomToPoint])

  const handleZoomOutClick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    zoomToPoint(zoom / 1.2, canvas.clientWidth * 0.5, canvas.clientHeight * 0.5)
  }, [zoom, zoomToPoint])

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
