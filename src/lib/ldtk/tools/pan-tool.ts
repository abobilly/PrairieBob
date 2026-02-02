import { Tool, ToolContext } from './tool'

export class PanTool extends Tool {
    private dragging = false
    private lastX = 0
    private lastY = 0

    constructor(context: ToolContext) {
        super(context)
    }

    onMouseDown(e: MouseEvent): void {
        this.dragging = e.button === 0 || e.button === 1 || e.button === 2
        if (!this.dragging) return
        this.lastX = e.clientX
        this.lastY = e.clientY
    }

    onMouseMove(e: MouseEvent): void {
        if (!this.dragging) return
        const dx = e.clientX - this.lastX
        const dy = e.clientY - this.lastY
        this.context.setPan(this.context.viewport.panX + dx, this.context.viewport.panY + dy)
        this.lastX = e.clientX
        this.lastY = e.clientY
    }

    onMouseUp(): void {
        this.dragging = false
    }

    getCursor(): string {
        return this.dragging ? 'grabbing' : 'grab'
    }
}
