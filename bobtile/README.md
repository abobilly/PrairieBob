# BobTile - Tile Atlas Packer

A fast, local Windows tool for packing tile images into atlas PNGs. Designed for game dev workflows and **easy integration** with other editors.

---

## 🚀 Quick Start (for humans)

**Just want to use it?**

1. Run **`publish/BobTile.exe`** (self-contained, no install needed)
2. Drop tiles or select a folder
3. Click **Generate**

That's it. Output: `tileset.png` (+ optional `.tsx` for Tiled).

---

## 🤖 Integration Guide (for agents / editors)

**Building a tilemap editor? Integrate via CLI or library.**

| What | Where | Use Case |
|------|-------|----------|
| **CLI (recommended)** | `publish/bobtile-cli.exe` | Spawn from Electron/Node/any language. JSON in → JSON out. |
| **Desktop GUI** | `publish/BobTile.exe` | Human-facing WPF app. |
| **Core Engine** | `src/BobTile.Core/` | Reference as .NET library for in-process calls. |

### CLI Contract

**Request** (stdin or `--json file.json`):

```json
{
  "mode": "tiles",
  "inputMode": "files",
  "files": ["C:/tiles/grass.png", "C:/tiles/dirt.png"],
  "tileSize": 32,
  "columns": 16,
  "padding": 0,
  "extrudeEdges": false,
  "outputFolder": "C:/output",
  "outputFilename": "terrain",
  "generateTsx": true
}
```

**Response** (stdout):

```json
{
  "success": true,
  "outputPath": "C:/output/terrain.png",
  "tsxPath": "C:/output/terrain.tsx",
  "tileCount": 64,
  "rows": 4,
  "columns": 16,
  "atlasWidth": 512,
  "atlasHeight": 128,
  "durationMs": 87.5,
  "errors": null
}
```

**Modes:**

- `"tiles"` — pack individual tile images (folder or files)
- `"combine"` — merge existing tileset PNGs into one atlas

**Key files for integration:**

- `src/BobTile.Cli/PackRequest.cs` — request schema
- `src/BobTile.Cli/PackResponse.cs` — response schema
- `src/BobTile.Core/TilePacker.cs` — engine entry point
- `tools/BobTileAdapter.ts` — ready-to-use TypeScript adapter for Electron

### Example: Electron Integration

```typescript
import { packAtlas } from './adapters/BobTileAdapter';

const result = await packAtlas({
  mode: 'tiles',
  files: selectedTiles,
  tileSize: 32,
  outputFolder: projectPath,
  outputFilename: 'atlas',
  generateTsx: true
});

if (result.success) {
  reloadTileset(result.outputPath!);
}
```

---

## 📁 Project Structure

```
bobtile/
├── publish/
│   ├── BobTile.exe        ← GUI app (double-click to run)
│   └── bobtile-cli.exe    ← CLI for integrations
├── src/
│   ├── BobTile/           ← WPF desktop app
│   ├── BobTile.Core/      ← Core engine (no UI)
│   └── BobTile.Cli/       ← CLI wrapper
├── tools/
│   ├── BobTileAdapter.ts  ← TypeScript adapter for Electron
│   └── RegisterJoinInBobTile.ps1
├── bobtile_icon.ico       ← App icon (only icon asset)
├── bobtile_icon.png       ← App icon (PNG version)
└── README.md
```

---

## Features

- Pack individual tiles or combine existing tilesets
- Configurable tile size, columns, padding
- 1px edge extrusion (prevents texture bleeding)
- Nearest-neighbor resize for mismatched tiles
- `.tsx` export for Tiled map editor
- Natural sort (tile_2 before tile_10)
- 100% local, no network/telemetry

## Requirements

- Windows 10/11 (x64)
- No install needed (self-contained .exe)

## Building from Source

```powershell
# GUI
dotnet publish src/BobTile/BobTile.csproj -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish/

# CLI
dotnet publish src/BobTile.Cli/BobTile.Cli.csproj -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish/
```

## Icon Policy

This repo uses **only** `bobtile_icon.ico` and `bobtile_icon.png`. No other icon assets.

## License

MIT
