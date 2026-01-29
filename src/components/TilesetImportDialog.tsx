import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { COMMON_TILE_SIZES, DEFAULT_TILE_SIZE } from '@/lib/tileset'

export interface TilesetImportResult {
    name: string
    tileSize: number
}

interface TilesetImportDialogProps {
    open: boolean
    filePath: string | null
    onClose: () => void
    onConfirm: (result: TilesetImportResult) => void
}

export function TilesetImportDialog({
    open,
    filePath,
    onClose,
    onConfirm,
}: TilesetImportDialogProps) {
    const [name, setName] = useState('')
    const [tileSize, setTileSize] = useState(DEFAULT_TILE_SIZE)

    // Reset form when dialog opens with new file
    useEffect(() => {
        if (open && filePath) {
            // Extract name from file path
            const fileName = filePath.split(/[/\\]/).pop() || 'Untitled'
            const baseName = fileName.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
            setName(baseName)
            setTileSize(DEFAULT_TILE_SIZE)
        }
    }, [open, filePath])

    const handleConfirm = () => {
        if (!name.trim()) return
        onConfirm({ name: name.trim(), tileSize })
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import Tileset</DialogTitle>
                    <DialogDescription>
                        Configure settings for the tileset image.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* File path preview */}
                    <div className="space-y-2">
                        <Label className="text-muted-foreground">File</Label>
                        <div className="text-sm bg-muted p-2 rounded-md truncate font-mono">
                            {filePath || 'No file selected'}
                        </div>
                    </div>

                    {/* Tileset name */}
                    <div className="space-y-2">
                        <Label htmlFor="tileset-name">Name</Label>
                        <Input
                            id="tileset-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter tileset name"
                        />
                    </div>

                    {/* Tile size selector */}
                    <div className="space-y-2">
                        <Label htmlFor="tile-size">Tile Size (pixels)</Label>
                        <Select
                            value={String(tileSize)}
                            onValueChange={(value) => setTileSize(Number(value))}
                        >
                            <SelectTrigger id="tile-size">
                                <SelectValue placeholder="Select tile size" />
                            </SelectTrigger>
                            <SelectContent>
                                {COMMON_TILE_SIZES.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}×{size} {size === DEFAULT_TILE_SIZE && '(default)'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            The tileset will be divided into a grid of this size.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!name.trim()}>
                        Import
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
