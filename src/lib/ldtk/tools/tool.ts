export interface ViewportState {
    zoom: number
    panX: number
    panY: number
}

export interface ToolLayer {
    type: 'tilelayer' | 'objectgroup' | 'intgrid'
    width: number
    height: number
    data?: number[]
    intGrid?: number[]
    objects?: Array<{ id: string; x: number; y: number; width: number; height: number }>
}

export interface ToolContext {
    viewport: ViewportState
    setPan: (x: number, y: number) => void
    setZoom?: (zoom: number) => void
    zoomToPoint?: (zoom: number, screenX: number, screenY: number) => void
    screenToWorld?: (screenX: number, screenY: number) => { x: number; y: number }
    lastMouseWorld?: { x: number; y: number }
    worldToTile?: (worldX: number, worldY: number) => { x: number; y: number }
    tileSize?: number
    tileRotation?: 0 | 90 | 180 | 270
    getActiveLayer?: () => ToolLayer | null
    resolveTileSource?: (tileId: number) => { x: number; y: number } | null
    onPickTile?: (tileId: number) => void
    onPickEntity?: (entityId: string) => void
    onPickIntGrid?: (value: number) => void
    collisionPaintMode?: 'paint' | 'erase' | 'fill'
}

export abstract class Tool {
    protected readonly context: ToolContext

    protected constructor(context: ToolContext) {
        this.context = context
    }

    abstract onMouseDown(e: MouseEvent): void
    abstract onMouseMove(e: MouseEvent): void
    abstract onMouseUp(e?: MouseEvent): void
    abstract getCursor(): string
}
