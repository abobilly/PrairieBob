/**
 * Tool Store - Zustand store for LDtk tool state and viewport
 * Manages: active tool, layer selection, brush settings, viewport
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/ldtk/camera'

const DEFAULT_BRUSH_SIZE = 1
const MIN_BRUSH_SIZE = 1
const MAX_BRUSH_SIZE = 64
const PERSIST_KEY = 'spudtile-tool-store-v1'

interface ToolState {
  activeTool: string
  activeLayer: string | null
  selectedTileId: number | null
  selectedTileIds: number[]
  tileFlipX: boolean
  tileFlipY: boolean
  selectedEntityDefUid: number | null
  selectedIntGridValue: number
  brushSize: number
  zoom: number
  panX: number
  panY: number
}

interface ToolActions {
  setActiveTool: (tool: string) => void
  setActiveLayer: (layer: string | null) => void
  setSelectedTileId: (tileId: number | null) => void
  setSelectedTileIds: (tileIds: number[]) => void
  setTileFlipX: (enabled: boolean) => void
  setTileFlipY: (enabled: boolean) => void
  toggleTileFlipX: () => void
  toggleTileFlipY: () => void
  setSelectedEntityDefUid: (uid: number | null) => void
  setSelectedIntGridValue: (value: number) => void
  setBrushSize: (size: number) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  zoomToPoint: (zoom: number, screenX: number, screenY: number) => void
  resetViewport: () => void
}

export const useToolStore = create<ToolState & ToolActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        activeTool: 'tile',
        activeLayer: null,
        selectedTileId: null,
        selectedTileIds: [],
        tileFlipX: false,
        tileFlipY: false,
        selectedEntityDefUid: null,
        selectedIntGridValue: 1,
        brushSize: DEFAULT_BRUSH_SIZE,
        zoom: 1,
        panX: 0,
        panY: 0,

        setActiveTool: (tool) => set((state) => {
          state.activeTool = tool
        }),

        setActiveLayer: (layer) => set((state) => {
          state.activeLayer = layer
        }),

        setSelectedTileId: (tileId) => set((state) => {
          state.selectedTileId = tileId
          state.selectedTileIds = tileId === null ? [] : [tileId]
        }),

        setSelectedTileIds: (tileIds) => set((state) => {
          state.selectedTileIds = [...tileIds]
          state.selectedTileId = tileIds[0] ?? null
        }),

        setTileFlipX: (enabled) => set((state) => {
          state.tileFlipX = enabled
        }),

        setTileFlipY: (enabled) => set((state) => {
          state.tileFlipY = enabled
        }),

        toggleTileFlipX: () => set((state) => {
          state.tileFlipX = !state.tileFlipX
        }),

        toggleTileFlipY: () => set((state) => {
          state.tileFlipY = !state.tileFlipY
        }),

        setSelectedEntityDefUid: (uid) => set((state) => {
          state.selectedEntityDefUid = uid
        }),

        setSelectedIntGridValue: (value) => set((state) => {
          state.selectedIntGridValue = Math.max(0, Math.floor(value))
        }),

        setBrushSize: (size) => set((state) => {
          state.brushSize = clamp(Math.round(size), MIN_BRUSH_SIZE, MAX_BRUSH_SIZE)
        }),

        setZoom: (zoom) => set((state) => {
          state.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
        }),

        setPan: (x, y) => set((state) => {
          state.panX = x
          state.panY = y
        }),

        zoomToPoint: (newZoom, screenX, screenY) => {
          const { zoom, panX, panY } = get()
          const clampedZoom = clamp(newZoom, MIN_ZOOM, MAX_ZOOM)
          const worldX = (screenX - panX) / zoom
          const worldY = (screenY - panY) / zoom
          const newPanX = screenX - worldX * clampedZoom
          const newPanY = screenY - worldY * clampedZoom
          set((state) => {
            state.zoom = clampedZoom
            state.panX = newPanX
            state.panY = newPanY
          })
        },

        resetViewport: () => set((state) => {
          state.zoom = 1
          state.panX = 0
          state.panY = 0
        }),
      })),
      {
        name: PERSIST_KEY,
        version: 1,
        partialize: (state) => ({
          activeTool: state.activeTool,
          brushSize: state.brushSize,
          selectedTileId: state.selectedTileId,
          selectedTileIds: state.selectedTileIds,
          tileFlipX: state.tileFlipX,
          tileFlipY: state.tileFlipY,
          selectedEntityDefUid: state.selectedEntityDefUid,
          selectedIntGridValue: state.selectedIntGridValue,
        }),
      }
    ),
    { name: 'tool-store' }
  )
)

export const useActiveTool = () => useToolStore((s) => s.activeTool)
export const useActiveLayer = () => useToolStore((s) => s.activeLayer)
export const useBrushSize = () => useToolStore((s) => s.brushSize)
export const useSelectedTileId = () => useToolStore((s) => s.selectedTileId)
export const useTileFlipX = () => useToolStore((s) => s.tileFlipX)
export const useTileFlipY = () => useToolStore((s) => s.tileFlipY)
export const useSelectedEntityDefUid = () => useToolStore((s) => s.selectedEntityDefUid)
export const useSelectedIntGridValue = () => useToolStore((s) => s.selectedIntGridValue)
export const useViewportState = () => useToolStore((s) => ({
  zoom: s.zoom,
  panX: s.panX,
  panY: s.panY,
}))

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
