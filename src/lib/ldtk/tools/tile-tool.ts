import type { Camera } from '../camera'
import type { TileInstance, LayerInstance } from '../layer-instance'
import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'

type GridPoint = { x: number; y: number }

export class TileTool extends LayerTool {
    readonly id = 'tile'
    readonly name = 'Tile'

    private selectedTileIds: number[] = []
    private stampMode: 'single' | 'rectangle' | 'random' = 'single'
    private previewGrid: GridPoint | null = null
    private rectangleStart: GridPoint | null = null
    private rectangleEnd: GridPoint | null = null

    constructor(context: ToolContext) {
        super(context)
    }

    setSelectedTiles(tileIds: number[]): void {
        this.selectedTileIds = [...tileIds]
    }

    setStampMode(mode: 'single' | 'rectangle' | 'random'): void {
        this.stampMode = mode
    }

    paintAt(gridX: number, gridY: number): void {
        const layer = this.layerInstance
        if (!layer) return
        const tileId = this.getPaintTileId()
        if (tileId === null) return
        this.setTileAt(layer, gridX, gridY, tileId)
    }

    onMouseDown(e: MouseEvent, worldPos?: { x: number; y: number }): void {
        if (e.button !== 0) return
        const world = worldPos ?? this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        this.previewGrid = grid
        if (!grid) return

        if (this.stampMode === 'rectangle') {
            this.rectangleStart = grid
            this.rectangleEnd = grid
            return
        }

        super.onMouseDown(e)
    }

    onMouseMove(e: MouseEvent, worldPos?: { x: number; y: number }): void {
        const world = worldPos ?? this.context.screenToWorld?.(e.clientX, e.clientY)
        this.previewGrid = world ? this.worldToGrid(world.x, world.y) : null

        if (this.stampMode === 'rectangle') {
            if (this.rectangleStart && this.previewGrid) {
                this.rectangleEnd = this.previewGrid
            } else if (!this.previewGrid) {
                this.rectangleEnd = null
            }
            return
        }

        super.onMouseMove(e)
    }

    onMouseUp(): void {
        if (this.stampMode === 'rectangle' && this.rectangleStart && this.rectangleEnd) {
            this.paintRectangle(this.rectangleStart, this.rectangleEnd)
        }

        this.rectangleStart = null
        this.rectangleEnd = null
        super.onMouseUp()
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        const layer = this.layerInstance
        const tileId = this.getPreviewTileId()
        if (!layer || tileId === null) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const offsetX = layer.__pxTotalOffsetX
        const offsetY = layer.__pxTotalOffsetY

        ctx.save()
        ctx.globalAlpha = 0.6

        if (this.stampMode === 'rectangle' && this.rectangleStart && this.rectangleEnd) {
            const left = Math.min(this.rectangleStart.x, this.rectangleEnd.x)
            const right = Math.max(this.rectangleStart.x, this.rectangleEnd.x)
            const top = Math.min(this.rectangleStart.y, this.rectangleEnd.y)
            const bottom = Math.max(this.rectangleStart.y, this.rectangleEnd.y)

            for (let y = top; y <= bottom; y++) {
                for (let x = left; x <= right; x++) {
                    this.drawPreviewTile(ctx, camera, x, y, gridSize, offsetX, offsetY, tileId)
                }
            }

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.lineWidth = 2 / camera.zoom
            ctx.strokeRect(
                left * gridSize + offsetX,
                top * gridSize + offsetY,
                (right - left + 1) * gridSize,
                (bottom - top + 1) * gridSize
            )
        } else if (this.previewGrid) {
            this.drawPreviewTile(
                ctx,
                camera,
                this.previewGrid.x,
                this.previewGrid.y,
                gridSize,
                offsetX,
                offsetY,
                tileId
            )
        }

        ctx.restore()
    }

    getCursor(): string {
        return 'crosshair'
    }

    private paintRectangle(start: GridPoint, end: GridPoint): void {
        const layer = this.layerInstance
        if (!layer) return
        const tileId = this.selectedTileIds[0]
        if (!tileId) return

        const left = Math.min(start.x, end.x)
        const right = Math.max(start.x, end.x)
        const top = Math.min(start.y, end.y)
        const bottom = Math.max(start.y, end.y)

        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                this.setTileAt(layer, x, y, tileId)
            }
        }
    }

    private setTileAt(layer: LayerInstance, gridX: number, gridY: number, tileId: number): void {
        if (gridX < 0 || gridY < 0 || gridX >= layer.__cWid || gridY >= layer.__cHei) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const pxX = gridX * gridSize
        const pxY = gridY * gridSize
        const index = layer.gridTiles.findIndex(
            (tile) => tile.px[0] === pxX && tile.px[1] === pxY
        )

        if (tileId <= 0) {
            if (index !== -1) {
                layer.gridTiles.splice(index, 1)
            }
            return
        }

        const nextTile: TileInstance = {
            t: tileId,
            px: [pxX, pxY],
            src: [0, 0],
            f: 0,
            a: 1,
        }

        if (index === -1) {
            layer.gridTiles.push(nextTile)
        } else {
            layer.gridTiles[index] = nextTile
        }
    }

    private getPaintTileId(): number | null {
        if (this.selectedTileIds.length === 0) return null
        if (this.stampMode === 'random') {
            const index = Math.floor(Math.random() * this.selectedTileIds.length)
            return this.selectedTileIds[index] ?? null
        }
        return this.selectedTileIds[0] ?? null
    }

    private getPreviewTileId(): number | null {
        return this.selectedTileIds[0] ?? null
    }

    private drawPreviewTile(
        ctx: CanvasRenderingContext2D,
        camera: Camera,
        gridX: number,
        gridY: number,
        gridSize: number,
        offsetX: number,
        offsetY: number,
        tileId: number
    ): void {
        const x = gridX * gridSize + offsetX
        const y = gridY * gridSize + offsetY
        ctx.fillStyle = this.getTilePreviewColor(tileId)
        ctx.fillRect(x, y, gridSize, gridSize)

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 2 / camera.zoom
        ctx.strokeRect(x, y, gridSize, gridSize)

        if (gridSize * camera.zoom >= 14) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
            ctx.font = `${Math.max(8, Math.round(12 / camera.zoom))}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(tileId), x + gridSize / 2, y + gridSize / 2)
        }
    }

    private getTilePreviewColor(tileId: number): string {
        const hue = Math.abs(tileId * 47) % 360
        return `hsl(${hue}, 65%, 55%)`
    }
}
