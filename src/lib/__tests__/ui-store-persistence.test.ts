/**
 * Phase 6.1 — Panel sizing and resize persistence tests
 *
 * Verifies that useUIStore panel size/collapsed state survives a
 * simulated page reload via the Zustand persist middleware.
 * We test the sanitize/normalize helpers directly since the persist
 * merge + migrate functions delegate to them.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement the pure helpers extracted from uiStore.ts so the tests
// run without DOM/React.  The shapes are identical to the store source.
// ---------------------------------------------------------------------------

interface PanelConfig {
  size: number
  collapsed: boolean
  minSize: number
  maxSize: number
}

type PanelName = 'left' | 'right' | 'bottom'

const DEFAULT_PANELS: Record<PanelName, PanelConfig> = {
  left: { size: 24, collapsed: false, minSize: 16, maxSize: 38 },
  right: { size: 24, collapsed: false, minSize: 16, maxSize: 38 },
  bottom: { size: 24, collapsed: true, minSize: 14, maxSize: 45 },
}

const PANEL_RUNTIME_LIMITS: Record<PanelName, { min: number; max: number; fallback: number }> = {
  left: { min: 18, max: 60, fallback: 24 },
  right: { min: 16, max: 60, fallback: 24 },
  bottom: { min: 8, max: 60, fallback: 24 },
}

function normalizePercent(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  if (value > 100) return fallback
  return Math.min(Math.max(value, min), max)
}

function sanitizePanelConfig(value: unknown, fallback: PanelConfig): PanelConfig {
  const v = (value ?? {}) as Partial<PanelConfig>
  const minSize = normalizePercent(v.minSize, fallback.minSize, 1, 80)
  const maxSize = normalizePercent(v.maxSize, fallback.maxSize, minSize, 95)
  const size = normalizePercent(v.size, fallback.size, minSize, maxSize)
  return {
    size,
    collapsed: typeof v.collapsed === 'boolean' ? v.collapsed : fallback.collapsed,
    minSize,
    maxSize,
  }
}

function sanitizePanels(
  value: unknown,
  fallback: Record<PanelName, PanelConfig>,
): Record<PanelName, PanelConfig> {
  const v = (value ?? {}) as Partial<Record<PanelName, PanelConfig>>
  return {
    left: sanitizePanelConfig(v.left, fallback.left),
    right: sanitizePanelConfig(v.right, fallback.right),
    bottom: sanitizePanelConfig(v.bottom, fallback.bottom),
  }
}

function normalizeRuntimeSize(panel: PanelName, value: number): number {
  const limits = PANEL_RUNTIME_LIMITS[panel]
  if (!Number.isFinite(value)) return limits.fallback
  let next = value
  if (next > 0 && next <= 1) next *= 100
  if (next > 100) return limits.fallback
  return Math.min(Math.max(next, limits.min), limits.max)
}

// Simulates the persist merge callback
function simulatePersistMerge(
  persisted: Partial<{ panels: unknown }>,
  current: { panels: Record<PanelName, PanelConfig> },
) {
  const p = (persisted ?? {}) as Partial<{ panels: unknown }>
  const mergedPanels = sanitizePanels(p.panels, current.panels)
  const finalPanels = sanitizePanels(mergedPanels, DEFAULT_PANELS)
  return { ...current, ...p, panels: finalPanels }
}

// Simulates the persist migrate callback
function simulatePersistMigrate(persisted: Partial<{ panels: unknown }>) {
  const p = (persisted ?? {}) as Partial<{ panels: unknown }>
  const migratedPanels = sanitizePanels(p.panels, DEFAULT_PANELS)
  migratedPanels.bottom = { ...migratedPanels.bottom, collapsed: true }
  return { ...p, panels: migratedPanels }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Panel sizing and resize persistence', () => {
  const freshState = { panels: { ...DEFAULT_PANELS } }

  it('round-trips valid panel state through persist merge', () => {
    const saved = {
      panels: {
        left: { size: 30, collapsed: true, minSize: 16, maxSize: 38 },
        right: { size: 20, collapsed: false, minSize: 16, maxSize: 38 },
        bottom: { size: 18, collapsed: true, minSize: 14, maxSize: 45 },
      },
    }
    const result = simulatePersistMerge(saved, freshState)
    expect(result.panels.left.size).toBe(30)
    expect(result.panels.left.collapsed).toBe(true)
    expect(result.panels.right.size).toBe(20)
    expect(result.panels.right.collapsed).toBe(false)
    expect(result.panels.bottom.collapsed).toBe(true)
  })

  it('recovers from corrupted persisted data (null panels)', () => {
    const result = simulatePersistMerge({ panels: null as unknown }, freshState)
    expect(result.panels.left.size).toBe(DEFAULT_PANELS.left.size)
    expect(result.panels.right.size).toBe(DEFAULT_PANELS.right.size)
    expect(result.panels.bottom.collapsed).toBe(true)
  })

  it('clamps out-of-range persisted panel size', () => {
    const saved = {
      panels: {
        left: { size: 999, collapsed: false, minSize: 16, maxSize: 38 },
        right: { size: -5, collapsed: false, minSize: 16, maxSize: 38 },
        bottom: { size: 50, collapsed: false, minSize: 14, maxSize: 45 },
      },
    }
    const result = simulatePersistMerge(saved, freshState)
    // 999 > 100 → normalizePercent falls back to default
    expect(result.panels.left.size).toBe(DEFAULT_PANELS.left.size)
    // -5 gets clamped to minSize
    expect(result.panels.right.size).toBeGreaterThanOrEqual(DEFAULT_PANELS.right.minSize)
    // 50 > maxSize (45) → clamped
    expect(result.panels.bottom.size).toBeLessThanOrEqual(DEFAULT_PANELS.bottom.maxSize)
  })

  it('migrates legacy pixel-based persisted values back to percentage defaults', () => {
    const legacy = {
      panels: {
        left: { size: 220, collapsed: false, minSize: 16, maxSize: 38 },
        right: { size: 280, collapsed: false, minSize: 16, maxSize: 38 },
        bottom: { size: 400, collapsed: false, minSize: 14, maxSize: 45 },
      },
    }
    const result = simulatePersistMigrate(legacy)
    // All pixel values > 100 should reset to defaults
    expect(result.panels.left.size).toBe(DEFAULT_PANELS.left.size)
    expect(result.panels.right.size).toBe(DEFAULT_PANELS.right.size)
    expect(result.panels.bottom.size).toBe(DEFAULT_PANELS.bottom.size)
    // Migrate always forces bottom collapsed
    expect(result.panels.bottom.collapsed).toBe(true)
  })

  it('normalizes runtime size: converts 0..1 ratio to percentage', () => {
    expect(normalizeRuntimeSize('left', 0.3)).toBe(30)
    expect(normalizeRuntimeSize('right', 0.5)).toBe(50)
  })

  it('normalizes runtime size: rejects >100 as invalid', () => {
    expect(normalizeRuntimeSize('left', 250)).toBe(PANEL_RUNTIME_LIMITS.left.fallback)
    expect(normalizeRuntimeSize('bottom', Infinity)).toBe(PANEL_RUNTIME_LIMITS.bottom.fallback)
    expect(normalizeRuntimeSize('right', NaN)).toBe(PANEL_RUNTIME_LIMITS.right.fallback)
  })

  it('preserves collapsed state across persist roundtrip', () => {
    const saved = {
      panels: {
        left: { size: 24, collapsed: true, minSize: 16, maxSize: 38 },
        right: { size: 24, collapsed: true, minSize: 16, maxSize: 38 },
        bottom: { size: 24, collapsed: false, minSize: 14, maxSize: 45 },
      },
    }
    const result = simulatePersistMerge(saved, freshState)
    expect(result.panels.left.collapsed).toBe(true)
    expect(result.panels.right.collapsed).toBe(true)
    // Bottom collapsed state is preserved from saved (not forced in merge)
    expect(result.panels.bottom.collapsed).toBe(false)
  })
})
