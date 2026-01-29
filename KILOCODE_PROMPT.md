# Kilocode Integration Prompt for PrairieBob Tilemap Editor

## Context

I have assembled reference implementations from **6 major tilemap/sprite editors** in the `Tile-Editor_*` prefixed folders. Your mission: systematically extract the best patterns, algorithms, and architecture from each and incorporate them into **PrairieBob** - our new React/TypeScript tilemap editor.

## Reference Implementations Available

### 1. `Tile-Editor_Tiled/` - Tiled Map Editor (Qt/C++)
**Steal these:**
- TMX/JSON format specifications (the industry standard)
- Terrain/autotile system (Wang tiles, corner/edge matching)
- Object layer architecture (points, polygons, polylines, text)
- Infinite map chunking system
- Custom properties system (per-tile, per-layer, per-object)
- Tile collision editor
- Animation frame sequencing

### 2. `Tile-Editor_LDtk/` - LDtk (Haxe)
**Steal these:**
- Auto-layer rules engine (the BEST autotile system)
- Entity/field definitions with typed properties
- Level hierarchy and world organization
- IntGrid system for collision/metadata layers
- Rule-based tile placement patterns
- Clean JSON schema design
- Real-time rule preview

### 3. `Tile-Editor_YATE/` - YATE (TypeScript/Electron)
**Steal these:**
- TypeScript architecture patterns (closest to our stack)
- Electron app structure (if we go desktop)
- React component organization
- State management approach

### 4. `Tile-Editor_Ogmo3/` - Ogmo Editor 3 (Haxe)
**Steal these:**
- Project/level separation model
- Entity definition system
- Grid-based vs freeform placement modes
- Decal layers for non-grid art
- Export customization system

### 5. `Tile-Editor_Godot/` - Godot Engine (C++/GDScript)
**Steal these:**
- TileSet resource architecture
- Physics/collision shape integration
- Navigation polygon baking
- Occlusion culling for 2D
- Terrain sets (their autotile successor)
- Tile alternatives/variations system
- Scene-as-tile embedding

### 6. `Tile-Editor_Asperite/extracted/` - Aseprite (C++) **NEW**
**Steal these:**
- `tilemap/tile.h` - Tile data structure (32-bit with flip flags)
- `tilemap/tileset.*` - Hash-based tile deduplication
- `tools/ink_processing.h` - 60KB of pixel manipulation algorithms
- `rendering/render.cpp` - Compositing/blending engine
- `document/grid.*` - Snap-to-grid system
- `algorithms/algo.*` - Bresenham lines, flood fill, polygons
- `selection/mask_boundaries.*` - Marching ants selection
- `commands/` - Full undo/redo command pattern
- `palette/` - Indexed color palette system

---

## Integration Priorities

### Phase 1: Core Data Model
1. **Tile format**: Use Aseprite's `tile_t` (32-bit with X/Y/diagonal flip flags)
2. **Tileset**: Combine Aseprite's hash deduplication + LDtk's rule definitions
3. **Layer types**: Tiled's layer hierarchy + LDtk's IntGrid + Godot's physics layers
4. **Project structure**: LDtk's world/level/layer model

### Phase 2: Drawing & Tools
1. **Pixel algorithms**: Port Aseprite's `algo.cpp` (Bresenham, flood fill)
2. **Tool system**: Aseprite's tool loop architecture
3. **Brush shapes**: Aseprite's `point_shapes.h`
4. **Selection**: Aseprite's mask system with marching ants

### Phase 3: Autotile Intelligence
1. **Rule engine**: LDtk's auto-layer rules (THE priority feature)
2. **Terrain matching**: Tiled's Wang tile system as fallback
3. **Godot terrain sets**: For 3x3 minimal mode

### Phase 4: Entity System
1. **Entity definitions**: LDtk's typed field system
2. **Object placement**: Tiled's object layer flexibility
3. **Prefab support**: Godot's scene-as-tile concept

### Phase 5: Export & Compatibility
1. **TMX export**: Tiled format for maximum compatibility
2. **LDtk export**: For projects using LDtk
3. **Custom JSON**: Our own optimized format

---

## Specific Files to Study

```
# Start with these key files:

# Tile data structure
Tile-Editor_Asperite/extracted/tilemap/tile.h

# Autotile rules (THE killer feature)
Tile-Editor_LDtk/src/data/def/AutoLayerRuleDef.hx
Tile-Editor_LDtk/src/data/def/AutoLayerRuleGroup.hx

# Drawing algorithms
Tile-Editor_Asperite/extracted/algorithms/algo.cpp
Tile-Editor_Asperite/extracted/tools/ink_processing.h

# TMX format reference
Tile-Editor_Tiled/src/libtiled/map.h
Tile-Editor_Tiled/src/libtiled/tileset.h

# Godot terrain system
Tile-Editor_Godot/scene/resources/tile_set.h
Tile-Editor_Godot/editor/plugins/tiles/

# Grid/snap system
Tile-Editor_Asperite/extracted/document/grid.cpp
```

---

## Technical Requirements

- **Stack**: React 18+, TypeScript, Zustand/Jotai, Canvas 2D (or WebGL)
- **No runtime deps** on any reference code (study & rewrite)
- **GPL compliance**: Aseprite code requires GPL-compatible license if used directly
- **Performance**: Target 60fps with 1000x1000 tile maps

---

## Your Mission

Do not rest until you have:

1. **Analyzed** the architecture of each reference implementation
2. **Identified** the 10 most valuable patterns/algorithms across all 6 codebases
3. **Ported** the core tilemap data model (combining the best of each)
4. **Implemented** LDtk-style auto-layer rules (this is the flagship feature)
5. **Built** Aseprite-quality drawing tools
6. **Created** a unified export system supporting TMX + LDtk + custom JSON

Start by exploring each `Tile-Editor_*` folder, then propose a concrete implementation plan with specific files to create/modify in PrairieBob.

**The goal**: A tilemap editor that has LDtk's intelligence, Aseprite's pixel-perfect tools, Tiled's compatibility, and Godot's physics integration - all in a modern React/TypeScript codebase.

Go.
