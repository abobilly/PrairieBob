/**
 * LDtk Layer Instance - Runtime layer data
 * Ported from LDtk/src/electron.renderer/data/inst/LayerInstance.hx
 */

import type { LayerType, TileRect } from './types'

// ============== Tile Instance ==============

export interface TileInstance {
    /** Tile ID in the tileset */
    t: number
    /** X position in pixels */
    px: [number, number]
    /** Source rect in tileset [x, y] */
    src: [number, number]
    /** Flip bits: bit 0 = flipX, bit 1 = flipY */
    f: number
    /** Alpha (0-1) */
    a: number
}

// ============== Entity Instance ==============

export interface EntityInstance {
    /** Unique identifier */
    iid: string
    /** Entity definition UID */
    defUid: number
    /** Entity identifier (from definition) */
    __identifier: string
    /** Grid position [cx, cy] */
    __grid: [number, number]
    /** Pixel position */
    px: [number, number]
    /** Size in pixels */
    width: number
    height: number
    /** Pivot (0-1) */
    __pivot: [number, number]
    /** World position (computed) */
    __worldX: number
    __worldY: number
    /** Tags from definition */
    __tags: string[]
    /** Tile used for display */
    __tile: TileRect | null
    /** Smart color */
    __smartColor: string
    /** Field instances */
    fieldInstances: FieldInstance[]
}

// ============== Field Instance ==============

export interface FieldInstance {
    /** Field definition UID */
    defUid: number
    /** Field identifier */
    __identifier: string
    /** Field type */
    __type: string
    /** Field value (type depends on field type) */
    __value: unknown
    /** Tile used for display (for Tile fields) */
    __tile: TileRect | null
    /** Real editor values */
    realEditorValues: unknown[]
}

// ============== Layer Instance ==============

export interface LayerInstance {
    /** Unique identifier */
    iid: string
    /** Layer definition UID */
    layerDefUid: number
    /** Layer definition identifier */
    __identifier: string
    /** Layer type */
    __type: LayerType
    /** Level ID this layer belongs to */
    levelId: number
    /** Grid size in pixels */
    __gridSize: number
    /** Opacity (0-1) */
    __opacity: number
    /** Total offset in pixels [x, y] */
    __pxTotalOffsetX: number
    __pxTotalOffsetY: number
    /** Tileset definition UID (for Tiles/AutoLayer) */
    __tilesetDefUid: number | null
    /** Tileset relative path */
    __tilesetRelPath: string | null
    /** Layer pixel dimensions */
    __cWid: number
    __cHei: number
    /** IntGrid values (1D array, row-major) */
    intGridCsv: number[]
    /** Auto-layer tiles */
    autoLayerTiles: TileInstance[]
    /** Manual tiles (for Tiles layer) */
    gridTiles: TileInstance[]
    /** Entity instances (for Entities layer) */
    entityInstances: EntityInstance[]
    /** Seed for auto-layer rules */
    seed: number
    /** Override tileset UID */
    overrideTilesetUid: number | null
    /** Visible flag */
    visible: boolean
    /** Optional rule data (for debugging) */
    optionalRules: number[]
    /** Pixel offset */
    pxOffsetX: number
    pxOffsetY: number
}

// ============== Helper Functions ==============

/**
 * Get IntGrid value at grid position
 */
export function getIntGridValue(
    layer: LayerInstance,
    cx: number,
    cy: number
): number {
    if (cx < 0 || cy < 0 || cx >= layer.__cWid || cy >= layer.__cHei) {
        return 0
    }
    return layer.intGridCsv[cy * layer.__cWid + cx] ?? 0
}

/**
 * Set IntGrid value at grid position
 */
export function setIntGridValue(
    layer: LayerInstance,
    cx: number,
    cy: number,
    value: number
): void {
    if (cx < 0 || cy < 0 || cx >= layer.__cWid || cy >= layer.__cHei) {
        return
    }
    layer.intGridCsv[cy * layer.__cWid + cx] = value
}

/**
 * Create empty IntGrid CSV
 */
export function createEmptyIntGridCsv(width: number, height: number): number[] {
    return new Array(width * height).fill(0)
}

/**
 * Check if tile has X flip
 */
export function hasTileFlipX(tile: TileInstance): boolean {
    return (tile.f & 1) !== 0
}

/**
 * Check if tile has Y flip
 */
export function hasTileFlipY(tile: TileInstance): boolean {
    return (tile.f & 2) !== 0
}

/**
 * Get tile rotation in degrees (0, 90, 180, 270).
 * Stored in bits 2-3 of tile.f: 0=0°, 1=90°, 2=180°, 3=270°
 */
export function getTileRotation(tile: TileInstance): 0 | 90 | 180 | 270 {
    const rotBits = (tile.f >> 2) & 3
    return (rotBits * 90) as 0 | 90 | 180 | 270
}

/**
 * Build the tile.f value from flip and rotation state.
 */
export function buildTileFlags(flipX: boolean, flipY: boolean, rotation: 0 | 90 | 180 | 270 = 0): number {
    let f = 0
    if (flipX) f |= 1
    if (flipY) f |= 2
    f |= ((rotation / 90) & 3) << 2
    return f
}
