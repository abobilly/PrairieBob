import { useState, useCallback, useEffect } from 'react'
import { Eye, EyeSlash, Lock, LockOpen, DotsSixVertical, Trash, Plus, PencilSimple } from '@phosphor-icons/react'
import { Layer, LayerType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface LayerPanelProps {
  layers: Layer[]
  activeLayerIndex: number
  onLayerSelect: (index: number) => void
  onLayerToggle: (index: number, prop: 'visible' | 'locked') => void
  onLayerReorder?: (fromIndex: number, toIndex: number) => void
  onLayerAdd?: (name: string, type: LayerType) => void
  onLayerDelete?: (index: number) => void
  onLayerRename?: (index: number, name: string) => void
  onLayerOpacityChange?: (index: number, opacity: number) => void
}

export function LayerPanel({
  layers,
  activeLayerIndex,
  onLayerSelect,
  onLayerToggle,
  onLayerReorder,
  onLayerAdd,
  onLayerDelete,
  onLayerRename,
  onLayerOpacityChange,
}: LayerPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newLayerName, setNewLayerName] = useState('')
  const [newLayerType, setNewLayerType] = useState<LayerType>('tilelayer')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Debug: log layers state
  useEffect(() => {
    console.log('[LayerPanel] layers:', layers.length, layers.map(l => ({ name: l.name, type: l.type, visible: l.visible })))
    console.log('[LayerPanel] activeLayerIndex:', activeLayerIndex)
  }, [layers, activeLayerIndex])

  // Handle add layer dialog
  const handleAddLayer = useCallback(() => {
    if (onLayerAdd && newLayerName.trim()) {
      onLayerAdd(newLayerName.trim(), newLayerType)
      setNewLayerName('')
      setNewLayerType('tilelayer')
      setAddDialogOpen(false)
    }
  }, [onLayerAdd, newLayerName, newLayerType])

  // Handle inline rename
  const handleStartRename = useCallback((index: number, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIndex(index)
    setEditingName(currentName)
  }, [])

  const handleFinishRename = useCallback(() => {
    if (editingIndex !== null && onLayerRename && editingName.trim()) {
      onLayerRename(editingIndex, editingName.trim())
    }
    setEditingIndex(null)
    setEditingName('')
  }, [editingIndex, editingName, onLayerRename])

  // Handle drag reorder
  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((toIndex: number, e: React.DragEvent) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== toIndex && onLayerReorder) {
      onLayerReorder(dragIndex, toIndex)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, onLayerReorder])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex justify-between items-center">
            <span>Layers</span>
            {onLayerAdd && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setAddDialogOpen(true)}
                title="Add layer"
              >
                <Plus size={16} />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {layers.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2">No layers loaded.</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
              <div className="flex flex-col gap-1">
                {[...layers].reverse().map((layer, reverseIndex) => {
                  const index = layers.length - 1 - reverseIndex
                  const isActive = index === activeLayerIndex
                  const isDragging = dragIndex === index
                  const isDragOver = dragOverIndex === index

                  return (
                    <div
                      key={index}
                      draggable={!!onLayerReorder}
                      onDragStart={(e) => handleDragStart(index, e)}
                      onDragOver={(e) => handleDragOver(index, e)}
                      onDrop={(e) => handleDrop(index, e)}
                      onDragEnd={handleDragEnd}
                      className={`
                      flex flex-col gap-1 p-2 rounded border transition-all
                      ${isActive ? 'bg-accent/20 border-accent' : 'bg-card border-border hover:bg-secondary/50'}
                      ${isDragging ? 'opacity-50' : ''}
                      ${isDragOver ? 'border-primary border-2' : ''}
                      cursor-pointer
                    `}
                      onClick={() => onLayerSelect(index)}
                    >
                      {/* Main row - Aseprite-style compact controls */}
                      <div className="flex items-center gap-1">
                        {/* Drag handle */}
                        {onLayerReorder && (
                          <div className="layer-drag-handle cursor-grab" title="Drag to reorder">
                            <DotsSixVertical size={14} />
                          </div>
                        )}

                        {/* Visibility toggle */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onLayerToggle(index, 'visible')
                          }}
                          title={layer.visible ? 'Hide layer' : 'Show layer'}
                        >
                          {layer.visible ? <Eye size={14} /> : <EyeSlash size={14} className="opacity-50" />}
                        </Button>

                        {/* Lock toggle */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onLayerToggle(index, 'locked')
                          }}
                          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                        >
                          {layer.locked ? <Lock size={14} className="text-amber-500" /> : <LockOpen size={14} className="opacity-50" />}
                        </Button>

                        {/* Aseprite-style inline opacity (always visible) */}
                        {onLayerOpacityChange && (
                          <div className="flex items-center gap-1 w-16 shrink-0" title={`Opacity: ${Math.round((layer.opacity ?? 1) * 100)}%`}>
                            <Slider
                              value={[(layer.opacity ?? 1) * 100]}
                              onValueChange={([v]) => onLayerOpacityChange(index, v / 100)}
                              onClick={(e) => e.stopPropagation()}
                              min={0}
                              max={100}
                              step={5}
                              className="h-3"
                            />
                          </div>
                        )}

                        {/* Layer name (editable) */}
                        {editingIndex === index ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleFinishRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinishRename()
                              if (e.key === 'Escape') {
                                setEditingIndex(null)
                                setEditingName('')
                              }
                            }}
                            className="h-5 text-xs flex-1"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="text-xs flex-1 truncate"
                            onDoubleClick={(e) => handleStartRename(index, layer.name, e)}
                            title="Double-click to rename"
                          >
                            {layer.name}
                          </span>
                        )}

                        {/* Type badge */}
                        <span className="text-[10px] text-muted-foreground px-1 bg-secondary rounded">
                          {layer.type === 'tilelayer' ? 'tile' : 'obj'}
                        </span>

                        {/* Rename button */}
                        {onLayerRename && editingIndex !== index && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100"
                            onClick={(e) => handleStartRename(index, layer.name, e)}
                            title="Rename layer"
                          >
                            <PencilSimple size={12} />
                          </Button>
                        )}

                        {/* Delete button */}
                        {onLayerDelete && layers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive/50 hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLayerDelete(index)
                            }}
                            title="Delete layer"
                          >
                            <Trash size={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Layer Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Layer</DialogTitle>
            <DialogDescription>
              Create a new layer for your map.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="layer-name">Layer Name</Label>
              <Input
                id="layer-name"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                placeholder="e.g., Decorations"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddLayer()
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="layer-type">Layer Type</Label>
              <Select value={newLayerType} onValueChange={(v) => setNewLayerType(v as LayerType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tilelayer">Tile Layer</SelectItem>
                  <SelectItem value="objectgroup">Object Layer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLayer} disabled={!newLayerName.trim()}>
              Add Layer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

