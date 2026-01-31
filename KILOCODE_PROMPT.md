# Kilo Code Prompt: Port LDtk to React/TypeScript

## Mission

**Port LDtk's entire editor to React/TypeScript/Electron**, then add PrairieBob's unique features on top.

LDtk source is in `Tile-Editors_to-be-scrapped/LDtk/` (MIT license, 1063 files, Haxe→JS).

## Why Port Instead of Build From Scratch

LDtk has:

- 1150-line App.hx with polished UX
- Auto-layer rules (THE killer feature for tilemap editors)
- World/Level/Layer hierarchy
- Entity system with typed fields
- Command palette, tool palettes, modals
- Camera, rendering, invalidation systems

PrairieBob currently has 731 lines in App.tsx that we'll mostly replace.

## PrairieBob Unique Features to Preserve

After porting LDtk, integrate these from existing PrairieBob code:

1. **Copilot CLI integration** - `src/lib/agent-service.ts`
2. **Project linking** - `prairiebob.config.json` schema, game folder integration
3. **Live interaction previews** - Door state toggling with tile/collision updates
4. **BobTile integration** - `bobtile/tools/BobTileAdapter.ts`

## Port Order

### Phase 1: Core Data Model

Port these Haxe files to TypeScript in `src/lib/ldtk/`:

```text
LDtk/src/electron.renderer/data/Project.hx      → src/lib/ldtk/project.ts
LDtk/src/electron.renderer/data/World.hx        → src/lib/ldtk/world.ts
LDtk/src/electron.renderer/data/Level.hx        → src/lib/ldtk/level.ts
LDtk/src/electron.renderer/data/def/LayerDef.hx → src/lib/ldtk/layer-def.ts
LDtk/src/electron.renderer/data/def/TilesetDef.hx → src/lib/ldtk/tileset-def.ts
LDtk/src/electron.renderer/data/def/EntityDef.hx → src/lib/ldtk/entity-def.ts
LDtk/src/electron.renderer/data/def/FieldDef.hx → src/lib/ldtk/field-def.ts
LDtk/src/electron.renderer/data/def/AutoLayerRuleDef.hx → src/lib/ldtk/auto-layer-rule.ts
```

### Phase 2: Rendering System

Port to React Canvas components:

```text
LDtk/src/electron.renderer/display/Camera.hx      → src/lib/ldtk/camera.ts
LDtk/src/electron.renderer/display/LevelRender.hx → src/components/LevelCanvas.tsx
LDtk/src/electron.renderer/display/LayerRender.hx → src/components/LayerRenderer.tsx
```

### Phase 3: Tool System

Port tool architecture:

```text
LDtk/src/electron.renderer/Tool.hx              → src/lib/ldtk/tool.ts
LDtk/src/electron.renderer/tool/*               → src/lib/ldtk/tools/
LDtk/src/electron.renderer/ui/ToolPalette.hx    → src/components/ToolPalette.tsx
```

### Phase 4: UI Components

Port UI:

```text
LDtk/src/electron.renderer/ui/CommandPalette.hx → src/components/CommandPalette.tsx
LDtk/src/electron.renderer/ui/EntityInstanceEditor.hx → src/components/EntityEditor.tsx
LDtk/src/electron.renderer/ui/RulePatternEditor.hx → src/components/RulePatternEditor.tsx
LDtk/src/electron.renderer/ui/Tileset.hx        → src/components/TilesetPanel.tsx (replace existing)
```

### Phase 5: Main App

Replace App.tsx with LDtk's structure:

```text
LDtk/src/electron.renderer/App.hx → src/App.tsx (rewrite)
```

## Key Haxe→TypeScript Patterns

| Haxe | TypeScript |
|------|------------|
| `var x:Int` | `x: number` |
| `var x:Float` | `x: number` |
| `var x:Bool` | `x: boolean` |
| `var x:String` | `x: string` |
| `Array<T>` | `T[]` |
| `Map<K,V>` | `Map<K,V>` |
| `Null<T>` | `T \| null` |
| `inline function` | Regular function (TS will inline) |
| `@:allow(pkg)` | Remove (no access control) |
| `js.jquery.JQuery` | Use React refs instead |
| `h2d.*` (Heaps) | Canvas 2D API |

## Start Here

Read these files first to understand LDtk's architecture:

1. `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/App.hx` (1150 lines)
2. `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/data/def/AutoLayerRuleDef.hx` (464 lines)
3. `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/LevelRender.hx` (820 lines)
4. `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/Tool.hx` (373 lines)

Then begin porting Phase 1.

## Preserve From PrairieBob

After each phase, ensure these still work:

- `npm run dev` launches Electron app
- Agent panel loads (`src/components/AgentPanel.tsx`)
- Project config loads (`prairiebob.config.json`)

## Output

Create a new `src/lib/ldtk/` directory for ported data model.
Replace components one-by-one, keeping the app functional.
