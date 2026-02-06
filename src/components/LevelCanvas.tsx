import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Level } from '@/lib/ldtk/level'
import type { LayerInstance, TileInstance } from '@/lib/ldtk/layer-instance'
import type { IntGridValueDef } from '@/lib/ldtk/types'
import { Camera } from '@/lib/ldtk/camera'
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

const DEFAULT_BG_COLOR = '#1f2430'
const DEFAULT_INTGRID_ALPHA = 0.35

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

export function LevelCanvas({ level }: { level: Level }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera | null>(null)
  const toolContextRef = useRef<ToolContext>({
    viewport: { zoom: 1, panX: 0, panY: 0 },
    setPan: () => {},
  })
  const tilesetCache = useRef(new Map<string, HTMLCanvasElement>())
  const tilesetLoading = useRef(new Set<string>())
  const activeToolLayerRef = useRef<ToolLayer | null>(null)

  const project = useProjectStore((s) => s.project)
  const projectDir = project?.filePath ? getDirectoryPath(project.filePath) : null

  const { zoom, panX, panY, setPan, setZoom, zoomToPoint } = useToolStore((s) => ({
    zoom: s.zoom,
    panX: s.panX,
    panY: s.panY,
    setPan: s.setPan,
    setZoom: s.setZoom,
    zoomToPoint: s.zoomToPoint,
  }))
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
  }, [zoom, panX, panY, setPan, setZoom, zoomToPoint, screenToWorld, worldToTile, gridSize])

  useEffect(() => {
    activeToolLayerRef.current = activeToolLayer
  }, [activeToolLayer])

  useEffect(() => {
    if (!toolsRef.current) return
    toolsRef.current.tile.setLayer(toolLayers.tile)
    toolsRef.current.intgrid.setLayer(toolLayers.intgrid)
    toolsRef.current.entity.setLayer(toolLayers.entity)
    toolsRef.current.tile.setSelectedTiles(selectedTileIds)
    toolsRef.current.intgrid.selectedValue = selectedIntGridValue
    toolsRef.current.entity.setSelectedEntityDef(selectedEntityDefUid)
  }, [toolLayers, selectedTileIds, selectedIntGridValue, selectedEntityDefUid])

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
  }, [level.__bgColor, layers, gridSize, panX, zoom, renderLayer, renderEntities, renderActiveTool])

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
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
  )
}
