import { Camera } from '../camera'
import { Tool, ToolContext } from './tool'

type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }
const CLICK_PICK_THRESHOLD_PX = 4

export class SelectionTool extends Tool {
    readonly id = 'select'
    readonly name = 'Selection'
    private startPos: Point | null = null
    private endPos: Point | null = null
    private selection: Rect | null = null

    constructor(context: ToolContext) {
        super(context)
    }

    onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return
        const pos = this.getWorldPos(e)
        this.startPos = pos
        this.endPos = pos
        this.selection = null
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.startPos) return
        this.endPos = this.getWorldPos(e)
    }

    onMouseUp(): void {
        if (!this.startPos || !this.endPos) {
            this.startPos = null
            this.endPos = null
            return
        }
        const width = Math.abs(this.endPos.x - this.startPos.x)
        const height = Math.abs(this.endPos.y - this.startPos.y)
        if (width <= CLICK_PICK_THRESHOLD_PX && height <= CLICK_PICK_THRESHOLD_PX) {
            this.pickAt(this.endPos)
            this.selection = null
            this.startPos = null
            this.endPos = null
            return
        }

        this.selection = normalizeRect(this.startPos, this.endPos)
        this.startPos = null
        this.endPos = null
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        const rect = this.getActiveRect()
        if (!rect) return

        const startScreen = camera.worldToScreen(rect.x, rect.y)
        const endScreen = camera.worldToScreen(rect.x + rect.width, rect.y + rect.height)
        const width = endScreen.x - startScreen.x
        const height = endScreen.y - startScreen.y

        ctx.save()
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)'
        ctx.lineWidth = 2 / camera.zoom
        ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom])
        ctx.strokeRect(startScreen.x, startScreen.y, width, height)
        ctx.setLineDash([])
        ctx.restore()
    }

    getSelection(): Rect | null {
        return this.selection
    }

    getCursor(): string {
        return 'crosshair'
    }

    private getActiveRect(): Rect | null {
        if (this.startPos && this.endPos) {
            return normalizeRect(this.startPos, this.endPos)
        }
        return this.selection
    }

    private getWorldPos(e: MouseEvent): Point {
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        return world ?? { x: e.clientX, y: e.clientY }
    }

    private pickAt(world: Point): void {
        const layer = this.context.getActiveLayer?.()
        if (!layer) return

        const tile = this.context.worldToTile?.(world.x, world.y)
        if (!tile) return
        if (tile.x < 0 || tile.y < 0 || tile.x >= layer.width || tile.y >= layer.height) {
            return
        }

        const index = tile.y * layer.width + tile.x
        if (layer.type === 'tilelayer' && layer.data) {
            const tileId = layer.data[index] ?? 0
            if (tileId > 0) {
                this.context.onPickTile?.(tileId)
            }
            return
        }
        if (layer.type === 'intgrid' && layer.intGrid) {
            const value = layer.intGrid[index] ?? 0
            this.context.onPickIntGrid?.(value)
            return
        }
        if (layer.type === 'objectgroup' && layer.objects) {
            const hit = layer.objects.find((obj) =>
                world.x >= obj.x &&
                world.x <= obj.x + obj.width &&
                world.y >= obj.y &&
                world.y <= obj.y + obj.height
            )
            if (hit) {
                this.context.onPickEntity?.(hit.id)
            }
        }
    }
}

function normalizeRect(start: Point, end: Point): Rect {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    return { x, y, width, height }
}
