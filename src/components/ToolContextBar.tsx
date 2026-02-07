import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Gauge,
  Grid3x3,
  Link,
  MapPin,
  MousePointerClick,
  PaintBucket,
  Paintbrush,
  Pause,
  Play,
  RotateCw,
  Shield,
  Sparkles,
  Unlink,
  Users,
  Zap,
} from 'lucide-react'
import type { EntityData, Layer, TileActionGroup } from '@/lib/types'
import type { CollisionStrategy } from '@/lib/collision-model'
import { isCollisionLayerName } from '@/lib/collision-model'

interface ToolContextBarProps {
  activeToolId: string
  activeLayerName: string | null
  hasSelectedTile: boolean
  tileFlipX: boolean
  tileFlipY: boolean
  tileRotation: 0 | 90 | 180 | 270
  collisionPaintMode: 'paint' | 'erase' | 'fill'
  // Feature 1: Palette Snap
  paletteSnap: boolean
  onTogglePaletteSnap: () => void
  // Feature 2: Tile Action Quick-Pick
  tileActionGroups: TileActionGroup[]
  onAssignTileAction: (groupId: string) => void
  // Feature 3: Animation Preview
  entityAnimPreview: boolean
  onToggleEntityAnimPreview: () => void
  // Feature 4 & 5: Entity state/direction/speed/zone
  selectedEntity: EntityData | null
  onEntityUpdate: (id: string, updates: Partial<EntityData>) => void
  // Feature 6: Collision source layer linking
  layers: Layer[]
  collisionLinkedLayers: string[]
  collisionStrategy: CollisionStrategy
  onSetSourceLayerEnabled: (layerName: string, enabled: boolean) => void
  // Existing
  onToggleFlipX: () => void
  onToggleFlipY: () => void
  onRotateCW: () => void
  onSetCollisionPaintMode: (mode: 'paint' | 'erase' | 'fill') => void
}

/** State preset definitions for door/switch/lock entities */
const STATE_PRESETS: Record<string, { values: string[]; labels: string[] }> = {
  door: { values: ['closed', 'open'], labels: ['Closed', 'Open'] },
  lock: { values: ['locked', 'unlocked'], labels: ['Locked', 'Unlocked'] },
  switch: { values: ['inactive', 'active'], labels: ['Inactive', 'Active'] },
}

const DIRECTION_TYPES = new Set<string>(['npc', 'spawn_point'])
const STATEFUL_TYPES = new Set<string>(['door', 'lock', 'switch'])
const ZONE_OPTIONS = ['yard', 'path', 'indoor', 'roam'] as const

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
  tileRotation,
  collisionPaintMode,
  paletteSnap,
  onTogglePaletteSnap,
  tileActionGroups,
  onAssignTileAction,
  entityAnimPreview,
  onToggleEntityAnimPreview,
  selectedEntity,
  onEntityUpdate,
  layers,
  collisionLinkedLayers,
  collisionStrategy,
  onSetSourceLayerEnabled,
  onToggleFlipX,
  onToggleFlipY,
  onRotateCW,
  onSetCollisionPaintMode,
}: ToolContextBarProps) {
  const tileContext = isTileContext(activeToolId)
  const collisionContext = isCollisionContext(activeToolId, activeLayerName)
  const entityContext = activeToolId === 'entity'

  // Feature 6: non-collision tile layers for linking chips
  const linkableLayers = collisionContext
    ? layers.filter((l) => l.type === 'tilelayer' && !isCollisionLayerName(l.name))
    : []
  const linkedSet = new Set(collisionLinkedLayers)

  return (
    <div className="pb-context-toolbar">
      {/* ─── TILE CONTEXT ──────────────────────────────────── */}
      {tileContext ? (
        <>
          <span className="pb-context-kicker">
            <Sparkles size={13} />
            Tile
          </span>
          <div className="pb-context-actions">
            {/* Flip / Rotate */}
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
              className={`pb-tool-btn ${tileRotation !== 0 ? 'active' : ''}`}
              title={`Rotate 90° CW (current: ${tileRotation}°)`}
              disabled={!hasSelectedTile}
              onClick={onRotateCW}
            >
              <RotateCw size={15} />
            </button>

            <span className="w-px h-4 bg-[var(--pb-border)]" />

            {/* Feature 1: Palette Snap */}
            <button
              className={`pb-tool-btn ${paletteSnap ? 'active' : ''}`}
              onClick={onTogglePaletteSnap}
              title={`Palette grid snap ${paletteSnap ? '(on)' : '(off)'}`}
            >
              <Grid3x3 size={15} />
            </button>

            {/* Feature 2: Tile Action Quick-Pick */}
            {tileActionGroups.length > 0 ? (
              <div className="relative inline-flex">
                <select
                  className="pb-tool-btn appearance-none bg-transparent text-[10px] pl-6 pr-1 cursor-pointer min-w-[24px]"
                  title="Assign tile action group"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onAssignTileAction(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  disabled={!hasSelectedTile}
                >
                  <option value="" disabled>
                    Action…
                  </option>
                  {tileActionGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <Zap size={13} className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--pb-text-secondary)]" />
              </div>
            ) : (
              <button
                className="pb-tool-btn"
                disabled
                title="No tile action groups defined"
              >
                <Zap size={15} />
              </button>
            )}
          </div>
          <span className="pb-context-hint">Brush modes and stamp selection are in the left Tools panel.</span>
        </>
      ) : null}

      {/* ─── ENTITY CONTEXT ────────────────────────────────── */}
      {entityContext ? (
        <>
          <span className="pb-context-kicker">
            <Users size={13} />
            Entity
          </span>
          <div className="pb-context-actions">
            {/* Feature 3: Animation Preview Toggle */}
            <button
              className={`pb-tool-btn ${entityAnimPreview ? 'active' : ''}`}
              onClick={onToggleEntityAnimPreview}
              title={entityAnimPreview ? 'Pause animation preview' : 'Play animation preview'}
            >
              {entityAnimPreview ? <Pause size={15} /> : <Play size={15} />}
            </button>

            {selectedEntity ? (
              <>
                <span className="w-px h-4 bg-[var(--pb-border)]" />

                {/* Feature 4: Direction buttons for NPC / spawn_point */}
                {DIRECTION_TYPES.has(selectedEntity.type) ? (
                  <>
                    {(['N', 'E', 'S', 'W'] as const).map((dir) => {
                      const icons = { N: ArrowUp, E: ArrowRight, S: ArrowDown, W: ArrowLeft }
                      const Icon = icons[dir]
                      const isActive = selectedEntity.properties?.direction === dir
                      return (
                        <button
                          key={dir}
                          className={`pb-tool-btn ${isActive ? 'active' : ''}`}
                          title={`Set direction: ${dir}`}
                          onClick={() =>
                            onEntityUpdate(selectedEntity.id, {
                              properties: { ...selectedEntity.properties, direction: dir },
                            })
                          }
                        >
                          <Icon size={15} />
                        </button>
                      )
                    })}
                    <button
                      className="pb-tool-btn"
                      title="Trigger interact"
                      onClick={() =>
                        onEntityUpdate(selectedEntity.id, {
                          properties: { ...selectedEntity.properties, state: 'interact' },
                        })
                      }
                    >
                      <MousePointerClick size={15} />
                    </button>
                  </>
                ) : null}

                {/* Feature 4b: State preset toggles for door/switch/lock */}
                {STATEFUL_TYPES.has(selectedEntity.type) && STATE_PRESETS[selectedEntity.type] ? (
                  <>
                    {STATE_PRESETS[selectedEntity.type].values.map((val, idx) => {
                      const label = STATE_PRESETS[selectedEntity.type].labels[idx]
                      const currentState = (selectedEntity.properties?.state as string) ?? ''
                      const isActive = currentState === val
                      return (
                        <button
                          key={val}
                          className={`pb-tool-btn ${isActive ? 'active' : ''}`}
                          title={`Set state: ${label}`}
                          onClick={() =>
                            onEntityUpdate(selectedEntity.id, {
                              properties: { ...selectedEntity.properties, state: val },
                            })
                          }
                        >
                          <span className="text-[10px] font-medium leading-none">{label}</span>
                        </button>
                      )
                    })}
                  </>
                ) : null}

                {/* Feature 5: Speed + Zone for NPC */}
                {selectedEntity.type === 'npc' ? (
                  <>
                    <span className="w-px h-4 bg-[var(--pb-border)]" />

                    {/* Speed slider */}
                    <span className="inline-flex items-center gap-1" title="Movement speed (tiles/sec)">
                      <Gauge size={13} className="text-[var(--pb-text-secondary)]" />
                      <input
                        type="range"
                        min={0.5}
                        max={5}
                        step={0.1}
                        value={Number(selectedEntity.properties?.speed ?? 1.8)}
                        onChange={(e) =>
                          onEntityUpdate(selectedEntity.id, {
                            properties: { ...selectedEntity.properties, speed: parseFloat(e.target.value) },
                          })
                        }
                        className="w-14 h-3 accent-[var(--pb-accent)]"
                      />
                      <span className="text-[10px] text-[var(--pb-text-secondary)] w-6 text-right tabular-nums">
                        {Number(selectedEntity.properties?.speed ?? 1.8).toFixed(1)}
                      </span>
                    </span>

                    {/* Zone selector */}
                    <span className="inline-flex items-center gap-1" title="Wander zone">
                      <MapPin size={13} className="text-[var(--pb-text-secondary)]" />
                      <select
                        className="bg-transparent text-[10px] border border-[var(--pb-border-subtle)] rounded px-1 py-0.5 text-[var(--pb-text)] cursor-pointer"
                        value={(selectedEntity.properties?.zone as string) ?? 'yard'}
                        onChange={(e) =>
                          onEntityUpdate(selectedEntity.id, {
                            properties: { ...selectedEntity.properties, zone: e.target.value },
                          })
                        }
                      >
                        {ZONE_OPTIONS.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </div>

          {!selectedEntity ? (
            <span className="pb-context-hint">Select an entity to edit its direction, state, or properties.</span>
          ) : null}
        </>
      ) : null}

      {/* ─── COLLISION CONTEXT ─────────────────────────────── */}
      {collisionContext ? (
        <>
          <span className="pb-context-kicker">
            <Shield size={13} />
            Collision
          </span>
          <div className="pb-context-actions">
            <button
              className={`pb-tool-btn ${collisionPaintMode === 'paint' ? 'active' : ''}`}
              onClick={() => onSetCollisionPaintMode('paint')}
              title="Paint — click to place collision cells"
            >
              <Paintbrush size={15} />
            </button>
            <button
              className={`pb-tool-btn ${collisionPaintMode === 'erase' ? 'active' : ''}`}
              onClick={() => onSetCollisionPaintMode('erase')}
              title="Erase — click to remove collision cells"
            >
              <Eraser size={15} />
            </button>
            <button
              className={`pb-tool-btn ${collisionPaintMode === 'fill' ? 'active' : ''}`}
              onClick={() => onSetCollisionPaintMode('fill')}
              title="Fill — click to flood-fill collision area"
            >
              <PaintBucket size={15} />
            </button>

            {/* Feature 6: Source layer linking chips (custom strategy only) */}
            {collisionStrategy === 'custom' && linkableLayers.length > 0 ? (
              <>
                <span className="w-px h-4 bg-[var(--pb-border)]" />
                <span className="inline-flex items-center gap-0.5 text-[var(--pb-text-secondary)]" title="Source layer links">
                  {linkedSet.size > 0 ? <Link size={12} /> : <Unlink size={12} />}
                </span>
                {linkableLayers.map((layer) => {
                  const isLinked = linkedSet.has(layer.name)
                  return (
                    <button
                      key={layer.name}
                      className={`rounded border px-1.5 py-0.5 text-[9px] cursor-pointer transition-colors ${
                        isLinked
                          ? 'border-[var(--pb-accent)] bg-[var(--pb-accent-glow)] text-[var(--pb-accent)]'
                          : 'border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] text-[var(--pb-text-secondary)]'
                      }`}
                      onClick={() => onSetSourceLayerEnabled(layer.name, !isLinked)}
                      title={`${isLinked ? 'Unlink' : 'Link'} layer: ${layer.name}`}
                    >
                      {layer.name}
                    </button>
                  )
                })}
              </>
            ) : null}
          </div>
          <span className="pb-context-hint">
            {collisionPaintMode === 'paint' ? 'Click to paint collision cells. Shift+click to flood fill.' : null}
            {collisionPaintMode === 'erase' ? 'Click to erase collision cells.' : null}
            {collisionPaintMode === 'fill' ? 'Click to flood-fill a contiguous region.' : null}
          </span>
        </>
      ) : null}

      {!tileContext && !entityContext && !collisionContext ? (
        <span className="pb-context-hint">Active tool: {activeToolId}. Tool-specific actions appear here as features are enabled.</span>
      ) : null}
    </div>
  )
}
