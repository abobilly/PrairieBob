import { useMemo } from 'react'
import { EntityData, EntityType, EntityDefinitionFile, InteractionDefinitionFile } from '@/lib/types'
import { getAvailableCharacters } from '@/lib/data'
import { useProjectStore } from '@/stores/projectStore'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Door, DoorOpen, Lock, LockOpen, ToggleLeft, ToggleRight, Trash } from '@phosphor-icons/react'

import type { InspectorTab } from '@/components/InspectorSection'
import { BehaviorEditor } from '@/components/BehaviorEditor'

const SELECT_NONE = '__none__'

const STATE_PRESETS = [
  {
    id: 'door',
    values: ['closed', 'open'],
    labels: ['Closed', 'Open'],
    icons: [Door, DoorOpen],
    activeClasses: [
      'bg-slate-600 hover:bg-slate-600 text-white',
      'bg-emerald-600 hover:bg-emerald-600 text-white',
    ],
  },
  {
    id: 'lock',
    values: ['locked', 'unlocked'],
    labels: ['Locked', 'Unlocked'],
    icons: [Lock, LockOpen],
    activeClasses: [
      'bg-rose-600 hover:bg-rose-600 text-white',
      'bg-emerald-600 hover:bg-emerald-600 text-white',
    ],
  },
  {
    id: 'switch',
    values: ['inactive', 'active'],
    labels: ['Inactive', 'Active'],
    icons: [ToggleLeft, ToggleRight],
    activeClasses: [
      'bg-slate-600 hover:bg-slate-600 text-white',
      'bg-emerald-600 hover:bg-emerald-600 text-white',
    ],
  },
]

interface PropertiesPanelProps {
  selectedEntity: EntityData | null
  onEntityUpdate: (id: string, updates: Partial<EntityData>) => void
  onEntityDelete: (id: string) => void
  activeTab?: InspectorTab
  entityDefinitions?: Record<string, EntityDefinitionFile>
  interactionDefinitions?: Record<string, InteractionDefinitionFile>
}

export function PropertiesPanel({
  selectedEntity,
  onEntityUpdate,
  onEntityDelete,
  activeTab = 'quick',
  entityDefinitions,
  interactionDefinitions,
}: PropertiesPanelProps) {
  const isNpcEntity = selectedEntity?.type === 'npc'
  const isSpawnEntity = selectedEntity?.type === 'spawn_point'
  const isDoorEntity = selectedEntity?.type === 'door'
  const isTransferEntity = selectedEntity
    ? ['door', 'portal', 'stairs', 'ladder'].includes(selectedEntity.type)
    : false
  const isKimbarProject = useProjectStore((s) => s.isKimbarProject)
  const roomRegistry = useProjectStore((s) => s.roomRegistry)
  const mapData = useProjectStore((s) => s.mapData)
  const npcZoneOptions = useMemo(() => {
    return mapData.layers
      .filter((layer) => layer.type === 'objectgroup')
      .flatMap((layer) => layer.objects ?? [])
      .filter((entity) => entity.type === 'trigger')
      .filter((entity) => (entity.properties.zoneRole as string | undefined) === 'npc_zone')
      .map((entity) => {
        const zoneId = typeof entity.properties.zoneId === 'string' && entity.properties.zoneId.trim().length > 0
          ? entity.properties.zoneId.trim()
          : entity.id
        return { id: zoneId, label: zoneId }
      })
      .filter((entry, index, array) => array.findIndex((candidate) => candidate.id === entry.id) === index)
  }, [mapData.layers])

  if (!selectedEntity) {
    return (
      <div className="px-3 py-3">
        <p className="text-sm text-[var(--pb-text-muted)]">Select an entity to edit properties</p>
      </div>
    )
  }

  const handlePropertyChange = (key: string, value: string | number | boolean) => {
    onEntityUpdate(selectedEntity.id, {
      properties: { ...selectedEntity.properties, [key]: value },
    })
  }

  const stateValue = typeof selectedEntity.properties.state === 'string'
    ? selectedEntity.properties.state
    : undefined
  const statePreset = STATE_PRESETS.find(preset => stateValue && preset.values.includes(stateValue))
    ?? (selectedEntity.type === 'door' ? STATE_PRESETS[0] : null)
  const activeState = statePreset?.values.includes(stateValue || '') ? stateValue : statePreset?.values[0]
  const movementModeValue = (selectedEntity.properties.movementMode as string) || 'wander'
  const speedValue = Number(selectedEntity.properties.speedTilesPerSecond ?? 2.2)
  const safeSpeedValue = Number.isFinite(speedValue) ? Math.max(0.1, speedValue) : 2.2
  const decisionValue = Number(selectedEntity.properties.decisionIntervalMs ?? 1200)
  const safeDecisionValue = Number.isFinite(decisionValue) ? Math.max(120, Math.floor(decisionValue)) : 1200
  const deviationValue = Number(selectedEntity.properties.zoneDeviationTiles ?? selectedEntity.properties.wanderRadius ?? 0)
  const safeDeviationValue = Number.isFinite(deviationValue) ? Math.max(0, Math.floor(deviationValue)) : 0

  return (
    <div className="px-3 py-3 space-y-4 text-[var(--pb-text-primary)]">
      {/* ─── Always visible: type badge ────────────────── */}
      <div className="flex items-center justify-between rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pb-text-muted)]">
          {selectedEntity.type}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onEntityDelete(selectedEntity.id)}
          title="Delete entity"
        >
          <Trash size={16} />
        </Button>
      </div>

      {/* ═══════════════ QUICK TAB ═══════════════ */}
      {activeTab === 'quick' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="entity-id" className="text-xs">ID</Label>
            <Input
              id="entity-id"
              value={selectedEntity.id}
              onChange={(e) => onEntityUpdate(selectedEntity.id, { id: e.target.value })}
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <div className="text-sm font-mono">{selectedEntity.type}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="entity-x" className="text-xs">X</Label>
              <Input
                id="entity-x"
                type="number"
                value={Math.round(selectedEntity.x)}
                onChange={(e) => onEntityUpdate(selectedEntity.id, { x: Number(e.target.value) })}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entity-y" className="text-xs">Y</Label>
              <Input
                id="entity-y"
                type="number"
                value={Math.round(selectedEntity.y)}
                onChange={(e) => onEntityUpdate(selectedEntity.id, { y: Number(e.target.value) })}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          {statePreset && activeState && (
            <div className="space-y-2">
              <Label className="text-xs">State Preview</Label>
              <div className="flex gap-2">
                {statePreset.values.map((value, index) => {
                  const Icon = statePreset.icons[index]
                  const isActive = activeState === value
                  return (
                    <Button
                      key={value}
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 gap-1 ${isActive ? statePreset.activeClasses[index] : ''}`}
                      onClick={() => handlePropertyChange('state', value)}
                    >
                      <Icon size={14} />
                      {statePreset.labels[index]}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {(isNpcEntity || isSpawnEntity) && (
            <div className="space-y-2">
              <Label htmlFor="character-id-quick" className="text-xs">Character</Label>
              <Select
                value={(selectedEntity.properties.characterId as string) || ''}
                onValueChange={(value) => handlePropertyChange('characterId', value)}
              >
                <SelectTrigger id="character-id-quick" className="h-8 text-sm">
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableCharacters({ useKimbarRegistry: isKimbarProject }).map(char => (
                    <SelectItem key={char.id} value={char.id}>
                      {char.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedEntity.type === 'prop' && (
            <div className="space-y-2">
              <Label htmlFor="prop-type" className="text-xs">Prop Type</Label>
              <Input
                id="prop-type"
                value={(selectedEntity.properties.propType as string) || ''}
                onChange={(e) => handlePropertyChange('propType', e.target.value)}
                className="h-8 text-sm"
                placeholder="prop_type"
              />
            </div>
          )}
        </>
      )}

      {/* ═══════════════ ADVANCED TAB ═══════════════ */}
      {activeTab === 'advanced' && (
        <>
          {(isNpcEntity || isSpawnEntity) && (
            <>
              {isNpcEntity && (
                <div className="space-y-2">
                  <Label htmlFor="npc-movement-mode" className="text-xs">Movement</Label>
                  <Select
                    value={movementModeValue}
                    onValueChange={(value) => handlePropertyChange('movementMode', value)}
                  >
                    <SelectTrigger id="npc-movement-mode" className="h-8 text-sm">
                      <SelectValue placeholder="Movement mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wander">Wander</SelectItem>
                      <SelectItem value="idle">Idle</SelectItem>
                      <SelectItem value="patrol">Patrol (Soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="npc-facing-mode" className="text-xs">Facing Mode</Label>
                <Select
                  value={(selectedEntity.properties.facingMode as string) || 'fixed_right'}
                  onValueChange={(value) => handlePropertyChange('facingMode', value)}
                >
                  <SelectTrigger id="npc-facing-mode" className="h-8 text-sm">
                    <SelectValue placeholder="Facing mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_right">Fixed Right</SelectItem>
                    <SelectItem value="auto_flip_x">Auto Flip X</SelectItem>
                    <SelectItem value="auto_4dir">Auto 4-Direction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="npc-idle-animation" className="text-xs">Idle Anim</Label>
                  <Input
                    id="npc-idle-animation"
                    value={(selectedEntity.properties.idleAnimation as string) || ''}
                    onChange={(e) => handlePropertyChange('idleAnimation', e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="idle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npc-walk-animation" className="text-xs">Walk Anim</Label>
                  <Input
                    id="npc-walk-animation"
                    value={(selectedEntity.properties.walkAnimation as string) || ''}
                    onChange={(e) => handlePropertyChange('walkAnimation', e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="walk"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="npc-interact-animation" className="text-xs">Interact Anim</Label>
                  <Input
                    id="npc-interact-animation"
                    value={(selectedEntity.properties.onInteractAnimation as string) || ''}
                    onChange={(e) => handlePropertyChange('onInteractAnimation', e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="sniff"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npc-speed" className="text-xs">Speed</Label>
                  <Input
                    id="npc-speed"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={safeSpeedValue}
                    onChange={(e) => handlePropertyChange('speedTilesPerSecond', Number(e.target.value))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <Label htmlFor="npc-speed-slider" className="text-xs">Speed Slider</Label>
                  <span className="font-mono text-[10px]">{safeSpeedValue.toFixed(1)} t/s</span>
                </div>
                <input
                  id="npc-speed-slider"
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.1}
                  value={safeSpeedValue}
                  onChange={(e) => handlePropertyChange('speedTilesPerSecond', Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              {isNpcEntity && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="npc-zone-deviation" className="text-xs">Zone Deviation</Label>
                      <span className="font-mono text-[10px]">{safeDeviationValue} tiles</span>
                    </div>
                    <input
                      id="npc-zone-deviation"
                      type="range"
                      min={0}
                      max={16}
                      step={1}
                      value={safeDeviationValue}
                      onChange={(e) => {
                        const next = Number(e.target.value)
                        handlePropertyChange('zoneDeviationTiles', next)
                        handlePropertyChange('wanderRadius', next)
                      }}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="npc-decision-interval" className="text-xs">Direction Interval</Label>
                      <span className="font-mono text-[10px]">{safeDecisionValue} ms</span>
                    </div>
                    <input
                      id="npc-decision-interval"
                      type="range"
                      min={120}
                      max={4000}
                      step={40}
                      value={safeDecisionValue}
                      onChange={(e) => handlePropertyChange('decisionIntervalMs', Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {isDoorEntity && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="door-on-interact-state" className="text-xs">On Interact</Label>
                <Select
                  value={(selectedEntity.properties.onInteractState as string) || 'toggle'}
                  onValueChange={(value) => handlePropertyChange('onInteractState', value)}
                >
                  <SelectTrigger id="door-on-interact-state" className="h-8 text-sm">
                    <SelectValue placeholder="Select behavior" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toggle">Toggle</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="close">Close</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="door-preview-state" className="text-xs">Preview State</Label>
                <Input
                  id="door-preview-state"
                  value={(selectedEntity.properties.previewState as string) || ''}
                  onChange={(e) => handlePropertyChange('previewState', e.target.value)}
                  className="h-8 text-sm font-mono"
                  placeholder="closed"
                />
              </div>
            </div>
          )}

          {selectedEntity.type === 'trigger' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="trigger-action" className="text-xs">Action</Label>
                <Input
                  id="trigger-action"
                  value={(selectedEntity.properties.action as string) || ''}
                  onChange={(e) => handlePropertyChange('action', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="action_name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-zone-role" className="text-xs">Zone Role</Label>
                <Select
                  value={(selectedEntity.properties.zoneRole as string) || 'none'}
                  onValueChange={(value) => {
                    handlePropertyChange('zoneRole', value)
                    if (value === 'npc_zone' && !(selectedEntity.properties.zoneId as string)) {
                      handlePropertyChange('zoneId', selectedEntity.id)
                    }
                  }}
                >
                  <SelectTrigger id="trigger-zone-role" className="h-8 text-sm">
                    <SelectValue placeholder="Select zone role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="npc_zone">NPC Wander Zone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="trigger-deck-tag" className="text-xs">Deck Tag</Label>
                  <Input
                    id="trigger-deck-tag"
                    value={(selectedEntity.properties.deckTag as string) || ''}
                    onChange={(e) => handlePropertyChange('deckTag', e.target.value)}
                    className="h-8 text-sm font-mono"
                    placeholder="deck_tag"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trigger-count" className="text-xs">Count</Label>
                  <Input
                    id="trigger-count"
                    type="number"
                    step="1"
                    min="1"
                    value={Number(selectedEntity.properties.count ?? 1)}
                    onChange={(e) => handlePropertyChange('count', Number(e.target.value))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {(selectedEntity.type === 'stairs' || selectedEntity.type === 'ladder') && (
            <div className="space-y-2">
              <Label htmlFor="direction" className="text-xs">Direction</Label>
              <Select
                value={(selectedEntity.properties.direction as string) || 'up'}
                onValueChange={(value) => handlePropertyChange('direction', value)}
              >
                <SelectTrigger id="direction" className="h-8 text-sm">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isNpcEntity && !isSpawnEntity && !isDoorEntity && !isTransferEntity && selectedEntity.type !== 'trigger' && selectedEntity.type !== 'prop' && (
            <div className="text-[10px] text-[var(--pb-text-muted)]">No advanced settings for {selectedEntity.type} entities.</div>
          )}
        </>
      )}

      {/* ═══════════════ BINDINGS TAB ═══════════════ */}
      {activeTab === 'bindings' && (
        <>
          {isTransferEntity && (
            <>
              <div className="space-y-2">
                <Label htmlFor="target-room" className="text-xs">Target Room</Label>
                {roomRegistry.length > 0 ? (
                  <Select
                    value={(selectedEntity.properties.targetRoom as string) || SELECT_NONE}
                    onValueChange={(value) => handlePropertyChange('targetRoom', value === SELECT_NONE ? '' : value)}
                  >
                    <SelectTrigger id="target-room" className="h-8 text-sm">
                      <SelectValue placeholder="Select target room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE}>None</SelectItem>
                      {roomRegistry.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="target-room"
                    value={(selectedEntity.properties.targetRoom as string) || ''}
                    onChange={(e) => handlePropertyChange('targetRoom', e.target.value)}
                    className="h-8 text-sm"
                    placeholder="room_id"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-spawn" className="text-xs">Target Spawn</Label>
                <Input
                  id="target-spawn"
                  value={(selectedEntity.properties.targetSpawn as string) || ''}
                  onChange={(e) => handlePropertyChange('targetSpawn', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="spawn_id"
                />
              </div>
            </>
          )}

          {isDoorEntity && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="door-interaction-id" className="text-xs">Interaction ID</Label>
                <Input
                  id="door-interaction-id"
                  value={(selectedEntity.properties.interactionId as string) || ''}
                  onChange={(e) => handlePropertyChange('interactionId', e.target.value)}
                  className="h-8 text-sm font-mono"
                  placeholder="sample_door_toggle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="door-entity-def-id" className="text-xs">Entity Def ID</Label>
                <Input
                  id="door-entity-def-id"
                  value={(selectedEntity.properties.entityDefId as string) || ''}
                  onChange={(e) => handlePropertyChange('entityDefId', e.target.value)}
                  className="h-8 text-sm font-mono"
                  placeholder="sample_door"
                />
              </div>
            </div>
          )}

          {(isNpcEntity || isSpawnEntity) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="npc-story-knot" className="text-xs">Story Knot</Label>
                <Input
                  id="npc-story-knot"
                  value={(selectedEntity.properties.storyKnot as string) || ''}
                  onChange={(e) => handlePropertyChange('storyKnot', e.target.value)}
                  className="h-8 text-sm font-mono"
                  placeholder="ink_knot_name"
                />
              </div>
              {isNpcEntity && (
                <div className="space-y-2">
                  <Label htmlFor="npc-zone-id" className="text-xs">Zone</Label>
                  {npcZoneOptions.length > 0 ? (
                    <Select
                      value={(selectedEntity.properties.zoneId as string) || SELECT_NONE}
                      onValueChange={(value) => handlePropertyChange('zoneId', value === SELECT_NONE ? '' : value)}
                    >
                      <SelectTrigger id="npc-zone-id" className="h-8 text-sm">
                        <SelectValue placeholder="None (free roam around home)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE}>None</SelectItem>
                        {npcZoneOptions.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="npc-zone-id"
                      value={(selectedEntity.properties.zoneId as string) || ''}
                      onChange={(e) => handlePropertyChange('zoneId', e.target.value)}
                      className="h-8 text-sm font-mono"
                      placeholder="zone_id (create NPC zone trigger first)"
                    />
                  )}
                </div>
              )}
            </>
          )}

          {selectedEntity.type === 'trigger' && (selectedEntity.properties.zoneRole as string) === 'npc_zone' && (
            <div className="space-y-2">
              <Label htmlFor="trigger-zone-id" className="text-xs">Zone ID</Label>
              <Input
                id="trigger-zone-id"
                value={(selectedEntity.properties.zoneId as string) || selectedEntity.id}
                onChange={(e) => handlePropertyChange('zoneId', e.target.value)}
                className="h-8 text-sm font-mono"
                placeholder="zone_id"
              />
            </div>
          )}

          {!isTransferEntity && !isDoorEntity && !isNpcEntity && !isSpawnEntity && selectedEntity.type !== 'trigger' && (
            <div className="text-[10px] text-[var(--pb-text-muted)]">No bindings for {selectedEntity.type} entities.</div>
          )}
        </>
      )}

      {/* ═══════════════ PREVIEW TAB ═══════════════ */}
      {activeTab === 'preview' && (
        <BehaviorEditor
          selectedEntity={selectedEntity}
          entityDefinitions={entityDefinitions}
          interactionDefinitions={interactionDefinitions}
        />
      )}
    </div>
  )
}
