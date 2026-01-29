import { MapPin, DoorOpen, User, Lightning, Package } from '@phosphor-icons/react'
import { EntityType } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface EntityPaletteProps {
  onEntityTypeSelect: (type: EntityType) => void
}

export function EntityPalette({ onEntityTypeSelect }: EntityPaletteProps) {
  const entityTypes: { type: EntityType; icon: React.ReactNode; label: string }[] = [
    { type: 'spawn_point', icon: <MapPin size={20} />, label: 'Spawn Point' },
    { type: 'door', icon: <DoorOpen size={20} />, label: 'Door' },
    { type: 'npc', icon: <User size={20} />, label: 'NPC' },
    { type: 'trigger', icon: <Lightning size={20} />, label: 'Trigger' },
    { type: 'prop', icon: <Package size={20} />, label: 'Prop' },
  ]

  return (
    <Card className="h-full flex flex-col mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Entities</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2">
            {entityTypes.map(entity => (
              <Button
                key={entity.type}
                variant="outline"
                className="justify-start gap-2"
                onClick={() => onEntityTypeSelect(entity.type)}
              >
                {entity.icon}
                <span className="text-sm">{entity.label}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
