/**
 * WorldMinimap
 *
 * A compact world overview that sits in the corner of the editor canvas.
 * Shows all rooms as small colored rectangles with the current room highlighted.
 * Click a room to switch to it. Visible only when NOT in World View mode
 * and when the project has 2+ rooms.
 *
 * Features:
 * - Auto-scales to fit all rooms in a small viewport
 * - Current room highlighted with gold border
 * - Connection lines between rooms
 * - Click to navigate to a room
 * - Toggleable with a small collapse button
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon, X } from 'lucide-react'
import { useProjectStore, type RoomFileEntry } from '@/stores/projectStore'
import type { WorldLayout, DoorConnection } from '@/lib/world-layout'

// ============== Constants ==============

const MINIMAP_WIDTH = 180
const MINIMAP_HEIGHT = 120
const MINIMAP_PADDING = 12
const ROOM_MIN_SIZE = 12
const BG_COLOR = 'rgba(10, 10, 20, 0.85)'
const BORDER_COLOR = 'rgba(100, 140, 255, 0.3)'
const ROOM_FILL = 'rgba(60, 90, 160, 0.6)'
const ROOM_CURRENT_FILL = 'rgba(255, 209, 102, 0.3)'
const ROOM_CURRENT_STROKE = '#ffd166'
const ROOM_HOVER_FILL = 'rgba(100, 150, 255, 0.5)'
const ROOM_STROKE = 'rgba(100, 140, 255, 0.4)'
const WIRE_COLOR = 'rgba(255, 140, 60, 0.3)'
const LABEL_COLOR = 'rgba(255, 255, 255, 0.6)'
const AUTO_COLS = 4
const AUTO_GAP = 40
const ROOM_CANVAS_W = 200
const ROOM_CANVAS_H = 150

// ============== Component ==============

export function WorldMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  const roomRegistry = useProjectStore((s) => s.roomRegistry)
  const worldLayout = useProjectStore((s) => s.worldLayout)
  const currentRoomPath = useProjectStore((s) => s.currentRoomPath)
  const openRoom = useProjectStore((s) => s.openRoom)

  // Don't render if less than 2 rooms
  if (roomRegistry.length < 2) return null

  // Compute room positions (same logic as WorldViewCanvas)
  const positions = useMemo(() => {
    const posMap: Map<string, { x: number; y: number }> = new Map()

    for (const room of roomRegistry) {
      const saved = worldLayout.rooms.find((r) => r.roomId === room.id)
      if (saved) {
        posMap.set(room.id, { x: saved.x, y: saved.y })
      }
    }

    let autoIndex = 0
    for (const room of roomRegistry) {
      if (posMap.has(room.id)) continue
      const col = autoIndex % AUTO_COLS
      const row = Math.floor(autoIndex / AUTO_COLS)
      posMap.set(room.id, {
        x: col * (ROOM_CANVAS_W + AUTO_GAP),
        y: row * (ROOM_CANVAS_H + AUTO_GAP),
      })
      autoIndex++
    }

    return posMap
  }, [roomRegistry, worldLayout])

  // Compute transform (scale + offset to fit all rooms in minimap)
  const transform = useMemo(() => {
    if (positions.size === 0) return { scale: 1, offsetX: 0, offsetY: 0 }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pos of positions.values()) {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + ROOM_CANVAS_W)
      maxY = Math.max(maxY, pos.y + ROOM_CANVAS_H)
    }

    const worldW = maxX - minX || 1
    const worldH = maxY - minY || 1
    const usableW = MINIMAP_WIDTH - MINIMAP_PADDING * 2
    const usableH = MINIMAP_HEIGHT - MINIMAP_PADDING * 2
    const scale = Math.min(usableW / worldW, usableH / worldH)

    const scaledW = worldW * scale
    const scaledH = worldH * scale
    const offsetX = MINIMAP_PADDING + (usableW - scaledW) / 2 - minX * scale
    const offsetY = MINIMAP_PADDING + (usableH - scaledH) / 2 - minY * scale

    return { scale, offsetX, offsetY }
  }, [positions])

  // Hit test: screen coords (relative to canvas) → room ID
  const hitTest = useCallback(
    (sx: number, sy: number): string | null => {
      const { scale, offsetX, offsetY } = transform

      for (const room of roomRegistry) {
        const pos = positions.get(room.id)
        if (!pos) continue

        const rx = pos.x * scale + offsetX
        const ry = pos.y * scale + offsetY
        const rw = Math.max(ROOM_MIN_SIZE, ROOM_CANVAS_W * scale)
        const rh = Math.max(ROOM_MIN_SIZE, ROOM_CANVAS_H * scale)

        if (sx >= rx && sx <= rx + rw && sy >= ry && sy <= ry + rh) {
          return room.id
        }
      }
      return null
    },
    [roomRegistry, positions, transform],
  )

  // Draw minimap
  useEffect(() => {
    if (collapsed) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = MINIMAP_WIDTH * dpr
    canvas.height = MINIMAP_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    const { scale, offsetX, offsetY } = transform

    // Background
    ctx.fillStyle = BG_COLOR
    ctx.beginPath()
    ctx.roundRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT, 6)
    ctx.fill()

    // Border
    ctx.strokeStyle = BORDER_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT, 6)
    ctx.stroke()

    // Connections
    const roomMap: Map<string, { x: number; y: number }> = new Map()
    for (const room of roomRegistry) {
      const pos = positions.get(room.id)
      if (pos) roomMap.set(room.id, pos)
    }

    for (const conn of worldLayout.connections) {
      const src = roomMap.get(conn.sourceRoomId)
      const tgt = roomMap.get(conn.targetRoomId)
      if (!src || !tgt) continue

      const srcCx = (src.x + ROOM_CANVAS_W / 2) * scale + offsetX
      const srcCy = (src.y + ROOM_CANVAS_H / 2) * scale + offsetY
      const tgtCx = (tgt.x + ROOM_CANVAS_W / 2) * scale + offsetX
      const tgtCy = (tgt.y + ROOM_CANVAS_H / 2) * scale + offsetY

      ctx.strokeStyle = WIRE_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(srcCx, srcCy)
      ctx.lineTo(tgtCx, tgtCy)
      ctx.stroke()
    }

    // Rooms
    for (const room of roomRegistry) {
      const pos = positions.get(room.id)
      if (!pos) continue

      const rx = pos.x * scale + offsetX
      const ry = pos.y * scale + offsetY
      const rw = Math.max(ROOM_MIN_SIZE, ROOM_CANVAS_W * scale)
      const rh = Math.max(ROOM_MIN_SIZE, ROOM_CANVAS_H * scale)
      const isCurrent = currentRoomPath !== null && currentRoomPath.includes(room.id)
      const isHovered = room.id === hoveredRoomId

      ctx.fillStyle = isCurrent ? ROOM_CURRENT_FILL : isHovered ? ROOM_HOVER_FILL : ROOM_FILL
      ctx.fillRect(rx, ry, rw, rh)

      ctx.strokeStyle = isCurrent ? ROOM_CURRENT_STROKE : ROOM_STROKE
      ctx.lineWidth = isCurrent ? 1.5 : 0.5
      ctx.strokeRect(rx, ry, rw, rh)

      // Room label (only if room rect is big enough)
      if (rw > 20) {
        ctx.font = '7px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = LABEL_COLOR
        ctx.fillText(room.id, rx + rw / 2, ry + rh / 2, rw - 4)
      }
    }
  }, [roomRegistry, worldLayout, positions, transform, currentRoomPath, hoveredRoomId, collapsed])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const roomId = hitTest(sx, sy)
      if (roomId) {
        void openRoom(roomId)
      }
    },
    [hitTest, openRoom],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const roomId = hitTest(sx, sy)
      setHoveredRoomId(roomId)
    },
    [hitTest],
  )

  if (collapsed) {
    return (
      <button
        className="absolute bottom-3 right-3 z-10 rounded bg-black/60 p-1.5 text-white/50 hover:text-white/80 transition-colors"
        onClick={() => setCollapsed(false)}
        title="Show minimap"
      >
        <MapIcon size={14} />
      </button>
    )
  }

  return (
    <div className="absolute bottom-3 right-3 z-10" style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-md cursor-pointer"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredRoomId(null)}
      />
      <button
        className="absolute top-1 right-1 rounded p-0.5 text-white/40 hover:text-white/80 transition-colors"
        onClick={() => setCollapsed(true)}
        title="Hide minimap"
      >
        <X size={10} />
      </button>
    </div>
  )
}
