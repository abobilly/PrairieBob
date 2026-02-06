/**
 * Kimbar entity type and property normalization.
 *
 * Maps Kimbar entity type names to SpudTile canonical types,
 * and normalizes door/NPC property aliases so both pipelines
 * converge on a single property shape inside the editor.
 */

import type { EntityType } from '@/lib/types'

// Kimbar -> SpudTile entity type mapping (case-insensitive)
const KIMBAR_TYPE_ALIASES: Record<string, EntityType> = {
  playerspawn: 'spawn_point',
  player_spawn: 'spawn_point',
  spawn: 'spawn_point',
  door: 'door',
  npc: 'npc',
  encountertrigger: 'trigger',
  encounter_trigger: 'trigger',
  outfitchest: 'prop',
  outfit_chest: 'prop',
  prop: 'prop',
}

/**
 * Resolve a raw entity type string (possibly Kimbar-style) to
 * a SpudTile EntityType. Returns null if unrecognised.
 */
export function resolveKimbarEntityType(raw: string): EntityType | null {
  const key = raw.toLowerCase().replace(/[\s_-]+/g, '')
  // Try direct lower-case match first (handles already-canonical types)
  const directKey = raw.toLowerCase()
  if (directKey in KIMBAR_TYPE_ALIASES) return KIMBAR_TYPE_ALIASES[directKey]
  // Try collapsed version
  if (key in KIMBAR_TYPE_ALIASES) return KIMBAR_TYPE_ALIASES[key]
  return null
}

// ---- Door property alias normalization ----

const DOOR_TARGET_ROOM_ALIASES = [
  'targetMap', 'toMap', 'targetLevel', 'targetRoom', 'target_map', 'to_map', 'target_level', 'target_room',
] as const

const DOOR_TARGET_SPAWN_ALIASES = [
  'targetSpawnId', 'toSpawn', 'targetSpawn', 'target_spawn_id', 'to_spawn', 'target_spawn',
] as const

/**
 * Normalize door entity properties, mapping Kimbar aliases to
 * SpudTile canonical keys (`targetRoom`, `targetSpawn`).
 * Mutates in-place and returns the same record for convenience.
 */
export function normalizeDoorProperties(
  properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  // Resolve target room
  if (!('targetRoom' in properties)) {
    for (const alias of DOOR_TARGET_ROOM_ALIASES) {
      if (alias in properties && alias !== 'targetRoom') {
        properties.targetRoom = properties[alias]
        break
      }
    }
  }

  // Resolve target spawn
  if (!('targetSpawn' in properties)) {
    for (const alias of DOOR_TARGET_SPAWN_ALIASES) {
      if (alias in properties && alias !== 'targetSpawn') {
        properties.targetSpawn = properties[alias]
        break
      }
    }
  }

  return properties
}

// ---- NPC property normalization ----

/**
 * Ensure NPC properties have canonical keys.
 * Kimbar NPCs use `characterId`, `storyKnot`, `facing`,
 * `wander`, `wanderRadius`, `wanderSpeed` - pass them through
 * since SpudTile already understands these names.
 */
export function normalizeNpcProperties(
  properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  // character_id -> characterId
  if (!('characterId' in properties) && 'character_id' in properties) {
    properties.characterId = properties.character_id
  }
  // story_knot -> storyKnot
  if (!('storyKnot' in properties) && 'story_knot' in properties) {
    properties.storyKnot = properties.story_knot
  }
  // wander_radius -> wanderRadius
  if (!('wanderRadius' in properties) && 'wander_radius' in properties) {
    properties.wanderRadius = properties.wander_radius
  }
  // wander_speed -> wanderSpeed
  if (!('wanderSpeed' in properties) && 'wander_speed' in properties) {
    properties.wanderSpeed = properties.wander_speed
  }
  return properties
}

/**
 * Normalize all properties for an entity based on its resolved type.
 */
export function normalizeEntityProperties(
  type: EntityType,
  properties: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (type === 'door' || type === 'portal') {
    return normalizeDoorProperties(properties)
  }
  if (type === 'npc') {
    return normalizeNpcProperties(properties)
  }
  return properties
}
