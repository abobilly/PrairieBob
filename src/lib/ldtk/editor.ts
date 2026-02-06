/**
 * LDtk Editor - Central coordinator for project state, tools, history, and input.
 */

import type { LDtkProject } from './project'
import { getAllLevels, getLevelByIid } from './project'
import type { Level } from './level'
import type { LayerInstance, TileInstance, EntityInstance, FieldInstance } from './layer-instance'
import { getIntGridValue, setIntGridValue } from './layer-instance'
import { Camera } from './camera'
import { Tool } from './tools/tool'
import type { ToolContext, ToolLayer, ViewportState } from './tools/tool'

const DEFAULT_HISTORY_LIMIT = 100
const DEFAULT_VIEWPORT_WIDTH = 1280
const DEFAULT_VIEWPORT_HEIGHT = 720
const DEFAULT_AUTOSAVE_MS = 10_000

type Rect = { x: number; y: number; width: number; height: number }
type GridRect = { x: number; y: number; width: number; height: number }

export interface Edit {
    label?: string
    timestamp?: number
    apply: (project: LDtkProject) => void
    revert: (project: LDtkProject) => void
    merge?: (next: Edit) => Edit | null
}

export class History {
    private readonly maxEntries: number
    private past: Edit[] = []
    private future: Edit[] = []

    constructor(limit = DEFAULT_HISTORY_LIMIT) {
        this.maxEntries = Math.max(1, limit)
    }

    record(edit: Edit): void {
        const last = this.past[this.past.length - 1]
        if (last?.merge) {
            const merged = last.merge(edit)
            if (merged) {
                this.past[this.past.length - 1] = merged
                this.future = []
                return
            }
        }

        this.past.push(edit)
        if (this.past.length > this.maxEntries) {
            this.past.shift()
        }
        this.future = []
    }

    undo(): Edit | null {
        const edit = this.past.pop()
        if (!edit) return null
        this.future.push(edit)
        return edit
    }

    redo(): Edit | null {
        const edit = this.future.pop()
        if (!edit) return null
        this.past.push(edit)
        return edit
    }

    clear(): void {
        this.past = []
        this.future = []
    }

    canUndo(): boolean {
        return this.past.length > 0
    }

    canRedo(): boolean {
        return this.future.length > 0
    }

    getPast(): Edit[] {
        return [...this.past]
    }

    getFuture(): Edit[] {
        return [...this.future]
    }
}

export type ClipboardPayload =
    | {
          type: 'tiles'
          layerIid: string
          rect: GridRect
          tiles: number[][]
      }
    | {
          type: 'intgrid'
          layerIid: string
          rect: GridRect
          values: number[][]
      }
    | {
          type: 'entities'
          layerIid: string
          rect: Rect
          origin: { x: number; y: number }
          entities: EntityInstance[]
      }

export type EditorEvent =
    | { type: 'tool-changed'; tool: Tool }
    | { type: 'level-changed'; level: Level | null }
    | { type: 'layer-changed'; layer: LayerInstance | null }
    | { type: 'edit-applied'; edit: Edit }
    | { type: 'undo'; edit: Edit }
    | { type: 'redo'; edit: Edit }
    | { type: 'project-changed'; reason: 'edit' | 'undo' | 'redo' | 'cut' | 'paste' }
    | { type: 'clipboard-changed'; clipboard: ClipboardPayload | null }
    | { type: 'viewport-changed'; viewport: ViewportState }
    | { type: 'autosave-success' }
    | { type: 'autosave-error'; error: unknown }
    | { type: 'pick-tile'; tileId: number }
    | { type: 'pick-entity'; entityId: string }
    | { type: 'pick-intgrid'; value: number }

type EditorEventType = EditorEvent['type']
type EditorEventListener = (event: EditorEvent) => void

class EditorEventEmitter {
    private listeners = new Map<EditorEventType | '*', Set<EditorEventListener>>()

    on(type: EditorEventType | '*', listener: EditorEventListener): () => void {
        const list = this.listeners.get(type) ?? new Set<EditorEventListener>()
        list.add(listener)
        this.listeners.set(type, list)
        return () => this.off(type, listener)
    }

    off(type: EditorEventType | '*', listener: EditorEventListener): void {
        const list = this.listeners.get(type)
        if (!list) return
        list.delete(listener)
        if (list.size === 0) {
            this.listeners.delete(type)
        }
    }

    emit(event: EditorEvent): void {
        const direct = this.listeners.get(event.type)
        if (direct) {
            for (const listener of direct) {
                listener(event)
            }
        }
        const all = this.listeners.get('*')
        if (all) {
            for (const listener of all) {
                listener(event)
            }
        }
    }
}

class NullTool extends Tool {
    constructor(context: ToolContext) {
        super(context)
    }

    onMouseDown(): void {
        // no-op
    }

    onMouseMove(): void {
        // no-op
    }

    onMouseUp(): void {
        // no-op
    }

    getCursor(): string {
        return 'default'
    }
}

interface RenderableTool {
    render(ctx: CanvasRenderingContext2D, camera: Camera): void
}

interface SelectionProvider {
    getSelection(): Rect | null
}

interface LayerAwareTool {
    setLayer(layer: LayerInstance | null): void
}

interface KeyAwareTool {
    onKeyDown(e: KeyboardEvent): void
}

export interface EditorAutoSaveOptions {
    enabled?: boolean
    intervalMs?: number
    onSave: (project: LDtkProject) => Promise<void> | void
}

export interface EditorOptions {
    camera?: Camera
    viewport?: { width: number; height: number }
    historyLimit?: number
    initialTool?: Tool
    initialLevelIid?: string
    initialLayerIid?: string
    selectionProvider?: SelectionProvider
    autoSave?: EditorAutoSaveOptions
    onPickTile?: (tileId: number) => void
    onPickEntity?: (entityId: string) => void
    onPickIntGrid?: (value: number) => void
}

export class Editor {
    project: LDtkProject
    activeLevel: Level | null
    activeLayer: LayerInstance | null
    activeTool: Tool
    camera: Camera
    history: History

    private readonly events = new EditorEventEmitter()
    private readonly viewport: ViewportState
    private readonly toolContext: ToolContext
    private readonly selectionProvider: SelectionProvider | null
    private autoSaveOptions: EditorAutoSaveOptions | null
    private autoSaveTimer: ReturnType<typeof setTimeout> | null = null
    private autoSavePending = false
    private autoSaveRunning = false
    private lastMouseWorld: { x: number; y: number } | null = null
    private clipboardPayload: ClipboardPayload | null = null
    private readonly pickHandlers: {
        onPickTile?: (tileId: number) => void
        onPickEntity?: (entityId: string) => void
        onPickIntGrid?: (value: number) => void
    }

    constructor(project: LDtkProject, options?: EditorOptions) {
        this.project = project
        this.camera =
            options?.camera ??
            new Camera(
                options?.viewport?.width ?? DEFAULT_VIEWPORT_WIDTH,
                options?.viewport?.height ?? DEFAULT_VIEWPORT_HEIGHT
            )
        this.viewport = {
            zoom: this.camera.zoom,
            panX: this.camera.panX,
            panY: this.camera.panY,
        }
        this.history = new History(options?.historyLimit ?? DEFAULT_HISTORY_LIMIT)
        this.pickHandlers = {
            onPickTile: options?.onPickTile,
            onPickEntity: options?.onPickEntity,
            onPickIntGrid: options?.onPickIntGrid,
        }
        this.selectionProvider = options?.selectionProvider ?? null
        this.autoSaveOptions = options?.autoSave ?? null

        this.toolContext = {
            viewport: this.viewport,
            setPan: (x, y) => {
                this.camera.setPan(x, y)
                this.syncViewport()
            },
            setZoom: (zoom) => {
                this.camera.setZoom(zoom)
                this.syncViewport()
            },
            zoomToPoint: (zoom, screenX, screenY) => {
                const world = this.camera.screenToWorld(screenX, screenY)
                this.camera.setZoom(zoom)
                const next = this.camera.worldToScreen(world.x, world.y)
                const nextPanX = this.camera.panX + (screenX - next.x)
                const nextPanY = this.camera.panY + (screenY - next.y)
                this.camera.setPan(nextPanX, nextPanY)
                this.syncViewport()
            },
            screenToWorld: (x, y) => this.camera.screenToWorld(x, y),
            worldToTile: (worldX, worldY) => this.worldToTile(worldX, worldY),
            tileSize: this.getTileSize(),
            getActiveLayer: () => this.getActiveToolLayer(),
            onPickTile: (tileId) => {
                this.pickHandlers.onPickTile?.(tileId)
                this.emit({ type: 'pick-tile', tileId })
            },
            onPickEntity: (entityId) => {
                this.pickHandlers.onPickEntity?.(entityId)
                this.emit({ type: 'pick-entity', entityId })
            },
            onPickIntGrid: (value) => {
                this.pickHandlers.onPickIntGrid?.(value)
                this.emit({ type: 'pick-intgrid', value })
            },
        }

        const levels = getAllLevels(project)
        this.activeLevel = options?.initialLevelIid
            ? getLevelByIid(project, options.initialLevelIid) ?? null
            : levels[0] ?? null

        if (this.activeLevel && options?.initialLayerIid) {
            this.activeLayer =
                this.activeLevel.layerInstances.find(
                    (layer) => layer.iid === options.initialLayerIid
                ) ?? this.activeLevel.layerInstances[0] ?? null
        } else {
            this.activeLayer = this.activeLevel?.layerInstances[0] ?? null
        }

        this.activeTool = options?.initialTool ?? new NullTool(this.toolContext)
        this.applyLayerToTool(this.activeTool)
        this.updateToolContextLayer()
    }

    on(type: EditorEventType | '*', listener: EditorEventListener): () => void {
        return this.events.on(type, listener)
    }

    off(type: EditorEventType | '*', listener: EditorEventListener): void {
        this.events.off(type, listener)
    }

    getTool(): Tool {
        return this.activeTool
    }

    setTool(tool: Tool): void {
        this.activeTool = tool
        this.applyLayerToTool(tool)
        this.emit({ type: 'tool-changed', tool })
    }

    setActiveLevel(levelIid: string): void {
        const level = getLevelByIid(this.project, levelIid)
        if (!level) {
            throw new Error(`Level not found: ${levelIid}`)
        }
        this.activeLevel = level
        this.activeLayer = level.layerInstances[0] ?? null
        this.updateToolContextLayer()
        this.emit({ type: 'level-changed', level })
        this.emit({ type: 'layer-changed', layer: this.activeLayer })
    }

    setActiveLayer(layerIid: string): void {
        if (!this.activeLevel) {
            throw new Error('Cannot set active layer without an active level')
        }
        const layer =
            this.activeLevel.layerInstances.find((entry) => entry.iid === layerIid) ?? null
        if (!layer) {
            throw new Error(`Layer not found: ${layerIid}`)
        }
        this.activeLayer = layer
        this.updateToolContextLayer()
        this.emit({ type: 'layer-changed', layer })
    }

    applyEdit(edit: Edit): void {
        edit.apply(this.project)
        this.history.record(edit)
        this.markDirty('edit')
        this.emit({ type: 'edit-applied', edit })
    }

    undo(): void {
        const edit = this.history.undo()
        if (!edit) return
        edit.revert(this.project)
        this.markDirty('undo')
        this.emit({ type: 'undo', edit })
    }

    redo(): void {
        const edit = this.history.redo()
        if (!edit) return
        edit.apply(this.project)
        this.markDirty('redo')
        this.emit({ type: 'redo', edit })
    }

    render(ctx: CanvasRenderingContext2D): void {
        const canvas = ctx.canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = toCssColor(this.project.bgColor)
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.setTransform(this.camera.zoom, 0, 0, this.camera.zoom, this.camera.panX, this.camera.panY)

        if (this.activeLevel) {
            this.renderLevel(ctx, this.activeLevel)
        }

        if (isRenderableTool(this.activeTool)) {
            this.activeTool.render(ctx, this.camera)
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0)
    }

    handleMouseDown(e: MouseEvent): void {
        this.updateMouseWorld(e)
        this.activeTool.onMouseDown(e)
    }

    handleMouseMove(e: MouseEvent): void {
        this.updateMouseWorld(e)
        this.activeTool.onMouseMove(e)
    }

    handleMouseUp(e?: MouseEvent): void {
        if (e) {
            this.updateMouseWorld(e)
        }
        this.activeTool.onMouseUp(e)
    }

    handleKeyDown(e: KeyboardEvent): void {
        const key = e.key.toLowerCase()
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            e.preventDefault()
            if (e.shiftKey) {
                this.redo()
            } else {
                this.undo()
            }
            return
        }

        if ((e.ctrlKey || e.metaKey) && key === 'y') {
            e.preventDefault()
            this.redo()
            return
        }

        if (isKeyAwareTool(this.activeTool)) {
            this.activeTool.onKeyDown(e)
        }
    }

    copy(): void {
        const clipboard = this.captureClipboard()
        this.setClipboard(clipboard)
    }

    cut(): void {
        const clipboard = this.captureClipboard()
        const edit = this.createCutEdit(clipboard)
        this.applyEdit(edit)
        this.setClipboard(clipboard)
        this.emit({ type: 'project-changed', reason: 'cut' })
    }

    paste(): void {
        if (!this.clipboardPayload) {
            throw new Error('Clipboard is empty')
        }
        const edit = this.createPasteEdit(this.clipboardPayload)
        this.applyEdit(edit)
        this.emit({ type: 'project-changed', reason: 'paste' })
    }

    configureAutoSave(options: EditorAutoSaveOptions | null): void {
        this.autoSaveOptions = options
        if (!options?.enabled) {
            this.clearAutoSaveTimer()
        }
    }

    dispose(): void {
        this.clearAutoSaveTimer()
    }

    private emit(event: EditorEvent): void {
        this.events.emit(event)
    }

    private markDirty(reason: 'edit' | 'undo' | 'redo'): void {
        this.emit({ type: 'project-changed', reason })
        this.queueAutoSave()
    }

    private updateToolContextLayer(): void {
        this.applyLayerToTool(this.activeTool)
        this.toolContext.tileSize = this.getTileSize()
    }

    private applyLayerToTool(tool: Tool): void {
        const layerTool = tool as Tool & LayerAwareTool
        if (typeof layerTool.setLayer === 'function') {
            layerTool.setLayer(this.activeLayer)
        }
    }

    private syncViewport(): void {
        this.viewport.zoom = this.camera.zoom
        this.viewport.panX = this.camera.panX
        this.viewport.panY = this.camera.panY
        this.emit({ type: 'viewport-changed', viewport: this.viewport })
    }

    private updateMouseWorld(e: MouseEvent): void {
        this.lastMouseWorld = this.camera.screenToWorld(e.clientX, e.clientY)
        this.toolContext.lastMouseWorld = this.lastMouseWorld
    }

    private worldToTile(worldX: number, worldY: number): { x: number; y: number } {
        const layer = this.activeLayer
        const gridSize = this.getTileSize()
        if (!layer) {
            return { x: Math.floor(worldX / gridSize), y: Math.floor(worldY / gridSize) }
        }
        const localX = worldX - layer.__pxTotalOffsetX
        const localY = worldY - layer.__pxTotalOffsetY
        return {
            x: Math.floor(localX / gridSize),
            y: Math.floor(localY / gridSize),
        }
    }

    private getTileSize(): number {
        return this.activeLayer?.__gridSize ?? this.project.defaultGridSize ?? 1
    }

    private getActiveToolLayer(): ToolLayer | null {
        const layer = this.activeLayer
        if (!layer) return null
        const width = layer.__cWid
        const height = layer.__cHei

        switch (layer.__type) {
            case 'Tiles':
            case 'AutoLayer': {
                const data = buildTileData(layer, width, height)
                return {
                    type: 'tilelayer',
                    width,
                    height,
                    data,
                }
            }
            case 'IntGrid':
                return {
                    type: 'intgrid',
                    width,
                    height,
                    intGrid: [...layer.intGridCsv],
                }
            case 'Entities':
                return {
                    type: 'objectgroup',
                    width,
                    height,
                    objects: layer.entityInstances.map((entity) => ({
                        id: entity.iid,
                        x: entity.__worldX ?? entity.px[0],
                        y: entity.__worldY ?? entity.px[1],
                        width: entity.width,
                        height: entity.height,
                    })),
                }
            default:
                return null
        }
    }

    private getSelectionWorldRect(): Rect | null {
        if (this.selectionProvider) {
            return this.selectionProvider.getSelection()
        }
        const tool = this.activeTool as Tool & SelectionProvider
        if (typeof tool.getSelection === 'function') {
            return tool.getSelection()
        }
        return null
    }

    private getSelectionGridRect(): GridRect | null {
        const layer = this.activeLayer
        const selection = this.getSelectionWorldRect()
        if (!layer || !selection) return null
        if (selection.width <= 0 || selection.height <= 0) return null

        const gridSize = this.getTileSize()
        const offsetX = layer.__pxTotalOffsetX
        const offsetY = layer.__pxTotalOffsetY

        const startX = Math.floor((selection.x - offsetX) / gridSize)
        const startY = Math.floor((selection.y - offsetY) / gridSize)
        const endX = Math.ceil((selection.x + selection.width - offsetX) / gridSize)
        const endY = Math.ceil((selection.y + selection.height - offsetY) / gridSize)

        const clampedStartX = clamp(startX, 0, layer.__cWid)
        const clampedStartY = clamp(startY, 0, layer.__cHei)
        const clampedEndX = clamp(endX, 0, layer.__cWid)
        const clampedEndY = clamp(endY, 0, layer.__cHei)

        const width = Math.max(0, clampedEndX - clampedStartX)
        const height = Math.max(0, clampedEndY - clampedStartY)

        if (width === 0 || height === 0) return null

        return {
            x: clampedStartX,
            y: clampedStartY,
            width,
            height,
        }
    }

    private captureClipboard(): ClipboardPayload {
        const layer = this.activeLayer
        if (!layer) {
            throw new Error('No active layer to copy')
        }

        if (layer.__type === 'Entities') {
            const selection = this.getSelectionWorldRect()
            if (!selection) {
                throw new Error('No selection to copy entities')
            }
            const entities = captureEntities(layer, selection)
            if (entities.length === 0) {
                throw new Error('Selection contains no entities')
            }
            return {
                type: 'entities',
                layerIid: layer.iid,
                rect: selection,
                origin: { x: selection.x, y: selection.y },
                entities,
            }
        }

        const selection = this.getSelectionGridRect()
        if (!selection) {
            throw new Error('No selection to copy')
        }

        if (layer.__type === 'IntGrid') {
            return {
                type: 'intgrid',
                layerIid: layer.iid,
                rect: selection,
                values: captureIntGrid(layer, selection),
            }
        }

        if (layer.__type === 'Tiles' || layer.__type === 'AutoLayer') {
            return {
                type: 'tiles',
                layerIid: layer.iid,
                rect: selection,
                tiles: captureTiles(layer, selection),
            }
        }

        throw new Error(`Unsupported layer type for clipboard: ${layer.__type}`)
    }

    private createCutEdit(clipboard: ClipboardPayload): Edit {
        const layerIid = clipboard.layerIid

        if (clipboard.type === 'tiles') {
            const before = clipboard.tiles
            const after = createEmptyGrid(clipboard.rect.width, clipboard.rect.height)
            return {
                label: 'Cut tiles',
                timestamp: Date.now(),
                apply: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for cut: ${layerIid}`)
                    applyTiles(layer, clipboard.rect, after)
                },
                revert: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for undo cut: ${layerIid}`)
                    applyTiles(layer, clipboard.rect, before)
                },
            }
        }

        if (clipboard.type === 'intgrid') {
            const before = clipboard.values
            const after = createEmptyGrid(clipboard.rect.width, clipboard.rect.height)
            return {
                label: 'Cut intgrid',
                timestamp: Date.now(),
                apply: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for cut: ${layerIid}`)
                    applyIntGrid(layer, clipboard.rect, after)
                },
                revert: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for undo cut: ${layerIid}`)
                    applyIntGrid(layer, clipboard.rect, before)
                },
            }
        }

        if (clipboard.type === 'entities') {
            const before = cloneEntities(clipboard.entities)
            return {
                label: 'Cut entities',
                timestamp: Date.now(),
                apply: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for cut: ${layerIid}`)
                    layer.entityInstances = layer.entityInstances.filter(
                        (entity) => !before.some((entry) => entry.iid === entity.iid)
                    )
                },
                revert: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for undo cut: ${layerIid}`)
                    const remaining = layer.entityInstances.filter(
                        (entity) => !before.some((entry) => entry.iid === entity.iid)
                    )
                    layer.entityInstances = [...remaining, ...cloneEntities(before)]
                },
            }
        }

        throw new Error('Unsupported clipboard type for cut')
    }

    private createPasteEdit(clipboard: ClipboardPayload): Edit {
        const layerIid = clipboard.layerIid
        const target = this.getPasteTarget(clipboard)

        if (clipboard.type === 'tiles') {
            const before = captureTilesAtTarget(this, layerIid, target, clipboard.rect)
            const after = clipboard.tiles
            return {
                label: 'Paste tiles',
                timestamp: Date.now(),
                apply: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for paste: ${layerIid}`)
                    applyTiles(layer, target, after)
                },
                revert: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for undo paste: ${layerIid}`)
                    applyTiles(layer, target, before)
                },
            }
        }

        if (clipboard.type === 'intgrid') {
            const before = captureIntGridAtTarget(this, layerIid, target, clipboard.rect)
            const after = clipboard.values
            return {
                label: 'Paste intgrid',
                timestamp: Date.now(),
                apply: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for paste: ${layerIid}`)
                    applyIntGrid(layer, target, after)
                },
                revert: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for undo paste: ${layerIid}`)
                    applyIntGrid(layer, target, before)
                },
            }
        }

        if (clipboard.type === 'entities') {
            const after = buildPastedEntities(this, clipboard, target)
            return {
                label: 'Paste entities',
                timestamp: Date.now(),
                apply: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for paste: ${layerIid}`)
                    layer.entityInstances = [
                        ...layer.entityInstances,
                        ...cloneEntities(after),
                    ]
                },
                revert: (project) => {
                    const layer = findLayerByIid(project, layerIid)
                    if (!layer) throw new Error(`Layer not found for undo paste: ${layerIid}`)
                    layer.entityInstances = layer.entityInstances.filter(
                        (entity) => !after.some((entry) => entry.iid === entity.iid)
                    )
                },
            }
        }

        throw new Error('Unsupported clipboard type for paste')
    }

    private getPasteTarget(clipboard: ClipboardPayload): GridRect {
        if (clipboard.type === 'entities') {
            const selection = this.getSelectionWorldRect()
            const targetWorld = selection ?? this.lastMouseWorld
            if (!targetWorld) {
                return {
                    x: clipboard.rect.x,
                    y: clipboard.rect.y,
                    width: clipboard.rect.width,
                    height: clipboard.rect.height,
                }
            }
            return {
                x: targetWorld.x,
                y: targetWorld.y,
                width: clipboard.rect.width,
                height: clipboard.rect.height,
            }
        }

        const selection = this.getSelectionGridRect()
        if (selection) {
            return {
                x: selection.x,
                y: selection.y,
                width: clipboard.rect.width,
                height: clipboard.rect.height,
            }
        }

        const world = this.lastMouseWorld
        if (world) {
            const grid = this.worldToTile(world.x, world.y)
            return {
                x: grid.x,
                y: grid.y,
                width: clipboard.rect.width,
                height: clipboard.rect.height,
            }
        }

        return {
            x: clipboard.rect.x,
            y: clipboard.rect.y,
            width: clipboard.rect.width,
            height: clipboard.rect.height,
        }
    }

    private setClipboard(payload: ClipboardPayload | null): void {
        this.clipboardPayload = payload
        this.emit({ type: 'clipboard-changed', clipboard: payload })
    }

    private queueAutoSave(): void {
        if (!this.autoSaveOptions?.onSave) return
        if (this.autoSaveOptions.enabled === false) return

        this.autoSavePending = true
        if (this.autoSaveTimer) return

        const delay = this.autoSaveOptions.intervalMs ?? DEFAULT_AUTOSAVE_MS
        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveTimer = null
            void this.runAutoSave()
        }, delay)
    }

    private async runAutoSave(): Promise<void> {
        if (!this.autoSaveOptions?.onSave) return
        if (this.autoSaveRunning || !this.autoSavePending) return

        this.autoSavePending = false
        this.autoSaveRunning = true

        try {
            await this.autoSaveOptions.onSave(this.project)
            this.emit({ type: 'autosave-success' })
        } catch (error) {
            this.emit({ type: 'autosave-error', error })
        } finally {
            this.autoSaveRunning = false
            if (this.autoSavePending) {
                this.queueAutoSave()
            }
        }
    }

    private clearAutoSaveTimer(): void {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer)
            this.autoSaveTimer = null
        }
    }

    private renderLevel(ctx: CanvasRenderingContext2D, level: Level): void {
        const bgColor = level.bgColor ?? this.project.defaultLevelBgColor
        ctx.save()
        ctx.fillStyle = toCssColor(bgColor)
        ctx.fillRect(level.worldX, level.worldY, level.pxWid, level.pxHei)
        ctx.restore()

        for (const layer of level.layerInstances) {
            if (!layer.visible) continue
            this.renderLayer(ctx, layer)
        }

        ctx.save()
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.lineWidth = 2 / this.camera.zoom
        ctx.strokeRect(level.worldX, level.worldY, level.pxWid, level.pxHei)
        ctx.restore()
    }

    private renderLayer(ctx: CanvasRenderingContext2D, layer: LayerInstance): void {
        switch (layer.__type) {
            case 'Tiles':
            case 'AutoLayer':
                this.renderTileLayer(ctx, layer)
                break
            case 'IntGrid':
                this.renderIntGridLayer(ctx, layer)
                break
            case 'Entities':
                this.renderEntityLayer(ctx, layer)
                break
            default:
                break
        }
    }

    private renderTileLayer(ctx: CanvasRenderingContext2D, layer: LayerInstance): void {
        const tiles = layer.__type === 'AutoLayer' ? layer.autoLayerTiles : layer.gridTiles
        const gridSize = layer.__gridSize || 1

        ctx.save()
        ctx.globalAlpha = layer.__opacity ?? 1
        for (const tile of tiles) {
            const x = tile.px[0] + layer.__pxTotalOffsetX
            const y = tile.px[1] + layer.__pxTotalOffsetY
            ctx.fillStyle = tileColor(tile.t)
            ctx.fillRect(x, y, gridSize, gridSize)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
            ctx.lineWidth = 1 / this.camera.zoom
            ctx.strokeRect(x, y, gridSize, gridSize)
        }
        ctx.restore()
    }

    private renderIntGridLayer(ctx: CanvasRenderingContext2D, layer: LayerInstance): void {
        const gridSize = layer.__gridSize || 1
        ctx.save()
        ctx.globalAlpha = layer.__opacity ?? 1
        for (let y = 0; y < layer.__cHei; y++) {
            for (let x = 0; x < layer.__cWid; x++) {
                const value = getIntGridValue(layer, x, y)
                if (value === 0) continue
                const px = x * gridSize + layer.__pxTotalOffsetX
                const py = y * gridSize + layer.__pxTotalOffsetY
                ctx.fillStyle = intGridColor(value)
                ctx.fillRect(px, py, gridSize, gridSize)
            }
        }
        ctx.restore()
    }

    private renderEntityLayer(ctx: CanvasRenderingContext2D, layer: LayerInstance): void {
        ctx.save()
        ctx.globalAlpha = layer.__opacity ?? 1
        for (const entity of layer.entityInstances) {
            const x = entity.__worldX ?? entity.px[0]
            const y = entity.__worldY ?? entity.px[1]
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)'
            ctx.lineWidth = 2 / this.camera.zoom
            ctx.strokeRect(x, y, entity.width, entity.height)
        }
        ctx.restore()
    }
}

function isRenderableTool(tool: Tool): tool is Tool & RenderableTool {
    return typeof (tool as { render?: unknown }).render === 'function'
}

function isKeyAwareTool(tool: Tool): tool is Tool & KeyAwareTool {
    return typeof (tool as { onKeyDown?: unknown }).onKeyDown === 'function'
}

function toCssColor(value: number | string | null | undefined): string {
    if (typeof value === 'string') {
        return value
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '#000000'
    }
    return `#${value.toString(16).padStart(6, '0')}`
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

function tileColor(tileId: number): string {
    const hue = Math.abs(tileId * 47) % 360
    return `hsl(${hue}, 65%, 55%)`
}

function intGridColor(value: number): string {
    const hue = Math.abs(value * 37) % 360
    return `hsl(${hue}, 45%, 45%)`
}

function buildTileData(layer: LayerInstance, width: number, height: number): number[] {
    const data = new Array(width * height).fill(0)
    const gridSize = layer.__gridSize || 1
    for (const tile of layer.gridTiles) {
        const gx = Math.round(tile.px[0] / gridSize)
        const gy = Math.round(tile.px[1] / gridSize)
        if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue
        data[gy * width + gx] = tile.t
    }
    return data
}

function captureTiles(layer: LayerInstance, rect: GridRect): number[][] {
    const gridSize = layer.__gridSize || 1
    const tileMap = new Map<string, TileInstance>()
    for (const tile of layer.gridTiles) {
        tileMap.set(`${tile.px[0]}:${tile.px[1]}`, tile)
    }

    const rows: number[][] = []
    for (let y = 0; y < rect.height; y++) {
        const row: number[] = []
        for (let x = 0; x < rect.width; x++) {
            const pxX = (rect.x + x) * gridSize
            const pxY = (rect.y + y) * gridSize
            row.push(tileMap.get(`${pxX}:${pxY}`)?.t ?? 0)
        }
        rows.push(row)
    }
    return rows
}

function captureTilesAtTarget(
    editor: Editor,
    layerIid: string,
    target: GridRect,
    rect: GridRect
): number[][] {
    const layer = findLayerByIid(editor.project, layerIid)
    if (!layer) {
        throw new Error(`Layer not found for paste target: ${layerIid}`)
    }
    return captureTiles(layer, { x: target.x, y: target.y, width: rect.width, height: rect.height })
}

function applyTiles(layer: LayerInstance, rect: GridRect, tiles: number[][]): void {
    for (let y = 0; y < rect.height; y++) {
        for (let x = 0; x < rect.width; x++) {
            const tileId = tiles[y]?.[x] ?? 0
            setTileAt(layer, rect.x + x, rect.y + y, tileId)
        }
    }
}

function setTileAt(layer: LayerInstance, gridX: number, gridY: number, tileId: number): void {
    const gridSize = layer.__gridSize || 1
    if (gridX < 0 || gridY < 0 || gridX >= layer.__cWid || gridY >= layer.__cHei) return

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

    const tile: TileInstance = {
        t: tileId,
        px: [pxX, pxY],
        src: [0, 0],
        f: 0,
        a: 1,
    }

    if (index === -1) {
        layer.gridTiles.push(tile)
    } else {
        layer.gridTiles[index] = tile
    }
}

function captureIntGrid(layer: LayerInstance, rect: GridRect): number[][] {
    const rows: number[][] = []
    for (let y = 0; y < rect.height; y++) {
        const row: number[] = []
        for (let x = 0; x < rect.width; x++) {
            row.push(getIntGridValue(layer, rect.x + x, rect.y + y))
        }
        rows.push(row)
    }
    return rows
}

function captureIntGridAtTarget(
    editor: Editor,
    layerIid: string,
    target: GridRect,
    rect: GridRect
): number[][] {
    const layer = findLayerByIid(editor.project, layerIid)
    if (!layer) {
        throw new Error(`Layer not found for paste target: ${layerIid}`)
    }
    return captureIntGrid(layer, { x: target.x, y: target.y, width: rect.width, height: rect.height })
}

function applyIntGrid(layer: LayerInstance, rect: GridRect, values: number[][]): void {
    for (let y = 0; y < rect.height; y++) {
        for (let x = 0; x < rect.width; x++) {
            setIntGridValue(layer, rect.x + x, rect.y + y, values[y]?.[x] ?? 0)
        }
    }
}

function captureEntities(layer: LayerInstance, rect: Rect): EntityInstance[] {
    return layer.entityInstances
        .filter((entity) => rectContainsEntity(rect, entity))
        .map((entity) => cloneEntity(entity))
}

function buildPastedEntities(
    editor: Editor,
    clipboard: Extract<ClipboardPayload, { type: 'entities' }>,
    target: GridRect
): EntityInstance[] {
    const layer = findLayerByIid(editor.project, clipboard.layerIid)
    if (!layer) {
        throw new Error(`Layer not found for entity paste: ${clipboard.layerIid}`)
    }
    const origin = clipboard.origin
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const gridSize = layer.__gridSize || editor.project.defaultGridSize || 1

    return clipboard.entities.map((entity) => {
        const clone = cloneEntity(entity)
        clone.iid = generateIid()
        clone.px = [clone.px[0] + dx, clone.px[1] + dy]
        clone.__worldX = (clone.__worldX ?? clone.px[0]) + dx
        clone.__worldY = (clone.__worldY ?? clone.px[1]) + dy
        clone.__grid = [
            Math.floor(clone.px[0] / gridSize),
            Math.floor(clone.px[1] / gridSize),
        ]
        return clone
    })
}

function rectContainsEntity(rect: Rect, entity: EntityInstance): boolean {
    const ex = entity.__worldX ?? entity.px[0]
    const ey = entity.__worldY ?? entity.px[1]
    const ew = entity.width
    const eh = entity.height
    return (
        ex >= rect.x &&
        ey >= rect.y &&
        ex + ew <= rect.x + rect.width &&
        ey + eh <= rect.y + rect.height
    )
}

function createEmptyGrid(width: number, height: number): number[][] {
    const rows: number[][] = []
    for (let y = 0; y < height; y++) {
        rows.push(new Array(width).fill(0))
    }
    return rows
}

function cloneEntities(entities: EntityInstance[]): EntityInstance[] {
    return entities.map((entity) => cloneEntity(entity))
}

function cloneEntity(entity: EntityInstance): EntityInstance {
    return {
        ...entity,
        __grid: [...entity.__grid],
        __pivot: [...entity.__pivot],
        __tags: [...entity.__tags],
        __tile: entity.__tile ? { ...entity.__tile } : null,
        px: [...entity.px],
        fieldInstances: cloneFields(entity.fieldInstances),
    }
}

function cloneFields(fields: FieldInstance[]): FieldInstance[] {
    return fields.map((field) => ({
        ...field,
        __tile: field.__tile ? { ...field.__tile } : null,
        realEditorValues: field.realEditorValues ? [...field.realEditorValues] : [],
    }))
}

function findLayerByIid(project: LDtkProject, layerIid: string): LayerInstance | null {
    for (const level of getAllLevels(project)) {
        const layer = level.layerInstances.find((entry) => entry.iid === layerIid)
        if (layer) return layer
    }
    return null
}

function generateIid(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID()
    }
    return `iid_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}
