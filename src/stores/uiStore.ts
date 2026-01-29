/**
 * UI Store - Zustand store for UI preferences (persisted)
 * Manages: panel sizes, visibility, theme preferences
 * 
 * Stolen from: Tiled (panel layout persistence), VS Code (workspace memory)
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface PanelConfig {
  size: number          // Percentage or pixels
  collapsed: boolean
  minSize: number
  maxSize: number
}

interface UIState {
  // Panel configuration (for react-resizable-panels)
  panels: {
    left: PanelConfig    // Tileset panel
    right: PanelConfig   // Layer/Properties panel
  }
  
  // Tileset panel zoom (1-4x tile display size)
  tilesetZoom: number
  
  // Status bar visibility
  statusBarVisible: boolean
  
  // Theme (for future use)
  theme: 'dark' | 'light' | 'system'
  
  // Recent files (for future use)
  recentFiles: string[]
  
  // Dialog states
  importDialogOpen: boolean
  pendingImportPath: string | null
}

interface UIActions {
  // Panel actions
  setPanelSize: (panel: 'left' | 'right', size: number) => void
  setPanelCollapsed: (panel: 'left' | 'right', collapsed: boolean) => void
  togglePanelCollapsed: (panel: 'left' | 'right') => void
  
  // Tileset zoom
  setTilesetZoom: (zoom: number) => void
  
  // Status bar
  toggleStatusBar: () => void
  
  // Theme
  setTheme: (theme: 'dark' | 'light' | 'system') => void
  
  // Recent files
  addRecentFile: (path: string) => void
  clearRecentFiles: () => void
  
  // Dialog actions
  openImportDialog: (filePath: string) => void
  closeImportDialog: () => void
}

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        panels: {
          left: {
            size: 20,        // 20% of container
            collapsed: false,
            minSize: 15,
            maxSize: 40,
          },
          right: {
            size: 20,        // 20% of container
            collapsed: false,
            minSize: 15,
            maxSize: 35,
          },
        },
        tilesetZoom: 2,      // 2x default (good for 32px tiles)
        statusBarVisible: true,
        theme: 'dark',
        recentFiles: [],
        importDialogOpen: false,
        pendingImportPath: null,
        
        // Actions
        setPanelSize: (panel, size) => set((state) => ({
          panels: {
            ...state.panels,
            [panel]: { ...state.panels[panel], size },
          },
        })),
        
        setPanelCollapsed: (panel, collapsed) => set((state) => ({
          panels: {
            ...state.panels,
            [panel]: { ...state.panels[panel], collapsed },
          },
        })),
        
        togglePanelCollapsed: (panel) => set((state) => ({
          panels: {
            ...state.panels,
            [panel]: { 
              ...state.panels[panel], 
              collapsed: !state.panels[panel].collapsed,
            },
          },
        })),
        
        setTilesetZoom: (zoom) => set({ 
          tilesetZoom: Math.max(1, Math.min(4, zoom)),
        }),
        
        toggleStatusBar: () => set((state) => ({ 
          statusBarVisible: !state.statusBarVisible,
        })),
        
        setTheme: (theme) => set({ theme }),
        
        addRecentFile: (path) => set((state) => ({
          recentFiles: [
            path,
            ...state.recentFiles.filter(f => f !== path),
          ].slice(0, 10),  // Keep last 10
        })),
        
        clearRecentFiles: () => set({ recentFiles: [] }),
        
        openImportDialog: (filePath) => set({ 
          importDialogOpen: true, 
          pendingImportPath: filePath,
        }),
        
        closeImportDialog: () => set({ 
          importDialogOpen: false, 
          pendingImportPath: null,
        }),
      }),
      {
        name: 'prairiebob-ui',  // localStorage key
        partialize: (state) => ({
          // Only persist these fields
          panels: state.panels,
          tilesetZoom: state.tilesetZoom,
          statusBarVisible: state.statusBarVisible,
          theme: state.theme,
          recentFiles: state.recentFiles,
        }),
      }
    ),
    { name: 'ui-store' }
  )
)

// Selectors
export const useLeftPanel = () => useUIStore((s) => s.panels.left)
export const useRightPanel = () => useUIStore((s) => s.panels.right)
export const useTilesetZoom = () => useUIStore((s) => s.tilesetZoom)
export const useTheme = () => useUIStore((s) => s.theme)
export const useImportDialog = () => useUIStore((s) => ({
  open: s.importDialogOpen,
  filePath: s.pendingImportPath,
}))
