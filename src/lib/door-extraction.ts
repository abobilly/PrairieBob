/**
 * Door Extraction Utility
 *
 * Extracts door/portal/stairs/ladder entities from LevelData into a
 * normalized `DoorInfo[]` for use in the World View canvas.
 *
 * Handles:
 * - Missing properties gracefully (empty strings, no crash)
 * - Multiple entity layers per level
 * - Entity type aliases (Kimbar compatibility)
 */

import type { EntityData, LevelData } from './types'

// ============== Types ==============

/** Normalized door/transfer entity info for World View. */
export interface DoorInfo {
  /** Original entity ID. */
  entityId: string
  /** Canonical entity type: door | portal | stairs | ladder */
  entityType: string
  /** World X position (pixels). */
  x: number
  /** World Y position (pixels). */
  y: number
  /** Entity width (pixels). */
  width: number
  /** Entity height (pixels). */
  height: number
  /** Target room ID (may be empty if not set). */
  targetRoom: string
  /** Target entity/spawn ID in the target room (may be empty). */
  targetEntityId: string
  /** Display label for the canvas. */
  label: string
  /** Layer name this entity belongs to. */
  layerName: string
}

// ============== Constants ==============

const TRANSFER_TYPES = new Set(['door', 'portal', 'stairs', 'ladder'])

// ============== Extraction ==============

/**
 * Extract all transfer entities (doors, portals, stairs, ladders) from a
 * LevelData into a flat `DoorInfo[]`.
 *
 * Safe to call on any LevelData — returns `[]` when no transfer entities exist.
 */
export function extractDoors(level: LevelData): DoorInfo[] {
  const doors: DoorInfo[] = []

  for (const layer of level.layers) {
    if (layer.type !== 'objectgroup' || !layer.objects) continue

    for (const entity of layer.objects) {
      if (!isTransferEntity(entity)) continue

      doors.push({
        entityId: entity.id,
        entityType: entity.type,
        x: entity.x,
        y: entity.y,
        width: entity.width,
        height: entity.height,
        targetRoom: resolveStringProp(entity, 'targetRoom', 'target_room', 'targetLevel'),
        targetEntityId: resolveStringProp(entity, 'targetEntityId', 'target_entity_id', 'targetSpawn'),
        label: buildDoorLabel(entity),
        layerName: layer.name,
      })
    }
  }

  return doors
}

// ============== Helpers ==============

function isTransferEntity(entity: EntityData): boolean {
  return TRANSFER_TYPES.has(entity.type)
}

/**
 * Resolve a string property by trying multiple keys (for Kimbar / SpudTile
 * alias compatibility). Returns empty string if none found.
 */
function resolveStringProp(entity: EntityData, ...keys: string[]): string {
  for (const key of keys) {
    const value = entity.properties[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

function buildDoorLabel(entity: EntityData): string {
  const name = resolveStringProp(entity, 'name', 'displayName')
  if (name) return name

  const target = resolveStringProp(entity, 'targetRoom', 'target_room', 'targetLevel')
  if (target) return `→ ${target}`

  const typeName = entity.type.replace(/_/g, ' ')
  return `${typeName} [${entity.id}]`
}
