import { Tool } from './tool'

export class PickTool extends Tool {
    onMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return
        const layer = this.context.getActiveLayer?.()
        if (!layer) return

        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        const tile = world && this.context.worldToTile?.(world.x, world.y)
        if (!tile) return

        if (tile.x < 0 || tile.y < 0 || tile.x >= layer.width || tile.y >= layer.height) {
            return
        }

        const index = tile.y * layer.width + tile.x

        if (layer.type === 'tilelayer' && layer.data) {
            const tileId = layer.data[index]
            if (tileId && tileId > 0) {
                this.context.onPickTile?.(tileId)
            }
        } else if (layer.type === 'intgrid' && layer.intGrid) {
            const value = layer.intGrid[index] ?? 0
            this.context.onPickIntGrid?.(value)
        } else if (layer.type === 'objectgroup' && layer.objects) {
            const hit = layer.objects.find((obj) =>
                world.x >= obj.x && world.x <= obj.x + obj.width &&
                world.y >= obj.y && world.y <= obj.y + obj.height
            )
            if (hit) {
                this.context.onPickEntity?.(hit.id)
            }
        }
    }

    onMouseMove(): void {
        // no-op
    }

    onMouseUp(): void {
        // no-op
    }

    getCursor(): string {
        return 'crosshair'
    }
}
