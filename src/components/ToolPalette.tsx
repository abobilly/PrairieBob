import { useCallback, useMemo, type ReactNode } from 'react'
import { CursorClick, GridFour, Hand, PaintBucket, User, LineSegment, Rectangle, Circle } from '@phosphor-icons/react'
import { toolRegistry } from '@/lib/ldtk'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLdtkToolStore } from '@/stores/ldtkToolStore'
import { useProjectStore, useEditorStore } from '@/stores'
import { useToolStore } from '@/stores/toolStore'

const TOOL_ICONS: Record<string, ReactNode> = {
  tile: <GridFour size={16} weight="bold" />,
  entity: <User size={16} weight="bold" />,
  intgrid: <PaintBucket size={16} weight="bold" />,
  pan: <Hand size={16} weight="bold" />,
  select: <CursorClick size={16} weight="bold" />,
  line: <LineSegment size={16} weight="bold" />,
  rect: <Rectangle size={16} weight="bold" />,
  ellipse: <Circle size={16} weight="bold" />,
}

const TOOL_ORDER = ['tile', 'entity', 'intgrid', 'pan', 'select', 'line', 'rect', 'ellipse'] as const

const TOOL_HELP: Record<string, string> = {
  tile: 'Paint selected tile/stamp on tile layers.',
  entity: 'Move existing entities. Place when an entity def is selected. Right-click deletes.',
  intgrid: 'Paint numeric mask values on the active mask/collision layer.',
  pan: 'Drag canvas to navigate. Hold Space for temporary pan.',
  select: 'Click to pick tile/entity/value from the active layer. Drag to marquee select.',
  line: 'Draw straight tile lines.',
  rect: 'Draw tile rectangles.',
  ellipse: 'Draw tile ellipses.',
  collision: 'Jump to the collision layer and edit it immediately.',
}

function isCollisionLayerName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return normalized === 'collision' || /(collision|collider|solid|block)/.test(normalized)
}

export function ToolPalette() {
  const activeToolId = useLdtkToolStore((state) => state.activeToolId)
  const setActiveToolId = useLdtkToolStore((state) => state.setActiveToolId)
  const layers = useProjectStore((state) => state.mapData.layers)
  const activeLayerIndex = useEditorStore((state) => state.activeLayerIndex)
  const setActiveLayerIndex = useEditorStore((state) => state.setActiveLayerIndex)
  const setSelectedIntGridValue = useToolStore((state) => state.setSelectedIntGridValue)

  const tools = useMemo(
    () => TOOL_ORDER
      .map((id) => toolRegistry.getTool(id))
      .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)),
    []
  )

  const collisionLayerIndex = useMemo(
    () => layers.findIndex((layer) => isCollisionLayerName(layer.name)),
    [layers]
  )

  const collisionActive = collisionLayerIndex >= 0 &&
    activeLayerIndex === collisionLayerIndex &&
    (activeToolId === 'tile' || activeToolId === 'intgrid')

  const handleActivateCollision = useCallback(() => {
    if (collisionLayerIndex < 0) return
    setActiveLayerIndex(collisionLayerIndex)
    setSelectedIntGridValue(1)
    setActiveToolId('tile')
  }, [collisionLayerIndex, setActiveLayerIndex, setSelectedIntGridValue, setActiveToolId])

  return (
    <div className="pb-compact-panel pb-compact-tools flex flex-col h-full">
      <div className="pb-compact-header">
        <span className="pb-compact-title">Tools</span>
      </div>
      <div className="flex-1 p-2 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {tools.map((tool) => {
            const isActive = tool.id === activeToolId
            return (
              <Button
                key={tool.id}
                variant="outline"
                size="sm"
                className={cn(
                  'justify-start gap-2 text-xs',
                  isActive && 'border-primary bg-primary/10 text-primary'
                )}
                onClick={() => setActiveToolId(tool.id)}
                title={`${tool.name}: ${TOOL_HELP[tool.id] ?? ''}`}
              >
                {TOOL_ICONS[tool.id] ?? <span className="text-xs font-semibold">{tool.name.slice(0, 1)}</span>}
                <span className="flex-1 text-left">{tool.name}</span>
                {tool.shortcut ? (
                  <span className="text-[10px] text-muted-foreground">{tool.shortcut}</span>
                ) : null}
              </Button>
            )
          })}

          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-start gap-2 text-xs col-span-2',
              collisionActive && 'border-primary bg-primary/10 text-primary'
            )}
            onClick={handleActivateCollision}
            disabled={collisionLayerIndex < 0}
            title={collisionLayerIndex < 0
              ? 'No collision layer found in this map'
              : `Collision: ${TOOL_HELP.collision}`}
          >
            <span className="text-xs font-semibold">C</span>
            <span className="flex-1 text-left">Collision</span>
          </Button>
        </div>

        <div className="mt-2 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] px-2 py-1 text-[10px] text-[var(--pb-text-secondary)]">
          {TOOL_HELP[collisionActive ? 'collision' : activeToolId] ?? 'Select a tool to edit the current map layer.'}
        </div>
      </div>
    </div>
  )
}
