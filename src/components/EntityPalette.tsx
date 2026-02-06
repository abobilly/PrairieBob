import { ScrollArea } from '@/components/ui/scroll-area'
import type { EntityDef } from '@/lib/ldtk/types'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores'
import { useToolStore } from '@/stores/toolStore'
import type { EntityData } from '@/lib/types'

const EMPTY_ENTITY_DEFS: EntityDef[] = []

function formatEntityColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export function EntityPalette() {
  const entityDefs = useProjectStore((s) => s.project?.defs.entities ?? EMPTY_ENTITY_DEFS)
  const layers = useProjectStore((s) => s.mapData.layers)
  const activeLayerIndex = useEditorStore((s) => s.activeLayerIndex)
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId)
  const setSelectedEntityId = useEditorStore((s) => s.setSelectedEntityId)
  const setActiveLayerIndex = useEditorStore((s) => s.setActiveLayerIndex)
  const selectedUid = useToolStore((s) => s.selectedEntityDefUid)
  const setSelected = useToolStore((s) => s.setSelectedEntityDefUid)
  const entityLayers = layers.filter((layer) => layer.type === 'objectgroup')
  const activeLayerName = layers[activeLayerIndex]?.name ?? null
  const mapEntities = layers.flatMap((layer, layerIndex) => {
    if (layer.type !== 'objectgroup') return []
    return (layer.objects ?? []).map((entity): {
      entity: EntityData
      layerName: string
      layerIndex: number
    } => ({
      entity,
      layerName: layer.name,
      layerIndex,
    }))
  })

  const hasEntityDefinitions = entityDefs.length > 0

  return (
    <div className="pb-compact-panel pb-compact-entities h-full flex flex-col">
      <div className="pb-compact-header">
        <span className="pb-compact-title">Entities</span>
      </div>
      <div className="border-b border-[var(--pb-border)] px-2 py-1">
        <div className="text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">Entity Layers</div>
        {entityLayers.length === 0 ? (
          <div className="text-[10px] text-muted-foreground">No object layers</div>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1">
            {entityLayers.map((layer) => (
              <span
                key={layer.name}
                className={cn(
                  'rounded border border-[var(--pb-border)] px-1.5 py-0.5 text-[9px]',
                  activeLayerName === layer.name
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-[var(--pb-text-muted)]'
                )}
              >
                {layer.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        {hasEntityDefinitions ? (
          <div className="grid grid-cols-2 gap-2 p-2">
            {entityDefs.map((entity) => {
              const isSelected = entity.uid === selectedUid
              return (
                <button
                  key={entity.uid}
                  type="button"
                  title={entity.doc ?? entity.identifier}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border border-[var(--pb-border)] px-2 py-2 text-[10px] leading-tight text-[var(--pb-text-primary)] transition-colors',
                    isSelected && 'border-primary bg-primary/10 text-primary'
                  )}
                  onClick={() => setSelected(entity.uid)}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-sm border border-[var(--pb-border)]',
                      isSelected && 'border-primary'
                    )}
                    style={{ backgroundColor: formatEntityColor(entity.color) }}
                  />
                  <span className="text-center">{entity.identifier}</span>
                </button>
              )
            })}
          </div>
        ) : mapEntities.length > 0 ? (
          <div className="flex flex-col gap-1 p-2">
            {mapEntities.map(({ entity, layerName, layerIndex }) => {
              const isSelected = selectedEntityId === entity.id
              return (
                <button
                  key={`${layerName}:${entity.id}`}
                  type="button"
                  className={cn(
                    'flex items-center justify-between rounded border border-[var(--pb-border)] px-2 py-1 text-left text-[10px] text-[var(--pb-text-primary)] transition-colors',
                    isSelected ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/40'
                  )}
                  onClick={() => {
                    setActiveLayerIndex(layerIndex)
                    setSelectedEntityId(entity.id)
                  }}
                >
                  <span className="truncate">{entityDisplay(entity)}</span>
                  <span className="ml-2 shrink-0 text-[9px] text-[var(--pb-text-muted)]">{layerName}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-[10px] text-muted-foreground">
            No entities in this project
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function entityDisplay(entity: EntityData): string {
  const displayName = typeof entity.properties.name === 'string' ? entity.properties.name : null
  const characterId = typeof entity.properties.characterId === 'string' ? entity.properties.characterId : null
  if (displayName) return displayName
  if (characterId) return `${entity.type}: ${characterId}`
  return `${entity.type}: ${entity.id}`
}
