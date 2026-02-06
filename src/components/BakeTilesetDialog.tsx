/**
 * BakeTilesetDialog — Export configuration dialog for baked .spudtile files
 *
 * Select tileset, configure metadata, choose export mode, export.
 */

import { useState, useMemo, useCallback } from 'react'
import { Atom } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { LoadedTileset } from '@/lib/types'
import { bakeTileset, serializeBakedTileset, estimateBakedSize } from '@/lib/tileset-baker'
import { toast } from 'sonner'

interface BakeTilesetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tilesets: LoadedTileset[]
}

export function BakeTilesetDialog({
  open,
  onOpenChange,
  tilesets,
}: BakeTilesetDialogProps) {
  const readyTilesets = useMemo(
    () => tilesets.filter((ts) => ts.status === 'ready' && ts.id !== '__debug__'),
    [tilesets]
  )

  const [selectedTilesetId, setSelectedTilesetId] = useState<string>(readyTilesets[0]?.id ?? '')
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [license, setLicense] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  const selectedTileset = useMemo(
    () => readyTilesets.find((ts) => ts.id === selectedTilesetId) ?? null,
    [readyTilesets, selectedTilesetId]
  )

  const estimatedSize = useMemo(() => {
    if (!selectedTileset) return 0
    return estimateBakedSize(selectedTileset, {
      name: name || selectedTileset.name,
      mode: 'embedded',
    })
  }, [selectedTileset, name])

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleExport = useCallback(async () => {
    if (!selectedTileset) return

    try {
      const baked = bakeTileset(selectedTileset, {
        name: name || selectedTileset.name,
        author: author || undefined,
        license: license || undefined,
        description: description || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        mode: 'embedded',
      })

      const json = serializeBakedTileset(baked)

      // Use Electron save dialog
      if (window.electron?.dialog) {
        const result = await window.electron.dialog.saveFile({
          title: 'Export Baked Tileset',
          defaultPath: `${baked.name}.spudtile`,
          filters: [
            { name: 'SpudTile Tileset', extensions: ['spudtile'] },
            { name: 'JSON', extensions: ['json'] },
          ],
        })

        if (result && !result.canceled && result.filePath) {
          await window.electron.fs.writeFile(result.filePath, json)
          toast.success(`Exported ${baked.name}.spudtile`)
          onOpenChange(false)
        }
      } else {
        // Fallback: download via browser
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baked.name}.spudtile`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Downloaded ${baked.name}.spudtile`)
        onOpenChange(false)
      }
    } catch (err) {
      toast.error(`Export failed: ${err}`)
    }
  }, [selectedTileset, name, author, license, description, tags, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Atom size={20} />
            Export Baked Tileset
          </DialogTitle>
          <DialogDescription>
            Create a self-contained .spudtile package with embedded image and metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {/* Tileset selector */}
          <div className="grid gap-1">
            <Label className="text-xs">Tileset</Label>
            <Select value={selectedTilesetId} onValueChange={setSelectedTilesetId}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Select tileset" />
              </SelectTrigger>
              <SelectContent>
                {readyTilesets.map((ts) => (
                  <SelectItem key={ts.id} value={ts.id}>
                    {ts.name} ({ts.totalTiles} tiles)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="grid gap-1">
            <Label className="text-xs">Name</Label>
            <Input
              className="h-8"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedTileset?.name ?? 'Tileset name'}
            />
          </div>

          {/* Author */}
          <div className="grid gap-1">
            <Label className="text-xs">Author</Label>
            <Input
              className="h-8"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* License */}
          <div className="grid gap-1">
            <Label className="text-xs">License</Label>
            <Input
              className="h-8"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="e.g., CC0, MIT"
            />
          </div>

          {/* Description */}
          <div className="grid gap-1">
            <Label className="text-xs">Description</Label>
            <Input
              className="h-8"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Tags */}
          <div className="grid gap-1">
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input
              className="h-8"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., dungeon, pixel-art, 16x16"
            />
          </div>

          {/* Size estimate */}
          {selectedTileset && (
            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              Estimated size: <strong>{formatSize(estimatedSize)}</strong>
              {' '} | {selectedTileset.totalTiles} tiles @ {selectedTileset.tileSize}px
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!selectedTileset}>
            Export .spudtile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
