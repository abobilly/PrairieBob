/**
 * LDtk Project - Root container
 * Ported from LDtk/src/electron.renderer/data/Project.hx
 */

import type {
    Definitions,
    IdentifierStyle,
    ImageExportMode
} from './types'
import type { World } from './world'
import type { Level } from './level'

// ============== Project Defaults ==============

export const PROJECT_DEFAULTS = {
    WORKSPACE_BG: 0x40465b,
    LEVEL_BG: 0x696a79,
    GRID_SIZE: 16,
    LEVEL_WIDTH: 16 * 16,  // 256px
    LEVEL_HEIGHT: 16 * 16,
    LEVEL_NAME_PATTERN: 'Level_%idx',
}

// ============== Custom Command ==============

export interface CustomCommand {
    command: string
    when: 'Manual' | 'AfterLoad' | 'BeforeSave' | 'AfterSave'
}

// ============== Project ==============

export interface Project {
    /** File path (not stored in JSON) */
    filePath: string | null

    /** JSON format version */
    jsonVersion: string
    /** App build ID */
    appBuildId: number
    /** Instance ID */
    iid: string

    /** Definitions (layer defs, entity defs, tilesets, enums) */
    defs: Definitions
    /** Worlds (multi-world support) */
    worlds: World[]

    /** Default pivot X (0-1) */
    defaultPivotX: number
    /** Default pivot Y (0-1) */
    defaultPivotY: number
    /** Default grid size in pixels */
    defaultGridSize: number
    /** Default entity width */
    defaultEntityWidth: number
    /** Default entity height */
    defaultEntityHeight: number

    /** Workspace background color */
    bgColor: number
    /** Default level background color */
    defaultLevelBgColor: number

    /** Minify exported JSON */
    minifyJson: boolean
    /** Store levels in separate files */
    externalLevels: boolean
    /** Export Tiled-compatible files */
    exportTiled: boolean
    /** Simplified export mode */
    simplifiedExport: boolean
    /** Image export mode */
    imageExportMode: ImageExportMode
    /** Export level background images */
    exportLevelBg: boolean
    /** PNG file pattern */
    pngFilePattern: string | null
    /** Level name pattern */
    levelNamePattern: string

    /** Backup on save */
    backupOnSave: boolean
    /** Backup limit */
    backupLimit: number
    /** Backup relative path */
    backupRelPath: string | null

    /** Identifier style */
    identifierStyle: IdentifierStyle
    /** Tutorial description */
    tutorialDesc: string | null
    /** Custom commands */
    customCommands: CustomCommand[]

    /** Project flags */
    flags: Record<string, boolean>

    /** Next UID counter */
    nextUid: number
}

// ============== Project Creation ==============

export function createProject(params?: {
    iid?: string
    jsonVersion?: string
}): Project {
    return {
        filePath: null,
        jsonVersion: params?.jsonVersion ?? '1.5.3',
        appBuildId: 0,
        iid: params?.iid ?? generateIid(),

        defs: {
            layers: [],
            entities: [],
            tilesets: [],
            enums: [],
            externalEnums: [],
            levelFields: [],
        },
        worlds: [],

        defaultPivotX: 0,
        defaultPivotY: 0,
        defaultGridSize: PROJECT_DEFAULTS.GRID_SIZE,
        defaultEntityWidth: PROJECT_DEFAULTS.GRID_SIZE,
        defaultEntityHeight: PROJECT_DEFAULTS.GRID_SIZE,

        bgColor: PROJECT_DEFAULTS.WORKSPACE_BG,
        defaultLevelBgColor: PROJECT_DEFAULTS.LEVEL_BG,

        minifyJson: false,
        externalLevels: false,
        exportTiled: false,
        simplifiedExport: false,
        imageExportMode: 'None',
        exportLevelBg: true,
        pngFilePattern: null,
        levelNamePattern: PROJECT_DEFAULTS.LEVEL_NAME_PATTERN,

        backupOnSave: false,
        backupLimit: 10,
        backupRelPath: null,

        identifierStyle: 'Capitalize',
        tutorialDesc: null,
        customCommands: [],

        flags: {},
        nextUid: 1,
    }
}

// ============== UID Generation ==============

/**
 * Generate a unique numeric ID
 */
export function generateUid(project: Project): number {
    return project.nextUid++
}

/**
 * Generate a UUID-style IID
 */
export function generateIid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

// ============== Project Helpers ==============

/**
 * Get all levels across all worlds
 */
export function getAllLevels(project: Project): Level[] {
    return project.worlds.flatMap((w) => w.levels)
}

/**
 * Get level by IID across all worlds
 */
export function getLevelByIid(project: Project, iid: string): Level | undefined {
    for (const world of project.worlds) {
        const level = world.levels.find((l) => l.iid === iid)
        if (level) return level
    }
    return undefined
}

/**
 * Get level by UID across all worlds
 */
export function getLevelByUid(project: Project, uid: number): Level | undefined {
    for (const world of project.worlds) {
        const level = world.levels.find((l) => l.uid === uid)
        if (level) return level
    }
    return undefined
}

/**
 * Get layer definition by UID
 */
export function getLayerDef(project: Project, uid: number) {
    return project.defs.layers.find((ld) => ld.uid === uid)
}

/**
 * Get layer definition by identifier
 */
export function getLayerDefByIdentifier(project: Project, identifier: string) {
    return project.defs.layers.find((ld) => ld.identifier === identifier)
}

/**
 * Get tileset definition by UID
 */
export function getTilesetDef(project: Project, uid: number) {
    return project.defs.tilesets.find((td) => td.uid === uid)
}

/**
 * Get entity definition by UID
 */
export function getEntityDef(project: Project, uid: number) {
    return project.defs.entities.find((ed) => ed.uid === uid)
}

/**
 * Get enum definition by UID
 */
export function getEnumDef(project: Project, uid: number) {
    return (
        project.defs.enums.find((ed) => ed.uid === uid) ??
        project.defs.externalEnums.find((ed) => ed.uid === uid)
    )
}

/**
 * Validate identifier (LDtk rules)
 */
export function isValidIdentifier(id: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)
}

/**
 * Clean up identifier to match style
 */
export function cleanupIdentifier(
    id: string,
    style: IdentifierStyle
): string {
    // Remove invalid characters
    let clean = id.replace(/[^a-zA-Z0-9_]/g, '_')

    // Ensure starts with letter or underscore
    if (/^[0-9]/.test(clean)) {
        clean = '_' + clean
    }

    // Apply style
    switch (style) {
        case 'Capitalize':
            return clean.charAt(0).toUpperCase() + clean.slice(1)
        case 'Uppercase':
            return clean.toUpperCase()
        case 'Lowercase':
            return clean.toLowerCase()
        case 'Free':
        default:
            return clean
    }
}
