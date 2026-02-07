/**
 * BehaviorEditor — Phase 5 Entity Behavior Editor
 *
 * Renders state graph, movement timeline, trigger list, and direction sets
 * for the selected entity's definition and/or interaction definition.
 * Displayed in the PropertiesPanel "preview" tab.
 */

import { useMemo } from 'react'
import {
  Lightning,
  ArrowsClockwise,
  Path,
  Timer,
  Play,
  Pause,
  ArrowsOutCardinal,
  Compass,
  Cube,
  FilmStrip,
} from '@phosphor-icons/react'

import type { EntityData, EntityDefinitionFile, InteractionDefinitionFile } from '@/lib/types'
import {
  buildEntityGraph,
  buildInteractionGraph,
  extractMovementTimeline,
  extractBehaviorTriggers,
  classifyDirectionSets,
} from '@/lib/behavior-graph'
import type { BehaviorGraph, MovementTimeline, BehaviorTrigger, DirectionSet } from '@/lib/behavior-graph'
import { StateGraph } from '@/components/StateGraph'

// ─── Sub-section header ─────────────────────────────────────────────

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-1 pb-0.5">
      <Icon size={12} className="text-[var(--pb-text-muted)]" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--pb-text-muted)]">
        {label}
      </span>
    </div>
  )
}

// ─── Movement Timeline Section ──────────────────────────────────────

function MovementSection({ timeline }: { timeline: MovementTimeline }) {
  const modeLabel = timeline.mode === 'wander' ? 'Wander' : timeline.mode === 'patrol' ? 'Patrol' : 'Idle'
  const ModeIcon = timeline.mode === 'wander' ? ArrowsClockwise : timeline.mode === 'patrol' ? Path : Pause

  return (
    <div className="space-y-1">
      <SectionHeader icon={ArrowsOutCardinal} label="Movement" />
      <div className="rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ModeIcon size={14} className={timeline.enabled ? 'text-emerald-400' : 'text-[var(--pb-text-muted)]'} />
            <span className="text-xs font-medium">{modeLabel}</span>
            {timeline.enabled ? (
              <Play size={10} weight="fill" className="text-emerald-400" />
            ) : (
              <Pause size={10} weight="fill" className="text-[var(--pb-text-muted)]" />
            )}
          </div>
          <span className="font-mono text-[10px] text-[var(--pb-text-muted)]">
            {timeline.speedTilesPerSecond.toFixed(1)} t/s
          </span>
        </div>
        {timeline.enabled && timeline.mode === 'wander' && (
          <div className="mt-1 text-[10px] text-[var(--pb-text-muted)]">
            <Timer size={10} className="inline mr-0.5 -mt-px" />
            Direction change every {timeline.changeDirectionMs}ms
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Trigger List Section ───────────────────────────────────────────

function TriggerSection({ triggers }: { triggers: BehaviorTrigger[] }) {
  if (triggers.length === 0) return null

  return (
    <div className="space-y-1">
      <SectionHeader icon={Lightning} label="Triggers" />
      <div className="space-y-1">
        {triggers.map((trigger, i) => (
          <div
            key={`${trigger.event}-${i}`}
            className="flex items-center gap-2 rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1"
          >
            <Lightning
              size={12}
              weight="fill"
              className={trigger.event === 'onLoad' ? 'text-blue-400' : 'text-amber-400'}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pb-text-muted)]">
              {trigger.event === 'onLoad' ? 'Load' : 'Interact'}
            </span>
            <span className="text-xs font-mono">→ {trigger.action}</span>
            {trigger.animation && (
              <span className="ml-auto text-[10px] text-emerald-400">
                <FilmStrip size={10} className="inline mr-0.5 -mt-px" />
                anim
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Direction Sets Section ─────────────────────────────────────────

function DirectionSetSection({ sets }: { sets: DirectionSet[] }) {
  if (sets.length === 0) return null

  return (
    <div className="space-y-1">
      <SectionHeader icon={Compass} label="Direction Sets" />
      <div className="grid grid-cols-2 gap-1">
        {sets.map((set) => (
          <div
            key={set.action}
            className="rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1"
          >
            <span className="text-xs font-mono font-medium">{set.action}</span>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {set.directions.map((dir) => (
                <span
                  key={dir}
                  className="rounded bg-[var(--pb-bg-hover)] px-1 py-px text-[9px] font-mono text-[var(--pb-text-muted)]"
                >
                  {dir}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── State Details Section ──────────────────────────────────────────

function StateDetailsSection({ graph }: { graph: BehaviorGraph }) {
  const stateNodes = graph.nodes.filter((n) => n.id.startsWith('state:'))
  const animNodes = graph.nodes.filter((n) => n.id.startsWith('anim:'))

  if (stateNodes.length === 0 && animNodes.length === 0) return null

  return (
    <div className="space-y-1">
      <SectionHeader icon={Cube} label="State Details" />
      <div className="space-y-1">
        {stateNodes.map((node) => (
          <div
            key={node.id}
            className="flex items-center justify-between rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1"
          >
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: node.isDefault ? 'var(--pb-accent, #3b82f6)' : 'var(--pb-text-muted)' }}
              />
              <span className="text-xs font-mono">{node.label}</span>
              {node.isDefault && (
                <span className="text-[9px] text-[var(--pb-accent)]">default</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--pb-text-muted)]">
              {node.tileId != null && <span>tile #{node.tileId}</span>}
              {node.collision && <span className="text-amber-400">■ solid</span>}
            </div>
          </div>
        ))}
        {animNodes.map((node) => (
          <div
            key={node.id}
            className="flex items-center justify-between rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1"
          >
            <div className="flex items-center gap-1.5">
              <FilmStrip size={10} className={node.isDefault ? 'text-[var(--pb-accent)]' : 'text-[var(--pb-text-muted)]'} />
              <span className="text-xs font-mono">{node.label}</span>
              {node.isDefault && (
                <span className="text-[9px] text-[var(--pb-accent)]">default</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--pb-text-muted)]">
              {node.frames && <span>{node.frames.length}f</span>}
              {node.fps && <span>{node.fps}fps</span>}
              {node.loop === false && <span className="text-amber-400">once</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────

interface BehaviorEditorProps {
  selectedEntity: EntityData | null
  entityDefinitions?: Record<string, EntityDefinitionFile>
  interactionDefinitions?: Record<string, InteractionDefinitionFile>
}

export function BehaviorEditor({
  selectedEntity,
  entityDefinitions,
  interactionDefinitions,
}: BehaviorEditorProps) {
  // Resolve the entity's definition file
  const entityDefId = (selectedEntity?.properties?.entityDefId as string) || ''
  const interactionId = (selectedEntity?.properties?.interactionId as string) || ''

  const entityDef = entityDefId && entityDefinitions ? entityDefinitions[entityDefId] : null
  const interactionDef = interactionId && interactionDefinitions ? interactionDefinitions[interactionId] : null

  // Build graphs
  const entityGraph = useMemo<BehaviorGraph | null>(
    () => (entityDef ? buildEntityGraph(entityDef) : null),
    [entityDef],
  )
  const interactionGraph = useMemo<BehaviorGraph | null>(
    () => (interactionDef ? buildInteractionGraph(interactionDef) : null),
    [interactionDef],
  )

  // Prefer interaction graph (more detailed), fall back to entity graph
  const primaryGraph = interactionGraph ?? entityGraph

  // Extract movement timeline
  const timeline = useMemo<MovementTimeline | null>(
    () => (entityDef ? extractMovementTimeline(entityDef) : null),
    [entityDef],
  )

  // Extract triggers
  const triggers = useMemo<BehaviorTrigger[]>(
    () => (entityDef ? extractBehaviorTriggers(entityDef) : []),
    [entityDef],
  )

  // Extract direction sets
  const directionSets = useMemo<DirectionSet[]>(
    () => (entityDef?.animations ? classifyDirectionSets(entityDef.animations) : []),
    [entityDef],
  )

  // ─── Empty state ────────────────────────────────────

  if (!selectedEntity) {
    return (
      <div className="px-3 py-3">
        <p className="text-sm text-[var(--pb-text-muted)]">Select an entity to preview behavior</p>
      </div>
    )
  }

  if (!entityDef && !interactionDef) {
    return (
      <div className="px-3 py-3 space-y-2">
        <p className="text-sm text-[var(--pb-text-muted)]">
          No definition bound to this entity.
        </p>
        <p className="text-[10px] text-[var(--pb-text-muted)]">
          Set <span className="font-mono">entityDefId</span> or{' '}
          <span className="font-mono">interactionId</span> in the Bindings tab to enable behavior preview.
        </p>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────

  const hasAnyContent = primaryGraph || timeline || triggers.length > 0 || directionSets.length > 0

  return (
    <div className="px-3 py-3 space-y-3 text-[var(--pb-text-primary)]">
      {/* Definition header */}
      <div className="flex items-center gap-2 rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1">
        <Cube size={12} className="text-[var(--pb-accent)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pb-text-muted)]">
          {interactionDef ? 'Interaction' : 'Entity'} Def
        </span>
        <span className="text-xs font-mono ml-auto">
          {interactionDef?.id ?? entityDef?.id}
        </span>
      </div>

      {/* State Graph SVG */}
      {primaryGraph && primaryGraph.nodes.length > 0 && (
        <div className="space-y-1">
          <SectionHeader
            icon={ArrowsClockwise}
            label={`State Graph (${primaryGraph.nodes.length} states, ${primaryGraph.edges.length} transitions)`}
          />
          <div className="rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] p-1">
            <StateGraph graph={primaryGraph} />
          </div>
        </div>
      )}

      {/* State details table */}
      {primaryGraph && <StateDetailsSection graph={primaryGraph} />}

      {/* Movement timeline */}
      {timeline && <MovementSection timeline={timeline} />}

      {/* Triggers */}
      <TriggerSection triggers={triggers} />

      {/* Direction sets */}
      <DirectionSetSection sets={directionSets} />

      {/* Fallback for completely empty */}
      {!hasAnyContent && (
        <p className="text-[10px] text-[var(--pb-text-muted)]">
          Definition loaded but contains no behavior data.
        </p>
      )}
    </div>
  )
}
