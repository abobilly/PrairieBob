import type { Level } from '../level'
import { Tool, ToolContext } from './tool'

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

interface ResizeToolContext extends ToolContext {
    level: Level
    onLevelResize?: (level: Level) => void
}

export class ResizeTool extends Tool {
    readonly id = 'resize'
    readonly name = 'Resize Level'
    private edge: ResizeEdge = null
    private dragging = false
    private startBounds: { left: number; right: number; top: number; bottom: number } | null = null
    private readonly level: Level
    private readonly onLevelResize?: (level: Level) => void

    constructor(context: ResizeToolContext) {
        super(context)
        this.level = context.level
        this.onLevelResize = context.onLevelResize
    }

    onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return
        const edge = this.getEdgeAtEvent(e)
        if (!edge) return
        this.edge = edge
        this.dragging = true
        this.startBounds = this.getBounds()
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.context.screenToWorld) return
        if (!this.dragging || !this.edge || !this.startBounds) {
            if (!this.dragging) {
                this.edge = this.getEdgeAtEvent(e)
            }
            return
        }

        const world = this.context.screenToWorld(e.clientX, e.clientY)
        const gridSize = this.getGridSize()
        const snappedX = this.snap(world.x, gridSize)
        const snappedY = this.snap(world.y, gridSize)
        const start = this.startBounds
        let left = start.left
        let right = start.right
        let top = start.top
        let bottom = start.bottom

        switch (this.edge) {
            case 'e':
                right = snappedX
                break
            case 'w':
                left = snappedX
                break
            case 's':
                bottom = snappedY
                break
            case 'n':
                top = snappedY
                break
            case 'ne':
                right = snappedX
                top = snappedY
                break
            case 'nw':
                left = snappedX
                top = snappedY
                break
            case 'se':
                right = snappedX
                bottom = snappedY
                break
            case 'sw':
                left = snappedX
                bottom = snappedY
                break
            default:
                break
        }

        const moveWest = this.edge === 'w' || this.edge === 'nw' || this.edge === 'sw'
        const moveEast = this.edge === 'e' || this.edge === 'ne' || this.edge === 'se'
        const moveNorth = this.edge === 'n' || this.edge === 'ne' || this.edge === 'nw'
        const moveSouth = this.edge === 's' || this.edge === 'se' || this.edge === 'sw'
        const minSize = gridSize

        if (right - left < minSize) {
            if (moveWest) {
                left = right - minSize
            } else if (moveEast) {
                right = left + minSize
            }
        }

        if (bottom - top < minSize) {
            if (moveNorth) {
                top = bottom - minSize
            } else if (moveSouth) {
                bottom = top + minSize
            }
        }

        this.level.pxWid = Math.max(minSize, right - left)
        this.level.pxHei = Math.max(minSize, bottom - top)
        this.level.worldX = moveWest ? left : start.left
        this.level.worldY = moveNorth ? top : start.top
        this.onLevelResize?.(this.level)
    }

    onMouseUp(): void {
        this.dragging = false
        this.startBounds = null
        this.edge = null
    }

    getCursor(): string {
        switch (this.edge) {
            case 'n':
            case 's':
                return 'ns-resize'
            case 'e':
            case 'w':
                return 'ew-resize'
            case 'ne':
            case 'sw':
                return 'nesw-resize'
            case 'nw':
            case 'se':
                return 'nwse-resize'
            default:
                return 'default'
        }
    }

    private getBounds(): { left: number; right: number; top: number; bottom: number } {
        return {
            left: this.level.worldX,
            right: this.level.worldX + this.level.pxWid,
            top: this.level.worldY,
            bottom: this.level.worldY + this.level.pxHei,
        }
    }

    private getEdgeAtEvent(e: MouseEvent): ResizeEdge {
        if (!this.context.screenToWorld) return null
        const world = this.context.screenToWorld(e.clientX, e.clientY)
        return this.getEdgeAt(world.x, world.y)
    }

    private getEdgeAt(worldX: number, worldY: number): ResizeEdge {
        const { left, right, top, bottom } = this.getBounds()
        const threshold = this.getHandleThreshold()
        const nearLeft = Math.abs(worldX - left) <= threshold && worldY >= top - threshold && worldY <= bottom + threshold
        const nearRight = Math.abs(worldX - right) <= threshold && worldY >= top - threshold && worldY <= bottom + threshold
        const nearTop = Math.abs(worldY - top) <= threshold && worldX >= left - threshold && worldX <= right + threshold
        const nearBottom = Math.abs(worldY - bottom) <= threshold && worldX >= left - threshold && worldX <= right + threshold

        if (nearLeft && nearTop) return 'nw'
        if (nearRight && nearTop) return 'ne'
        if (nearLeft && nearBottom) return 'sw'
        if (nearRight && nearBottom) return 'se'
        if (nearLeft) return 'w'
        if (nearRight) return 'e'
        if (nearTop) return 'n'
        if (nearBottom) return 's'
        return null
    }

    private getHandleThreshold(): number {
        const zoom = this.context.viewport.zoom || 1
        const gridSize = this.getGridSize()
        return Math.max(4 / zoom, gridSize * 0.25)
    }

    private getGridSize(): number {
        const gridSize = this.context.tileSize ?? 1
        return Math.max(1, Math.round(gridSize))
    }

    private snap(value: number, gridSize: number): number {
        return Math.round(value / gridSize) * gridSize
    }
}
