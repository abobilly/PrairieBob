import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Tool } from '@/lib/types'
import { useEditorStore } from './editorStore'

interface ToolState {
  activeTool: Tool
  brushSize: number
  setActiveTool: (tool: Tool) => void
  setBrushSize: (size: number) => void
}

const DEFAULT_BRUSH_SIZE = 16

export const useToolStore = create<ToolState>()(
  devtools(
    (set) => ({
      activeTool: useEditorStore.getState().currentTool,
      brushSize: DEFAULT_BRUSH_SIZE,
      setActiveTool: (tool) => set({ activeTool: tool }),
      setBrushSize: (size) => set({ brushSize: Math.max(1, Math.round(size)) }),
    }),
    { name: 'tool-store' }
  )
)

useEditorStore.subscribe((state) => {
  const currentTool = useToolStore.getState().activeTool
  if (state.currentTool !== currentTool) {
    useToolStore.setState({ activeTool: state.currentTool })
  }
})
