/**
 * WorldViewContextMenu
 *
 * Right-click context menu for the World View canvas.
 * Shows options for rooms (open, reset position), connections (delete), or empty space.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { DoorConnection } from '@/lib/world-layout'

export interface WorldViewContextMenuProps {
  x: number
  y: number
  roomId: string | null
  connectionId: string | null
  connections: DoorConnection[]
  onClose: () => void
  onOpenRoom: (roomId: string) => void
  onResetPosition: (roomId: string) => void
  onDeleteConnection: (connectionId: string) => void
}

export function WorldViewContextMenu({
  x,
  y,
  roomId,
  connectionId,
  connections,
  onClose,
  onOpenRoom,
  onResetPosition,
  onDeleteConnection,
}: WorldViewContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const handleOpen = useCallback(() => {
    if (roomId) {
      onOpenRoom(roomId)
      onClose()
    }
  }, [roomId, onOpenRoom, onClose])

  const handleReset = useCallback(() => {
    if (roomId) {
      onResetPosition(roomId)
      onClose()
    }
  }, [roomId, onResetPosition, onClose])

  const handleDeleteConnection = useCallback(() => {
    if (connectionId) {
      onDeleteConnection(connectionId)
      onClose()
    }
  }, [connectionId, onDeleteConnection, onClose])

  const handleDeleteAllRoomConnections = useCallback(() => {
    if (!roomId) return
    const roomConns = connections.filter(
      (c) => c.sourceRoomId === roomId || c.targetRoomId === roomId,
    )
    for (const c of roomConns) {
      onDeleteConnection(c.id)
    }
    onClose()
  }, [roomId, connections, onDeleteConnection, onClose])

  // Find connection info for label
  const connInfo = connectionId ? connections.find((c) => c.id === connectionId) : null
  const roomConnCount = roomId
    ? connections.filter((c) => c.sourceRoomId === roomId || c.targetRoomId === roomId).length
    : 0

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-md border border-[var(--pb-border)] bg-[var(--pb-bg-panel)] py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {connectionId && connInfo ? (
        <>
          <div className="px-3 py-1.5 text-[10px] text-[var(--pb-text-muted)] uppercase tracking-wide">
            {connInfo.connectionType}: {connInfo.sourceRoomId} → {connInfo.targetRoomId}
          </div>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-[var(--pb-bg-hover)] transition-colors"
            onClick={handleDeleteConnection}
          >
            Delete Connection
          </button>
        </>
      ) : roomId ? (
        <>
          <div className="px-3 py-1.5 text-[10px] text-[var(--pb-text-muted)] uppercase tracking-wide">
            {roomId}
          </div>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-xs text-[var(--pb-text-primary)] hover:bg-[var(--pb-bg-hover)] transition-colors"
            onClick={handleOpen}
          >
            Open Room
          </button>
          <button
            type="button"
            className="w-full px-3 py-1.5 text-left text-xs text-[var(--pb-text-primary)] hover:bg-[var(--pb-bg-hover)] transition-colors"
            onClick={handleReset}
          >
            Reset Position
          </button>
          {roomConnCount > 0 && (
            <>
              <div className="mx-2 my-1 border-t border-[var(--pb-border)]" />
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-[var(--pb-bg-hover)] transition-colors"
                onClick={handleDeleteAllRoomConnections}
              >
                Delete All Connections ({roomConnCount})
              </button>
            </>
          )}
        </>
      ) : (
        <div className="px-3 py-1.5 text-xs text-[var(--pb-text-muted)]">
          No room selected
        </div>
      )}
    </div>
  )
}
