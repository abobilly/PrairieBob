import { Pencil, PaintBucket, Rectangle, Eraser, CursorClick } from '@phosphor-icons/react'
import { Tool } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
  gridVisible: boolean
  onGridToggle: () => void
  zoom: number
  onExport: () => void
  onSave: () => void
}

export function Toolbar({
  currentTool,
  onToolChange,
  gridVisible,
  onGridToggle,
  zoom,
  onExport,
  onSave,
}: ToolbarProps) {
  const tools: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'brush', icon: <Pencil size={20} />, label: 'Brush', shortcut: 'B' },
    { id: 'fill', icon: <PaintBucket size={20} />, label: 'Fill', shortcut: 'F' },
    { id: 'rectangle', icon: <Rectangle size={20} />, label: 'Rectangle', shortcut: 'R' },
    { id: 'eraser', icon: <Eraser size={20} />, label: 'Eraser', shortcut: 'E' },
    { id: 'select', icon: <CursorClick size={20} />, label: 'Select', shortcut: 'S' },
  ]

  return (
    <div className="flex items-center gap-2 p-2 bg-primary border-b border-border">
      <h1 className="text-xl font-bold px-2">PrairieBob</h1>
      
      <Separator orientation="vertical" className="h-8" />
      
      <TooltipProvider>
        <div className="flex gap-1">
          {tools.map(tool => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={currentTool === tool.id ? 'tool-button active' : ''}
                  onClick={() => onToolChange(tool.id)}
                >
                  {tool.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {tool.label} ({tool.shortcut})
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      <Separator orientation="vertical" className="h-8" />

      <Button variant="ghost" size="sm" onClick={onGridToggle}>
        Grid {gridVisible ? 'On' : 'Off'} (G)
      </Button>

      <div className="ml-auto flex gap-2">
        <span className="text-sm text-muted-foreground px-2 py-1">
          Zoom: {Math.round(zoom * 100)}%
        </span>
        <Button variant="secondary" size="sm" onClick={onSave}>
          Save (Ctrl+S)
        </Button>
        <Button variant="default" size="sm" onClick={onExport} className="bg-accent text-accent-foreground hover:bg-accent/90">
          Export (Ctrl+E)
        </Button>
      </div>
    </div>
  )
}
