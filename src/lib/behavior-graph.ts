/**
 * Behavior Graph Model
 *
 * Converts entity and interaction definitions into a graph of
 * state nodes and transition edges for visualization and editing.
 */

import type {
  EntityDefinitionFile,
  EntityDefinitionAnimation,
  InteractionDefinitionFile,
} from './types'

// ─── Graph Types ────────────────────────────────────────────────────

export interface BehaviorNode {
  id: string
  label: string
  isDefault: boolean
  /** Tile ID for preview (entity states). */
  tileId?: number
  /** Whether this state blocks collision. */
  collision?: boolean
  /** Animation frames (entity animations). */
  frames?: number[]
  fps?: number
  loop?: boolean
}

export interface BehaviorEdge {
  id: string
  from: string
  to: string
  label: string
  /** Transition duration in ms (interaction transitions). */
  durationMs?: number
  /** Trigger type: what causes this transition. */
  trigger?: 'onInteract' | 'onLoad' | 'timer' | 'manual'
}

export interface BehaviorGraph {
  nodes: BehaviorNode[]
  edges: BehaviorEdge[]
  /** Source definition type. */
  sourceType: 'entity' | 'interaction'
  sourceId: string
}

// ─── Timeline Types ─────────────────────────────────────────────────

export interface MovementTimeline {
  mode: 'wander' | 'idle' | 'patrol'
  speedTilesPerSecond: number
  changeDirectionMs: number
  enabled: boolean
}

export interface BehaviorTrigger {
  event: 'onLoad' | 'onInteract'
  action: string
  /** Resolved animation name, if the action maps to an animation. */
  animation?: string
}

// ─── Graph Builders ─────────────────────────────────────────────────

/**
 * Build a behavior graph from an entity definition.
 * Entity defs can have states (door-like) and/or animations (NPC-like).
 */
export function buildEntityGraph(def: EntityDefinitionFile): BehaviorGraph {
  const nodes: BehaviorNode[] = []
  const edges: BehaviorEdge[] = []

  // Build nodes from states (door/switch entities)
  if (def.states && Object.keys(def.states).length > 0) {
    for (const [name, state] of Object.entries(def.states)) {
      nodes.push({
        id: `state:${name}`,
        label: name,
        isDefault: name === def.defaultState,
        tileId: state.tileId,
        collision: state.collision,
      })
    }

    // Infer edges from trigger config
    if (def.triggers?.onInteract === 'toggle' && nodes.length === 2) {
      const [a, b] = nodes
      edges.push({
        id: `edge:${a.id}→${b.id}`,
        from: a.id,
        to: b.id,
        label: 'interact',
        trigger: 'onInteract',
      })
      edges.push({
        id: `edge:${b.id}→${a.id}`,
        from: b.id,
        to: a.id,
        label: 'interact',
        trigger: 'onInteract',
      })
    } else if (def.triggers?.onInteract) {
      // Single transition to a named state
      const targetState = `state:${def.triggers.onInteract}`
      const defaultNode = nodes.find((n) => n.isDefault)
      if (defaultNode && nodes.some((n) => n.id === targetState)) {
        edges.push({
          id: `edge:${defaultNode.id}→${targetState}`,
          from: defaultNode.id,
          to: targetState,
          label: 'interact',
          trigger: 'onInteract',
        })
      }
    }
  }

  // Build nodes from animations (NPC/player entities)
  if (def.animations && Object.keys(def.animations).length > 0) {
    for (const [name, anim] of Object.entries(def.animations)) {
      // Skip if we already have state nodes (states take precedence for graph)
      if (nodes.some((n) => n.id === `state:${name}`)) continue
      nodes.push({
        id: `anim:${name}`,
        label: name,
        isDefault: name === def.defaultAnimation,
        frames: anim.frames,
        fps: anim.fps,
        loop: anim.loop,
      })
    }

    // Infer animation transitions from behavior config
    if (def.behavior) {
      const defaultAnimNode = nodes.find((n) => n.isDefault && n.id.startsWith('anim:'))
      if (def.behavior.onInteract && defaultAnimNode) {
        const targetId = `anim:${def.behavior.onInteract}`
        if (nodes.some((n) => n.id === targetId)) {
          edges.push({
            id: `edge:${defaultAnimNode.id}→${targetId}`,
            from: defaultAnimNode.id,
            to: targetId,
            label: 'interact',
            trigger: 'onInteract',
          })
        }
      }
    }
  }

  return {
    nodes,
    edges,
    sourceType: 'entity',
    sourceId: def.id,
  }
}

/**
 * Build a behavior graph from an interaction definition.
 * Interactions always have states + optional transitions with durations.
 */
export function buildInteractionGraph(def: InteractionDefinitionFile): BehaviorGraph {
  const nodes: BehaviorNode[] = []
  const edges: BehaviorEdge[] = []

  for (const name of Object.keys(def.states)) {
    const state = def.states[name]
    nodes.push({
      id: `state:${name}`,
      label: name,
      isDefault: name === def.defaultState,
      collision: state.collision,
    })
  }

  // Build edges from transitions (e.g. "closed→open": { duration: 150 })
  if (def.transitions) {
    for (const [key, transition] of Object.entries(def.transitions)) {
      const parts = key.split('→')
      if (parts.length === 2) {
        const fromId = `state:${parts[0]}`
        const toId = `state:${parts[1]}`
        if (nodes.some((n) => n.id === fromId) && nodes.some((n) => n.id === toId)) {
          edges.push({
            id: `edge:${fromId}→${toId}`,
            from: fromId,
            to: toId,
            label: `${transition.duration}ms`,
            durationMs: transition.duration,
            trigger: 'onInteract',
          })
        }
      }
    }
  }

  // If no explicit transitions, infer toggle for 2-state interactions
  if (edges.length === 0 && nodes.length === 2) {
    const [a, b] = nodes
    edges.push(
      { id: `edge:${a.id}→${b.id}`, from: a.id, to: b.id, label: 'interact', trigger: 'onInteract' },
      { id: `edge:${b.id}→${a.id}`, from: b.id, to: a.id, label: 'interact', trigger: 'onInteract' },
    )
  }

  return {
    nodes,
    edges,
    sourceType: 'interaction',
    sourceId: def.id,
  }
}

/**
 * Extract movement timeline from an entity definition's behavior block.
 */
export function extractMovementTimeline(def: EntityDefinitionFile): MovementTimeline | null {
  if (!def.behavior) return null
  const wander = def.behavior.wander
  if (!wander) {
    return {
      mode: def.behavior.onLoad === 'wander' ? 'wander' : 'idle',
      speedTilesPerSecond: 2.0,
      changeDirectionMs: 1200,
      enabled: def.behavior.onLoad === 'wander',
    }
  }
  return {
    mode: wander.enabled ? 'wander' : 'idle',
    speedTilesPerSecond: wander.speedTilesPerSecond ?? 2.0,
    changeDirectionMs: wander.changeDirectionMs ?? 1200,
    enabled: wander.enabled ?? false,
  }
}

/**
 * Extract behavior triggers from an entity definition.
 */
export function extractBehaviorTriggers(def: EntityDefinitionFile): BehaviorTrigger[] {
  const triggers: BehaviorTrigger[] = []

  if (def.triggers?.onLoad) {
    triggers.push({
      event: 'onLoad',
      action: def.triggers.onLoad,
      animation: def.animations?.[def.triggers.onLoad] ? def.triggers.onLoad : undefined,
    })
  } else if (def.behavior?.onLoad) {
    triggers.push({
      event: 'onLoad',
      action: def.behavior.onLoad,
      animation: def.animations?.[def.behavior.onLoad] ? def.behavior.onLoad : undefined,
    })
  }

  if (def.triggers?.onInteract) {
    triggers.push({
      event: 'onInteract',
      action: def.triggers.onInteract,
      animation: def.animations?.[def.triggers.onInteract] ? def.triggers.onInteract : undefined,
    })
  } else if (def.behavior?.onInteract) {
    triggers.push({
      event: 'onInteract',
      action: def.behavior.onInteract,
      animation: def.animations?.[def.behavior.onInteract] ? def.behavior.onInteract : undefined,
    })
  }

  return triggers
}

/**
 * Classify direction-based animation groups.
 * Detects patterns like `idle_down`, `walk_left`, `idle_up`, etc.
 */
export interface DirectionSet {
  action: string         // e.g. "idle", "walk"
  directions: string[]   // e.g. ["down", "left", "right", "up"]
  animations: Record<string, EntityDefinitionAnimation>
}

const DIRECTION_PATTERN = /^(.+)_(up|down|left|right)$/

export function classifyDirectionSets(
  animations: Record<string, EntityDefinitionAnimation>,
): DirectionSet[] {
  const groups = new Map<string, { directions: string[]; animations: Record<string, EntityDefinitionAnimation> }>()

  for (const [name, anim] of Object.entries(animations)) {
    const match = DIRECTION_PATTERN.exec(name)
    if (match) {
      const action = match[1]
      const direction = match[2]
      const existing = groups.get(action) ?? { directions: [], animations: {} }
      existing.directions.push(direction)
      existing.animations[name] = anim
      groups.set(action, existing)
    }
  }

  return Array.from(groups.entries()).map(([action, data]) => ({
    action,
    directions: data.directions.sort(),
    animations: data.animations,
  }))
}
