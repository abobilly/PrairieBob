/**
 * GamePreview — Full-screen pixel-accurate preview of the map
 *
 * Uses raw HTML Canvas for 1:1 rendering. Composites all visible layers
 * bottom-to-top. Supports camera controls (WASD/arrows, mouse wheel zoom).
 * F5 or Escape exits preview mode.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { LoadedTileset, LevelData } from '@/lib/types'
import { resolveTileId, stripTileFlipFlags, hasTileFlipXFlag, hasTileFlipYFlag } from '@/lib/tileset'

const VIEWPORT_PRESETS = [
  { label: '320×240 (QVGA)', width: 320, height: 240 },
  { label: '640×480 (VGA)', width: 640, height: 480 },
  { label: '800×600 (SVGA)', width: 800, height: 600 },
  { label: '1280×720 (720p)', width: 1280, height: 720 },
  { label: '1920×1080 (1080p)', width: 1920, height: 1080 },
]

const PAN_SPEED = 4

export function GamePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())

  const exitPreview = useEditorStore((s) => s.exitPreview)
  const previewViewport = useEditorStore((s) => s.previewViewport)
  const setPreviewCamera = useEditorStore((s) => s.setPreviewCamera)
  const setPreviewZoom = useEditorStore((s) => s.setPreviewZoom)
  const setPreviewViewportSize = useEditorStore((s) => s.setPreviewViewportSize)

  const mapData = useProjectStore((s) => s.mapData)
  const tilesets = useProjectStore((s) => s.tilesets)

  const [vpPreset, setVpPreset] = useState(1) // default 640x480

  // Camera state refs for animation frame
  const camRef = useRef({ x: previewViewport.x, y: previewViewport.y })
  camRef.current = { x: previewViewport.x, y: previewViewport.y }

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const vp = useEditorStore.getState().previewViewport
    const { mapData: map, tilesets: ts } = useProjectStore.getState()

    canvas.width = vp.width * vp.zoom
    canvas.height = vp.height * vp.zoom

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fill background
    ctx.fillStyle = '#1f2430'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Render layers bottom to top
    const scale = vp.zoom
    for (let li = 0; li < map.layers.length; li++) {
      const layer = map.layers[li]
      if (!layer.visible || !layer.data) continue

      const opacity = layer.opacity ?? 1
      ctx.globalAlpha = opacity

      for (let i = 0; i < layer.data.length; i++) {
        const rawTileId = layer.data[i]
        const baseTileId = stripTileFlipFlags(rawTileId)
        if (baseTileId <= 0) continue

        const resolved = resolveTileId(baseTileId, ts)
        if (!resolved) continue

        const { tileset, localTileId } = resolved
        if (tileset.status !== 'ready') continue

        const col = localTileId % tileset.tilesPerRow
        const row = Math.floor(localTileId / tileset.tilesPerRow)
        const sx = col * tileset.tileSize
        const sy = row * tileset.tileSize

        const tileX = (i % map.width) * map.tileSize
        const tileY = Math.floor(i / map.width) * map.tileSize

        const dx = (tileX - vp.x) * scale
        const dy = (tileY - vp.y) * scale
        const dw = map.tileSize * scale
        const dh = map.tileSize * scale

        // Skip tiles outside viewport
        if (dx + dw < 0 || dy + dh < 0 || dx > canvas.width || dy > canvas.height) continue

        // Handle flips
        const flipX = hasTileFlipXFlag(rawTileId)
        const flipY = hasTileFlipYFlag(rawTileId)

        if (flipX || flipY) {
          ctx.save()
          ctx.translate(dx + dw / 2, dy + dh / 2)
          ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
          ctx.drawImage(tileset.canvas, sx, sy, tileset.tileSize, tileset.tileSize, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        } else {
          ctx.drawImage(tileset.canvas, sx, sy, tileset.tileSize, tileset.tileSize, dx, dy, dw, dh)
        }
      }
    }

    ctx.globalAlpha = 1

    // Draw viewport boundary indicator
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
    ctx.setLineDash([])
  }, [])

  // Animation loop for camera movement
  useEffect(() => {
    let running = true

    const tick = () => {
      if (!running) return
      const keys = keysRef.current
      const vp = useEditorStore.getState().previewViewport
      let dx = 0
      let dy = 0

      if (keys.has('arrowleft') || keys.has('a')) dx -= PAN_SPEED
      if (keys.has('arrowright') || keys.has('d')) dx += PAN_SPEED
      if (keys.has('arrowup') || keys.has('w')) dy -= PAN_SPEED
      if (keys.has('arrowdown') || keys.has('s')) dy += PAN_SPEED

      if (dx !== 0 || dy !== 0) {
        setPreviewCamera(vp.x + dx, vp.y + dy)
      }

      renderFrame()
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [renderFrame, setPreviewCamera])

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysRef.current.add(key)

      if (key === 'escape' || key === 'f5') {
        e.preventDefault()
        exitPreview()
      }
      if (key === 'home') {
        setPreviewCamera(0, 0)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [exitPreview, setPreviewCamera])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const vp = useEditorStore.getState().previewViewport
    const delta = e.deltaY > 0 ? -1 : 1
    setPreviewZoom(vp.zoom + delta)
  }, [setPreviewZoom])

  // Viewport preset change
  const handlePresetChange = useCallback((index: number) => {
    setVpPreset(index)
    const preset = VIEWPORT_PRESETS[index]
    if (preset) {
      setPreviewViewportSize(preset.width, preset.height)
    }
  }, [setPreviewViewportSize])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Controls bar */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-black/80 flex items-center px-4 gap-4 z-10">
        <span className="text-white text-sm font-medium">Game Preview</span>
        <select
          className="h-6 text-xs bg-neutral-800 text-white border border-neutral-600 rounded px-1"
          value={vpPreset}
          onChange={(e) => handlePresetChange(Number(e.target.value))}
        >
          {VIEWPORT_PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
        <span className="text-neutral-400 text-xs">
          Zoom: {previewViewport.zoom}x | WASD/Arrows to pan | Scroll to zoom | Esc to exit
        </span>
        <div className="flex-1" />
        <button
          className="text-neutral-400 hover:text-white"
          onClick={exitPreview}
          title="Exit preview (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        className="max-w-full max-h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
