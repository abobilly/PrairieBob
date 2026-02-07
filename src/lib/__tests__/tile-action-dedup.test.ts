/**
 * Phase 7.3 + 8.3 — Definition merge dedup and save/load roundtrip
 *
 * Tests that:
 * 1. combineTileActionGroups never produces duplicate IDs
 * 2. Definition-backed groups (entity:/interaction:) take precedence
 * 3. Custom groups are preserved only if their IDs don't collide
 * 4. serializeActionGroups → deserializeActionGroups roundtrip is lossless
 */

import { describe, it, expect } from 'vitest'
import type { TileActionGroup, EntityDefinitionFile, InteractionDefinitionFile } from '../types'
import { serializeActionGroups, deserializeActionGroups } from '../tile-actions'

// ---------------------------------------------------------------------------
// Re-implement combineTileActionGroups and helpers to test the logic
// in isolation (the store version uses Immer and React dependencies).
// ---------------------------------------------------------------------------

function isDefinitionBackedGroupId(id: string): boolean {
  return id.startsWith('interaction:') || id.startsWith('entity:')
}

function deriveTileActionGroupsFromDefinitions(
  interactionDefinitions: Record<string, InteractionDefinitionFile>,
  entityDefinitions: Record<string, EntityDefinitionFile>,
): TileActionGroup[] {
  const groups: TileActionGroup[] = []

  for (const [interactionId, def] of Object.entries(interactionDefinitions).sort(([a], [b]) => a.localeCompare(b))) {
    const states = Object.entries(def.states).map(([stateName, stateDef]) => ({
      name: stateName,
      tileId: stateDef.tiles?.[0]?.[0] ?? 0,
    }))
    if (states.length === 0) continue
    const stateNames = states.map((s) => s.name)
    groups.push({
      id: `interaction:${interactionId}`,
      name: `${interactionId} (${def.type || 'interaction'})`,
      states,
      defaultState: stateNames.includes(def.defaultState) ? def.defaultState : stateNames[0],
      triggers: [{ type: 'on_interact', parameters: { interactionId } }],
      effects: [{ type: 'change_state', parameters: { interactionId, mode: 'cycle', states: stateNames } }],
    })
  }

  for (const [entityId, def] of Object.entries(entityDefinitions).sort(([a], [b]) => a.localeCompare(b))) {
    if (!def.states || Object.keys(def.states).length === 0) continue
    if (groups.some((g) => g.id === `entity:${entityId}`)) continue
    const states = Object.entries(def.states).map(([stateName, stateDef]) => ({
      name: stateName,
      tileId: typeof stateDef.tileId === 'number' ? stateDef.tileId : 0,
    }))
    const defaultState = states.some((s) => s.name === def.defaultState)
      ? (def.defaultState as string)
      : states[0]?.name
    if (!defaultState) continue
    groups.push({
      id: `entity:${entityId}`,
      name: `${entityId} (entity)`,
      states,
      defaultState,
      triggers: [],
      effects: [],
    })
  }

  return groups
}

function combineTileActionGroups(
  interactionDefinitions: Record<string, InteractionDefinitionFile>,
  entityDefinitions: Record<string, EntityDefinitionFile>,
  customTileActionGroups: TileActionGroup[],
): TileActionGroup[] {
  const derived = deriveTileActionGroupsFromDefinitions(interactionDefinitions, entityDefinitions)
  if (customTileActionGroups.length === 0) return derived

  const byId = new Map<string, TileActionGroup>()
  for (const group of derived) byId.set(group.id, group)
  for (const group of customTileActionGroups) {
    if (!byId.has(group.id) && !isDefinitionBackedGroupId(group.id)) {
      byId.set(group.id, group)
    }
  }
  return Array.from(byId.values())
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const INTERACTION_DEFS: Record<string, InteractionDefinitionFile> = {
  front_door: {
    id: 'front_door',
    type: 'door',
    defaultState: 'closed',
    states: {
      closed: { tiles: [[1]], collision: true },
      open: { tiles: [[2]], collision: false },
    },
    transitions: {},
  },
}

const ENTITY_DEFS: Record<string, EntityDefinitionFile> = {
  guard_npc: {
    id: 'guard_npc',
    type: 'npc',
    displayName: 'Guard',
    defaultState: 'idle',
    states: {
      idle: { tileId: 10 },
      walk: { tileId: 11 },
    },
  },
}

function makeCustomGroup(id: string, name: string): TileActionGroup {
  return {
    id,
    name,
    states: [{ name: 'default', tileId: 0 }],
    defaultState: 'default',
    triggers: [],
    effects: [],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('combineTileActionGroups — dedup', () => {
  it('produces no duplicate IDs when custom groups are empty', () => {
    const result = combineTileActionGroups(INTERACTION_DEFS, ENTITY_DEFS, [])
    const ids = result.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('interaction:front_door')
    expect(ids).toContain('entity:guard_npc')
  })

  it('definition-backed groups take precedence over custom groups with same ID', () => {
    const staleCustom = makeCustomGroup('interaction:front_door', 'Stale Door Copy')
    const result = combineTileActionGroups(INTERACTION_DEFS, ENTITY_DEFS, [staleCustom])
    const ids = result.map((g) => g.id)
    // Only one occurrence of interaction:front_door
    expect(ids.filter((id) => id === 'interaction:front_door')).toHaveLength(1)
    // And it should be the derived one, not the stale copy
    const doorGroup = result.find((g) => g.id === 'interaction:front_door')!
    expect(doorGroup.states).toHaveLength(2) // open + closed from def
  })

  it('custom groups are preserved alongside derived groups', () => {
    const custom = makeCustomGroup('custom-trap-1', 'Spike Trap')
    const result = combineTileActionGroups(INTERACTION_DEFS, ENTITY_DEFS, [custom])
    expect(result.map((g) => g.id)).toContain('custom-trap-1')
    expect(result).toHaveLength(3) // interaction:front_door + entity:guard_npc + custom-trap-1
  })

  it('rejects custom groups with entity: prefix (definition namespace collision)', () => {
    const colliding = makeCustomGroup('entity:guard_npc', 'Duplicate Guard')
    const result = combineTileActionGroups(INTERACTION_DEFS, ENTITY_DEFS, [colliding])
    expect(result.filter((g) => g.id === 'entity:guard_npc')).toHaveLength(1)
  })

  it('handles empty definitions gracefully', () => {
    const custom = makeCustomGroup('my-action', 'Custom')
    const result = combineTileActionGroups({}, {}, [custom])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('my-action')
  })

  it('handles duplicate custom group IDs by keeping first occurrence', () => {
    const a = makeCustomGroup('dup-id', 'First')
    const b = makeCustomGroup('dup-id', 'Second')
    const result = combineTileActionGroups({}, {}, [a, b])
    expect(result.filter((g) => g.id === 'dup-id')).toHaveLength(1)
    expect(result[0].name).toBe('First')
  })
})

describe('serializeActionGroups / deserializeActionGroups roundtrip', () => {
  it('preserves group data through serialization', () => {
    const groups: TileActionGroup[] = [
      {
        id: 'interaction:door1',
        name: 'Door',
        states: [
          { name: 'closed', tileId: 1 },
          { name: 'open', tileId: 2, duration: 300 },
        ],
        defaultState: 'closed',
        triggers: [{ type: 'on_interact', parameters: { interactionId: 'door1' } }],
        effects: [{ type: 'change_state', parameters: { mode: 'toggle' } }],
      },
      makeCustomGroup('custom-1', 'Custom Trap'),
    ]

    const serialized = serializeActionGroups(groups)
    const deserialized = deserializeActionGroups(serialized as unknown[])

    expect(deserialized).toHaveLength(2)
    expect(deserialized[0].id).toBe('interaction:door1')
    expect(deserialized[0].states).toHaveLength(2)
    expect(deserialized[0].states[1].duration).toBe(300)
    expect(deserialized[1].id).toBe('custom-1')
  })

  it('filters definition-backed groups for save-safe roundtrip', () => {
    const allGroups: TileActionGroup[] = [
      makeCustomGroup('interaction:door1', 'Door'),
      makeCustomGroup('entity:npc1', 'NPC'),
      makeCustomGroup('my-custom', 'Custom'),
    ]

    // Simulate the save filter: only persist non-definition-backed groups
    const persistable = allGroups.filter((g) => !isDefinitionBackedGroupId(g.id))
    const serialized = serializeActionGroups(persistable)
    const deserialized = deserializeActionGroups(serialized as unknown[])

    expect(deserialized).toHaveLength(1)
    expect(deserialized[0].id).toBe('my-custom')
  })

  it('handles empty input', () => {
    expect(deserializeActionGroups([])).toEqual([])
    expect(serializeActionGroups([])).toEqual([])
  })

  it('handles malformed but object-shaped input gracefully', () => {
    const result = deserializeActionGroups([{}, { id: 'x' }, { name: 'y' }])
    expect(result).toHaveLength(3)
    for (const group of result) {
      expect(group.id).toBeTruthy()
      expect(group.name).toBeTruthy()
    }
  })
})
