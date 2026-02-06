/**
 * LayerDefsPanel - Master-detail panel for layer definitions
 * Task 4F.1 (T4-03)
 *
 * Allows creating, editing, and deleting layer definitions including:
 * - Identifier, type (Tiles/IntGrid/Entities/AutoLayer)
 * - Grid size, opacity, tileset, intgrid values
 * - Parallax, tags, reorder (z-index)
 */

import { useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores'
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  Copy,
  StackSimple,
  GridFour,
  Cube,
  MagicWand,
} from '@phosphor-icons/react'
import type { LayerDef, LayerType, IntGridValueDef } from '@/lib/ldtk/types'
import { isValidIdentifier } from '@/lib/ldtk/project'

// ============== Helpers ==============

const LAYER_TYPE_OPTIONS: { value: LayerType; label: string }[] = [
  { value: 'IntGrid', label: 'IntGrid' },
  { value: 'Entities', label: 'Entities' },
  { value: 'Tiles', label: 'Tiles' },
  { value: 'AutoLayer', label: 'Auto Layer' },
]

function layerTypeIcon(type: LayerType) {
  switch (type) {
    case 'IntGrid':
      return <GridFour className="h-4 w-4" />
    case 'Entities':
      return <Cube className="h-4 w-4" />
    case 'Tiles':
      return <StackSimple className="h-4 w-4" />
    case 'AutoLayer':
      return <MagicWand className="h-4 w-4" />
  }
}

function formatColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

const DEFAULT_INTGRID_COLORS = [
  0x6ecb64, 0xcb6e6e, 0x6e93cb, 0xcbc56e, 0xb06ecb,
  0x6ecbc5, 0xcba06e, 0x8b6ecb, 0x6ecb8b, 0xcb6ea0,
]

function createDefaultLayerDef(uid: number, type: LayerType = 'IntGrid'): LayerDef {
  return {
    uid,
    identifier: `Layer_${uid}`,
    type,
    doc: null,
    uiColor: null,
    gridSize: 16,
    guideGridWid: 0,
    guideGridHei: 0,
    displayOpacity: 1,
    inactiveOpacity: 0.6,
    hideInList: false,
    hideFieldsWhenInactive: false,
    canSelectWhenInactive: true,
    renderInWorldView: true,
    pxOffsetX: 0,
    pxOffsetY: 0,
    parallaxFactorX: 0,
    parallaxFactorY: 0,
    parallaxScaling: true,
    tilesetDefUid: null,
    biomeFieldUid: null,
    autoSourceLayerDefUid: null,
    autoTilesKilledByOtherLayerUid: null,
    intGridValues: type === 'IntGrid' ? [createDefaultIntGridValue(1)] : [],
    intGridValuesGroups: [],
    autoRuleGroups: [],
    tilePivotX: 0,
    tilePivotY: 0,
    requiredTags: [],
    excludedTags: [],
    uiFilterTags: [],
    useAsyncRender: false,
  }
}

function createDefaultIntGridValue(value: number): IntGridValueDef {
  return {
    value,
    identifier: null,
    color: DEFAULT_INTGRID_COLORS[(value - 1) % DEFAULT_INTGRID_COLORS.length],
    tile: null,
    groupUid: 0,
  }
}

// ============== IntGrid Value Row ==============

function IntGridValueRow({
  valueDef,
  onUpdate,
  onRemove,
}: {
  valueDef: IntGridValueDef
  onUpdate: (updated: IntGridValueDef) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] p-2">
      <span className="min-w-[20px] text-xs text-[var(--pb-text-muted)]">{valueDef.value}</span>
      <input
        type="color"
        value={formatColor(valueDef.color)}
        onChange={(e) => onUpdate({ ...valueDef, color: parseColor(e.target.value) })}
        className="h-6 w-6 cursor-pointer rounded border-none"
        title="IntGrid color"
      />
      <Input
        value={valueDef.identifier ?? ''}
        onChange={(e) =>
          onUpdate({ ...valueDef, identifier: e.target.value || null })
        }
        placeholder={`Value ${valueDef.value}`}
        className="h-7 flex-1 text-xs"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-6 w-6 p-0 text-[var(--pb-text-muted)] hover:text-[var(--pb-error)]"
        title="Remove value"
      >
        <Trash className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ============== Layer Detail Form ==============

function LayerDetailForm({
  layerDef,
  tilesetDefs,
  onUpdate,
}: {
  layerDef: LayerDef
  tilesetDefs: { uid: number; identifier: string }[]
  onUpdate: (updated: LayerDef) => void
}) {
  const showTileset = layerDef.type === 'Tiles' || layerDef.type === 'AutoLayer'
  const showIntGrid = layerDef.type === 'IntGrid'

  const updateField = useCallback(
    <K extends keyof LayerDef>(key: K, value: LayerDef[K]) => {
      onUpdate({ ...layerDef, [key]: value })
    },
    [layerDef, onUpdate],
  )

  const handleTypeChange = useCallback(
    (newType: LayerType) => {
      const updated = { ...layerDef, type: newType }
      // Initialize intgrid values if switching to IntGrid
      if (newType === 'IntGrid' && updated.intGridValues.length === 0) {
        updated.intGridValues = [createDefaultIntGridValue(1)]
      }
      // Clear tileset if not needed
      if (newType !== 'Tiles' && newType !== 'AutoLayer') {
        updated.tilesetDefUid = null
      }
      onUpdate(updated)
    },
    [layerDef, onUpdate],
  )

  const handleAddIntGridValue = useCallback(() => {
    const nextValue =
      layerDef.intGridValues.length > 0
        ? Math.max(...layerDef.intGridValues.map((v) => v.value)) + 1
        : 1
    onUpdate({
      ...layerDef,
      intGridValues: [...layerDef.intGridValues, createDefaultIntGridValue(nextValue)],
    })
  }, [layerDef, onUpdate])

  const handleUpdateIntGridValue = useCallback(
    (index: number, updated: IntGridValueDef) => {
      const values = [...layerDef.intGridValues]
      values[index] = updated
      onUpdate({ ...layerDef, intGridValues: values })
    },
    [layerDef, onUpdate],
  )

  const handleRemoveIntGridValue = useCallback(
    (index: number) => {
      const values = layerDef.intGridValues.filter((_, i) => i !== index)
      onUpdate({ ...layerDef, intGridValues: values })
    },
    [layerDef, onUpdate],
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Identifier */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[var(--pb-text-muted)]">Identifier</Label>
        <Input
          value={layerDef.identifier}
          onChange={(e) => updateField('identifier', e.target.value)}
          className={cn(
            'h-8 text-sm',
            !isValidIdentifier(layerDef.identifier) && 'border-[var(--pb-error)]',
          )}
        />
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[var(--pb-text-muted)]">Type</Label>
        <select
          value={layerDef.type}
          onChange={(e) => handleTypeChange(e.target.value as LayerType)}
          className="h-8 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] px-2 text-sm text-[var(--pb-text)]"
        >
          {LAYER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Size */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[var(--pb-text-muted)]">Grid Size</Label>
        <Input
          type="number"
          value={layerDef.gridSize}
          onChange={(e) => updateField('gridSize', Math.max(1, parseInt(e.target.value) || 1))}
          min={1}
          className="h-8 text-sm"
        />
      </div>

      {/* Display Opacity */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[var(--pb-text-muted)]">
          Opacity ({Math.round(layerDef.displayOpacity * 100)}%)
        </Label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={layerDef.displayOpacity}
          onChange={(e) => updateField('displayOpacity', parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Inactive Opacity */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-[var(--pb-text-muted)]">
          Inactive Opacity ({Math.round(layerDef.inactiveOpacity * 100)}%)
        </Label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={layerDef.inactiveOpacity}
          onChange={(e) => updateField('inactiveOpacity', parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Tileset (for Tiles/AutoLayer) */}
      {showTileset && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[var(--pb-text-muted)]">Tileset</Label>
          <select
            value={layerDef.tilesetDefUid ?? ''}
            onChange={(e) =>
              updateField('tilesetDefUid', e.target.value ? Number(e.target.value) : null)
            }
            className="h-8 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] px-2 text-sm text-[var(--pb-text)]"
          >
            <option value="">None</option>
            {tilesetDefs.map((ts) => (
              <option key={ts.uid} value={ts.uid}>
                {ts.identifier}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* IntGrid Values */}
      {showIntGrid && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-[var(--pb-text-muted)]">IntGrid Values</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddIntGridValue}
              className="h-6 gap-1 px-2 text-xs"
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {layerDef.intGridValues.map((val, i) => (
              <IntGridValueRow
                key={val.value}
                valueDef={val}
                onUpdate={(updated) => handleUpdateIntGridValue(i, updated)}
                onRemove={() => handleRemoveIntGridValue(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Parallax */}
      <div className="border-t border-[var(--pb-border)] pt-4">
        <Label className="mb-2 block text-xs font-semibold text-[var(--pb-text-muted)]">
          Parallax
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[var(--pb-text-muted)]">Factor X</Label>
            <Input
              type="number"
              value={layerDef.parallaxFactorX}
              onChange={(e) => updateField('parallaxFactorX', parseFloat(e.target.value) || 0)}
              step={0.1}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[var(--pb-text-muted)]">Factor Y</Label>
            <Input
              type="number"
              value={layerDef.parallaxFactorY}
              onChange={(e) => updateField('parallaxFactorY', parseFloat(e.target.value) || 0)}
              step={0.1}
              className="h-7 text-xs"
            />
          </div>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--pb-text)]">
          <input
            type="checkbox"
            checked={layerDef.parallaxScaling}
            onChange={(e) => updateField('parallaxScaling', e.target.checked)}
          />
          Scale with parallax
        </label>
      </div>

      {/* Offset */}
      <div className="border-t border-[var(--pb-border)] pt-4">
        <Label className="mb-2 block text-xs font-semibold text-[var(--pb-text-muted)]">
          Pixel Offset
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[var(--pb-text-muted)]">X</Label>
            <Input
              type="number"
              value={layerDef.pxOffsetX}
              onChange={(e) => updateField('pxOffsetX', parseInt(e.target.value) || 0)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[var(--pb-text-muted)]">Y</Label>
            <Input
              type="number"
              value={layerDef.pxOffsetY}
              onChange={(e) => updateField('pxOffsetY', parseInt(e.target.value) || 0)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="border-t border-[var(--pb-border)] pt-4">
        <Label className="mb-2 block text-xs font-semibold text-[var(--pb-text-muted)]">
          Options
        </Label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
            <input
              type="checkbox"
              checked={layerDef.hideInList}
              onChange={(e) => updateField('hideInList', e.target.checked)}
            />
            Hide in layer list
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
            <input
              type="checkbox"
              checked={layerDef.renderInWorldView}
              onChange={(e) => updateField('renderInWorldView', e.target.checked)}
            />
            Show in world view
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--pb-text)]">
            <input
              type="checkbox"
              checked={layerDef.canSelectWhenInactive}
              onChange={(e) => updateField('canSelectWhenInactive', e.target.checked)}
            />
            Selectable when inactive
          </label>
        </div>
      </div>

      {/* Documentation */}
      <div className="border-t border-[var(--pb-border)] pt-4">
        <Label className="text-xs text-[var(--pb-text-muted)]">Documentation</Label>
        <textarea
          value={layerDef.doc ?? ''}
          onChange={(e) => updateField('doc', e.target.value || null)}
          placeholder="Layer description..."
          rows={3}
          className="mt-1 w-full resize-y rounded border border-[var(--pb-border)] bg-[var(--pb-bg-input)] p-2 text-xs text-[var(--pb-text)] placeholder:text-[var(--pb-text-muted)]"
        />
      </div>
    </div>
  )
}

// ============== Main Panel ==============

export function LayerDefsPanel() {
  const project = useProjectStore((s) => s.project)
  const [selectedUid, setSelectedUid] = useState<number | null>(null)

  const layerDefs = project?.defs.layers ?? []
  const tilesetDefs = (project?.defs.tilesets ?? []).map((t) => ({
    uid: t.uid,
    identifier: t.identifier,
  }))
  const selectedLayer = layerDefs.find((l) => l.uid === selectedUid) ?? null

  const updateLayers = useCallback(
    (updater: (layers: LayerDef[]) => LayerDef[]) => {
      if (!project) return
      const updated = { ...project, defs: { ...project.defs, layers: updater([...project.defs.layers]) } }
      useProjectStore.setState({ project: updated })
    },
    [project],
  )

  const handleAdd = useCallback(() => {
    if (!project) return
    const uid = project.nextUid++
    const newLayer = createDefaultLayerDef(uid)
    updateLayers((layers) => [...layers, newLayer])
    setSelectedUid(uid)
  }, [project, updateLayers])

  const handleDuplicate = useCallback(() => {
    if (!selectedLayer || !project) return
    const uid = project.nextUid++
    const dup: LayerDef = { ...selectedLayer, uid, identifier: `${selectedLayer.identifier}_copy` }
    updateLayers((layers) => {
      const idx = layers.findIndex((l) => l.uid === selectedLayer.uid)
      const next = [...layers]
      next.splice(idx + 1, 0, dup)
      return next
    })
    setSelectedUid(uid)
  }, [selectedLayer, updateLayers])

  const handleDelete = useCallback(() => {
    if (!selectedLayer) return
    updateLayers((layers) => layers.filter((l) => l.uid !== selectedLayer.uid))
    setSelectedUid(null)
  }, [selectedLayer, updateLayers])

  const handleMoveUp = useCallback(() => {
    if (!selectedLayer) return
    updateLayers((layers) => {
      const idx = layers.findIndex((l) => l.uid === selectedLayer.uid)
      if (idx <= 0) return layers
      const next = [...layers]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [selectedLayer, updateLayers])

  const handleMoveDown = useCallback(() => {
    if (!selectedLayer) return
    updateLayers((layers) => {
      const idx = layers.findIndex((l) => l.uid === selectedLayer.uid)
      if (idx < 0 || idx >= layers.length - 1) return layers
      const next = [...layers]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [selectedLayer, updateLayers])

  const handleUpdateLayer = useCallback(
    (updated: LayerDef) => {
      updateLayers((layers) => layers.map((l) => (l.uid === updated.uid ? updated : l)))
    },
    [updateLayers],
  )

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--pb-text-muted)]">
        No project loaded
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: Layer List */}
      <div className="flex w-[240px] flex-col border-r border-[var(--pb-border)]">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-[var(--pb-border)] p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-7 gap-1 px-2 text-xs"
            title="Add layer"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDuplicate}
            disabled={!selectedLayer}
            className="h-7 w-7 p-0"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={!selectedLayer}
            className="h-7 w-7 p-0 text-[var(--pb-text-muted)] hover:text-[var(--pb-error)]"
            title="Delete"
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMoveUp}
            disabled={!selectedLayer}
            className="h-7 w-7 p-0"
            title="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMoveDown}
            disabled={!selectedLayer}
            className="h-7 w-7 p-0"
            title="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-1">
            {layerDefs.map((layer, index) => (
              <button
                key={layer.uid}
                onClick={() => setSelectedUid(layer.uid)}
                className={cn(
                  'flex items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors',
                  layer.uid === selectedUid
                    ? 'bg-[var(--pb-bg-selected)] text-[var(--pb-text)]'
                    : 'text-[var(--pb-text-muted)] hover:bg-[var(--pb-bg-hover)]',
                )}
              >
                <span className="flex-shrink-0 text-[var(--pb-text-muted)]">
                  {layerTypeIcon(layer.type)}
                </span>
                <span className="flex-1 truncate">{layer.identifier}</span>
                <span className="text-[10px] text-[var(--pb-text-muted)]">{index}</span>
              </button>
            ))}
            {layerDefs.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-[var(--pb-text-muted)]">
                No layers defined.
                <br />
                Click &quot;Add&quot; to create one.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Detail Form */}
      <div className="flex-1">
        {selectedLayer ? (
          <ScrollArea className="h-full">
            <LayerDetailForm
              layerDef={selectedLayer}
              tilesetDefs={tilesetDefs}
              onUpdate={handleUpdateLayer}
            />
          </ScrollArea>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--pb-text-muted)]">
            Select a layer to edit
          </div>
        )}
      </div>
    </div>
  )
}
