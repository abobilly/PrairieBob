/**
 * TileActionsPanel — Grouped behavior cards for tile action groups
 *
 * Organizes action groups by behavior category (Doors, NPC, Player, Props, Custom).
 * Each card is expandable for editing states, triggers, and effects.
 * Surfaces validation warnings for missing entity/action mappings.
 */

import { useState, useCallback, useMemo } from 'react'
import { Plus, Trash, CaretDown, CaretRight, Lightning, Door, User, Cube, WarningCircle } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TileActionGroup, TileState, TileTrigger, TileEffect, TriggerType, EffectType, EntityDefinitionFile, InteractionDefinitionFile } from '@/lib/types'
import { createEmptyActionGroup, inferBehaviorCategory, validateBehaviorMappings, BEHAVIOR_CATEGORY_META, type BehaviorCategory, type BehaviorValidationWarning } from '@/lib/tile-actions'

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: 'on_interact', label: 'On Interact' },
  { value: 'on_step', label: 'On Step' },
  { value: 'on_adjacent', label: 'On Adjacent' },
  { value: 'on_timer', label: 'On Timer' },
  { value: 'on_signal', label: 'On Signal' },
  { value: 'on_state_enter', label: 'On State Enter' },
  { value: 'on_state_exit', label: 'On State Exit' },
]

const EFFECT_TYPES: { value: EffectType; label: string }[] = [
  { value: 'change_state', label: 'Change State' },
  { value: 'emit_signal', label: 'Emit Signal' },
  { value: 'play_sound', label: 'Play Sound' },
  { value: 'spawn_entity', label: 'Spawn Entity' },
  { value: 'teleport', label: 'Teleport' },
  { value: 'damage', label: 'Damage' },
  { value: 'dialog', label: 'Dialog' },
  { value: 'custom', label: 'Custom' },
]

const CATEGORY_ORDER: BehaviorCategory[] = ['doors', 'npc', 'player', 'props', 'custom']

function CategoryIcon({ category, size = 12 }: { category: BehaviorCategory; size?: number }) {
  switch (category) {
    case 'doors': return <Door size={size} />
    case 'npc': return <User size={size} />
    case 'player': return <User size={size} weight="fill" />
    case 'props': return <Cube size={size} />
    case 'custom': return <Lightning size={size} />
  }
}

function TileIdBadge({ tileId, isDefault }: { tileId: number; isDefault: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded px-1 min-w-[22px] h-[16px] text-[9px] font-mono font-medium ${
        isDefault
          ? 'bg-[var(--pb-accent-glow)] text-[var(--pb-accent)] border border-[var(--pb-accent-dim)]'
          : 'bg-[var(--pb-bg-hover)] text-[var(--pb-text-secondary)] border border-[var(--pb-border-subtle)]'
      }`}
      title={`Tile ID ${tileId}${isDefault ? ' (default)' : ''}`}
    >
      {tileId}
    </span>
  )
}

/** Strip the " (type)" suffix appended by derivation for a cleaner display name */
function cleanGroupName(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/, '')
}

interface TileActionsPanelProps {
  actionGroups: TileActionGroup[]
  entityDefinitions?: Record<string, EntityDefinitionFile>
  interactionDefinitions?: Record<string, InteractionDefinitionFile>
  onAdd: (group: TileActionGroup) => void
  onUpdate: (id: string, updates: Partial<TileActionGroup>) => void
  onDelete: (id: string) => void
}

export function TileActionsPanel({
  actionGroups,
  entityDefinitions,
  interactionDefinitions,
  onAdd,
  onUpdate,
  onDelete,
}: TileActionsPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [collapsedCategories, setCollapsedCategories] = useState<Set<BehaviorCategory>>(new Set())

  const categorized = useMemo(() => {
    const map = new Map<BehaviorCategory, TileActionGroup[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const group of actionGroups) {
      const cat = inferBehaviorCategory(group, entityDefinitions, interactionDefinitions)
      map.get(cat)!.push(group)
    }
    return map
  }, [actionGroups, entityDefinitions, interactionDefinitions])

  const warnings = useMemo<BehaviorValidationWarning[]>(
    () => entityDefinitions ? validateBehaviorMappings(entityDefinitions, actionGroups) : [],
    [entityDefinitions, actionGroups],
  )

  const toggleExpanded = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleCategory = useCallback((cat: BehaviorCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  const handleAddGroup = useCallback(() => {
    const group = createEmptyActionGroup(`Action ${actionGroups.length + 1}`)
    onAdd(group)
    setExpandedGroups((prev) => new Set(prev).add(group.id))
  }, [actionGroups.length, onAdd])

  const handleAddState = useCallback((groupId: string, group: TileActionGroup) => {
    const newState: TileState = {
      name: `state_${group.states.length}`,
      tileId: 0,
    }
    onUpdate(groupId, { states: [...group.states, newState] })
  }, [onUpdate])

  const handleUpdateState = useCallback((groupId: string, group: TileActionGroup, stateIndex: number, updates: Partial<TileState>) => {
    const newStates = group.states.map((s, i) =>
      i === stateIndex ? { ...s, ...updates } : s
    )
    onUpdate(groupId, { states: newStates })
  }, [onUpdate])

  const handleDeleteState = useCallback((groupId: string, group: TileActionGroup, stateIndex: number) => {
    onUpdate(groupId, { states: group.states.filter((_, i) => i !== stateIndex) })
  }, [onUpdate])

  const handleAddTrigger = useCallback((groupId: string, group: TileActionGroup) => {
    const newTrigger: TileTrigger = { type: 'on_interact' }
    onUpdate(groupId, { triggers: [...group.triggers, newTrigger] })
  }, [onUpdate])

  const handleDeleteTrigger = useCallback((groupId: string, group: TileActionGroup, triggerIndex: number) => {
    onUpdate(groupId, { triggers: group.triggers.filter((_, i) => i !== triggerIndex) })
  }, [onUpdate])

  const handleAddEffect = useCallback((groupId: string, group: TileActionGroup) => {
    const newEffect: TileEffect = { type: 'change_state', parameters: {} }
    onUpdate(groupId, { effects: [...group.effects, newEffect] })
  }, [onUpdate])

  const handleDeleteEffect = useCallback((groupId: string, group: TileActionGroup, effectIndex: number) => {
    onUpdate(groupId, { effects: group.effects.filter((_, i) => i !== effectIndex) })
  }, [onUpdate])

  const isDefinitionBacked = (id: string) => id.startsWith('interaction:') || id.startsWith('entity:')

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Add custom group button */}
      <button
        type="button"
        className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] text-[var(--pb-text-secondary)] border border-dashed border-[var(--pb-border-subtle)] hover:bg-[var(--pb-bg-hover)] hover:text-[var(--pb-text-primary)] transition-colors"
        onClick={handleAddGroup}
        title="Add custom action group"
      >
        <Plus size={10} />
        Add Custom Group
      </button>

      {/* Category cards */}
      {CATEGORY_ORDER.map((category) => {
        const groups = categorized.get(category)!
        if (groups.length === 0) return null
        const meta = BEHAVIOR_CATEGORY_META[category]
        const isCollapsed = collapsedCategories.has(category)

        return (
          <div
            key={category}
            className="rounded border border-[var(--pb-border-subtle)] overflow-hidden"
            style={{ borderLeftColor: meta.color, borderLeftWidth: 2 }}
          >
            {/* Category header */}
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-2 py-1.5 bg-[var(--pb-bg-header)] hover:bg-[var(--pb-bg-hover)] transition-colors"
              onClick={() => toggleCategory(category)}
              title={`${isCollapsed ? 'Expand' : 'Collapse'} ${meta.label}`}
            >
              {isCollapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
              <span style={{ color: meta.color }}>
                <CategoryIcon category={category} size={12} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pb-text-primary)]">
                {meta.label}
              </span>
              <span className="ml-auto text-[9px] text-[var(--pb-text-muted)]">
                {groups.length}
              </span>
            </button>

            {/* Group list */}
            {!isCollapsed && (
              <div className="flex flex-col gap-0.5 p-1">
                {groups.map((group) => {
                  const isExpanded = expandedGroups.has(group.id)
                  const isDef = isDefinitionBacked(group.id)
                  return (
                    <div key={group.id} className="rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)]">
                      {/* Group header */}
                      <div
                        className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[var(--pb-bg-hover)] transition-colors"
                        onClick={() => toggleExpanded(group.id)}
                      >
                        {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
                        <span className="flex-1 text-[10px] font-medium truncate text-[var(--pb-text-primary)]">
                          {cleanGroupName(group.name)}
                        </span>
                        {/* State tile previews inline */}
                        <span className="flex items-center gap-0.5 shrink-0">
                          {group.states.slice(0, 4).map((state) => (
                            <TileIdBadge
                              key={state.name}
                              tileId={state.tileId}
                              isDefault={state.name === group.defaultState}
                            />
                          ))}
                          {group.states.length > 4 && (
                            <span className="text-[8px] text-[var(--pb-text-muted)]">+{group.states.length - 4}</span>
                          )}
                        </span>
                        {isDef && (
                          <span
                            className="text-[8px] px-1 rounded bg-[var(--pb-bg-active)] text-[var(--pb-text-muted)]"
                            title="Derived from entity/interaction definition"
                          >
                            def
                          </span>
                        )}
                        {!isDef && (
                          <button
                            className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                            onClick={(e) => { e.stopPropagation(); onDelete(group.id) }}
                            title="Delete group"
                          >
                            <Trash size={10} />
                          </button>
                        )}
                      </div>

                      {/* Expanded editor */}
                      {isExpanded && (
                        <div className="px-2 pb-2 flex flex-col gap-2 border-t border-[var(--pb-border-subtle)]">
                          {/* Name */}
                          <div className="flex items-center gap-2 pt-1">
                            <Label className="text-[10px] w-12 text-[var(--pb-text-secondary)]">Name</Label>
                            <Input
                              className="h-6 text-[11px]"
                              value={group.name}
                              onChange={(e) => onUpdate(group.id, { name: e.target.value })}
                            />
                          </div>

                          {/* Default state */}
                          {group.states.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] w-12 text-[var(--pb-text-secondary)]">Default</Label>
                              <Select
                                value={group.defaultState}
                                onValueChange={(v) => onUpdate(group.id, { defaultState: v })}
                              >
                                <SelectTrigger className="h-6 text-[11px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {group.states.map((s) => (
                                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* States with tile previews */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--pb-text-muted)]">States</span>
                              <button type="button" className="pb-icon-btn-xs" onClick={() => handleAddState(group.id, group)} title="Add state">
                                <Plus size={10} />
                              </button>
                            </div>
                            {group.states.map((state, si) => (
                              <div key={si} className="flex items-center gap-1 mb-0.5">
                                <TileIdBadge tileId={state.tileId} isDefault={state.name === group.defaultState} />
                                <Input
                                  className="h-5 text-[10px] flex-1"
                                  value={state.name}
                                  onChange={(e) => handleUpdateState(group.id, group, si, { name: e.target.value })}
                                  placeholder="State name"
                                />
                                <Input
                                  className="h-5 text-[10px] w-14"
                                  type="number"
                                  value={state.tileId}
                                  onChange={(e) => handleUpdateState(group.id, group, si, { tileId: Number(e.target.value) })}
                                  title="Tile ID"
                                />
                                <Input
                                  className="h-5 text-[10px] w-14"
                                  type="number"
                                  value={state.duration ?? ''}
                                  onChange={(e) => handleUpdateState(group.id, group, si, {
                                    duration: e.target.value ? Number(e.target.value) : undefined
                                  })}
                                  placeholder="ms"
                                  title="Auto-transition duration (ms)"
                                />
                                <button type="button" className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                                  onClick={() => handleDeleteState(group.id, group, si)} title="Delete state">
                                  <Trash size={8} />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Triggers */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--pb-text-muted)]">Triggers</span>
                              <button type="button" className="pb-icon-btn-xs" onClick={() => handleAddTrigger(group.id, group)} title="Add trigger">
                                <Plus size={10} />
                              </button>
                            </div>
                            {group.triggers.map((trigger, ti) => (
                              <div key={ti} className="flex items-center gap-1 mb-0.5">
                                <Select
                                  value={trigger.type}
                                  onValueChange={(v) => {
                                    const newTriggers = [...group.triggers]
                                    newTriggers[ti] = { ...trigger, type: v as TriggerType }
                                    onUpdate(group.id, { triggers: newTriggers })
                                  }}
                                >
                                  <SelectTrigger className="h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TRIGGER_TYPES.map((tt) => (
                                      <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button type="button" className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                                  onClick={() => handleDeleteTrigger(group.id, group, ti)} title="Delete trigger">
                                  <Trash size={8} />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Effects */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--pb-text-muted)]">Effects</span>
                              <button type="button" className="pb-icon-btn-xs" onClick={() => handleAddEffect(group.id, group)} title="Add effect">
                                <Plus size={10} />
                              </button>
                            </div>
                            {group.effects.map((effect, ei) => (
                              <div key={ei} className="flex items-center gap-1 mb-0.5">
                                <Select
                                  value={effect.type}
                                  onValueChange={(v) => {
                                    const newEffects = [...group.effects]
                                    newEffects[ei] = { ...effect, type: v as EffectType }
                                    onUpdate(group.id, { effects: newEffects })
                                  }}
                                >
                                  <SelectTrigger className="h-5 text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EFFECT_TYPES.map((et) => (
                                      <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button type="button" className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                                  onClick={() => handleDeleteEffect(group.id, group, ei)} title="Delete effect">
                                  <Trash size={8} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Empty state */}
      {actionGroups.length === 0 && warnings.length === 0 && (
        <div className="text-[10px] text-[var(--pb-text-muted)] px-1 leading-tight">
          No action groups. Add entity or interaction definitions, or create a custom group.
        </div>
      )}

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <div className="rounded border border-[var(--pb-warning)]/30 bg-[var(--pb-warning)]/5 p-2">
          <div className="flex items-center gap-1 mb-1">
            <WarningCircle size={12} className="text-[var(--pb-warning)]" />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--pb-warning)]">
              Warnings
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {warnings.map((w) => (
              <div key={w.entityId} className="text-[10px] text-[var(--pb-text-secondary)] leading-tight">
                {w.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
