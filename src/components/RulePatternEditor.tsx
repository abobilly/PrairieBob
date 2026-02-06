import type { AutoLayerRuleDef } from '@/lib/ldtk/types'
import { Check, X } from 'lucide-react'

interface RulePatternEditorProps {
  rule: AutoLayerRuleDef
  onChange: (pattern: number[]) => void
}

const GRID_SIZE = 3
const GRID_CELLS = GRID_SIZE * GRID_SIZE

const normalizePattern = (pattern: number[]): number[] => {
  const next = pattern.slice(0, GRID_CELLS)
  while (next.length < GRID_CELLS) {
    next.push(0)
  }
  return next
}

const getNextValue = (value: number): number => {
  if (value === 0) return 1
  if (value === 1) return -1
  return 0
}

const getStateLabel = (value: number): string => {
  if (value === 1) return 'Required'
  if (value === -1) return 'Forbidden'
  return 'Any'
}

export function RulePatternEditor({ rule, onChange }: RulePatternEditorProps) {
  const pattern = normalizePattern(rule.pattern)

  const handleCellClick = (index: number) => {
    const nextPattern = [...pattern]
    nextPattern[index] = getNextValue(nextPattern[index])
    onChange(nextPattern)
  }

  return (
    <div className="inline-grid grid-cols-3 gap-1">
      {pattern.map((value, index) => {
        const isRequired = value === 1
        const isForbidden = value === -1
        const label = getStateLabel(value)
        return (
          <button
            key={index}
            type="button"
            onClick={() => handleCellClick(index)}
            className={`flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--pb-border)] bg-[var(--pb-bg-input)] transition-colors hover:bg-[var(--pb-bg-hover)] ${
              isRequired
                ? 'text-[var(--pb-success)]'
                : isForbidden
                  ? 'text-[var(--pb-error)]'
                  : 'text-[var(--pb-text-muted)]'
            }`}
            title={label}
            aria-label={label}
          >
            {isRequired ? (
              <Check className="h-4 w-4" />
            ) : isForbidden ? (
              <X className="h-4 w-4" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--pb-text-muted)]" />
            )}
          </button>
        )
      })}
    </div>
  )
}
