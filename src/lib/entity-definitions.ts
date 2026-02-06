import type {
  EntityData,
  EntityDefinitionAnimation,
  EntityDefinitionFile,
  InteractionDefinitionFile,
} from '@/lib/types'

export type EntityDefinitionMap = Record<string, EntityDefinitionFile>
export type InteractionDefinitionMap = Record<string, InteractionDefinitionFile>

export type SpriteFrameSource =
  | {
    kind: 'local'
    tilesetId: string
    frameTileIds: number[]
  }
  | {
    kind: 'global'
    frameTileIds: number[]
  }

export interface EntityFrameSequence {
  source: SpriteFrameSource
  frameInterpretation: 'timeline' | 'layout'
  fps: number
  loop: boolean
  animate: boolean
  widthTiles: number
  heightTiles: number
}

export interface DoorStateVisual {
  source: SpriteFrameSource
  collision: boolean
}

export interface DoorVisualDefinition {
  defaultState: string
  onInteract: 'toggle' | 'open' | 'close' | 'none'
  states: Record<string, DoorStateVisual>
  widthTiles: number
  heightTiles: number
}

export interface NpcAnimationClip {
  frameTileIds: number[]
  fps: number
  loop: boolean
}

export type FacingDirection = 'up' | 'down' | 'left' | 'right'
export type FacingMode = 'auto_4dir' | 'auto_flip_x' | 'fixed_right'

export interface NpcVisualDefinition {
  tilesetId: string
  defaultAnimation: string
  onLoadAnimation: string
  onInteractAnimation: string | null
  idleAnimation: string
  walkAnimation: string
  facingMode: FacingMode
  previewAnimation: string
  previewAnimate: boolean
  previewLoopOverride: boolean | null
  speedTilesPerSecond: number
  animations: Record<string, NpcAnimationClip>
  widthTiles: number
  heightTiles: number
}

export interface ActorAnimationSelection {
  animationId: string
  clip: NpcAnimationClip
  flipX: boolean
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function toString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function toPositiveInt(value: unknown): number | null {
  const n = toNumber(value)
  if (n === null) return null
  const intValue = Math.floor(n)
  return intValue >= 0 ? intValue : null
}

function toPositiveFloat(value: unknown): number | null {
  const n = toNumber(value)
  if (n === null) return null
  return n >= 0 ? n : null
}

function parseFrames(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const frames: number[] = []
  for (const entry of value) {
    const frame = toPositiveInt(entry)
    if (frame !== null) {
      frames.push(frame)
    }
  }
  return frames
}

function parseAnimationDef(value: unknown): EntityDefinitionAnimation | null {
  const record = toRecord(value)
  if (!record) return null

  const frames = parseFrames(record.frames)
  if (frames.length === 0) return null

  const animation: EntityDefinitionAnimation = { frames }
  const fps = toPositiveFloat(record.fps)
  if (fps !== null) animation.fps = fps
  const loop = toBoolean(record.loop)
  if (loop !== null) animation.loop = loop
  return animation
}

function parseTileMatrix(value: unknown): number[][] {
  if (!Array.isArray(value)) return []
  const matrix: number[][] = []
  for (const row of value) {
    if (!Array.isArray(row)) continue
    const parsedRow: number[] = []
    for (const cell of row) {
      const tile = toPositiveInt(cell)
      parsedRow.push(tile ?? 0)
    }
    if (parsedRow.length > 0) {
      matrix.push(parsedRow)
    }
  }
  return matrix
}

function flattenMatrix(matrix: number[][]): number[] {
  const flattened: number[] = []
  for (const row of matrix) {
    for (const tileId of row) {
      if (tileId > 0) flattened.push(tileId)
    }
  }
  return flattened
}

function matrixWidth(matrix: number[][]): number {
  return matrix.reduce((max, row) => Math.max(max, row.length), 0)
}

function parseEntityPropertyString(entity: EntityData, key: string): string | null {
  const value = entity.properties?.[key]
  return toString(value)
}

function parseEntityPropertyNumber(entity: EntityData, key: string): number | null {
  const value = entity.properties?.[key]
  return toNumber(value)
}

function pickFirstValidKey(candidates: Array<string | null | undefined>, available: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && available.includes(candidate)) {
      return candidate
    }
  }
  return available[0] ?? null
}

function normalizeOnInteractMode(value: string | null): 'toggle' | 'open' | 'close' | 'none' {
  switch (value?.toLowerCase()) {
    case 'toggle':
      return 'toggle'
    case 'open':
      return 'open'
    case 'close':
      return 'close'
    default:
      return 'none'
  }
}

function normalizeFacingMode(value: string | null): FacingMode {
  switch (value?.toLowerCase()) {
    case 'auto_4dir':
    case '4dir':
    case 'four_way':
      return 'auto_4dir'
    case 'auto_flip_x':
    case 'flip_x':
      return 'auto_flip_x'
    case 'fixed_right':
    default:
      return 'fixed_right'
  }
}

function resolveEntityDefinition(entity: EntityData, definitions: EntityDefinitionMap): EntityDefinitionFile | null {
  const explicitId =
    parseEntityPropertyString(entity, 'entityDefId') ??
    parseEntityPropertyString(entity, 'entityId')

  if (explicitId && definitions[explicitId]) return definitions[explicitId]
  if (definitions[entity.type]) return definitions[entity.type]
  return null
}

function computeTileSpan(entity: EntityData, tileSize: number, fallback: { width?: number; height?: number }) {
  const widthTiles = fallback.width ?? Math.max(1, Math.round(entity.width / tileSize))
  const heightTiles = fallback.height ?? Math.max(1, Math.round(entity.height / tileSize))
  return {
    widthTiles: Math.max(1, widthTiles),
    heightTiles: Math.max(1, heightTiles),
  }
}

export function parseEntityDefinitionFile(value: unknown): EntityDefinitionFile | null {
  const record = toRecord(value)
  if (!record) return null

  const id = toString(record.id)
  if (!id) return null

  const parsed: EntityDefinitionFile = { id }
  const type = toString(record.type)
  if (type) parsed.type = type
  const displayName = toString(record.displayName)
  if (displayName) parsed.displayName = displayName
  const tileset = toString(record.tileset)
  if (tileset) parsed.tileset = tileset

  const tileSize = toPositiveInt(record.tileSize)
  if (tileSize !== null && tileSize > 0) parsed.tileSize = tileSize

  const sizeRecord = toRecord(record.size)
  if (sizeRecord) {
    const width = toPositiveInt(sizeRecord.width)
    const height = toPositiveInt(sizeRecord.height)
    if (width !== null && width > 0 && height !== null && height > 0) {
      parsed.size = { width, height }
    }
  }

  const defaultState = toString(record.defaultState)
  if (defaultState) parsed.defaultState = defaultState

  const statesRecord = toRecord(record.states)
  if (statesRecord) {
    const states: Record<string, { tileId: number; collision?: boolean }> = {}
    for (const [stateName, stateValue] of Object.entries(statesRecord)) {
      const stateRecord = toRecord(stateValue)
      if (!stateRecord) continue
      const tileId = toPositiveInt(stateRecord.tileId)
      if (tileId === null) continue
      states[stateName] = { tileId }
      const collision = toBoolean(stateRecord.collision)
      if (collision !== null) {
        states[stateName].collision = collision
      }
    }
    if (Object.keys(states).length > 0) {
      parsed.states = states
    }
  }

  const defaultAnimation = toString(record.defaultAnimation)
  if (defaultAnimation) parsed.defaultAnimation = defaultAnimation

  const animationsRecord = toRecord(record.animations)
  if (animationsRecord) {
    const animations: Record<string, EntityDefinitionAnimation> = {}
    for (const [name, animationValue] of Object.entries(animationsRecord)) {
      const parsedAnimation = parseAnimationDef(animationValue)
      if (!parsedAnimation) continue
      animations[name] = parsedAnimation
    }
    if (Object.keys(animations).length > 0) {
      parsed.animations = animations
    }
  }

  const triggersRecord = toRecord(record.triggers)
  if (triggersRecord) {
    const onLoad = toString(triggersRecord.onLoad)
    const onInteract = toString(triggersRecord.onInteract)
    if (onLoad || onInteract) {
      parsed.triggers = {}
      if (onLoad) parsed.triggers.onLoad = onLoad
      if (onInteract) parsed.triggers.onInteract = onInteract
    }
  }

  const behaviorRecord = toRecord(record.behavior)
  if (behaviorRecord) {
    const onLoad = toString(behaviorRecord.onLoad)
    const onInteract = toString(behaviorRecord.onInteract)
    const wanderRecord = toRecord(behaviorRecord.wander)
    const behavior: NonNullable<EntityDefinitionFile['behavior']> = {}
    if (onLoad) behavior.onLoad = onLoad
    if (onInteract) behavior.onInteract = onInteract
    if (wanderRecord) {
      const enabled = toBoolean(wanderRecord.enabled)
      const speedTilesPerSecond = toPositiveFloat(wanderRecord.speedTilesPerSecond)
      const changeDirectionMs = toPositiveInt(wanderRecord.changeDirectionMs)
      behavior.wander = {}
      if (enabled !== null) behavior.wander.enabled = enabled
      if (speedTilesPerSecond !== null) behavior.wander.speedTilesPerSecond = speedTilesPerSecond
      if (changeDirectionMs !== null) behavior.wander.changeDirectionMs = changeDirectionMs
    }
    if (Object.keys(behavior).length > 0) {
      parsed.behavior = behavior
    }
  }

  const previewRecord = toRecord(record.preview)
  if (previewRecord) {
    const showInEditor = toBoolean(previewRecord.showInEditor)
    const animateInPreview = toBoolean(previewRecord.animateInPreview)
    const previewAnimation = toString(previewRecord.previewAnimation)
    const loop = toBoolean(previewRecord.loop)
    parsed.preview = {}
    if (showInEditor !== null) parsed.preview.showInEditor = showInEditor
    if (animateInPreview !== null) parsed.preview.animateInPreview = animateInPreview
    if (previewAnimation) parsed.preview.previewAnimation = previewAnimation
    if (loop !== null) parsed.preview.loop = loop
    if (Object.keys(parsed.preview).length === 0) {
      delete parsed.preview
    }
  }

  return parsed
}

export function parseInteractionDefinitionFile(value: unknown): InteractionDefinitionFile | null {
  const record = toRecord(value)
  if (!record) return null

  const id = toString(record.id)
  const type = toString(record.type)
  const defaultState = toString(record.defaultState)
  if (!id || !type || !defaultState) return null

  const statesRecord = toRecord(record.states)
  if (!statesRecord) return null

  const states: InteractionDefinitionFile['states'] = {}
  for (const [stateName, stateValue] of Object.entries(statesRecord)) {
    const stateRecord = toRecord(stateValue)
    if (!stateRecord) continue
    const tiles = parseTileMatrix(stateRecord.tiles)
    if (tiles.length === 0) continue
    states[stateName] = {
      tiles,
      collision: toBoolean(stateRecord.collision) ?? false,
    }
  }
  if (Object.keys(states).length === 0) return null

  const parsed: InteractionDefinitionFile = {
    id,
    type,
    defaultState,
    states,
  }

  const tileSize = toPositiveInt(record.tileSize)
  if (tileSize !== null && tileSize > 0) {
    parsed.tileSize = tileSize
  }

  const sizeRecord = toRecord(record.size)
  if (sizeRecord) {
    const width = toPositiveInt(sizeRecord.width)
    const height = toPositiveInt(sizeRecord.height)
    if (width !== null && width > 0 && height !== null && height > 0) {
      parsed.size = { width, height }
    }
  }

  const transitionsRecord = toRecord(record.transitions)
  if (transitionsRecord) {
    const transitions: Record<string, { duration: number }> = {}
    for (const [transitionName, transitionValue] of Object.entries(transitionsRecord)) {
      const transitionRecord = toRecord(transitionValue)
      if (!transitionRecord) continue
      const duration = toPositiveInt(transitionRecord.duration)
      if (duration === null) continue
      transitions[transitionName] = { duration }
    }
    if (Object.keys(transitions).length > 0) {
      parsed.transitions = transitions
    }
  }

  return parsed
}

export function resolveDoorVisualDefinition(
  entity: EntityData,
  entityDefinitions: EntityDefinitionMap,
  interactionDefinitions: InteractionDefinitionMap,
): DoorVisualDefinition | null {
  const entityDef = resolveEntityDefinition(entity, entityDefinitions)

  if (entityDef?.states && entityDef.tileset) {
    const stateEntries = Object.entries(entityDef.states)
      .filter(([, state]) => Number.isFinite(state.tileId))
      .map(([name, state]) => [
        name,
        {
          source: {
            kind: 'local' as const,
            tilesetId: entityDef.tileset!,
            frameTileIds: [state.tileId],
          },
          collision: !!state.collision,
        },
      ])

    if (stateEntries.length > 0) {
      const states = Object.fromEntries(stateEntries)
      const stateKeys = Object.keys(states)
      const defaultState = pickFirstValidKey(
        [
          parseEntityPropertyString(entity, 'previewState'),
          entityDef.defaultState,
        ],
        stateKeys,
      )
      if (!defaultState) return null

      const tileSize = entityDef.tileSize ?? 32
      const { widthTiles, heightTiles } = computeTileSpan(entity, tileSize, entityDef.size ?? {})
      const onInteract = normalizeOnInteractMode(
        parseEntityPropertyString(entity, 'onInteractState') ??
        entityDef.triggers?.onInteract ??
        null,
      )

      return {
        defaultState,
        onInteract,
        states,
        widthTiles,
        heightTiles,
      }
    }
  }

  const interactionId = parseEntityPropertyString(entity, 'interactionId')
  const interaction = interactionId ? interactionDefinitions[interactionId] : null
  if (!interaction) return null

  const stateEntries: Array<[string, DoorStateVisual]> = []
  for (const [name, state] of Object.entries(interaction.states)) {
    const frameTileIds = flattenMatrix(state.tiles)
    if (frameTileIds.length === 0) continue
    stateEntries.push([
      name,
      {
        source: {
          kind: 'global',
          frameTileIds,
        },
        collision: state.collision,
      },
    ])
  }

  if (stateEntries.length === 0) return null

  const states = Object.fromEntries(stateEntries)
  const stateKeys = Object.keys(states)
  const defaultState = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'previewState'),
      interaction.defaultState,
    ],
    stateKeys,
  )
  if (!defaultState) return null

  const firstState = interaction.states[defaultState] ?? interaction.states[stateKeys[0]]
  const inferredWidth = firstState ? matrixWidth(firstState.tiles) : 1
  const inferredHeight = firstState?.tiles.length ?? 1
  const widthTiles = Math.max(1, interaction.size?.width ?? inferredWidth)
  const heightTiles = Math.max(1, interaction.size?.height ?? inferredHeight)

  let onInteract = normalizeOnInteractMode(parseEntityPropertyString(entity, 'onInteractState'))
  if (onInteract === 'none' && stateKeys.includes('open') && stateKeys.includes('closed')) {
    onInteract = 'toggle'
  }

  return {
    defaultState,
    onInteract,
    states,
    widthTiles,
    heightTiles,
  }
}

export function resolveNpcVisualDefinition(
  entity: EntityData,
  entityDefinitions: EntityDefinitionMap,
): NpcVisualDefinition | null {
  const entityDef = resolveEntityDefinition(entity, entityDefinitions)
  if (!entityDef?.tileset || !entityDef.animations) {
    return null
  }

  const animationEntries: Array<[string, NpcAnimationClip]> = []
  for (const [name, animation] of Object.entries(entityDef.animations)) {
    const frames = parseFrames(animation.frames)
    if (frames.length === 0) continue
    animationEntries.push([
      name,
      {
        frameTileIds: frames,
        fps: Math.max(0.1, animation.fps ?? 6),
        loop: animation.loop ?? true,
      },
    ])
  }

  if (animationEntries.length === 0) return null

  const animations = Object.fromEntries(animationEntries)
  const animationKeys = Object.keys(animations)

  const defaultAnimation = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'defaultAnimation'),
      entityDef.defaultAnimation,
    ],
    animationKeys,
  )
  if (!defaultAnimation) return null

  const onLoadAnimation = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'onLoadAnimation'),
      entityDef.behavior?.onLoad,
      defaultAnimation,
    ],
    animationKeys,
  ) ?? defaultAnimation

  const previewAnimation = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'previewAnimation'),
      entityDef.preview?.previewAnimation,
      onLoadAnimation,
    ],
    animationKeys,
  ) ?? onLoadAnimation

  const onInteractAnimation = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'onInteractAnimation'),
      entityDef.behavior?.onInteract,
    ],
    animationKeys,
  )

  const idleAnimation = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'idleAnimation'),
      defaultAnimation,
      onLoadAnimation,
    ],
    animationKeys,
  ) ?? defaultAnimation

  const walkAnimation = pickFirstValidKey(
    [
      parseEntityPropertyString(entity, 'walkAnimation'),
      onLoadAnimation,
      defaultAnimation,
      idleAnimation,
    ],
    animationKeys,
  ) ?? onLoadAnimation

  const facingMode = normalizeFacingMode(
    parseEntityPropertyString(entity, 'facingMode') ?? 'fixed_right',
  )

  const speedTilesPerSecond =
    parseEntityPropertyNumber(entity, 'speedTilesPerSecond') ??
    entityDef.behavior?.wander?.speedTilesPerSecond ??
    2.2

  const tileSize = entityDef.tileSize ?? 32
  const { widthTiles, heightTiles } = computeTileSpan(entity, tileSize, entityDef.size ?? {})

  return {
    tilesetId: entityDef.tileset,
    defaultAnimation,
    onLoadAnimation,
    onInteractAnimation,
    idleAnimation,
    walkAnimation,
    facingMode,
    previewAnimation,
    previewAnimate: entityDef.preview?.animateInPreview ?? true,
    previewLoopOverride: entityDef.preview?.loop ?? null,
    speedTilesPerSecond: Math.max(0.1, speedTilesPerSecond),
    animations,
    widthTiles,
    heightTiles,
  }
}

export function resolveEditorEntityFrameSequence(
  entity: EntityData,
  entityDefinitions: EntityDefinitionMap,
  interactionDefinitions: InteractionDefinitionMap,
): EntityFrameSequence | null {
  const doorVisual = resolveDoorVisualDefinition(entity, entityDefinitions, interactionDefinitions)
  if (doorVisual) {
    const stateName = pickFirstValidKey(
      [
        parseEntityPropertyString(entity, 'previewState'),
        doorVisual.defaultState,
      ],
      Object.keys(doorVisual.states),
    )
    if (!stateName) return null
    const state = doorVisual.states[stateName]
    return {
      source: state.source,
      frameInterpretation: 'layout',
      fps: 1,
      loop: false,
      animate: false,
      widthTiles: doorVisual.widthTiles,
      heightTiles: doorVisual.heightTiles,
    }
  }

  const npcVisual = resolveNpcVisualDefinition(entity, entityDefinitions)
  if (!npcVisual) return null

  const clip = npcVisual.animations[npcVisual.previewAnimation]
  if (!clip) return null

  return {
    source: {
      kind: 'local',
      tilesetId: npcVisual.tilesetId,
      frameTileIds: clip.frameTileIds,
    },
    frameInterpretation: 'timeline',
    fps: clip.fps,
    loop: npcVisual.previewLoopOverride ?? clip.loop,
    animate: npcVisual.previewAnimate && clip.frameTileIds.length > 1,
    widthTiles: npcVisual.widthTiles,
    heightTiles: npcVisual.heightTiles,
  }
}

function directionalAnimationCandidates(baseAnimation: string, direction: FacingDirection): string[] {
  const directionSuffixes: Record<FacingDirection, string[]> = {
    up: ['up', 'north', 'w'],
    down: ['down', 'south', 's'],
    left: ['left', 'west', 'a'],
    right: ['right', 'east', 'd'],
  }
  const suffixes = directionSuffixes[direction]
  const candidates: string[] = []
  for (const suffix of suffixes) {
    candidates.push(`${baseAnimation}_${suffix}`)
    candidates.push(`${baseAnimation}-${suffix}`)
    candidates.push(`${suffix}_${baseAnimation}`)
    candidates.push(`${suffix}-${baseAnimation}`)
  }
  candidates.push(baseAnimation)
  return candidates
}

export function resolveActorAnimationSelection(
  visual: NpcVisualDefinition,
  baseAnimation: string,
  direction: FacingDirection,
): ActorAnimationSelection {
  const animationKeys = Object.keys(visual.animations)
  let animationId = baseAnimation
  let clip = visual.animations[animationId]
  let flipX = false

  if (visual.facingMode === 'auto_4dir') {
    const directionalId = pickFirstValidKey(directionalAnimationCandidates(baseAnimation, direction), animationKeys)
    if (directionalId) {
      animationId = directionalId
      clip = visual.animations[animationId]
    }
  } else if (visual.facingMode === 'auto_flip_x') {
    flipX = direction === 'left'
  }

  if (!clip) {
    const fallbackId = pickFirstValidKey([visual.defaultAnimation, visual.onLoadAnimation], animationKeys)
    const fallbackAnimationId = fallbackId ?? animationKeys[0]
    if (fallbackAnimationId) {
      animationId = fallbackAnimationId
      clip = visual.animations[fallbackAnimationId]
    }
  }

  if (!clip) {
    // Should not happen because resolveNpcVisualDefinition guarantees at least one animation.
    const firstId = animationKeys[0]
    if (!firstId) {
      throw new Error('Expected at least one animation clip for actor visual definition.')
    }
    const firstClip = visual.animations[firstId]
    if (!firstClip) {
      throw new Error(`Missing animation clip "${firstId}" in actor visual definition.`)
    }
    return {
      animationId: firstId,
      clip: firstClip,
      flipX: false,
    }
  }

  const resolvedClip: NpcAnimationClip = clip
  return {
    animationId,
    clip: resolvedClip,
    flipX,
  }
}

export function resolveFrameIndex(
  frameCount: number,
  elapsedMs: number,
  fps: number,
  loop: boolean,
): number {
  if (frameCount <= 1) return 0
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  const safeFps = Math.max(0.1, fps)
  const frameDurationMs = 1000 / safeFps
  const rawIndex = Math.floor(elapsedMs / frameDurationMs)
  if (loop) {
    return rawIndex % frameCount
  }
  return Math.min(frameCount - 1, rawIndex)
}
