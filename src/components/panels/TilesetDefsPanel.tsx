/**
 * TilesetDefsPanel - Panel for managing tileset definitions
 * Task 4F.3 (T3-10)
 * 
 * Allows creating, editing, and deleting tileset definitions including:
 * - Identifier, path, tile size, spacing, padding
 * - Grid preview overlay
 * - Embed/import tileset
 */

import { useState, useCallback, useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores'
import { Plus, Trash, Image as ImageIcon } from '@phosphor-icons/react'
import type { TilesetDef } from '@/lib/ldtk/types'
import { isValidIdentifier } from '@/lib/ldtk/project'

// ============== Helpers ==============

function createDefaultTilesetDef(uid: number): TilesetDef {
  return {
    uid,
    identifier: `Tileset_${uid}`,
    relPath: null,
    embedAtlas: null,
    pxWid: 0,
    pxHei: 0,
    tileGridSize: 16,
    spacing: 0,
    padding: 0,
    tags: [],
    tagsSourceEnumUid: null,
    enumTags: [],
    customData: [],
    savedSelections: [],
    cWid: 0,
    cHei: 0,
  }
}

function computeGridDimensions(
  pxWid: number,
  pxHei: number,
  tileGridSize: number,
  spacing: number,
  padding: number
): { cWid: number; cHei: number } {
  if (tileGridSize <= 0 || pxWid <= 0 || pxHei <= 0) return { cWid: 0, cHei: 0 }
  const usableW = pxWid - padding * 2
  const usableH = pxHei - padding * 2
  const cWid = Math.max(0, Math.floor((usableW + spacing) / (tileGridSize + spacing)))
  const cHei = Math.max(0, Math.floor((usableH + spacing) / (tileGridSize + spacing)))
  return { cWid, cHei }
}

// ============== Grid Preview ==============

function TilesetGridPreview({ tilesetDef }: { tilesetDef: TilesetDef }) {
  const { cWid, cHei } = useMemo(
    () =>
      computeGridDimensions(
        tilesetDef.pxWid,
        tilesetDef.pxHei,
        tilesetDef.tileGridSize,
        tilesetDef.spacing,
        tilesetDef.padding
      ),
    [tilesetDef.pxWid, tilesetDef.pxHei, tilesetDef.tileGridSize, tilesetDef.spacing, tilesetDef.padding]
  )

  if (cWid <= 0 || cHei <= 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded border border-dashed border-[var(--pb-border)] text-[9px] text-muted-foreground">
        No grid to preview
      </div>
    )
  }

  // Limit preview grid size
  const maxCols = Math.min(cWid, 16)
  const maxRows = Math.min(cHei, 16)
  const cellSize = Math.min(12, Math.floor(160 / Math.max(maxCols, maxRows)))

  return (
    <div className="space-y-1">
      <p className="text-[9px] text-muted-foreground">
        Grid: {cWid} x {cHei} ({cWid * cHei} tiles)
      </p>
      <div
        className="inline-grid gap-px rounded border border-[var(--pb-border)] bg-[var(--pb-border)] p-px"
        style={{
          gridTemplateColumns: `repeat(${maxCols}, ${cellSize}px)`,
        }}
      >
        {Array.from({ length: maxRows * maxCols }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--pb-bg-secondary)]"
            style={{ width: cellSize, height: cellSize }}
          />
        ))}
      </div>
      {(cWid > maxCols || cHei > maxRows) && (
        <p className="text-[8px] text-muted-foreground italic">
          Showing {maxCols}x{maxRows} of {cWid}x{cHei}
        </p>
      )}
    </div>
  )
}

// ============== Tileset Detail Form ==============

function TilesetDefDetail({
  tilesetDef,
  onUpdate,
}: {
  tilesetDef: TilesetDef
  onUpdate: (updates: Partial<TilesetDef>) => void
}) {
  const handleGridParamChange = useCallback(
    (field: 'tileGridSize' | 'spacing' | 'padding', value: number) => {
      const updated = { ...tilesetDef, [field]: value }
      const dims = computeGridDimensions(
        updated.pxWid,
        updated.pxHei,
        updated.tileGridSize,
        updated.spacing,
        updated.padding
      )
      onUpdate({ [field]: value, cWid: dims.cWid, cHei: dims.cHei })
    },
    [tilesetDef, onUpdate]
  )

  const handleSizeChange = useCallback(
    (field: 'pxWid' | 'pxHei', value: number) => {
      const updated = { ...tilesetDef, [field]: value }
      const dims = computeGridDimensions(
        updated.pxWid,
        updated.pxHei,
        updated.tileGridSize,
        updated.spacing,
        updated.padding
      )
      onUpdate({ [field]: value, cWid: dims.cWid, cHei: dims.cHei })
    },
    [tilesetDef, onUpdate]
  )

  return (
    <div className="space-y-3 p-2">
      {/* Identifier */}
      <div className="space-y-1">
        <Label className="text-[10px]">Identifier</Label>
        <Input
          value={tilesetDef.identifier}
          onChange={(e) => onUpdate({ identifier: e.target.value })}
          className="h-7 text-xs font-mono"
          placeholder="Tileset_Name"
        />
        {tilesetDef.identifier && !isValidIdentifier(tilesetDef.identifier) && (
          <p className="text-[9px] text-destructive">Invalid identifier</p>
        )}
      </div>

      {/* Path */}
      <div className="space-y-1">
        <Label className="text-[10px]">Relative Path</Label>
        <Input
          value={tilesetDef.relPath ?? ''}
          onChange={(e) => onUpdate({ relPath: e.target.value || null })}
          className="h-7 text-xs font-mono"
          placeholder="tilesets/my_tileset.png"
        />
      </div>

      {/* Image Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Image Width (px)</Label>
          <Input
            type="number"
            value={tilesetDef.pxWid}
            onChange={(e) => handleSizeChange('pxWid', Math.max(0, Number(e.target.value)))}
            className="h-7 text-xs font-mono"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Image Height (px)</Label>
          <Input
            type="number"
            value={tilesetDef.pxHei}
            onChange={(e) => handleSizeChange('pxHei', Math.max(0, Number(e.target.value)))}
            className="h-7 text-xs font-mono"
            min={0}
          />
        </div>
      </div>

      {/* Tile Grid Size */}
      <div className="space-y-1">
        <Label className="text-[10px]">Tile Size (px)</Label>
        <Input
          type="number"
          value={tilesetDef.tileGridSize}
          onChange={(e) => handleGridParamChange('tileGridSize', Math.max(1, Number(e.target.value)))}
          className="h-7 text-xs font-mono"
          min={1}
        />
      </div>

      {/* Spacing & Padding */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Spacing</Label>
          <Input
            type="number"
            value={tilesetDef.spacing}
            onChange={(e) => handleGridParamChange('spacing', Math.max(0, Number(e.target.value)))}
            className="h-7 text-xs font-mono"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Padding</Label>
          <Input
            type="number"
            value={tilesetDef.padding}
            onChange={(e) => handleGridParamChange('padding', Math.max(0, Number(e.target.value)))}
            className="h-7 text-xs font-mono"
            min={0}
          />
        </div>
      </div>

      {/* Embed Atlas */}
      <div className="space-y-1">
        <Label className="text-[10px]">Embed Atlas</Label>
        <select
          value={tilesetDef.embedAtlas ?? ''}
          onChange={(e) => onUpdate({ embedAtlas: e.target.value || null })}
          className="h-7 w-full rounded border border-[var(--pb-border)] bg-[var(--pb-bg-primary)] px-2 text-[10px]"
        >
          <option value="">None (external file)</option>
          <option value="LdtkIcons">LDtk Icons</option>
        </select>
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <Label className="text-[10px]">Tags (comma-separated)</Label>
        <Input
          value={tilesetDef.tags.join(', ')}
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

      {/* Grid Preview */}
      <div className="space-y-1">
        <Label className="text-[10px]">Grid Preview</Label>
        <TilesetGridPreview tilesetDef={tilesetDef} />
      </div>
    </div>
  )
}

// ============== Main Panel ==============

export function TilesetDefsPanel() {
  const project = useProjectStore((s) => s.project)
  const tilesetDefs = project?.defs.tilesets ?? []
  const [selectedUid, setSelectedUid] = useState<number | null>(null)

  const selectedDef = tilesetDefs.find((d) => d.uid === selectedUid) ?? null

  const handleAdd = useCallback(() => {
    if (!project) return
    const uid = project.nextUid++
    const newDef = createDefaultTilesetDef(uid)
    project.defs.tilesets.push(newDef)
    setSelectedUid(uid)
    useProjectStore.setState({ project: { ...project } })
  }, [project])

  const handleDelete = useCallback(
    (uid: number) => {
      if (!project) return
      project.defs.tilesets = project.defs.tilesets.filter((d) => d.uid !== uid)
      if (selectedUid === uid) setSelectedUid(null)
      useProjectStore.setState({ project: { ...project } })
    },
    [project, selectedUid]
  )

  const handleUpdate = useCallback(
    (updates: Partial<TilesetDef>) => {
      if (!project || selectedUid === null) return
      const idx = project.defs.tilesets.findIndex((d) => d.uid === selectedUid)
      if (idx < 0) return
      project.defs.tilesets[idx] = { ...project.defs.tilesets[idx], ...updates }
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
        <span className="text-xs font-medium">Tileset Definitions</span>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleAdd}>
          <Plus size={12} className="mr-0.5" />
          New
        </Button>
      </div>

      {/* Content: master-detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Master: tileset list */}
        <div className="w-1/3 min-w-[100px] border-r border-[var(--pb-border)]">
          <ScrollArea className="h-full">
            <div className="space-y-0.5 p-1">
              {tilesetDefs.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">
                  No tileset defs
                </p>
              ) : (
                tilesetDefs.map((def) => (
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
                    <ImageIcon size={12} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono">{def.identifier}</span>
                    <span className="text-[8px] text-muted-foreground">
                      {def.tileGridSize}px
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

        {/* Detail: tileset editor */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {selectedDef ? (
              <TilesetDefDetail tilesetDef={selectedDef} onUpdate={handleUpdate} />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-[10px] text-muted-foreground">
                Select a tileset to edit
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
