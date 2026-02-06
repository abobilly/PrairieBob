/**
 * TileActionsPanel — UI for defining/editing tile action groups
 *
 * Lists action groups. Each group expandable to show states + triggers + effects.
 */

import { useState, useCallback } from 'react'
import { Plus, Trash, CaretDown, CaretRight, Lightning, GearSix } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TileActionGroup, TileState, TileTrigger, TileEffect, TriggerType, EffectType } from '@/lib/types'
import { createEmptyActionGroup } from '@/lib/tile-actions'

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

interface TileActionsPanelProps {
  actionGroups: TileActionGroup[]
  onAdd: (group: TileActionGroup) => void
  onUpdate: (id: string, updates: Partial<TileActionGroup>) => void
  onDelete: (id: string) => void
}

export function TileActionsPanel({
  actionGroups,
  onAdd,
  onUpdate,
  onDelete,
}: TileActionsPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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

  return (
    <div className="pb-compact-panel flex flex-col h-full">
      <div className="pb-compact-header">
        <span className="pb-compact-title">Tile Actions</span>
        <button className="pb-icon-btn-xs" onClick={handleAddGroup} title="Add action group">
          <Plus size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {actionGroups.length === 0 ? (
          <div className="text-[10px] text-muted-foreground p-2">
            No action groups. Click + to create one.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {actionGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id)
              return (
                <div key={group.id} className="border border-border rounded">
                  {/* Group header */}
                  <div className="flex items-center gap-1 px-2 py-1 cursor-pointer"
                    onClick={() => toggleExpanded(group.id)}
                  >
                    {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
                    <Lightning size={12} className="text-amber-400" />
                    <span className="flex-1 text-[11px] font-medium truncate">{group.name}</span>
                    <span className="text-[9px] text-muted-foreground">{group.states.length}s</span>
                    <button
                      className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); onDelete(group.id) }}
                      title="Delete group"
                    >
                      <Trash size={10} />
                    </button>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-2 pb-2 flex flex-col gap-2 border-t border-border">
                      {/* Name */}
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-[10px] w-12">Name</Label>
                        <Input
                          className="h-6 text-[11px]"
                          value={group.name}
                          onChange={(e) => onUpdate(group.id, { name: e.target.value })}
                        />
                      </div>

                      {/* Default state */}
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-12">Default</Label>
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

                      {/* States */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">States</span>
                          <button className="pb-icon-btn-xs" onClick={() => handleAddState(group.id, group)}>
                            <Plus size={10} />
                          </button>
                        </div>
                        {group.states.map((state, si) => (
                          <div key={si} className="flex items-center gap-1 mb-0.5">
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
                            <button className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                              onClick={() => handleDeleteState(group.id, group, si)}>
                              <Trash size={8} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Triggers */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Triggers</span>
                          <button className="pb-icon-btn-xs" onClick={() => handleAddTrigger(group.id, group)}>
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
                            <button className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                              onClick={() => handleDeleteTrigger(group.id, group, ti)}>
                              <Trash size={8} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Effects */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Effects</span>
                          <button className="pb-icon-btn-xs" onClick={() => handleAddEffect(group.id, group)}>
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
                            <button className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                              onClick={() => handleDeleteEffect(group.id, group, ei)}>
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
    </div>
  )
}
