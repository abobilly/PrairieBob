import type { Camera } from '../camera'
import type { TileInstance, LayerInstance } from '../layer-instance'
import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'
import { hasTileFlipXFlag, hasTileFlipYFlag, stripTileFlipFlags } from '../../tileset'

type GridPoint = { x: number; y: number }

export class LineTool extends LayerTool {
    readonly id = 'line'
    readonly name = 'Line'

    private selectedTileIds: number[] = []
    private lineStart: GridPoint | null = null
    private lineEnd: GridPoint | null = null
    private isLineDragging = false

    constructor(context: ToolContext) {
        super(context)
    }

    setSelectedTiles(tileIds: number[]): void {
        this.selectedTileIds = [...tileIds]
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
        this.isLineDragging = true
        this.lineStart = grid
        this.lineEnd = grid
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.isLineDragging || !this.lineStart) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return

        // Shift-snap to 45° increments
        if (e.shiftKey) {
            this.lineEnd = this.snapTo45(this.lineStart, grid)
        } else {
            this.lineEnd = grid
        }
    }

    onMouseUp(): void {
        if (this.isLineDragging && this.lineStart && this.lineEnd) {
            const points = this.bresenhamLine(
                this.lineStart.x, this.lineStart.y,
                this.lineEnd.x, this.lineEnd.y
            )
            for (const [x, y] of points) {
                this.paintAt(x, y)
            }
        }
        this.isLineDragging = false
        this.lineStart = null
        this.lineEnd = null
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        if (!this.lineStart || !this.lineEnd) return
        const layer = this.layerInstance
        const tileId = this.selectedTileIds[0] ?? null
        if (!layer || tileId === null) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const offsetX = layer.__pxTotalOffsetX
        const offsetY = layer.__pxTotalOffsetY

        const points = this.bresenhamLine(
            this.lineStart.x, this.lineStart.y,
            this.lineEnd.x, this.lineEnd.y
        )

        ctx.save()
        ctx.globalAlpha = 0.5

        for (const [gx, gy] of points) {
            const x = gx * gridSize + offsetX
            const y = gy * gridSize + offsetY
            ctx.fillStyle = this.getTilePreviewColor(tileId)
            ctx.fillRect(x, y, gridSize, gridSize)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.lineWidth = 2 / camera.zoom
            ctx.strokeRect(x, y, gridSize, gridSize)
        }

        ctx.restore()
    }

    getCursor(): string {
        return 'crosshair'
    }

    private snapTo45(start: GridPoint, end: GridPoint): GridPoint {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const angle = Math.atan2(dy, dx)
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        return {
            x: start.x + Math.round(Math.cos(snappedAngle) * dist),
            y: start.y + Math.round(Math.sin(snappedAngle) * dist),
        }
    }

    private bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
        const points: [number, number][] = []
        let dx = Math.abs(x1 - x0)
        let dy = Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx - dy
        let cx = x0
        let cy = y0
        while (true) {
            points.push([cx, cy])
            if (cx === x1 && cy === y1) break
            const e2 = 2 * err
            if (e2 > -dy) { err -= dy; cx += sx }
            if (e2 < dx) { err += dx; cy += sy }
        }
        return points
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
