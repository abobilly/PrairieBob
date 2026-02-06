# Agent Task: Inspect and Implement SpudTile Features from newprompt.md

## Your Role

You are an implementation agent for the **SpudTile** tile map editor. Your task is to read the feature specification in `newprompt.md`, inspect the existing codebase to understand all conventions and patterns, then implement all 5 features incrementally — verifying the build after each one.

---

## Step 0: Read the Spec and Understand the Codebase

1. **Read `newprompt.md`** in the repo root. It defines 5 features with detailed specs, types, files to create/modify, and algorithms.

2. **Inspect these files to understand existing patterns** before writing any code:

   | File | Why |
   |------|-----|
   | `src/lib/ldtk/tools/tool.ts` | Base `Tool` class — all tools extend this. Has `ToolContext`, `onMouseDown/Move/Up`, `getCursor()` |
   | `src/lib/ldtk/tools/layer-tool.ts` | `LayerTool extends Tool` — adds layer awareness, `paintAt()`, grid math, Bresenham `paintLine()` |
   | `src/lib/ldtk/tools/tile-tool.ts` | `TileTool extends LayerTool` — 304 lines. Already has `stampMode: 'single' | 'rectangle' | 'random'`, `render()` with preview, `setTileAt()`, `paintRectangle()`, `getPaintTileId()` with random selection. **Study this carefully — it already has rectangle and random modes.** |
   | `src/lib/ldtk/tools/registry.ts` | `ToolRegistry` class + `toolRegistry` singleton. Tools registered with `{ id, name, icon, shortcut, category }` |
   | `src/stores/ldtkToolStore.ts` | Zustand store — tiny, just `activeToolId` + `setActiveToolId`. Uses `devtools` middleware. |
   | `src/components/ToolPalette.tsx` | Renders tool buttons by category. Uses `@phosphor-icons/react` icons (NOT Lucide — the spec says Lucide but the codebase uses Phosphor). Map of `TOOL_ICONS` keyed by tool ID. |
   | `src/components/LevelCanvas.tsx` | ~1100 lines. Main canvas rendering + tool wiring. Find where tools are instantiated and where `tool.render()` is called. |
   | `src/components/LayerPanel.tsx` | Layer management UI. No groups yet. |
   | `src/components/PropertiesPanel.tsx` | Properties inspector for selected elements. |
   | `src/stores/projectStore.ts` | ~1210 lines. Main project state. Has `layerInstances`, tilesets, undo/redo. Uses Zustand + Immer. |
   | `src/lib/types.ts` | Shared types. |
   | `src/lib/ldtk/project.ts` or `src/lib/ldtk/layer-instance.ts` | LDtk data model types (LayerInstance, TileInstance, etc.) |

3. **Key findings to note before coding:**
   - `TileTool` already has `stampMode: 'random'` and `paintRectangle()` — so Feature 1's random brush and rect fill are partially done. Don't duplicate.
   - Icons: The codebase uses `@phosphor-icons/react`, NOT `lucide-react`. Use Phosphor icons (e.g., `Line`, `Rectangle`, `Circle`, `Shuffle`).
   - Tools extend `LayerTool` (not `Tool` directly) if they paint on layers.
   - The `ToolRegistry` uses string IDs and a `category` field. New drawing tools should be `category: 'layer'`.
   - Zustand stores use `devtools` middleware. The `projectStore` uses `immer` middleware too — follow that pattern.

---

## Step 1: Implement Feature 1 — Drawing Tools

### What already exists
- `TileTool` already has `'rectangle'` stamp mode and `'random'` stamp mode.
- `LayerTool` already has `paintLine()` using Bresenham.

### What to build

**1a. `src/lib/ldtk/tools/LineTool.ts`**
- Extends `LayerTool`
- Override `onMouseDown`: record start grid cell, begin drag
- Override `onMouseMove`: compute Bresenham line from start to current, store for preview (DO NOT paint yet)
- Override `onMouseUp`: paint all cells along the line using `paintAt()`, then clear state
- Add `render(ctx, camera)` method to draw preview (semi-transparent tiles along computed path)
- Shift-snap to 45°: in `onMouseMove`, if shift is held, snap endpoint to nearest 45° angle from start
- Uses `selectedTileIds` passed in via `setSelectedTiles()` (same pattern as TileTool)

**1b. `src/lib/ldtk/tools/RectTool.ts`**
- Extends `LayerTool`
- Similar to TileTool's rectangle mode, but as a standalone tool
- Has `filled: boolean` toggle (default true, Alt key toggles to outline-only)
- `onMouseDown`: record corner
- `onMouseMove`: update opposite corner for preview
- `onMouseUp`: paint filled rect or outline rect
- `render()`: preview rectangle with semi-transparent tiles

**1c. `src/lib/ldtk/tools/EllipseTool.ts`**
- Extends `LayerTool`
- Midpoint ellipse algorithm to compute boundary cells
- `onMouseDown`: record corner (bounding box mode)
- `onMouseMove`: compute ellipse fitting in bounding box
- `onMouseUp`: paint cells
- Shift constrains to circle
- `filled: boolean` toggle like RectTool
- `render()`: preview ellipse cells

**1d. Register tools in `src/lib/ldtk/tools/registry.ts`**
```typescript
toolRegistry.register({ id: 'line', name: 'Line', icon: 'line', shortcut: 'L', category: 'layer' })
toolRegistry.register({ id: 'rect', name: 'Rectangle', icon: 'rect', shortcut: 'R', category: 'layer' })
toolRegistry.register({ id: 'ellipse', name: 'Ellipse', icon: 'ellipse', shortcut: 'O', category: 'layer' })
```

**1e. Update `src/components/ToolPalette.tsx`**
- Add Phosphor icons for new tools in `TOOL_ICONS`:
  - `line`: `<LineSegment />` from `@phosphor-icons/react`
  - `rect`: `<Rectangle />` from `@phosphor-icons/react`
  - `ellipse`: `<Circle />` from `@phosphor-icons/react`
- Check that Phosphor exports these. If not, pick closest alternatives.

**1f. Wire tools in `LevelCanvas.tsx`**
- Find where TileTool is instantiated/used. Add LineTool, RectTool, EllipseTool similarly.
- Each needs `setLayer()`, `setSelectedTiles()` calls.
- Call `tool.render(ctx, camera)` in the canvas render loop.

**1g. Verify**: Run `npm run build`. Fix any TypeScript errors.

---

## Step 2: Implement Feature 2 — Layer Grouping

### What to build

**2a. Add types** in `src/lib/types.ts` (or `src/lib/ldtk/types.ts`):
```typescript
interface LayerGroup {
  id: string
  name: string
  type: 'static' | 'dynamic' | 'meta'
  layerIds: string[]
  collapsed: boolean
  visible: boolean
  locked: boolean
  color?: string
}
```

**2b. Add state to `projectStore.ts`**:
- `layerGroups: LayerGroup[]` in project state
- Actions: `createGroup(name)`, `deleteGroup(id)`, `moveLayerToGroup(layerId, groupId)`, `toggleGroupVisibility(id)`, `toggleGroupLock(id)`, `reorderGroup(id, newIndex)`
- On project load, compute dynamic groups from layer names
- Save static groups to `project.json`

**2c. Update `LayerPanel.tsx`**:
- Render groups as collapsible sections above/around existing layer list
- "New Group" button in header
- Layers inside groups are indented
- Group header shows visibility/lock toggles, collapse arrow, group name
- Context menu on group: rename, delete, change color
- Drag-and-drop layers into/out of groups (or simpler: select + "Move to Group" menu)
- Meta group quick toggles: "Visual only" / "Collision only" / "All" buttons in panel header

**2d. Verify**: Run `npm run build`.

---

## Step 3: Implement Feature 3 — Tile Actions / State Machine

### What to build

**3a. Create types** — add `TileState`, `TileTrigger`, `TileEffect`, `TileActionGroup` types as specified in newprompt.md. Put them in `src/lib/types.ts`.

**3b. Create `src/lib/tile-actions.ts`**:
- `TileActionRegistry` class to store/retrieve action groups
- Serialization helpers for saving/loading from project.json
- State machine logic: `getNextState(group, currentState, trigger)` etc.

**3c. Create `src/components/TileActionsPanel.tsx`**:
- List of action groups
- Expandable group editor: states list, trigger list, effect list
- Add/remove states, triggers, effects
- State editor: pick tile from tileset, set duration, next-state
- Trigger editor: dropdown for type, fields for parameters
- Effect editor: dropdown for type, parameter fields

**3d. Update `projectStore.ts`**:
- Add `tileActionGroups: TileActionGroup[]` to state
- Actions: `addActionGroup`, `updateActionGroup`, `deleteActionGroup`
- Serialize/deserialize in save/load

**3e. Update `PropertiesPanel.tsx`**:
- When a tile with an action group is selected, show the action group details
- Allow assigning an action group to a placed tile

**3f. Verify**: Run `npm run build`.

---

## Step 4: Implement Feature 4 — Game Preview Mode

### What to build

**4a. Create `src/components/GamePreview.tsx`**:
- Full-screen overlay or canvas replacement
- Uses raw HTML Canvas for pixel-accurate rendering
- Renders all visible layers composited bottom-to-top at 1:1 scale
- Camera: WASD/arrows to pan, mouse wheel for zoom (1x/2x/3x/4x snapped)
- Viewport size selector dropdown (320×240, 640×480, etc.)
- Shows viewport boundary rectangle (dashed)
- Escape or F5 exits preview

**4b. Update `editorStore.ts`**:
- Add `previewMode: boolean`, `previewCamera: { x, y, zoom }`, `previewViewportSize: { w, h }`
- Actions: `enterPreview()`, `exitPreview()`, `setPreviewCamera()`

**4c. Update `Toolbar.tsx`**:
- Add preview toggle button (play icon)

**4d. Update `App.tsx`**:
- Conditionally render `<GamePreview />` overlay when `previewMode === true`
- Bind F5 global keyboard shortcut

**4e. Verify**: Run `npm run build`.

---

## Step 5: Implement Feature 5 — Baked Tileset Export

### What to build

**5a. Create `src/lib/tileset-baker.ts`**:
- `bakeTileset(tileset, options)` function
- Reads tileset image, converts to base64 (or keeps as sidecar path)
- Builds `BakedTileset` object with all metadata
- Writes `.spudtile` JSON file

**5b. Create `src/components/BakeTilesetDialog.tsx`**:
- Dialog to configure export: select tileset, embedded vs sidecar, metadata fields
- Preview file size
- Export button triggers save via Electron dialog

**5c. Update `TilesetPanel.tsx`**:
- Add "Export Baked Tileset" to tileset context menu

**5d. Update `src/lib/tileset.ts`**:
- Add loader for `.spudtile` format
- `importBakedTileset(path)` → extracts image, adds to project

**5e. Update `projectStore.ts`**:
- Import flow for `.spudtile` files

**5f. Update `electron/main.ts`**:
- Register `.spudtile` file association

**5g. Verify**: Run `npm run build`.

---

## Implementation Rules

### MUST follow:
1. **Build must pass** after each feature. Run `npm run build` (which runs `tsc -b && vite build`). Do not move to the next feature until the current one builds cleanly.
2. **Icons**: Use `@phosphor-icons/react` (NOT Lucide). Check Phosphor has the icon before using it.
3. **No Radix UI Slider** — use native `<input type="range">` for any range inputs.
4. **No localhost** — never open browser URLs. This is an Electron app.
5. **Zustand + Immer** — all store mutations use `set(state => { state.x = y })` pattern with immer middleware. The `ldtkToolStore` currently uses plain Zustand (no immer), but `projectStore` uses immer. Follow each store's existing pattern.
6. **Forward slashes** in all imports.
7. **Tool base class hierarchy**: Drawing tools that paint on layers should extend `LayerTool`, not `Tool` directly.
8. **Existing TileTool capabilities**: Don't re-implement what TileTool already does (rectangle fill, random brush). LineTool/RectTool/EllipseTool are new standalone tools. The random-brush toggle in the spec refers to TileTool's existing `stampMode: 'random'` — just make sure it's exposed in the UI if it isn't already.

### Implementation order:
```
Feature 1 (Drawing Tools) → build check
Feature 2 (Layer Grouping) → build check  
Feature 3 (Tile Actions)   → build check
Feature 4 (Game Preview)   → build check
Feature 5 (Baked Tileset)  → build check
```

### Final verification:
After all 5 features, run `npm run build` one final time and confirm zero errors.

---

## Done When

- [ ] All 5 features implemented
- [ ] `npm run build` passes with zero errors
- [ ] New tool files created: `LineTool.ts`, `RectTool.ts`, `EllipseTool.ts`
- [ ] New component files created: `TileActionsPanel.tsx`, `GamePreview.tsx`, `BakeTilesetDialog.tsx`
- [ ] New lib files created: `tile-actions.ts`, `tileset-baker.ts`
- [ ] `registry.ts` has line/rect/ellipse tools registered
- [ ] `ToolPalette.tsx` shows new tools with icons
- [ ] `LevelCanvas.tsx` wires new tools
- [ ] `LayerPanel.tsx` has group support
- [ ] `projectStore.ts` has layerGroups + tileActionGroups + baked tileset import
- [ ] `editorStore.ts` has preview mode state
- [ ] `App.tsx` renders GamePreview overlay
- [ ] `electron/main.ts` has .spudtile file association
- [ ] Build passes: `npm run build` → exit code 0
