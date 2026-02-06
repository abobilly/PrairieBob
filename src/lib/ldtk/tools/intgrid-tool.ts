import type { Camera } from '../camera'
import { setIntGridValue } from '../layer-instance'
import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'
import type { TileInstance } from '../layer-instance'

type GridPoint = { x: number; y: number }

export class IntGridTool extends LayerTool {
    readonly id = 'intgrid'
    readonly name = 'IntGrid'
    selectedValue = 1
    private previewGrid: GridPoint | null = null

    constructor(context: ToolContext) {
        super(context)
    }

    onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return

        // Shift+click uses flood fill, matching the bucket icon expectation.
        if (e.shiftKey) {
            this.floodFillAt(grid.x, grid.y)
            return
        }

        super.onMouseDown(e)
    }

    paintAt(gridX: number, gridY: number): void {
        const layer = this.layerInstance
        if (!layer) return
        if (layer.__type !== 'IntGrid') {
            this.setCollisionTileAt(layer, gridX, gridY, this.selectedValue)
            return
        }
        setIntGridValue(layer, gridX, gridY, this.selectedValue)
    }

    onMouseMove(e: MouseEvent): void {
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        this.previewGrid = world ? this.worldToGrid(world.x, world.y) : null
        super.onMouseMove(e)
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        const layer = this.layerInstance
        const grid = this.previewGrid
        if (!layer || !grid) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const startX = grid.x * gridSize + layer.__pxTotalOffsetX
        const startY = grid.y * gridSize + layer.__pxTotalOffsetY

        ctx.save()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 2 / camera.zoom
        ctx.strokeRect(startX, startY, gridSize, gridSize)
        ctx.restore()
    }

    getCursor(): string {
        return 'crosshair'
    }

    private floodFillAt(startX: number, startY: number): void {
        const layer = this.layerInstance
        if (!layer) return

        const width = layer.__cWid
        const height = layer.__cHei
        if (startX < 0 || startY < 0 || startX >= width || startY >= height) return

        if (layer.__type === 'IntGrid') {
            const startIndex = startY * width + startX
            const sourceValue = layer.intGridCsv[startIndex] ?? 0
            if (sourceValue === this.selectedValue) return

            const queue: GridPoint[] = [{ x: startX, y: startY }]
            const visited = new Set<string>()
            while (queue.length > 0) {
                const cell = queue.pop()
                if (!cell) break
                const key = `${cell.x},${cell.y}`
                if (visited.has(key)) continue
                visited.add(key)

                const index = cell.y * width + cell.x
                const current = layer.intGridCsv[index] ?? 0
                if (current !== sourceValue) continue
                setIntGridValue(layer, cell.x, cell.y, this.selectedValue)

                if (cell.x > 0) queue.push({ x: cell.x - 1, y: cell.y })
                if (cell.x < width - 1) queue.push({ x: cell.x + 1, y: cell.y })
                if (cell.y > 0) queue.push({ x: cell.x, y: cell.y - 1 })
                if (cell.y < height - 1) queue.push({ x: cell.x, y: cell.y + 1 })
            }
            return
        }

        const sourceFilled = this.hasCollisionTileAt(layer, startX, startY)
        const targetFilled = this.selectedValue > 0
        if (sourceFilled === targetFilled) return

        const queue: GridPoint[] = [{ x: startX, y: startY }]
        const visited = new Set<string>()
        while (queue.length > 0) {
            const cell = queue.pop()
            if (!cell) break
            const key = `${cell.x},${cell.y}`
            if (visited.has(key)) continue
            visited.add(key)

            const isFilled = this.hasCollisionTileAt(layer, cell.x, cell.y)
            if (isFilled !== sourceFilled) continue

            this.setCollisionTileAt(layer, cell.x, cell.y, this.selectedValue)

            if (cell.x > 0) queue.push({ x: cell.x - 1, y: cell.y })
            if (cell.x < width - 1) queue.push({ x: cell.x + 1, y: cell.y })
            if (cell.y > 0) queue.push({ x: cell.x, y: cell.y - 1 })
            if (cell.y < height - 1) queue.push({ x: cell.x, y: cell.y + 1 })
        }
    }

    private hasCollisionTileAt(layer: NonNullable<typeof this.layerInstance>, gridX: number, gridY: number): boolean {
        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const pxX = gridX * gridSize
        const pxY = gridY * gridSize
        return layer.gridTiles.some((tile) => tile.px[0] === pxX && tile.px[1] === pxY)
    }

    private setCollisionTileAt(
        layer: NonNullable<typeof this.layerInstance>,
        gridX: number,
        gridY: number,
        value: number
    ): void {
        if (gridX < 0 || gridY < 0 || gridX >= layer.__cWid || gridY >= layer.__cHei) return

        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const pxX = gridX * gridSize
        const pxY = gridY * gridSize
        const index = layer.gridTiles.findIndex((tile) => tile.px[0] === pxX && tile.px[1] === pxY)

        if (value <= 0) {
            if (index !== -1) layer.gridTiles.splice(index, 1)
            return
        }

        const resolved = this.context.resolveTileSource?.(value)
        const nextTile: TileInstance = {
            t: value,
            px: [pxX, pxY],
            src: resolved ? [resolved.x, resolved.y] : [0, 0],
            f: 0,
            a: 1,
        }

        if (index === -1) {
            layer.gridTiles.push(nextTile)
        } else {
            layer.gridTiles[index] = nextTile
        }
    }
}
