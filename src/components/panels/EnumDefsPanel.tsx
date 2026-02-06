/**
 * EnumDefsPanel - Panel for defining enums (IntGrid, tags, etc.)
 * Task 4F.4 (T3-11)
 * 
 * Allows creating, editing, and deleting enum definitions including:
 * - Identifier
 * - Values (identifier, color, tile)
 * - Reorder/delete values
 */

import { useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores'
import { Plus, Trash, ArrowUp, ArrowDown, ListBullets } from '@phosphor-icons/react'
import type { EnumDef, EnumValueDef } from '@/lib/ldtk/types'
import { isValidIdentifier } from '@/lib/ldtk/project'

// ============== Helpers ==============

function formatColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function parseColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

// Default colors for new enum values
const DEFAULT_ENUM_COLORS = [
  0xbe4a2f, 0xd77643, 0xead4aa, 0xe4a672, 0xb86f50,
  0x733e39, 0x3e2731, 0xa22633, 0xe43b44, 0xf77622,
  0xfeae34, 0xfee761, 0x63c74d, 0x3e8948, 0x265c42,
  0x193c3e, 0x124e89, 0x0099db, 0x2ce8f5, 0xbfecf0,
]

function createDefaultEnumDef(uid: number): EnumDef {
  return {
    uid,
    identifier: `Enum_${uid}`,
    values: [],
    iconTilesetUid: null,
    externalRelPath: null,
    externalFileChecksum: null,
    tags: [],
  }
}

function createDefaultEnumValue(id: string, colorIndex: number): EnumValueDef {
  return {
    id,
    tileRect: null,
    color: DEFAULT_ENUM_COLORS[colorIndex % DEFAULT_ENUM_COLORS.length],
  }
}

// ============== Enum Value Row ==============

function EnumValueRow({
  value,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  value: EnumValueDef
  onUpdate: (updates: Partial<EnumValueDef>) => void
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
      <input
        type="color"
        value={formatColor(value.color)}
        onChange={(e) => onUpdate({ color: parseColor(e.target.value) })}
        className="h-6 w-6 cursor-pointer rounded border border-[var(--pb-border)]"
      />
      <Input
        value={value.id}
        onChange={(e) => onUpdate({ id: e.target.value })}
        className="h-6 flex-1 text-[10px] font-mono"
        placeholder="value_name"
      />
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

// ============== Enum Detail Form ==============

function EnumDefDetail({
  enumDef,
  onUpdate,
}: {
  enumDef: EnumDef
  onUpdate: (updates: Partial<EnumDef>) => void
}) {
  const handleValueUpdate = useCallback(
    (valueId: string, updates: Partial<EnumValueDef>) => {
      const newValues = enumDef.values.map((v) =>
        v.id === valueId ? { ...v, ...updates } : v
      )
      onUpdate({ values: newValues })
    },
    [enumDef.values, onUpdate]
  )

  const handleValueDelete = useCallback(
    (valueId: string) => {
      onUpdate({ values: enumDef.values.filter((v) => v.id !== valueId) })
    },
    [enumDef.values, onUpdate]
  )

  const handleValueMove = useCallback(
    (valueId: string, direction: -1 | 1) => {
      const idx = enumDef.values.findIndex((v) => v.id === valueId)
      if (idx < 0) return
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= enumDef.values.length) return
      const newValues = [...enumDef.values]
      ;[newValues[idx], newValues[newIdx]] = [newValues[newIdx], newValues[newIdx < idx ? idx : newIdx < idx ? newIdx : idx]]
      // Simpler swap
      const temp = newValues[idx]
      newValues[idx] = newValues[newIdx]
      newValues[newIdx] = temp
      onUpdate({ values: newValues })
    },
    [enumDef.values, onUpdate]
  )

  const handleAddValue = useCallback(() => {
    const nextId = `Value_${enumDef.values.length}`
    const newValue = createDefaultEnumValue(nextId, enumDef.values.length)
    onUpdate({ values: [...enumDef.values, newValue] })
  }, [enumDef.values, onUpdate])

  return (
    <div className="space-y-3 p-2">
      {/* Identifier */}
      <div className="space-y-1">
        <Label className="text-[10px]">Identifier</Label>
        <Input
          value={enumDef.identifier}
          onChange={(e) => onUpdate({ identifier: e.target.value })}
          className="h-7 text-xs font-mono"
          placeholder="Enum_Name"
        />
        {enumDef.identifier && !isValidIdentifier(enumDef.identifier) && (
          <p className="text-[9px] text-destructive">Invalid identifier</p>
        )}
      </div>

      {/* External Path */}
      <div className="space-y-1">
        <Label className="text-[10px]">External Path</Label>
        <Input
          value={enumDef.externalRelPath ?? ''}
          onChange={(e) => onUpdate({ externalRelPath: e.target.value || null })}
          className="h-7 text-xs font-mono"
          placeholder="(none - internal enum)"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <Label className="text-[10px]">Tags (comma-separated)</Label>
        <Input
          value={enumDef.tags.join(', ')}
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

      {/* Values */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Values ({enumDef.values.length})</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-[10px]"
            onClick={handleAddValue}
          >
            <Plus size={10} className="mr-0.5" />
            Add Value
          </Button>
        </div>
        <div className="space-y-1">
          {enumDef.values.map((value, idx) => (
            <EnumValueRow
              key={`${value.id}-${idx}`}
              value={value}
              onUpdate={(updates) => handleValueUpdate(value.id, updates)}
              onDelete={() => handleValueDelete(value.id)}
              onMoveUp={() => handleValueMove(value.id, -1)}
              onMoveDown={() => handleValueMove(value.id, 1)}
              isFirst={idx === 0}
              isLast={idx === enumDef.values.length - 1}
            />
          ))}
          {enumDef.values.length === 0 && (
            <p className="py-2 text-center text-[9px] text-muted-foreground">No values defined</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============== Main Panel ==============

export function EnumDefsPanel() {
  const project = useProjectStore((s) => s.project)
  const enumDefs = project?.defs.enums ?? []
  const [selectedUid, setSelectedUid] = useState<number | null>(null)

  const selectedDef = enumDefs.find((d) => d.uid === selectedUid) ?? null

  const handleAdd = useCallback(() => {
    if (!project) return
    const uid = project.nextUid++
    const newDef = createDefaultEnumDef(uid)
    project.defs.enums.push(newDef)
    setSelectedUid(uid)
    useProjectStore.setState({ project: { ...project } })
  }, [project])

  const handleDelete = useCallback(
    (uid: number) => {
      if (!project) return
      project.defs.enums = project.defs.enums.filter((d) => d.uid !== uid)
      if (selectedUid === uid) setSelectedUid(null)
      useProjectStore.setState({ project: { ...project } })
    },
    [project, selectedUid]
  )

  const handleUpdate = useCallback(
    (updates: Partial<EnumDef>) => {
      if (!project || selectedUid === null) return
      const idx = project.defs.enums.findIndex((d) => d.uid === selectedUid)
      if (idx < 0) return
      project.defs.enums[idx] = { ...project.defs.enums[idx], ...updates }
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
        <span className="text-xs font-medium">Enum Definitions</span>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleAdd}>
          <Plus size={12} className="mr-0.5" />
          New
        </Button>
      </div>

      {/* Content: master-detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Master: enum list */}
        <div className="w-1/3 min-w-[100px] border-r border-[var(--pb-border)]">
          <ScrollArea className="h-full">
            <div className="space-y-0.5 p-1">
              {enumDefs.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">
                  No enum defs
                </p>
              ) : (
                enumDefs.map((def) => (
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
                    <ListBullets size={12} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono">{def.identifier}</span>
                    <span className="text-[8px] text-muted-foreground">
                      {def.values.length}
                    </span>
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

        {/* Detail: enum editor */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {selectedDef ? (
              <EnumDefDetail enumDef={selectedDef} onUpdate={handleUpdate} />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-[10px] text-muted-foreground">
                Select an enum to edit
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
