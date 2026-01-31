/**
 * LDtk Auto-Layer Rule Engine
 * Ported from LDtk/src/electron.renderer/data/def/AutoLayerRuleDef.hx
 * 
 * This is THE killer feature - automatic tile placement based on IntGrid patterns
 */

import type { AutoLayerRuleDef, AutoLayerRuleCheckerMode } from './types'
import type { LayerInstance, TileInstance } from './layer-instance'
import { getIntGridValue } from './layer-instance'

// ============== Pattern Constants ==============

/** Maximum pattern size (must be odd) */
export const MAX_PATTERN_SIZE = 9

/** Special pattern values */
export const PATTERN_VALUES = {
    /** Match any value */
    ANYTHING: 1000001,
    /** Match nothing (empty) */
    NOTHING: 0,
}

// ============== Rule Creation ==============

export function createAutoLayerRule(params: {
    uid: number
    size?: number
}): AutoLayerRuleDef {
    const size = params.size ?? 3
    if (size < 1 || size > MAX_PATTERN_SIZE || size % 2 === 0) {
        throw new Error(`Invalid rule size: ${size}. Must be odd and between 1-${MAX_PATTERN_SIZE}`)
    }

    return {
        uid: params.uid,
        active: true,
        size,
        pattern: new Array(size * size).fill(0),
        tileRectsIds: [],
        alpha: 1,
        chance: 1,
        breakOnMatch: true,
        flipX: false,
        flipY: false,
        xModulo: 1,
        yModulo: 1,
        xOffset: 0,
        yOffset: 0,
        tileXOffset: 0,
        tileYOffset: 0,
        tileRandomXMin: 0,
        tileRandomXMax: 0,
        tileRandomYMin: 0,
        tileRandomYMax: 0,
        checker: 'None',
        tileMode: 'Single',
        pivotX: 0,
        pivotY: 0,
        outOfBoundsValue: null,
        perlinActive: false,
        perlinSeed: Math.floor(Math.random() * 9999999),
        perlinScale: 0.2,
        perlinOctaves: 2,
        invalidated: false,
    }
}

// ============== Pattern Access ==============

export function getPatternRadius(rule: AutoLayerRuleDef): number {
    return rule.size <= 1 ? 1 : Math.floor(rule.size / 2)
}

export function getPatternValue(
    rule: AutoLayerRuleDef,
    cx: number,
    cy: number
): number {
    if (cx < 0 || cy < 0 || cx >= rule.size || cy >= rule.size) {
        return 0
    }
    return rule.pattern[cy * rule.size + cx]
}

export function setPatternValue(
    rule: AutoLayerRuleDef,
    cx: number,
    cy: number,
    value: number
): void {
    if (cx < 0 || cy < 0 || cx >= rule.size || cy >= rule.size) {
        return
    }
    rule.pattern[cy * rule.size + cx] = value
}

export function fillPattern(rule: AutoLayerRuleDef, value: number): void {
    rule.pattern.fill(value)
}

// ============== Pattern Symmetry ==============

export function isPatternSymmetricX(rule: AutoLayerRuleDef): boolean {
    const halfW = Math.floor(rule.size / 2)
    for (let cy = 0; cy < rule.size; cy++) {
        for (let cx = 0; cx < halfW; cx++) {
            if (getPatternValue(rule, cx, cy) !== getPatternValue(rule, rule.size - 1 - cx, cy)) {
                return false
            }
        }
    }
    return true
}

export function isPatternSymmetricY(rule: AutoLayerRuleDef): boolean {
    const halfH = Math.floor(rule.size / 2)
    for (let cy = 0; cy < halfH; cy++) {
        for (let cx = 0; cx < rule.size; cx++) {
            if (getPatternValue(rule, cx, cy) !== getPatternValue(rule, cx, rule.size - 1 - cy)) {
                return false
            }
        }
    }
    return true
}

// ============== Rule Matching ==============

/**
 * Check if a rule matches at a given position
 */
export function matchesAt(
    rule: AutoLayerRuleDef,
    sourceLayer: LayerInstance,
    cx: number,
    cy: number,
    flipX: boolean,
    flipY: boolean
): boolean {
    const radius = getPatternRadius(rule)

    for (let py = 0; py < rule.size; py++) {
        for (let px = 0; px < rule.size; px++) {
            // Get pattern value (accounting for flips)
            const patternX = flipX ? rule.size - 1 - px : px
            const patternY = flipY ? rule.size - 1 - py : py
            const patternValue = getPatternValue(rule, patternX, patternY)

            // Skip if pattern value is 0 (don't care)
            if (patternValue === 0) continue

            // Get source position
            const sourceX = cx + px - radius
            const sourceY = cy + py - radius

            // Get actual IntGrid value
            let actualValue: number
            if (
                sourceX < 0 ||
                sourceY < 0 ||
                sourceX >= sourceLayer.__cWid ||
                sourceY >= sourceLayer.__cHei
            ) {
                // Out of bounds
                actualValue = rule.outOfBoundsValue ?? 0
            } else {
                actualValue = getIntGridValue(sourceLayer, sourceX, sourceY)
            }

            // Check match
            if (patternValue === PATTERN_VALUES.ANYTHING) {
                // Must be non-zero
                if (actualValue === 0) return false
            } else if (patternValue > 0) {
                // Must match exactly
                if (actualValue !== patternValue) return false
            } else {
                // Negative = must NOT match this value
                if (actualValue === -patternValue) return false
            }
        }
    }

    return true
}

/**
 * Check modulo constraint
 */
export function passesModuloCheck(
    rule: AutoLayerRuleDef,
    cx: number,
    cy: number
): boolean {
    if (rule.xModulo <= 1 && rule.yModulo <= 1) return true

    const xOk = rule.xModulo <= 1 || (cx - rule.xOffset) % rule.xModulo === 0
    const yOk = rule.yModulo <= 1 || (cy - rule.yOffset) % rule.yModulo === 0

    return xOk && yOk
}

/**
 * Check checker pattern constraint
 */
export function passesCheckerCheck(
    rule: AutoLayerRuleDef,
    cx: number,
    cy: number
): boolean {
    if (rule.checker === 'None') return true

    const isOdd = (cx + cy) % 2 === 1

    switch (rule.checker) {
        case 'Horizontal':
            return cx % 2 === 0
        case 'Vertical':
            return cy % 2 === 0
        default:
            return true
    }
}

/**
 * Check chance/probability
 */
export function passesChanceCheck(
    rule: AutoLayerRuleDef,
    seed: number,
    cx: number,
    cy: number
): boolean {
    if (rule.chance >= 1) return true

    // Deterministic random based on position and seed
    const hash = simpleHash(seed, cx, cy)
    return hash < rule.chance
}

/**
 * Simple deterministic hash for consistent randomness
 */
function simpleHash(seed: number, x: number, y: number): number {
    let h = seed
    h = ((h << 5) - h + x) | 0
    h = ((h << 5) - h + y) | 0
    h = Math.abs(h)
    return (h % 10000) / 10000
}

// ============== Rule Application ==============

export interface RuleMatch {
    cx: number
    cy: number
    tileId: number
    flipX: boolean
    flipY: boolean
    alpha: number
}

/**
 * Apply a single rule to generate tile placements
 */
export function applyRule(
    rule: AutoLayerRuleDef,
    sourceLayer: LayerInstance,
    seed: number
): RuleMatch[] {
    if (!rule.active || rule.tileRectsIds.length === 0) {
        return []
    }

    const matches: RuleMatch[] = []
    const flipVariants = getFlipVariants(rule)

    for (let cy = 0; cy < sourceLayer.__cHei; cy++) {
        for (let cx = 0; cx < sourceLayer.__cWid; cx++) {
            // Check modulo
            if (!passesModuloCheck(rule, cx, cy)) continue

            // Check checker
            if (!passesCheckerCheck(rule, cx, cy)) continue

            // Check chance
            if (!passesChanceCheck(rule, seed, cx, cy)) continue

            // Try each flip variant
            for (const [flipX, flipY] of flipVariants) {
                if (matchesAt(rule, sourceLayer, cx, cy, flipX, flipY)) {
                    // Get tile to place
                    const tileIndex = rule.tileRectsIds.length === 1
                        ? 0
                        : Math.floor(simpleHash(seed + 1, cx, cy) * rule.tileRectsIds.length)

                    const tileRect = rule.tileRectsIds[tileIndex]
                    if (tileRect && tileRect.length > 0) {
                        matches.push({
                            cx,
                            cy,
                            tileId: tileRect[0],
                            flipX,
                            flipY,
                            alpha: rule.alpha,
                        })
                    }

                    // Only use first matching variant
                    break
                }
            }
        }
    }

    return matches
}

/**
 * Get flip variants to try based on rule settings
 */
function getFlipVariants(rule: AutoLayerRuleDef): [boolean, boolean][] {
    const variants: [boolean, boolean][] = [[false, false]]

    if (rule.flipX && !isPatternSymmetricX(rule)) {
        variants.push([true, false])
    }

    if (rule.flipY && !isPatternSymmetricY(rule)) {
        const existing = [...variants]
        for (const [fx, _] of existing) {
            variants.push([fx, true])
        }
    }

    return variants
}

/**
 * Convert rule matches to tile instances
 */
export function matchesToTileInstances(
    matches: RuleMatch[],
    gridSize: number
): TileInstance[] {
    return matches.map((match) => ({
        t: match.tileId,
        px: [match.cx * gridSize, match.cy * gridSize],
        src: [0, 0], // Will be computed from tileset
        f: (match.flipX ? 1 : 0) | (match.flipY ? 2 : 0),
        a: match.alpha,
    }))
}
