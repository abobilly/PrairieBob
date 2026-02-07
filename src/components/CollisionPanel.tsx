import { useMemo } from 'react'
import { Eye, EyeOff, Shield } from 'lucide-react'
import type { CollisionStrategy } from '@/lib/collision-model'
import { isCollisionLayerName } from '@/lib/collision-model'
import type { Layer } from '@/lib/types'
import type { InspectorTab } from '@/components/InspectorSection'

const STRATEGY_OPTIONS: { value: CollisionStrategy; label: string; description: string }[] = [
  { value: 'auto_walls', label: 'Walls+Furniture', description: 'Auto-link wall/furniture/block layers' },
  { value: 'custom', label: 'Custom', description: 'Pick which layers feed collision' },
  { value: 'manual', label: 'Manual Only', description: 'No derived collision; paint by hand' },
]

interface CollisionPanelProps {
  layers: Layer[]
  strategy: CollisionStrategy
  linkedLayerNames: string[]
  showDerivedOverlay: boolean
  onSetStrategy: (strategy: CollisionStrategy) => void
  onSetSourceLayerEnabled: (layerName: string, enabled: boolean) => void
  onSetDerivedOverlayVisible: (visible: boolean) => void
  activeTab?: InspectorTab
}

export function CollisionPanel({
  layers,
  strategy,
  linkedLayerNames,
  showDerivedOverlay,
  onSetStrategy,
  onSetSourceLayerEnabled,
  onSetDerivedOverlayVisible,
  activeTab = 'quick',
}: CollisionPanelProps) {
  const linkedSet = useMemo(() => new Set(linkedLayerNames), [linkedLayerNames])
  const candidates = useMemo(
    () => layers.filter((l) => l.type === 'tilelayer' && !isCollisionLayerName(l.name)),
    [layers],
  )
  const collisionLayerName = useMemo(
    () => layers.find((l) => l.type === 'tilelayer' && isCollisionLayerName(l.name))?.name ?? 'Collision',
    [layers],
  )

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* ═══════════════ QUICK TAB ═══════════════ */}
      {activeTab === 'quick' && (
        <>
          {/* Status row */}
          <div className="flex items-center gap-2 text-[10px]">
            <Shield size={12} className="text-[var(--pb-text-secondary)] shrink-0" />
            <span className="text-[var(--pb-text-secondary)]">
              <span className="font-semibold text-[var(--pb-text-primary)]">{linkedLayerNames.length}</span> linked
            </span>
            <span className="text-[var(--pb-border)]">|</span>
            <span className="text-[var(--pb-text-secondary)]">
              Overlay {showDerivedOverlay ? 'on' : 'off'}
            </span>
            <span className="text-[var(--pb-border)]">|</span>
            <span className="text-[var(--pb-text-accent)] font-medium">
              {STRATEGY_OPTIONS.find((s) => s.value === strategy)?.label ?? strategy}
            </span>
          </div>

          {/* Strategy selector */}
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
              Strategy
            </div>
            <div className="flex gap-1">
              {STRATEGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex-1 rounded px-2 py-1.5 text-[10px] font-medium transition-colors border ${
                    strategy === opt.value
                      ? 'border-[var(--pb-accent)] bg-[var(--pb-accent-glow)] text-[var(--pb-accent)]'
                      : 'border-[var(--pb-border-subtle)] bg-[var(--pb-bg-panel)] text-[var(--pb-text-secondary)] hover:bg-[var(--pb-bg-hover)]'
                  }`}
                  onClick={() => onSetStrategy(opt.value)}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {strategy !== 'manual' && (
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 text-[10px] text-[var(--pb-text-secondary)] hover:bg-[var(--pb-bg-hover)]">
              <span className="flex items-center gap-1.5">
                {showDerivedOverlay ? <Eye size={12} /> : <EyeOff size={12} />}
                Show derived overlay on <span className="font-semibold text-[var(--pb-text-primary)]">{collisionLayerName}</span>
              </span>
              <input
                type="checkbox"
                checked={showDerivedOverlay}
                onChange={(e) => onSetDerivedOverlayVisible(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
            </label>
          )}
        </>
      )}

      {/* ═══════════════ ADVANCED TAB ═══════════════ */}
      {activeTab === 'advanced' && (
        <>
          {/* Source layer checklist — custom mode only */}
          {strategy === 'custom' && candidates.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
            Source Layers
          </div>
          <div className="flex flex-col gap-0.5">
            {candidates.map((layer) => {
              const linked = linkedSet.has(layer.name)
              return (
                <label
                  key={layer.name}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] hover:bg-[var(--pb-bg-hover)]"
                >
                  <span className={`truncate ${linked ? 'text-[var(--pb-text-primary)]' : 'text-[var(--pb-text-muted)]'}`}>
                    {layer.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={(e) => onSetSourceLayerEnabled(layer.name, e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Auto-walls shows which layers matched */}
      {strategy === 'auto_walls' && linkedLayerNames.length > 0 && (
        <div>
          <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
            Auto-Linked
          </div>
          <div className="flex flex-wrap gap-1">
            {linkedLayerNames.map((name) => (
              <span
                key={name}
                className="rounded border border-[var(--pb-accent-dim)] bg-[var(--pb-accent-glow)] px-1.5 py-0.5 text-[9px] text-[var(--pb-accent)]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {strategy === 'auto_walls' && linkedLayerNames.length === 0 && (
        <div className="text-[10px] text-[var(--pb-text-muted)] leading-tight">
          No layers match wall/furniture/block pattern. Rename a tile layer or switch to Custom.
        </div>
      )}

          {strategy === 'manual' && (
            <div className="text-[10px] text-[var(--pb-text-muted)] leading-tight">
              Paint collision directly on the <span className="font-semibold text-[var(--pb-text-secondary)]">{collisionLayerName}</span> layer.
              No derived blockers.
            </div>
          )}
        </>
      )}
    </div>
  )
}
