# SpudTile

LDtk-compatible tile map editor built with React + TypeScript + Vite + Electron.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) LTS (v20+)

### Install & Run (Development)

```bash
npm install
npm run dev            # Vite dev server (browser)
npm run electron:dev   # Full Electron app with hot reload
```

### Build & Package

```bash
npm run build                         # TypeScript check + Vite production build
npm run electron:compile              # Compile Electron main process to CJS
npx electron-builder --win --dir      # Package into release/win-unpacked/
```

The packaged app is at `release/win-unpacked/SpudTile.exe`.

To build a distributable installer:

```bash
npx electron-builder --win            # Creates NSIS installer in release/
```

### Keyboard Shortcuts

| Key | Tool |
|-----|------|
| B | Brush |
| F | Fill |
| R | Rectangle |
| E | Eraser |
| G | Toggle Grid |

---

## Features

- **Tile painting** — Brush, fill, rectangle, eraser tools
- **Layer management** — Floor, Walls, Trim, Overlays, Collision, Entities
- **Entity placement** — NPCs, doors, spawn points with properties
- **LDtk data model** — Native LDtk format support
- **Export** — JSON format compatible with Tiled/LDtk
- **Embedded AI Agent** — Chat or terminal interface powered by Copilot SDK

---

## Stack

| Layer | Tech |
|-------|------|
| UI | React 19, TypeScript, Vite 7 |
| State | Zustand + Immer |
| Components | shadcn/ui, @phosphor-icons/react |
| Desktop | Electron 36 |
| Data Model | LDtk format (`src/lib/ldtk/`) |
| Build | Vite + electron-builder |

## Project Structure

```
src/
  components/    # React components (panels in components/panels/)
  stores/        # Zustand stores with Immer middleware
  lib/ldtk/      # LDtk types, tools, data model
  hooks/         # Custom React hooks
electron/        # Electron main/preload process
samples/         # Sample projects (cottage)
public/          # Static assets and tilesets
```

## Copilot SDK Integration

SpudTile embeds GitHub Copilot as an AI assistant that can directly manipulate maps.

### Agent Tools

- `paint_tiles` — Paint tiles on any layer
- `fill_layer` — Fill a layer or region
- `place_entity` — Add entities (door, npc, spawn_point, trigger, prop)
- `export_map` — Export to kimbar/tiled/json
- `get_map_info` — Query current map state
- `list_tiles` — List available tiles

## Known Issues

- **React 19 + Radix UI**: Radix Slider components (`@radix-ui/react-slider` 1.3.x) cause infinite re-render loops with React 19 due to reference comparison in `useControllableState`. Use native `<input type="range">` instead.

## Upgrade Dependencies

```bash
npm run upgrade
```

## License

MIT
