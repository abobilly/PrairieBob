import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, ZoomIn, Search } from 'lucide-react'
import type { LoadedTileset, TileStamp } from '@/lib/types'
import { DEBUG_TILESET_ID } from '@/lib/types'
import { useToolStore } from '@/stores/toolStore'

interface TilesetPanelProps {
  tilesets: LoadedTileset[]
  activeTilesetId: string | null
  selectedTileId: number  // Global tile ID
  stamp: TileStamp        // Current stamp pattern
  tilesetZoom: number     // Display zoom (1-4x)
  onTilesetSelect: (tilesetId: string) => void
  onTileSelect: (globalTileId: number) => void
  onStampSelect: (stamp: TileStamp) => void  // Multi-tile selection (Tiled-style)
  onTilesetZoomChange: (zoom: number) => void
  onAddTileset: () => void
  onRemoveTileset?: (tilesetId: string) => void
}

export function TilesetPanel({
  tilesets,
  activeTilesetId,
  selectedTileId,
  stamp,
  tilesetZoom,
  onTilesetSelect,
  onTileSelect,
  onStampSelect,
  onTilesetZoomChange,
  onAddTileset,
  onRemoveTileset,
}: TilesetPanelProps) {
  const activeTileset = tilesets.find(t => t.id === activeTilesetId)
  const selectedTileIds = useToolStore((s) => s.selectedTileIds)
  const setSelectedTileIds = useToolStore((s) => s.setSelectedTileIds)

  // Debug: log tilesets state
  useEffect(() => {
    console.log('[TilesetPanel] tilesets:', tilesets.length, tilesets.map(t => ({ id: t.id, name: t.name, status: t.status })))
    console.log('[TilesetPanel] activeTilesetId:', activeTilesetId)
  }, [tilesets, activeTilesetId])

  // If no active tileset, default to first one and notify parent
  const effectiveActiveId = activeTilesetId || tilesets[0]?.id || null

  return (
    <div className="pb-compact-panel h-full flex flex-col">
      {/* Compact header */}
      <div className="pb-compact-header">
        <span className="pb-compact-title">Tilesets</span>
        <div className="flex items-center gap-2">
          {/* Compact zoom control */}
          <div className="pb-zoom-control">
            <ZoomIn className="h-3 w-3" />
            <input
              type="range"
              title="Tileset zoom"
              value={tilesetZoom}
              onChange={(e) => onTilesetZoomChange(Number(e.target.value))}
              min={1}
              max={4}
              step={0.5}
              className="w-10 h-1 accent-primary"
            />
            <span className="w-4">{tilesetZoom}x</span>
          </div>
          <button
            className="pb-icon-btn-xs"
            onClick={onAddTileset}
            title="Add tileset"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-1">
        {tilesets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-[10px]">No tilesets</p>
            <button className="pb-icon-btn-xs mt-1" onClick={onAddTileset} title="Add tileset">
              <Plus className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Compact tileset tabs */}
            <div className="pb-tileset-tabs">
              {tilesets.map(ts => (
                <button
                  key={ts.id}
                  onClick={() => onTilesetSelect(ts.id)}
                  className={`pb-tileset-tab ${effectiveActiveId === ts.id ? 'active' : ''}`}
                  title={ts.name}
                >
                  {ts.name}
                </button>
              ))}
            </div>

            {/* Tileset info bar */}
            {activeTileset && activeTileset.status === 'ready' && (
              <div className="pb-tileset-info">
                <span>{activeTileset.tileSize}px</span>
                <span>{activeTileset.tilesPerRow}×{Math.ceil(activeTileset.totalTiles / activeTileset.tilesPerRow)}</span>
                <span>{activeTileset.totalTiles} tiles</span>
              </div>
            )}

            {/* Tileset grid */}
            <div className="pb-tileset-scroll flex-1 min-h-0">
              {tilesets.map(ts => (
                ts.id === effectiveActiveId && (
                  <div key={ts.id} className="h-full flex flex-col">
                    {ts.status === 'loading' && (
                      <div className="text-[10px] text-muted-foreground p-2">Loading...</div>
                    )}
                    {ts.status === 'error' && (
                      <div className="text-[10px] text-red-400 p-2">Error: {ts.error}</div>
                    )}
                    {ts.status === 'ready' && (
                      <TileGrid
                        tileset={ts}
                        selectedGlobalTileId={selectedTileId}
                        selectedTileIds={selectedTileIds}
                        stamp={stamp}
                        tilesetZoom={tilesetZoom}
                        onTileSelect={onTileSelect}
                        onStampSelect={onStampSelect}
                        onSelectedTileIdsChange={setSelectedTileIds}
                      />
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============== Tile Grid Sub-component with Multi-Select (Tiled-style) ==============

interface TileGridProps {
  tileset: LoadedTileset
  selectedGlobalTileId: number
  selectedTileIds: number[]
  stamp: TileStamp
  tilesetZoom: number
  onTileSelect: (globalId: number) => void
  onStampSelect: (stamp: TileStamp) => void
  onSelectedTileIdsChange: (tileIds: number[]) => void
}

function TileGrid({
  tileset,
  selectedGlobalTileId,
  selectedTileIds,
  stamp,
  tilesetZoom,
  onTileSelect,
  onStampSelect,
  onSelectedTileIdsChange
}: TileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ col: number; row: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; row: number } | null>(null)

  // Tile search/filter (stolen from YATE)
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate display size based on zoom level
  const baseSize = tileset.tileSize
  const displaySize = Math.round(baseSize * tilesetZoom)
  const gridCols = tileset.tilesPerRow

  // Generate array of global tile IDs for this tileset
  const allTiles: number[] = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i < tileset.totalTiles; i++) {
      arr.push(tileset.firstGid + i)
    }
    return arr
  }, [tileset.totalTiles, tileset.firstGid])

  // Filter tiles based on search query (stolen from YATE)
  const { tiles, highlightedTile } = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) {
      return { tiles: allTiles, highlightedTile: null }
    }

    // Check if query is a number (tile ID)
    const numQuery = parseInt(query, 10)
    if (!isNaN(numQuery)) {
      // If it's a valid tile ID in this tileset, highlight it
      if (numQuery >= tileset.firstGid && numQuery < tileset.firstGid + tileset.totalTiles) {
        return { tiles: allTiles, highlightedTile: numQuery }
      }
      // If it's a local index (0-based), convert to global
      if (numQuery >= 0 && numQuery < tileset.totalTiles) {
        return { tiles: allTiles, highlightedTile: tileset.firstGid + numQuery }
      }
    }

    // Future: filter by tag/name when we add tile metadata
    return { tiles: allTiles, highlightedTile: null }
  }, [allTiles, searchQuery, tileset.firstGid, tileset.totalTiles])

  // Scroll to highlighted tile
  useEffect(() => {
    if (highlightedTile !== null && scrollRef.current && containerRef.current) {
      const localId = highlightedTile - tileset.firstGid
      const row = Math.floor(localId / tileset.tilesPerRow)
      const scrollTop = row * (displaySize + 2) // 2px for gap
      scrollRef.current.scrollTop = scrollTop
    }
  }, [highlightedTile, tileset.firstGid, tileset.tilesPerRow, displaySize])

  // Check if a tile is within the current stamp selection
  const isTileInStamp = useCallback((globalId: number): boolean => {
    if (stamp.tilesetId !== tileset.id) return false
    for (const row of stamp.tiles) {
      if (row.includes(globalId)) return true
    }
    return false
  }, [stamp, tileset.id])

  // Get selection bounds (normalized)
  const getSelectionBounds = useCallback(() => {
    if (!selectionStart || !selectionEnd) return null
    return {
      minCol: Math.min(selectionStart.col, selectionEnd.col),
      maxCol: Math.max(selectionStart.col, selectionEnd.col),
      minRow: Math.min(selectionStart.row, selectionEnd.row),
      maxRow: Math.max(selectionStart.row, selectionEnd.row),
    }
  }, [selectionStart, selectionEnd])

  // Check if tile is in active selection (during drag)
  const isTileInActiveSelection = useCallback((localId: number): boolean => {
    const bounds = getSelectionBounds()
    if (!bounds) return false

    const col = localId % tileset.tilesPerRow
    const row = Math.floor(localId / tileset.tilesPerRow)

    return col >= bounds.minCol && col <= bounds.maxCol &&
      row >= bounds.minRow && row <= bounds.maxRow
  }, [getSelectionBounds, tileset.tilesPerRow])

  // Handle mouse down - start selection
  const handleTileMouseDown = useCallback((globalId: number, e: React.MouseEvent) => {
    const localId = globalId - tileset.firstGid
    const col = localId % tileset.tilesPerRow
    const row = Math.floor(localId / tileset.tilesPerRow)

    if (e.shiftKey) {
      // Start multi-tile selection (Tiled-style)
      setIsSelecting(true)
      setSelectionStart({ col, row })
      setSelectionEnd({ col, row })
    } else {
      // Single tile selection
      onSelectedTileIdsChange([globalId])
      onTileSelect(globalId)
    }
  }, [tileset, onTileSelect, onSelectedTileIdsChange])

  // Handle mouse enter during selection
  const handleTileMouseEnter = useCallback((globalId: number) => {
    if (!isSelecting) return

    const localId = globalId - tileset.firstGid
    const col = localId % tileset.tilesPerRow
    const row = Math.floor(localId / tileset.tilesPerRow)
    setSelectionEnd({ col, row })
  }, [isSelecting, tileset])

  // Handle mouse up - complete selection
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

      // Build stamp from selection
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

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && highlightedTile !== null) {
      onSelectedTileIdsChange([highlightedTile])
      onTileSelect(highlightedTile)
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
    }
  }, [highlightedTile, onTileSelect, onSelectedTileIdsChange])

  const resolvedSelectedTileIds = useMemo(() => {
    if (selectedTileIds.length > 0) return selectedTileIds
    return selectedGlobalTileId ? [selectedGlobalTileId] : []
  }, [selectedTileIds, selectedGlobalTileId])

  return (
    <div className="flex flex-col h-full">
      {/* Search input (stolen from YATE) */}
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
                title={`Tile ${globalId} (${col}, ${row}) - Shift+drag for multi-select`}
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
        {/* Selection hint */}
        <div className="p-2 text-xs text-muted-foreground text-center border-t">
          Shift+drag to select multiple tiles
        </div>
      </div>
    </div>
  )
}
