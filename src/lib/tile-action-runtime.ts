/**
 * Tile Action Runtime — Pure logic for executing tile action groups during run/test mode.
 * 
 * Handles triggers (on_step, on_interact, on_adjacent, on_timer, on_signal),
 * effects (change_state, emit_signal, play_sound, teleport, dialog),
 * and auto-state transitions (duration + nextState).
 */

import type { TileActionGroup, TileActionAssignment, TileEffect } from '@/lib/types'

// ============== Types ==============

/** Runtime state for all active tile action instances. */
export interface TileActionRuntimeState {
  /** Current state name per assigned tile, keyed by "layerName:x:y". */
  tileStates: Map<string, string>
  /** Active duration timers: key → remaining ms. */
  tileTimers: Map<string, number>
  /** Player's tile position last frame (for on_step edge detection). */
  previousPlayerTileX: number
  previousPlayerTileY: number
  /** Pending signal names emitted this frame. */
  pendingSignals: string[]
}

/** Context needed by effect executors. */
export interface EffectContext {
  tileSize: number
  setPlayerPosition?: (x: number, y: number) => void
  showDialog?: (text: string) => void
  playSound?: (soundId: string) => void
}

/** A resolved effect to execute, with source tile info. */
interface TriggeredEffect {
  key: string
  effect: TileEffect
}

// ============== Initialization ==============

/** Build initial runtime state from assignments + groups. */
export function initTileActionRuntimeState(
  assignments: Record<string, TileActionAssignment>,
  groups: TileActionGroup[],
): TileActionRuntimeState {
  const groupMap = new Map(groups.map((g) => [g.id, g]))
  const tileStates = new Map<string, string>()
  const tileTimers = new Map<string, number>()

  for (const [key, assignment] of Object.entries(assignments)) {
    const group = groupMap.get(assignment.actionGroupId)
    if (!group) continue
    const stateName = assignment.currentState ?? group.defaultState
    tileStates.set(key, stateName)

    // Set timer if the initial state has a duration
    const state = group.states.find((s) => s.name === stateName)
    if (state?.duration && state.nextState) {
      tileTimers.set(key, state.duration)
    }
  }

  return {
    tileStates,
    tileTimers,
    previousPlayerTileX: -1,
    previousPlayerTileY: -1,
    pendingSignals: [],
  }
}

// ============== Lookups ==============

function findGroup(
  key: string,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
): TileActionGroup | undefined {
  const assignment = assignments[key]
  if (!assignment) return undefined
  return groupMap.get(assignment.actionGroupId)
}

function getMatchingEffects(
  key: string,
  triggerType: string,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
): TriggeredEffect[] {
  const group = findGroup(key, assignments, groupMap)
  if (!group) return []
  return group.triggers
    .filter((t) => t.type === triggerType)
    .flatMap(() =>
      group.effects.map((effect) => ({ key, effect }))
    )
}

/** Get the visual tile ID override for a position, if the tile is in a non-default state. */
export function getTileVisualOverride(
  key: string,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
): number | null {
  const currentStateName = state.tileStates.get(key)
  if (!currentStateName) return null
  const group = findGroup(key, assignments, groupMap)
  if (!group) return null
  const stateObj = group.states.find((s) => s.name === currentStateName)
  if (!stateObj) return null
  return stateObj.tileId
}

// ============== Trigger Checks ==============

/** Check on_step triggers when player enters a new tile. */
export function checkOnStep(
  playerTileX: number,
  playerTileY: number,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
  layers: string[],
): TriggeredEffect[] {
  if (
    playerTileX === state.previousPlayerTileX &&
    playerTileY === state.previousPlayerTileY
  ) {
    return []
  }

  const effects: TriggeredEffect[] = []
  for (const layerName of layers) {
    const key = `${layerName}:${playerTileX}:${playerTileY}`
    effects.push(...getMatchingEffects(key, 'on_step', state, assignments, groupMap))
  }
  return effects
}

/** Check on_interact trigger for the tile the player is facing. */
export function checkOnInteract(
  facedTileX: number,
  facedTileY: number,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
  layers: string[],
): TriggeredEffect[] {
  const effects: TriggeredEffect[] = []
  for (const layerName of layers) {
    const key = `${layerName}:${facedTileX}:${facedTileY}`
    effects.push(...getMatchingEffects(key, 'on_interact', state, assignments, groupMap))
  }
  return effects
}

/** Check on_adjacent triggers for tiles adjacent to the player. */
export function checkOnAdjacent(
  playerTileX: number,
  playerTileY: number,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
  layers: string[],
): TriggeredEffect[] {
  const effects: TriggeredEffect[] = []
  const neighbors = [
    [playerTileX - 1, playerTileY],
    [playerTileX + 1, playerTileY],
    [playerTileX, playerTileY - 1],
    [playerTileX, playerTileY + 1],
  ]
  for (const [nx, ny] of neighbors) {
    for (const layerName of layers) {
      const key = `${layerName}:${nx}:${ny}`
      effects.push(...getMatchingEffects(key, 'on_adjacent', state, assignments, groupMap))
    }
  }
  return effects
}

/** Tick duration timers and fire auto-state transitions. Returns effects from on_state_enter/exit. */
export function tickTimers(
  deltaMs: number,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
): TriggeredEffect[] {
  const effects: TriggeredEffect[] = []

  for (const [key, remaining] of state.tileTimers) {
    const newRemaining = remaining - deltaMs
    if (newRemaining <= 0) {
      state.tileTimers.delete(key)
      // Auto-advance state
      const group = findGroup(key, assignments, groupMap)
      if (!group) continue
      const currentStateName = state.tileStates.get(key) ?? group.defaultState
      const currentState = group.states.find((s) => s.name === currentStateName)
      if (currentState?.nextState) {
        effects.push(...changeState(key, currentState.nextState, state, assignments, groupMap))
      }
    } else {
      state.tileTimers.set(key, newRemaining)
    }
  }
  return effects
}

/** Process pending signals — fire effects on tiles listening for on_signal. */
export function processSignals(
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
): TriggeredEffect[] {
  if (state.pendingSignals.length === 0) return []

  const effects: TriggeredEffect[] = []
  const signals = new Set(state.pendingSignals)
  state.pendingSignals = []

  for (const [key, assignment] of Object.entries(assignments)) {
    const group = groupMap.get(assignment.actionGroupId)
    if (!group) continue
    for (const trigger of group.triggers) {
      if (trigger.type !== 'on_signal') continue
      const signalName = trigger.parameters?.signal as string | undefined
      if (signalName && signals.has(signalName)) {
        effects.push(...group.effects.map((effect) => ({ key, effect })))
      }
    }
  }
  return effects
}

// ============== State Changes ==============

/** Change a tile's state and fire on_state_exit / on_state_enter triggers. */
function changeState(
  key: string,
  newStateName: string,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
): TriggeredEffect[] {
  const group = findGroup(key, assignments, groupMap)
  if (!group) return []

  const oldStateName = state.tileStates.get(key)
  state.tileStates.set(key, newStateName)

  // Remove old timer
  state.tileTimers.delete(key)

  // Set new timer if applicable
  const newState = group.states.find((s) => s.name === newStateName)
  if (newState?.duration && newState.nextState) {
    state.tileTimers.set(key, newState.duration)
  }

  const effects: TriggeredEffect[] = []

  // on_state_exit effects
  if (oldStateName) {
    for (const trigger of group.triggers) {
      if (trigger.type === 'on_state_exit') {
        effects.push(...group.effects.map((effect) => ({ key, effect })))
      }
    }
  }

  // on_state_enter effects
  for (const trigger of group.triggers) {
    if (trigger.type === 'on_state_enter') {
      effects.push(...group.effects.map((effect) => ({ key, effect })))
    }
  }

  return effects
}

// ============== Effect Execution ==============

/** Execute a batch of triggered effects. */
export function executeEffects(
  triggered: TriggeredEffect[],
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groupMap: Map<string, TileActionGroup>,
  context: EffectContext,
): void {
  for (const { key, effect } of triggered) {
    switch (effect.type) {
      case 'change_state': {
        const targetState = effect.parameters.state as string | undefined
        if (targetState) {
          const cascaded = changeState(key, targetState, state, assignments, groupMap)
          // Recursively execute cascaded effects (avoid infinite loops with depth limit)
          if (cascaded.length > 0) {
            executeEffects(cascaded, state, assignments, groupMap, context)
          }
        }
        break
      }

      case 'emit_signal': {
        const signalName = effect.parameters.signal as string | undefined
        if (signalName) {
          state.pendingSignals.push(signalName)
        }
        break
      }

      case 'play_sound': {
        const soundId = effect.parameters.sound as string | undefined
        if (soundId && context.playSound) {
          context.playSound(soundId)
        }
        break
      }

      case 'teleport': {
        const x = effect.parameters.x as number | undefined
        const y = effect.parameters.y as number | undefined
        if (x != null && y != null && context.setPlayerPosition) {
          context.setPlayerPosition(x * context.tileSize, y * context.tileSize)
        }
        break
      }

      case 'dialog': {
        const text = effect.parameters.text as string | undefined
        if (text && context.showDialog) {
          context.showDialog(text)
        }
        break
      }

      // Stubs for future implementation
      case 'spawn_entity':
      case 'damage':
      case 'custom':
        break
    }
  }
}

// ============== Main Update ==============

/** Run all tile action checks for one frame. Call after player movement. */
export function updateTileActions(
  playerTileX: number,
  playerTileY: number,
  deltaMs: number,
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groups: TileActionGroup[],
  layers: string[],
  context: EffectContext,
): void {
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  // 1. Check on_step (player entered new tile)
  const stepEffects = checkOnStep(playerTileX, playerTileY, state, assignments, groupMap, layers)
  executeEffects(stepEffects, state, assignments, groupMap, context)

  // 2. Check on_adjacent
  const adjacentEffects = checkOnAdjacent(playerTileX, playerTileY, state, assignments, groupMap, layers)
  executeEffects(adjacentEffects, state, assignments, groupMap, context)

  // 3. Tick timers (auto-state transitions)
  const timerEffects = tickTimers(deltaMs, state, assignments, groupMap)
  executeEffects(timerEffects, state, assignments, groupMap, context)

  // 4. Process signals
  const signalEffects = processSignals(state, assignments, groupMap)
  executeEffects(signalEffects, state, assignments, groupMap, context)

  // 5. Update previous player position
  state.previousPlayerTileX = playerTileX
  state.previousPlayerTileY = playerTileY
}

/** Check on_interact for the tile the player is facing. */
export function handleTileInteract(
  playerTileX: number,
  playerTileY: number,
  facingDir: 'up' | 'down' | 'left' | 'right',
  state: TileActionRuntimeState,
  assignments: Record<string, TileActionAssignment>,
  groups: TileActionGroup[],
  layers: string[],
  context: EffectContext,
): void {
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  // Compute faced tile
  let facedX = playerTileX
  let facedY = playerTileY
  switch (facingDir) {
    case 'up': facedY -= 1; break
    case 'down': facedY += 1; break
    case 'left': facedX -= 1; break
    case 'right': facedX += 1; break
  }

  const effects = checkOnInteract(facedX, facedY, state, assignments, groupMap, layers)
  executeEffects(effects, state, assignments, groupMap, context)
}
