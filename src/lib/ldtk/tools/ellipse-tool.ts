import type { Camera } from '../camera'
import type { TileInstance, LayerInstance } from '../layer-instance'
import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'
import { hasTileFlipXFlag, hasTileFlipYFlag, stripTileFlipFlags } from '../../tileset'

type GridPoint = { x: number; y: number }

export class EllipseTool extends LayerTool {
    readonly id = 'ellipse'
    readonly name = 'Ellipse'

    private selectedTileIds: number[] = []
    private ellipseStart: GridPoint | null = null
    private ellipseEnd: GridPoint | null = null
    private isEllipseDragging = false
    private filled = true

    constructor(context: ToolContext) {
        super(context)
    }

    setSelectedTiles(tileIds: number[]): void {
        this.selectedTileIds = [...tileIds]
    }

    setFilled(filled: boolean): void {
        this.filled = filled
    }

    paintAt(gridX: number, gridY: number): void {
        const layer = this.layerInstance
        if (!layer) return
        const tileId = this.selectedTileIds[0] ?? null
        if (tileId === null) return
        this.setTileAt(layer, gridX, gridY, tileId)
    }

    onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return
        this.isEllipseDragging = true
        this.ellipseStart = grid
        this.ellipseEnd = grid
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.isEllipseDragging || !this.ellipseStart) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return

        this.filled = !e.altKey

        // Shift constrains to circle
        if (e.shiftKey) {
            const dx = grid.x - this.ellipseStart.x
            const dy = grid.y - this.ellipseStart.y
            const size = Math.max(Math.abs(dx), Math.abs(dy))
            this.ellipseEnd = {
                x: this.ellipseStart.x + size * Math.sign(dx || 1),
                y: this.ellipseStart.y + size * Math.sign(dy || 1),
            }
        } else {
            this.ellipseEnd = grid
        }
    }

    onMouseUp(): void {
        if (this.isEllipseDragging && this.ellipseStart && this.ellipseEnd) {
            const points = this.getEllipsePoints(this.ellipseStart, this.ellipseEnd, this.filled)
            for (const [x, y] of points) {
                this.paintAt(x, y)
            }
        }
        this.isEllipseDragging = false
        this.ellipseStart = null
        this.ellipseEnd = null
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        if (!this.ellipseStart || !this.ellipseEnd) return
        const layer = this.layerInstance
        const tileId = this.selectedTileIds[0] ?? null
        if (!layer || tileId === null) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const offsetX = layer.__pxTotalOffsetX
        const offsetY = layer.__pxTotalOffsetY

        const points = this.getEllipsePoints(this.ellipseStart, this.ellipseEnd, this.filled)

        ctx.save()
        ctx.globalAlpha = 0.5

        for (const [gx, gy] of points) {
            const x = gx * gridSize + offsetX
            const y = gy * gridSize + offsetY
            ctx.fillStyle = this.getTilePreviewColor(tileId)
            ctx.fillRect(x, y, gridSize, gridSize)
        }

        // Draw bounding box
        const left = Math.min(this.ellipseStart.x, this.ellipseEnd.x)
        const right = Math.max(this.ellipseStart.x, this.ellipseEnd.x)
        const top = Math.min(this.ellipseStart.y, this.ellipseEnd.y)
        const bottom = Math.max(this.ellipseStart.y, this.ellipseEnd.y)

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = 1 / camera.zoom
        ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom])
        ctx.strokeRect(
            left * gridSize + offsetX,
            top * gridSize + offsetY,
            (right - left + 1) * gridSize,
            (bottom - top + 1) * gridSize
        )

        ctx.restore()
    }

    getCursor(): string {
        return 'crosshair'
    }

    private getEllipsePoints(start: GridPoint, end: GridPoint, filled: boolean): [number, number][] {
        const left = Math.min(start.x, end.x)
        const right = Math.max(start.x, end.x)
        const top = Math.min(start.y, end.y)
        const bottom = Math.max(start.y, end.y)

        const cx = (left + right) / 2
        const cy = (top + bottom) / 2
        const rx = (right - left) / 2
        const ry = (bottom - top) / 2

        if (rx < 0.5 || ry < 0.5) {
            // Degenerate — just return bounding box edges
            const points: [number, number][] = []
            for (let x = left; x <= right; x++) {
                for (let y = top; y <= bottom; y++) {
                    points.push([x, y])
                }
            }
            return points
        }

        const boundary = this.midpointEllipse(cx, cy, rx, ry)

        if (filled) {
            return this.fillEllipse(boundary, top, bottom)
        }

        return boundary
    }

    private midpointEllipse(cx: number, cy: number, rx: number, ry: number): [number, number][] {
        const points = new Set<string>()
        const result: [number, number][] = []

        const addPoint = (x: number, y: number) => {
            const gx = Math.round(x)
            const gy = Math.round(y)
            const key = `${gx},${gy}`
            if (!points.has(key)) {
                points.add(key)
                result.push([gx, gy])
            }
        }

        const rx2 = rx * rx
        const ry2 = ry * ry

        // Region 1
        let x = 0
        let y = ry
        let d1 = ry2 - rx2 * ry + 0.25 * rx2
        let dx = 2 * ry2 * x
        let dy = 2 * rx2 * y

        while (dx < dy) {
            addPoint(cx + x, cy + y)
            addPoint(cx - x, cy + y)
            addPoint(cx + x, cy - y)
            addPoint(cx - x, cy - y)

            if (d1 < 0) {
                x++
                dx += 2 * ry2
                d1 += dx + ry2
            } else {
                x++
                y--
                dx += 2 * ry2
                dy -= 2 * rx2
                d1 += dx - dy + ry2
            }
        }

        // Region 2
        let d2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2

        while (y >= 0) {
            addPoint(cx + x, cy + y)
            addPoint(cx - x, cy + y)
            addPoint(cx + x, cy - y)
            addPoint(cx - x, cy - y)

            if (d2 > 0) {
                y--
                dy -= 2 * rx2
                d2 += rx2 - dy
            } else {
                y--
                x++
                dx += 2 * ry2
                dy -= 2 * rx2
                d2 += dx - dy + rx2
            }
        }

        return result
    }

    private fillEllipse(boundary: [number, number][], minY: number, maxY: number): [number, number][] {
        // Group boundary points by row to find min/max x per row
        const rowExtents = new Map<number, { minX: number; maxX: number }>()
        for (const [x, y] of boundary) {
            const ext = rowExtents.get(y)
            if (ext) {
                ext.minX = Math.min(ext.minX, x)
                ext.maxX = Math.max(ext.maxX, x)
            } else {
                rowExtents.set(y, { minX: x, maxX: x })
            }
        }

        const filled: [number, number][] = []
        for (const [y, ext] of rowExtents) {
            for (let x = ext.minX; x <= ext.maxX; x++) {
                filled.push([x, y])
            }
        }

        return filled
    }

    private setTileAt(layer: LayerInstance, gridX: number, gridY: number, tileId: number): void {
        if (gridX < 0 || gridY < 0 || gridX >= layer.__cWid || gridY >= layer.__cHei) return

        const normalizedTileId = stripTileFlipFlags(tileId)
        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const pxX = gridX * gridSize
        const pxY = gridY * gridSize
        const index = layer.gridTiles.findIndex(
            (tile) => tile.px[0] === pxX && tile.px[1] === pxY
        )

        if (normalizedTileId <= 0) {
            if (index !== -1) layer.gridTiles.splice(index, 1)
            return
        }

        const resolvedSrc = this.context.resolveTileSource?.(normalizedTileId)
        const flipFlags = (hasTileFlipXFlag(tileId) ? 1 : 0) | (hasTileFlipYFlag(tileId) ? 2 : 0)
        const nextTile: TileInstance = {
            t: normalizedTileId,
            px: [pxX, pxY],
            src: resolvedSrc ? [resolvedSrc.x, resolvedSrc.y] : [0, 0],
            f: flipFlags,
            a: 1,
        }

        if (index === -1) {
            layer.gridTiles.push(nextTile)
        } else {
            layer.gridTiles[index] = nextTile
        }
    }

    private getTilePreviewColor(tileId: number): string {
        const hue = Math.abs(tileId * 47) % 360
        return `hsl(${hue}, 65%, 55%)`
    }
}
