/**
 * EntityDefsPanel - Master-detail panel for entity type definitions
 * Task 4F.2 (T3-09)
 * 
 * Allows creating, editing, and deleting entity definitions including:
 * - Identifier, size, color, tile, tags
 * - Field definitions (add/remove/reorder)
 */

import { useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores'
import { Plus, Trash, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import type { EntityDef, FieldDef, FieldType } from '@/lib/ldtk/types'
import { generateUid, isValidIdentifier } from '@/lib/ldtk/project'

// ============== Helpers ==============

function formatColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

function createDefaultEntityDef(uid: number): EntityDef {
  return {
    uid,
    identifier: `Entity_${uid}`,
    tags: [],
    exportToToc: false,
    allowOutOfBounds: false,
    doc: null,
    width: 16,
    height: 16,
    resizableX: false,
    resizableY: false,
    minWidth: null,
    minHeight: null,
    maxWidth: null,
    maxHeight: null,
    keepAspectRatio: false,
    tileOpacity: 1,
    fillOpacity: 0.08,
    lineOpacity: 0,
    hollow: false,
    color: 0xbe4a2f,
    tilesetId: null,
    tileId: null,
    tileRenderMode: 'FitInside',
    tileRect: null,
    nineSliceBorders: [0, 0, 0, 0],
    maxCount: 0,
    limitScope: 'PerLevel',
    limitBehavior: 'MoveLastOne',
    pivotX: 0.5,
    pivotY: 1,
    fieldDefs: [],
    renderMode: 'Rectangle',
  }
}

function createDefaultFieldDef(uid: number): FieldDef {
  return {
    uid,
    identifier: `field_${uid}`,
    type: 'String',
    isArray: false,
    canBeNull: true,
    arrayMinLength: null,
    arrayMaxLength: null,
    editorDisplayMode: 'Hidden',
    editorDisplayPos: 'Above',
    editorDisplayScale: 1,
    editorAlwaysShow: false,
    editorCutLongValues: true,
    editorTextPrefix: null,
    editorTextSuffix: null,
    defaultOverride: null,
    min: null,
    max: null,
    regex: null,
    acceptFileTypes: null,
    allowedRefs: 'Any',
    allowedRefsEntityUid: null,
    allowedRefTags: [],
    tilesetUid: null,
    enumDefUid: null,
    symmetricalRef: false,
    autoChainRef: false,
    allowOutOfLevelRef: false,
    textLanguageMode: null,
    doc: null,
    useForSmartColor: false,
  }
}

const FIELD_TYPES: FieldType[] = [
  'Int', 'Float', 'Bool', 'String', 'Text', 'Color',
  'Point', 'Enum', 'FilePath', 'Tile', 'EntityRef',
]

// ============== Field Editor Row ==============

function FieldDefRow({
  field,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  field: FieldDef
  onUpdate: (updates: Partial<FieldDef>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <div className="flex items-center gap-1 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-secondary)] p-1.5">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={isFirst}
          onClick={onMoveUp}
        >
          <ArrowUp size={10} />
        </button>
        <button
          type="button"
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={isLast}
          onClick={onMoveDown}
        >
          <ArrowDown size={10} />
        </button>
      </div>
      <Input
        value={field.identifier}
        onChange={(e) => onUpdate({ identifier: e.target.value })}
        className="h-6 flex-1 text-[10px] font-mono"
        placeholder="field_name"
      />
      <select
        value={field.type}
        onChange={(e) => onUpdate({ type: e.target.value as FieldType })}
        className="h-6 rounded border border-[var(--pb-border)] bg-[var(--pb-bg-primary)] px-1 text-[10px]"
      >
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
        <input
          type="checkbox"
          checked={field.isArray}
          onChange={(e) => onUpdate({ isArray: e.target.checked })}
          className="h-3 w-3"
        />
        Arr
      </label>
      <button
        type="button"
        className="p-0.5 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash size={12} />
      </button>
    </div>
  )
}

// ============== Entity Detail Form ==============

function EntityDefDetail({
  entityDef,
  onUpdate,
}: {
  entityDef: EntityDef
  onUpdate: (updates: Partial<EntityDef>) => void
}) {
  const project = useProjectStore((s) => s.project)

  const handleFieldUpdate = useCallback(
    (fieldUid: number, updates: Partial<FieldDef>) => {
      const newFields = entityDef.fieldDefs.map((f) =>
        f.uid === fieldUid ? { ...f, ...updates } : f
      )
      onUpdate({ fieldDefs: newFields })
    },
    [entityDef.fieldDefs, onUpdate]
  )

  const handleFieldDelete = useCallback(
    (fieldUid: number) => {
      onUpdate({ fieldDefs: entityDef.fieldDefs.filter((f) => f.uid !== fieldUid) })
    },
    [entityDef.fieldDefs, onUpdate]
  )

  const handleFieldMove = useCallback(
    (fieldUid: number, direction: -1 | 1) => {
      const idx = entityDef.fieldDefs.findIndex((f) => f.uid === fieldUid)
      if (idx < 0) return
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= entityDef.fieldDefs.length) return
      const newFields = [...entityDef.fieldDefs]
      ;[newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]]
      onUpdate({ fieldDefs: newFields })
    },
    [entityDef.fieldDefs, onUpdate]
  )

  const handleAddField = useCallback(() => {
    if (!project) return
    const uid = project.nextUid++
    const newField = createDefaultFieldDef(uid)
    onUpdate({ fieldDefs: [...entityDef.fieldDefs, newField] })
  }, [project, entityDef.fieldDefs, onUpdate])

  return (
    <div className="space-y-3 p-2">
      {/* Identifier */}
      <div className="space-y-1">
        <Label className="text-[10px]">Identifier</Label>
        <Input
          value={entityDef.identifier}
          onChange={(e) => onUpdate({ identifier: e.target.value })}
          className="h-7 text-xs font-mono"
          placeholder="Entity_Name"
        />
        {entityDef.identifier && !isValidIdentifier(entityDef.identifier) && (
          <p className="text-[9px] text-destructive">Invalid identifier</p>
        )}
      </div>

      {/* Size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Width</Label>
          <Input
            type="number"
            value={entityDef.width}
            onChange={(e) => onUpdate({ width: Math.max(1, Number(e.target.value)) })}
            className="h-7 text-xs font-mono"
            min={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Height</Label>
          <Input
            type="number"
            value={entityDef.height}
            onChange={(e) => onUpdate({ height: Math.max(1, Number(e.target.value)) })}
            className="h-7 text-xs font-mono"
            min={1}
          />
        </div>
      </div>

      {/* Color */}
      <div className="space-y-1">
        <Label className="text-[10px]">Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={formatColor(entityDef.color)}
            onChange={(e) => onUpdate({ color: parseColor(e.target.value) })}
            className="h-7 w-10 cursor-pointer rounded border border-[var(--pb-border)]"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatColor(entityDef.color)}
          </span>
        </div>
      </div>

      {/* Pivot */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Pivot X</Label>
          <Input
            type="number"
            value={entityDef.pivotX}
            onChange={(e) => onUpdate({ pivotX: Number(e.target.value) })}
            className="h-7 text-xs font-mono"
            step={0.1}
            min={0}
            max={1}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Pivot Y</Label>
          <Input
            type="number"
            value={entityDef.pivotY}
            onChange={(e) => onUpdate({ pivotY: Number(e.target.value) })}
            className="h-7 text-xs font-mono"
            step={0.1}
            min={0}
            max={1}
          />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <Label className="text-[10px]">Tags (comma-separated)</Label>
        <Input
          value={entityDef.tags.join(', ')}
          onChange={(e) =>
            onUpdate({
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          className="h-7 text-xs font-mono"
          placeholder="tag1, tag2"
        />
      </div>

      {/* Doc */}
      <div className="space-y-1">
        <Label className="text-[10px]">Documentation</Label>
        <Input
          value={entityDef.doc ?? ''}
          onChange={(e) => onUpdate({ doc: e.target.value || null })}
          className="h-7 text-xs"
          placeholder="Description..."
        />
      </div>

      {/* Fields */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Fields ({entityDef.fieldDefs.length})</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px]"
            onClick={handleAddField}
          >
            <Plus size={10} className="mr-0.5" />
            Add
          </Button>
        </div>
        <div className="space-y-1">
          {entityDef.fieldDefs.map((field, idx) => (
            <FieldDefRow
              key={field.uid}
              field={field}
              onUpdate={(updates) => handleFieldUpdate(field.uid, updates)}
              onDelete={() => handleFieldDelete(field.uid)}
              onMoveUp={() => handleFieldMove(field.uid, -1)}
              onMoveDown={() => handleFieldMove(field.uid, 1)}
              isFirst={idx === 0}
              isLast={idx === entityDef.fieldDefs.length - 1}
            />
          ))}
          {entityDef.fieldDefs.length === 0 && (
            <p className="py-2 text-center text-[9px] text-muted-foreground">No fields defined</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============== Main Panel ==============

export function EntityDefsPanel() {
  const project = useProjectStore((s) => s.project)
  const entityDefs = project?.defs.entities ?? []
  const [selectedUid, setSelectedUid] = useState<number | null>(null)

  const selectedDef = entityDefs.find((d) => d.uid === selectedUid) ?? null

  const handleAdd = useCallback(() => {
    if (!project) return
    const uid = project.nextUid++
    const newDef = createDefaultEntityDef(uid)
    project.defs.entities.push(newDef)
    setSelectedUid(uid)
    useProjectStore.setState({ project: { ...project } })
  }, [project])

  const handleDelete = useCallback(
    (uid: number) => {
      if (!project) return
      project.defs.entities = project.defs.entities.filter((d) => d.uid !== uid)
      if (selectedUid === uid) setSelectedUid(null)
      useProjectStore.setState({ project: { ...project } })
    },
    [project, selectedUid]
  )

  const handleUpdate = useCallback(
    (updates: Partial<EntityDef>) => {
      if (!project || selectedUid === null) return
      const idx = project.defs.entities.findIndex((d) => d.uid === selectedUid)
      if (idx < 0) return
      project.defs.entities[idx] = { ...project.defs.entities[idx], ...updates }
      useProjectStore.setState({ project: { ...project } })
    },
    [project, selectedUid]
  )

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        No project loaded
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--pb-border)] px-2 py-1">
        <span className="text-xs font-medium">Entity Definitions</span>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleAdd}>
          <Plus size={12} className="mr-0.5" />
          New
        </Button>
      </div>

      {/* Content: master-detail split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Master: entity list */}
        <div className="w-1/3 min-w-[100px] border-r border-[var(--pb-border)]">
          <ScrollArea className="h-full">
            <div className="space-y-0.5 p-1">
              {entityDefs.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">
                  No entity defs
                </p>
              ) : (
                entityDefs.map((def) => (
                  <button
                    key={def.uid}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] transition-colors',
                      selectedUid === def.uid
                        ? 'bg-primary/15 text-primary'
                        : 'hover:bg-[var(--pb-bg-secondary)]'
                    )}
                    onClick={() => setSelectedUid(def.uid)}
                  >
                    <div
                      className="h-3 w-3 rounded-sm border border-[var(--pb-border)]"
                      style={{ backgroundColor: formatColor(def.color) }}
                    />
                    <span className="flex-1 truncate font-mono">{def.identifier}</span>
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(def.uid)
                      }}
                    >
                      <Trash size={10} />
                    </button>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Detail: entity editor */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {selectedDef ? (
              <EntityDefDetail entityDef={selectedDef} onUpdate={handleUpdate} />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-[10px] text-muted-foreground">
                Select an entity to edit
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
