/**
 * Zustand Stores Index
 * 
 * Re-exports all stores for convenient importing
 */

export { useEditorStore } from './editorStore'
export { useProjectStore } from './projectStore'
export { useUIStore } from './uiStore'

// Re-export selectors
export {
  useCurrentTool,
  useZoom,
  usePan,
  useGridVisible,
  useStamp,
  useSelectedTileId,
  useActiveTilesetId,
  useActiveLayerIndex,
  useSelectedEntityId,
  useModifiers,
  useCursorTile,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
} from './editorStore'

export {
  useMapData,
  useLayers,
  useTilesets,
  useCanUndo,
  useCanRedo,
  useHasUnsavedChanges,
} from './projectStore'

export {
  useLeftPanel,
  useRightPanel,
  useTilesetZoom,
  useTheme,
  useImportDialog,
} from './uiStore'
