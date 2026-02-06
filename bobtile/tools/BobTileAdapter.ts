/**
 * BobTile CLI Adapter for SpudTile (Electron)
 * 
 * Spawns bobtile-cli.exe and communicates via JSON stdin/stdout.
 * Place bobtile-cli.exe in your project or reference it by path.
 */

import { spawn } from 'child_process';
import path from 'path';

export interface PackRequest {
  /** "tiles" = individual tile images, "combine" = merge existing tilesets */
  mode: 'tiles' | 'combine';
  /** Input mode for tiles: "folder" or "files" */
  inputMode?: 'folder' | 'files';
  /** Folder path (when inputMode = "folder") */
  folderPath?: string;
  /** List of input image paths (when inputMode = "files" or mode = "combine") */
  files?: string[];
  /** For combine mode: per-tileset settings */
  tilesets?: { path: string; tileSize: number }[];
  /** Output tile size in pixels (default 32) */
  tileSize?: number;
  /** Number of columns in output atlas (0 = auto) */
  columns?: number;
  /** Padding around each tile in output (default 0) */
  padding?: number;
  /** Extrude edge pixels by 1px to prevent bleeding */
  extrudeEdges?: boolean;
  /** Resize input images to tile size (nearest neighbor) */
  resizeToTileSize?: boolean;
  /** For combine mode: padding in source tilesets */
  sourcePadding?: number;
  /** For combine mode: start each tileset on a new row */
  startTilesetsOnNewRow?: boolean;
  /** Output folder path */
  outputFolder: string;
  /** Output filename (without extension) */
  outputFilename: string;
  /** Generate Tiled .tsx file alongside PNG */
  generateTsx?: boolean;
}

export interface PackResponse {
  success: boolean;
  outputPath?: string;
  tsxPath?: string;
  tileCount: number;
  rows: number;
  columns: number;
  atlasWidth: number;
  atlasHeight: number;
  durationMs: number;
  errors?: string[];
}

/**
 * Path to bobtile-cli.exe
 * Adjust this based on where you place the CLI in your project.
 * 
 * Options:
 * 1. Bundle in project: path.resolve(__dirname, '../bin/bobtile-cli.exe')
 * 2. Sibling folder:    path.resolve(__dirname, '../../bobtile/publish/bobtile-cli.exe')
 * 3. System PATH:       'bobtile-cli' (if installed globally)
 */
const BOBTILE_CLI_PATH = process.env.BOBTILE_CLI_PATH 
  || path.resolve(__dirname, '../../bobtile/publish/bobtile-cli.exe');

/**
 * Pack tiles or combine tilesets into an atlas using BobTile CLI.
 * 
 * @example
 * // Pack individual tiles
 * const result = await packAtlas({
 *   mode: 'tiles',
 *   files: ['assets/grass.png', 'assets/dirt.png'],
 *   tileSize: 32,
 *   columns: 16,
 *   outputFolder: 'output',
 *   outputFilename: 'terrain',
 *   generateTsx: true
 * });
 * 
 * @example
 * // Combine existing tilesets
 * const result = await packAtlas({
 *   mode: 'combine',
 *   files: ['tileset1.png', 'tileset2.png'],
 *   tileSize: 32,
 *   outputFolder: 'output',
 *   outputFilename: 'combined'
 * });
 */
export async function packAtlas(request: PackRequest): Promise<PackResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn(BOBTILE_CLI_PATH, ['--stdin'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        const response = JSON.parse(stdout) as PackResponse;
        resolve(response);
      } catch (e) {
        reject(new Error(
          `Failed to parse BobTile response (exit code ${code}):\n` +
          `stdout: ${stdout}\n` +
          `stderr: ${stderr}`
        ));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn bobtile-cli: ${err.message}`));
    });

    // Send request JSON to stdin
    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}

/**
 * Pack tiles from a folder.
 * Convenience wrapper around packAtlas.
 */
export async function packFolder(
  folderPath: string,
  outputFolder: string,
  outputFilename: string,
  options: Partial<Omit<PackRequest, 'mode' | 'inputMode' | 'folderPath' | 'outputFolder' | 'outputFilename'>> = {}
): Promise<PackResponse> {
  return packAtlas({
    mode: 'tiles',
    inputMode: 'folder',
    folderPath,
    outputFolder,
    outputFilename,
    ...options
  });
}

/**
 * Pack specific tile files.
 * Convenience wrapper around packAtlas.
 */
export async function packFiles(
  files: string[],
  outputFolder: string,
  outputFilename: string,
  options: Partial<Omit<PackRequest, 'mode' | 'inputMode' | 'files' | 'outputFolder' | 'outputFilename'>> = {}
): Promise<PackResponse> {
  return packAtlas({
    mode: 'tiles',
    inputMode: 'files',
    files,
    outputFolder,
    outputFilename,
    ...options
  });
}

/**
 * Combine existing tilesets into one atlas.
 * Convenience wrapper around packAtlas.
 */
export async function combineTilesets(
  tilesets: { path: string; tileSize: number }[],
  outputFolder: string,
  outputFilename: string,
  options: Partial<Omit<PackRequest, 'mode' | 'tilesets' | 'outputFolder' | 'outputFilename'>> = {}
): Promise<PackResponse> {
  return packAtlas({
    mode: 'combine',
    tilesets,
    outputFolder,
    outputFilename,
    ...options
  });
}

/**
 * Check if bobtile-cli is available.
 * Useful for showing/hiding BobTile integration features.
 */
export async function isBobTileAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(BOBTILE_CLI_PATH, ['--help'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}
