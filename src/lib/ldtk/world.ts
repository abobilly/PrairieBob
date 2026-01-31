/**
 * LDtk World - Container for levels with layout
 * Ported from LDtk/src/electron.renderer/data/World.hx
 */

import type { WorldLayout } from './types'
import type { Level } from './level'

// ============== World ==============

export interface World {
    /** Instance unique identifier */
    iid: string
    /** User-defined identifier */
    identifier: string
    /** Levels in this world */
    levels: Level[]
    /** Default level width for new levels */
    defaultLevelWidth: number
    /** Default level height for new levels */
    defaultLevelHeight: number
    /** World grid size (for GridVania layout) */
    worldGridWidth: number
    worldGridHeight: number
    /** World layout mode */
    worldLayout: WorldLayout
}

// ============== World Creation ==============

const DEFAULT_LEVEL_SIZE = 256

export function createWorld(params: {
    iid: string
    identifier: string
    layout?: WorldLayout
    defaultLevelWidth?: number
    defaultLevelHeight?: number
}): World {
    const w = params.defaultLevelWidth ?? DEFAULT_LEVEL_SIZE
    const h = params.defaultLevelHeight ?? DEFAULT_LEVEL_SIZE

    return {
        iid: params.iid,
        identifier: params.identifier,
        levels: [],
        defaultLevelWidth: w,
        defaultLevelHeight: h,
        worldGridWidth: w,
        worldGridHeight: h,
        worldLayout: params.layout ?? 'Free',
    }
}

// ============== World Helpers ==============

/**
 * Get world bounds (union of all levels)
 */
export function getWorldBounds(world: World): {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
} {
    if (world.levels.length === 0) {
        return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }
    }

    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity

    for (const level of world.levels) {
        left = Math.min(left, level.worldX)
        right = Math.max(right, level.worldX + level.pxWid)
        top = Math.min(top, level.worldY)
        bottom = Math.max(bottom, level.worldY + level.pxHei)
    }

    return {
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
    }
}

/**
 * Get level at world position
 */
export function getLevelAtWorldPos(
    world: World,
    worldX: number,
    worldY: number,
    worldDepth?: number
): Level | undefined {
    return world.levels.find((level) => {
        if (worldDepth !== undefined && level.worldDepth !== worldDepth) {
            return false
        }
        return (
            worldX >= level.worldX &&
            worldX < level.worldX + level.pxWid &&
            worldY >= level.worldY &&
            worldY < level.worldY + level.pxHei
        )
    })
}

/**
 * Get level by IID
 */
export function getWorldLevelByIid(world: World, iid: string): Level | undefined {
    return world.levels.find((l) => l.iid === iid)
}

/**
 * Get level by UID
 */
export function getWorldLevelByUid(world: World, uid: number): Level | undefined {
    return world.levels.find((l) => l.uid === uid)
}

/**
 * Get level by identifier
 */
export function getWorldLevelByIdentifier(
    world: World,
    identifier: string
): Level | undefined {
    return world.levels.find((l) => l.identifier === identifier)
}

/**
 * Get levels at a specific depth
 */
export function getLevelsAtDepth(world: World, depth: number): Level[] {
    return world.levels.filter((l) => l.worldDepth === depth)
}

/**
 * Get all unique world depths
 */
export function getWorldDepths(world: World): number[] {
    const depths = new Set(world.levels.map((l) => l.worldDepth))
    return Array.from(depths).sort((a, b) => a - b)
}

/**
 * Check if two levels overlap
 */
export function levelsOverlap(a: Level, b: Level): boolean {
    return !(
        a.worldX >= b.worldX + b.pxWid ||
        a.worldX + a.pxWid <= b.worldX ||
        a.worldY >= b.worldY + b.pxHei ||
        a.worldY + a.pxHei <= b.worldY
    )
}

/**
 * Get levels that overlap with a given level
 */
export function getOverlappingLevels(world: World, level: Level): Level[] {
    return world.levels.filter(
        (other) => other !== level && levelsOverlap(level, other)
    )
}

/**
 * Arrange levels in linear layout
 */
export function arrangeLinearHorizontal(world: World, spacing = 0): void {
    let x = 0
    for (const level of world.levels) {
        level.worldX = x
        level.worldY = 0
        x += level.pxWid + spacing
    }
}

export function arrangeLinearVertical(world: World, spacing = 0): void {
    let y = 0
    for (const level of world.levels) {
        level.worldX = 0
        level.worldY = y
        y += level.pxHei + spacing
    }
}
