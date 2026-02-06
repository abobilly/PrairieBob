# PrairieBob LDtk Port - Task Map

> Generated 2026-01-29 | Total: ~45 tasks across 5 phases

## Status Legend

- ⬜ Not started
- 🟡 In progress  
- ✅ Complete

---

## Phase 1: Core Data Model ✅ COMPLETE

| Task | Source | Target | Lines | Status |
|------|--------|--------|-------|--------|
| Types & Enums | LDtk JSON Schema | `src/lib/ldtk/types.ts` | ~230 | ✅ |
| Project | `data/Project.hx` | `src/lib/ldtk/project.ts` | ~220 | ✅ |
| World | `data/World.hx` | `src/lib/ldtk/world.ts` | ~170 | ✅ |
| Level | `data/Level.hx` | `src/lib/ldtk/level.ts` | ~170 | ✅ |
| LayerInstance | `data/inst/LayerInstance.hx` | `src/lib/ldtk/layer-instance.ts` | ~150 | ✅ |
| AutoLayerRule | `data/def/AutoLayerRuleDef.hx` | `src/lib/ldtk/auto-layer-rule.ts` | ~300 | ✅ |
| JSON I/O | Various | `src/lib/ldtk/json-io.ts` | ~280 | ✅ |

---

## Phase 2: Rendering System

### 2A. Camera & Viewport

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 2A.1 Camera | `display/Camera.hx` (392) | `src/lib/ldtk/camera.ts` | ~200 | ✅ |
| 2A.2 Viewport hooks | - | `src/hooks/useViewport.ts` | ~100 | ✅ |

### 2B. Level Rendering

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 2B.1 LevelRender | `display/LevelRender.hx` (650) | `src/components/LevelCanvas.tsx` | ~400 | ⬜ |
| 2B.2 LayerRender | `display/LayerRender.hx` (420) | `src/components/LayerRenderer.tsx` | ~250 | ⬜ |
| 2B.3 EntityRender | `display/EntityRender.hx` (380) | `src/components/EntityRenderer.tsx` | ~200 | ⬜ |
| 2B.4 FieldInstanceRender | `display/FieldInstanceRender.hx` (554) | `src/components/FieldRenderer.tsx` | ~300 | ⬜ |

### 2C. World Rendering

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 2C.1 WorldRender | `display/WorldRender.hx` (985) | `src/components/WorldCanvas.tsx` | ~500 | ⬜ |
| 2C.2 Rulers | `display/Rulers.hx` (280) | `src/components/Rulers.tsx` | ~150 | ⬜ |

---

## Phase 3: Tool System

### 3A. Core Tool Architecture

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 3A.1 Base Tool | `Tool.hx` (373) | `src/lib/ldtk/tools/tool.ts` | ~200 | ✅ |
| 3A.2 Tool Registry | - | `src/lib/ldtk/tools/registry.ts` | ~80 | ✅ |
| 3A.3 Tool Store | - | `src/stores/toolStore.ts` | ~150 | ⬜ |

### 3B. Layer Tools

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 3B.1 LayerTool base | `tool/LayerTool.hx` (290) | `src/lib/ldtk/tools/layer-tool.ts` | ~150 | ⬜ |
| 3B.2 IntGridTool | `tool/lt/IntGridTool.hx` (320) | `src/lib/ldtk/tools/intgrid-tool.ts` | ~180 | ⬜ |
| 3B.3 TileTool | `tool/lt/TileTool.hx` (380) | `src/lib/ldtk/tools/tile-tool.ts` | ~200 | ⬜ |
| 3B.4 EntityTool | `tool/lt/EntityTool.hx` (350) | `src/lib/ldtk/tools/entity-tool.ts` | ~180 | ⬜ |

### 3C. Navigation Tools

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 3C.1 PanView | `tool/PanView.hx` (120) | `src/lib/ldtk/tools/pan-tool.ts` | ~60 | ✅ |
| 3C.2 SelectionTool | `tool/SelectionTool.hx` (280) | `src/lib/ldtk/tools/selection-tool.ts` | ~150 | ⬜ |
| 3C.3 ResizeTool | `tool/ResizeTool.hx` (200) | `src/lib/ldtk/tools/resize-tool.ts` | ~100 | ⬜ |
| 3C.4 PickPoint | `tool/PickPoint.hx` (150) | `src/lib/ldtk/tools/pick-tool.ts` | ~80 | ✅ |

---

## Phase 4: UI Components

### 4A. Tool Palettes

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 4A.1 ToolPalette | `ui/ToolPalette.hx` (123) | `src/components/ToolPalette.tsx` | ~100 | ⬜ |
| 4A.2 TilePalette | `ui/palette/TilePalette.hx` (380) | `src/components/TilePalette.tsx` | ~250 | ⬜ |
| 4A.3 EntityPalette | `ui/palette/EntityPalette.hx` (280) | `src/components/EntityPalette.tsx` | ~180 | ⬜ |
| 4A.4 IntGridPalette | `ui/palette/IntGridPalette.hx` (220) | `src/components/IntGridPalette.tsx` | ~140 | ⬜ |

### 4B. Editors & Forms

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 4B.1 EntityInstanceEditor | `ui/EntityInstanceEditor.hx` (420) | `src/components/EntityEditor.tsx` | ~280 | ⬜ |
| 4B.2 FieldInstancesForm | `ui/FieldInstancesForm.hx` (827) | `src/components/FieldsForm.tsx` | ~500 | ⬜ |
| 4B.3 LevelInstanceForm | `ui/LevelInstanceForm.hx` (380) | `src/components/LevelEditor.tsx` | ~250 | ⬜ |
| 4B.4 RulePatternEditor | `ui/RulePatternEditor.hx` (253) | `src/components/RulePatternEditor.tsx` | ~200 | ⬜ |

### 4C. Tileset UI

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 4C.1 Tileset Panel | `ui/Tileset.hx` (652) | `src/components/TilesetPanel.tsx` | ~400 | ⬜ |

### 4D. Global UI

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 4D.1 CommandPalette | `ui/CommandPalette.hx` (320) | `src/components/CommandPalette.tsx` | ~200 | ⬜ |
| 4D.2 QuickSearch | `ui/QuickSearch.hx` (180) | `src/components/QuickSearch.tsx` | ~120 | ⬜ |
| 4D.3 Notification | `ui/Notification.hx` (150) | `src/components/Notification.tsx` | ~100 | ✅ |
| 4D.4 Cursor | `ui/Cursor.hx` (200) | `src/components/Cursor.tsx` | ~120 | ⬜ |

### 4E. Modals & Dialogs

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 4E.1 Modal base | `ui/Modal.hx` (280) | `src/components/Modal.tsx` | ~150 | ✅ |
| 4E.2 Dialog base | `ui/modal/Dialog.hx` (180) | `src/components/Dialog.tsx` | ~100 | ✅ |
| 4E.3 ContextMenu | `ui/modal/ContextMenu.hx` (220) | `src/components/ContextMenu.tsx` | ~140 | ⬜ |

### 4F. Definition Editors (Lower Priority)

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 4F.1 EditLayerDefs | `ui/modal/panel/EditLayerDefs.hx` (842) | `src/components/panels/LayerDefsPanel.tsx` | ~500 | ⬜ |
| 4F.2 EditEntityDefs | `ui/modal/panel/EditEntityDefs.hx` (601) | `src/components/panels/EntityDefsPanel.tsx` | ~350 | ⬜ |
| 4F.3 EditTilesetDefs | `ui/modal/panel/EditTilesetDefs.hx` (420) | `src/components/panels/TilesetDefsPanel.tsx` | ~280 | ⬜ |
| 4F.4 EditEnumDefs | `ui/modal/panel/EditEnumDefs.hx` (486) | `src/components/panels/EnumDefsPanel.tsx` | ~300 | ⬜ |
| 4F.5 EditAllAutoLayerRules | `ui/modal/panel/EditAllAutoLayerRules.hx` (975) | `src/components/panels/AutoRulesPanel.tsx` | ~600 | ⬜ |

---

## Phase 5: App Integration

### 5A. Main Editor

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 5A.1 Editor core | `Editor.hx` (2456) | `src/lib/ldtk/editor.ts` | ~800 | ⬜ |
| 5A.2 App.tsx rewrite | `App.hx` (961) | `src/App.tsx` | ~500 | ⬜ |

### 5B. Project I/O

| Task | Source (Lines) | Target | Est. Lines | Status |
|------|----------------|--------|------------|--------|
| 5B.1 ProjectLoader | `ui/ProjectLoader.hx` (420) | `src/lib/ldtk/project-loader.ts` | ~250 | ⬜ |
| 5B.2 ProjectSaver | `ui/ProjectSaver.hx` (660) | `src/lib/ldtk/project-saver.ts` | ~400 | ⬜ |

### 5C. PrairieBob Feature Re-integration

| Task | Source | Target | Est. Lines | Status |
|------|--------|--------|------------|--------|
| 5C.1 Agent integration | `src/lib/agent-service.ts` | Update for LDtk model | ~100 | ⬜ |
| 5C.2 Project linking | `prairiebob.config.json` | Bridge to LDtk Project | ~80 | ⬜ |
| 5C.3 Live previews | `src/components/PropertiesPanel.tsx` | Port door state system | ~150 | ⬜ |
| 5C.4 BobTile adapter | `bobtile/tools/BobTileAdapter.ts` | Update for LDtk tilesets | ~100 | ⬜ |

---

## Task Assignment Guide

### Complexity Tiers

**Tier 1 - Simple (< 150 lines, isolated)**

- ✅ 2A.2 Viewport hooks
- ✅ 3A.2 Tool Registry
- ✅ 3C.1 PanView
- ✅ 3C.4 PickPoint
- ⬜ 4A.1 ToolPalette
- ✅ 4D.3 Notification
- ✅ 4E.1 Modal base
- ✅ 4E.2 Dialog base
- ⬜ 5C.2 Project linking

**Tier 2 - Medium (150-300 lines, some deps)**

- ✅ 2A.1 Camera
- ⬜ 2B.3 EntityRender
- ⬜ 2C.2 Rulers
- ✅ 3A.1 Base Tool
- ⬜ 3A.3 Tool Store
- ⬜ 3B.1 LayerTool base
- ⬜ 3B.2 IntGridTool
- ⬜ 3B.4 EntityTool
- ⬜ 3C.2 SelectionTool
- ⬜ 3C.3 ResizeTool
- ✅ 4A.3 EntityPalette (exists, needs update)
- ⬜ 4A.4 IntGridPalette
- ⬜ 4B.4 RulePatternEditor
- ⬜ 4D.1 CommandPalette
- ⬜ 4D.2 QuickSearch
- ⬜ 4D.4 Cursor
- ⬜ 4E.3 ContextMenu
- ⬜ 5B.1 ProjectLoader
- ⬜ 5C.1 Agent integration
- ⬜ 5C.3 Live previews
- ⬜ 5C.4 BobTile adapter

**Tier 3 - Complex (300-500 lines, many deps)**

- ⬜ 2B.1 LevelRender
- ⬜ 2B.2 LayerRender
- ⬜ 2B.4 FieldInstanceRender
- ⬜ 3B.3 TileTool
- ⬜ 4A.2 TilePalette
- ⬜ 4B.1 EntityInstanceEditor
- ⬜ 4B.3 LevelEditor
- ⬜ 4C.1 Tileset Panel
- ⬜ 4F.2 EditEntityDefs
- ⬜ 4F.3 EditTilesetDefs
- ⬜ 4F.4 EditEnumDefs
- ⬜ 5B.2 ProjectSaver

**Tier 4 - Major (500+ lines, core system)**

- 2C.1 WorldRender
- 4B.2 FieldInstancesForm
- 4F.1 EditLayerDefs
- 4F.5 EditAllAutoLayerRules
- 5A.1 Editor core
- 5A.2 App.tsx rewrite

---

## Recommended Order

```
1. Phase 2A (Camera) → enables all rendering
2. Phase 3A (Tool base) → enables all tools
3. Phase 2B (Level/Layer render) → see tiles on screen
4. Phase 3B (Layer tools) → paint tiles
5. Phase 4A (Palettes) → select what to paint
6. Phase 4B (Editors) → edit properties
7. Phase 4D (Global UI) → command palette, search
8. Phase 5A (Editor/App) → wire it all together
9. Phase 5C (PrairieBob) → re-add unique features
10. Phase 4F (Def editors) → last, for power users
```

---

## Notes for Agents

1. **Always check existing PrairieBob code first** - some components exist and need updating, not replacing
2. **Use Zustand stores** - don't port LDtk's direct state mutation patterns
3. **Canvas 2D, not Heaps** - LDtk uses `h2d.*` (Heaps), we use HTML Canvas
4. **React patterns** - hooks, functional components, no jQuery
5. **Keep app running** - after each task, `npm run build` must pass
