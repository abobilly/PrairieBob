# Reference Editors - Master Index

> Downloaded January 29, 2026 for PrairieBob integration study

## Quick Summary

| Editor | Language | License | Best For |
|--------|----------|---------|----------|
| **LDtk** | Haxe/Electron | MIT | Auto-layer rules, UI/UX patterns, project structure |
| **Tiled** | C++/Qt | GPL-2.0 | TMX format, Wang tiles, object layers |
| **Aseprite** | C++ | GPL (source) | Drawing algorithms, tool architecture, pixel manipulation |
| **Ogmo3** | Haxe | MIT | Entity definitions, project/level separation |

---

## 1. LDtk (`./LDtk/`) - **PRIMARY REFERENCE**

### Why LDtk First?

- Modern Electron app (same stack target as PrairieBob)
- Best-in-class auto-layer rules system
- Clean project/world/level/layer hierarchy
- MIT license = no restrictions

### Key Files to Study

#### Auto-Layer Rules (THE killer feature)

```
LDtk/src/electron.renderer/data/def/AutoLayerRuleDef.hx     # Rule definition (patterns, flip, modulo)
LDtk/src/electron.renderer/data/def/AutoLayerRuleGroupDef.hx # Rule grouping
LDtk/src/electron.renderer/ui/RulePatternEditor.hx          # Pattern editor UI
```

#### Data Model

```
LDtk/src/electron.renderer/data/Project.hx                  # Project root
LDtk/src/electron.renderer/data/Level.hx                    # Level structure
LDtk/src/electron.renderer/data/World.hx                    # World container
LDtk/src/electron.renderer/data/def/LayerDef.hx             # Layer definitions
LDtk/src/electron.renderer/data/def/TilesetDef.hx           # Tileset definitions
LDtk/src/electron.renderer/data/def/EntityDef.hx            # Entity definitions
LDtk/src/electron.renderer/data/def/FieldDef.hx             # Typed field system
```

#### Tool Architecture

```
LDtk/src/electron.renderer/Tool.hx                          # Base tool class
LDtk/src/electron.renderer/tool/                            # Tool implementations
LDtk/src/electron.renderer/ui/ToolPalette.hx                # Tool palette UI
```

#### Rendering

```
LDtk/src/electron.renderer/display/LevelRender.hx           # Level rendering (820 lines!)
LDtk/src/electron.renderer/display/LayerRender.hx           # Layer rendering
LDtk/src/electron.renderer/display/EntityRender.hx          # Entity rendering
LDtk/src/electron.renderer/display/Camera.hx                # Camera/viewport
```

#### UI Components

```
LDtk/src/electron.renderer/ui/CommandPalette.hx             # Ctrl+P style palette
LDtk/src/electron.renderer/ui/EntityInstanceEditor.hx       # Entity property editor
LDtk/src/electron.renderer/ui/Tileset.hx                    # Tileset panel
LDtk/src/electron.renderer/ui/modal/                        # Modal dialogs
```

#### App Entry

```
LDtk/src/electron.renderer/App.hx                           # Main app (1150 lines)
LDtk/app/assets/app.html                                    # HTML structure
LDtk/app/package.json                                       # Electron config
```

### LDtk Auto-Layer Rule Structure

```typescript
// Ported concept from AutoLayerRuleDef.hx
interface AutoLayerRule {
  uid: number
  size: number           // Pattern size (3x3, 5x5, 7x7)
  pattern: number[]      // NxN grid of tile matchers
  tileRectsIds: number[][] // Tiles to place when matched
  chance: number         // 0-1 probability
  breakOnMatch: boolean  // Stop checking further rules
  flipX: boolean         // Generate X-flipped variant
  flipY: boolean         // Generate Y-flipped variant
  xModulo: number        // Apply every N cells
  yModulo: number
  checker: 'None' | 'Horizontal' | 'Vertical'
  perlinActive: boolean  // Perlin noise variation
  perlinScale: number
  perlinOctaves: number
}
```

---

## 2. Tiled (`./Tiled/`) - **FORMAT REFERENCE**

### Why Tiled?

- Industry-standard TMX/JSON format
- Wang tile system (terrain autotiles)
- Object layer architecture
- Extensive plugin ecosystem

### Key Files to Study

#### Core Data Structures

```
Tiled/src/libtiled/map.h            # Map structure
Tiled/src/libtiled/map.cpp
Tiled/src/libtiled/tileset.h        # Tileset with animation frames
Tiled/src/libtiled/tileset.cpp
Tiled/src/libtiled/tile.h           # Individual tile with properties
Tiled/src/libtiled/tile.cpp
Tiled/src/libtiled/tilelayer.h      # Tile layer (chunks for infinite maps)
Tiled/src/libtiled/tilelayer.cpp
```

#### Object System

```
Tiled/src/libtiled/mapobject.h      # Points, rects, polygons, text
Tiled/src/libtiled/mapobject.cpp
Tiled/src/libtiled/objectgroup.h    # Object layer
Tiled/src/libtiled/objectgroup.cpp
```

#### Wang Tiles (Terrain Autotiles)

```
Tiled/src/libtiled/wangset.h        # Wang tile definitions
Tiled/src/libtiled/wangset.cpp
```

#### File Format

```
Tiled/src/libtiled/tmxmapformat.h   # TMX reading/writing
Tiled/src/libtiled/tmxmapformat.cpp
Tiled/src/libtiled/mapreader.cpp    # XML parsing
Tiled/src/libtiled/mapwriter.cpp    # XML writing
Tiled/src/libtiled/maptovariantconverter.cpp  # JSON conversion
```

#### Properties System

```
Tiled/src/libtiled/properties.h     # Custom properties (per-tile, per-object)
Tiled/src/libtiled/properties.cpp
Tiled/src/libtiled/propertytype.h   # Typed properties (enum, class)
```

#### Rendering

```
Tiled/src/libtiled/orthogonalrenderer.cpp   # Standard grid
Tiled/src/libtiled/isometricrenderer.cpp    # Isometric
Tiled/src/libtiled/hexagonalrenderer.cpp    # Hex grids
Tiled/src/libtiled/staggeredrenderer.cpp    # Staggered iso
```

---

## 3. Aseprite (`./Aseprite/`) - **ALGORITHM REFERENCE**

### Why Aseprite?

- Pixel-perfect drawing algorithms
- Professional tool architecture
- Undo/redo command pattern
- Selection/mask systems

### Key Files to Study

#### Drawing Algorithms (GOLD MINE)

```
Aseprite/src/app/tools/ink_processing.h     # 60KB of pixel manipulation!
Aseprite/src/app/tools/point_shape.cpp      # Brush shapes
Aseprite/src/app/tools/point_shapes.h       # Circle, square, spray
Aseprite/src/app/tools/stroke.cpp           # Stroke interpolation
Aseprite/src/app/tools/intertwine.cpp       # Pixel-perfect lines
```

#### Tool System

```
Aseprite/src/app/tools/tool.h               # Base tool interface
Aseprite/src/app/tools/tool_loop.h          # Tool execution loop
Aseprite/src/app/tools/tool_loop_manager.cpp
Aseprite/src/app/tools/active_tool.cpp
Aseprite/src/app/tools/ink.h                # Ink types (normal, shading, etc)
Aseprite/src/app/tools/inks.h
Aseprite/src/app/tools/controller.h         # Input handling
Aseprite/src/app/tools/controllers.h
```

#### Grid & Snapping

```
Aseprite/src/app/snap_to_grid.cpp           # Grid snapping logic
Aseprite/src/app/snap_to_grid.h
```

#### Undo/Redo (Command Pattern)

```
Aseprite/src/app/cmd/                       # All edit commands
Aseprite/src/app/cmd.h                      # Base command class
Aseprite/src/app/cmd_sequence.cpp           # Compound commands
Aseprite/src/app/transaction.cpp            # Transaction wrapper
Aseprite/src/undo/                          # Undo stack
```

#### Rendering

```
Aseprite/src/render/                        # Rendering pipeline
Aseprite/src/app/render/                    # App-specific rendering
```

#### UI Components

```
Aseprite/src/app/ui/                        # UI widgets
Aseprite/src/ui/                            # Base UI framework
```

---

## 4. Ogmo3 (`./Ogmo3/`) - **SCHEMA REFERENCE**

### Why Ogmo?

- Simple entity definition system
- Clean project/level separation
- Good TypeScript integration (has TS loader)

### Key Files

```
Ogmo3/ogmo/                    # Core library (small, focused)
```

---

## Integration Priority for PrairieBob

### Phase 1: Replace UI/UX (LDtk-style)

1. Study `LDtk/src/electron.renderer/App.hx` for overall structure
2. Port `LDtk/src/electron.renderer/display/Camera.hx` for viewport handling
3. Implement command palette from `LDtk/src/electron.renderer/ui/CommandPalette.hx`

### Phase 2: Auto-Layer Rules (LDtk)

1. Port `AutoLayerRuleDef.hx` to TypeScript
2. Create rule pattern editor UI
3. Implement rule evaluation in `MapCanvas`

### Phase 3: Drawing Tools (Aseprite)

1. Study `ink_processing.h` for pixel algorithms
2. Port Bresenham line drawing (you already have some of this!)
3. Add brush shapes from `point_shapes.h`

### Phase 4: Format Compatibility (Tiled)

1. Implement TMX/JSON import from `tmxmapformat.cpp`
2. Export to Tiled JSON format
3. Support Wang tile import

---

## Running These Editors

### LDtk (requires building)

```powershell
cd Tile-Editors_to-be-scrapped/LDtk/app
npm install
npm start  # Requires Haxe compiler and built assets
```

Or just download the release: <https://ldtk.io/>

### Tiled (just download)
<https://www.mapeditor.org/download.html>

### Aseprite (requires building or purchase)
<https://www.aseprite.org/>
(Source is GPL, but binaries are paid - build from source if needed)

---

## License Notes

| Editor | License | Can Use Code? |
|--------|---------|---------------|
| LDtk | MIT | ✅ Yes, freely |
| Tiled | GPL-2.0 | ⚠️ Must GPL your project OR rewrite from scratch |
| Aseprite | GPL (source) | ⚠️ Same as Tiled - study & rewrite, don't copy |
| Ogmo3 | MIT | ✅ Yes, freely |

**Recommendation**: Study Tiled/Aseprite algorithms, but write your own implementations. LDtk patterns can be ported more directly due to MIT license.
