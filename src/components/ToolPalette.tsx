import { useMemo, type ReactNode } from 'react'
import { CursorClick, GridFour, Hand, PaintBucket, User } from '@phosphor-icons/react'
import { toolRegistry, type ToolDefinition } from '@/lib/ldtk'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useLdtkToolStore } from '@/stores/ldtkToolStore'

const TOOL_ICONS: Record<string, ReactNode> = {
  tile: <GridFour size={16} weight="bold" />,
  entity: <User size={16} weight="bold" />,
  intgrid: <PaintBucket size={16} weight="bold" />,
  pan: <Hand size={16} weight="bold" />,
  select: <CursorClick size={16} weight="bold" />,
}

const CATEGORY_ORDER: ToolDefinition['category'][] = ['layer', 'navigation', 'selection']

const CATEGORY_LABELS: Record<ToolDefinition['category'], string> = {
  layer: 'Layer',
  navigation: 'Navigation',
  selection: 'Selection',
}

export function ToolPalette() {
  const { activeToolId, setActiveToolId } = useLdtkToolStore((state) => ({
    activeToolId: state.activeToolId,
    setActiveToolId: state.setActiveToolId,
  }))

  const toolsByCategory = useMemo(() => ({
    layer: toolRegistry.getToolsByCategory('layer'),
    navigation: toolRegistry.getToolsByCategory('navigation'),
    selection: toolRegistry.getToolsByCategory('selection'),
  }), [])

  return (
    <div className="pb-compact-panel flex flex-col h-full">
      <div className="pb-compact-header">
        <span className="pb-compact-title">Tools</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 p-2">
          {CATEGORY_ORDER.map((category) => {
            const tools = toolsByCategory[category]
            if (tools.length === 0) return null
            return (
              <div key={category} className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </span>
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
                      >
                        {TOOL_ICONS[tool.id] ?? <span className="text-xs font-semibold">{tool.name.slice(0, 1)}</span>}
                        <span className="flex-1 text-left">{tool.name}</span>
                        {tool.shortcut ? (
                          <span className="text-[10px] text-muted-foreground">{tool.shortcut}</span>
                        ) : null}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
