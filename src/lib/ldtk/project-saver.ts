/**
 * LDtk Project Saver
 * Saves .ldtk projects with optional external levels and backups.
 */

import type { LDtkProject, LDtkProjectJSON } from './project'
import { saveProjectToJson } from './json-io'
import { getDirectoryPath, joinPath, validateProject } from './project-loader'

const LEVEL_EXTENSION = 'ldtkl'
const BACKUP_DIR = 'backups'
const LEVEL_FILE_LEADER_ZEROS = 4

interface ExternalLevelSave {
    id: string
    relPath: string
    jsonStr: string
}

const textEncoder = new TextEncoder()

type ElectronFs = NonNullable<Window['electron']>['fs']

function assertElectronFs(): ElectronFs {
    if (!window?.electron?.fs) {
        throw new Error('Electron IPC is required for LDtk project saving')
    }
    return window.electron.fs
}

function getFileName(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath
}

function getFileBaseName(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.slice(0, lastDot) : fileName
}

function padNumber(value: number, length: number): string {
    return String(value).padStart(length, '0')
}

function formatBackupTimestamp(date: Date): string {
    return [
        date.getFullYear(),
        padNumber(date.getMonth() + 1, 2),
        padNumber(date.getDate(), 2),
    ].join('-') + '_' + [
        padNumber(date.getHours(), 2),
        padNumber(date.getMinutes(), 2),
        padNumber(date.getSeconds(), 2),
    ].join('-')
}

function makeBackupDirName(project: LDtkProject): string {
    return `${project.iid}_${formatBackupTimestamp(new Date())}`
}

function leadingZeros(value: number, length: number): string {
    return padNumber(value, length)
}

function shouldPrependLevelIndex(project: LDtkProject): boolean {
    return Boolean(project.flags?.PrependIndexToLevelFileNames)
}

function buildExternalRelPath(
    project: LDtkProject,
    relDir: string,
    levelIdentifier: string,
    index: number
): string {
    const prefix = shouldPrependLevelIndex(project)
        ? `${leadingZeros(index, LEVEL_FILE_LEADER_ZEROS)}-`
        : ''
    return `${relDir}/${prefix}${levelIdentifier}.${LEVEL_EXTENSION}`
}

function stringifyJson(project: LDtkProject, json: unknown): string {
    return project.minifyJson ? JSON.stringify(json) : JSON.stringify(json, null, 2)
}

function resolveProjectFilePath(project: LDtkProject, path?: string): string {
    if (path) return path
    if (project.filePath) return project.filePath
    return 'project.ldtk'
}

function prepareProjectSavingData(
    project: LDtkProject,
    filePath: string,
    forceSingleFile = false
): {
    projectJson: LDtkProjectJSON
    projectJsonStr: string
    externalLevels: ExternalLevelSave[]
} {
    const projectJson = saveProjectToJson(project)
    const externalLevels: ExternalLevelSave[] = []

    if (!project.externalLevels || forceSingleFile) {
        return {
            projectJson,
            projectJsonStr: stringifyJson(project, projectJson),
            externalLevels,
        }
    }

    const fileName = getFileName(filePath)
    const relDir = getFileBaseName(fileName)
    let index = 0

    const trimLevel = (levelJson: LDtkProjectJSON['worlds'][number]['levels'][number]) => {
        const relPath = buildExternalRelPath(project, relDir, levelJson.identifier, index)
        const externalJson = { ...levelJson, externalRelPath: null }
        externalLevels.push({
            id: levelJson.identifier,
            relPath,
            jsonStr: stringifyJson(project, externalJson),
        })
        levelJson.layerInstances = null
        levelJson.externalRelPath = relPath
        index += 1
    }

    projectJson.worlds.forEach((world) => {
        world.levels.forEach(trimLevel)
    })

    if (projectJson.levels) {
        projectJson.levels.forEach(trimLevel)
    }

    return {
        projectJson,
        projectJsonStr: stringifyJson(project, projectJson),
        externalLevels,
    }
}

async function ensureDirectory(fs: ElectronFs, directory: string): Promise<void> {
    if (!directory) return
    await fs.mkdir(directory)
}

async function ensureDirectoryForFile(fs: ElectronFs, filePath: string): Promise<void> {
    const dir = getDirectoryPath(filePath)
    await ensureDirectory(fs, dir)
}

function getBackupRoot(project: LDtkProject, projectDir: string, projectName: string): string {
    if (project.backupRelPath) {
        return joinPath(projectDir, project.backupRelPath)
    }
    return joinPath(joinPath(projectDir, projectName), BACKUP_DIR)
}

async function backupProjectFiles(
    project: LDtkProject,
    projectPath: string,
    fs: ElectronFs
): Promise<void> {
    if (!(await fs.exists(projectPath))) {
        return
    }

    const projectDir = getDirectoryPath(projectPath)
    const fileName = getFileName(projectPath)
    const projectName = getFileBaseName(fileName)
    const externalDir = joinPath(projectDir, projectName)
    const backupRoot = getBackupRoot(project, projectDir, projectName)
    const backupDir = joinPath(backupRoot, makeBackupDirName(project))

    await ensureDirectory(fs, backupDir)

    const relFiles: string[] = [fileName]
    if (await fs.exists(externalDir)) {
        const entries = await fs.readDir(externalDir)
        for (const entry of entries) {
            if (entry.isDirectory) continue
            if (!entry.name.toLowerCase().endsWith(`.${LEVEL_EXTENSION}`)) continue
            relFiles.push(`${projectName}/${entry.name}`)
        }
    }

    for (const relPath of relFiles) {
        const from = joinPath(projectDir, relPath)
        const to = joinPath(backupDir, relPath)
        await ensureDirectoryForFile(fs, to)
        try {
            const content = await fs.readFile(from)
            await fs.writeFile(to, content)
        } catch (err) {
            throw new Error(`Failed to backup file "${from}": ${String(err)}`)
        }
    }
}

export function serializeProject(project: LDtkProject): string {
    const filePath = resolveProjectFilePath(project)
    const savingData = prepareProjectSavingData(project, filePath)
    if (!validateProject(savingData.projectJson)) {
        throw new Error('Invalid LDtk project JSON; serialization aborted')
    }
    return savingData.projectJsonStr
}

export async function saveProjectToBuffer(project: LDtkProject): Promise<ArrayBuffer> {
    const jsonStr = serializeProject(project)
    const encoded = textEncoder.encode(jsonStr)
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)
}

export async function saveProject(project: LDtkProject, path: string): Promise<void> {
    const fs = assertElectronFs()
    const filePath = resolveProjectFilePath(project, path)
    const savingData = prepareProjectSavingData(project, filePath)

    if (!validateProject(savingData.projectJson)) {
        throw new Error('Invalid LDtk project JSON; save aborted')
    }

    if (project.backupOnSave) {
        await backupProjectFiles(project, filePath, fs)
    }

    await fs.writeFile(filePath, savingData.projectJsonStr)

    if (savingData.externalLevels.length > 0) {
        const baseDir = getDirectoryPath(filePath)
        const externalDir = joinPath(baseDir, getFileBaseName(getFileName(filePath)))
        await ensureDirectory(fs, externalDir)
        for (const level of savingData.externalLevels) {
            const fullPath = joinPath(baseDir, level.relPath)
            await ensureDirectoryForFile(fs, fullPath)
            await fs.writeFile(fullPath, level.jsonStr)
        }
    }

    project.filePath = filePath
}
