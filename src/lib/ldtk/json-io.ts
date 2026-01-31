/**
 * LDtk JSON Loader/Saver
 * Handles reading/writing LDtk project files
 */

import type { Project } from './project'
import type { World } from './world'
import type { Level } from './level'
import type { LayerInstance } from './layer-instance'
import type {
    Definitions,
    LayerDef,
    TilesetDef,
    EntityDef,
    EnumDef,
    AutoLayerRuleGroupDef,
} from './types'
import { createProject, generateIid } from './project'
import { createWorld } from './world'
import { createLevel } from './level'

// ============== JSON Types (match LDtk schema) ==============

interface LdtkJson {
    jsonVersion: string
    appBuildId: number
    iid: string

    defs: DefsJson
    worlds: WorldJson[]
    levels?: LevelJson[]  // Legacy single-world

    defaultPivotX: number
    defaultPivotY: number
    defaultGridSize: number
    defaultEntityWidth: number
    defaultEntityHeight: number

    bgColor: string
    defaultLevelBgColor: string

    minifyJson: boolean
    externalLevels: boolean
    exportTiled: boolean
    simplifiedExport: boolean
    imageExportMode: string
    exportLevelBg: boolean
    pngFilePattern: string | null
    levelNamePattern: string

    backupOnSave: boolean
    backupLimit: number
    backupRelPath: string | null

    identifierStyle: string
    tutorialDesc: string | null
    customCommands: Array<{ command: string; when: string }>

    flags: Record<string, boolean>
    nextUid: number

    // Legacy
    worldLayout?: string
    worldGridWidth?: number
    worldGridHeight?: number
}

interface DefsJson {
    layers: unknown[]
    entities: unknown[]
    tilesets: unknown[]
    enums: unknown[]
    externalEnums: unknown[]
    levelFields: unknown[]
}

interface WorldJson {
    iid: string
    identifier: string
    levels: LevelJson[]
    defaultLevelWidth: number
    defaultLevelHeight: number
    worldGridWidth: number
    worldGridHeight: number
    worldLayout: string
}

interface LevelJson {
    uid: number
    iid: string
    identifier: string
    worldX: number
    worldY: number
    worldDepth: number
    pxWid: number
    pxHei: number
    __bgColor: string
    bgColor: string | null
    bgRelPath: string | null
    bgPos: unknown | null
    bgPivotX: number
    bgPivotY: number
    externalRelPath: string | null
    useAutoIdentifier: boolean
    layerInstances: LayerInstanceJson[] | null
    fieldInstances: unknown[]
    __neighbours: Array<{ levelIid: string; dir: string }>
}

interface LayerInstanceJson {
    iid: string
    layerDefUid: number
    __identifier: string
    __type: string
    levelId: number
    __gridSize: number
    __opacity: number
    __pxTotalOffsetX: number
    __pxTotalOffsetY: number
    __tilesetDefUid: number | null
    __tilesetRelPath: string | null
    __cWid: number
    __cHei: number
    intGridCsv: number[]
    autoLayerTiles: unknown[]
    gridTiles: unknown[]
    entityInstances: unknown[]
    seed: number
    overrideTilesetUid: number | null
    visible: boolean
    optionalRules: number[]
    pxOffsetX: number
    pxOffsetY: number
}

// ============== Color Conversion ==============

function hexToInt(hex: string): number {
    return parseInt(hex.replace('#', ''), 16)
}

function intToHex(int: number): string {
    return '#' + int.toString(16).padStart(6, '0')
}

// ============== Load Project ==============

export function loadProjectFromJson(json: LdtkJson): Project {
    const project = createProject({
        iid: json.iid,
        jsonVersion: json.jsonVersion,
    })

    project.appBuildId = json.appBuildId
    project.nextUid = json.nextUid

    // Settings
    project.defaultPivotX = json.defaultPivotX
    project.defaultPivotY = json.defaultPivotY
    project.defaultGridSize = json.defaultGridSize
    project.defaultEntityWidth = json.defaultEntityWidth
    project.defaultEntityHeight = json.defaultEntityHeight

    project.bgColor = hexToInt(json.bgColor)
    project.defaultLevelBgColor = hexToInt(json.defaultLevelBgColor)

    project.minifyJson = json.minifyJson
    project.externalLevels = json.externalLevels
    project.exportTiled = json.exportTiled
    project.simplifiedExport = json.simplifiedExport
    project.imageExportMode = json.imageExportMode as any
    project.exportLevelBg = json.exportLevelBg
    project.pngFilePattern = json.pngFilePattern
    project.levelNamePattern = json.levelNamePattern

    project.backupOnSave = json.backupOnSave
    project.backupLimit = json.backupLimit
    project.backupRelPath = json.backupRelPath

    project.identifierStyle = json.identifierStyle as any
    project.tutorialDesc = json.tutorialDesc
    project.customCommands = json.customCommands as any
    project.flags = json.flags

    // Load definitions
    project.defs = loadDefinitions(json.defs)

    // Load worlds
    if (json.worlds && json.worlds.length > 0) {
        project.worlds = json.worlds.map(loadWorld)
    } else if (json.levels) {
        // Legacy: single world with levels at root
        const world = createWorld({
            iid: generateIid(),
            identifier: 'World',
            layout: (json.worldLayout as any) ?? 'Free',
            defaultLevelWidth: json.worldGridWidth,
            defaultLevelHeight: json.worldGridHeight,
        })
        world.levels = json.levels.map(loadLevel)
        project.worlds = [world]
    }

    return project
}

function loadDefinitions(json: DefsJson): Definitions {
    return {
        layers: json.layers as LayerDef[],
        entities: json.entities as EntityDef[],
        tilesets: json.tilesets as TilesetDef[],
        enums: json.enums as EnumDef[],
        externalEnums: json.externalEnums as EnumDef[],
        levelFields: json.levelFields as any[],
    }
}

function loadWorld(json: WorldJson): World {
    const world = createWorld({
        iid: json.iid,
        identifier: json.identifier,
        layout: json.worldLayout as any,
        defaultLevelWidth: json.defaultLevelWidth,
        defaultLevelHeight: json.defaultLevelHeight,
    })

    world.worldGridWidth = json.worldGridWidth
    world.worldGridHeight = json.worldGridHeight
    world.levels = json.levels.map(loadLevel)

    return world
}

function loadLevel(json: LevelJson): Level {
    const level = createLevel({
        uid: json.uid,
        iid: json.iid,
        identifier: json.identifier,
        pxWid: json.pxWid,
        pxHei: json.pxHei,
        worldX: json.worldX,
        worldY: json.worldY,
        worldDepth: json.worldDepth,
    })

    level.bgColor = json.bgColor ? hexToInt(json.bgColor) : null
    level.bgRelPath = json.bgRelPath
    level.bgPos = json.bgPos as any
    level.bgPivotX = json.bgPivotX
    level.bgPivotY = json.bgPivotY
    level.externalRelPath = json.externalRelPath
    level.useAutoIdentifier = json.useAutoIdentifier
    level.__neighbours = json.__neighbours

    if (json.layerInstances) {
        level.layerInstances = json.layerInstances.map(loadLayerInstance)
    }

    level.fieldInstances = json.fieldInstances as any

    return level
}

function loadLayerInstance(json: LayerInstanceJson): LayerInstance {
    return {
        iid: json.iid,
        layerDefUid: json.layerDefUid,
        __identifier: json.__identifier,
        __type: json.__type as any,
        levelId: json.levelId,
        __gridSize: json.__gridSize,
        __opacity: json.__opacity,
        __pxTotalOffsetX: json.__pxTotalOffsetX,
        __pxTotalOffsetY: json.__pxTotalOffsetY,
        __tilesetDefUid: json.__tilesetDefUid,
        __tilesetRelPath: json.__tilesetRelPath,
        __cWid: json.__cWid,
        __cHei: json.__cHei,
        intGridCsv: json.intGridCsv,
        autoLayerTiles: json.autoLayerTiles as any,
        gridTiles: json.gridTiles as any,
        entityInstances: json.entityInstances as any,
        seed: json.seed,
        overrideTilesetUid: json.overrideTilesetUid,
        visible: json.visible,
        optionalRules: json.optionalRules,
        pxOffsetX: json.pxOffsetX,
        pxOffsetY: json.pxOffsetY,
    }
}

// ============== Save Project ==============

export function saveProjectToJson(project: Project): LdtkJson {
    return {
        jsonVersion: project.jsonVersion,
        appBuildId: project.appBuildId,
        iid: project.iid,

        defs: project.defs as any,
        worlds: project.worlds.map(saveWorld),

        defaultPivotX: project.defaultPivotX,
        defaultPivotY: project.defaultPivotY,
        defaultGridSize: project.defaultGridSize,
        defaultEntityWidth: project.defaultEntityWidth,
        defaultEntityHeight: project.defaultEntityHeight,

        bgColor: intToHex(project.bgColor),
        defaultLevelBgColor: intToHex(project.defaultLevelBgColor),

        minifyJson: project.minifyJson,
        externalLevels: project.externalLevels,
        exportTiled: project.exportTiled,
        simplifiedExport: project.simplifiedExport,
        imageExportMode: project.imageExportMode,
        exportLevelBg: project.exportLevelBg,
        pngFilePattern: project.pngFilePattern,
        levelNamePattern: project.levelNamePattern,

        backupOnSave: project.backupOnSave,
        backupLimit: project.backupLimit,
        backupRelPath: project.backupRelPath,

        identifierStyle: project.identifierStyle,
        tutorialDesc: project.tutorialDesc,
        customCommands: project.customCommands,

        flags: project.flags,
        nextUid: project.nextUid,
    }
}

function saveWorld(world: World): WorldJson {
    return {
        iid: world.iid,
        identifier: world.identifier,
        levels: world.levels.map(saveLevel),
        defaultLevelWidth: world.defaultLevelWidth,
        defaultLevelHeight: world.defaultLevelHeight,
        worldGridWidth: world.worldGridWidth,
        worldGridHeight: world.worldGridHeight,
        worldLayout: world.worldLayout,
    }
}

function saveLevel(level: Level): LevelJson {
    return {
        uid: level.uid,
        iid: level.iid,
        identifier: level.identifier,
        worldX: level.worldX,
        worldY: level.worldY,
        worldDepth: level.worldDepth,
        pxWid: level.pxWid,
        pxHei: level.pxHei,
        __bgColor: level.__bgColor,
        bgColor: level.bgColor ? intToHex(level.bgColor) : null,
        bgRelPath: level.bgRelPath,
        bgPos: level.bgPos,
        bgPivotX: level.bgPivotX,
        bgPivotY: level.bgPivotY,
        externalRelPath: level.externalRelPath,
        useAutoIdentifier: level.useAutoIdentifier,
        layerInstances: level.layerInstances as any,
        fieldInstances: level.fieldInstances,
        __neighbours: level.__neighbours,
    }
}

// ============== File Operations ==============

export async function loadProjectFile(filePath: string): Promise<Project> {
    const response = await fetch(filePath)
    const json = await response.json()
    const project = loadProjectFromJson(json)
    project.filePath = filePath
    return project
}

export function projectToJsonString(project: Project, minify = false): string {
    const json = saveProjectToJson(project)
    return minify ? JSON.stringify(json) : JSON.stringify(json, null, 2)
}
