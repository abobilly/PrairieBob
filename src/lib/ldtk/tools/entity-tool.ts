import { LayerTool } from './layer-tool'
import type { ToolContext } from './tool'
import type { Camera } from '../camera'
import type { EntityInstance } from '../layer-instance'

export interface EntityToolContext extends ToolContext {
    onEntityPlaced?: (entity: EntityInstance) => void
    onEntityMoved?: (entity: EntityInstance) => void
    onEntityDeleted?: (entity: EntityInstance) => void
}

export class EntityTool extends LayerTool {
    readonly id = 'entity'
    readonly name = 'Entity'

    private selectedEntityDefUid: number | null = null
    private draggingEntity: EntityInstance | null = null
    private dragOffset: { x: number; y: number } = { x: 0, y: 0 }
    private lastMouseWorldPos: { x: number; y: number } | null = null

    private onEntityPlaced?: (entity: EntityInstance) => void
    private onEntityMoved?: (entity: EntityInstance) => void
    private onEntityDeleted?: (entity: EntityInstance) => void

    constructor(context: EntityToolContext) {
        super(context)
        this.onEntityPlaced = context.onEntityPlaced
        this.onEntityMoved = context.onEntityMoved
        this.onEntityDeleted = context.onEntityDeleted
    }

    getCursor(): string {
        return this.draggingEntity ? 'grabbing' : 'pointer'
    }

    getSelectedEntityDefUid(): number | null {
        return this.selectedEntityDefUid
    }

    setSelectedEntityDef(uid: number | null): void {
        this.selectedEntityDefUid = uid
    }

    paintAt(_gridX: number, _gridY: number): void {
        // Entity tool doesn't use continuous painting
    }

    onMouseDown(e: MouseEvent): void {
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (!world) return

        if (e.button === 2) {
            // Right-click: delete entity
            const entity = this.findEntityAt(world.x, world.y)
            if (entity) {
                this.deleteEntity(entity)
            }
            return
        }

        if (e.button !== 0) return

        // Left-click: move existing or place new
        const existingEntity = this.findEntityAt(world.x, world.y)
        if (existingEntity) {
            this.draggingEntity = existingEntity
            this.dragOffset = {
                x: existingEntity.px[0] - world.x,
                y: existingEntity.px[1] - world.y,
            }
        } else if (this.selectedEntityDefUid !== null) {
            this.placeEntity(world.x, world.y)
        }
    }

    onMouseMove(e: MouseEvent): void {
        const world = this.context.screenToWorld?.(e.clientX, e.clientY)
        if (world) {
            this.lastMouseWorldPos = world
        }

        if (!this.draggingEntity) return
        if (!world) return

        this.draggingEntity.px = [
            world.x + this.dragOffset.x,
            world.y + this.dragOffset.y,
        ]
    }

    onMouseUp(): void {
        if (this.draggingEntity) {
            this.snapEntityToGrid(this.draggingEntity)
            this.onEntityMoved?.(this.draggingEntity)
            this.draggingEntity = null
        }
        this.dragOffset = { x: 0, y: 0 }
    }

    private findEntityAt(worldX: number, worldY: number): EntityInstance | null {
        const layer = this.layerInstance
        if (!layer || !layer.entityInstances) return null

        for (const entity of layer.entityInstances) {
            const ex = entity.px[0]
            const ey = entity.px[1]
            const ew = entity.width
            const eh = entity.height

            if (
                worldX >= ex &&
                worldX <= ex + ew &&
                worldY >= ey &&
                worldY <= ey + eh
            ) {
                return entity
            }
        }

        return null
    }

    private placeEntity(worldX: number, worldY: number): void {
        const layer = this.layerInstance
        if (!layer || this.selectedEntityDefUid === null) return

        const gridSize = layer.__gridSize || this.context.tileSize || 16
        const snappedX = Math.floor(worldX / gridSize) * gridSize
        const snappedY = Math.floor(worldY / gridSize) * gridSize

        const newEntity: EntityInstance = {
            __identifier: 'NewEntity',
            __grid: [Math.floor(snappedX / gridSize), Math.floor(snappedY / gridSize)],
            __pivot: [0, 0],
            __tags: [],
            __tile: null,
            __smartColor: '#FFFFFF',
            __worldX: snappedX,
            __worldY: snappedY,
            iid: crypto.randomUUID(),
            defUid: this.selectedEntityDefUid,
            px: [snappedX, snappedY],
            width: gridSize,
            height: gridSize,
            fieldInstances: [],
        }

        if (!layer.entityInstances) {
            layer.entityInstances = []
        }
        layer.entityInstances.push(newEntity)
        this.onEntityPlaced?.(newEntity)
    }

    private deleteEntity(entity: EntityInstance): void {
        const layer = this.layerInstance
        if (!layer || !layer.entityInstances) return

        const idx = layer.entityInstances.indexOf(entity)
        if (idx !== -1) {
            layer.entityInstances.splice(idx, 1)
            this.onEntityDeleted?.(entity)
        }
    }

    private snapEntityToGrid(entity: EntityInstance): void {
        const layer = this.layerInstance
        if (!layer) return

        const gridSize = layer.__gridSize || this.context.tileSize || 16
        entity.px = [
            Math.round(entity.px[0] / gridSize) * gridSize,
            Math.round(entity.px[1] / gridSize) * gridSize,
        ]
        entity.__grid = [
            Math.floor(entity.px[0] / gridSize),
            Math.floor(entity.px[1] / gridSize),
        ]
        entity.__worldX = entity.px[0]
        entity.__worldY = entity.px[1]
    }

    render(ctx: CanvasRenderingContext2D, camera: Camera): void {
        const layer = this.layerInstance
        if (!layer) return

        // Draw ghost preview when placing
        if (this.selectedEntityDefUid !== null && !this.draggingEntity) {
            const mouseWorld = this.lastMouseWorldPos
            if (mouseWorld) {
                const gridSize = layer.__gridSize || this.context.tileSize || 16
                const snappedX = Math.floor(mouseWorld.x / gridSize) * gridSize
                const snappedY = Math.floor(mouseWorld.y / gridSize) * gridSize

                ctx.save()
                ctx.globalAlpha = 0.5
                ctx.fillStyle = '#4CAF50'
                ctx.fillRect(snappedX, snappedY, gridSize, gridSize)
                ctx.strokeStyle = '#FFFFFF'
                ctx.lineWidth = 2 / camera.zoom
                ctx.strokeRect(snappedX, snappedY, gridSize, gridSize)
                ctx.restore()
            }
        }

        // Highlight entity being dragged
        if (this.draggingEntity) {
            ctx.save()
            ctx.strokeStyle = '#FFD700'
            ctx.lineWidth = 3 / camera.zoom
            ctx.strokeRect(
                this.draggingEntity.px[0],
                this.draggingEntity.px[1],
                this.draggingEntity.width,
                this.draggingEntity.height
            )
            ctx.restore()
        }
    }
}
