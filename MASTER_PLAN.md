# PrairieBob Master Plan

> A tile editor built for AI-assisted game development, with deep Copilot CLI integration and project linking.

## Why PrairieBob Exists

**The Problem**: Tiled and LDtk are excellent tools, but they don't know about your game's runtime. Every migration (LDtk → JSON → TMX) loses context. Assets get orphaned. Developers fear editing the megalevel because things break silently.

**The Solution**: An editor that:

1. Links directly to your game project's content folders
2. Shows animations and interactions live in the editor
3. Exposes a CLI surface for Copilot to manipulate maps programmatically
4. Tracks asset licensing for OpenGameArt compliance
5. Embeds BobTile for atlas packing

---

## Section 0: Project Linking & Startup (CRITICAL)

This is the **first thing users see** on launch. Make it prominent.

### 0.1 Linked Project Display

- [ ] Startup screen shows linked project name, path, and status
- [ ] Quick-access buttons: "Open Project Folder", "Open in VS Code"
- [ ] Quick file switcher for maps within the project
- [ ] Status indicators: last sync time, pending exports, Copilot CLI availability
- [ ] "No project linked" state with setup wizard

### 0.2 Project Configuration (`prairiebob.config.json`)

```json
{
  "linkedProjects": [
    {
      "name": "kimbar",
      "rootPath": "C:/Users/andre/lawchuck/badgey.org/kimbar",
      "contentPath": "public/content",
      "generatedPath": "public/generated",
      "specsPath": "specs",
      "exportFormat": "kimbar-leveldata",
      "tileSize": 16
    }
  ],
  "defaultProject": "kimbar",
  "copilotCliPath": null,
  "bobTilePath": "../BobTile"
}
```

### 0.3 Copilot CLI Access Display

- [ ] Show which paths Copilot can read/write
- [ ] Display available PrairieBob CLI commands
- [ ] "Copy CLI command" buttons for common operations
- [ ] Warning if linked project is outside accessible paths

### 0.4 Multi-Project Support

- [ ] Project switcher dropdown in toolbar
- [ ] Per-project settings and asset libraries
- [ ] Cross-project asset sharing (with licensing awareness)

---

## Section 1: Asset Management

### 1.1 Asset Library Browser

- [ ] Grid/list view toggle
- [ ] Filter by: type (tileset, sprite, prop), license, tags, project
- [ ] Search with fuzzy matching
- [ ] Drag-and-drop onto canvas
- [ ] Preview panel with metadata

### 1.2 Import Workflows

- [ ] Import from local filesystem
- [ ] Import from OpenGameArt (with license detection)
- [ ] Import from LPC Character Generator exports
- [ ] Batch import with folder scanning
- [ ] Duplicate detection (hash-based)

### 1.3 Licensing Structure

```text
assets/
├── cc0/           # Public domain - no attribution required
├── cc-by/         # Attribution required
│   └── CREDITS.md # Auto-generated credits file
├── cc-by-sa/      # Attribution + ShareAlike
│   └── CREDITS.md
├── ogl/           # Open Gaming License
│   └── LICENSE.txt
└── custom/        # Project-specific, not redistributable
```

- [ ] License picker on import
- [ ] Auto-generate CREDITS.md per folder
- [ ] License compatibility checker (warn if mixing incompatible)
- [ ] Export credits for game about screen

### 1.4 BobTile Integration

- [ ] Embed all existing BobTile features
- [ ] Atlas packing with configurable padding/extrusion
- [ ] Sprite slicing from sheets
- [ ] Animation frame extraction
- [ ] Export to linked project's asset path

---

## Section 2: Tileset Management

### 2.1 Tileset Editor

- [ ] Visual tile picker
- [ ] Tile property editor (collision, animation, custom)
- [ ] Auto-tile rule definition
- [ ] Terrain brush configuration
- [ ] Tile variants (random selection on paint)
- [ ] Tileset slices/groups + tilegroups (YATE-style)

### 2.2 Tileset Registry

- [ ] Central tileset manifest
- [ ] Version tracking per tileset
- [ ] Dependency graph (which maps use which tilesets)
- [ ] Orphan detection (unused tilesets)
- [ ] Deterministic output layout editor (manual placement, no auto-arrange)

### 2.3 Auto-Tiling

- [ ] Wang tile support (blob, corner, edge)
- [ ] Context-aware painting
- [ ] Custom rule definitions
- [ ] Preview mode before commit

---

## Section 3: Map Editing

### 3.1 Canvas

- [ ] Pan/zoom with mouse and keyboard
- [ ] Zoom controls (mouse wheel, toolbar +/- buttons, reset to 100%, 0.25x–4x)
- [ ] Center/reset view button
- [ ] Grid overlay toggle
- [ ] Chunk boundaries display
- [ ] Layer visibility toggles
- [ ] Selection tools (rect, lasso, magic wand)
- [ ] Selection clipboard (copy/paste)

### 3.2 Painting Tools

- [ ] Brush (single tile)
- [ ] Bucket fill
- [ ] Line tool
- [ ] Rectangle/ellipse fill
- [ ] Stamp (multi-tile pattern)
- [ ] Eyedropper (pick tile from map)
- [ ] Eraser

### 3.3 Layers

- [ ] Unlimited layers
- [ ] Layer groups/folders
- [ ] Blend modes (normal, multiply, overlay for lighting)
- [ ] Decal layers (free image placement)
- [ ] Grid layers (metadata overlays)
- [ ] Layer templates (e.g., "Standard Room" = Floor, Walls, Trim, Overlays, Collision, Entities)
- [ ] Layer opacity controls (per-layer sliders)

### 3.4 World Management

- [ ] Multi-room world view
- [ ] Room connections visualization
- [ ] Drag rooms to reposition
- [ ] Snap-to-grid room placement
- [ ] Infinite maps (expand as needed)
- [ ] World files for grouping maps (Tiled-style)

---

## Section 4: Entity System

### 4.1 Entity Placement

- [ ] Entity palette from linked project's specs
- [ ] Drag-and-drop placement
- [ ] Entity property panel
- [ ] Custom property definitions

### 4.2 Entity Types (from kimbar)

- [ ] NPCs (with character spec reference)
- [ ] Doors (with target room/spawn)
- [ ] Triggers (interaction zones)
- [ ] Spawn points (player, NPC)
- [ ] Props (interactable objects)

### 4.3 Entity Validation

- [ ] Required property warnings
- [ ] Invalid reference detection (missing target room, etc.)
- [ ] Entity ID uniqueness check

---

## Section 5: Interactions & Animations (The Door Problem)

This is why PrairieBob exists. Tiled can't do this.

### 5.1 Interaction Definitions

```json
{
  "id": "door_wooden",
  "type": "door",
  "states": {
    "closed": { "tiles": [[1, 2], [3, 4]], "collision": true },
    "open": { "tiles": [[5, 6], [7, 8]], "collision": false }
  },
  "transitions": {
    "closed→open": { "animation": "door_open_anim", "duration": 300 },
    "open→closed": { "animation": "door_close_anim", "duration": 300 }
  },
  "defaultState": "closed"
}
```

### 5.2 Live Preview

- [ ] Toggle interaction states in editor
- [ ] Play transition animations
- [ ] See collision changes in real-time
- [ ] "Play mode" to test interactions without launching game

### 5.3 Interaction Types

- [ ] Doors (open/close)
- [ ] Chests (closed/open/empty)
- [ ] Levers/switches (on/off)
- [ ] Destructible objects
- [ ] Custom state machines

### 5.4 Animation Preview

- [ ] NPC walk cycles on canvas
- [ ] Animated tiles (water, fire, etc.)
- [ ] Particle effects preview
- [ ] Frame-by-frame scrubber

---

## Section 6: Validation & Diagnostics

### 6.1 Map Validation

- [ ] Missing tile references
- [ ] Invalid entity properties
- [ ] Unreachable areas detection
- [ ] Door target validation
- [ ] Layer order warnings

### 6.2 Project Sync

- [ ] Detect changes in linked project
- [ ] Two-way sync for shared assets
- [ ] Conflict resolution UI
- [ ] Dry-run export preview

### 6.3 Diagnostics Panel

- [ ] Memory usage
- [ ] Asset loading times
- [ ] Export history log
- [ ] Error/warning aggregation

---

## Section 7: Export System

### 7.1 Export Formats

- [ ] KimBar LevelData JSON (primary)
- [ ] Tiled TMX/TSX (for compatibility)
- [ ] LDtk (for compatibility)
- [ ] Raw JSON (custom schema)

### 7.2 KimBar-Specific Export

```typescript
interface LevelData {
  id: string;
  width: number;
  height: number;
  tileSize: number;
  layers: LayerData[];
  entities: EntityData[];
  interactions: InteractionData[];
  metadata: {
    editedAt: string;
    exportedFrom: "prairiebob";
    version: string;
  };
}
```

### 7.3 Export Workflow

- [ ] One-click export to linked project path
- [ ] Batch export all modified maps
- [ ] Pre-export validation
- [ ] Post-export hooks (run scripts)

---

## Section 8: Copilot CLI Integration

### 8.1 Command Surface

```bash
# Map operations
prairiebob open <map-id>
prairiebob create <map-id> --template <template>
prairiebob export <map-id> --format kimbar
prairiebob list maps

# Painting operations
prairiebob paint <map-id> --layer Floor --tile grass --rect 0,0,10,10
prairiebob fill <map-id> --layer Walls --tile wall_stone --region selection
prairiebob autotile <map-id> --layer Walls --ruleset interior_walls

# Entity operations
prairiebob spawn <map-id> --entity npc --type justice_roberts --at 5,3
prairiebob connect <door-id> --to <room-id> --spawn <spawn-id>

# Asset operations
prairiebob import <file> --license cc0 --tags "tileset,interior"
prairiebob pack --output atlas.png --input ./tiles/
```

### 8.2 Copilot Integration Points

- [ ] Command history panel
- [ ] "Generate CLI command" from current selection
- [ ] Undo/redo via CLI
- [ ] Scriptable macros

### 8.3 Batch Operations

- [ ] Process multiple maps with single command
- [ ] Regex-based tile replacement
- [ ] Bulk entity property updates
- [ ] Migration scripts

---

## Section 9: UI/UX

### 9.1 Layout

- [ ] Dockable panels
- [ ] Layout presets (painting, entity, world)
- [ ] Keyboard shortcut customization
- [ ] Dark/light theme
- [ ] Professional desktop UI styling (VS Code/Tiled vibe)

### 9.2 Toolbar

- [ ] Tool palette (select, paint, erase, entity)
- [ ] Linked project indicator
- [ ] Undo/redo buttons + history stack (Ctrl+Z/Ctrl+Y)
- [ ] Quick export button

### 9.3 Status Bar

- [ ] Cursor position (tile coordinates)
- [ ] Current layer
- [ ] Zoom level
- [ ] Unsaved changes indicator

---

## Section 10: Persistence

### 10.1 Project Files

- [ ] `.prairiebob` project folder
- [ ] `prairiebob.config.json` - project settings
- [ ] `assets.json` - asset library manifest
- [ ] `tilesets/` - tileset definitions
- [ ] `maps/` - map files (internal format)
- [ ] `interactions/` - interaction definitions

### 10.2 Autosave

- [ ] Periodic autosave
- [ ] Crash recovery
- [ ] Version history (local)

---

## Section 11: Performance

### 11.1 Large Map Support

- [ ] Chunked rendering
- [ ] Viewport culling
- [ ] Level-of-detail for zoomed out view
- [ ] Lazy asset loading

### 11.2 Caching

- [ ] Tile texture atlas caching
- [ ] Parsed map caching
- [ ] Asset thumbnail caching

---

## Section 12: Extensibility

### 12.1 Plugin System (Future)

- [ ] Custom tool plugins
- [ ] Custom export formats
- [ ] Custom entity types
- [ ] Custom validation rules

### 12.2 Scripting (Future)

- [ ] JavaScript/TypeScript macros
- [ ] Event hooks (on-save, on-export, etc.)
- [ ] Custom UI panels
- [ ] Custom tools/actions + custom file formats (Tiled-style)

---

## Priority Tiers

### Tier 1: MVP (GitHub Spark Target)

Core editing experience with project linking.

- [x] Section 0: Project linking & startup display
- [x] Section 1.1: Asset library browser (basic) — TilesetPanel.tsx
- [x] Section 2.1: Tileset editor (basic tile picker) — TilesetPanel.tsx
- [x] Section 3.1-3.2: Canvas + painting tools — MapCanvas.tsx, Toolbar.tsx
- [x] Section 4.1: Entity placement (basic) — EntityPalette.tsx
- [ ] Section 5.1-5.2: Simple interactions (door open/close preview) ⚠️ LOCAL
- [ ] Section 7.2: KimBar export ⚠️ LOCAL

### Tier 1.5: Local Polish (Post-Spark)

Features easier to implement locally than in Spark.

- [ ] **Undo/Redo system** — History stack for paint operations, Ctrl+Z/Ctrl+Y, toolbar buttons
- [ ] **Zoom controls** — Mouse wheel (0.25x–4x), toolbar buttons, reset to 100%
- [ ] **Copy/paste** — Selection clipboard, Ctrl+C/Ctrl+V
- [ ] **Eyedropper tool** — Sample tile from existing map (I key)
- [ ] **Layer opacity** — Slider control per layer
- [ ] **Professional theme** — Dark IDE aesthetic, less cutesy
- [ ] **File System Access API** — Direct project folder linking

### Tier 2: Usable

Full editing workflow.

- [ ] Section 1.2-1.3: Import workflows + licensing
- [ ] Section 2.2-2.3: Tileset registry + auto-tiling
- [ ] Section 3.3-3.4: Layers + world management
- [ ] Section 4.2-4.3: Entity types + validation
- [ ] Section 5.3-5.4: All interaction types + animation preview
- [ ] Section 6: Validation & diagnostics

### Tier 3: Powerful

AI-assisted content creation.

- [ ] Section 8: Full Copilot CLI integration
- [ ] Section 1.4: BobTile integration
- [ ] Section 7.1: Multiple export formats
- [ ] Section 9: Polished UI/UX

### Tier 4: Extensible

Plugin ecosystem.

- [ ] Section 10.2: Autosave + version history
- [ ] Section 11: Performance optimizations
- [ ] Section 12: Plugin system + scripting

---

## Technical Decisions

### Platform

- **Tier 1**: GitHub Spark (web-based, rapid prototyping)
- **Tier 2+**: Migrate to Electron + React if Spark limits hit

### Stack

- React for UI
- Canvas 2D or PixiJS for rendering
- IndexedDB for local persistence
- File System Access API for project linking

### Data Format

- Internal: JSON with schema validation
- Export: Transform to target format (kimbar, Tiled, etc.)

---

## Integration with kimbar

### Content Paths

```text
kimbar/
├── public/content/        ← PrairieBob reads tilesets, sprites
│   ├── tiled/rooms/       ← PrairieBob exports maps here
│   └── tiled/worlds/      ← PrairieBob exports world manifest
├── public/generated/      ← PrairieBob can read generated assets
├── specs/                 ← PrairieBob reads entity definitions
│   ├── characters/        ← NPC specs for entity palette
│   ├── rooms/             ← Room specs (metadata)
│   └── room_entries/      ← Room entries (door targets)
└── schemas/               ← PrairieBob validates against these
```

### Export Contract

PrairieBob exports must pass `npm run validate:tiled` in kimbar.

---

## Spark MVP Status (tier_1_draft/)

**Completed by Spark:**

- [x] React + Vite + TypeScript scaffolding
- [x] Radix UI component library
- [x] MapCanvas.tsx - basic canvas rendering
- [x] TilesetPanel.tsx - tile picker sidebar
- [x] LayerPanel.tsx - layer visibility toggles  
- [x] EntityPalette.tsx - entity type selection
- [x] PropertiesPanel.tsx - property editing
- [x] Toolbar.tsx - tool selection
- [x] Fill tool + Rectangle tool

**Needs implementation locally:**

- [ ] Undo/Redo system for paint operations (Ctrl+Z/Ctrl+Y, toolbar buttons)
- [ ] Zoom controls (mouse wheel, toolbar buttons, reset to 100%, 0.25x–4x)
- [ ] Copy/paste selection
- [ ] Eyedropper tool (pick tile from existing map)
- [ ] Layer opacity controls (per layer)
- [ ] Door interaction state preview (THE killer feature)
- [ ] KimBar export format
- [ ] Project linking (File System Access API)
- [ ] Professional dark theme (less "cutesy web app")

---

## Open Source Editor Analysis

### Tiled (mapeditor/tiled)

- **License:** GPLv2 for the app, with BSD (libtiled) and Apache 2.0 present for some components
- **Stack:** C++ / Qt
- **UI/feature highlights (mapeditor.org):** object layers (rect/ellipse/polygon), terrain painting, rule-based automapping, infinite maps, world organization, projects, customizable shortcuts, JS scripting for tools/actions/formats, wide export targets
- **Reuse:** Reference TMX/TSX docs and UX patterns only (avoid code)

### LDtk (deepnight/ldtk)

- **License:** MIT
- **Stack:** Haxe + Electron
- **UI/feature highlights (README):** modern, efficient, user-friendly 2D level editor
- **Reuse:** Workflow concepts + schema ideas; code reuse would require porting

### Ogmo Editor 3 CE

- **License:** MIT
- **Stack:** Haxe + Electron
- **UI/feature highlights (ogmo-editor-3.github.io):** project-based workflow, layer types (tile, decal, entity, grid), JSON export
- **Reuse:** Layer model and project structure inspiration

### DTile

- **License:** AGPL-3.0
- **Stack:** Web (Polymer), Chrome-only, alpha
- **UI/feature highlights (README):** browser-based, plugin-friendly, alpha
- **Reuse:** Avoid due to AGPL and outdated stack

### YATE (Yet Another TileSet Editor)

- **License:** MIT listed on the official site (repo license file not found via raw URLs; confirm before reuse)
- **Stack:** Flutter/Dart app + Python CLI + ImageMagick
- **UI/feature highlights (yetanothertileseteditor.qwaevisz.hu):** scriptable tileset generation, reproducible manual layout, tileset slices/groups/tilegroups, CLI pipeline, version-control-friendly project JSON
- **Reuse:** Borrow tileset pipeline ideas; good match for BobTile/CLI workflow

### Takeaways for PrairieBob

- Build fresh in React; avoid direct code reuse from C++/Haxe/Dart stacks.
- Add/keep: terrain painting + rule-based placement (Tiled), project-based workflow + layer types (Ogmo), deterministic tileset layout + CLI pipeline (YATE).

---

## Integration Checklist

### Before First Local Edit

- [ ] Clone `tier_1_draft/` as main source
- [ ] Run `npm install`
- [ ] Verify `npm run dev` works
- [ ] Add `.gitignore` for node_modules
- [ ] Initialize git repo

### Priority Local Tasks (Tier 1.5)

1. **Undo/Redo** - Add history stack, wire Ctrl+Z/Y
2. **Zoom controls** - Mouse wheel + toolbar buttons
3. **Eyedropper** - Sample tile from canvas (I key)
4. **Dark theme** - Professional IDE aesthetic
5. **Door preview** - Toggle open/closed states visually
6. **Export** - Generate kimbar-compatible JSON

### Asset Integration

- [ ] Copy `demo_tileset_2.png` to `tier_1_draft/public/`
- [ ] Add kimbar tilesets as importable assets
- [ ] Wire File System Access API for project linking

---

## Next Steps

1. ~~Generate GitHub Spark Tier 1 prompt~~ ✅ Done
2. ~~Create prairiebob.config.json template~~ ✅ Done  
3. ~~Build MVP in Spark~~ ✅ Done (tier_1_draft/)
4. **Integrate Spark output** - Clone to main, install deps
5. **Implement local features** - Undo/redo, zoom, dark theme
6. **Add killer feature** - Door interaction preview
7. **Wire to kimbar** - File System Access API + export

---

Last updated: 2026-01-29
