import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import type { LoadedTileset, TileStamp } from '@/lib/types'

interface TilePaletteProps {
  tileset: LoadedTileset
  selectedGlobalTileId: number
  selectedTileIds: number[]
  stamp: TileStamp
  tilesetZoom: number
  onTileSelect: (globalId: number) => void
  onStampSelect: (stamp: TileStamp) => void
  onSelectedTileIdsChange: (tileIds: number[]) => void
}

export function TilePalette({
  tileset,
  selectedGlobalTileId,
  selectedTileIds,
  stamp,
  tilesetZoom,
  onTileSelect,
  onStampSelect,
  onSelectedTileIdsChange,
}: TilePaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ col: number; row: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; row: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const baseSize = tileset.tileSize
  const displaySize = Math.round(baseSize * tilesetZoom)
  const gridCols = tileset.tilesPerRow

  const allTiles: number[] = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i < tileset.totalTiles; i++) {
      arr.push(tileset.firstGid + i)
    }
    return arr
  }, [tileset.totalTiles, tileset.firstGid])

  const resolvedSelectedTileIds = useMemo(() => {
    if (selectedTileIds.length > 0) return selectedTileIds
    return selectedGlobalTileId ? [selectedGlobalTileId] : []
  }, [selectedTileIds, selectedGlobalTileId])

  const { tiles, highlightedTile } = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) {
      return { tiles: allTiles, highlightedTile: null }
    }

    const numQuery = parseInt(query, 10)
    if (!isNaN(numQuery)) {
      if (numQuery >= tileset.firstGid && numQuery < tileset.firstGid + tileset.totalTiles) {
        return { tiles: allTiles, highlightedTile: numQuery }
      }
      if (numQuery >= 0 && numQuery < tileset.totalTiles) {
        return { tiles: allTiles, highlightedTile: tileset.firstGid + numQuery }
      }
    }

    return { tiles: allTiles, highlightedTile: null }
  }, [allTiles, searchQuery, tileset.firstGid, tileset.totalTiles])

  useEffect(() => {
    if (highlightedTile !== null && scrollRef.current && containerRef.current) {
      const localId = highlightedTile - tileset.firstGid
      const row = Math.floor(localId / tileset.tilesPerRow)
      const scrollTop = row * (displaySize + 2)
      scrollRef.current.scrollTop = scrollTop
    }
  }, [highlightedTile, tileset.firstGid, tileset.tilesPerRow, displaySize])

  const isTileInStamp = useCallback((globalId: number): boolean => {
    if (stamp.tilesetId !== tileset.id) return false
    for (const row of stamp.tiles) {
      if (row.includes(globalId)) return true
    }
    return false
  }, [stamp, tileset.id])

  const getSelectionBounds = useCallback(() => {
    if (!selectionStart || !selectionEnd) return null
    return {
      minCol: Math.min(selectionStart.col, selectionEnd.col),
      maxCol: Math.max(selectionStart.col, selectionEnd.col),
      minRow: Math.min(selectionStart.row, selectionEnd.row),
      maxRow: Math.max(selectionStart.row, selectionEnd.row),
    }
  }, [selectionStart, selectionEnd])

  const isTileInActiveSelection = useCallback((localId: number): boolean => {
    const bounds = getSelectionBounds()
    if (!bounds) return false

    const col = localId % tileset.tilesPerRow
    const row = Math.floor(localId / tileset.tilesPerRow)

    return col >= bounds.minCol && col <= bounds.maxCol &&
      row >= bounds.minRow && row <= bounds.maxRow
  }, [getSelectionBounds, tileset.tilesPerRow])

  const toggleTileSelection = useCallback((globalId: number) => {
    if (resolvedSelectedTileIds.includes(globalId)) {
      if (resolvedSelectedTileIds.length === 1) {
        onSelectedTileIdsChange([globalId])
        onTileSelect(globalId)
        return
      }
      const next = resolvedSelectedTileIds.filter((tileId) => tileId !== globalId)
      onSelectedTileIdsChange(next)
      onTileSelect(next[0])
      return
    }

    const next = [globalId, ...resolvedSelectedTileIds.filter((tileId) => tileId !== globalId)]
    onSelectedTileIdsChange(next)
    onTileSelect(globalId)
  }, [resolvedSelectedTileIds, onSelectedTileIdsChange, onTileSelect])

  const handleTileMouseDown = useCallback((globalId: number, e: MouseEvent) => {
    const localId = globalId - tileset.firstGid
    const col = localId % tileset.tilesPerRow
    const row = Math.floor(localId / tileset.tilesPerRow)

    if (e.shiftKey) {
      setIsSelecting(true)
      setSelectionStart({ col, row })
      setSelectionEnd({ col, row })
      return
    }

    if (e.ctrlKey || e.metaKey) {
      toggleTileSelection(globalId)
      return
    }

    onSelectedTileIdsChange([globalId])
    onTileSelect(globalId)
  }, [tileset, toggleTileSelection, onTileSelect, onSelectedTileIdsChange])

  const handleTileMouseEnter = useCallback((globalId: number) => {
    if (!isSelecting) return

    const localId = globalId - tileset.firstGid
    const col = localId % tileset.tilesPerRow
    const row = Math.floor(localId / tileset.tilesPerRow)
    setSelectionEnd({ col, row })
  }, [isSelecting, tileset])

  useEffect(() => {
    const handleMouseUp = () => {
      if (!isSelecting || !selectionStart || !selectionEnd) {
        setIsSelecting(false)
        return
      }

      const bounds = getSelectionBounds()
      if (!bounds) {
        setIsSelecting(false)
        return
      }

      const stampWidth = bounds.maxCol - bounds.minCol + 1
      const stampHeight = bounds.maxRow - bounds.minRow + 1
      const tiles: number[][] = []

      for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
        const rowTiles: number[] = []
        for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
          const localId = row * tileset.tilesPerRow + col
          if (localId < tileset.totalTiles) {
            rowTiles.push(tileset.firstGid + localId)
          } else {
            rowTiles.push(0)
          }
        }
        tiles.push(rowTiles)
      }

      onStampSelect({
        width: stampWidth,
        height: stampHeight,
        tiles,
        tilesetId: tileset.id,
      })
      onSelectedTileIdsChange(tiles.flat().filter((tileId) => tileId > 0))

      setIsSelecting(false)
      setSelectionStart(null)
      setSelectionEnd(null)
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [isSelecting, selectionStart, selectionEnd, getSelectionBounds, tileset, onStampSelect, onSelectedTileIdsChange])

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleSearchKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && highlightedTile !== null) {
      onSelectedTileIdsChange([highlightedTile])
      onTileSelect(highlightedTile)
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
    }
  }, [highlightedTile, onTileSelect, onSelectedTileIdsChange])

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b flex gap-1 items-center shrink-0">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          type="text"
          placeholder="Tile ID or #tag..."
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          className="h-7 text-xs"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setSearchQuery('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
        <div
          ref={containerRef}
          className="grid gap-0.5 p-1 select-none"
          style={{ gridTemplateColumns: `repeat(${gridCols}, ${displaySize}px)` }}
        >
          {tiles.map(globalId => {
            const localId = globalId - tileset.firstGid
            const col = localId % tileset.tilesPerRow
            const row = Math.floor(localId / tileset.tilesPerRow)
            const isSelected = resolvedSelectedTileIds.includes(globalId)
            const inStamp = isTileInStamp(globalId)
            const inActiveSelection = isTileInActiveSelection(localId)
            const isHighlighted = highlightedTile === globalId

            return (
              <button
                key={globalId}
                className={`
                border transition-all relative
                ${isHighlighted
                    ? 'border-yellow-500 ring-2 ring-yellow-500 ring-offset-1 z-20 animate-pulse'
                    : isSelected
                      ? 'border-primary ring-2 ring-primary ring-offset-1 z-10'
                      : inStamp
                        ? 'border-accent'
                        : inActiveSelection
                          ? 'border-accent bg-accent/20'
                          : 'border-transparent hover:border-accent/50'
                  }
              `}
                style={{ width: displaySize, height: displaySize }}
                onMouseDown={(e) => handleTileMouseDown(globalId, e)}
                onMouseEnter={() => handleTileMouseEnter(globalId)}
                title={`Tile ${globalId} (${col}, ${row}) - Shift+drag to select, Ctrl+click to toggle`}
              >
                <canvas
                  ref={canvas => {
                    if (canvas && tileset.canvas) {
                      const ctx = canvas.getContext('2d')
                      if (ctx) {
                        canvas.width = tileset.tileSize
                        canvas.height = tileset.tileSize
                        ctx.imageSmoothingEnabled = false
                        ctx.drawImage(
                          tileset.canvas,
                          col * tileset.tileSize,
                          row * tileset.tileSize,
                          tileset.tileSize,
                          tileset.tileSize,
                          0,
                          0,
                          tileset.tileSize,
                          tileset.tileSize
                        )
                      }
                    }
                  }}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </button>
            )
          })}
        </div>
        <div className="p-2 text-xs text-muted-foreground text-center border-t">
          Shift+drag to select multiple tiles, Ctrl+click to toggle
        </div>
      </div>
    </div>
  )
}
