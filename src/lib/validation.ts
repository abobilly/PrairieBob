/**
 * Project-wide validation engine.
 *
 * Aggregates checks across tile actions, entity bindings, collision config,
 * and room links into a single diagnostics list consumed by ValidationPanel.
 */

import type {
  EntityData,
  EntityDefinitionFile,
  InteractionDefinitionFile,
  LevelData,
  TileActionGroup,
} from './types'
import type { CollisionSourceConfig } from './collision-model'
import { getAutoWallsLinkedLayers } from './collision-model'
import type { RoomFileEntry } from '@/stores/projectStore'

// ─── Types ──────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info'

export type ValidationCategory =
  | 'mapping'    // Missing animation/state mappings
  | 'room-link'  // Invalid room references
  | 'collision'  // Collision source conflicts
  | 'entity'     // Door/NPC binding diagnostics

export type ValidationAction = 'open-entity' | 'fix-mapping'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  category: ValidationCategory
  message: string
  /** Which entity/group/layer the issue refers to. */
  subjectId?: string
  subjectLabel?: string
  /** Quick-fix action type shown as a button on the issue row. */
  actionType?: ValidationAction
}

// ─── Checks ─────────────────────────────────────────────────────────

const DOOR_TYPES = new Set(['door', 'portal', 'stairs', 'ladder'])
const NPC_TYPES = new Set(['npc'])
const PLAYER_TYPES = new Set(['spawn_point'])

/**
 * 1. Missing animation/state mappings (extended from validateBehaviorMappings).
 */
function checkMappings(
  entityDefs: Record<string, EntityDefinitionFile>,
  actionGroups: TileActionGroup[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const groupEntityIds = new Set(
    actionGroups
      .filter((g) => g.id.startsWith('entity:'))
      .map((g) => g.id.slice('entity:'.length)),
  )

  for (const [id, def] of Object.entries(entityDefs)) {
    const type = def.type ?? ''
    const label = def.displayName || id

    if (NPC_TYPES.has(type) && !groupEntityIds.has(id)) {
      const stateCount = def.states ? Object.keys(def.states).length : 0
      if (stateCount === 0) {
        issues.push({
          id: `mapping:npc-no-states:${id}`,
          severity: 'warning',
          category: 'mapping',
          message: `NPC "${label}" has no action states`,
          subjectId: id,
          subjectLabel: label,
          actionType: 'fix-mapping',
        })
      }
    }

    if (PLAYER_TYPES.has(type) && !groupEntityIds.has(id)) {
      issues.push({
        id: `mapping:spawn-no-group:${id}`,
        severity: 'warning',
        category: 'mapping',
        message: `Spawn "${label}" has no action group`,
        subjectId: id,
        subjectLabel: label,
        actionType: 'fix-mapping',
      })
    }

    if (DOOR_TYPES.has(type)) {
      const stateCount = def.states ? Object.keys(def.states).length : 0
      if (stateCount < 2) {
        issues.push({
          id: `mapping:door-few-states:${id}`,
          severity: 'warning',
          category: 'mapping',
          message: `Door "${label}" needs at least 2 states (has ${stateCount})`,
          subjectId: id,
          subjectLabel: label,
          actionType: 'fix-mapping',
        })
      }
    }
  }
  return issues
}

/**
 * 2. Invalid room links — entities referencing rooms not in the registry.
 */
function checkRoomLinks(
  entities: EntityData[],
  roomRegistry: RoomFileEntry[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const roomIds = new Set(roomRegistry.map((r) => r.id))

  for (const entity of entities) {
    const targetRoom = entity.properties.targetRoom as string | undefined
    if (targetRoom && targetRoom.trim().length > 0 && !roomIds.has(targetRoom.trim())) {
      issues.push({
        id: `room-link:invalid:${entity.id}`,
        severity: 'error',
        category: 'room-link',
        message: `${entity.type} "${entity.id}" references unknown room "${targetRoom}"`,
        subjectId: entity.id,
        subjectLabel: entity.id,
      })
    }
  }
  return issues
}

/**
 * 3. Collision source conflicts.
 */
function checkCollision(
  collisionConfig: CollisionSourceConfig,
  mapData: LevelData,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (collisionConfig.strategy === 'custom' && collisionConfig.linkedLayerNames.length === 0) {
    issues.push({
      id: 'collision:custom-no-layers',
      severity: 'warning',
      category: 'collision',
      message: 'Custom collision strategy has no source layers selected',
    })
  }

  if (collisionConfig.strategy === 'auto_walls') {
    const autoLayers = getAutoWallsLinkedLayers(mapData)
    if (autoLayers.length === 0) {
      issues.push({
        id: 'collision:auto-no-match',
        severity: 'info',
        category: 'collision',
        message: 'Auto-walls found no matching layers (walls, furniture, solid, etc.)',
      })
    }
  }

  return issues
}

/**
 * 4. Door/NPC link diagnostics — entity instances without required bindings.
 */
function checkEntityBindings(
  entities: EntityData[],
  entityDefs: Record<string, EntityDefinitionFile>,
  interactionDefs: Record<string, InteractionDefinitionFile>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const entityDefIds = new Set(Object.keys(entityDefs))
  const interactionDefIds = new Set(Object.keys(interactionDefs))

  for (const entity of entities) {
    // Doors should have interactionId or entityDefId binding
    if (DOOR_TYPES.has(entity.type)) {
      const intId = entity.properties.interactionId as string | undefined
      const entId = entity.properties.entityDefId as string | undefined
      if ((!intId || !intId.trim()) && (!entId || !entId.trim())) {
        issues.push({
          id: `entity:door-unbound:${entity.id}`,
          severity: 'warning',
          category: 'entity',
          message: `Door "${entity.id}" has no interaction or entity definition binding`,
          subjectId: entity.id,
          subjectLabel: entity.id,          actionType: 'open-entity',        })
      } else {
        // Check the binding actually exists
        if (intId && intId.trim() && !interactionDefIds.has(intId.trim())) {
          issues.push({
            id: `entity:door-bad-interaction:${entity.id}`,
            severity: 'error',
            category: 'entity',
            message: `Door "${entity.id}" references unknown interaction "${intId}"`,
            subjectId: entity.id,
            subjectLabel: entity.id,
            actionType: 'open-entity',
          })
        }
        if (entId && entId.trim() && !entityDefIds.has(entId.trim())) {
          issues.push({
            id: `entity:door-bad-entitydef:${entity.id}`,
            severity: 'error',
            category: 'entity',
            message: `Door "${entity.id}" references unknown entity definition "${entId}"`,
            subjectId: entity.id,
            subjectLabel: entity.id,            actionType: 'open-entity',          })
        }
      }
    }

    // NPCs should have entityDefId binding
    if (NPC_TYPES.has(entity.type)) {
      const entId = entity.properties.entityDefId as string | undefined
      if (!entId || !entId.trim()) {
        issues.push({
          id: `entity:npc-unbound:${entity.id}`,
          severity: 'warning',
          category: 'entity',
          message: `NPC "${entity.id}" has no entity definition binding`,
          subjectId: entity.id,
          subjectLabel: entity.id,
          actionType: 'open-entity',
        })
      } else if (!entityDefIds.has(entId.trim())) {
        issues.push({
          id: `entity:npc-bad-entitydef:${entity.id}`,
          severity: 'error',
          category: 'entity',
          message: `NPC "${entity.id}" references unknown entity definition "${entId}"`,
          subjectId: entity.id,
          subjectLabel: entity.id,          actionType: 'open-entity',        })
      }
    }
  }
  return issues
}

// ─── Aggregate ──────────────────────────────────────────────────────

export interface ValidationInput {
  entityDefs: Record<string, EntityDefinitionFile>
  interactionDefs: Record<string, InteractionDefinitionFile>
  actionGroups: TileActionGroup[]
  entities: EntityData[]
  roomRegistry: RoomFileEntry[]
  collisionConfig: CollisionSourceConfig
  mapData: LevelData
}

/** Run all validation checks and return a deduplicated, sorted issue list. */
export function validateProject(input: ValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...checkMappings(input.entityDefs, input.actionGroups),
    ...checkRoomLinks(input.entities, input.roomRegistry),
    ...checkCollision(input.collisionConfig, input.mapData),
    ...checkEntityBindings(input.entities, input.entityDefs, input.interactionDefs),
  ]

  // Sort: errors first, then warnings, then info
  const severityOrder: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  return issues
}

/** Group issues by category. */
export function groupByCategory(issues: ValidationIssue[]): Map<ValidationCategory, ValidationIssue[]> {
  const map = new Map<ValidationCategory, ValidationIssue[]>()
  for (const issue of issues) {
    const arr = map.get(issue.category)
    if (arr) arr.push(issue)
    else map.set(issue.category, [issue])
  }
  return map
}
