/**
 * AutoRulesPanel - Rule group & rule editor for AutoLayer / IntGrid layers
 * Task 4F.5 (T4-04)
 *
 * Features:
 * - Rule groups with expand/collapse, active toggle, reorder
 * - Rules within groups: pattern editor, tile IDs, chance, breakOnMatch, flip
 * - Add/delete/reorder rules and groups
 */

import { useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  CaretDown,
  CaretRight,
  Eye,
  EyeSlash,
  Copy,
} from '@phosphor-icons/react'
import { RulePatternEditor } from '@/components/RulePatternEditor'
import type {
  LayerDef,
  AutoLayerRuleGroupDef,
  AutoLayerRuleDef,
} from '@/lib/ldtk/types'
import type { Project } from '@/lib/ldtk/project'
import { useProjectStore } from '@/stores'

// ============== Defaults ==============

function createDefaultRule(project: Project): AutoLayerRuleDef {
  return {
    uid: project.nextUid++,
    active: true,
    size: 3,
    pattern: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    tileRectsIds: [],
    alpha: 1,
    chance: 1,
    breakOnMatch: true,
    flipX: false,
    flipY: false,
    xModulo: 1,
    yModulo: 1,
    xOffset: 0,
    yOffset: 0,
    tileXOffset: 0,
    tileYOffset: 0,
    tileRandomXMin: 0,
    tileRandomXMax: 0,
    tileRandomYMin: 0,
    tileRandomYMax: 0,
    checker: 'None',
    tileMode: 'Single',
    pivotX: 0,
    pivotY: 0,
    outOfBoundsValue: null,
    perlinActive: false,
    perlinSeed: 0,
    perlinScale: 0.2,
    perlinOctaves: 2,
    invalidated: false,
  }
}

function createDefaultRuleGroup(project: Project): AutoLayerRuleGroupDef {
  return {
    uid: project.nextUid++,
    name: 'New Group',
    color: null,
    icon: null,
    active: true,
    collapsed: false,
    isOptional: false,
    usesWizard: false,
    requiredBiomeValues: [],
    biomeRequirementMode: 'And',
    rules: [],
  }
}

// ============== Rule Editor Row ==============

function RuleRow({
  rule,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  rule: AutoLayerRuleDef
  onUpdate: (updated: AutoLayerRuleDef) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded border bg-[var(--pb-bg-input)]',
        rule.active ? 'border-[var(--pb-border)]' : 'border-[var(--pb-border)] opacity-50',
      )}
    >
      {/* Rule header */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--pb-text-muted)] hover:text-[var(--pb-text)]"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <CaretDown className="h-3.5 w-3.5" /> : <CaretRight className="h-3.5 w-3.5" />}
        </button>

        {/* Pattern preview (inline tiny view) */}
        <div className="flex items-center gap-2">
          <RulePatternEditor
            rule={rule}
            onChange={(pattern) => onUpdate({ ...rule, pattern })}
          />
        </div>

        <div className="flex flex-1 flex-col px-2">
          <span className="text-xs text-[var(--pb-text)]">
            {Math.round(rule.chance * 100)}% chance
            {rule.breakOnMatch ? ' · break' : ''}
            {rule.flipX ? ' · flipX' : ''}
            {rule.flipY ? ' · flipY' : ''}
          </span>
          <span className="text-[10px] text-[var(--pb-text-muted)]">
            Tiles: {rule.tileRectsIds.length === 0 ? 'none' : rule.tileRectsIds.length}
          </span>
        </div>

        {/* Buttons */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdate({ ...rule, active: !rule.active })}
          className="h-6 w-6 p-0"
          title={rule.active ? 'Disable' : 'Enable'}
        >
          {rule.active ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeSlash className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveUp}
          disabled={isFirst}
          className="h-6 w-6 p-0"
          title="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveDown}
          disabled={isLast}
          className="h-6 w-6 p-0"
          title="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-6 w-6 p-0 text-[var(--pb-text-muted)] hover:text-[var(--pb-error)]"
          title="Delete rule"
        >
          <Trash className="h-3 w-3" />
        </Button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[var(--pb-border)] p-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Chance */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">
                Chance ({Math.round(rule.chance * 100)}%)
              </Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={rule.chance}
                onChange={(e) => onUpdate({ ...rule, chance: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Alpha */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">
                Alpha ({Math.round(rule.alpha * 100)}%)
              </Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={rule.alpha}
                onChange={(e) => onUpdate({ ...rule, alpha: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Break on match */}
            <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
              <input
                type="checkbox"
                checked={rule.breakOnMatch}
                onChange={(e) => onUpdate({ ...rule, breakOnMatch: e.target.checked })}
              />
              Break on match
            </label>

            {/* Flip X/Y */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
                <input
                  type="checkbox"
                  checked={rule.flipX}
                  onChange={(e) => onUpdate({ ...rule, flipX: e.target.checked })}
                />
                Flip X
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
                <input
                  type="checkbox"
                  checked={rule.flipY}
                  onChange={(e) => onUpdate({ ...rule, flipY: e.target.checked })}
                />
                Flip Y
              </label>
            </div>

            {/* Checker mode */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">Checker</Label>
              <select
                value={rule.checker}
                onChange={(e) =>
                  onUpdate({ ...rule, checker: e.target.value as AutoLayerRuleDef['checker'] })
                }
                className="h-7 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] px-2 text-xs text-[var(--pb-text)]"
              >
                <option value="None">None</option>
                <option value="Horizontal">Horizontal</option>
                <option value="Vertical">Vertical</option>
              </select>
            </div>

            {/* Tile mode */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">Tile Mode</Label>
              <select
                value={rule.tileMode}
                onChange={(e) =>
                  onUpdate({ ...rule, tileMode: e.target.value as AutoLayerRuleDef['tileMode'] })
                }
                className="h-7 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] px-2 text-xs text-[var(--pb-text)]"
              >
                <option value="Single">Single</option>
                <option value="Stamp">Stamp</option>
              </select>
            </div>

            {/* Modulo X/Y */}
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">X Modulo</Label>
              <Input
                type="number"
                value={rule.xModulo}
                onChange={(e) =>
                  onUpdate({ ...rule, xModulo: Math.max(1, parseInt(e.target.value) || 1) })
                }
                min={1}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">Y Modulo</Label>
              <Input
                type="number"
                value={rule.yModulo}
                onChange={(e) =>
                  onUpdate({ ...rule, yModulo: Math.max(1, parseInt(e.target.value) || 1) })
                }
                min={1}
                className="h-7 text-xs"
              />
            </div>

            {/* Perlin */}
            <div className="col-span-2 border-t border-[var(--pb-border)] pt-2">
              <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
                <input
                  type="checkbox"
                  checked={rule.perlinActive}
                  onChange={(e) => onUpdate({ ...rule, perlinActive: e.target.checked })}
                />
                Perlin noise
              </label>
              {rule.perlinActive && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-[var(--pb-text-muted)]">Seed</Label>
                    <Input
                      type="number"
                      value={rule.perlinSeed}
                      onChange={(e) =>
                        onUpdate({ ...rule, perlinSeed: parseInt(e.target.value) || 0 })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-[var(--pb-text-muted)]">Scale</Label>
                    <Input
                      type="number"
                      value={rule.perlinScale}
                      onChange={(e) =>
                        onUpdate({ ...rule, perlinScale: parseFloat(e.target.value) || 0.2 })
                      }
                      step={0.05}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-[var(--pb-text-muted)]">Octaves</Label>
                    <Input
                      type="number"
                      value={rule.perlinOctaves}
                      onChange={(e) =>
                        onUpdate({ ...rule, perlinOctaves: Math.max(1, parseInt(e.target.value) || 2) })
                      }
                      min={1}
                      max={8}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tile rect IDs (readonly display for now; full tile picker is beyond T4-04 scope) */}
            <div className="col-span-2 border-t border-[var(--pb-border)] pt-2">
              <Label className="text-[10px] text-[var(--pb-text-muted)]">
                Tile IDs ({rule.tileRectsIds.length})
              </Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {rule.tileRectsIds.length === 0 ? (
                  <span className="text-[10px] italic text-[var(--pb-text-muted)]">
                    No tiles assigned
                  </span>
                ) : (
                  rule.tileRectsIds.map((rect, i) => (
                    <span
                      key={i}
                      className="rounded bg-[var(--pb-bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--pb-text)]"
                    >
                      [{rect.join(',')}]
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============== Rule Group ==============

function RuleGroupCard({
  group,
  project,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  group: AutoLayerRuleGroupDef
  project: Project
  onUpdate: (updated: AutoLayerRuleGroupDef) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)

  // Rule helpers
  const addRule = useCallback(() => {
    onUpdate({ ...group, rules: [...group.rules, createDefaultRule(project)] })
  }, [group, project, onUpdate])

  const updateRule = useCallback(
    (ruleIndex: number, updated: AutoLayerRuleDef) => {
      const rules = [...group.rules]
      rules[ruleIndex] = updated
      onUpdate({ ...group, rules })
    },
    [group, onUpdate],
  )

  const deleteRule = useCallback(
    (ruleIndex: number) => {
      onUpdate({ ...group, rules: group.rules.filter((_, i) => i !== ruleIndex) })
    },
    [group, onUpdate],
  )

  const moveRule = useCallback(
    (ruleIndex: number, direction: -1 | 1) => {
      const rules = [...group.rules]
      const targetIndex = ruleIndex + direction
      if (targetIndex < 0 || targetIndex >= rules.length) return
      ;[rules[ruleIndex], rules[targetIndex]] = [rules[targetIndex], rules[ruleIndex]]
      onUpdate({ ...group, rules })
    },
    [group, onUpdate],
  )

  return (
    <div className="rounded-lg border border-[var(--pb-border)] bg-[var(--pb-bg-panel)]">
      {/* Group header */}
      <div className="flex items-center gap-1 px-3 py-2">
        <button
          onClick={() => onUpdate({ ...group, collapsed: !group.collapsed })}
          className="text-[var(--pb-text-muted)] hover:text-[var(--pb-text)]"
          title={group.collapsed ? 'Expand group' : 'Collapse group'}
        >
          {group.collapsed ? (
            <CaretRight className="h-4 w-4" />
          ) : (
            <CaretDown className="h-4 w-4" />
          )}
        </button>

        {editing ? (
          <Input
            value={group.name}
            onChange={(e) => onUpdate({ ...group, name: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            autoFocus
            className="h-6 flex-1 text-xs"
          />
        ) : (
          <span
            onDoubleClick={() => setEditing(true)}
            className={cn(
              'flex-1 cursor-pointer truncate text-sm',
              group.active ? 'text-[var(--pb-text)]' : 'text-[var(--pb-text-muted)] line-through',
            )}
            title="Double-click to rename"
          >
            {group.name}
          </span>
        )}

        <span className="mr-1 text-[10px] text-[var(--pb-text-muted)]">
          {group.rules.length} rule{group.rules.length !== 1 ? 's' : ''}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdate({ ...group, active: !group.active })}
          className="h-6 w-6 p-0"
          title={group.active ? 'Disable group' : 'Enable group'}
        >
          {group.active ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeSlash className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveUp}
          disabled={isFirst}
          className="h-6 w-6 p-0"
          title="Move group up"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveDown}
          disabled={isLast}
          className="h-6 w-6 p-0"
          title="Move group down"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-6 w-6 p-0 text-[var(--pb-text-muted)] hover:text-[var(--pb-error)]"
          title="Delete group"
        >
          <Trash className="h-3 w-3" />
        </Button>
      </div>

      {/* Group settings row */}
      {!group.collapsed && (
        <div className="border-t border-[var(--pb-border)] px-3 py-1.5">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--pb-text)]">
              <input
                type="checkbox"
                checked={group.isOptional}
                onChange={(e) => onUpdate({ ...group, isOptional: e.target.checked })}
              />
              Optional
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--pb-text)]">
              <input
                type="checkbox"
                checked={group.usesWizard}
                onChange={(e) => onUpdate({ ...group, usesWizard: e.target.checked })}
              />
              Wizard
            </label>
          </div>
        </div>
      )}

      {/* Rules */}
      {!group.collapsed && (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {group.rules.map((rule, ruleIdx) => (
            <RuleRow
              key={rule.uid}
              rule={rule}
              onUpdate={(updated) => updateRule(ruleIdx, updated)}
              onDelete={() => deleteRule(ruleIdx)}
              onMoveUp={() => moveRule(ruleIdx, -1)}
              onMoveDown={() => moveRule(ruleIdx, 1)}
              isFirst={ruleIdx === 0}
              isLast={ruleIdx === group.rules.length - 1}
            />
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={addRule}
            className="h-7 gap-1 self-start text-xs text-[var(--pb-text-muted)]"
          >
            <Plus className="h-3 w-3" /> Add Rule
          </Button>
        </div>
      )}
    </div>
  )
}

// ============== Main Panel ==============

interface AutoRulesPanelProps {
  layerDef: LayerDef
  onUpdate: (updated: LayerDef) => void
}

export function AutoRulesPanel({ layerDef, onUpdate }: AutoRulesPanelProps) {
  const project = useProjectStore((s) => s.project)
  const groups = layerDef.autoRuleGroups

  const updateGroups = useCallback(
    (updater: (groups: AutoLayerRuleGroupDef[]) => AutoLayerRuleGroupDef[]) => {
      onUpdate({ ...layerDef, autoRuleGroups: updater([...groups]) })
    },
    [layerDef, groups, onUpdate],
  )

  const handleAddGroup = useCallback(() => {
    if (!project) return
    updateGroups((g) => [...g, createDefaultRuleGroup(project)])
  }, [project, updateGroups])

  const handleDuplicateGroup = useCallback(
    (index: number) => {
      if (!project) return
      updateGroups((g) => {
        const src = g[index]
        const dup: AutoLayerRuleGroupDef = {
          ...src,
          uid: project.nextUid++,
          name: `${src.name} (copy)`,
          rules: src.rules.map((r) => ({ ...r, uid: project.nextUid++ })),
        }
        const next = [...g]
        next.splice(index + 1, 0, dup)
        return next
      })
    },
    [project, updateGroups],
  )

  const handleUpdateGroup = useCallback(
    (index: number, updated: AutoLayerRuleGroupDef) => {
      updateGroups((g) => g.map((grp, i) => (i === index ? updated : grp)))
    },
    [updateGroups],
  )

  const handleDeleteGroup = useCallback(
    (index: number) => {
      updateGroups((g) => g.filter((_, i) => i !== index))
    },
    [updateGroups],
  )

  const handleMoveGroup = useCallback(
    (index: number, direction: -1 | 1) => {
      updateGroups((g) => {
        const target = index + direction
        if (target < 0 || target >= g.length) return g
        const next = [...g]
        ;[next[index], next[target]] = [next[target], next[index]]
        return next
      })
    },
    [updateGroups],
  )

  const isAutoType = layerDef.type === 'IntGrid' || layerDef.type === 'AutoLayer'

  if (!isAutoType) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--pb-text-muted)]">
        Auto-layer rules are only available for IntGrid and AutoLayer layers.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-[var(--pb-border)] p-2">
        <span className="text-xs font-semibold text-[var(--pb-text)]">Auto Rules</span>
        <span className="text-[10px] text-[var(--pb-text-muted)]">
          {groups.length} group{groups.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddGroup}
          className="h-7 gap-1 px-2 text-xs"
          title="Add rule group"
        >
          <Plus className="h-3.5 w-3.5" /> Group
        </Button>
      </div>

      {/* Groups list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2">
          {groups.map((group, idx) => (
            <RuleGroupCard
              key={group.uid}
              group={group}
              project={project!}
              onUpdate={(updated) => handleUpdateGroup(idx, updated)}
              onDelete={() => handleDeleteGroup(idx)}
              onMoveUp={() => handleMoveGroup(idx, -1)}
              onMoveDown={() => handleMoveGroup(idx, 1)}
              isFirst={idx === 0}
              isLast={idx === groups.length - 1}
            />
          ))}

          {groups.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[var(--pb-text-muted)]">
              No rule groups defined.
              <br />
              Click &quot;Group&quot; to add one.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
