import { Pencil, PaintBucket, Rectangle, Eraser, CursorClick, Eyedropper, Hand, ArrowUUpLeft, ArrowUUpRight, MagnifyingGlassMinus, MagnifyingGlassPlus, LineSegment, GridFour, FloppyDisk, Export } from '@phosphor-icons/react'
import { Tool } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
  gridVisible: boolean
  onGridToggle: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onSave: () => void
}

export function Toolbar({
  currentTool,
  onToolChange,
  gridVisible,
  onGridToggle,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onSave,
}: ToolbarProps) {
  const tools: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'brush', icon: <Pencil size={18} weight="bold" />, label: 'Brush', shortcut: 'B' },
    { id: 'fill', icon: <PaintBucket size={18} weight="bold" />, label: 'Fill', shortcut: 'F' },
    { id: 'rectangle', icon: <Rectangle size={18} weight="bold" />, label: 'Rectangle', shortcut: 'R' },
    { id: 'line', icon: <LineSegment size={18} weight="bold" />, label: 'Line', shortcut: 'L' },
    { id: 'eraser', icon: <Eraser size={18} weight="bold" />, label: 'Eraser', shortcut: 'E' },
    { id: 'select', icon: <CursorClick size={18} weight="bold" />, label: 'Select', shortcut: 'S' },
    { id: 'eyedropper', icon: <Eyedropper size={18} weight="bold" />, label: 'Eyedropper', shortcut: 'I' },
    { id: 'pan', icon: <Hand size={18} weight="bold" />, label: 'Pan', shortcut: 'Space' },
  ]

  return (
    <div className="pb-toolbar">
      {/* Brand */}
      <span className="pb-toolbar-brand">PrairieBob</span>

      {/* Undo/Redo */}
      <TooltipProvider delayDuration={300}>
        <div className="pb-toolbar-group">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="pb-tool-btn"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <ArrowUUpLeft size={18} weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Undo <span className="pb-tooltip-shortcut">Ctrl+Z</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="pb-tool-btn"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
              >
                <ArrowUUpRight size={18} weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Redo <span className="pb-tooltip-shortcut">Ctrl+Y</span>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="pb-toolbar-divider" />

        {/* Drawing Tools */}
        <div className="pb-toolbar-group">
          {tools.map(tool => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <button
                  className={`pb-tool-btn ${currentTool === tool.id ? 'active' : ''}`}
                  onClick={() => onToolChange(tool.id)}
                >
                  {tool.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent className="pb-tooltip">
                {tool.label} <span className="pb-tooltip-shortcut">{tool.shortcut}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="pb-toolbar-divider" />

        {/* Grid Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={`pb-tool-btn ${gridVisible ? 'active' : ''}`}
              onClick={onGridToggle}
              title="Toggle Grid (G)"
            >
              <GridFour size={18} weight="bold" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="pb-tooltip">
            Toggle Grid <span className="pb-tooltip-shortcut">G</span>
          </TooltipContent>
        </Tooltip>

        <div className="pb-toolbar-divider" />

        {/* Zoom Controls */}
        <div className="pb-toolbar-group">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="pb-tool-btn" onClick={onZoomOut} title="Zoom Out (Ctrl+-)">
                <MagnifyingGlassMinus size={18} weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Zoom Out <span className="pb-tooltip-shortcut">Ctrl+-</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="pb-tool-btn px-2 min-w-[52px] font-mono text-xs"
                onClick={onZoomReset}
              >
                {Math.round(zoom * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Reset Zoom <span className="pb-tooltip-shortcut">Ctrl+0</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="pb-tool-btn" onClick={onZoomIn} title="Zoom In (Ctrl+=)">
                <MagnifyingGlassPlus size={18} weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Zoom In <span className="pb-tooltip-shortcut">Ctrl+=</span>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right side: Save & Export */}
        <div className="ml-auto pb-toolbar-group">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="pb-btn pb-btn-icon" onClick={onSave} title="Save (Ctrl+S)">
                <FloppyDisk size={16} weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Save <span className="pb-tooltip-shortcut">Ctrl+S</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="pb-btn pb-btn-primary pb-btn-icon" onClick={onExport} title="Export (Ctrl+E)">
                <Export size={16} weight="bold" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="pb-tooltip">
              Export <span className="pb-tooltip-shortcut">Ctrl+E</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
