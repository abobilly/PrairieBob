/**
 * Tile Actions / State Machine System
 *
 * Registry for tile action groups + state machine logic.
 * Allows tiles to have interactive behaviors: doors, switches, pressure plates, etc.
 */

import type { TileActionGroup, TileState, TileTrigger, TileEffect, EntityDefinitionFile, InteractionDefinitionFile } from './types'

// ============== Behavior Categories ==============

export type BehaviorCategory = 'doors' | 'npc' | 'player' | 'props' | 'custom'

const DOOR_TYPES = new Set(['door', 'portal', 'stairs', 'ladder'])
const NPC_TYPES = new Set(['npc'])
const PLAYER_TYPES = new Set(['spawn_point'])
const PROP_TYPES = new Set(['prop', 'trigger'])

export const BEHAVIOR_CATEGORY_META: Record<BehaviorCategory, { label: string; color: string }> = {
  doors: { label: 'Doors', color: '#f59e0b' },
  npc: { label: 'NPC', color: '#8b5cf6' },
  player: { label: 'Player', color: '#22c55e' },
  props: { label: 'Props', color: '#3b82f6' },
  custom: { label: 'Custom', color: '#6b7280' },
}

export function inferBehaviorCategory(
  group: TileActionGroup,
  entityDefs?: Record<string, EntityDefinitionFile>,
  interactionDefs?: Record<string, InteractionDefinitionFile>,
): BehaviorCategory {
  if (group.id.startsWith('interaction:')) {
    const id = group.id.slice('interaction:'.length)
    const type = interactionDefs?.[id]?.type
    if (type && DOOR_TYPES.has(type)) return 'doors'
    if (type && NPC_TYPES.has(type)) return 'npc'
    return 'props'
  }
  if (group.id.startsWith('entity:')) {
    const id = group.id.slice('entity:'.length)
    const type = entityDefs?.[id]?.type
    if (type && DOOR_TYPES.has(type)) return 'doors'
    if (type && NPC_TYPES.has(type)) return 'npc'
    if (type && PLAYER_TYPES.has(type)) return 'player'
    if (type && PROP_TYPES.has(type)) return 'props'
    return 'props'
  }
  const name = group.name.toLowerCase()
  if (/(door|portal|stair|ladder)/.test(name)) return 'doors'
  if (/(npc|enemy|mob)/.test(name)) return 'npc'
  if (/(player|spawn)/.test(name)) return 'player'
  return 'custom'
}

export interface BehaviorValidationWarning {
  entityId: string
  entityType: string
  message: string
}

export function validateBehaviorMappings(
  entityDefs: Record<string, EntityDefinitionFile>,
  actionGroups: TileActionGroup[],
): BehaviorValidationWarning[] {
  const warnings: BehaviorValidationWarning[] = []
  const groupEntityIds = new Set(
    actionGroups
      .filter((g) => g.id.startsWith('entity:'))
      .map((g) => g.id.slice('entity:'.length)),
  )

  for (const [id, def] of Object.entries(entityDefs)) {
    const type = def.type ?? ''
    if (NPC_TYPES.has(type) && !groupEntityIds.has(id)) {
      const stateCount = def.states ? Object.keys(def.states).length : 0
      if (stateCount === 0) {
        warnings.push({ entityId: id, entityType: type, message: `NPC "${def.displayName || id}" has no action states` })
      }
    }
    if (PLAYER_TYPES.has(type) && !groupEntityIds.has(id)) {
      warnings.push({ entityId: id, entityType: type, message: `Spawn "${def.displayName || id}" has no action group` })
    }
    if (DOOR_TYPES.has(type)) {
      const stateCount = def.states ? Object.keys(def.states).length : 0
      if (stateCount < 2) {
        warnings.push({ entityId: id, entityType: type, message: `Door "${def.displayName || id}" needs at least 2 states` })
      }
    }
  }
  return warnings
}

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
