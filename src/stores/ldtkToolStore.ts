import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { toolRegistry, type ToolDefinition } from '@/lib/ldtk'

interface LdtkToolState {
  activeToolId: ToolDefinition['id']
  setActiveToolId: (toolId: ToolDefinition['id']) => void
}

const DEFAULT_TOOL_ID = toolRegistry.getAllTools()[0]?.id ?? 'tile'

export const useLdtkToolStore = create<LdtkToolState>()(
  devtools(
    (set) => ({
      activeToolId: DEFAULT_TOOL_ID,
      setActiveToolId: (toolId) => set({ activeToolId: toolId }),
    }),
    { name: 'ldtk-tool-store' }
  )
)
