import { useCallback, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEditorStore, useProjectStore } from '@/stores'

type SearchResultType = 'level' | 'layer' | 'entity'

interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  breadcrumb: string[]
  meta?: string
  onSelect: () => void
  score: number
}

interface MatchResult {
  positions: number[]
  score: number
}

const EMPTY_RESULTS: SearchResult[] = []

function fuzzyMatch(query: string, text: string): MatchResult | null {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return null

  const target = text.toLowerCase()
  const substringIndex = target.indexOf(trimmed)
  if (substringIndex !== -1) {
    const positions = Array.from({ length: trimmed.length }, (_, i) => substringIndex + i)
    return { positions, score: substringIndex }
  }

  const positions: number[] = []
  let lastIndex = 0
  let gapScore = 0

  for (const char of trimmed) {
    const foundIndex = target.indexOf(char, lastIndex)
    if (foundIndex === -1) return null
    positions.push(foundIndex)
    gapScore += foundIndex - lastIndex
    lastIndex = foundIndex + 1
  }

  return { positions, score: gapScore + (positions[0] ?? 0) }
}

function renderHighlighted(text: string, query: string) {
  const match = fuzzyMatch(query, text)
  if (!match || match.positions.length === 0) return text

  const matchSet = new Set(match.positions)
  const segments: Array<{ text: string; isMatch: boolean }> = []
  let current = ''
  let isMatch = matchSet.has(0)

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const charMatch = matchSet.has(i)
    if (charMatch === isMatch) {
      current += char
    } else {
      segments.push({ text: current, isMatch })
      current = char
      isMatch = charMatch
    }
  }

  if (current) {
    segments.push({ text: current, isMatch })
  }

  return segments.map((segment, index) => (
    <span
      key={`${segment.text}-${index}`}
      className={segment.isMatch ? 'text-[var(--pb-text-accent)] font-semibold' : undefined}
    >
      {segment.text}
    </span>
  ))
}

function useSearchResults(query: string) {
  const mapData = useProjectStore((s) => s.mapData)
  const projectName = useProjectStore((s) => s.projectName)
  const loadMap = useProjectStore((s) => s.loadMap)
  const setActiveLayerIndex = useEditorStore((s) => s.setActiveLayerIndex)
  const setSelectedEntityId = useEditorStore((s) => s.setSelectedEntityId)

  return useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return EMPTY_RESULTS

    const results: SearchResult[] = []
    const projectLabel = projectName || 'Untitled Project'
    const levelId = mapData?.id || 'Untitled Level'

    const levelMatch = fuzzyMatch(trimmed, `${projectLabel} ${levelId}`)
    if (levelMatch) {
      results.push({
        id: `level:${levelId}`,
        type: 'level',
        label: levelId,
        breadcrumb: [projectLabel],
        score: levelMatch.score,
        onSelect: () => {
          if (mapData?.id && mapData.id !== levelId) {
            loadMap(levelId)
          }
          setActiveLayerIndex(0)
          setSelectedEntityId(null)
        },
      })
    }

    mapData?.layers?.forEach((layer, layerIndex) => {
      const layerMatch = fuzzyMatch(trimmed, `${projectLabel} ${levelId} ${layer.name}`)
      if (layerMatch) {
        results.push({
          id: `layer:${levelId}:${layerIndex}`,
          type: 'layer',
          label: layer.name,
          breadcrumb: [projectLabel, levelId],
          score: layerMatch.score,
          onSelect: () => {
            setActiveLayerIndex(layerIndex)
            setSelectedEntityId(null)
          },
        })
      }

      if (layer.type === 'objectgroup' && layer.objects?.length) {
        layer.objects.forEach((entity) => {
          const entityLabel = entity.id || entity.type
          const entityMatch = fuzzyMatch(
            trimmed,
            `${projectLabel} ${levelId} ${layer.name} ${entityLabel} ${entity.type}`
          )
          if (!entityMatch) return

          results.push({
            id: `entity:${levelId}:${layerIndex}:${entity.id}`,
            type: 'entity',
            label: entityLabel,
            breadcrumb: [projectLabel, levelId, layer.name],
            meta: entity.type,
            score: entityMatch.score,
            onSelect: () => {
              setActiveLayerIndex(layerIndex)
              setSelectedEntityId(entity.id)
            },
          })
        })
      }
    })

    return results.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      if (a.type !== b.type) {
        const typeRank: Record<SearchResultType, number> = { level: 0, layer: 1, entity: 2 }
        return typeRank[a.type] - typeRank[b.type]
      }
      return a.label.localeCompare(b.label)
    })
  }, [query, mapData, projectName, loadMap, setActiveLayerIndex, setSelectedEntityId])
}

export function QuickSearch() {
  const [query, setQuery] = useState('')
  const results = useSearchResults(query)
  const trimmed = query.trim()

  const handleClear = useCallback(() => {
    setQuery('')
  }, [])

  const handleSelect = useCallback((result: SearchResult) => {
    result.onSelect()
    setQuery('')
  }, [])

  return (
    <div className="pb-compact-panel h-full flex flex-col">
      <div className="pb-compact-header">
        <span className="pb-compact-title">Quick Search</span>
        {query && (
          <button className="pb-icon-btn-xs" onClick={handleClear} title="Clear search">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2 p-2 h-full">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-[var(--pb-text-muted)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                handleClear()
              }
            }}
            placeholder="Search levels, layers, entities..."
            className="h-7 text-xs px-2"
          />
        </div>
        <ScrollArea className="flex-1 pr-2">
          {!trimmed && (
            <p className="text-[10px] text-[var(--pb-text-muted)]">
              Type to search levels, layers, entities.
            </p>
          )}
          {trimmed && results.length === 0 && (
            <p className="text-[10px] text-[var(--pb-text-muted)]">No matches found.</p>
          )}
          {trimmed && results.length > 0 && (
            <div className="flex flex-col gap-1">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--pb-bg-hover)]"
                  onClick={() => handleSelect(result)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="font-medium text-[var(--pb-text-primary)]">
                        {renderHighlighted(result.label, query)}
                      </span>
                      {result.meta && (
                        <span className="text-[10px] text-[var(--pb-text-muted)]">
                          ({renderHighlighted(result.meta, query)})
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] uppercase tracking-wide text-[var(--pb-text-muted)]">
                      {result.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--pb-text-muted)]">
                    {result.breadcrumb.map((segment, index) => (
                      <span key={`${segment}-${index}`}>
                        {index > 0 && <span className="mx-1">/</span>}
                        {renderHighlighted(segment, query)}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
