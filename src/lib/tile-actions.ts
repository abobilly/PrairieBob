/**
 * Tile Actions / State Machine System
 *
 * Registry for tile action groups + state machine logic.
 * Allows tiles to have interactive behaviors: doors, switches, pressure plates, etc.
 */

import type { TileActionGroup, TileState, TileTrigger, TileEffect } from './types'

/**
 * Central registry for tile action groups.
 * Stores action group definitions and provides state machine logic.
 */
export class TileActionRegistry {
  private groups = new Map<string, TileActionGroup>()

  register(group: TileActionGroup): void {
    this.groups.set(group.id, group)
  }

  unregister(id: string): void {
    this.groups.delete(id)
  }

  get(id: string): TileActionGroup | undefined {
    return this.groups.get(id)
  }

  getAll(): TileActionGroup[] {
    return Array.from(this.groups.values())
  }

  clear(): void {
    this.groups.clear()
  }

  /**
   * Get the next state for a given action group when a trigger fires.
   * Evaluates effects of type 'change_state' to determine the transition.
   */
  getNextState(
    groupId: string,
    currentStateName: string,
    triggerType: TileTrigger['type']
  ): TileState | null {
    const group = this.groups.get(groupId)
    if (!group) return null

    // Check if any trigger matches
    const matchingTrigger = group.triggers.find((t) => t.type === triggerType)
    if (!matchingTrigger) return null

    // Find change_state effects
    for (const effect of group.effects) {
      if (effect.type === 'change_state') {
        const transitions = effect.parameters as Record<string, Record<string, string>>
        // Check for "toggle" style transitions
        if (transitions.toggle && transitions.toggle[currentStateName]) {
          const nextName = transitions.toggle[currentStateName]
          return group.states.find((s) => s.name === nextName) ?? null
        }
        // Check for direct targetState
        if (typeof effect.parameters.targetState === 'string') {
          return group.states.find((s) => s.name === effect.parameters.targetState) ?? null
        }
      }
    }

    // Check auto-transition from current state
    const current = group.states.find((s) => s.name === currentStateName)
    if (current?.nextState) {
      return group.states.find((s) => s.name === current.nextState) ?? null
    }

    return null
  }

  /**
   * Get the tile ID for a given state in an action group.
   */
  getTileIdForState(groupId: string, stateName: string): number | null {
    const group = this.groups.get(groupId)
    if (!group) return null
    const state = group.states.find((s) => s.name === stateName)
    return state?.tileId ?? null
  }

  /**
   * Get the default state for an action group.
   */
  getDefaultState(groupId: string): TileState | null {
    const group = this.groups.get(groupId)
    if (!group) return null
    return group.states.find((s) => s.name === group.defaultState) ?? null
  }
}

/** Singleton registry instance */
export const tileActionRegistry = new TileActionRegistry()

/**
 * Serialize action groups for saving to project.json
 */
export function serializeActionGroups(groups: TileActionGroup[]): unknown[] {
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    states: g.states.map((s) => ({
      name: s.name,
      tileId: s.tileId,
      ...(s.duration !== undefined && { duration: s.duration }),
      ...(s.nextState !== undefined && { nextState: s.nextState }),
    })),
    defaultState: g.defaultState,
    triggers: g.triggers,
    effects: g.effects,
  }))
}

/**
 * Deserialize action groups from project.json data
 */
export function deserializeActionGroups(data: unknown[]): TileActionGroup[] {
  if (!Array.isArray(data)) return []
  return data.map((item) => {
    const d = item as Record<string, unknown>
    return {
      id: (d.id as string) || `action-${Date.now()}`,
      name: (d.name as string) || 'Unnamed',
      states: Array.isArray(d.states) ? (d.states as TileState[]) : [],
      defaultState: (d.defaultState as string) || '',
      triggers: Array.isArray(d.triggers) ? (d.triggers as TileTrigger[]) : [],
      effects: Array.isArray(d.effects) ? (d.effects as TileEffect[]) : [],
    }
  })
}

/**
 * Create an empty action group template
 */
export function createEmptyActionGroup(name: string): TileActionGroup {
  const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    name,
    states: [
      { name: 'default', tileId: 0 },
    ],
    defaultState: 'default',
    triggers: [],
    effects: [],
  }
}
