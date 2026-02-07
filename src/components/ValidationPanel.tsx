/**
 * ValidationPanel — standalone project-wide diagnostics panel.
 *
 * Aggregates: missing mappings, invalid room links, collision conflicts,
 * door/NPC binding issues. Grouped by category with severity icons.
 */

import { useMemo, useState } from 'react'
import { WarningCircle, XCircle, Info, CaretDown, CaretRight, FunnelSimple } from '@phosphor-icons/react'
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
                {catIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start gap-1.5 px-2 py-1 border-t border-[var(--pb-border-subtle)] text-[10px] leading-tight"
                  >
                    <span className="mt-px shrink-0">
                      <SeverityIcon severity={issue.severity} size={11} />
                    </span>
                    <span className="text-[var(--pb-text-secondary)]">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
