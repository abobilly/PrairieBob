/**
 * Phase 6.2 — Startup modal layout and overflow verification
 *
 * Verifies that the ProjectSelector.tsx CSS classes produce a layout
 * where actions collapse to one column at narrow widths.
 *
 * Since we don't have @testing-library/react or jsdom, this is a
 * static analysis test that verifies the CSS class structure and
 * responsive breakpoints embedded in the component source.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const COMPONENT_PATH = resolve(__dirname, '../../components/ProjectSelector.tsx')
const source = readFileSync(COMPONENT_PATH, 'utf-8')

describe('ProjectSelector layout constraints', () => {
  it('dialog width is capped via min() to stay within viewport', () => {
    // The DialogContent must use w-[min(…)] to avoid horizontal overflow
    expect(source).toMatch(/w-\[min\(\d+vw/)
  })

  it('dialog has max-height and overflow-y-auto for small screens', () => {
    expect(source).toMatch(/max-h-\[\d+vh\]/)
    expect(source).toContain('overflow-y-auto')
  })

  it('action buttons grid collapses to 1 column on narrow widths', () => {
    // Should have grid-cols-1 (default) then sm:grid-cols-2
    expect(source).toContain('grid-cols-1')
    expect(source).toContain('sm:grid-cols-2')
  })

  it('buttons use min-w-0 to prevent flex overflow', () => {
    const minW0Count = (source.match(/min-w-0/g) ?? []).length
    // At least the action buttons + kimbar button should have min-w-0
    expect(minW0Count).toBeGreaterThanOrEqual(3)
  })

  it('blocks dismiss via onInteractOutside and onEscapeKeyDown', () => {
    expect(source).toContain('onInteractOutside')
    expect(source).toContain('onEscapeKeyDown')
    expect(source).toContain('e.preventDefault()')
  })

  it('long project paths are truncated', () => {
    expect(source).toContain('truncate')
  })

  it('recent projects section has bounded scroll height', () => {
    // ScrollArea should have a fixed height to prevent the modal from growing unbounded
    expect(source).toMatch(/h-\[\d+px\]/)
  })
})
