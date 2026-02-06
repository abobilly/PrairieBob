/**
 * LDtk Project Loader
 * Loads .ldtk project files and resolves external levels.
 */

import { z } from 'zod'
import type { LDtkProject, LDtkProjectJSON } from './project'
import { loadProjectFromJson } from './json-io'

const SUPPORTED_JSON_VERSION = '1.5.3'

type LDtkLevelJSON = LDtkProjectJSON['worlds'][number]['levels'][number]

const layerInstanceSchema = z.object({
    iid: z.string(),
    layerDefUid: z.number(),
    __identifier: z.string(),
    __type: z.string(),
    levelId: z.number(),
    __gridSize: z.number(),
    __opacity: z.number(),
    __pxTotalOffsetX: z.number(),
    __pxTotalOffsetY: z.number(),
    __tilesetDefUid: z.number().nullable(),
    __tilesetRelPath: z.string().nullable(),
    __cWid: z.number(),
    __cHei: z.number(),
    intGridCsv: z.array(z.number()),
    autoLayerTiles: z.array(z.unknown()),
    gridTiles: z.array(z.unknown()),
    entityInstances: z.array(z.unknown()),
    seed: z.number(),
    overrideTilesetUid: z.number().nullable(),
    visible: z.boolean(),
    optionalRules: z.array(z.number()),
    pxOffsetX: z.number(),
    pxOffsetY: z.number(),
}).passthrough()

const levelSchema = z.object({
    uid: z.number(),
    iid: z.string(),
    identifier: z.string(),
    worldX: z.number(),
    worldY: z.number(),
    worldDepth: z.number(),
    pxWid: z.number(),
    pxHei: z.number(),
    __bgColor: z.string(),
    bgColor: z.string().nullable().optional(),
    bgRelPath: z.string().nullable(),
    bgPos: z.unknown().nullable(),
    bgPivotX: z.number(),
    bgPivotY: z.number(),
    externalRelPath: z.string().nullable(),
    useAutoIdentifier: z.boolean(),
    layerInstances: z.array(layerInstanceSchema).nullable(),
    fieldInstances: z.array(z.unknown()),
    __neighbours: z.array(z.object({
        levelIid: z.string(),
        dir: z.string(),
    })),
}).passthrough()

const worldSchema = z.object({
    iid: z.string(),
    identifier: z.string(),
    levels: z.array(levelSchema),
    defaultLevelWidth: z.number(),
    defaultLevelHeight: z.number(),
    worldGridWidth: z.number(),
    worldGridHeight: z.number(),
    worldLayout: z.string(),
}).passthrough()

const defsSchema = z.object({
    layers: z.array(z.unknown()),
    entities: z.array(z.unknown()),
    tilesets: z.array(z.unknown()),
    enums: z.array(z.unknown()),
    externalEnums: z.array(z.unknown()),
    levelFields: z.array(z.unknown()),
}).passthrough()

const projectSchema = z.object({
    jsonVersion: z.string(),
    appBuildId: z.number(),
    iid: z.string(),
    defs: defsSchema,
    worlds: z.array(worldSchema),
    levels: z.array(levelSchema).optional(),
    defaultPivotX: z.number(),
    defaultPivotY: z.number(),
    defaultGridSize: z.number(),
    defaultEntityWidth: z.number(),
    defaultEntityHeight: z.number(),
    bgColor: z.string(),
    defaultLevelBgColor: z.string(),
    minifyJson: z.boolean(),
    externalLevels: z.boolean(),
    exportTiled: z.boolean(),
    simplifiedExport: z.boolean(),
    imageExportMode: z.string(),
    exportLevelBg: z.boolean(),
    pngFilePattern: z.string().nullable(),
    levelNamePattern: z.string(),
    backupOnSave: z.boolean(),
    backupLimit: z.number(),
    backupRelPath: z.string().nullable(),
    identifierStyle: z.string(),
    tutorialDesc: z.string().nullable(),
    customCommands: z.array(z.object({
        command: z.string(),
        when: z.string(),
    }).passthrough()),
    flags: z.record(z.string(), z.boolean()),
    nextUid: z.number(),
    worldLayout: z.string().optional(),
    worldGridWidth: z.number().optional(),
    worldGridHeight: z.number().optional(),
}).passthrough()

const textDecoder = new TextDecoder('utf-8')

export async function loadProject(path: string): Promise<LDtkProject> {
    const content = await readFileText(path)
    const projectJson = parseProjectText(content)
    const withExternalLevels = await resolveExternalLevels(projectJson, getDirectoryPath(path))
    const project = loadProjectFromJson(withExternalLevels)
    project.filePath = path
    return project
}

export async function loadProjectFromBuffer(
    buffer: ArrayBuffer,
    baseDir?: string
): Promise<LDtkProject> {
    const text = textDecoder.decode(new Uint8Array(buffer))
    const projectJson = parseProjectText(text)
    const withExternalLevels = await resolveExternalLevels(projectJson, baseDir)
    return loadProjectFromJson(withExternalLevels)
}

export function validateProject(data: unknown): data is LDtkProjectJSON {
    const result = projectSchema.safeParse(data)
    if (!result.success) {
        return false
    }
    return isSupportedJsonVersion(result.data.jsonVersion)
}

function parseProjectText(text: string): LDtkProjectJSON {
    let data: unknown
    try {
        data = JSON.parse(text)
    } catch (err) {
        throw new Error(`Failed to parse LDtk project JSON: ${String(err)}`)
    }

    const result = projectSchema.safeParse(data)
    if (!result.success) {
        throw new Error('Invalid LDtk project JSON structure')
    }

    if (!isSupportedJsonVersion(result.data.jsonVersion)) {
        throw new Error(`Unsupported LDtk JSON version: ${result.data.jsonVersion}`)
    }

    return result.data as LDtkProjectJSON
}

function isSupportedJsonVersion(version: string): boolean {
    const versionParts = version.split('.').map(Number)
    const supportedParts = SUPPORTED_JSON_VERSION.split('.').map(Number)
    if (versionParts.some((part) => Number.isNaN(part))) return false
    if (supportedParts.some((part) => Number.isNaN(part))) return false
    return (
        versionParts[0] === supportedParts[0] &&
        versionParts[1] === supportedParts[1]
    )
}

async function resolveExternalLevels(
    projectJson: LDtkProjectJSON,
    baseDir?: string
): Promise<LDtkProjectJSON> {
    if (!projectJson.externalLevels) {
        return projectJson
    }

    const hasExternalPaths =
        projectJson.levels?.some((level) => level.externalRelPath) ||
        projectJson.worlds.some((world) => world.levels.some((level) => level.externalRelPath))

    if (hasExternalPaths && !baseDir) {
        throw new Error('External levels require a base directory to resolve paths.')
    }

    const worlds = await Promise.all(
        projectJson.worlds.map(async (world) => {
            const levels = await Promise.all(
                world.levels.map((level) => loadExternalLevel(level, baseDir))
            )
            return { ...world, levels }
        })
    )

    const legacyLevels = projectJson.levels
        ? await Promise.all(projectJson.levels.map((level) => loadExternalLevel(level, baseDir)))
        : undefined

    return {
        ...projectJson,
        worlds,
        levels: legacyLevels,
    }
}

async function loadExternalLevel(
    level: LDtkLevelJSON,
    baseDir?: string
): Promise<LDtkLevelJSON> {
    if (!level.externalRelPath) {
        return level
    }

    const levelPath = baseDir
        ? joinPath(baseDir, level.externalRelPath)
        : level.externalRelPath

    const content = await readFileText(levelPath)
    let data: unknown
    try {
        data = JSON.parse(content)
    } catch (err) {
        throw new Error(`Failed to parse external level JSON (${level.externalRelPath}): ${String(err)}`)
    }

    const parsed = levelSchema.safeParse(data)
    if (!parsed.success) {
        throw new Error(`Invalid external level JSON structure: ${level.externalRelPath}`)
    }

    return {
        ...parsed.data,
        externalRelPath: level.externalRelPath,
    } as LDtkLevelJSON
}

async function readFileText(path: string): Promise<string> {
    if (typeof window !== 'undefined' && window.electron?.fs?.readFile) {
        return window.electron.fs.readFile(path)
    }

    if (typeof fetch === 'function') {
        const response = await fetch(path)
        if (!response.ok) {
            throw new Error(`Failed to read file: ${path}`)
        }
        return response.text()
    }

    throw new Error('File reading is not available in this environment.')
}

function getDirectoryPath(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    return lastSlash >= 0 ? filePath.slice(0, lastSlash) : ''
}

function joinPath(baseDir: string, relPath: string): string {
    if (isAbsolutePath(relPath) || baseDir.length === 0) {
        return relPath
    }

    const separator = baseDir.includes('\\') ? '\\' : '/'
    const trimmedBase = baseDir.replace(/[\\/]+$/, '')
    const trimmedRel = relPath.replace(/^[\\/]+/, '')
    const normalizedRel = trimmedRel.replace(/[\\/]+/g, separator)
    return `${trimmedBase}${separator}${normalizedRel}`
}

function isAbsolutePath(path: string): boolean {
    return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\')
}
