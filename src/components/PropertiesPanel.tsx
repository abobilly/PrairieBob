import { EntityData, EntityType } from '@/lib/types'
import { SAMPLE_CHARACTERS } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Door, DoorOpen, Lock, LockOpen, ToggleLeft, ToggleRight, Trash } from '@phosphor-icons/react'

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
}

export function PropertiesPanel({
  selectedEntity,
  onEntityUpdate,
  onEntityDelete,
}: PropertiesPanelProps) {
  const isTransferEntity = selectedEntity
    ? ['door', 'portal', 'stairs', 'ladder'].includes(selectedEntity.type)
    : false

  if (!selectedEntity) {
    return (
      <Card className="h-full pb-compact-panel pb-compact-properties">
        <CardHeader className="pb-compact-header">
          <CardTitle className="pb-compact-title">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select an entity to edit properties</p>
        </CardContent>
      </Card>
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

  return (
    <Card className="h-full flex flex-col pb-compact-panel pb-compact-properties">
      <CardHeader className="pb-compact-header flex flex-row items-center justify-between">
        <CardTitle className="pb-compact-title">Properties</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onEntityDelete(selectedEntity.id)}
        >
          <Trash size={16} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {isTransferEntity && (
          <>
            <div className="space-y-2">
              <Label htmlFor="target-room" className="text-xs">Target Room</Label>
              <Input
                id="target-room"
                value={(selectedEntity.properties.targetRoom as string) || ''}
                onChange={(e) => handlePropertyChange('targetRoom', e.target.value)}
                className="h-8 text-sm"
                placeholder="room_id"
              />
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
          </>
        )}

        {selectedEntity.type === 'npc' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="character-id" className="text-xs">Character</Label>
              <Select
                value={(selectedEntity.properties.characterId as string) || ''}
                onValueChange={(value) => handlePropertyChange('characterId', value)}
              >
                <SelectTrigger id="character-id" className="h-8 text-sm">
                  <SelectValue placeholder="Select character" />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_CHARACTERS.map(char => (
                    <SelectItem key={char.id} value={char.id}>
                      {char.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  value={Number(selectedEntity.properties.speedTilesPerSecond ?? 2.2)}
                  onChange={(e) => handlePropertyChange('speedTilesPerSecond', Number(e.target.value))}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
          </>
        )}

        {selectedEntity.type === 'trigger' && (
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
      </CardContent>
    </Card>
  )
}
