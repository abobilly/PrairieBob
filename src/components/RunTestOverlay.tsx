import { useCallback, useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'
import type { EntityData, Layer, LevelData, LoadedTileset } from '@/lib/types'
import { hasTileFlipXFlag, hasTileFlipYFlag, resolveTileId, stripTileFlipFlags } from '@/lib/tileset'
import { useProjectStore } from '@/stores'
import {
  resolveDoorVisualDefinition,
  resolveActorAnimationSelection,
  resolveFrameIndex,
  resolveNpcVisualDefinition,
  type DoorVisualDefinition,
  type FacingDirection,
  type NpcVisualDefinition,
  type SpriteFrameSource,
} from '@/lib/entity-definitions'
import {
  getWalkFrame,
  getIdleFrame,
  preloadCharacterSprite,
  type Direction as KimbarDirection,
} from '@/lib/kimbar/sprite-resolver'
import { buildCollisionModel } from '@/lib/collision-model'
import {
  clampRectToBounds,
  chooseNpcWanderDirection,
  isRectInsideBounds,
  resolveNpcWanderBounds,
  type NpcZone,
} from '@/lib/npc-runtime'

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
  homeX: number
  homeY: number
  width: number
  height: number
  dirX: number
  dirY: number
  changeTimer: number
  animationId: string
  animationElapsedMs: number
  interactAnimationMsRemaining: number
  speedTilesPerSecond: number
  movementMode: 'idle' | 'wander' | 'patrol'
  zoneId: string | null
  zoneDeviationTiles: number
  decisionIntervalMs: number
  facingDir: FacingDirection
  flipX: boolean
}

type RuntimeState = {
  playerX: number
  playerY: number
  playerWidth: number
  playerHeight: number
  playerSpeedTilesPerSecond: number
  playerFacingDir: FacingDirection
  playerAnimationElapsedMs: number
  playerFlipX: boolean
  doorStates: Map<string, string>
  npcs: NpcRuntime[]
  previousTime: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function directionFromVector(dx: number, dy: number, fallback: FacingDirection): FacingDirection {
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return fallback
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left'
  }
  return dy >= 0 ? 'down' : 'up'
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

function getNpcZoneMap(mapData: LevelData): Map<string, NpcZone> {
  const zones = new Map<string, NpcZone>()
  const triggers = getEntities(mapData, 'trigger')
  for (const trigger of triggers) {
    const role = typeof trigger.properties.zoneRole === 'string' ? trigger.properties.zoneRole : ''
    if (role !== 'npc_zone') continue
    const zoneIdRaw = trigger.properties.zoneId
    const zoneId = typeof zoneIdRaw === 'string' && zoneIdRaw.trim().length > 0
      ? zoneIdRaw.trim()
      : trigger.id
    zones.set(zoneId, {
      id: zoneId,
      x: trigger.x,
      y: trigger.y,
      width: Math.max(1, trigger.width),
      height: Math.max(1, trigger.height),
    })
  }
  return zones
}

function findSpawnEntity(mapData: LevelData): EntityData | null {
  const spawnPoints = getEntities(mapData, 'spawn_point')
  if (spawnPoints.length === 0) return null
  const defaultSpawn = spawnPoints.find((spawn) => spawn.properties?.isDefault === true)
  return defaultSpawn ?? spawnPoints[0]
}

function findSpawnPoint(mapData: LevelData, tileSize: number): { x: number; y: number } {
  const spawn = findSpawnEntity(mapData)
  if (spawn) return { x: spawn.x, y: spawn.y }
  return { x: tileSize, y: tileSize }
}

function isTileBlocked(
  tileX: number,
  tileY: number,
  mapData: LevelData,
  collisionData: number[]
): boolean {
  if (tileX < 0 || tileY < 0 || tileX >= mapData.width || tileY >= mapData.height) {
    return true
  }
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

/**
 * Draw a Kimbar ULPC character sprite at a position.
 * Returns true if the sprite was drawn.
 */
function drawKimbarSprite(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  direction: KimbarDirection,
  isMoving: boolean,
  elapsedMs: number,
  x: number,
  y: number,
  width: number,
  height: number,
  flipX: boolean,
): boolean {
  const frame = isMoving
    ? getWalkFrame(characterId, direction, elapsedMs)
    : getIdleFrame(characterId, direction)
  if (!frame) return false

  ctx.save()
  if (flipX) {
    ctx.translate(x + width, y)
    ctx.scale(-1, 1)
    ctx.drawImage(frame.canvas, frame.x, frame.y, frame.size, frame.size, 0, 0, width, height)
  } else {
    ctx.drawImage(frame.canvas, frame.x, frame.y, frame.size, frame.size, x, y, width, height)
  }
  ctx.restore()
  return true
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
  return { tileset: resolved.tileset, localTileId: resolved.localTileId }
}

export function RunTestOverlay({ open, mapData, tilesets, onClose }: RunTestOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<RuntimeState | null>(null)
  const keysRef = useRef(new Set<string>())
  const frameRef = useRef<number | null>(null)
  const entityDefinitions = useProjectStore((state) => state.entityDefinitions)
  const interactionDefinitions = useProjectStore((state) => state.interactionDefinitions)
  const tileSize = Math.max(1, mapData.tileSize || 16)
  const collisionModel = useMemo(() => buildCollisionModel(mapData), [mapData])
  const collisionData = collisionModel.merged
  const manualCollisionData = collisionModel.manual
  const derivedCollisionData = collisionModel.derived
  const npcZones = useMemo(() => getNpcZoneMap(mapData), [mapData])
  const spawnEntity = useMemo(() => findSpawnEntity(mapData), [mapData])
  const playerVisual = useMemo(
    () => (spawnEntity ? resolveNpcVisualDefinition(spawnEntity, entityDefinitions) : null),
    [spawnEntity, entityDefinitions],
  )
  const doors = useMemo(() => getEntities(mapData, 'door'), [mapData])
  const npcEntities = useMemo(() => getEntities(mapData, 'npc'), [mapData])
  const doorVisuals = useMemo(() => {
    const map = new Map<string, DoorVisualDefinition>()
    for (const door of doors) {
      const visual = resolveDoorVisualDefinition(door, entityDefinitions, interactionDefinitions)
      if (visual) map.set(door.id, visual)
    }
    return map
  }, [doors, entityDefinitions, interactionDefinitions])
  const npcVisuals = useMemo(() => {
    const map = new Map<string, NpcVisualDefinition>()
    for (const npc of npcEntities) {
      const visual = resolveNpcVisualDefinition(npc, entityDefinitions)
      if (visual) map.set(npc.id, visual)
    }
    return map
  }, [npcEntities, entityDefinitions])

  const createRuntime = useCallback(() => {
    const spawn = findSpawnPoint(mapData, tileSize)
    const playerWidth = Math.max(
      tileSize * 0.75,
      (spawnEntity?.width || tileSize * (playerVisual?.widthTiles ?? 1))
    )
    const playerHeight = Math.max(
      tileSize * 0.75,
      (spawnEntity?.height || tileSize * (playerVisual?.heightTiles ?? 1))
    )
    const playerSpeedValue = Number(spawnEntity?.properties?.speedTilesPerSecond ?? 5)
    const playerSpeedTilesPerSecond = Number.isFinite(playerSpeedValue) && playerSpeedValue > 0
      ? playerSpeedValue
      : 5
    const npcs: NpcRuntime[] = npcEntities.map((npc) => {
      const direction = chooseNpcDirection()
      const visual = npcVisuals.get(npc.id)
      const onLoadAnimation = visual?.onLoadAnimation ?? visual?.defaultAnimation ?? 'idle'
      const movementModeRaw = npc.properties?.movementMode
      const movementMode: NpcRuntime['movementMode'] =
        movementModeRaw === 'idle' || movementModeRaw === 'patrol' ? movementModeRaw : 'wander'
      const zoneIdRaw = npc.properties?.zoneId
      const zoneId = typeof zoneIdRaw === 'string' && zoneIdRaw.trim().length > 0
        ? zoneIdRaw.trim()
        : null
      const zoneDeviationRaw = Number(npc.properties?.zoneDeviationTiles ?? npc.properties?.wanderRadius ?? 0)
      const zoneDeviationTiles = Number.isFinite(zoneDeviationRaw) ? Math.max(0, Math.floor(zoneDeviationRaw)) : 0
      const decisionRaw = Number(npc.properties?.decisionIntervalMs ?? 1200)
      const decisionIntervalMs = Number.isFinite(decisionRaw) ? clamp(decisionRaw, 120, 10000) : 1200
      return {
        id: npc.id,
        x: npc.x,
        y: npc.y,
        homeX: npc.x,
        homeY: npc.y,
        width: Math.max(tileSize * 0.75, npc.width || tileSize * (visual?.widthTiles ?? 1)),
        height: Math.max(tileSize * 0.75, npc.height || tileSize * (visual?.heightTiles ?? 1)),
        dirX: direction.x,
        dirY: direction.y,
        changeTimer: decisionIntervalMs / 1000,
        animationId: onLoadAnimation,
        animationElapsedMs: Math.random() * 700,
        interactAnimationMsRemaining: 0,
        speedTilesPerSecond: visual?.speedTilesPerSecond ?? 2.2,
        movementMode,
        zoneId,
        zoneDeviationTiles,
        decisionIntervalMs,
        facingDir: 'down',
        flipX: false,
      }
    })

    const doorStates = new Map<string, string>()
    for (const door of doors) {
      const visual = doorVisuals.get(door.id)
      if (visual) {
        doorStates.set(door.id, visual.defaultState)
      }
    }

    return {
      playerX: spawn.x,
      playerY: spawn.y,
      playerWidth,
      playerHeight,
      playerSpeedTilesPerSecond,
      playerFacingDir: 'down',
      playerAnimationElapsedMs: 0,
      playerFlipX: false,
      doorStates,
      npcs,
      previousTime: 0,
    } satisfies RuntimeState
  }, [mapData, tileSize, spawnEntity, playerVisual, npcEntities, npcVisuals, doors, doorVisuals])

  useEffect(() => {
    if (!open) return
    runtimeRef.current = createRuntime()
    keysRef.current.clear()
  }, [open, createRuntime])

  // Preload Kimbar ULPC sprites for player and NPCs
  useEffect(() => {
    if (!open) return
    const playerCharId = (
      (spawnEntity?.properties?.characterId as string | undefined) ??
      (spawnEntity?.properties?.character as string | undefined)
    ) ?? 'char.kim'
    preloadCharacterSprite(playerCharId)
    for (const npc of npcEntities) {
      const charId = (
        (npc.properties?.characterId as string | undefined) ??
        (npc.properties?.character as string | undefined)
      )
      if (charId) preloadCharacterSprite(charId)
    }
  }, [open, spawnEntity, npcEntities])

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
        if (!runtime) return
        const playerCenterX = runtime.playerX + runtime.playerWidth * 0.5
        const playerCenterY = runtime.playerY + runtime.playerHeight * 0.5
        let bestDoor: EntityData | null = null
        let bestDoorDistance = Number.POSITIVE_INFINITY
        for (const door of doors) {
          const dx = door.x + door.width * 0.5 - playerCenterX
          const dy = door.y + door.height * 0.5 - playerCenterY
          const distance = Math.hypot(dx, dy)
          if (distance < bestDoorDistance) {
            bestDoorDistance = distance
            bestDoor = door
          }
        }

        if (bestDoor && bestDoorDistance <= tileSize * 1.75) {
          const visual = doorVisuals.get(bestDoor.id)
          if (visual) {
            const currentState = runtime.doorStates.get(bestDoor.id) ?? visual.defaultState
            let nextState = currentState
            if (visual.onInteract === 'toggle') {
              if (visual.states.closed && visual.states.open) {
                nextState = currentState === 'open' ? 'closed' : 'open'
              } else {
                const keys = Object.keys(visual.states)
                if (keys.length > 1) {
                  const currentIndex = Math.max(0, keys.indexOf(currentState))
                  nextState = keys[(currentIndex + 1) % keys.length]
                }
              }
            } else if (visual.onInteract === 'open' && visual.states.open) {
              nextState = 'open'
            } else if (visual.onInteract === 'close' && visual.states.closed) {
              nextState = 'closed'
            }
            runtime.doorStates.set(bestDoor.id, nextState)
          }
        }

        let bestNpc: NpcRuntime | null = null
        let bestNpcDistance = Number.POSITIVE_INFINITY
        for (const npc of runtime.npcs) {
          const dx = npc.x + npc.width * 0.5 - playerCenterX
          const dy = npc.y + npc.height * 0.5 - playerCenterY
          const distance = Math.hypot(dx, dy)
          if (distance < bestNpcDistance) {
            bestNpcDistance = distance
            bestNpc = npc
          }
        }
        if (bestNpc && bestNpcDistance <= tileSize * 1.75) {
          const npcVisual = npcVisuals.get(bestNpc.id)
          if (npcVisual?.onInteractAnimation) {
            bestNpc.animationId = npcVisual.onInteractAnimation
            bestNpc.animationElapsedMs = 0
            bestNpc.interactAnimationMsRemaining = 900
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
  }, [open, onClose, doors, tileSize, doorVisuals, npcVisuals])

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
        const visual = doorVisuals.get(door.id)
        const stateName = visual
          ? (runtime.doorStates.get(door.id) ?? visual.defaultState)
          : 'closed'
        const blocks = visual
          ? (visual.states[stateName]?.collision ?? false)
          : true
        if (!blocks) continue
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

    const drawSpriteTiles = (
      ctx: CanvasRenderingContext2D,
      source: SpriteFrameSource,
      tileIds: number[],
      widthTiles: number,
      heightTiles: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ): boolean => {
      if (tileIds.length === 0) return false
      const drawWidthTiles = Math.max(1, widthTiles)
      const drawHeightTiles = Math.max(1, heightTiles)
      const tileDrawWidth = width / drawWidthTiles
      const tileDrawHeight = height / drawHeightTiles
      let drewAny = false

      for (let index = 0; index < tileIds.length; index += 1) {
        const tileId = tileIds[index]
        // Local entity definitions use zero-based tile IDs, while global frame IDs use Tiled-style 1+ gids.
        if ((source.kind === 'local' && tileId < 0) || (source.kind === 'global' && tileId <= 0)) continue
        const resolved = resolveFrameToTileset(source, tileId, tilesets)
        if (!resolved) continue

        const sourceX = (resolved.localTileId % resolved.tileset.tilesPerRow) * resolved.tileset.tileSize
        const sourceY = Math.floor(resolved.localTileId / resolved.tileset.tilesPerRow) * resolved.tileset.tileSize
        const tileX = index % drawWidthTiles
        const tileY = Math.floor(index / drawWidthTiles)
        ctx.drawImage(
          resolved.tileset.canvas,
          sourceX,
          sourceY,
          resolved.tileset.tileSize,
          resolved.tileset.tileSize,
          x + tileX * tileDrawWidth,
          y + tileY * tileDrawHeight,
          tileDrawWidth,
          tileDrawHeight,
        )
        drewAny = true
      }

      return drewAny
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
      const speed = tileSize * runtime.playerSpeedTilesPerSecond
      const velocityX = (moveX / moveLength) * speed * elapsed
      const velocityY = (moveY / moveLength) * speed * elapsed

      const playerIsMoving = Math.abs(velocityX) > 0.0001 || Math.abs(velocityY) > 0.0001
      if (playerIsMoving) {
        runtime.playerFacingDir = directionFromVector(velocityX, velocityY, runtime.playerFacingDir)
        runtime.playerAnimationElapsedMs += elapsed * 1000
      } else {
        runtime.playerAnimationElapsedMs = 0
      }

      moveWithCollision(
        runtime,
        velocityX,
        velocityY,
        runtime.playerWidth,
        runtime.playerHeight,
        'player'
      )
      let playerAnimationSelection: ReturnType<typeof resolveActorAnimationSelection> | null = null
      if (playerVisual) {
        const playerBaseAnimation = playerIsMoving ? playerVisual.walkAnimation : playerVisual.idleAnimation
        playerAnimationSelection = resolveActorAnimationSelection(
          playerVisual,
          playerBaseAnimation,
          runtime.playerFacingDir,
        )
        runtime.playerFlipX = playerAnimationSelection.flipX
      } else {
        runtime.playerFlipX = false
      }

      for (const npc of runtime.npcs) {
        const bounds = resolveNpcWanderBounds(
          {
            x: npc.x,
            y: npc.y,
            width: npc.width,
            height: npc.height,
            homeX: npc.homeX,
            homeY: npc.homeY,
            zoneId: npc.zoneId,
            zoneDeviationTiles: npc.zoneDeviationTiles,
          },
          npcZones,
          tileSize,
        )

        const clampedToBounds = clampRectToBounds(npc.x, npc.y, npc.width, npc.height, bounds)
        npc.x = clampedToBounds.x
        npc.y = clampedToBounds.y

        npc.changeTimer -= elapsed
        if (npc.movementMode === 'idle') {
          npc.dirX = 0
          npc.dirY = 0
        } else if (npc.changeTimer <= 0) {
          const nextDirection = chooseNpcWanderDirection(
            {
              x: npc.x,
              y: npc.y,
              width: npc.width,
              height: npc.height,
              currentDirX: npc.dirX,
              currentDirY: npc.dirY,
              speedTilesPerSecond: npc.speedTilesPerSecond,
            },
            bounds,
            tileSize,
          )
          npc.dirX = nextDirection.x
          npc.dirY = nextDirection.y
          const jitter = 0.75 + Math.random() * 0.5
          npc.changeTimer = (npc.decisionIntervalMs * jitter) / 1000
        }
        if (npc.interactAnimationMsRemaining > 0) {
          npc.interactAnimationMsRemaining = Math.max(0, npc.interactAnimationMsRemaining - elapsed * 1000)
        }
        const npcSpeed = tileSize * npc.speedTilesPerSecond
        const dx = npc.dirX * npcSpeed * elapsed
        const dy = npc.dirY * npcSpeed * elapsed
        const prevX = npc.x
        const prevY = npc.y
        const previewX = npc.x + dx
        const previewY = npc.y + dy
        const inBounds = isRectInsideBounds(previewX, previewY, npc.width, npc.height, bounds)
        if (npc.movementMode !== 'idle' && inBounds) {
          moveWithCollision(runtime, dx, dy, npc.width, npc.height, { npc })
        }
        const afterClamp = clampRectToBounds(npc.x, npc.y, npc.width, npc.height, bounds)
        npc.x = afterClamp.x
        npc.y = afterClamp.y
        const movedX = npc.x - prevX
        const movedY = npc.y - prevY
        const npcMoved = Math.abs(movedX) >= 0.001 || Math.abs(movedY) >= 0.001
        if (npcMoved) {
          npc.facingDir = directionFromVector(movedX, movedY, npc.facingDir)
        }
        if (!npcMoved && npc.movementMode !== 'idle') {
          const nextDirection = chooseNpcWanderDirection(
            {
              x: npc.x,
              y: npc.y,
              width: npc.width,
              height: npc.height,
              currentDirX: npc.dirX,
              currentDirY: npc.dirY,
              speedTilesPerSecond: npc.speedTilesPerSecond,
            },
            bounds,
            tileSize,
          )
          npc.dirX = nextDirection.x
          npc.dirY = nextDirection.y
          npc.changeTimer = (npc.decisionIntervalMs * (0.45 + Math.random() * 0.45)) / 1000
        }

        const visual = npcVisuals.get(npc.id)
        if (visual) {
          const baseAnimation = npc.interactAnimationMsRemaining > 0 && visual.onInteractAnimation
            ? visual.onInteractAnimation
            : (npcMoved ? visual.walkAnimation : visual.idleAnimation)
          const selection = resolveActorAnimationSelection(visual, baseAnimation, npc.facingDir)
          if (selection.animationId !== npc.animationId) {
            npc.animationId = selection.animationId
            npc.animationElapsedMs = 0
          } else {
            npc.animationElapsedMs += elapsed * 1000
          }
          npc.flipX = selection.flipX
        } else {
          npc.animationElapsedMs += elapsed * 1000
          npc.flipX = false
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
        const isCollision = layer.name.trim().toLowerCase() === 'collision'
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

      ctx.fillStyle = 'rgba(255, 77, 77, 0.25)'
      for (let y = 0; y < mapData.height; y += 1) {
        for (let x = 0; x < mapData.width; x += 1) {
          const index = y * mapData.width + x
          if (stripTileFlipFlags(manualCollisionData[index] ?? 0) <= 0) continue
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
        }
      }

      if (collisionModel.config.showDerivedOverlay) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.22)'
        for (let y = 0; y < mapData.height; y += 1) {
          for (let x = 0; x < mapData.width; x += 1) {
            const index = y * mapData.width + x
            if (stripTileFlipFlags(derivedCollisionData[index] ?? 0) <= 0) continue
            if (stripTileFlipFlags(manualCollisionData[index] ?? 0) > 0) continue
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize)
          }
        }
      }

      for (const door of doors) {
        const visual = doorVisuals.get(door.id)
        let drewDoorSprite = false
        if (visual) {
          const stateName = runtime.doorStates.get(door.id) ?? visual.defaultState
          const stateVisual = visual.states[stateName] ?? visual.states[visual.defaultState]
          if (stateVisual) {
            drewDoorSprite = drawSpriteTiles(
              ctx,
              stateVisual.source,
              stateVisual.source.frameTileIds,
              visual.widthTiles,
              visual.heightTiles,
              door.x,
              door.y,
              door.width,
              door.height,
            )
          }
        }
        if (!drewDoorSprite) {
          ctx.fillStyle = 'rgba(245, 149, 66, 0.65)'
          ctx.fillRect(door.x, door.y, door.width, door.height)
        }
        ctx.strokeStyle = 'rgba(12, 16, 24, 0.8)'
        ctx.lineWidth = 2 / zoom
        ctx.strokeRect(door.x, door.y, door.width, door.height)
      }

      for (const npc of runtime.npcs) {
        const visual = npcVisuals.get(npc.id)
        let drewNpcSprite = false
        if (visual) {
          const clip = visual.animations[npc.animationId] ?? visual.animations[visual.onLoadAnimation]
          if (clip && clip.frameTileIds.length > 0) {
            const frameIndex = resolveFrameIndex(
              clip.frameTileIds.length,
              npc.animationElapsedMs,
              clip.fps,
              clip.loop,
            )
            const frameTileId = clip.frameTileIds[frameIndex] ?? clip.frameTileIds[0]
            if (frameTileId !== undefined) {
              if (npc.flipX) {
                ctx.save()
                ctx.translate(npc.x + npc.width, npc.y)
                ctx.scale(-1, 1)
                drewNpcSprite = drawSpriteTiles(
                  ctx,
                  { kind: 'local', tilesetId: visual.tilesetId, frameTileIds: [frameTileId] },
                  [frameTileId],
                  1,
                  1,
                  0,
                  0,
                  npc.width,
                  npc.height,
                )
                ctx.restore()
              } else {
                drewNpcSprite = drawSpriteTiles(
                  ctx,
                  { kind: 'local', tilesetId: visual.tilesetId, frameTileIds: [frameTileId] },
                  [frameTileId],
                  1,
                  1,
                  npc.x,
                  npc.y,
                  npc.width,
                  npc.height,
                )
              }
            }
          }
        }
        if (!drewNpcSprite) {
          // Try Kimbar ULPC sprite for this NPC's characterId
          const npcEntity = npcEntities.find((e) => e.id === npc.id)
          const npcCharacterId = (
            (npcEntity?.properties?.characterId as string | undefined) ??
            (npcEntity?.properties?.character as string | undefined)
          )
          if (npcCharacterId) {
            const npcIsMoving = Math.abs(npc.dirX) > 0 || Math.abs(npc.dirY) > 0
            drewNpcSprite = drawKimbarSprite(
              ctx,
              npcCharacterId,
              npc.facingDir as KimbarDirection,
              npcIsMoving,
              npc.animationElapsedMs,
              npc.x,
              npc.y,
              npc.width,
              npc.height,
              npc.flipX,
            )
          }
        }
        if (!drewNpcSprite) {
          ctx.fillStyle = 'rgba(112, 189, 255, 0.95)'
          ctx.fillRect(npc.x, npc.y, npc.width, npc.height)
        }
      }

      let drewPlayerSprite = false
      if (playerVisual && playerAnimationSelection) {
        const frameIndex = resolveFrameIndex(
          playerAnimationSelection.clip.frameTileIds.length,
          runtime.playerAnimationElapsedMs,
          playerAnimationSelection.clip.fps,
          playerAnimationSelection.clip.loop,
        )
        const frameTileId =
          playerAnimationSelection.clip.frameTileIds[frameIndex] ??
          playerAnimationSelection.clip.frameTileIds[0]
        if (frameTileId !== undefined) {
          if (runtime.playerFlipX) {
            ctx.save()
            ctx.translate(runtime.playerX + runtime.playerWidth, runtime.playerY)
            ctx.scale(-1, 1)
            drewPlayerSprite = drawSpriteTiles(
              ctx,
              { kind: 'local', tilesetId: playerVisual.tilesetId, frameTileIds: [frameTileId] },
              [frameTileId],
              1,
              1,
              0,
              0,
              runtime.playerWidth,
              runtime.playerHeight,
            )
            ctx.restore()
          } else {
            drewPlayerSprite = drawSpriteTiles(
              ctx,
              { kind: 'local', tilesetId: playerVisual.tilesetId, frameTileIds: [frameTileId] },
              [frameTileId],
              1,
              1,
              runtime.playerX,
              runtime.playerY,
              runtime.playerWidth,
              runtime.playerHeight,
            )
          }
        }
      }

      if (!drewPlayerSprite) {
        // Try Kimbar ULPC sprite for the player (char.kim or spawn entity's characterId)
        const playerCharId = (
          (spawnEntity?.properties?.characterId as string | undefined) ??
          (spawnEntity?.properties?.character as string | undefined)
        ) ?? 'char.kim'
        drewPlayerSprite = drawKimbarSprite(
          ctx,
          playerCharId,
          runtime.playerFacingDir as KimbarDirection,
          playerIsMoving,
          runtime.playerAnimationElapsedMs,
          runtime.playerX,
          runtime.playerY,
          runtime.playerWidth,
          runtime.playerHeight,
          runtime.playerFlipX,
        )
      }
      if (!drewPlayerSprite) {
        ctx.fillStyle = '#facc15'
        ctx.fillRect(runtime.playerX, runtime.playerY, runtime.playerWidth, runtime.playerHeight)
      }
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
  }, [
    open,
    mapData,
    tilesets,
    collisionData,
    manualCollisionData,
    derivedCollisionData,
    collisionModel.config.showDerivedOverlay,
    doors,
    tileSize,
    doorVisuals,
    npcVisuals,
    playerVisual,
    spawnEntity,
    npcEntities,
    npcZones,
  ])

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
