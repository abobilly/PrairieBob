/**
 * ValidationPanel — standalone project-wide diagnostics panel.
 *
 * Aggregates: missing mappings, invalid room links, collision conflicts,
 * door/NPC binding issues. Grouped by category with severity icons.
 */

import { useMemo, useState } from 'react'
import { WarningCircle, XCircle, Info, CaretDown, CaretRight, FunnelSimple, ArrowSquareOut, PencilSimple, Wrench } from '@phosphor-icons/react'
import type { EntityData, EntityDefinitionFile, InteractionDefinitionFile, LevelData, TileActionGroup } from '@/lib/types'
import type { CollisionSourceConfig } from '@/lib/collision-model'
import type { RoomFileEntry } from '@/stores/projectStore'
import {
  validateProject,
  groupByCategory,
  type ValidationIssue,
  type ValidationCategory,
  type ValidationSeverity,
} from '@/lib/validation'

// ─── Constants ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  mapping: 'State / Mapping',
  'room-link': 'Room Links',
  collision: 'Collision',
  entity: 'Entity Bindings',
}

const CATEGORY_ORDER: ValidationCategory[] = ['entity', 'room-link', 'mapping', 'collision']

function SeverityIcon({ severity, size = 12 }: { severity: ValidationSeverity; size?: number }) {
  switch (severity) {
    case 'error':
      return <XCircle size={size} weight="fill" className="text-[var(--pb-error,#ef4444)]" />
    case 'warning':
      return <WarningCircle size={size} weight="fill" className="text-[var(--pb-warning,#f59e0b)]" />
    case 'info':
      return <Info size={size} weight="fill" className="text-[var(--pb-text-muted)]" />
  }
}

// ─── Props ───────────────────────────────────────────────────────────

interface ValidationPanelProps {
  entityDefs: Record<string, EntityDefinitionFile>
  interactionDefs: Record<string, InteractionDefinitionFile>
  actionGroups: TileActionGroup[]
  entities: EntityData[]
  roomRegistry: RoomFileEntry[]
  collisionConfig: CollisionSourceConfig
  mapData: LevelData
  /** Called when user clicks an issue with a subjectId (entity jump). */
  onJumpToEntity?: (entityId: string) => void
  /** Called when user clicks "Fix Mapping" on a mapping issue. */
  onFixMapping?: (entityId: string) => void
}

// ─── Component ───────────────────────────────────────────────────────

export function ValidationPanel({
  entityDefs,
  interactionDefs,
  actionGroups,
  entities,
  roomRegistry,
  collisionConfig,
  mapData,
  onJumpToEntity,
  onFixMapping,
}: ValidationPanelProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ValidationCategory>>(new Set())
  const [filterSeverity, setFilterSeverity] = useState<ValidationSeverity | 'all'>('all')

  const issues = useMemo(
    () =>
      validateProject({
        entityDefs,
        interactionDefs,
        actionGroups,
        entities,
        roomRegistry,
        collisionConfig,
        mapData,
      }),
    [entityDefs, interactionDefs, actionGroups, entities, roomRegistry, collisionConfig, mapData],
  )

  const filtered = useMemo(
    () => (filterSeverity === 'all' ? issues : issues.filter((i) => i.severity === filterSeverity)),
    [issues, filterSeverity],
  )

  const grouped = useMemo(() => groupByCategory(filtered), [filtered])

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warnCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  const toggleCategory = (cat: ValidationCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-4 text-[var(--pb-text-muted)]">
        <Info size={20} />
        <span className="text-[10px]">No issues found</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {/* Summary + Filter row */}
      <div className="flex items-center gap-2 text-[9px]">
        {/* Counts */}
        <span className="flex items-center gap-0.5">
          <XCircle size={10} weight="fill" className="text-[var(--pb-error,#ef4444)]" />
          <span className="text-[var(--pb-text-secondary)]">{errorCount}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <WarningCircle size={10} weight="fill" className="text-[var(--pb-warning,#f59e0b)]" />
          <span className="text-[var(--pb-text-secondary)]">{warnCount}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <Info size={10} weight="fill" className="text-[var(--pb-text-muted)]" />
          <span className="text-[var(--pb-text-secondary)]">{infoCount}</span>
        </span>

        {/* Filter */}
        <span className="ml-auto flex items-center gap-1">
          <FunnelSimple size={10} className="text-[var(--pb-text-muted)]" />
          <select
            className="bg-transparent text-[9px] text-[var(--pb-text-secondary)] outline-none cursor-pointer"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as ValidationSeverity | 'all')}
          >
            <option value="all">All</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
        </span>
      </div>

      {/* Category groups */}
      {CATEGORY_ORDER.map((category) => {
        const catIssues = grouped.get(category)
        if (!catIssues || catIssues.length === 0) return null
        const isCollapsed = collapsedCategories.has(category)

        return (
          <div
            key={category}
            className="rounded border border-[var(--pb-border-subtle)] overflow-hidden"
          >
            {/* Category header */}
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-2 py-1 bg-[var(--pb-bg-header)] hover:bg-[var(--pb-bg-hover)] transition-colors"
              onClick={() => toggleCategory(category)}
            >
              {isCollapsed
                ? <CaretRight size={10} className="text-[var(--pb-text-muted)]" />
                : <CaretDown size={10} className="text-[var(--pb-text-muted)]" />}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pb-text-primary)]">
                {CATEGORY_LABELS[category]}
              </span>
              <span className="ml-auto text-[9px] text-[var(--pb-text-muted)]">
                {catIssues.length}
              </span>
            </button>

            {/* Issue list */}
            {!isCollapsed && (
              <div className="flex flex-col">
                {catIssues.map((issue) => {
                  const canJump = !!issue.subjectId && !!onJumpToEntity
                  const canFixMapping = issue.actionType === 'fix-mapping' && !!issue.subjectId && !!onFixMapping
                  const canOpenEntity = issue.actionType === 'open-entity' && !!issue.subjectId && !!onJumpToEntity
                  const hasAction = canJump || canFixMapping || canOpenEntity
                  return (
                    <div
                      key={issue.id}
                      className={`flex items-start gap-1.5 px-2 py-1 border-t border-[var(--pb-border-subtle)] text-[10px] leading-tight ${
                        hasAction ? 'cursor-pointer hover:bg-[var(--pb-bg-hover)] transition-colors' : ''
                      }`}
                    >
                      <span className="mt-px shrink-0">
                        <SeverityIcon severity={issue.severity} size={11} />
                      </span>
                      <span className="text-[var(--pb-text-secondary)] flex-1">{issue.message}</span>
                      {/* Action buttons */}
                      <span className="ml-auto flex items-center gap-1 shrink-0">
                        {canOpenEntity && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium bg-[var(--pb-bg-active)] hover:bg-[var(--pb-accent)] hover:text-white transition-colors text-[var(--pb-text-secondary)]"
                            onClick={() => onJumpToEntity!(issue.subjectId!)}
                            title={`Open entity "${issue.subjectLabel ?? issue.subjectId}"`}
                          >
                            <PencilSimple size={8} />
                            Open
                          </button>
                        )}
                        {canFixMapping && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium bg-[var(--pb-bg-active)] hover:bg-[var(--pb-accent)] hover:text-white transition-colors text-[var(--pb-text-secondary)]"
                            onClick={() => onFixMapping!(issue.subjectId!)}
                            title={`Fix mapping for "${issue.subjectLabel ?? issue.subjectId}"`}
                          >
                            <Wrench size={8} />
                            Fix
                          </button>
                        )}
                        {canJump && !canOpenEntity && (
                          <ArrowSquareOut
                            size={9}
                            className="mt-0.5 text-[var(--pb-text-muted)] cursor-pointer"
                            onClick={() => onJumpToEntity!(issue.subjectId!)}
                          />
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
