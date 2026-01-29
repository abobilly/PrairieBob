import { EntityData, EntityType } from '@/lib/types'
import { SAMPLE_CHARACTERS, DOOR_INTERACTIONS } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash } from '@phosphor-icons/react'
import { useState } from 'react'

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
  const [doorState, setDoorState] = useState<string>('closed')

  if (!selectedEntity) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select an entity to edit properties</p>
        </CardContent>
      </Card>
    )
  }

  const isTransferEntity = ['door', 'portal', 'stairs', 'ladder'].includes(selectedEntity.type)

  const handlePropertyChange = (key: string, value: string | number | boolean) => {
    onEntityUpdate(selectedEntity.id, {
      properties: { ...selectedEntity.properties, [key]: value },
    })
  }

  const handleStateChange = (state: string) => {
    setDoorState(state)
    const interaction = DOOR_INTERACTIONS.find(i => i.id === selectedEntity.properties.interactionId)
    if (interaction && interaction.states[state]) {
      console.log('State changed to:', state, interaction.states[state])
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Properties</CardTitle>
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
            {selectedEntity.type === 'door' && (
              <div className="space-y-2">
                <Label className="text-xs">State Preview</Label>
                <div className="flex gap-2">
                  <Button
                    variant={doorState === 'closed' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleStateChange('closed')}
                  >
                    Closed
                  </Button>
                  <Button
                    variant={doorState === 'open' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleStateChange('open')}
                  >
                    Open
                  </Button>
                </div>
              </div>
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
          </>
        )}

        {selectedEntity.type === 'npc' && (
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
