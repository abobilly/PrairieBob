# SpudTile — Comprehensive Feature Implementation Prompt

> **Context**: SpudTile is an LDtk-compatible tile map editor built with React 19 + TypeScript + Vite 7 + Electron 36. State management uses Zustand + Immer. UI components from shadcn/ui with Lucide icons. Tools extend a `Tool` base class in `src/lib/ldtk/tools/`.

---

## Feature 1: Drawing Tools (Line / Rectangle / Ellipse / Random Brush)

### Goal
Add geometric drawing tools that paint tiles along computed paths, plus a random-brush toggle for the existing TileTool.

### Files to Create
- `src/lib/ldtk/tools/LineTool.ts`
- `src/lib/ldtk/tools/RectTool.ts`
- `src/lib/ldtk/tools/EllipseTool.ts`

### Files to Modify
- `src/lib/ldtk/tools/TileTool.ts` — add random-brush mode toggle
- `src/stores/ldtkToolStore.ts` — register new tools, add `randomBrush: boolean` state
- `src/components/ToolPalette.tsx` — add tool buttons with icons
- `src/components/LevelCanvas.tsx` — wire up preview rendering for shape tools

### Spec

**LineTool** (`LineTool.ts`):
- Extends `Tool` base class
- `onPointerDown`: record start cell `(x0, y0)`
- `onPointerMove`: compute Bresenham line from start to current cell, render preview overlay (semi-transparent tiles along the line)
- `onPointerUp`: commit all tiles along the line to the active layer
- Hold `Shift` to snap to 45° increments (horizontal, vertical, diagonal)
- Preview: draw tiles with 50% opacity along the computed path

**RectTool** (`RectTool.ts`):
- Extends `Tool` base class
- `onPointerDown`: record corner `(x0, y0)`
- `onPointerMove`: compute rectangle from `(x0, y0)` to `(x1, y1)`, render preview
- `onPointerUp`: commit tiles
- Toggle between **filled** and **outline-only** mode (toolbar toggle or `Alt` modifier)
- Preview: show rectangle boundary with semi-transparent tiles

**EllipseTool** (`EllipseTool.ts`):
- Extends `Tool` base class
- Uses midpoint ellipse algorithm
- `onPointerDown`: record center (or corner, based on mode)
- `onPointerMove`: compute ellipse pixels, render preview
- `onPointerUp`: commit tiles
- `Shift` constrains to circle (equal radii)
- Toggle filled vs outline like RectTool

**Random Brush** (modify `TileTool.ts`):
- When `randomBrush` is enabled in `ldtkToolStore`, each painted cell picks a random tile from the current multi-selection in TilePalette
- If only one tile is selected, behaves normally
- Store the selection set as `randomBrushTiles: number[]`
- On each cell paint, `tiles[Math.floor(Math.random() * tiles.length)]`

### Algorithm Reference
```typescript
// Bresenham line (for LineTool)
function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return points;
}

// Midpoint ellipse (for EllipseTool)
function midpointEllipse(cx: number, cy: number, rx: number, ry: number): [number, number][] {
  // Standard midpoint ellipse algorithm returning all boundary pixels
  // Mirror across 4 quadrants
}
```

### Toolbar Icons
- **Line**: `Minus` or `Slash` from Lucide
- **Rectangle**: `Square` from Lucide
- **Ellipse**: `Circle` from Lucide
- **Random Brush**: `Shuffle` from Lucide (toggle button on TileTool options)

---

## Feature 2: Layer Grouping System

### Goal
Support three types of layer groups to organize complex maps:

1. **Static Groups** — User-defined folders that persist in the project file. Purely organizational.
2. **Dynamic Groups** — Auto-generated groups based on layer naming convention (e.g., `Floor_*`, `Wall_*`). Computed on load, not saved.
3. **Meta Groups** — System-level groupings with semantic meaning (Collision, Entities, Visual). Used for batch operations like "hide all collision layers."

### Types to Add
```typescript
// In src/lib/types.ts or src/lib/ldtk/types.ts
interface LayerGroup {
  id: string;
  name: string;
  type: 'static' | 'dynamic' | 'meta';
  layerIds: string[]; // ordered list of layer IDs in this group
  collapsed: boolean;
  visible: boolean; // toggle visibility for all layers in group
  locked: boolean;   // toggle lock for all layers in group
  color?: string;    // group accent color in layer panel
}

// Predefined meta groups
const META_GROUPS = {
  visual: { pattern: /^(floor|wall|trim|overlay|decor)/i, color: '#4CAF50' },
  collision: { pattern: /^(collision|solid|block)/i, color: '#F44336' },
  entities: { pattern: /^(entities|objects|triggers|spawns)/i, color: '#2196F3' },
} as const;
```

### Files to Modify
- `src/stores/projectStore.ts` — add `layerGroups: LayerGroup[]` to project state, add actions: `createGroup`, `deleteGroup`, `moveLayerToGroup`, `toggleGroupVisibility`, `toggleGroupLock`, `reorderGroup`
- `src/components/LayerPanel.tsx` — render groups as collapsible sections, drag-and-drop layers between groups, group context menu (rename, delete, change color)
- `src/lib/ldtk/types.ts` — add `LayerGroup` type

### Behavior
- **Static groups**: Saved in `project.json` under `layerGroups` array. User creates via "New Group" button in layer panel. Layers can be dragged into/out of groups.
- **Dynamic groups**: Computed on project load by matching layer names against patterns. Not editable directly — rename the layer to move it.
- **Meta groups**: Always present, computed from layer name patterns. "Show only visual" / "Show only collision" quick toggles in layer panel header.
- **Group visibility**: Toggling group visibility sets all child layers' visibility. Individual layers can still be toggled independently.
- **Collapse**: Groups can be collapsed in the layer panel to save space. State persisted in UI store.

---

## Feature 3: Tile Actions / State Machine System

### Goal
Define interactive behaviors for tiles: doors that open/close, switches that toggle, pressure plates, animated tiles that cycle through states. This makes SpudTile useful for game prototyping, not just static map editing.

### Data Model
```typescript
// In src/lib/types.ts
interface TileState {
  name: string;           // e.g., "open", "closed", "active"
  tileId: number;         // which tile graphic to show in this state
  duration?: number;      // auto-transition after N ms (for animations)
  nextState?: string;     // auto-transition target state name
}

interface TileTrigger {
  type: TriggerType;
  targetAction?: string;  // action name to fire on target
  targetTilePos?: { x: number; y: number }; // position of target tile
  parameters?: Record<string, unknown>;
}

type TriggerType =
  | 'on_interact'      // player presses action key
  | 'on_step'          // entity walks onto tile
  | 'on_adjacent'      // entity is adjacent
  | 'on_timer'         // periodic timer
  | 'on_signal'        // receives named signal from another tile
  | 'on_state_enter'   // when this tile enters a specific state
  | 'on_state_exit';   // when this tile exits a specific state

interface TileEffect {
  type: EffectType;
  parameters: Record<string, unknown>;
}

type EffectType =
  | 'change_state'     // { targetState: string }
  | 'emit_signal'      // { signal: string, radius?: number }
  | 'play_sound'       // { soundId: string }
  | 'spawn_entity'     // { entityDefId: string }
  | 'teleport'         // { targetX: number, targetY: number, targetMap?: string }
  | 'damage'           // { amount: number, type: string }
  | 'dialog'           // { dialogId: string }
  | 'custom';          // { script: string }

interface TileActionGroup {
  id: string;
  name: string;           // e.g., "Wooden Door", "Floor Switch"
  states: TileState[];
  defaultState: string;
  triggers: TileTrigger[];
  effects: TileEffect[];  // effects to execute when triggered
}
```

### Files to Create
- `src/components/TileActionsPanel.tsx` — UI for defining/editing tile action groups
- `src/lib/tile-actions.ts` — action group registry, serialization, state machine logic

### Files to Modify
- `src/stores/projectStore.ts` — add `tileActionGroups: TileActionGroup[]` to project state
- `src/components/PropertiesPanel.tsx` — show tile action when a tile with an action group is selected
- `src/components/panels/` — add TileActionsPanel to panel layout

### UI Design
- **TileActionsPanel**: Shows list of action groups. Each group expandable to show states + triggers.
- **State editor**: For each state, pick a tile from the tileset, set duration/next-state for auto-transitions.
- **Trigger editor**: Dropdown for trigger type, fields for target position/signal name.
- **Effect editor**: Dropdown for effect type, parameter fields based on type.
- **Tile overlay**: Tiles with action groups show a small icon overlay in the canvas (⚡ or gear icon).

### Serialization
- Action groups saved in `project.json` under `tileActionGroups` array
- Individual tile instances reference action groups by ID in the layer data (new field `actionGroupId` on placed tiles)

### Example: Wooden Door
```json
{
  "id": "wooden_door",
  "name": "Wooden Door",
  "states": [
    { "name": "closed", "tileId": 42 },
    { "name": "opening", "tileId": 43, "duration": 300, "nextState": "open" },
    { "name": "open", "tileId": 44 },
    { "name": "closing", "tileId": 43, "duration": 300, "nextState": "closed" }
  ],
  "defaultState": "closed",
  "triggers": [
    { "type": "on_interact", "targetAction": "toggle" }
  ],
  "effects": [
    {
      "type": "change_state",
      "parameters": {
        "toggle": { "closed": "opening", "open": "closing" }
      }
    },
    {
      "type": "play_sound",
      "parameters": { "soundId": "door_creak" }
    }
  ]
}
```

---

## Feature 4: Game Preview Mode

### Goal
A 1:1 pixel-accurate preview of what the map looks like at runtime. Camera viewport simulation, entity placement visualization, scroll testing. Activated via toolbar toggle or `F5`.

### Files to Create
- `src/components/GamePreview.tsx` — full preview component

### Files to Modify
- `src/stores/editorStore.ts` — add `previewMode: boolean`, `previewCamera: { x, y, zoom }` state
- `src/components/Toolbar.tsx` — add preview toggle button
- `src/App.tsx` — conditionally render GamePreview overlay when preview mode is active

### Spec

**GamePreview.tsx**:
- Renders as a full-screen overlay on top of the editor (or replaces the canvas area)
- Uses an HTML Canvas (not the React-rendered tile grid) for pixel-accurate rendering
- Renders all visible layers composited in order, at 1:1 pixel scale
- Camera controls:
  - Arrow keys or WASD to pan the viewport
  - Mouse wheel to zoom (1x, 2x, 3x, 4x snapped scales)
  - `Home` key to reset camera to origin
- Shows a viewport rectangle overlay indicating the "game camera" bounds
- Configurable viewport size (e.g., 320×240, 640×480, 1280×720) in a dropdown
- `Escape` or `F5` exits preview mode
- Entities rendered as their assigned sprite/graphic at placed positions
- Grid and guides hidden in preview mode
- Optional: animate tiles that have action groups with auto-transition states (from Feature 3)

**Viewport simulation**:
```typescript
interface PreviewViewport {
  width: number;   // viewport width in pixels
  height: number;  // viewport height in pixels
  zoom: number;    // display scale (1x, 2x, 3x, etc.)
  x: number;       // camera position (top-left of viewport in world coords)
  y: number;
}
```

**Rendering pipeline**:
1. Clear canvas
2. For each visible layer (bottom to top):
   - For each tile in the viewport bounds:
     - Draw tile from tileset image at correct position
3. Draw entity sprites
4. Draw viewport boundary indicator (dashed rectangle)

---

## Feature 5: Baked SpudTile Tileset Export

### Goal
Export a self-contained `.spudtile` tileset file that bundles the tileset image + metadata + tile properties + action groups into a single redistributable package. "Baked" means no external dependencies — the image is embedded as base64 or as a sidecar PNG.

### Files to Create
- `src/lib/tileset-baker.ts` — baking logic
- `src/components/BakeTilesetDialog.tsx` — export configuration dialog

### Files to Modify
- `src/components/TilesetPanel.tsx` — add "Export Baked Tileset" context menu option
- `src/stores/projectStore.ts` — add import logic for `.spudtile` files
- `src/lib/tileset.ts` — add loader for `.spudtile` format
- `electron/main.ts` — register `.spudtile` file association for double-click open

### Format Spec
```typescript
interface BakedTileset {
  format: 'spudtile-tileset';
  version: 1;
  name: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  tileCount: number;
  spacing: number;
  margin: number;

  // Image data — one of:
  imageDataUrl: string;     // base64 data URL (for small tilesets)
  // OR
  imageFile: string;        // relative path to sidecar PNG (for large tilesets)

  // Per-tile metadata
  tiles: {
    [tileId: number]: {
      properties?: Record<string, unknown>;
      animation?: { frames: { tileId: number; duration: number }[] };
      collision?: { shapes: CollisionShape[] };
      actionGroup?: TileActionGroup; // from Feature 3
    };
  };

  // Metadata
  tags: string[];
  author?: string;
  license?: string;
  description?: string;
  createdAt: string;
  sourceProject?: string;
}
```

### BakeTilesetDialog.tsx
- Select which tileset to export
- Choose export mode: **Embedded** (base64, single file) or **Sidecar** (JSON + PNG, smaller JSON)
- Threshold: auto-select embedded if image < 512KB, sidecar otherwise
- Set metadata: name, author, license, tags, description
- Choose which tile properties to include
- Preview total file size
- Export button → writes `.spudtile` file via Electron save dialog

### Import Flow
- "Import Tileset" in TilesetPanel detects `.spudtile` extension
- Extracts image (decodes base64 or reads sidecar PNG)
- Writes image to project's tileset directory
- Adds tileset to project with all metadata preserved
- Tile properties and action groups are merged into project

### File Association
- Register `.spudtile` with Electron's file association
- Double-clicking a `.spudtile` file opens SpudTile and prompts to import into current project (or create new project)

---

## Implementation Order

| Priority | Feature | Effort | Dependencies |
|----------|---------|--------|-------------|
| 1 | Drawing Tools | Medium | None — extends existing Tool system |
| 2 | Layer Grouping | Medium | None — extends LayerPanel |
| 3 | Tile Actions | Large | None, but benefits from Drawing Tools for placement |
| 4 | Game Preview | Medium | Benefits from Tile Actions (animated preview) |
| 5 | Baked Tileset | Medium | Benefits from Tile Actions (exports action groups) |

## Constraints
- **No Radix UI Slider** — use native `<input type="range">` if any range inputs are needed
- **No localhost** — this is an Electron app, no `vite preview` or browser URLs
- **Build must pass**: `npm run build` (tsc -b && vite build) before committing
- **Zustand + Immer**: All store mutations use Immer's `set(state => { state.x = y })` pattern
- **Tool base class**: All tools extend `Tool` from `src/lib/ldtk/tools/`
- **Icons**: Use Lucide icons (already installed as `lucide-react`)
