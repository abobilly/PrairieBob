import { useMemo } from 'react'
import type { LayerDef, IntGridValueDef } from '@/lib/ldtk/types'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToolStore } from '@/stores/toolStore'

const DEFAULT_EMPTY_MESSAGE = 'Select an IntGrid layer to see values.'

function isLayerDef(value: unknown): value is LayerDef {
  if (!value || typeof value !== 'object') return false
  if (!('intGridValues' in value)) return false
  const intGridValues = (value as { intGridValues?: unknown }).intGridValues
  return Array.isArray(intGridValues)
}

function intToHex(value: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.floor(value)))
  return `#${clamped.toString(16).padStart(6, '0')}`
}

function sortIntGridValues(values: IntGridValueDef[]): IntGridValueDef[] {
  return [...values].sort((a, b) => a.value - b.value)
}

export function IntGridPalette() {
  const activeLayer = useToolStore((s) => s.activeLayer)
  const selectedValue = useToolStore((s) => s.selectedIntGridValue)
  const setSelected = useToolStore((s) => s.setSelectedIntGridValue)

  const layerDef = useMemo(() => (isLayerDef(activeLayer) ? activeLayer : null), [activeLayer])
  const intGridValues = useMemo(
    () => (layerDef?.intGridValues ? sortIntGridValues(layerDef.intGridValues) : []),
    [layerDef]
  )

  const isIntGridLayer = layerDef?.type ? layerDef.type === 'IntGrid' : intGridValues.length > 0

  return (
    <div className="pb-compact-panel h-full flex flex-col">
      <div className="pb-compact-header">
        <span className="pb-compact-title">IntGrid</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {!layerDef || !isIntGridLayer ? (
            <div className="text-[10px] text-muted-foreground">{DEFAULT_EMPTY_MESSAGE}</div>
          ) : intGridValues.length === 0 ? (
            <div className="text-[10px] text-muted-foreground">No IntGrid values defined.</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
              {intGridValues.map((valueDef) => {
                const isSelected = valueDef.value === selectedValue
                const color = intToHex(valueDef.color)
                const label = valueDef.identifier ?? `Value ${valueDef.value}`
                return (
                  <button
                    key={valueDef.value}
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-1 rounded border px-1 py-2 text-[10px] transition',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-border'
                    )}
                    onClick={() => setSelected(valueDef.value)}
                    title={label}
                  >
                    <span
                      className="h-5 w-5 rounded-sm border"
                      style={{ backgroundColor: color, borderColor: color }}
                    />
                    <span className="font-medium">{valueDef.value}</span>
                    {valueDef.identifier ? (
                      <span className="text-[9px] text-muted-foreground truncate max-w-full">
                        {valueDef.identifier}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
