/**
 * StateGraph — compact SVG-based state machine visualization.
 *
 * Renders behavior graph nodes as circles/pills and edges as arrows.
 * Used inside BehaviorEditor for visual state graph preview.
 */

import { useMemo } from 'react'
import type { BehaviorGraph, BehaviorNode, BehaviorEdge } from '@/lib/behavior-graph'

// ─── Layout Constants ───────────────────────────────────────────────

const NODE_RADIUS = 22
const NODE_GAP = 72
const PADDING = 16
const FONT_SIZE = 9
const ARROW_SIZE = 6

// ─── Colors ─────────────────────────────────────────────────────────

function nodeColor(node: BehaviorNode): string {
  if (node.isDefault) return 'var(--pb-accent, #3b82f6)'
  if (node.collision) return 'var(--pb-warning, #f59e0b)'
  return 'var(--pb-text-muted, #6b7280)'
}

function nodeFill(node: BehaviorNode): string {
  if (node.isDefault) return 'var(--pb-accent-glow, rgba(59,130,246,0.15))'
  return 'var(--pb-bg-hover, rgba(255,255,255,0.05))'
}

// ─── Layout ─────────────────────────────────────────────────────────

interface LayoutNode {
  node: BehaviorNode
  cx: number
  cy: number
}

function layoutNodes(nodes: BehaviorNode[]): { layoutNodes: LayoutNode[]; width: number; height: number } {
  if (nodes.length === 0) return { layoutNodes: [], width: 60, height: 60 }

  // Simple horizontal layout, wrap after 4 per row
  const maxPerRow = Math.min(4, nodes.length)
  const rows = Math.ceil(nodes.length / maxPerRow)
  const rowHeight = NODE_RADIUS * 2 + 24
  const colWidth = NODE_RADIUS * 2 + NODE_GAP

  const laid: LayoutNode[] = nodes.map((node, i) => {
    const col = i % maxPerRow
    const row = Math.floor(i / maxPerRow)
    // Center each row
    const rowCount = Math.min(maxPerRow, nodes.length - row * maxPerRow)
    const rowWidth = rowCount * colWidth
    const offsetX = (maxPerRow * colWidth - rowWidth) / 2

    return {
      node,
      cx: PADDING + NODE_RADIUS + col * colWidth + offsetX,
      cy: PADDING + NODE_RADIUS + row * rowHeight,
    }
  })

  const width = PADDING * 2 + maxPerRow * colWidth
  const height = PADDING * 2 + rows * rowHeight
  return { layoutNodes: laid, width, height }
}

// ─── Arrow Path ─────────────────────────────────────────────────────

function arrowPath(
  x1: number, y1: number,
  x2: number, y2: number,
  _offset: number,
): { path: string; arrowX: number; arrowY: number; angle: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { path: '', arrowX: x2, arrowY: y2, angle: 0 }

  const nx = dx / dist
  const ny = dy / dist

  // Start/end at node edge
  const sx = x1 + nx * NODE_RADIUS
  const sy = y1 + ny * NODE_RADIUS
  const ex = x2 - nx * (NODE_RADIUS + ARROW_SIZE)
  const ey = y2 - ny * (NODE_RADIUS + ARROW_SIZE)

  // Curve offset for bidirectional edges
  const perpX = -ny * _offset
  const perpY = nx * _offset
  const mx = (sx + ex) / 2 + perpX
  const my = (sy + ey) / 2 + perpY

  const path = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`
  const angle = Math.atan2(ey - my, ex - mx) * (180 / Math.PI)

  return { path, arrowX: ex, arrowY: ey, angle }
}

// ─── Component ──────────────────────────────────────────────────────

interface StateGraphProps {
  graph: BehaviorGraph
  className?: string
}

export function StateGraph({ graph, className }: StateGraphProps) {
  const { layoutNodes: laid, width, height } = useMemo(
    () => layoutNodes(graph.nodes),
    [graph.nodes],
  )

  // Detect bidirectional edges to offset curves
  const edgePairs = useMemo(() => {
    const pairs = new Set<string>()
    for (const edge of graph.edges) {
      const reverse = graph.edges.find((e) => e.from === edge.to && e.to === edge.from)
      if (reverse) pairs.add(`${edge.from}|${edge.to}`)
    }
    return pairs
  }, [graph.edges])

  if (laid.length === 0) {
    return (
      <div className="flex items-center justify-center py-3 text-[10px] text-[var(--pb-text-muted)]">
        No states defined
      </div>
    )
  }

  const nodeMap = new Map(laid.map((l) => [l.node.id, l]))

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={Math.min(height, 180)}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id="arrow-marker"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--pb-text-muted, #6b7280)" />
        </marker>
      </defs>

      {/* Edges */}
      {graph.edges.map((edge) => {
        const from = nodeMap.get(edge.from)
        const to = nodeMap.get(edge.to)
        if (!from || !to) return null

        const isBidirectional = edgePairs.has(`${edge.from}|${edge.to}`)
        // Offset curve for bidirectional — first edge curves one way, second the other
        const firstDir = edge.from < edge.to ? 1 : -1
        const offset = isBidirectional ? 14 * firstDir : 0

        const { path } = arrowPath(from.cx, from.cy, to.cx, to.cy, offset)

        return (
          <g key={edge.id}>
            <path
              d={path}
              fill="none"
              stroke="var(--pb-text-muted, #6b7280)"
              strokeWidth={1.5}
              strokeDasharray={edge.trigger === 'timer' ? '4 2' : undefined}
              markerEnd="url(#arrow-marker)"
              opacity={0.6}
            />
            {/* Edge label */}
            {edge.label && (
              <text
                x={(from.cx + to.cx) / 2 + (isBidirectional ? -10 * firstDir : 0)}
                y={(from.cy + to.cy) / 2 + (offset / 2) - 4}
                textAnchor="middle"
                fill="var(--pb-text-muted, #6b7280)"
                fontSize={7}
                fontFamily="monospace"
              >
                {edge.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Nodes */}
      {laid.map(({ node, cx, cy }) => (
        <g key={node.id}>
          <circle
            cx={cx}
            cy={cy}
            r={NODE_RADIUS}
            fill={nodeFill(node)}
            stroke={nodeColor(node)}
            strokeWidth={node.isDefault ? 2.5 : 1.5}
          />
          {/* Default marker: double border */}
          {node.isDefault && (
            <circle
              cx={cx}
              cy={cy}
              r={NODE_RADIUS - 4}
              fill="none"
              stroke={nodeColor(node)}
              strokeWidth={1}
              opacity={0.4}
            />
          )}
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--pb-text-primary, #fff)"
            fontSize={FONT_SIZE}
            fontWeight={node.isDefault ? 600 : 400}
            fontFamily="Inter, sans-serif"
          >
            {node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label}
          </text>
          {/* Collision indicator */}
          {node.collision && (
            <text
              x={cx}
              y={cy + NODE_RADIUS + 10}
              textAnchor="middle"
              fill="var(--pb-warning, #f59e0b)"
              fontSize={7}
              fontFamily="monospace"
            >
              ■ solid
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
