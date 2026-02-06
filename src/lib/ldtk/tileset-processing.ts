/**
 * LDtk Tileset Processing
 * Canvas-based import/export utilities for tilesets.
 */

import type { TilesetDef } from './types'

export const DEFAULT_TILE_GRID_SIZES = [8, 16, 24, 32, 48, 64]
const DEFAULT_MAX_SPACING = 4
const DEFAULT_MAX_PADDING = 4

export interface TilesetGridSpec {
    tileGridSize: number
    spacing: number
    padding: number
    margin: number
    columns: number
    rows: number
    tileCount: number
}

export interface TilesetGridDetectionOptions {
    tileGridSize?: number
    spacing?: number
    padding?: number
    margin?: number
    commonGridSizes?: number[]
    maxSpacing?: number
    maxPadding?: number
}

export interface TilesetImageSource {
    image: HTMLImageElement
    canvas: HTMLCanvasElement
    width: number
    height: number
    sourcePath: string | null
}

export interface TilesetImportParams {
    uid: number
    identifier: string
    sourcePath: string
    relPath?: string | null
    embedAtlas?: string | null
    options?: TilesetGridDetectionOptions
    readFileBase64?: (path: string) => Promise<string>
}

export interface TilesetImportResult {
    tilesetDef: TilesetDef
    grid: TilesetGridSpec
    sourceCanvas: HTMLCanvasElement
    tiles: HTMLCanvasElement[]
}

export interface TilesetAtlasMetadata {
    tilesetUid: number
    identifier: string
    relPath: string | null
    tileGridSize: number
    spacing: number
    padding: number
    columns: number
    rows: number
    tileCount: number
    atlasWidth: number
    atlasHeight: number
    tiles: Array<{ id: number; x: number; y: number; w: number; h: number }>
}

export interface TilesetAtlasExport {
    canvas: HTMLCanvasElement
    base64: string
    metadata: TilesetAtlasMetadata
}

export interface TilesetAtlasOptions {
    columns?: number
    spacing?: number
    padding?: number
    margin?: number
}

export async function loadTilesetImageFromPath(params: {
    sourcePath: string
    readFileBase64?: (path: string) => Promise<string>
}): Promise<TilesetImageSource> {
    const readFileBase64 = params.readFileBase64 ?? window.electron?.fs.readFileBase64
    if (!readFileBase64) {
        throw new Error('File loading is not available in this environment.')
    }

    const base64Data = await readFileBase64(params.sourcePath)
    return loadTilesetImageFromBase64(base64Data, params.sourcePath)
}

export function loadTilesetImageFromBase64(
    base64Data: string,
    sourcePath: string | null
): Promise<TilesetImageSource> {
    return new Promise((resolve, reject) => {
        const img = new Image()

        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Failed to create tileset canvas context.'))
                return
            }
            ctx.drawImage(img, 0, 0)
            resolve({
                image: img,
                canvas,
                width: img.width,
                height: img.height,
                sourcePath,
            })
        }

        img.onerror = () => {
            reject(new Error('Failed to load tileset image.'))
        }

        img.src = `data:image/png;base64,${base64Data}`
    })
}

export function detectTilesetGrid(
    imageWidth: number,
    imageHeight: number,
    options: TilesetGridDetectionOptions = {}
): TilesetGridSpec {
    if (imageWidth <= 0 || imageHeight <= 0) {
        throw new Error('Tileset image dimensions must be positive.')
    }

    const paddingSpecified = options.padding !== undefined || options.margin !== undefined
    const paddingValue = paddingSpecified ? resolvePadding(options) : undefined
    const spacingCandidates = resolveCandidates(options.spacing, options.maxSpacing ?? DEFAULT_MAX_SPACING)
    const paddingCandidates = resolveCandidates(paddingValue, options.maxPadding ?? DEFAULT_MAX_PADDING)
    const gridSizeCandidates = resolveGridSizes(imageWidth, imageHeight, options)

    let best: TilesetGridSpec | null = null

    for (const tileGridSize of gridSizeCandidates) {
        if (tileGridSize <= 0) continue

        for (const spacing of spacingCandidates) {
            if (spacing < 0) continue

            for (const paddingValue of paddingCandidates) {
                if (paddingValue < 0) continue

                const grid = computeGrid(imageWidth, imageHeight, tileGridSize, spacing, paddingValue)
                if (!grid) continue

                const spec: TilesetGridSpec = {
                    tileGridSize,
                    spacing,
                    padding: paddingValue,
                    margin: paddingValue,
                    columns: grid.columns,
                    rows: grid.rows,
                    tileCount: grid.columns * grid.rows,
                }

                if (!best) {
                    best = spec
                    continue
                }

                const bestCost = best.spacing + best.padding
                const nextCost = spec.spacing + spec.padding

                if (spec.tileCount > best.tileCount) {
                    best = spec
                } else if (spec.tileCount === best.tileCount && nextCost < bestCost) {
                    best = spec
                } else if (spec.tileCount === best.tileCount && nextCost === bestCost && spec.tileGridSize > best.tileGridSize) {
                    best = spec
                }
            }
        }
    }

    if (!best) {
        throw new Error('Unable to detect a valid tileset grid for the provided image.')
    }

    return best
}

export function validateTilesetDimensions(
    imageWidth: number,
    imageHeight: number,
    grid: TilesetGridSpec
): void {
    const computed = computeGrid(imageWidth, imageHeight, grid.tileGridSize, grid.spacing, grid.padding)
    if (!computed) {
        throw new Error(
            `Tileset dimensions (${imageWidth}x${imageHeight}) do not match grid ` +
            `(${grid.tileGridSize}px tiles, spacing ${grid.spacing}, padding ${grid.padding}).`
        )
    }
}

export function sliceTileset(
    source: HTMLCanvasElement | HTMLImageElement,
    grid: TilesetGridSpec
): HTMLCanvasElement[] {
    const canvas = ensureCanvas(source)
    validateTilesetDimensions(canvas.width, canvas.height, grid)

    const tiles: HTMLCanvasElement[] = []
    const tileSize = grid.tileGridSize

    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.columns; col++) {
            const sx = grid.padding + col * (tileSize + grid.spacing)
            const sy = grid.padding + row * (tileSize + grid.spacing)

            const tileCanvas = document.createElement('canvas')
            tileCanvas.width = tileSize
            tileCanvas.height = tileSize
            const ctx = tileCanvas.getContext('2d')
            if (!ctx) {
                throw new Error('Failed to create tile canvas context.')
            }

            ctx.drawImage(canvas, sx, sy, tileSize, tileSize, 0, 0, tileSize, tileSize)
            tiles.push(tileCanvas)
        }
    }

    return tiles
}

export async function importTilesetFromPath(params: TilesetImportParams): Promise<TilesetImportResult> {
    const image = await loadTilesetImageFromPath({
        sourcePath: params.sourcePath,
        readFileBase64: params.readFileBase64,
    })

    const grid = detectTilesetGrid(image.width, image.height, params.options)
    validateTilesetDimensions(image.width, image.height, grid)

    const tiles = sliceTileset(image.canvas, grid)
    const tilesetDef = createTilesetDef({
        uid: params.uid,
        identifier: params.identifier,
        relPath: params.relPath ?? null,
        embedAtlas: params.embedAtlas ?? null,
        imageWidth: image.width,
        imageHeight: image.height,
        grid,
    })

    return {
        tilesetDef,
        grid,
        sourceCanvas: image.canvas,
        tiles,
    }
}

export function createTilesetDef(params: {
    uid: number
    identifier: string
    relPath: string | null
    embedAtlas: string | null
    imageWidth: number
    imageHeight: number
    grid: TilesetGridSpec
}): TilesetDef {
    return {
        uid: params.uid,
        identifier: params.identifier,
        relPath: params.relPath,
        embedAtlas: params.embedAtlas,
        pxWid: params.imageWidth,
        pxHei: params.imageHeight,
        tileGridSize: params.grid.tileGridSize,
        spacing: params.grid.spacing,
        padding: params.grid.padding,
        tags: [],
        tagsSourceEnumUid: null,
        enumTags: [],
        customData: [],
        savedSelections: [],
        cWid: params.grid.columns,
        cHei: params.grid.rows,
    }
}

export function getTilesetGridFromDef(tilesetDef: TilesetDef): TilesetGridSpec {
    const tileCount = tilesetDef.cWid * tilesetDef.cHei
    return {
        tileGridSize: tilesetDef.tileGridSize,
        spacing: tilesetDef.spacing,
        padding: tilesetDef.padding,
        margin: tilesetDef.padding,
        columns: tilesetDef.cWid,
        rows: tilesetDef.cHei,
        tileCount,
    }
}

export function createTilesetAtlas(
    tilesetDef: TilesetDef,
    tiles: HTMLCanvasElement[],
    options: TilesetAtlasOptions = {}
): TilesetAtlasExport {
    const grid = getTilesetGridFromDef(tilesetDef)
    const paddingSpecified = options.padding !== undefined || options.margin !== undefined
    const padding = paddingSpecified ? resolvePadding(options) : grid.padding
    const spacing = options.spacing ?? grid.spacing
    const columns = options.columns ?? grid.columns
    const tileSize = grid.tileGridSize

    if (columns <= 0) {
        throw new Error('Atlas columns must be greater than zero.')
    }

    const tileCount = tiles.length
    const rows = Math.ceil(tileCount / columns)
    const atlasWidth = padding * 2 + columns * tileSize + Math.max(columns - 1, 0) * spacing
    const atlasHeight = padding * 2 + rows * tileSize + Math.max(rows - 1, 0) * spacing

    const atlasCanvas = document.createElement('canvas')
    atlasCanvas.width = atlasWidth
    atlasCanvas.height = atlasHeight
    const ctx = atlasCanvas.getContext('2d')
    if (!ctx) {
        throw new Error('Failed to create atlas canvas context.')
    }

    const tilesMetadata: TilesetAtlasMetadata['tiles'] = []

    tiles.forEach((tile, index) => {
        if (tile.width !== tileSize || tile.height !== tileSize) {
            throw new Error(`Tile ${index} does not match expected size ${tileSize}px.`)
        }

        const col = index % columns
        const row = Math.floor(index / columns)
        const dx = padding + col * (tileSize + spacing)
        const dy = padding + row * (tileSize + spacing)

        ctx.drawImage(tile, dx, dy)

        tilesMetadata.push({
            id: index,
            x: dx,
            y: dy,
            w: tileSize,
            h: tileSize,
        })
    })

    const dataUrl = atlasCanvas.toDataURL('image/png')
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')

    return {
        canvas: atlasCanvas,
        base64,
        metadata: {
            tilesetUid: tilesetDef.uid,
            identifier: tilesetDef.identifier,
            relPath: tilesetDef.relPath,
            tileGridSize: tileSize,
            spacing,
            padding,
            columns,
            rows,
            tileCount,
            atlasWidth,
            atlasHeight,
            tiles: tilesMetadata,
        },
    }
}

export async function writeTilesetAtlas(params: {
    atlas: TilesetAtlasExport
    pngPath: string
    metadataPath: string
    writeFileBase64?: (path: string, base64: string) => Promise<boolean>
    writeFile?: (path: string, content: string) => Promise<void>
}): Promise<void> {
    const writeFileBase64 = params.writeFileBase64 ?? window.electron?.fs.writeFileBase64
    const writeFile = params.writeFile ?? window.electron?.fs.writeFile

    if (!writeFileBase64 || !writeFile) {
        throw new Error('File writing is not available in this environment.')
    }

    const wrote = await writeFileBase64(params.pngPath, params.atlas.base64)
    if (!wrote) {
        throw new Error('Failed to write atlas PNG.')
    }

    await writeFile(params.metadataPath, JSON.stringify(params.atlas.metadata, null, 2))
}

function resolvePadding(options: { padding?: number; margin?: number }): number {
    if (options.padding !== undefined && options.margin !== undefined && options.padding !== options.margin) {
        throw new Error('Padding and margin must match when both are provided.')
    }
    return options.padding ?? options.margin ?? 0
}

function resolveCandidates(value: number | undefined, max: number): number[] {
    if (value !== undefined) {
        return [value]
    }

    const candidates: number[] = []
    for (let i = 0; i <= max; i++) {
        candidates.push(i)
    }
    return candidates
}

function resolveGridSizes(
    imageWidth: number,
    imageHeight: number,
    options: TilesetGridDetectionOptions
): number[] {
    if (options.tileGridSize) {
        return [options.tileGridSize]
    }

    const sizes = options.commonGridSizes?.length ? options.commonGridSizes : DEFAULT_TILE_GRID_SIZES
    const unique = new Set<number>()
    sizes.forEach((size) => {
        if (size > 0 && size <= Math.min(imageWidth, imageHeight)) {
            unique.add(size)
        }
    })

    return Array.from(unique.values())
}

function computeGrid(
    imageWidth: number,
    imageHeight: number,
    tileGridSize: number,
    spacing: number,
    padding: number
): { columns: number; rows: number } | null {
    const availableWidth = imageWidth - padding * 2
    const availableHeight = imageHeight - padding * 2

    if (availableWidth <= 0 || availableHeight <= 0) {
        return null
    }

    const cellSize = tileGridSize + spacing
    if (cellSize <= 0) {
        return null
    }

    const columns = Math.floor((availableWidth + spacing) / cellSize)
    const rows = Math.floor((availableHeight + spacing) / cellSize)

    if (columns <= 0 || rows <= 0) {
        return null
    }

    const requiredWidth = columns * tileGridSize + Math.max(columns - 1, 0) * spacing
    const requiredHeight = rows * tileGridSize + Math.max(rows - 1, 0) * spacing

    if (requiredWidth !== availableWidth || requiredHeight !== availableHeight) {
        return null
    }

    return { columns, rows }
}

function ensureCanvas(source: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
    if (source instanceof HTMLCanvasElement) {
        return source
    }

    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        throw new Error('Failed to create tileset canvas context.')
    }
    ctx.drawImage(source, 0, 0)
    return canvas
}
