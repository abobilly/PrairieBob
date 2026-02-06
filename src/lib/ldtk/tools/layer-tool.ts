import { Tool, ToolContext } from './tool'
import type { LayerInstance } from '../project'

export abstract class LayerTool extends Tool {
    protected layerInstance: LayerInstance | null = null
    private isDragging = false
    private lastGridX: number | null = null
    private lastGridY: number | null = null

    constructor(context: ToolContext) {
        super(context)
    }

    setLayer(layer: LayerInstance | null): void {
        this.layerInstance = layer
        this.lastGridX = null
        this.lastGridY = null
    }

    abstract paintAt(gridX: number, gridY: number): void

    onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return
        this.isDragging = true
        this.paintAt(grid.x, grid.y)
        this.lastGridX = grid.x
        this.lastGridY = grid.y
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return
        const grid = this.worldToGrid(world.x, world.y)
        if (!grid) return
        if (this.lastGridX === null || this.lastGridY === null) {
            this.paintAt(grid.x, grid.y)
            this.lastGridX = grid.x
            this.lastGridY = grid.y
            return
        }
        if (grid.x === this.lastGridX && grid.y === this.lastGridY) return
        this.paintLine(this.lastGridX, this.lastGridY, grid.x, grid.y)
        this.lastGridX = grid.x
        this.lastGridY = grid.y
    }

    onMouseUp(): void {
        this.isDragging = false
        this.lastGridX = null
        this.lastGridY = null
    }

    protected worldToGrid(worldX: number, worldY: number): { x: number; y: number } | null {
        const layer = this.layerInstance
        if (!layer) return null
        const gridSize = layer.__gridSize || this.context.tileSize || 1
        const localX = worldX - layer.__pxTotalOffsetX
        const localY = worldY - layer.__pxTotalOffsetY
        const gridX = Math.floor(localX / gridSize)
        const gridY = Math.floor(localY / gridSize)
        if (gridX < 0 || gridY < 0 || gridX >= layer.__cWid || gridY >= layer.__cHei) {
            return null
        }
        return { x: gridX, y: gridY }
    }

    private paintLine(x0: number, y0: number, x1: number, y1: number): void {
        let dx = Math.abs(x1 - x0)
        let dy = Math.abs(y1 - y0)
        const sx = x0 < x1 ? 1 : -1
        const sy = y0 < y1 ? 1 : -1
        let err = dx - dy

        while (true) {
            this.paintAt(x0, y0)
            if (x0 === x1 && y0 === y1) break
            const e2 = 2 * err
            if (e2 > -dy) {
                err -= dy
                x0 += sx
            }
            if (e2 < dx) {
                err += dx
                y0 += sy
            }
        }
    }
}
