import { FlipHorizontal2, FlipVertical2, RotateCw, Shield, Sparkles, Users } from 'lucide-react'

interface ToolContextBarProps {
  activeToolId: string
  activeLayerName: string | null
  hasSelectedTile: boolean
  tileFlipX: boolean
  tileFlipY: boolean
  onToggleFlipX: () => void
  onToggleFlipY: () => void
}

function isCollisionContext(activeToolId: string, activeLayerName: string | null): boolean {
  if (activeToolId === 'intgrid') return true
  if (!activeLayerName) return false
  return /(collision|collider|solid|block)/i.test(activeLayerName)
}

function isTileContext(activeToolId: string): boolean {
  return activeToolId === 'tile' || activeToolId === 'line' || activeToolId === 'rect' || activeToolId === 'ellipse'
}

export function ToolContextBar({
  activeToolId,
  activeLayerName,
  hasSelectedTile,
  tileFlipX,
  tileFlipY,
  onToggleFlipX,
  onToggleFlipY,
}: ToolContextBarProps) {
  const tileContext = isTileContext(activeToolId)
  const collisionContext = isCollisionContext(activeToolId, activeLayerName)
  const entityContext = activeToolId === 'entity'

  return (
    <div className="pb-context-toolbar">
      {tileContext ? (
        <>
          <span className="pb-context-kicker">
            <Sparkles size={13} />
            Tile
          </span>
          <div className="pb-context-actions">
            <button
              className={`pb-tool-btn ${tileFlipX ? 'active' : ''}`}
              onClick={onToggleFlipX}
              title={`Flip Horizontal${tileFlipX ? ' (enabled)' : ''}`}
              disabled={!hasSelectedTile}
            >
              <FlipHorizontal2 size={15} />
            </button>
            <button
              className={`pb-tool-btn ${tileFlipY ? 'active' : ''}`}
              onClick={onToggleFlipY}
              title={`Flip Vertical${tileFlipY ? ' (enabled)' : ''}`}
              disabled={!hasSelectedTile}
            >
              <FlipVertical2 size={15} />
            </button>
            <button
              className="pb-tool-btn"
              title="Rotate 90° (Phase 2)"
              disabled
            >
              <RotateCw size={15} />
            </button>
          </div>
          <span className="pb-context-hint">Brush modes and stamp selection are in the left Tools panel.</span>
        </>
      ) : null}

      {entityContext ? (
        <>
          <span className="pb-context-kicker">
            <Users size={13} />
            Entity
          </span>
          <span className="pb-context-hint">Use Inspector to map states, animation clips, speed, zones, and interaction behavior.</span>
        </>
      ) : null}

      {collisionContext ? (
        <>
          <span className="pb-context-kicker">
            <Shield size={13} />
            Collision
          </span>
          <span className="pb-context-hint">Link/unlink art layers in Layers panel. Shift+click paints flood fill on collision cells.</span>
        </>
      ) : null}

      {!tileContext && !entityContext && !collisionContext ? (
        <span className="pb-context-hint">Active tool: {activeToolId}. Tool-specific actions appear here as features are enabled.</span>
      ) : null}
    </div>
  )
}
