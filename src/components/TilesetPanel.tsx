import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Plus, X, ZoomIn, Search } from 'lucide-react'
import type { LoadedTileset, TileStamp } from '@/lib/types'
import { DEBUG_TILESET_ID } from '@/lib/types'

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

  // If no active tileset, default to first one
  const effectiveActiveId = activeTilesetId || tilesets[0]?.id || null

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between items-center">
          <span>Tilesets</span>
          <div className="flex items-center gap-2">
            {/* Zoom slider (Tiled-style) */}
            <div className="flex items-center gap-1" title="Tile display size">
              <ZoomIn className="h-3 w-3 text-muted-foreground" />
              <Slider
                value={[tilesetZoom]}
                onValueChange={([v]) => onTilesetZoomChange(v)}
                min={1}
                max={4}
                step={0.5}
                className="w-16 h-4"
              />
              <span className="text-xs text-muted-foreground w-6">{tilesetZoom}x</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onAddTileset}
              title="Add tileset"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2 overflow-hidden">
        {tilesets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">No tilesets loaded</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onAddTileset}>
              <Plus className="h-4 w-4 mr-1" />
              Add Tileset
            </Button>
          </div>
        ) : (
          <Tabs
            value={effectiveActiveId || ''}
            onValueChange={onTilesetSelect}
            className="h-full flex flex-col"
          >
            <div className="flex items-center gap-1 mb-2">
              <TabsList className="flex-1 h-auto flex-wrap justify-start">
                {tilesets.map(ts => (
                  <TabsTrigger
                    key={ts.id}
                    value={ts.id}
                    className="text-xs px-2 py-1 relative group"
                  >
                    {ts.name}
                    {ts.id !== DEBUG_TILESET_ID && onRemoveTileset && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove tileset ${ts.name}`}
                        className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveTileset(ts.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            onRemoveTileset(ts.id)
                          }
                        }}
                        title="Remove tileset"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {tilesets.map(ts => (
              <TabsContent
                key={ts.id}
                value={ts.id}
                className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden"
              >
                {ts.status === 'loading' && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                )}
                {ts.status === 'error' && (
                  <div className="flex flex-col items-center justify-center h-full text-destructive">
                    <p className="text-sm">Failed to load tileset</p>
                    <p className="text-xs mt-1">{ts.error}</p>
                  </div>
                )}
                {ts.status === 'ready' && (
                  <TileGrid
                    tileset={ts}
                    selectedGlobalTileId={selectedTileId}
                    stamp={stamp}
                    tilesetZoom={tilesetZoom}
                    onTileSelect={onTileSelect}
                    onStampSelect={onStampSelect}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

// ============== Tile Grid Sub-component with Multi-Select (Tiled-style) ==============

interface TileGridProps {
  tileset: LoadedTileset
  selectedGlobalTileId: number
  stamp: TileStamp
  tilesetZoom: number
  onTileSelect: (globalId: number) => void
  onStampSelect: (stamp: TileStamp) => void
}

function TileGrid({
  tileset,
  selectedGlobalTileId,
  stamp,
  tilesetZoom,
  onTileSelect,
  onStampSelect
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
      onTileSelect(globalId)
    }
  }, [tileset, onTileSelect])

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

      setIsSelecting(false)
      setSelectionStart(null)
      setSelectionEnd(null)
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [isSelecting, selectionStart, selectionEnd, getSelectionBounds, tileset, onStampSelect])

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && highlightedTile !== null) {
      onTileSelect(highlightedTile)
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
    }
  }, [highlightedTile, onTileSelect])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search input (stolen from YATE) */}
      <div className="p-2 border-b flex gap-1 items-center">
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

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div
          ref={containerRef}
          className="grid gap-0.5 p-1 select-none"
          style={{ gridTemplateColumns: `repeat(${gridCols}, ${displaySize}px)` }}
        >
          {tiles.map(globalId => {
            const localId = globalId - tileset.firstGid
            const col = localId % tileset.tilesPerRow
            const row = Math.floor(localId / tileset.tilesPerRow)
            const isSelected = selectedGlobalTileId === globalId
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
      </ScrollArea>
    </div>
  )
}
