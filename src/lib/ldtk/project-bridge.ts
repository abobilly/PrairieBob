/**
 * PrairieBob <-> LDtk project bridge
 * Loads PrairieBob config and maps it into LDtk project format.
 */

import type { Project } from './project'
import {
    createProject,
    generateIid,
    PROJECT_DEFAULTS,
} from './project'
import { createWorld } from './world'
import { loadProjectFromJson, saveProjectToJson } from './json-io'

export interface PrairieBobLinkedProject {
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

export interface PrairieBobConfig {
    linkedProjects: PrairieBobLinkedProject[]
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

export type LDtkProject = Project & { prairieBobConfig: PrairieBobConfig }

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

function normalizeConfigPath(path: string): string {
    if (path.toLowerCase().endsWith('.json')) {
        return path
    }
    const trimmed = path.replace(/[\\/]+$/, '')
    return `${trimmed}/prairiebob.config.json`
}

function validatePrairieBobConfig(value: unknown): PrairieBobConfig {
    if (!isRecord(value)) {
        throw new Error('Invalid PrairieBob config; expected an object')
    }

    const linkedProjects = value.linkedProjects
    if (!Array.isArray(linkedProjects) || linkedProjects.length === 0) {
        throw new Error('Invalid PrairieBob config; linkedProjects is required')
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
            `Invalid PrairieBob config; defaultProject "${defaultProject}" not found`
        )
    }

    return value as PrairieBobConfig
}

function getDefaultLinkedProject(config: PrairieBobConfig): PrairieBobLinkedProject {
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
    linkedProject: PrairieBobLinkedProject,
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
    config: PrairieBobConfig
): PrairieBobConfig {
    const updated: PrairieBobConfig = { ...config }
    const tileSize = project.defaultGridSize || PROJECT_DEFAULTS.GRID_SIZE

    const defaultProject = getDefaultLinkedProject(updated)
    defaultProject.tileSize = tileSize

    if (!updated.ldtkPath && project.filePath?.toLowerCase().endsWith('.ldtk')) {
        updated.ldtkPath = project.filePath
    }

    return updated
}

export function syncPrairieBobConfig(
    project: LDtkProject,
    config: PrairieBobConfig
): LDtkProject {
    const validated = validatePrairieBobConfig(config)
    const defaultProject = getDefaultLinkedProject(validated)
    const tileSize = defaultProject.tileSize || PROJECT_DEFAULTS.GRID_SIZE

    updateProjectDefaults(project, tileSize)

    for (const linkedProject of validated.linkedProjects) {
        updateWorldDefaults(project, linkedProject, tileSize)
    }

    project.prairieBobConfig = validated
    return project
}

export async function loadPrairieBobProject(path: string): Promise<LDtkProject> {
    const fs = assertElectronFs()
    const configPath = normalizeConfigPath(path)

    const configContent = await fs.readFile(configPath)
    const config = validatePrairieBobConfig(JSON.parse(configContent))

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
        prairieBobConfig: config,
    }) as LDtkProject

    return syncPrairieBobConfig(bridgedProject, config)
}

export async function savePrairieBobProject(
    project: LDtkProject,
    path: string
): Promise<void> {
    const fs = assertElectronFs()
    const configPath = normalizeConfigPath(path)

    const configSource = project.prairieBobConfig ?? null
    if (!configSource) {
        throw new Error('Missing PrairieBob config on project')
    }

    const updatedConfig = updateConfigFromProject(
        project,
        validatePrairieBobConfig(configSource)
    )

    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 4))

    if (updatedConfig.ldtkPath) {
        const projectJson = saveProjectToJson(project)
        await fs.writeFile(updatedConfig.ldtkPath, JSON.stringify(projectJson, null, 2))
    }
}
