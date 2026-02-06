/**
 * SpudTile <-> LDtk project bridge
 * Loads SpudTile config and maps it into LDtk project format.
 */

import type { Project } from './project'
import {
    createProject,
    generateIid,
    PROJECT_DEFAULTS,
} from './project'
import { createWorld } from './world'
import { loadProjectFromJson, saveProjectToJson } from './json-io'

export interface SpudTileLinkedProject {
    name: string
    rootPath: string
    contentPath: string
    generatedPath?: string
    specsPath?: string
    schemasPath?: string
    exportFormat?: string
    tileSize: number
    paths?: Record<string, unknown>
    validation?: Record<string, unknown>
    [key: string]: unknown
}

export interface SpudTileConfig {
    linkedProjects: SpudTileLinkedProject[]
    defaultProject: string
    ldtkPath?: string
    agentEnabled?: boolean
    copilotCli?: Record<string, unknown>
    bobTile?: Record<string, unknown>
    assets?: Record<string, unknown>
    editor?: Record<string, unknown>
    interactions?: Record<string, unknown>
    tilesets?: unknown[]
    [key: string]: unknown
}

export type LDtkProject = Project & { spudTileConfig: SpudTileConfig }

const CONFIG_FILENAME = 'spudtile.config.json'
const LEGACY_CONFIG_FILENAME = 'prairiebob.config.json'

const DEFAULT_TILES_PER_LEVEL =
    PROJECT_DEFAULTS.LEVEL_WIDTH / PROJECT_DEFAULTS.GRID_SIZE

function assertElectronFs(): NonNullable<Window['electron']>['fs'] {
    if (!window?.electron?.fs) {
        throw new Error('Electron IPC is required for file operations')
    }
    return window.electron.fs
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Invalid ${label}; expected a non-empty string`)
    }
    return value
}

function assertNumber(value: unknown, label: string): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Invalid ${label}; expected a number`)
    }
    return value
}

function normalizeConfigPath(path: string, fileName = CONFIG_FILENAME): string {
    if (path.toLowerCase().endsWith('.json')) {
        return path
    }
    const trimmed = path.replace(/[\\/]+$/, '')
    return `${trimmed}/${fileName}`
}

async function resolveReadableConfigPath(
    fs: NonNullable<Window['electron']>['fs'],
    path: string
): Promise<string> {
    const primaryPath = normalizeConfigPath(path, CONFIG_FILENAME)
    if (path.toLowerCase().endsWith('.json')) {
        return primaryPath
    }

    if (await fs.exists(primaryPath)) {
        return primaryPath
    }

    const legacyPath = normalizeConfigPath(path, LEGACY_CONFIG_FILENAME)
    if (await fs.exists(legacyPath)) {
        return legacyPath
    }

    return primaryPath
}

function validateSpudTileConfig(value: unknown): SpudTileConfig {
    if (!isRecord(value)) {
        throw new Error('Invalid SpudTile config; expected an object')
    }

    const linkedProjects = value.linkedProjects
    if (!Array.isArray(linkedProjects) || linkedProjects.length === 0) {
        throw new Error('Invalid SpudTile config; linkedProjects is required')
    }

    const defaultProject = assertString(value.defaultProject, 'defaultProject')

    for (const [index, project] of linkedProjects.entries()) {
        if (!isRecord(project)) {
            throw new Error(`Invalid linkedProjects[${index}]; expected an object`)
        }
        assertString(project.name, `linkedProjects[${index}].name`)
        assertString(project.rootPath, `linkedProjects[${index}].rootPath`)
        assertString(project.contentPath, `linkedProjects[${index}].contentPath`)
        assertNumber(project.tileSize, `linkedProjects[${index}].tileSize`)
    }

    const hasDefault = linkedProjects.some(
        (project) => isRecord(project) && project.name === defaultProject
    )
    if (!hasDefault) {
        throw new Error(
            `Invalid SpudTile config; defaultProject "${defaultProject}" not found`
        )
    }

    return value as SpudTileConfig
}

function getDefaultLinkedProject(config: SpudTileConfig): SpudTileLinkedProject {
    const match = config.linkedProjects.find(
        (project) => project.name === config.defaultProject
    )
    if (!match) {
        throw new Error(
            `Default project "${config.defaultProject}" not found in linkedProjects`
        )
    }
    return match
}

function updateProjectDefaults(project: Project, tileSize: number): void {
    project.defaultGridSize = tileSize
    project.defaultEntityWidth = tileSize
    project.defaultEntityHeight = tileSize
}

function updateWorldDefaults(
    project: Project,
    linkedProject: SpudTileLinkedProject,
    tileSize: number
): void {
    const world = project.worlds.find(
        (entry) => entry.identifier === linkedProject.name
    )
    const worldTileSize = linkedProject.tileSize ?? tileSize
    const levelSize = worldTileSize * DEFAULT_TILES_PER_LEVEL

    if (world) {
        world.defaultLevelWidth = levelSize
        world.defaultLevelHeight = levelSize
        world.worldGridWidth = levelSize
        world.worldGridHeight = levelSize
        return
    }

    project.worlds.push(
        createWorld({
            iid: generateIid(),
            identifier: linkedProject.name,
            defaultLevelWidth: levelSize,
            defaultLevelHeight: levelSize,
        })
    )
}

function updateConfigFromProject(
    project: Project,
    config: SpudTileConfig
): SpudTileConfig {
    const updated: SpudTileConfig = { ...config }
    const tileSize = project.defaultGridSize || PROJECT_DEFAULTS.GRID_SIZE

    const defaultProject = getDefaultLinkedProject(updated)
    defaultProject.tileSize = tileSize

    if (!updated.ldtkPath && project.filePath?.toLowerCase().endsWith('.ldtk')) {
        updated.ldtkPath = project.filePath
    }

    return updated
}

export function syncSpudTileConfig(
    project: LDtkProject,
    config: SpudTileConfig
): LDtkProject {
    const validated = validateSpudTileConfig(config)
    const defaultProject = getDefaultLinkedProject(validated)
    const tileSize = defaultProject.tileSize || PROJECT_DEFAULTS.GRID_SIZE

    updateProjectDefaults(project, tileSize)

    for (const linkedProject of validated.linkedProjects) {
        updateWorldDefaults(project, linkedProject, tileSize)
    }

    project.spudTileConfig = validated
    return project
}

export async function loadSpudTileProject(path: string): Promise<LDtkProject> {
    const fs = assertElectronFs()
    const configPath = await resolveReadableConfigPath(fs, path)

    const configContent = await fs.readFile(configPath)
    const config = validateSpudTileConfig(JSON.parse(configContent))

    let project: Project
    if (config.ldtkPath) {
        const ldtkContent = await fs.readFile(config.ldtkPath)
        project = loadProjectFromJson(JSON.parse(ldtkContent))
        project.filePath = config.ldtkPath
    } else {
        project = createProject()
        project.filePath = configPath
    }

    const bridgedProject = Object.assign(project, {
        spudTileConfig: config,
    }) as LDtkProject

    return syncSpudTileConfig(bridgedProject, config)
}

export async function saveSpudTileProject(
    project: LDtkProject,
    path: string
): Promise<void> {
    const fs = assertElectronFs()
    const configPath = normalizeConfigPath(path, CONFIG_FILENAME)

    const configSource = project.spudTileConfig ?? null
    if (!configSource) {
        throw new Error('Missing SpudTile config on project')
    }

    const updatedConfig = updateConfigFromProject(
        project,
        validateSpudTileConfig(configSource)
    )

    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 4))

    if (updatedConfig.ldtkPath) {
        const projectJson = saveProjectToJson(project)
        await fs.writeFile(updatedConfig.ldtkPath, JSON.stringify(projectJson, null, 2))
    }
}
