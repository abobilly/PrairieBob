import { useCallback, useMemo } from 'react'
import { useEditorStore } from '@/stores'

export function useViewport() {
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setPan = useEditorStore((s) => s.setPan)
  const zoomReset = useEditorStore((s) => s.zoomReset)

  const pan = useMemo(() => ({ x: panX, y: panY }), [panX, panY])

  const reset = useCallback(() => {
    zoomReset()
    setPan(0, 0)
  }, [zoomReset, setPan])

  return {
    zoom,
    pan,
    setZoom,
    setPan,
    reset,
  }
}

export function useScreenToWorld(screenX: number, screenY: number) {
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)

  return useMemo(() => ({
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  }), [screenX, screenY, zoom, panX, panY])
}

export function useWorldToScreen(worldX: number, worldY: number) {
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)

  return useMemo(() => ({
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  }), [worldX, worldY, zoom, panX, panY])
}
