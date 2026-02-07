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
  tileRotation: 0 | 90 | 180 | 270
  selectedEntityDefUid: number | null
  selectedIntGridValue: number
  collisionPaintMode: 'paint' | 'erase' | 'fill'
  stampMode: 'single' | 'rectangle' | 'random'
  paletteSnap: boolean
  entityAnimPreview: boolean
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
  rotateTileCW: () => void
  setTileRotation: (rotation: 0 | 90 | 180 | 270) => void
  setSelectedEntityDefUid: (uid: number | null) => void
  setSelectedIntGridValue: (value: number) => void
  setCollisionPaintMode: (mode: 'paint' | 'erase' | 'fill') => void
  setStampMode: (mode: 'single' | 'rectangle' | 'random') => void
  setPaletteSnap: (enabled: boolean) => void
  togglePaletteSnap: () => void
  setEntityAnimPreview: (enabled: boolean) => void
  toggleEntityAnimPreview: () => void
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
        tileRotation: 0 as 0 | 90 | 180 | 270,
        selectedEntityDefUid: null,
        selectedIntGridValue: 1,
        collisionPaintMode: 'paint' as 'paint' | 'erase' | 'fill',
        stampMode: 'single' as const,
        paletteSnap: true,
        entityAnimPreview: false,
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

        rotateTileCW: () => set((state) => {
          const next = { 0: 90, 90: 180, 180: 270, 270: 0 } as const
          state.tileRotation = next[state.tileRotation]
        }),

        setTileRotation: (rotation) => set((state) => {
          state.tileRotation = rotation
        }),

        setSelectedEntityDefUid: (uid) => set((state) => {
          state.selectedEntityDefUid = uid
        }),

        setSelectedIntGridValue: (value) => set((state) => {
          state.selectedIntGridValue = Math.max(0, Math.floor(value))
        }),

        setCollisionPaintMode: (mode) => set((state) => {
          state.collisionPaintMode = mode
        }),

        setStampMode: (mode) => set((state) => {
          state.stampMode = mode
        }),

        setPaletteSnap: (enabled) => set((state) => {
          state.paletteSnap = enabled
        }),

        togglePaletteSnap: () => set((state) => {
          state.paletteSnap = !state.paletteSnap
        }),

        setEntityAnimPreview: (enabled) => set((state) => {
          state.entityAnimPreview = enabled
        }),

        toggleEntityAnimPreview: () => set((state) => {
          state.entityAnimPreview = !state.entityAnimPreview
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
          tileRotation: state.tileRotation,
          selectedEntityDefUid: state.selectedEntityDefUid,
          selectedIntGridValue: state.selectedIntGridValue,
          collisionPaintMode: state.collisionPaintMode,
          stampMode: state.stampMode,
          paletteSnap: state.paletteSnap,
          entityAnimPreview: state.entityAnimPreview,
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
export const useCollisionPaintMode = () => useToolStore((s) => s.collisionPaintMode)
export const useStampMode = () => useToolStore((s) => s.stampMode)
export const usePaletteSnap = () => useToolStore((s) => s.paletteSnap)
export const useEntityAnimPreview = () => useToolStore((s) => s.entityAnimPreview)
export const useViewportState = () => useToolStore((s) => ({
  zoom: s.zoom,
  panX: s.panX,
  panY: s.panY,
}))

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
