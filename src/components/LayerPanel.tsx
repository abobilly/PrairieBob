import { useState, useCallback, useMemo, useRef } from 'react'
import { Eye, EyeSlash, Lock, LockOpen, DotsSixVertical, Trash, Plus, CaretDown, CaretRight, FolderSimple } from '@phosphor-icons/react'
import { Layer, LayerType, LayerGroup } from '@/lib/types'
import { Button } from '@/components/ui/button'
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
  layerGroups?: LayerGroup[]
  onCreateGroup?: (name: string) => void
  onDeleteGroup?: (id: string) => void
  onToggleGroupVisibility?: (id: string) => void
  onToggleGroupLock?: (id: string) => void
  onToggleGroupCollapsed?: (id: string) => void
  onMoveLayerToGroup?: (layerName: string, groupId: string | null) => void
  collisionSourceLayerNames?: string[]
  collisionDerivedOverlayVisible?: boolean
  onSetCollisionSourceLayerEnabled?: (layerName: string, enabled: boolean) => void
  onSetCollisionDerivedOverlayVisible?: (visible: boolean) => void
}

type LayerEntry = { layer: Layer; index: number }

function isCollisionLayer(layer: Layer): boolean {
  return layer.name.trim().toLowerCase() === 'collision'
}

function isGameplayLayer(layer: Layer): boolean {
  if (layer.type === 'objectgroup') return true
  if (isCollisionLayer(layer)) return true
  const normalized = layer.name.trim().toLowerCase()
  return normalized.includes('entity') || normalized.includes('trigger') || normalized.includes('collision')
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
  layerGroups = [],
  onCreateGroup,
  onDeleteGroup,
  onToggleGroupVisibility,
  onToggleGroupLock,
  onToggleGroupCollapsed,
  onMoveLayerToGroup,
  collisionSourceLayerNames = [],
  collisionDerivedOverlayVisible = true,
  onSetCollisionSourceLayerEnabled,
  onSetCollisionDerivedOverlayVisible,
}: LayerPanelProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newLayerName, setNewLayerName] = useState('')
  const [newLayerType, setNewLayerType] = useState<LayerType>('tilelayer')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [addGroupDialogOpen, setAddGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const suppressNextRowSelectionRef = useRef(false)
  const layerEntries = useMemo<LayerEntry[]>(
    () => [...layers].reverse().map((layer, reverseIndex) => ({
      layer,
      index: layers.length - 1 - reverseIndex,
    })),
    [layers]
  )
  const gameplayEntries = useMemo(
    () => layerEntries.filter(({ layer }) => isGameplayLayer(layer)),
    [layerEntries]
  )
  const artEntries = useMemo(
    () => layerEntries.filter(({ layer }) => !isGameplayLayer(layer)),
    [layerEntries]
  )
  const collisionSourceLayerSet = useMemo(
    () => new Set(collisionSourceLayerNames),
    [collisionSourceLayerNames]
  )
  const collisionCandidates = useMemo(
    () => layers.filter((layer) => layer.type === 'tilelayer' && !isCollisionLayer(layer)),
    [layers]
  )

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

  const isInteractiveLayerEvent = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest?.('[data-layer-interactive="true"]')) return true
    const nativeEvent = event.nativeEvent as MouseEvent & { composedPath?: () => EventTarget[] }
    if (typeof nativeEvent.composedPath === 'function') {
      const path = nativeEvent.composedPath()
      return path.some((entry) => {
        return entry instanceof HTMLElement && entry.dataset?.layerInteractive === 'true'
      })
    }
    return false
  }, [])

  const handleRowClick = useCallback((index: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextRowSelectionRef.current) {
      suppressNextRowSelectionRef.current = false
      return
    }
    if (isInteractiveLayerEvent(event)) return
    onLayerSelect(index)
  }, [isInteractiveLayerEvent, onLayerSelect])

  const renderLayerRow = useCallback((entry: LayerEntry) => {
    const { layer, index } = entry
    const isActive = index === activeLayerIndex
    const isDragging = dragIndex === index
    const isDragOver = dragOverIndex === index

    return (
      <div
        key={index}
        draggable={false}
        onDragOver={(e) => handleDragOver(index, e)}
        onDrop={(e) => handleDrop(index, e)}
        onDragEnd={handleDragEnd}
        className={`pb-layer-compact ${isActive ? 'active' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'ring-1 ring-accent' : ''}`}
        onClick={(e) => handleRowClick(index, e)}
      >
        {onLayerReorder && (
          <div
            data-layer-interactive="true"
            draggable
            onDragStart={(e) => handleDragStart(index, e)}
            onDragEnd={handleDragEnd}
            onMouseDown={(e) => e.stopPropagation()}
            className="cursor-grab opacity-40 hover:opacity-100"
            title="Drag to reorder"
          >
            <DotsSixVertical size={10} />
          </div>
        )}

        <button
          data-layer-interactive="true"
          className="pb-icon-btn-xs"
          onClick={(e) => {
            e.stopPropagation()
            onLayerToggle(index, 'visible')
          }}
          title={layer.visible ? 'Hide' : 'Show'}
        >
          {layer.visible ? <Eye size={10} /> : <EyeSlash size={10} className="opacity-40" />}
        </button>

        <button
          data-layer-interactive="true"
          className="pb-icon-btn-xs"
          onClick={(e) => {
            e.stopPropagation()
            onLayerToggle(index, 'locked')
          }}
          title={layer.locked ? 'Unlock' : 'Lock'}
        >
          {layer.locked ? <Lock size={10} className="text-amber-500" /> : <LockOpen size={10} className="opacity-40" />}
        </button>

        {onLayerOpacityChange && (
          <div
            data-layer-interactive="true"
            className="pb-opacity-slider"
            title={`${Math.round((layer.opacity ?? 1) * 100)}%`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
              suppressNextRowSelectionRef.current = true
              e.stopPropagation()
            }}
            onMouseUp={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              suppressNextRowSelectionRef.current = true
              e.stopPropagation()
            }}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerCancel={() => {
              suppressNextRowSelectionRef.current = false
            }}
          >
            <input
              data-layer-interactive="true"
              type="range"
              title="Layer opacity"
              value={Math.round((layer.opacity ?? 1) * 100)}
              onChange={(e) => onLayerOpacityChange(index, Number(e.target.value) / 100)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                suppressNextRowSelectionRef.current = true
                e.stopPropagation()
              }}
              onMouseUp={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                suppressNextRowSelectionRef.current = true
                e.stopPropagation()
              }}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerCancel={() => {
                suppressNextRowSelectionRef.current = false
              }}
              min={0}
              max={100}
              step={10}
              className="w-full h-1 accent-primary"
            />
          </div>
        )}

        {editingIndex === index ? (
          <input
            data-layer-interactive="true"
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
            className="flex-1 bg-transparent border-b border-accent text-[11px] outline-none px-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            title="Layer name"
            placeholder="Layer name"
          />
        ) : (
          <span
            className="pb-layer-compact-name"
            onDoubleClick={(e) => handleStartRename(index, layer.name, e)}
            title={layer.name}
          >
            {layer.name}
          </span>
        )}

        <span className="pb-layer-compact-type">
          {isCollisionLayer(layer) ? 'Collision' : layer.type === 'tilelayer' ? 'Tile' : 'Entity'}
        </span>

        {onLayerDelete && layers.length > 1 && (
          <button
            data-layer-interactive="true"
            className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation()
              onLayerDelete(index)
            }}
            title="Delete"
          >
            <Trash size={10} />
          </button>
        )}
      </div>
    )
  }, [
    activeLayerIndex,
    dragIndex,
    dragOverIndex,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleDragStart,
    handleFinishRename,
    handleRowClick,
    handleStartRename,
    layers.length,
    editingIndex,
    editingName,
    onLayerDelete,
    onLayerOpacityChange,
    onLayerReorder,
    onLayerToggle,
    setEditingName,
  ])

  return (
    <>
      <div className="pb-compact-panel pb-compact-layers flex flex-col h-full">
        {/* Compact header */}
        <div className="pb-compact-header">
          <span className="pb-compact-title">Layers</span>
          <div className="flex gap-0.5">
            {onCreateGroup && (
              <button
                className="pb-icon-btn-xs"
                onClick={() => setAddGroupDialogOpen(true)}
                title="New group"
              >
                <FolderSimple size={12} />
              </button>
            )}
            {onLayerAdd && (
              <button
                className="pb-icon-btn-xs"
                onClick={() => setAddDialogOpen(true)}
                title="Add layer"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Layer list */}
        <div className="flex-1 overflow-y-auto p-1 min-h-[140px]">
          {onSetCollisionSourceLayerEnabled && collisionCandidates.length > 0 && (
            <div className="mb-2 rounded border border-[var(--pb-border-subtle)] bg-[var(--pb-bg-input)] p-2">
              <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
                Collision Sources
              </div>
              {onSetCollisionDerivedOverlayVisible && (
                <label className="mb-2 flex cursor-pointer items-center justify-between gap-2 text-[10px] text-[var(--pb-text-secondary)]">
                  <span>Show derived overlay</span>
                  <input
                    type="checkbox"
                    checked={collisionDerivedOverlayVisible}
                    onChange={(event) => onSetCollisionDerivedOverlayVisible(event.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </label>
              )}
              <div className="flex flex-col gap-1">
                {collisionCandidates.map((layer) => {
                  const linked = collisionSourceLayerSet.has(layer.name)
                  return (
                    <label
                      key={layer.name}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] hover:bg-[var(--pb-bg-hover)]"
                    >
                      <span className="truncate">{layer.name}</span>
                      <input
                        type="checkbox"
                        checked={linked}
                        onChange={(event) => onSetCollisionSourceLayerEnabled(layer.name, event.target.checked)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {layers.length === 0 ? (
            <div className="text-[10px] text-muted-foreground p-2">No layers</div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Static layer groups */}
              {layerGroups.filter(g => g.type === 'static').map((group) => {
                const groupLayerEntries = layerEntries.filter(({ layer }) =>
                  group.layerIds.includes(layer.name)
                )
                return (
                  <div key={group.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 px-1 py-0.5 rounded" style={{ borderLeft: `2px solid ${group.color || '#666'}` }}>
                      <button
                        className="pb-icon-btn-xs"
                        onClick={() => onToggleGroupCollapsed?.(group.id)}
                        title={group.collapsed ? 'Expand' : 'Collapse'}
                      >
                        {group.collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
                      </button>
                      <button
                        className="pb-icon-btn-xs"
                        onClick={() => onToggleGroupVisibility?.(group.id)}
                        title={group.visible ? 'Hide group' : 'Show group'}
                      >
                        {group.visible ? <Eye size={10} /> : <EyeSlash size={10} className="opacity-40" />}
                      </button>
                      <button
                        className="pb-icon-btn-xs"
                        onClick={() => onToggleGroupLock?.(group.id)}
                        title={group.locked ? 'Unlock group' : 'Lock group'}
                      >
                        {group.locked ? <Lock size={10} className="text-amber-500" /> : <LockOpen size={10} className="opacity-40" />}
                      </button>
                      <span className="flex-1 text-[10px] font-medium truncate">{group.name}</span>
                      {onDeleteGroup && (
                        <button
                          className="pb-icon-btn-xs text-red-400/50 hover:text-red-400"
                          onClick={() => onDeleteGroup(group.id)}
                          title="Delete group"
                        >
                          <Trash size={10} />
                        </button>
                      )}
                    </div>
                    {!group.collapsed && (
                      <div className="ml-3 flex flex-col gap-0.5">
                        {groupLayerEntries.length > 0 ? (
                          groupLayerEntries.map(renderLayerRow)
                        ) : (
                          <div className="text-[9px] text-muted-foreground px-2 py-1 italic">Empty group</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ungrouped layers */}
              {(() => {
                const groupedLayerNames = new Set(
                  layerGroups.flatMap(g => g.layerIds)
                )
                const ungroupedGameplay = gameplayEntries.filter(({ layer }) => !groupedLayerNames.has(layer.name))
                const ungroupedArt = artEntries.filter(({ layer }) => !groupedLayerNames.has(layer.name))
                return (
                  <>
                    {ungroupedArt.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
                          Art Layers
                        </div>
                        {ungroupedArt.map(renderLayerRow)}
                      </div>
                    )}
                    {ungroupedGameplay.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
                          Gameplay
                        </div>
                        {ungroupedGameplay.map(renderLayerRow)}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
      </div>

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

      {/* Add Group Dialog */}
      <Dialog open={addGroupDialogOpen} onOpenChange={setAddGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Layer Group</DialogTitle>
            <DialogDescription>
              Create a group to organize layers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGroupName.trim() && onCreateGroup) {
                    onCreateGroup(newGroupName.trim())
                    setNewGroupName('')
                    setAddGroupDialogOpen(false)
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newGroupName.trim() && onCreateGroup) {
                  onCreateGroup(newGroupName.trim())
                  setNewGroupName('')
                  setAddGroupDialogOpen(false)
                }
              }}
              disabled={!newGroupName.trim()}
            >
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
