/**
 * LDtk Level - Single level/room in a world
 * Ported from LDtk/src/electron.renderer/data/Level.hx
 */

import type { LayerInstance, FieldInstance } from './layer-instance'

// ============== Neighbour Reference ==============

export interface NeighbourLevel {
    /** Level IID */
    levelIid: string
    /** Direction: n, s, e, w, ne, nw, se, sw, o (overlap), > (above), < (below) */
    dir: string
}

// ============== Background Position ==============

export interface LevelBgPos {
    topLeftPx: [number, number]
    scale: [number, number]
    cropRect: [number, number, number, number]
}

// ============== Level ==============

export interface Level {
    /** Unique numeric ID */
    uid: number
    /** Instance unique identifier */
    iid: string
    /** User-defined identifier */
    identifier: string
    /** World X position in pixels */
    worldX: number
    /** World Y position in pixels */
    worldY: number
    /** World depth (for stacked levels) */
    worldDepth: number
    /** Level width in pixels */
    pxWid: number
    /** Level height in pixels */
    pxHei: number
    /** Background color (null = use project default) */
    __bgColor: string
    /** Actual background color (computed) */
    bgColor: number | null
    /** Background image relative path */
    bgRelPath: string | null
    /** Background image position */
    bgPos: LevelBgPos | null
    /** Background pivot X (0-1) */
    bgPivotX: number
    /** Background pivot Y (0-1) */
    bgPivotY: number
    /** External level file path (if externalLevels is enabled) */
    externalRelPath: string | null
    /** Use auto-generated identifier */
    useAutoIdentifier: boolean
    /** Layer instances (bottom to top) */
    layerInstances: LayerInstance[]
    /** Field instances (level custom fields) */
    fieldInstances: FieldInstance[]
    /** Neighbouring levels */
    __neighbours: NeighbourLevel[]
    /** Smart color for quick identification */
    __smartColor: string
}

// ============== Level Creation ==============

export function createLevel(params: {
    uid: number
    iid: string
    identifier: string
    pxWid: number
    pxHei: number
    worldX?: number
    worldY?: number
    worldDepth?: number
}): Level {
    return {
        uid: params.uid,
        iid: params.iid,
        identifier: params.identifier,
        worldX: params.worldX ?? 0,
        worldY: params.worldY ?? 0,
        worldDepth: params.worldDepth ?? 0,
        pxWid: params.pxWid,
        pxHei: params.pxHei,
        __bgColor: '#696a79',
        bgColor: null,
        bgRelPath: null,
        bgPos: null,
        bgPivotX: 0.5,
        bgPivotY: 0.5,
        externalRelPath: null,
        useAutoIdentifier: true,
        layerInstances: [],
        fieldInstances: [],
        __neighbours: [],
        __smartColor: '#696a79',
    }
}

// ============== Level Helpers ==============

/**
 * Get level center in world coordinates
 */
export function getLevelWorldCenter(level: Level): { x: number; y: number } {
    return {
        x: level.worldX + Math.floor(level.pxWid / 2),
        y: level.worldY + Math.floor(level.pxHei / 2),
    }
}

/**
 * Get level bounds in world coordinates
 */
export function getLevelWorldBounds(level: Level): {
    left: number
    right: number
    top: number
    bottom: number
} {
    return {
        left: level.worldX,
        right: level.worldX + level.pxWid,
        top: level.worldY,
        bottom: level.worldY + level.pxHei,
    }
}

/**
 * Check if a world position is inside the level
 */
export function isWorldPosInLevel(
    level: Level,
    worldX: number,
    worldY: number
): boolean {
    return (
        worldX >= level.worldX &&
        worldX < level.worldX + level.pxWid &&
        worldY >= level.worldY &&
        worldY < level.worldY + level.pxHei
    )
}

/**
 * Convert world position to level-local position
 */
export function worldToLevelPos(
    level: Level,
    worldX: number,
    worldY: number
): { x: number; y: number } {
    return {
        x: worldX - level.worldX,
        y: worldY - level.worldY,
    }
}

/**
 * Convert level-local position to world position
 */
export function levelToWorldPos(
    level: Level,
    levelX: number,
    levelY: number
): { x: number; y: number } {
    return {
        x: levelX + level.worldX,
        y: levelY + level.worldY,
    }
}

/**
 * Get layer instance by definition UID
 */
export function getLayerByDefUid(
    level: Level,
    layerDefUid: number
): LayerInstance | undefined {
    return level.layerInstances.find((li) => li.layerDefUid === layerDefUid)
}

/**
 * Get layer instance by identifier
 */
export function getLayerByIdentifier(
    level: Level,
    identifier: string
): LayerInstance | undefined {
    return level.layerInstances.find((li) => li.__identifier === identifier)
}
