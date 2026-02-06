import { ScrollArea } from '@/components/ui/scroll-area'
import type { EntityDef } from '@/lib/ldtk/types'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores'
import { useToolStore } from '@/stores/toolStore'

const EMPTY_ENTITY_DEFS: EntityDef[] = []

function formatEntityColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export function EntityPalette() {
  const entityDefs = useProjectStore((s) => s.project?.defs.entities ?? EMPTY_ENTITY_DEFS)
  const selectedUid = useToolStore((s) => s.selectedEntityDefUid)
  const setSelected = useToolStore((s) => s.setSelectedEntityDefUid)

  return (
    <div className="pb-compact-panel pb-compact-entities h-full flex flex-col">
      <div className="pb-compact-header">
        <span className="pb-compact-title">Entities</span>
      </div>
      <ScrollArea className="flex-1">
        {entityDefs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-2 text-[10px] text-muted-foreground">
            No entities
          </div>
        ) : (
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
        )}
      </ScrollArea>
    </div>
  )
}
