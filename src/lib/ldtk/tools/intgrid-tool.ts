import type { Camera } from '../camera'
import { setIntGridValue } from '../layer-instance'
import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'

type GridPoint = { x: number; y: number }

export class IntGridTool extends LayerTool {
    readonly id = 'intgrid'
    readonly name = 'IntGrid'
    selectedValue = 1
    private previewGrid: GridPoint | null = null

    constructor(context: ToolContext) {
        super(context)
    }

    paintAt(gridX: number, gridY: number): void {
        const layer = this.layerInstance
        if (!layer) return
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
}
