/**
 * Editor Store - Zustand store for editor state
 * Manages: tool, zoom, pan, grid, stamp selection, keyboard modifiers
 * 
 * Stolen from: Tiled (stamp brushes), LDtk (modern state patterns)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Tool, TileStamp, TileSelection } from '@/lib/types'

// Zoom constraints (borrowed from Tiled's defaults)
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.25

interface EditorState {
  // Current tool
  currentTool: Tool
  previousTool: Tool | null  // For temporary tool switching (spacebar pan)

  // Viewport
  zoom: number
  panX: number
  panY: number

  // Grid
  gridVisible: boolean

  // Tile selection (supports multi-tile stamps like Tiled)
  selectedTileId: number  // Legacy single tile (first tile of stamp)
  stamp: TileStamp        // Multi-tile stamp pattern
  activeTilesetId: string | null

  // Layer
  activeLayerIndex: number

  // Entity selection
  selectedEntityId: string | null

  // Keyboard modifiers (for space+drag pan, shift+select, etc.)
  spaceHeld: boolean
  shiftHeld: boolean
  ctrlHeld: boolean

  // Cursor position (for stamp preview)
  cursorTileX: number | null
  cursorTileY: number | null

  // Clipboard (stolen from Tiled/Photoshop)
  clipboard: TileSelection | null
  selection: TileSelection | null
}

interface EditorActions {
  // Tool
  setTool: (tool: Tool) => void
  setPreviousTool: (tool: Tool | null) => void

  // Viewport
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  zoomToPoint: (newZoom: number, screenX: number, screenY: number) => void
  setPan: (x: number, y: number) => void
  nudgePan: (dx: number, dy: number) => void

  // Grid
  toggleGrid: () => void
  setGridVisible: (visible: boolean) => void

  // Selection
  setSelectedTileId: (tileId: number) => void
  setStamp: (stamp: TileStamp) => void
  setActiveTilesetId: (id: string | null) => void
  setActiveLayerIndex: (index: number) => void
  setSelectedEntityId: (id: string | null) => void

  // Keyboard modifiers
  setSpaceHeld: (held: boolean) => void
  setShiftHeld: (held: boolean) => void
  setCtrlHeld: (held: boolean) => void

  // Cursor
  setCursorTile: (x: number | null, y: number | null) => void

  // Clipboard & Selection (stolen from Tiled/Photoshop)
  setClipboard: (selection: TileSelection | null) => void
  setSelection: (selection: TileSelection | null) => void
  copySelection: () => void
  clearSelection: () => void
}

const DEFAULT_STAMP: TileStamp = {
  width: 1,
  height: 1,
  tiles: [[1]],
  tilesetId: null,
}

export const useEditorStore = create<EditorState & EditorActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentTool: 'brush',
      previousTool: null,
      zoom: 2,
      panX: 100,
      panY: 100,
      gridVisible: true,
      selectedTileId: 1,
      stamp: DEFAULT_STAMP,
      activeTilesetId: null,
      activeLayerIndex: 0,
      selectedEntityId: null,
      spaceHeld: false,
      shiftHeld: false,
      ctrlHeld: false,
      cursorTileX: null,
      cursorTileY: null,
      clipboard: null,
      selection: null,

      // Actions
      setTool: (tool) => set({ currentTool: tool }),
      setPreviousTool: (tool) => set({ previousTool: tool }),

      setZoom: (zoom) => set({
        zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      }),

      zoomIn: () => set((state) => ({
        zoom: Math.min(state.zoom + ZOOM_STEP, MAX_ZOOM)
      })),

      zoomOut: () => set((state) => ({
        zoom: Math.max(state.zoom - ZOOM_STEP, MIN_ZOOM)
      })),

      zoomReset: () => set({ zoom: 1 }),

      // Zoom to point - adjusts pan so zoom centers on mouse position (Tiled-style)
      zoomToPoint: (newZoom, screenX, screenY) => {
        const { zoom, panX, panY } = get()
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))

        // Calculate world position under cursor before zoom
        const worldX = (screenX - panX) / zoom
        const worldY = (screenY - panY) / zoom

        // Calculate new pan so the same world position stays under cursor
        const newPanX = screenX - worldX * clampedZoom
        const newPanY = screenY - worldY * clampedZoom

        set({ zoom: clampedZoom, panX: newPanX, panY: newPanY })
      },

      setPan: (x, y) => set({ panX: x, panY: y }),

      nudgePan: (dx, dy) => set((state) => ({
        panX: state.panX + dx,
        panY: state.panY + dy,
      })),

      toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
      setGridVisible: (visible) => set({ gridVisible: visible }),

      setSelectedTileId: (tileId) => set({
        selectedTileId: tileId,
        // Also update stamp to single tile
        stamp: { width: 1, height: 1, tiles: [[tileId]], tilesetId: get().activeTilesetId },
      }),

      setStamp: (stamp) => set({
        stamp,
        // Update selectedTileId to first tile of stamp
        selectedTileId: stamp.tiles[0]?.[0] ?? 1,
      }),

      setActiveTilesetId: (id) => set({ activeTilesetId: id }),
      setActiveLayerIndex: (index) => set({ activeLayerIndex: index }),
      setSelectedEntityId: (id) => set({ selectedEntityId: id }),

      setSpaceHeld: (held) => set({ spaceHeld: held }),
      setShiftHeld: (held) => set({ shiftHeld: held }),
      setCtrlHeld: (held) => set({ ctrlHeld: held }),

      setCursorTile: (x, y) => set({ cursorTileX: x, cursorTileY: y }),

      setClipboard: (selection) => set({ clipboard: selection }),
      setSelection: (selection) => set({ selection }),
      copySelection: () => {
        const { selection } = get()
        if (selection) {
          // Deep copy the selection to clipboard
          set({ clipboard: { ...selection, tiles: selection.tiles.map(row => [...row]) } })
        }
      },
      clearSelection: () => set({ selection: null }),
    }),
    { name: 'editor-store' }
  )
)

// Selectors for performance (only re-render when specific values change)
export const useCurrentTool = () => useEditorStore((s) => s.currentTool)
export const useZoom = () => useEditorStore((s) => s.zoom)
export const usePan = () => useEditorStore((s) => ({ x: s.panX, y: s.panY }))
export const useGridVisible = () => useEditorStore((s) => s.gridVisible)
export const useStamp = () => useEditorStore((s) => s.stamp)
export const useSelectedTileId = () => useEditorStore((s) => s.selectedTileId)
export const useActiveTilesetId = () => useEditorStore((s) => s.activeTilesetId)
export const useActiveLayerIndex = () => useEditorStore((s) => s.activeLayerIndex)
export const useSelectedEntityId = () => useEditorStore((s) => s.selectedEntityId)
export const useModifiers = () => useEditorStore((s) => ({
  space: s.spaceHeld,
  shift: s.shiftHeld,
  ctrl: s.ctrlHeld,
}))
export const useCursorTile = () => useEditorStore((s) => ({
  x: s.cursorTileX,
  y: s.cursorTileY,
}))
export const useClipboard = () => useEditorStore((s) => s.clipboard)
export const useSelection = () => useEditorStore((s) => s.selection)
