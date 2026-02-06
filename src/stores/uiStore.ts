/**
 * UI Store - Zustand store for UI preferences (persisted)
 * Manages: panel sizes, visibility, theme preferences
 * 
 * Stolen from: Tiled (panel layout persistence), VS Code (workspace memory)
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface PanelConfig {
  size: number          // Percentage of panel group (0-100)
  collapsed: boolean
  minSize: number
  maxSize: number
}

interface RecentProject {
  path: string
  name: string
  lastOpened: string
}

interface UIState {
  // Panel configuration - simple collapsed state
  panels: {
    left: PanelConfig    // Tileset panel
    right: PanelConfig   // Layer/Properties panel
    bottom: PanelConfig  // Agent panel
  }

  // Tileset panel zoom (1-4x tile display size)
  tilesetZoom: number

  // Status bar visibility
  statusBarVisible: boolean

  // Theme (for future use)
  theme: 'dark' | 'light' | 'system'

  // Recent projects (persisted)
  recentProjects: RecentProject[]

  // Dialog states
  importDialogOpen: boolean
  pendingImportPath: string | null

  // Startup dialogs
  showProjectSelector: boolean
  showNewProjectWizard: boolean

  // Kimbar auto-load
  autoLoadKimbar: boolean
}

interface UIActions {
  // Panel actions
  setPanelSize: (panel: 'left' | 'right' | 'bottom', size: number) => void
  setPanelCollapsed: (panel: 'left' | 'right' | 'bottom', collapsed: boolean) => void
  togglePanelCollapsed: (panel: 'left' | 'right' | 'bottom') => void

  // Tileset zoom
  setTilesetZoom: (zoom: number) => void

  // Status bar
  toggleStatusBar: () => void

  // Theme
  setTheme: (theme: 'dark' | 'light' | 'system') => void

  // Recent projects
  addRecentProject: (path: string, name: string) => void
  removeRecentProject: (path: string) => void
  clearRecentProjects: () => void

  // Dialog actions
  openImportDialog: (filePath: string) => void
  closeImportDialog: () => void

  // Startup dialogs
  openProjectSelector: () => void
  closeProjectSelector: () => void
  openNewProjectWizard: () => void
  closeNewProjectWizard: () => void

  // Kimbar auto-load
  setAutoLoadKimbar: (enabled: boolean) => void
}

const PERSIST_KEY = 'spudtile-ui-v2'

const DEFAULT_PANELS: UIState['panels'] = {
  left: {
    size: 24,
    collapsed: false,
    minSize: 16,
    maxSize: 38,
  },
  right: {
    size: 24,
    collapsed: false,
    minSize: 16,
    maxSize: 38,
  },
  bottom: {
    size: 24,
    collapsed: true,
    minSize: 14,
    maxSize: 45,
  },
}

function normalizePercent(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  // Migrate legacy pixel-based persisted values (e.g. 220/280/400) back to sane percentage defaults.
  if (value > 100) return fallback
  return Math.min(Math.max(value, min), max)
}

function sanitizePanelConfig(value: unknown, fallback: PanelConfig): PanelConfig {
  const v = (value ?? {}) as Partial<PanelConfig>

  const minSize = normalizePercent(v.minSize, fallback.minSize, 1, 80)
  const maxSize = normalizePercent(v.maxSize, fallback.maxSize, minSize, 95)

  const size = normalizePercent(v.size, fallback.size, minSize, maxSize)

  return {
    size,
    collapsed: typeof v.collapsed === 'boolean' ? v.collapsed : fallback.collapsed,
    minSize,
    maxSize,
  }
}

function sanitizePanels(value: unknown, fallback: UIState['panels']): UIState['panels'] {
  const v = (value ?? {}) as Partial<UIState['panels']>
  return {
    left: sanitizePanelConfig(v.left, fallback.left),
    right: sanitizePanelConfig(v.right, fallback.right),
    bottom: sanitizePanelConfig(v.bottom, fallback.bottom),
  }
}

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        panels: {
          left: {
            size: DEFAULT_PANELS.left.size,
            collapsed: false,
            minSize: DEFAULT_PANELS.left.minSize,
            maxSize: DEFAULT_PANELS.left.maxSize,
          },
          right: {
            size: DEFAULT_PANELS.right.size,
            collapsed: false,
            minSize: DEFAULT_PANELS.right.minSize,
            maxSize: DEFAULT_PANELS.right.maxSize,
          },
          bottom: {
            size: DEFAULT_PANELS.bottom.size,
            collapsed: true,
            minSize: DEFAULT_PANELS.bottom.minSize,
            maxSize: DEFAULT_PANELS.bottom.maxSize,
          },
        },
        tilesetZoom: 1,      // 1x default for compact panel
        statusBarVisible: true,
        theme: 'dark',
        recentProjects: [],
        importDialogOpen: false,
        pendingImportPath: null,
        showProjectSelector: true,  // Show on startup
        showNewProjectWizard: false,
        autoLoadKimbar: false,

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

        addRecentProject: (path, name) => set((state) => ({
          recentProjects: [
            { path, name, lastOpened: new Date().toISOString() },
            ...state.recentProjects.filter(p => p.path !== path),
          ].slice(0, 10),  // Keep last 10
        })),

        removeRecentProject: (path) => set((state) => ({
          recentProjects: state.recentProjects.filter(p => p.path !== path),
        })),

        clearRecentProjects: () => set({ recentProjects: [] }),

        openImportDialog: (filePath) => set({
          importDialogOpen: true,
          pendingImportPath: filePath,
        }),

        closeImportDialog: () => set({
          importDialogOpen: false,
          pendingImportPath: null,
        }),

        openProjectSelector: () => set({ showProjectSelector: true }),
        closeProjectSelector: () => set({ showProjectSelector: false }),
        openNewProjectWizard: () => set({ showNewProjectWizard: true }),
        closeNewProjectWizard: () => set({ showNewProjectWizard: false }),
        setAutoLoadKimbar: (enabled) => set({ autoLoadKimbar: enabled }),
      }),
      {
        name: PERSIST_KEY,  // localStorage key
        version: 2,
        partialize: (state) => ({
          // Only persist these fields
          panels: state.panels,
          tilesetZoom: state.tilesetZoom,
          statusBarVisible: state.statusBarVisible,
          theme: state.theme,
          recentProjects: state.recentProjects,
          autoLoadKimbar: state.autoLoadKimbar,
        }),
        merge: (persistedState, currentState) => {
          // Default merge is shallow; we need to deep-merge + sanitize nested panel config.
          const p = (persistedState ?? {}) as Partial<UIState>

          const mergedPanels = sanitizePanels(p.panels, currentState.panels)
          // Ensure we always have full panel shape (helps with older persisted state)
          const finalPanels = sanitizePanels(mergedPanels, DEFAULT_PANELS)

          return {
            ...currentState,
            ...p,
            panels: finalPanels,
          }
        },
        migrate: (persistedState) => {
          // Normalize older/corrupted persisted values (e.g. null minSize/maxSize)
          const p = (persistedState ?? {}) as Partial<UIState>
          const migratedPanels = sanitizePanels(p.panels, DEFAULT_PANELS)
          migratedPanels.bottom = {
            ...migratedPanels.bottom,
            collapsed: true,
          }
          return {
            ...p,
            panels: migratedPanels,
          } as UIState
        },
      }
    ),
    { name: 'ui-store' }
  )
)

// Selectors
export const useLeftPanel = () => useUIStore((s) => s.panels.left)
export const useRightPanel = () => useUIStore((s) => s.panels.right)
export const useBottomPanel = () => useUIStore((s) => s.panels.bottom)
export const useTilesetZoom = () => useUIStore((s) => s.tilesetZoom)
export const useTheme = () => useUIStore((s) => s.theme)
export const useImportDialog = () => useUIStore((s) => ({
  open: s.importDialogOpen,
  filePath: s.pendingImportPath,
}))
