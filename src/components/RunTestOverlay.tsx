import { useCallback, useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import type { EntityData, Layer, LevelData, LoadedTileset } from '@/lib/types'
import { hasTileFlipXFlag, hasTileFlipYFlag, resolveTileId, stripTileFlipFlags } from '@/lib/tileset'

interface RunTestOverlayProps {
  open: boolean
  mapData: LevelData
  tilesets: LoadedTileset[]
  onClose: () => void
}

type NpcRuntime = {
  id: string
  x: number
  y: number
  width: number
  height: number
  dirX: number
  dirY: number
  changeTimer: number
}

type RuntimeState = {
  playerX: number
  playerY: number
  playerWidth: number
  playerHeight: number
  doorsOpen: Set<string>
  npcs: NpcRuntime[]
  previousTime: number
}

function isCollisionLayer(layer: Layer): boolean {
  return layer.type === 'tilelayer' && layer.name.trim().toLowerCase() === 'collision'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function chooseNpcDirection(): { x: number; y: number } {
  const options = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  const index = Math.floor(Math.random() * options.length)
  return options[index]
}

function getEntityLayers(mapData: LevelData): Layer[] {
  return mapData.layers.filter((layer) => layer.type === 'objectgroup')
}

function getEntities(mapData: LevelData, type: EntityData['type']): EntityData[] {
  const entities: EntityData[] = []
  for (const layer of getEntityLayers(mapData)) {
    for (const entity of layer.objects ?? []) {
      if (entity.type === type) {
        entities.push(entity)
      }
    }
  }
  return entities
}

function getCollisionData(mapData: LevelData): number[] | null {
  const collisionLayer = mapData.layers.find(isCollisionLayer)
  return collisionLayer?.data ?? null
}

function findSpawnPoint(mapData: LevelData, tileSize: number): { x: number; y: number } {
  const spawn = getEntities(mapData, 'spawn_point')[0]
  if (spawn) return { x: spawn.x, y: spawn.y }
  return { x: tileSize, y: tileSize }
}

function isTileBlocked(
  tileX: number,
  tileY: number,
  mapData: LevelData,
  collisionData: number[] | null
): boolean {
  if (tileX < 0 || tileY < 0 || tileX >= mapData.width || tileY >= mapData.height) {
    return true
  }
  if (!collisionData) return false
  const index = tileY * mapData.width + tileX
  return stripTileFlipFlags(collisionData[index] ?? 0) > 0
}

function rectOverlaps(
  left: number,
  top: number,
  width: number,
  height: number,
  entity: EntityData
): boolean {
  return (
    left < entity.x + entity.width &&
    left + width > entity.x &&
    top < entity.y + entity.height &&
    top + height > entity.y
  )
}

export function RunTestOverlay({ open, mapData, tilesets, onClose }: RunTestOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<RuntimeState | null>(null)
  const keysRef = useRef(new Set<string>())
  const frameRef = useRef<number | null>(null)
  const tileSize = Math.max(1, mapData.tileSize || 16)
  const collisionData = useMemo(() => getCollisionData(mapData), [mapData])
  const doors = useMemo(() => getEntities(mapData, 'door'), [mapData])

  const createRuntime = useCallback(() => {
    const spawn = findSpawnPoint(mapData, tileSize)
    const npcEntities = getEntities(mapData, 'npc')
    const npcs: NpcRuntime[] = npcEntities.map((npc) => {
      const direction = chooseNpcDirection()
      return {
        id: npc.id,
        x: npc.x,
        y: npc.y,
        width: Math.max(tileSize * 0.75, npc.width || tileSize),
        height: Math.max(tileSize * 0.75, npc.height || tileSize),
        dirX: direction.x,
        dirY: direction.y,
        changeTimer: 0.5 + Math.random() * 1.5,
      }
    })

    return {
      playerX: spawn.x,
      playerY: spawn.y,
      playerWidth: tileSize * 0.75,
      playerHeight: tileSize * 0.75,
      doorsOpen: new Set<string>(),
      npcs,
      previousTime: 0,
    } satisfies RuntimeState
  }, [mapData, tileSize])

  useEffect(() => {
    if (!open) return
    runtimeRef.current = createRuntime()
    keysRef.current.clear()
  }, [open, createRuntime])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (key === 'e') {
        event.preventDefault()
        const runtime = runtimeRef.current
        if (!runtime || doors.length === 0) return
        const playerCenterX = runtime.playerX + runtime.playerWidth * 0.5
        const playerCenterY = runtime.playerY + runtime.playerHeight * 0.5
        let bestDoor: EntityData | null = null
        let bestDistance = Number.POSITIVE_INFINITY

        for (const door of doors) {
          const doorCenterX = door.x + door.width * 0.5
          const doorCenterY = door.y + door.height * 0.5
          const dx = doorCenterX - playerCenterX
          const dy = doorCenterY - playerCenterY
          const distance = Math.hypot(dx, dy)
          if (distance < bestDistance) {
            bestDistance = distance
            bestDoor = door
          }
        }

        if (bestDoor && bestDistance <= tileSize * 1.75) {
          if (runtime.doorsOpen.has(bestDoor.id)) {
            runtime.doorsOpen.delete(bestDoor.id)
          } else {
            runtime.doorsOpen.add(bestDoor.id)
          }
        }
        return
      }

      keysRef.current.add(key)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [open, onClose, doors, tileSize])

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const isRectBlocked = (
      x: number,
      y: number,
      width: number,
      height: number,
      runtime: RuntimeState
    ) => {
      const minTileX = Math.floor(x / tileSize)
      const maxTileX = Math.floor((x + width - 1) / tileSize)
      const minTileY = Math.floor(y / tileSize)
      const maxTileY = Math.floor((y + height - 1) / tileSize)

      for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
          if (isTileBlocked(tileX, tileY, mapData, collisionData)) {
            return true
          }
        }
      }

      for (const door of doors) {
        if (runtime.doorsOpen.has(door.id)) continue
        if (rectOverlaps(x, y, width, height, door)) {
          return true
        }
      }

      return false
    }

    const moveWithCollision = (
      runtime: RuntimeState,
      dx: number,
      dy: number,
      width: number,
      height: number,
      target: 'player' | { npc: NpcRuntime }
    ) => {
      const readX = target === 'player' ? runtime.playerX : target.npc.x
      const readY = target === 'player' ? runtime.playerY : target.npc.y
      let nextX = readX
      let nextY = readY

      const applyMove = (value: number, axis: 'x' | 'y') => {
        let remaining = value
        while (Math.abs(remaining) > 0.0001) {
          const step = Math.sign(remaining) * Math.min(Math.abs(remaining), 1)
          const candidateX = axis === 'x' ? nextX + step : nextX
          const candidateY = axis === 'y' ? nextY + step : nextY
          if (isRectBlocked(candidateX, candidateY, width, height, runtime)) {
            break
          }
          if (axis === 'x') nextX = candidateX
          else nextY = candidateY
          remaining -= step
        }
      }

      applyMove(dx, 'x')
      applyMove(dy, 'y')

      if (target === 'player') {
        runtime.playerX = nextX
        runtime.playerY = nextY
      } else {
        target.npc.x = nextX
        target.npc.y = nextY
      }
    }

    const render = (currentTime: number) => {
      const runtime = runtimeRef.current
      if (!runtime) return

      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const elapsed = runtime.previousTime === 0
        ? 0
        : Math.min((currentTime - runtime.previousTime) / 1000, 0.05)
      runtime.previousTime = currentTime

      const moveX = Number(keysRef.current.has('d') || keysRef.current.has('arrowright')) -
        Number(keysRef.current.has('a') || keysRef.current.has('arrowleft'))
      const moveY = Number(keysRef.current.has('s') || keysRef.current.has('arrowdown')) -
        Number(keysRef.current.has('w') || keysRef.current.has('arrowup'))

      const moveLength = Math.hypot(moveX, moveY) || 1
      const speed = tileSize * 5
      const velocityX = (moveX / moveLength) * speed * elapsed
      const velocityY = (moveY / moveLength) * speed * elapsed

      moveWithCollision(
        runtime,
        velocityX,
        velocityY,
        runtime.playerWidth,
        runtime.playerHeight,
        'player'
      )

      for (const npc of runtime.npcs) {
        npc.changeTimer -= elapsed
        if (npc.changeTimer <= 0) {
          const nextDirection = chooseNpcDirection()
          npc.dirX = nextDirection.x
          npc.dirY = nextDirection.y
          npc.changeTimer = 0.6 + Math.random() * 1.6
        }
        const npcSpeed = tileSize * 2.2
        const dx = npc.dirX * npcSpeed * elapsed
        const dy = npc.dirY * npcSpeed * elapsed
        const prevX = npc.x
        const prevY = npc.y
        moveWithCollision(runtime, dx, dy, npc.width, npc.height, { npc })
        if (Math.abs(prevX - npc.x) < 0.001 && Math.abs(prevY - npc.y) < 0.001) {
          const nextDirection = chooseNpcDirection()
          npc.dirX = nextDirection.x
          npc.dirY = nextDirection.y
          npc.changeTimer = 0.4 + Math.random() * 1.2
        }
      }

      const zoom = clamp(
        Math.min(width / (tileSize * 20), height / (tileSize * 12)),
        1,
        3
      )
      const mapPixelWidth = mapData.width * tileSize
      const mapPixelHeight = mapData.height * tileSize
      const playerCenterX = runtime.playerX + runtime.playerWidth * 0.5
      const playerCenterY = runtime.playerY + runtime.playerHeight * 0.5
      const cameraWidth = width / zoom
      const cameraHeight = height / zoom
      const cameraX = clamp(playerCenterX - cameraWidth * 0.5, 0, Math.max(0, mapPixelWidth - cameraWidth))
      const cameraY = clamp(playerCenterY - cameraHeight * 0.5, 0, Math.max(0, mapPixelHeight - cameraHeight))

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0b1120'
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.scale(zoom, zoom)
      ctx.translate(-cameraX, -cameraY)
      ctx.imageSmoothingEnabled = false

      for (const layer of mapData.layers) {
        if (!layer.visible || layer.type !== 'tilelayer') continue
        const isCollision = isCollisionLayer(layer)
        if (isCollision) continue
        for (let index = 0; index < (layer.data?.length ?? 0); index += 1) {
          const rawTileId = layer.data?.[index] ?? 0
          const tileId = stripTileFlipFlags(rawTileId)
          if (tileId <= 0) continue
          const tileX = (index % mapData.width) * tileSize
          const tileY = Math.floor(index / mapData.width) * tileSize
          const resolved = resolveTileId(tileId, tilesets)
          if (!resolved) continue
          const flipX = hasTileFlipXFlag(rawTileId)
          const flipY = hasTileFlipYFlag(rawTileId)
          const sourceX = (resolved.localTileId % resolved.tileset.tilesPerRow) * resolved.tileset.tileSize
          const sourceY = Math.floor(resolved.localTileId / resolved.tileset.tilesPerRow) * resolved.tileset.tileSize
          ctx.save()
          ctx.translate(tileX + (flipX ? tileSize : 0), tileY + (flipY ? tileSize : 0))
          ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
          ctx.drawImage(
            resolved.tileset.canvas,
            sourceX,
            sourceY,
            resolved.tileset.tileSize,
            resolved.tileset.tileSize,
            0,
            0,
            tileSize,
            tileSize
          )
          ctx.restore()
        }
      }

      if (collisionData) {
        ctx.fillStyle = 'rgba(255, 77, 77, 0.25)'
        for (let y = 0; y < mapData.height; y += 1) {
          for (let x = 0; x < mapData.width; x += 1) {
            const index = y * mapData.width + x
            if (stripTileFlipFlags(collisionData[index] ?? 0) <= 0) continue
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
          }
        }
      }

      for (const door of doors) {
        const isOpen = runtime.doorsOpen.has(door.id)
        ctx.fillStyle = isOpen ? 'rgba(66, 245, 132, 0.5)' : 'rgba(245, 149, 66, 0.65)'
        ctx.fillRect(door.x, door.y, door.width, door.height)
        ctx.strokeStyle = 'rgba(12, 16, 24, 0.8)'
        ctx.lineWidth = 2 / zoom
        ctx.strokeRect(door.x, door.y, door.width, door.height)
      }

      for (const npc of runtime.npcs) {
        ctx.fillStyle = 'rgba(112, 189, 255, 0.95)'
        ctx.fillRect(npc.x, npc.y, npc.width, npc.height)
      }

      ctx.fillStyle = '#facc15'
      ctx.fillRect(runtime.playerX, runtime.playerY, runtime.playerWidth, runtime.playerHeight)
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 2 / zoom
      ctx.strokeRect(runtime.playerX, runtime.playerY, runtime.playerWidth, runtime.playerHeight)

      ctx.restore()

      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'
      ctx.fillRect(16, 16, 340, 84)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
      ctx.strokeRect(16, 16, 340, 84)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText('WASD/Arrows: Move', 28, 40)
      ctx.fillText('E: Toggle nearest door', 28, 58)
      ctx.fillText('ESC: Exit Test Mode', 28, 76)

      frameRef.current = window.requestAnimationFrame(render)
    }

    frameRef.current = window.requestAnimationFrame(render)
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = null
    }
  }, [open, mapData, tilesets, collisionData, doors, tileSize])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] bg-[rgba(2,6,23,0.95)]">
      <div className="absolute top-3 right-3 z-[81] flex items-center gap-2">
        <button
          type="button"
          className="pb-tool-btn pb-tool-btn-labeled"
          onClick={onClose}
          title="Close test mode"
        >
          <X size={16} />
          <span>Close Test</span>
        </button>
      </div>
      <div ref={containerRef} className="h-full w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  )
}
