import type { Camera } from '../camera'
import type { TileInstance, LayerInstance } from '../layer-instance'
import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'
import { hasTileFlipXFlag, hasTileFlipYFlag, stripTileFlipFlags } from '../../tileset'

type GridPoint = { x: number; y: number }

export class RectTool extends LayerTool {
    readonly id = 'rect'
    readonly name = 'Rectangle'

    private selectedTileIds: number[] = []
    private rectStart: GridPoint | null = null
    private rectEnd: GridPoint | null = null
    private isRectDragging = false
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
        this.isRectDragging = true
        this.rectStart = grid
        this.rectEnd = grid
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.isRectDragging || !this.rectStart) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return

        // Alt key toggles to outline-only mode
        this.filled = !e.altKey
        this.rectEnd = grid
    }

    onMouseUp(): void {
        if (this.isRectDragging && this.rectStart && this.rectEnd) {
            const points = this.getRectPoints(this.rectStart, this.rectEnd, this.filled)
            for (const [x, y] of points) {
                this.paintAt(x, y)
            }
        }
        this.isRectDragging = false
        this.rectStart = null
        this.rectEnd = null
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        if (!this.rectStart || !this.rectEnd) return
        const layer = this.layerInstance
        const tileId = this.selectedTileIds[0] ?? null
        if (!layer || tileId === null) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const offsetX = layer.__pxTotalOffsetX
        const offsetY = layer.__pxTotalOffsetY

        const points = this.getRectPoints(this.rectStart, this.rectEnd, this.filled)

        ctx.save()
        ctx.globalAlpha = 0.5

        for (const [gx, gy] of points) {
            const x = gx * gridSize + offsetX
            const y = gy * gridSize + offsetY
            ctx.fillStyle = this.getTilePreviewColor(tileId)
            ctx.fillRect(x, y, gridSize, gridSize)
        }

        // Draw outline border
        const left = Math.min(this.rectStart.x, this.rectEnd.x)
        const right = Math.max(this.rectStart.x, this.rectEnd.x)
        const top = Math.min(this.rectStart.y, this.rectEnd.y)
        const bottom = Math.max(this.rectStart.y, this.rectEnd.y)

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 2 / camera.zoom
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

    private getRectPoints(start: GridPoint, end: GridPoint, filled: boolean): [number, number][] {
        const left = Math.min(start.x, end.x)
        const right = Math.max(start.x, end.x)
        const top = Math.min(start.y, end.y)
        const bottom = Math.max(start.y, end.y)
        const points: [number, number][] = []

        if (filled) {
            for (let y = top; y <= bottom; y++) {
                for (let x = left; x <= right; x++) {
                    points.push([x, y])
                }
            }
        } else {
            // Outline only
            for (let x = left; x <= right; x++) {
                points.push([x, top])
                points.push([x, bottom])
            }
            for (let y = top + 1; y < bottom; y++) {
                points.push([left, y])
                points.push([right, y])
            }
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
        const rotation = this.context.tileRotation ?? 0
        const rotBits = ((rotation / 90) & 3) << 2
        const nextTile: TileInstance = {
            t: normalizedTileId,
            px: [pxX, pxY],
            src: resolvedSrc ? [resolvedSrc.x, resolvedSrc.y] : [0, 0],
            f: flipFlags | rotBits,
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
