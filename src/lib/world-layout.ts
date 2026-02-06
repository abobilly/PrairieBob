/**
 * World Layout Persistence
 *
 * Manages spatial arrangement of rooms in the World View canvas.
 * Layout data persists as `world-layout.json` alongside the project config.
 *
 * Design:
 * - Each room has an (x, y) position in world-grid units.
 * - Door connections store source/target room + entity IDs.
 * - Missing file = empty layout (auto-position fallback in canvas).
 * - Save is best-effort; never blocks editor flow.
 */

// ============== Types ==============

/** A room's position on the world grid canvas. */
export interface RoomPosition {
  roomId: string
  /** World-grid X (pixels, not tiles). */
  x: number
  /** World-grid Y (pixels, not tiles). */
  y: number
}

/** A connection between two rooms via door/portal/stairs entities. */
export interface DoorConnection {
  id: string
  sourceRoomId: string
  sourceEntityId: string
  targetRoomId: string
  targetEntityId: string
  /** "door" | "portal" | "stairs" | "ladder" */
  connectionType: string
}

/** Top-level persisted world layout. */
export interface WorldLayout {
  version: 1
  rooms: RoomPosition[]
  connections: DoorConnection[]
}

// ============== Constants ==============

const LAYOUT_FILENAME = 'world-layout.json'

function layoutPath(projectPath: string): string {
  return `${projectPath}/${LAYOUT_FILENAME}`
}

// ============== Defaults ==============

export function createEmptyLayout(): WorldLayout {
  return { version: 1, rooms: [], connections: [] }
}

// ============== Load / Save ==============

/**
 * Load a world layout from `<projectPath>/world-layout.json`.
 * Returns a default empty layout if the file is missing or unparseable.
 */
export async function loadWorldLayout(projectPath: string): Promise<WorldLayout> {
  if (!window.electron?.fs) return createEmptyLayout()

  const filePath = layoutPath(projectPath)
  try {
    const exists = await window.electron.fs.exists(filePath)
    if (!exists) return createEmptyLayout()

    const content = await window.electron.fs.readFile(filePath)
    const parsed = JSON.parse(content) as Partial<WorldLayout>

    // Minimal validation
    return {
      version: 1,
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    }
  } catch (err) {
    console.warn('[world-layout] Failed to load layout, using default:', err)
    return createEmptyLayout()
  }
}

/**
 * Save a world layout to `<projectPath>/world-layout.json`.
 * Best-effort; logs warnings but never throws.
 */
export async function saveWorldLayout(
  projectPath: string,
  layout: WorldLayout,
): Promise<boolean> {
  if (!window.electron?.fs) return false

  const filePath = layoutPath(projectPath)
  try {
    const content = JSON.stringify(layout, null, 2) + '\n'
    await window.electron.fs.writeFile(filePath, content)
    return true
  } catch (err) {
    console.warn('[world-layout] Failed to save layout:', err)
    return false
  }
}

// ============== Helpers ==============

/** Get position for a room, or null if not in layout. */
export function getRoomPosition(
  layout: WorldLayout,
  roomId: string,
): RoomPosition | null {
  return layout.rooms.find((r) => r.roomId === roomId) ?? null
}

/** Set or update a room's position in the layout (mutates). */
export function setRoomPosition(
  layout: WorldLayout,
  roomId: string,
  x: number,
  y: number,
): void {
  const existing = layout.rooms.find((r) => r.roomId === roomId)
  if (existing) {
    existing.x = x
    existing.y = y
  } else {
    layout.rooms.push({ roomId, x, y })
  }
}

/** Add a door connection (mutates). Deduplicates by id. */
export function addConnection(
  layout: WorldLayout,
  connection: DoorConnection,
): void {
  const idx = layout.connections.findIndex((c) => c.id === connection.id)
  if (idx !== -1) {
    layout.connections[idx] = connection
  } else {
    layout.connections.push(connection)
  }
}

/** Remove a door connection by id (mutates). */
export function removeConnection(layout: WorldLayout, connectionId: string): void {
  layout.connections = layout.connections.filter((c) => c.id !== connectionId)
}

/** Get all connections involving a specific room. */
export function getConnectionsForRoom(
  layout: WorldLayout,
  roomId: string,
): DoorConnection[] {
  return layout.connections.filter(
    (c) => c.sourceRoomId === roomId || c.targetRoomId === roomId,
  )
}
