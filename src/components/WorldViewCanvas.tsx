/**
 * WorldViewCanvas
 *
 * Multi-room world overview canvas for SpudTile.
 *
 * Features:
 * - Pan (middle-click drag or spacebar+drag) and zoom (scroll wheel)
 * - Room rectangles with labels, colored by current/selected state
 * - Auto-position fallback when no saved positions
 * - Room drag with persisted position update
 * - Connection wires with bezier curves, labels, arrowheads
 * - Alt+drag from room to room to create connections
 * - Right-click context menu with connection delete
 * - Double-click to open a room
 *
 * Does NOT interfere with the normal editor canvas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore, type RoomFileEntry } from '@/stores/projectStore'
import type { WorldLayout, DoorConnection } from '@/lib/world-layout'
import { WorldViewContextMenu } from './WorldViewContextMenu'

// ============== Constants ==============

const BG_COLOR = '#1a1a2e'
const GRID_COLOR = 'rgba(255, 255, 255, 0.04)'
const ROOM_FILL = 'rgba(40, 60, 120, 0.5)'
const ROOM_STROKE = 'rgba(100, 140, 255, 0.6)'
const ROOM_HOVER_FILL = 'rgba(60, 90, 160, 0.6)'
const ROOM_HOVER_STROKE = '#6692ff'
const ROOM_CURRENT_FILL = 'rgba(255, 209, 102, 0.15)'
const ROOM_CURRENT_STROKE = '#ffd166'
const LABEL_COLOR = 'rgba(255, 255, 255, 0.85)'
const LABEL_SHADOW = 'rgba(0, 0, 0, 0.6)'
const WIRE_COLOR = 'rgba(255, 140, 60, 0.5)'
const WIRE_HOVER_COLOR = 'rgba(255, 180, 100, 0.9)'
const WIRE_PREVIEW_COLOR = 'rgba(100, 200, 255, 0.6)'
const DOOR_MARKER_COLOR = 'rgba(255, 140, 60, 0.8)'
const CONN_LABEL_BG = 'rgba(0, 0, 0, 0.6)'
const CONN_LABEL_COLOR = 'rgba(255, 200, 140, 0.9)'
const CONNECT_MODE_GLOW = 'rgba(100, 200, 255, 0.3)'
const ROOM_WIDTH = 200
const ROOM_HEIGHT = 150
const GRID_SNAP = 20
const DRAG_THRESHOLD = 4
const AUTO_COLS = 4
const AUTO_GAP = 40
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const WIRE_HIT_TOLERANCE = 8

// ============== Types ==============

interface RoomRect {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  isCurrent: boolean
}

interface DragState {
  roomId: string
  offsetX: number
  offsetY: number
  startScreenX: number
  startScreenY: number
  moved: boolean
}

interface PanState {
  startScreenX: number
  startScreenY: number
  startPanX: number
  startPanY: number
}

interface ConnectDragState {
  sourceRoomId: string
  /** World coords of current mouse position */
  worldX: number
  worldY: number
}

interface ContextMenuState {
  x: number
  y: number
  roomId: string | null
  connectionId: string | null
}

// ============== Helpers ==============

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}

function autoPositionRooms(
  rooms: RoomFileEntry[],
  layout: WorldLayout,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  for (const room of rooms) {
    const saved = layout.rooms.find((r) => r.roomId === room.id)
    if (saved) {
      positions.set(room.id, { x: saved.x, y: saved.y })
    }
  }

  // Auto-position rooms without saved positions
  let autoIndex = 0
  for (const room of rooms) {
    if (positions.has(room.id)) continue
    const col = autoIndex % AUTO_COLS
    const row = Math.floor(autoIndex / AUTO_COLS)
    positions.set(room.id, {
      x: col * (ROOM_WIDTH + AUTO_GAP),
      y: row * (ROOM_HEIGHT + AUTO_GAP),
    })
    autoIndex++
  }

  return positions
}

function buildRoomRects(
  rooms: RoomFileEntry[],
  positions: Map<string, { x: number; y: number }>,
  currentRoomPath: string | null,
): RoomRect[] {
  return rooms.map((room) => {
    const pos = positions.get(room.id) ?? { x: 0, y: 0 }
    const isCurrent = currentRoomPath !== null && currentRoomPath.includes(room.id)
    return {
      id: room.id,
      name: room.name,
      x: pos.x,
      y: pos.y,
      width: ROOM_WIDTH,
      height: ROOM_HEIGHT,
      isCurrent,
    }
  })
}

function hitTestRoom(
  rooms: RoomRect[],
  worldX: number,
  worldY: number,
): RoomRect | null {
  // Test in reverse order (top-most first)
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i]
    if (
      worldX >= room.x &&
      worldX <= room.x + room.width &&
      worldY >= room.y &&
      worldY <= room.y + room.height
    ) {
      return room
    }
  }
  return null
}

// ============== Component ==============

export function WorldViewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Store state
  const roomRegistry = useProjectStore((s) => s.roomRegistry)
  const worldLayout = useProjectStore((s) => s.worldLayout)
  const currentRoomPath = useProjectStore((s) => s.currentRoomPath)
  const updateRoomPosition = useProjectStore((s) => s.updateRoomPosition)
  const saveWorldLayoutToDisk = useProjectStore((s) => s.saveWorldLayoutToDisk)
  const addDoorConnection = useProjectStore((s) => s.addDoorConnection)
  const removeDoorConnection = useProjectStore((s) => s.removeDoorConnection)
  const openRoom = useProjectStore((s) => s.openRoom)

  // Local state
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [cursor, setCursor] = useState('grab')

  const dragRef = useRef<DragState | null>(null)
  const panRef = useRef<PanState | null>(null)
  const connectRef = useRef<ConnectDragState | null>(null)
  const fittedRef = useRef(false)

  // For connection drag preview rendering
  const [connectPreview, setConnectPreview] = useState<ConnectDragState | null>(null)

  // Compute positions and rects
  const positions = useMemo(
    () => autoPositionRooms(roomRegistry, worldLayout),
    [roomRegistry, worldLayout],
  )

  const roomRects = useMemo(
    () => buildRoomRects(roomRegistry, positions, currentRoomPath),
    [roomRegistry, positions, currentRoomPath],
  )

  // Screen <-> world coordinate transforms
  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - panX) / zoom,
      y: (sy - panY) / zoom,
    }),
    [panX, panY, zoom],
  )

  // ============== Fit view on first render ==============
  useEffect(() => {
    if (fittedRef.current || roomRects.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    fittedRef.current = true

    // Calculate bounding box of all rooms
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const room of roomRects) {
      minX = Math.min(minX, room.x)
      minY = Math.min(minY, room.y)
      maxX = Math.max(maxX, room.x + room.width)
      maxY = Math.max(maxY, room.y + room.height)
    }
    const worldW = maxX - minX + 100
    const worldH = maxY - minY + 100
    const fitZoom = Math.min(
      canvas.width / worldW,
      canvas.height / worldH,
      2,
    )
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    setZoom(Math.max(MIN_ZOOM, fitZoom))
    setPanX(canvas.width / 2 - centerX * fitZoom)
    setPanY(canvas.height / 2 - centerY * fitZoom)
  }, [roomRects])

  // ============== Drawing ==============
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Handle DPR scaling
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.scale(dpr, dpr)
    }

    const w = canvas.clientWidth
    const h = canvas.clientHeight

    // Clear
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, w, h)

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    // Grid
    drawGrid(ctx, panX, panY, zoom, w, h)

    // Connection wires (bezier)
    drawConnections(ctx, worldLayout.connections, roomRects, hoveredConnectionId, zoom)

    // Room rectangles
    for (const room of roomRects) {
      const isHovered = room.id === hoveredRoomId
      const isConnectTarget = connectRef.current !== null && room.id !== connectRef.current.sourceRoomId
      drawRoom(ctx, room, isHovered, isConnectTarget, zoom)
    }

    // Connection drag preview
    if (connectPreview) {
      const srcRoom = roomRects.find((r) => r.id === connectPreview.sourceRoomId)
      if (srcRoom) {
        drawConnectionPreview(
          ctx,
          srcRoom.x + srcRoom.width / 2,
          srcRoom.y + srcRoom.height / 2,
          connectPreview.worldX,
          connectPreview.worldY,
          zoom,
        )
      }
    }

    ctx.restore()
  }, [roomRects, worldLayout, hoveredRoomId, hoveredConnectionId, connectPreview, zoom, panX, panY])

  // ============== Resize observer ==============
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      // Trigger redraw by setting zoom to itself
      setZoom((z) => z)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ============== Mouse handlers ==============
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor))

      // Zoom towards cursor
      const worldX = (mouseX - panX) / zoom
      const worldY = (mouseY - panY) / zoom
      setPanX(mouseX - worldX * newZoom)
      setPanY(mouseY - worldY * newZoom)
      setZoom(newZoom)
    },
    [zoom, panX, panY],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null)
        return
      }

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const world = screenToWorld(screenX, screenY)

      // Right-click = context menu
      if (e.button === 2) {
        e.preventDefault()
        const hit = hitTestRoom(roomRects, world.x, world.y)
        const hitConn = !hit ? hitTestConnection(worldLayout.connections, roomRects, world.x, world.y, zoom) : null
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          roomId: hit?.id ?? null,
          connectionId: hitConn,
        })
        return
      }

      // Middle-click = pan
      if (e.button === 1) {
        e.preventDefault()
        panRef.current = {
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startPanX: panX,
          startPanY: panY,
        }
        setCursor('grabbing')
        return
      }

      // Alt+left-click on a room = start connection drag
      if (e.altKey) {
        const hit = hitTestRoom(roomRects, world.x, world.y)
        if (hit) {
          connectRef.current = {
            sourceRoomId: hit.id,
            worldX: world.x,
            worldY: world.y,
          }
          setConnectPreview({
            sourceRoomId: hit.id,
            worldX: world.x,
            worldY: world.y,
          })
          setCursor('crosshair')
          return
        }
      }

      // Left-click
      const hit = hitTestRoom(roomRects, world.x, world.y)
      if (hit) {
        dragRef.current = {
          roomId: hit.id,
          offsetX: world.x - hit.x,
          offsetY: world.y - hit.y,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          moved: false,
        }
        setCursor('grabbing')
      } else {
        // Pan on empty space
        panRef.current = {
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startPanX: panX,
          startPanY: panY,
        }
        setCursor('grabbing')
      }
    },
    [contextMenu, screenToWorld, roomRects, worldLayout.connections, panX, panY, zoom],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const world = screenToWorld(screenX, screenY)

      // Connection drag
      if (connectRef.current) {
        connectRef.current.worldX = world.x
        connectRef.current.worldY = world.y
        setConnectPreview({ ...connectRef.current })
        const targetHit = hitTestRoom(roomRects, world.x, world.y)
        setCursor(targetHit && targetHit.id !== connectRef.current.sourceRoomId ? 'cell' : 'crosshair')
        return
      }

      // Panning
      if (panRef.current) {
        const dx = e.clientX - panRef.current.startScreenX
        const dy = e.clientY - panRef.current.startScreenY
        setPanX(panRef.current.startPanX + dx)
        setPanY(panRef.current.startPanY + dy)
        return
      }

      // Dragging a room
      if (dragRef.current) {
        const dx = Math.abs(e.clientX - dragRef.current.startScreenX)
        const dy = Math.abs(e.clientY - dragRef.current.startScreenY)
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          dragRef.current.moved = true
        }

        if (dragRef.current.moved) {
          const newX = snapToGrid(world.x - dragRef.current.offsetX)
          const newY = snapToGrid(world.y - dragRef.current.offsetY)
          updateRoomPosition(dragRef.current.roomId, newX, newY)
        }
        return
      }

      // Hover detection
      const hit = hitTestRoom(roomRects, world.x, world.y)
      setHoveredRoomId(hit?.id ?? null)

      // Connection hover detection
      if (!hit) {
        const connHit = hitTestConnection(worldLayout.connections, roomRects, world.x, world.y, zoom)
        setHoveredConnectionId(connHit)
        setCursor(connHit ? 'pointer' : 'grab')
      } else {
        setHoveredConnectionId(null)
        setCursor('pointer')
      }
    },
    [screenToWorld, roomRects, worldLayout.connections, updateRoomPosition, zoom],
  )

  const handleMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      // Finish connection drag
      if (connectRef.current) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = _e.clientX - rect.left
          const screenY = _e.clientY - rect.top
          const world = screenToWorld(screenX, screenY)
          const targetHit = hitTestRoom(roomRects, world.x, world.y)

          if (targetHit && targetHit.id !== connectRef.current.sourceRoomId) {
            // Create a manual connection
            const connId = `manual:${connectRef.current.sourceRoomId}:${targetHit.id}:${Date.now()}`
            addDoorConnection({
              id: connId,
              sourceRoomId: connectRef.current.sourceRoomId,
              sourceEntityId: '',
              targetRoomId: targetHit.id,
              targetEntityId: '',
              connectionType: 'door',
            })
            void saveWorldLayoutToDisk()
          }
        }
        connectRef.current = null
        setConnectPreview(null)
        setCursor('grab')
        return
      }

      if (panRef.current) {
        panRef.current = null
        setCursor('grab')
        return
      }

      if (dragRef.current) {
        if (dragRef.current.moved) {
          // Persist position change
          void saveWorldLayoutToDisk()
        }
        dragRef.current = null
        setCursor('grab')
        return
      }
    },
    [screenToWorld, roomRects, addDoorConnection, saveWorldLayoutToDisk],
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const world = screenToWorld(screenX, screenY)
      const hit = hitTestRoom(roomRects, world.x, world.y)
      if (hit) {
        void openRoom(hit.id)
      }
    },
    [screenToWorld, roomRects, openRoom],
  )

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // ============== Context menu handlers ==============
  const handleContextOpen = useCallback(
    (roomId: string) => {
      void openRoom(roomId)
    },
    [openRoom],
  )

  const handleContextResetPosition = useCallback(
    (roomId: string) => {
      // Find auto-position for this room
      const idx = roomRegistry.findIndex((r) => r.id === roomId)
      if (idx === -1) return
      const col = idx % AUTO_COLS
      const row = Math.floor(idx / AUTO_COLS)
      updateRoomPosition(roomId, col * (ROOM_WIDTH + AUTO_GAP), row * (ROOM_HEIGHT + AUTO_GAP))
      void saveWorldLayoutToDisk()
    },
    [roomRegistry, updateRoomPosition, saveWorldLayoutToDisk],
  )

  const handleContextDeleteConnection = useCallback(
    (connectionId: string) => {
      removeDoorConnection(connectionId)
      void saveWorldLayoutToDisk()
    },
    [removeDoorConnection, saveWorldLayoutToDisk],
  )

  // ============== Render ==============
  if (roomRegistry.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[var(--pb-text-muted)]">
        <div className="text-center">
          <div className="text-lg mb-1">No rooms found</div>
          <div className="text-xs">Load a project with multiple room files to use World View</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Status bar */}
      <div className="absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-[10px] text-white/60">
        {roomRegistry.length} rooms · {worldLayout.connections.length} connections · Zoom {(zoom * 100).toFixed(0)}%
        {connectRef.current && ' · Connecting...'}
      </div>

      {/* Alt-drag hint */}
      <div className="absolute top-3 right-3 rounded bg-black/40 px-2 py-1 text-[10px] text-white/40">
        Alt+Drag to connect · Double-click to open
      </div>

      {/* Context menu */}
      {contextMenu && (
        <WorldViewContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          roomId={contextMenu.roomId}
          connectionId={contextMenu.connectionId}
          connections={worldLayout.connections}
          onClose={() => setContextMenu(null)}
          onOpenRoom={handleContextOpen}
          onResetPosition={handleContextResetPosition}
          onDeleteConnection={handleContextDeleteConnection}
        />
      )}
    </div>
  )
}

// ============== Hit testing ==============

/** Point-to-bezier-segment distance check for connection wires. */
function hitTestConnection(
  connections: DoorConnection[],
  rooms: RoomRect[],
  worldX: number,
  worldY: number,
  zoom: number,
): string | null {
  const roomMap = new Map(rooms.map((r) => [r.id, r]))
  const tolerance = WIRE_HIT_TOLERANCE / zoom

  for (const conn of connections) {
    const src = roomMap.get(conn.sourceRoomId)
    const tgt = roomMap.get(conn.targetRoomId)
    if (!src || !tgt) continue

    const { srcEdge, tgtEdge } = getConnectionEdgePoints(src, tgt)
    const cp = getBezierControlPoint(srcEdge.x, srcEdge.y, tgtEdge.x, tgtEdge.y)

    // Sample the bezier curve and check distance
    for (let t = 0; t <= 1; t += 0.05) {
      const bx = (1 - t) * (1 - t) * srcEdge.x + 2 * (1 - t) * t * cp.x + t * t * tgtEdge.x
      const by = (1 - t) * (1 - t) * srcEdge.y + 2 * (1 - t) * t * cp.y + t * t * tgtEdge.y
      const dx = worldX - bx
      const dy = worldY - by
      if (dx * dx + dy * dy < tolerance * tolerance) {
        return conn.id
      }
    }
  }
  return null
}

// ============== Drawing functions ==============

function drawGrid(
  ctx: CanvasRenderingContext2D,
  panX: number,
  panY: number,
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const gridSize = 100
  const startX = Math.floor(-panX / zoom / gridSize) * gridSize - gridSize
  const startY = Math.floor(-panY / zoom / gridSize) * gridSize - gridSize
  const endX = startX + canvasWidth / zoom + gridSize * 2
  const endY = startY + canvasHeight / zoom + gridSize * 2

  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1 / zoom
  ctx.beginPath()
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.moveTo(x, startY)
    ctx.lineTo(x, endY)
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.moveTo(startX, y)
    ctx.lineTo(endX, y)
  }
  ctx.stroke()
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: RoomRect,
  isHovered: boolean,
  isConnectTarget: boolean,
  zoom: number,
): void {
  const { x, y, width, height, name, isCurrent } = room

  // Connect-target glow
  if (isConnectTarget) {
    ctx.fillStyle = CONNECT_MODE_GLOW
    ctx.fillRect(x - 4, y - 4, width + 8, height + 8)
  }

  // Fill
  if (isCurrent) {
    ctx.fillStyle = ROOM_CURRENT_FILL
  } else if (isHovered) {
    ctx.fillStyle = ROOM_HOVER_FILL
  } else {
    ctx.fillStyle = ROOM_FILL
  }
  ctx.fillRect(x, y, width, height)

  // Border
  ctx.strokeStyle = isCurrent ? ROOM_CURRENT_STROKE : isHovered ? ROOM_HOVER_STROKE : ROOM_STROKE
  ctx.lineWidth = (isCurrent || isHovered ? 2 : 1) / zoom
  ctx.strokeRect(x, y, width, height)

  // Label
  const fontSize = Math.max(10, 12 / zoom)
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = LABEL_SHADOW
  ctx.fillText(name, x + width / 2 + 1, y + height / 2 + 1, width - 10)
  ctx.fillStyle = LABEL_COLOR
  ctx.fillText(name, x + width / 2, y + height / 2, width - 10)
}

/** Get the edge point closest to the target room center for a connection. */
function getConnectionEdgePoints(
  src: RoomRect,
  tgt: RoomRect,
): { srcEdge: { x: number; y: number }; tgtEdge: { x: number; y: number } } {
  const srcCx = src.x + src.width / 2
  const srcCy = src.y + src.height / 2
  const tgtCx = tgt.x + tgt.width / 2
  const tgtCy = tgt.y + tgt.height / 2

  return {
    srcEdge: rectEdgePoint(src, tgtCx, tgtCy),
    tgtEdge: rectEdgePoint(tgt, srcCx, srcCy),
  }
}

/** Find the point on the edge of a rect closest to the direction of (tx, ty). */
function rectEdgePoint(
  room: RoomRect,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const cx = room.x + room.width / 2
  const cy = room.y + room.height / 2
  const dx = tx - cx
  const dy = ty - cy

  if (dx === 0 && dy === 0) return { x: cx, y: room.y }

  const hw = room.width / 2
  const hh = room.height / 2

  // Scale factor to reach the edge
  const sx = Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity
  const sy = Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)

  return { x: cx + dx * s, y: cy + dy * s }
}

/** Compute a bezier control point for a curved connection. */
function getBezierControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  const offset = Math.min(dist * 0.25, 60)

  // Perpendicular offset for curve
  const nx = -dy / (dist || 1)
  const ny = dx / (dist || 1)

  return { x: mx + nx * offset, y: my + ny * offset }
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  connections: DoorConnection[],
  rooms: RoomRect[],
  hoveredConnectionId: string | null,
  zoom: number,
): void {
  const roomMap = new Map(rooms.map((r) => [r.id, r]))

  for (const conn of connections) {
    const src = roomMap.get(conn.sourceRoomId)
    const tgt = roomMap.get(conn.targetRoomId)
    if (!src || !tgt) continue

    const { srcEdge, tgtEdge } = getConnectionEdgePoints(src, tgt)
    const cp = getBezierControlPoint(srcEdge.x, srcEdge.y, tgtEdge.x, tgtEdge.y)
    const isHovered = conn.id === hoveredConnectionId
    const isAuto = conn.id.startsWith('auto:')

    // Bezier wire
    ctx.strokeStyle = isHovered ? WIRE_HOVER_COLOR : WIRE_COLOR
    ctx.lineWidth = (isHovered ? 3 : 2) / zoom
    ctx.setLineDash(isAuto ? [6 / zoom, 4 / zoom] : [])
    ctx.beginPath()
    ctx.moveTo(srcEdge.x, srcEdge.y)
    ctx.quadraticCurveTo(cp.x, cp.y, tgtEdge.x, tgtEdge.y)
    ctx.stroke()
    ctx.setLineDash([])

    // Door markers at endpoints
    drawDoorMarker(ctx, srcEdge.x, srcEdge.y, zoom)
    drawDoorMarker(ctx, tgtEdge.x, tgtEdge.y, zoom)

    // Arrowhead at target end
    drawArrowhead(ctx, cp.x, cp.y, tgtEdge.x, tgtEdge.y, isHovered, zoom)

    // Connection type label at midpoint
    const labelText = conn.connectionType || 'link'
    const labelX = 0.25 * srcEdge.x + 0.5 * cp.x + 0.25 * tgtEdge.x
    const labelY = 0.25 * srcEdge.y + 0.5 * cp.y + 0.25 * tgtEdge.y
    drawConnectionLabel(ctx, labelText, labelX, labelY, zoom)
  }
}

function drawDoorMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
): void {
  const r = 4 / zoom
  ctx.fillStyle = DOOR_MARKER_COLOR
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  isHovered: boolean,
  zoom: number,
): void {
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return

  const ux = dx / dist
  const uy = dy / dist
  const size = 8 / zoom
  const px = -uy
  const py = ux

  ctx.fillStyle = isHovered ? WIRE_HOVER_COLOR : WIRE_COLOR
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - ux * size + px * size * 0.4, toY - uy * size + py * size * 0.4)
  ctx.lineTo(toX - ux * size - px * size * 0.4, toY - uy * size - py * size * 0.4)
  ctx.closePath()
  ctx.fill()
}

function drawConnectionLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  zoom: number,
): void {
  const fontSize = Math.max(8, 9 / zoom)
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const metrics = ctx.measureText(text)
  const padX = 4 / zoom
  const padY = 2 / zoom

  ctx.fillStyle = CONN_LABEL_BG
  ctx.fillRect(
    x - metrics.width / 2 - padX,
    y - fontSize / 2 - padY,
    metrics.width + padX * 2,
    fontSize + padY * 2,
  )

  ctx.fillStyle = CONN_LABEL_COLOR
  ctx.fillText(text, x, y)
}

function drawConnectionPreview(
  ctx: CanvasRenderingContext2D,
  srcX: number,
  srcY: number,
  mouseX: number,
  mouseY: number,
  zoom: number,
): void {
  const cp = getBezierControlPoint(srcX, srcY, mouseX, mouseY)

  ctx.strokeStyle = WIRE_PREVIEW_COLOR
  ctx.lineWidth = 2 / zoom
  ctx.setLineDash([8 / zoom, 4 / zoom])
  ctx.beginPath()
  ctx.moveTo(srcX, srcY)
  ctx.quadraticCurveTo(cp.x, cp.y, mouseX, mouseY)
  ctx.stroke()
  ctx.setLineDash([])

  // Preview arrowhead
  drawArrowhead(ctx, cp.x, cp.y, mouseX, mouseY, false, zoom)
}
