# Agent Prompts - PrairieBob LDtk Port

> **Mission**: Port LDtk tile editor from Haxe to React/TypeScript
> **Context**: Phase 1 (data model) complete. Phase 2-5 tasks below.
> **Your role**: Implement assigned task, verify build passes, commit with clear message

---

## How to Use These Prompts

1. **Read the prompt** for your assigned task
2. **Study the source** - read the Haxe file(s) referenced
3. **Port to TypeScript** - translate patterns, don't copy line-by-line
4. **Follow existing patterns** - check `src/lib/ldtk/` for style
5. **Test**: Run `npm run build` - must pass
6. **Commit**: Use format `feat(ldtk): add [component name]`

---

## 🟢 TIER 1 PROMPTS (Simple, ~60-150 lines, no complex deps)

### T1-01: Viewport Hooks (Task 2A.2)

**Goal**: Create React hooks for managing viewport state (zoom, pan, screen-to-world coords)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/Camera.hx` (reference)
- `src/stores/editorStore.ts` (existing patterns)

**Output**:

- `src/hooks/useViewport.ts`

**Requirements**:

```typescript
// Export these hooks:
export function useViewport()
  // Returns: { zoom, pan, setZoom, setPan, reset }

export function useScreenToWorld(screenX: number, screenY: number)
  // Converts screen pixel coords to world coords using current viewport

export function useWorldToScreen(worldX: number, worldY: number)
  // Converts world coords to screen pixel coords
```

**Key Patterns**:

- Use Zustand store for viewport state
- Camera.hx lines 50-120 show coordinate conversion math
- Zoom levels: 0.1 to 8.0, default 1.0
- Pan is offset in world pixels

**Acceptance**:

- [ ] Build passes
- [ ] Hooks can be imported in other components
- [ ] Type-safe (no `any`)

---

### T1-02: Tool Registry (Task 3A.2)

**Goal**: Create a registry system for tools (Tile, Entity, IntGrid, etc.)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/Tool.hx` (lines 1-50)
- Existing: `src/stores/editorStore.ts`

**Output**:

- `src/lib/ldtk/tools/registry.ts`

**Requirements**:

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
  category: 'layer' | 'navigation' | 'selection';
}

class ToolRegistry {
  register(tool: ToolDefinition): void
  getTool(id: string): ToolDefinition | undefined
  getToolsByCategory(category: string): ToolDefinition[]
  getAllTools(): ToolDefinition[]
}

export const toolRegistry = new ToolRegistry();
```

**Key Patterns**:

- Singleton pattern
- Pre-register common tools: 'tile', 'entity', 'intgrid', 'pan', 'select'
- Tool.hx shows tool IDs used in LDtk

**Acceptance**:

- [ ] Build passes
- [ ] Can register and retrieve tools
- [ ] No runtime errors

---

### T1-03: Pan Tool (Task 3C.1)

**Goal**: Implement pan/drag navigation tool

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/PanView.hx`

**Output**:

- `src/lib/ldtk/tools/pan-tool.ts`

**Requirements**:

```typescript
export class PanTool extends Tool {
  onMouseDown(e: MouseEvent): void
  onMouseMove(e: MouseEvent): void
  onMouseUp(e: MouseEvent): void
  getCursor(): string  // Returns 'grab' or 'grabbing'
}
```

**Key Patterns**:

- Extends base Tool class (create stub if needed)
- Track drag start position
- Update viewport pan on mouse move
- PanView.hx lines 30-80 show the logic
- Change cursor: 'grab' when idle, 'grabbing' when dragging

**Acceptance**:

- [ ] Build passes
- [ ] Exports PanTool class
- [ ] Has proper method signatures

---

### T1-04: Pick Tool (Task 3C.4)

**Goal**: Implement eyedropper tool to pick tiles/entities

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/PickPoint.hx`

**Output**:

- `src/lib/ldtk/tools/pick-tool.ts`

**Requirements**:

```typescript
export class PickTool extends Tool {
  onMouseDown(e: MouseEvent): void
  // Detects what's under cursor
  // Sets active tile/entity/intgrid value
  getCursor(): string  // Returns 'crosshair'
}
```

**Key Patterns**:

- Single click action (no drag)
- Hit test against current layer
- Emit event to update tool palette selection
- PickPoint.hx lines 20-60 show hit detection

**Acceptance**:

- [ ] Build passes
- [ ] Exports PickTool class
- [ ] Method signatures match Tool interface

---

### T1-05: Tool Palette (Task 4A.1)

**Goal**: UI component showing available tools (Tile, Entity, Pan, etc.)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/ToolPalette.hx`
- Existing: `src/components/Toolbar.tsx` (similar pattern)

**Output**:

- `src/components/ToolPalette.tsx`

**Requirements**:

```typescript
export function ToolPalette() {
  // Fetch tools from registry
  // Display as icon buttons
  // Highlight active tool
  // Handle click to activate tool
}
```

**Key Patterns**:

- Use `toolRegistry.getAllTools()`
- Group by category (Layer | Navigation | Selection)
- Use shadcn/ui Button components
- Active tool from Zustand store
- ToolPalette.hx lines 40-90 show layout

**Acceptance**:

- [ ] Build passes
- [ ] Renders without errors
- [ ] Can import in App.tsx

---

### T1-06: Notification Component (Task 4D.3)

**Goal**: Toast notification system for user feedback

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/Notification.hx`

**Output**:

- `src/components/Notification.tsx`
- `src/hooks/useNotification.ts`

**Requirements**:

```typescript
// Hook
export function useNotification() {
  return {
    success: (msg: string) => void,
    error: (msg: string) => void,
    warning: (msg: string) => void,
    info: (msg: string) => void,
  }
}

// Component
export function NotificationContainer()
```

**Key Patterns**:

- Use Zustand store for notification queue
- Auto-dismiss after 3 seconds
- Stack multiple notifications
- Notification.hx lines 30-90 show types
- Use shadcn/ui toast or build simple div

**Acceptance**:

- [ ] Build passes
- [ ] Can trigger notifications
- [ ] No console errors

---

### T1-07: Modal Base (Task 4E.1)

**Goal**: Base modal dialog component

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/Modal.hx`
- Existing: shadcn/ui Dialog

**Output**:

- `src/components/Modal.tsx`

**Requirements**:

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal(props: ModalProps)
```

**Key Patterns**:

- Wrap shadcn/ui Dialog
- ESC to close
- Click backdrop to close
- Modal.hx lines 20-80 show behavior
- Focus trap

**Acceptance**:

- [ ] Build passes
- [ ] Can render with children
- [ ] No TypeScript errors

---

### T1-08: Dialog Base (Task 4E.2)

**Goal**: Confirmation dialog wrapper

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/Dialog.hx`

**Output**:

- `src/components/Dialog.tsx`

**Requirements**:

```typescript
interface DialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'destructive';
}

export function useDialog() {
  return {
    confirm: (options: DialogProps) => Promise<boolean>
  }
}
```

**Key Patterns**:

- Use Modal component
- Promise-based API
- Dialog.hx lines 15-70 show flow
- Red button for destructive actions

**Acceptance**:

- [ ] Build passes
- [ ] Can show confirm dialog
- [ ] Returns promise

---

### T1-09: Project Linking (Task 5C.2)

**Goal**: Bridge prairiebob.config.json to LDtk Project

**Input Files**:

- Existing: `prairiebob.config.json`
- Existing: `src/lib/ldtk/project.ts`

**Output**:

- `src/lib/ldtk/project-bridge.ts`

**Requirements**:

```typescript
interface PrairieBobConfig {
  projectName: string;
  ldtkPath?: string;
  agentEnabled: boolean;
  // ... existing fields
}

export function loadPrairieBobProject(configPath: string): Promise<LDtkProject>
export function savePrairieBobProject(project: LDtkProject, configPath: string): Promise<void>
export function syncPrairieBobConfig(project: LDtkProject): PrairieBobConfig
```

**Key Patterns**:

- Read prairiebob.config.json
- If `ldtkPath` set, load that .ldtk file
- Else create new LDtk project
- Preserve PrairieBob-specific fields (agentEnabled, etc.)

**Acceptance**:

- [ ] Build passes
- [ ] Can load existing config
- [ ] Exports sync functions

---

## 🟡 TIER 2 PROMPTS (Medium, ~150-300 lines, some deps)

### T2-01: Camera (Task 2A.1)

**Goal**: Camera class managing viewport, zoom, pan, coordinate transforms

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/Camera.hx` (392 lines)

**Output**:

- `src/lib/ldtk/camera.ts`

**Requirements**:

```typescript
export class Camera {
  zoom: number;
  panX: number;
  panY: number;
  
  constructor(width: number, height: number)
  
  screenToWorld(x: number, y: number): { x: number; y: number }
  worldToScreen(x: number, y: number): { x: number; y: number }
  
  setZoom(zoom: number): void
  setPan(x: number, y: number): void
  
  fitBounds(bounds: { x: number; y: number; width: number; height: number }): void
  centerOn(x: number, y: number): void
}
```

**Key Patterns**:

- Camera.hx lines 50-150: coordinate math
- Camera.hx lines 200-250: zoom constraints
- Zoom bounds: 0.1 to 8.0
- Pan is in world pixels
- `screenToWorld`: `(screen - pan) / zoom`
- `worldToScreen`: `world * zoom + pan`

**Acceptance**:

- [ ] Build passes
- [ ] All methods implemented
- [ ] Coordinate transforms are correct (test with example values)

---

### T2-02: Viewport Store (Task 3A.3)

**Goal**: Zustand store for tool state and viewport

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/Editor.hx` (lines 500-700, tool state)
- Existing: `src/stores/editorStore.ts`

**Output**:

- `src/stores/toolStore.ts`

**Requirements**:

```typescript
interface ToolState {
  activeTool: string;
  activeLayer: string | null;
  selectedTileId: number | null;
  selectedEntityDefUid: number | null;
  brushSize: number;
  // ... etc
}

export const useToolStore = create<ToolState>((set) => ({
  // ... store implementation
}));
```

**Key Patterns**:

- Follow editorStore.ts patterns
- Immer middleware for immutability
- Actions: setActiveTool, setActiveLayer, etc.
- Persist some settings to localStorage

**Acceptance**:

- [ ] Build passes
- [ ] Can import and use store
- [ ] TypeScript types correct

---

### T2-03: Entity Renderer (Task 2B.3)

**Goal**: Component to render entity instances on canvas

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/EntityRender.hx` (380 lines)

**Output**:

- `src/components/EntityRenderer.tsx`

**Requirements**:

```typescript
interface EntityRendererProps {
  entities: EntityInstance[];
  camera: Camera;
  ctx: CanvasRenderingContext2D;
  showNames?: boolean;
}

export function EntityRenderer({ entities, camera, ctx, showNames }: EntityRendererProps)
```

**Key Patterns**:

- EntityRender.hx lines 80-200: rendering logic
- Draw entity tile if set
- Draw placeholder (rectangle) if no tile
- Draw entity identifier above
- Apply camera transforms
- Use `camera.worldToScreen()` for positioning

**Acceptance**:

- [ ] Build passes
- [ ] Component can be used in canvas render loop
- [ ] No runtime errors

---

### T2-04: Rulers (Task 2C.2)

**Goal**: Ruler/grid overlay showing coordinates

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/Rulers.hx` (280 lines)

**Output**:

- `src/components/Rulers.tsx`

**Requirements**:

```typescript
interface RulersProps {
  camera: Camera;
  ctx: CanvasRenderingContext2D;
  gridSize: number;
  showGrid: boolean;
  showRulers: boolean;
}

export function Rulers(props: RulersProps)
```

**Key Patterns**:

- Rulers.hx lines 50-150: grid rendering
- Rulers.hx lines 150-250: ruler tick marks
- Draw grid lines at gridSize intervals
- Draw ruler numbers at edges
- Snap grid to camera zoom (skip lines when zoomed out)

**Acceptance**:

- [ ] Build passes
- [ ] Renders grid lines
- [ ] Ruler numbers visible

---

### T2-05: Base Tool Class (Task 3A.1)

**Goal**: Abstract base class for all tools

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/Tool.hx` (373 lines)

**Output**:

- `src/lib/ldtk/tools/tool.ts`

**Requirements**:

```typescript
export abstract class Tool {
  abstract id: string;
  abstract name: string;
  
  // Mouse events
  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number }): void {}
  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number }): void {}
  onMouseUp(e: MouseEvent, worldPos: { x: number; y: number }): void {}
  
  // Keyboard
  onKeyDown(e: KeyboardEvent): void {}
  onKeyUp(e: KeyboardEvent): void {}
  
  // Rendering
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {}
  
  // Lifecycle
  onActivate(): void {}
  onDeactivate(): void {}
  
  // Cursor
  getCursor(): string { return 'default'; }
}
```

**Key Patterns**:

- Tool.hx lines 50-200: method signatures
- Abstract class, subclasses override
- Tools receive world coordinates (already transformed)
- Tools can draw preview/overlay in render()

**Acceptance**:

- [ ] Build passes
- [ ] Can extend class in other files
- [ ] All methods defined

---

### T2-06: Layer Tool Base (Task 3B.1)

**Goal**: Base class for layer-painting tools (Tile, IntGrid, Entity extend this)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/LayerTool.hx` (290 lines)
- `src/lib/ldtk/tools/tool.ts` (from T2-05)

**Output**:

- `src/lib/ldtk/tools/layer-tool.ts`

**Requirements**:

```typescript
export abstract class LayerTool extends Tool {
  protected layerInstance: LayerInstance | null = null;
  
  setLayer(layer: LayerInstance | null): void
  
  protected abstract paintAt(gridX: number, gridY: number): void
  
  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number }): void
  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number }): void
  
  protected worldToGrid(worldX: number, worldY: number): { x: number; y: number }
}
```

**Key Patterns**:

- LayerTool.hx lines 50-150: grid conversion
- LayerTool.hx lines 150-250: paint logic
- Convert world coords to grid coords
- Handle drag painting (continuous line)
- Subclasses implement `paintAt()`

**Acceptance**:

- [ ] Build passes
- [ ] Extends Tool
- [ ] Can be extended by TileTool, etc.

---

### T2-07: IntGrid Tool (Task 3B.2)

**Goal**: Tool for painting IntGrid values

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/lt/IntGridTool.hx` (320 lines)
- `src/lib/ldtk/tools/layer-tool.ts` (from T2-06)

**Output**:

- `src/lib/ldtk/tools/intgrid-tool.ts`

**Requirements**:

```typescript
export class IntGridTool extends LayerTool {
  id = 'intgrid';
  name = 'IntGrid';
  
  private selectedValue: number = 1;
  
  setSelectedValue(value: number): void
  
  protected paintAt(gridX: number, gridY: number): void {
    // Set intgrid cell to selectedValue
  }
  
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Draw brush preview
  }
}
```

**Key Patterns**:

- IntGridTool.hx lines 80-180: paint logic
- Use `layerInstance.setIntGridValue(x, y, value)`
- Draw square preview at cursor
- Support brush sizes (1x1, 3x3, etc.)

**Acceptance**:

- [ ] Build passes
- [ ] Extends LayerTool
- [ ] Implements paintAt()

---

### T2-08: Entity Tool (Task 3B.4)

**Goal**: Tool for placing/moving entities

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/lt/EntityTool.hx` (350 lines)
- `src/lib/ldtk/tools/layer-tool.ts`

**Output**:

- `src/lib/ldtk/tools/entity-tool.ts`

**Requirements**:

```typescript
export class EntityTool extends LayerTool {
  id = 'entity';
  name = 'Entity';
  
  private selectedEntityDefUid: number | null = null;
  private draggingEntity: EntityInstance | null = null;
  
  setSelectedEntityDef(uid: number): void
  
  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Place new entity or start dragging existing
  }
  
  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Move dragging entity
  }
  
  onMouseUp(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Commit position
  }
}
```

**Key Patterns**:

- EntityTool.hx lines 100-250: place/drag logic
- Click empty space: place new entity
- Click existing entity: start drag
- Right-click: delete entity
- Show ghost preview when placing

**Acceptance**:

- [ ] Build passes
- [ ] Extends LayerTool
- [ ] Handles place and drag

---

### T2-09: Selection Tool (Task 3C.2)

**Goal**: Rectangle selection tool

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/SelectionTool.hx` (280 lines)

**Output**:

- `src/lib/ldtk/tools/selection-tool.ts`

**Requirements**:

```typescript
export class SelectionTool extends Tool {
  id = 'select';
  name = 'Selection';
  
  private startPos: { x: number; y: number } | null = null;
  private endPos: { x: number; y: number } | null = null;
  
  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number }): void
  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number }): void
  onMouseUp(e: MouseEvent, worldPos: { x: number; y: number }): void
  
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Draw selection rectangle
  }
  
  getSelection(): { x: number; y: number; width: number; height: number } | null
}
```

**Key Patterns**:

- SelectionTool.hx lines 50-150: drag rectangle
- Draw dashed outline
- Normalize rect (handle drag in any direction)
- Emit selection bounds

**Acceptance**:

- [ ] Build passes
- [ ] Extends Tool
- [ ] Draws selection rectangle

---

### T2-10: Resize Tool (Task 3C.3)

**Goal**: Tool for resizing level bounds

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/ResizeTool.hx` (200 lines)

**Output**:

- `src/lib/ldtk/tools/resize-tool.ts`

**Requirements**:

```typescript
export class ResizeTool extends Tool {
  id = 'resize';
  name = 'Resize Level';
  
  private edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null = null;
  
  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Detect which edge/corner
  }
  
  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Drag edge, update level bounds
  }
  
  getCursor(): string {
    // Return appropriate resize cursor
  }
}
```

**Key Patterns**:

- ResizeTool.hx lines 40-120: edge detection
- Hit test level bounds edges
- Drag to resize, snap to grid
- Update level.pxWid, level.pxHei

**Acceptance**:

- [ ] Build passes
- [ ] Extends Tool
- [ ] Detects edges

---

### T2-11: Entity Palette (Task 4A.3)

**Goal**: UI for selecting entity type to place

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/palette/EntityPalette.hx` (280 lines)
- Existing: `src/components/EntityPalette.tsx`

**Output**:

- Update `src/components/EntityPalette.tsx`

**Requirements**:

```typescript
export function EntityPalette() {
  const entityDefs = useProjectStore(s => s.project?.defs.entities);
  const selectedUid = useToolStore(s => s.selectedEntityDefUid);
  const setSelected = useToolStore(s => s.setSelectedEntityDefUid);
  
  // Render grid of entity icons
  // Click to select
  // Show entity name
}
```

**Key Patterns**:

- EntityPalette.hx lines 80-200: grid layout
- Show entity tile or colored square
- Display identifier below
- Highlight selected entity

**Acceptance**:

- [ ] Build passes
- [ ] Renders entity list
- [ ] Click updates tool store

---

### T2-12: IntGrid Palette (Task 4A.4)

**Goal**: UI for selecting IntGrid value

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/palette/IntGridPalette.hx` (220 lines)

**Output**:

- `src/components/IntGridPalette.tsx`

**Requirements**:

```typescript
export function IntGridPalette() {
  const activeLayer = useToolStore(s => s.activeLayer);
  const selectedValue = useToolStore(s => s.selectedIntGridValue);
  const setSelected = useToolStore(s => s.setSelectedIntGridValue);
  
  // Show color swatches for each IntGrid value
  // Click to select
}
```

**Key Patterns**:

- IntGridPalette.hx lines 60-150: color grid
- Get IntGrid values from layer definition
- Show color swatch + value number
- Current selection highlighted

**Acceptance**:

- [ ] Build passes
- [ ] Shows color grid
- [ ] Updates tool store on click

---

### T2-13: Rule Pattern Editor (Task 4B.4)

**Goal**: UI for editing auto-layer rule patterns (3x3 grid editor)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/RulePatternEditor.hx` (253 lines)

**Output**:

- `src/components/RulePatternEditor.tsx`

**Requirements**:

```typescript
interface RulePatternEditorProps {
  rule: AutoLayerRuleDef;
  onChange: (pattern: number[]) => void;
}

export function RulePatternEditor({ rule, onChange }: RulePatternEditorProps) {
  // Render 3x3 grid
  // Each cell: 0=any, 1=required, -1=forbidden
  // Click to cycle through states
}
```

**Key Patterns**:

- RulePatternEditor.hx lines 80-180: pattern grid
- Pattern is array of 9 values (center optional)
- Visual: green checkmark, red X, gray dot
- Click cell to toggle state

**Acceptance**:

- [ ] Build passes
- [ ] Renders 3x3 grid
- [ ] onChange called on edit

---

### T2-14: Command Palette (Task 4D.1)

**Goal**: Cmd+K quick command menu

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/CommandPalette.hx` (320 lines)

**Output**:

- `src/components/CommandPalette.tsx`

**Requirements**:

```typescript
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  
  // Ctrl/Cmd + K to open
  // Fuzzy search commands
  // Execute on Enter
  // ESC to close
}

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category?: string;
}
```

**Key Patterns**:

- CommandPalette.hx lines 100-250: search and execute
- Use shadcn/ui Command component
- Register commands: "New Level", "Save", "Export", etc.
- Keyboard navigation

**Acceptance**:

- [ ] Build passes
- [ ] Opens with Ctrl+K
- [ ] Can search and execute

---

### T2-15: Quick Search (Task 4D.2)

**Goal**: Search for levels, entities, layers

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/QuickSearch.hx` (180 lines)

**Output**:

- `src/components/QuickSearch.tsx`

**Requirements**:

```typescript
export function QuickSearch() {
  const [query, setQuery] = useState('');
  const results = useSearchResults(query);
  
  // Search levels, entities, layers by name
  // Click result to navigate
}
```

**Key Patterns**:

- QuickSearch.hx lines 50-120: fuzzy matching
- Search project, levels, layer instances
- Show breadcrumb path
- Highlight matches

**Acceptance**:

- [ ] Build passes
- [ ] Can search project
- [ ] Shows results

---

### T2-16: Cursor Component (Task 4D.4)

**Goal**: Custom cursor overlay (crosshair, brush preview, etc.)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/Cursor.hx` (200 lines)

**Output**:

- `src/components/Cursor.tsx`

**Requirements**:

```typescript
export function Cursor() {
  const activeTool = useToolStore(s => s.activeTool);
  const brushSize = useToolStore(s => s.brushSize);
  
  // Position at mouse
  // Show tool-specific cursor
  // For brush tools: show size preview
}
```

**Key Patterns**:

- Cursor.hx lines 60-140: cursor types
- Absolute position following mouse
- Canvas for custom shapes
- Hide native cursor with CSS

**Acceptance**:

- [ ] Build passes
- [ ] Renders cursor overlay
- [ ] Follows mouse

---

### T2-17: Context Menu (Task 4E.3)

**Goal**: Right-click context menu

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/ContextMenu.hx` (220 lines)

**Output**:

- `src/components/ContextMenu.tsx`

**Requirements**:

```typescript
interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export function ContextMenu({ items, x, y, onClose })
```

**Key Patterns**:

- ContextMenu.hx lines 50-150: positioning
- Position at mouse coords
- Click outside to close
- Keyboard navigation (arrows, Enter)

**Acceptance**:

- [ ] Build passes
- [ ] Renders menu
- [ ] Executes actions

---

### T2-18: Project Loader (Task 5B.1)

**Goal**: Load .ldtk files and parse to Project

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/ProjectLoader.hx` (420 lines)
- Existing: `src/lib/ldtk/json-io.ts`

**Output**:

- `src/lib/ldtk/project-loader.ts`

**Requirements**:

```typescript
export async function loadProject(path: string): Promise<LDtkProject>
export async function loadProjectFromBuffer(buffer: ArrayBuffer): Promise<LDtkProject>
export function validateProject(data: unknown): data is LDtkProjectJSON
```

**Key Patterns**:

- ProjectLoader.hx lines 100-300: parse and validate
- Use json-io.ts for deserialization
- Validate schema version
- Handle external level files
- Show progress for large projects

**Acceptance**:

- [ ] Build passes
- [ ] Can load .ldtk file
- [ ] Returns typed Project

---

### T2-19: Agent Integration (Task 5C.1)

**Goal**: Update agent-service.ts for LDtk model

**Input Files**:

- Existing: `src/lib/agent-service.ts`
- Existing: `src/lib/ldtk/project.ts`

**Output**:

- Update `src/lib/agent-service.ts`

**Requirements**:

- Update agent context to include LDtk project structure
- Agent can query levels, entities, layers
- Agent can suggest rules, entities

**Key Patterns**:

- Keep existing Copilot CLI integration
- Add LDtk-specific commands
- Expose project data to agent context

**Acceptance**:

- [ ] Build passes
- [ ] Agent service works with LDtk
- [ ] No breaking changes

---

### T2-20: Live Previews (Task 5C.3)

**Goal**: Door/interaction state previews

**Input Files**:

- Existing: `src/components/PropertiesPanel.tsx`
- LDtk entity field system

**Output**:

- Update `src/components/PropertiesPanel.tsx`

**Requirements**:

```typescript
// When entity has "state" field, show preview
// Toggle door open/closed
// Preview locked/unlocked
// Show switch active/inactive
```

**Key Patterns**:

- Use entity field values
- Update preview in real-time
- Visual feedback (color change, icon swap)

**Acceptance**:

- [ ] Build passes
- [ ] Can toggle door state
- [ ] Preview updates

---

### T2-21: BobTile Adapter (Task 5C.4)

**Goal**: Update BobTile adapter for LDtk tilesets

**Input Files**:

- Existing: `bobtile/tools/BobTileAdapter.ts`
- Existing: `src/lib/ldtk/types.ts` (TilesetDefinition)

**Output**:

- Update `bobtile/tools/BobTileAdapter.ts`

**Requirements**:

- Convert LDtk tileset to BobTile format
- Handle tile spacing, padding
- Export for C# consumption

**Key Patterns**:

- Keep existing BobTile schema
- Map LDtk tileset properties
- Generate metadata file

**Acceptance**:

- [ ] Build passes
- [ ] BobTile integration works
- [ ] No C# compile errors

---

## 🔴 TIER 3 PROMPTS (Complex, ~300-500 lines, many deps)

### T3-01: Level Renderer (Task 2B.1)

**Goal**: Main canvas component rendering entire level

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/LevelRender.hx` (650 lines)
- Existing: `src/components/MapCanvas.tsx`
- `src/lib/ldtk/camera.ts` (from T2-01)

**Output**:

- Update `src/components/LevelCanvas.tsx` (rename from MapCanvas)

**Requirements**:

```typescript
export function LevelCanvas({ level }: { level: Level }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera();
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    // Render background
    // Render layers (back to front)
    // Render entities
    // Render grid/rulers
    // Render active tool overlay
  }, [level, camera]);
  
  return <canvas ref={canvasRef} />;
}
```

**Key Patterns**:

- LevelRender.hx lines 150-400: layer ordering
- Use LayerRenderer for each layer
- Use EntityRenderer for entities
- Apply camera transforms
- Handle mouse events → convert to world coords → pass to tool
- Request animation frame for smooth rendering

**Acceptance**:

- [ ] Build passes
- [ ] Renders level on canvas
- [ ] Mouse events work
- [ ] No flickering

---

### T3-02: Layer Renderer (Task 2B.2)

**Goal**: Render single layer (Tiles, IntGrid, Entities, AutoLayer)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/LayerRender.hx` (420 lines)

**Output**:

- `src/components/LayerRenderer.tsx`

**Requirements**:

```typescript
interface LayerRendererProps {
  layer: LayerInstance;
  camera: Camera;
  ctx: CanvasRenderingContext2D;
  showGrid?: boolean;
}

export function renderLayer({ layer, camera, ctx, showGrid }: LayerRendererProps) {
  // Switch on layer type
  switch (layer.__type) {
    case 'Tiles':
    case 'AutoLayer':
      renderTileLayer(layer, camera, ctx);
      break;
    case 'IntGrid':
      renderIntGridLayer(layer, camera, ctx);
      break;
    case 'Entities':
      renderEntityLayer(layer, camera, ctx);
      break;
  }
}

function renderTileLayer(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D)
function renderIntGridLayer(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D)
function renderEntityLayer(layer: LayerInstance, camera: Camera, ctx: CanvasRenderingContext2D)
```

**Key Patterns**:

- LayerRender.hx lines 100-250: tile rendering
- LayerRender.hx lines 250-350: intgrid rendering
- For tiles: draw from tileset atlas
- For intgrid: draw colored squares
- Optimize: only render visible area (use camera bounds)
- Cache tileset images

**Acceptance**:

- [ ] Build passes
- [ ] Renders all layer types
- [ ] Performance OK (no lag)

---

### T3-03: Field Instance Renderer (Task 2B.4)

**Goal**: Render entity field values (strings, numbers, colors, etc.)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/FieldInstanceRender.hx` (554 lines)

**Output**:

- `src/components/FieldRenderer.tsx`

**Requirements**:

```typescript
interface FieldRendererProps {
  field: FieldInstance;
  entity: EntityInstance;
  camera: Camera;
  ctx: CanvasRenderingContext2D;
}

export function renderField({ field, entity, camera, ctx }: FieldRendererProps) {
  // Render field value based on type
  // String: draw text
  // Int/Float: draw number
  // Color: draw color swatch
  // Point: draw arrow
  // Etc.
}
```

**Key Patterns**:

- FieldInstanceRender.hx lines 80-300: type-specific rendering
- Position near entity
- Color-code by field type
- Truncate long strings
- Icons for special types (file path, enum, etc.)

**Acceptance**:

- [ ] Build passes
- [ ] Renders field values
- [ ] Readable at different zoom levels

---

### T3-04: Tile Tool (Task 3B.3)

**Goal**: Tool for painting tiles

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/tool/lt/TileTool.hx` (380 lines)
- `src/lib/ldtk/tools/layer-tool.ts` (from T2-06)

**Output**:

- `src/lib/ldtk/tools/tile-tool.ts`

**Requirements**:

```typescript
export class TileTool extends LayerTool {
  id = 'tile';
  name = 'Tile';
  
  private selectedTileIds: number[] = [];
  private stampMode: 'single' | 'rectangle' | 'random' = 'single';
  
  setSelectedTiles(tileIds: number[]): void
  setStampMode(mode: 'single' | 'rectangle' | 'random'): void
  
  protected paintAt(gridX: number, gridY: number): void {
    // Place selected tile(s)
  }
  
  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Start paint or stamp
  }
  
  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number }): void {
    // Continue painting
  }
  
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Draw tile preview at cursor
  }
}
```

**Key Patterns**:

- TileTool.hx lines 100-250: paint modes
- Single tile: click to place
- Rectangle stamp: click + drag
- Random: pick from selection
- Flip X/Y with keyboard
- Show preview ghost tile

**Acceptance**:

- [ ] Build passes
- [ ] Can paint tiles
- [ ] Preview shows selected tile

---

### T3-05: Tile Palette (Task 4A.2)

**Goal**: UI for selecting tiles from tileset

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/palette/TilePalette.hx` (380 lines)
- Existing: `src/components/TilesetPanel.tsx`

**Output**:

- Update `src/components/TilesetPanel.tsx`

**Requirements**:

```typescript
export function TilesetPanel() {
  const tileset = useProjectStore(s => s.activeTileset);
  const selectedTileIds = useToolStore(s => s.selectedTileIds);
  const setSelected = useToolStore(s => s.setSelectedTileIds);
  
  // Render tileset grid
  // Click tile to select
  // Drag to select multiple
  // Show selection rectangle
}
```

**Key Patterns**:

- TilePalette.hx lines 120-280: tile grid
- Draw tileset atlas
- Overlay grid lines
- Highlight selected tiles
- Support multi-select (Shift/Ctrl)
- Zoom tileset view

**Acceptance**:

- [ ] Build passes
- [ ] Shows tileset
- [ ] Can select tiles
- [ ] Multi-select works

---

### T3-06: Entity Instance Editor (Task 4B.1)

**Goal**: Form for editing entity field values

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/EntityInstanceEditor.hx` (420 lines)

**Output**:

- `src/components/EntityEditor.tsx`

**Requirements**:

```typescript
interface EntityEditorProps {
  entity: EntityInstance;
  onChange: (entity: EntityInstance) => void;
}

export function EntityEditor({ entity, onChange }: EntityEditorProps) {
  // Show entity identifier
  // Show position
  // For each field:
  //   - Render appropriate input (text, number, color, etc.)
  //   - Update entity on change
}
```

**Key Patterns**:

- EntityInstanceEditor.hx lines 100-300: field inputs
- String: text input
- Int/Float: number input
- Bool: checkbox
- Color: color picker
- Enum: dropdown
- Point: X,Y inputs
- FilePath: file browser
- Validate values

**Acceptance**:

- [ ] Build passes
- [ ] Shows all field types
- [ ] Updates entity on edit

---

### T3-07: Level Editor (Task 4B.3)

**Goal**: Form for editing level properties

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/LevelInstanceForm.hx` (380 lines)

**Output**:

- `src/components/LevelEditor.tsx`

**Requirements**:

```typescript
interface LevelEditorProps {
  level: Level;
  onChange: (level: Level) => void;
}

export function LevelEditor({ level, onChange }: LevelEditorProps) {
  // Level identifier
  // Size (width, height)
  // Background color
  // Background image
  // Custom fields
}
```

**Key Patterns**:

- LevelInstanceForm.hx lines 100-280: level props
- Size inputs with validation
- Color picker
- Image upload for background
- Custom field values

**Acceptance**:

- [ ] Build passes
- [ ] Can edit level properties
- [ ] Validates sizes

---

### T3-08: Tileset Panel (Task 4C.1)

**Goal**: Tileset management UI (import, edit, tags)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/Tileset.hx` (652 lines)
- Existing: `src/components/TilesetPanel.tsx`, `src/components/TilesetImportDialog.tsx`

**Output**:

- Update both files

**Requirements**:

```typescript
export function TilesetPanel() {
  // List tilesets
  // Import tileset button
  // Select active tileset
  // Edit tileset properties:
  //   - Tile size
  //   - Spacing
  //   - Padding
  //   - Tags
}

export function TilesetImportDialog({ onImport }) {
  // Browse for image
  // Set tile size
  // Preview grid
  // Import
}
```

**Key Patterns**:

- Tileset.hx lines 200-450: tileset editor
- Show tileset list
- Import wizard
- Edit tile size, spacing
- Tag tiles with enum values
- Preview changes

**Acceptance**:

- [ ] Build passes
- [ ] Can import tileset
- [ ] Can edit properties

---

### T3-09: Entity Defs Panel (Task 4F.2)

**Goal**: UI for defining entity types

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/panel/EditEntityDefs.hx` (601 lines)

**Output**:

- `src/components/panels/EntityDefsPanel.tsx`

**Requirements**:

```typescript
export function EntityDefsPanel() {
  const entityDefs = useProjectStore(s => s.project?.defs.entities);
  
  // List entity definitions
  // Add new entity def
  // Edit entity def:
  //   - Identifier
  //   - Size
  //   - Color
  //   - Tile
  //   - Fields
  //   - Tags
}
```

**Key Patterns**:

- EditEntityDefs.hx lines 200-500: entity def editor
- Master-detail view (list + form)
- Add/remove field definitions
- Set field type, default value
- Reorder fields

**Acceptance**:

- [ ] Build passes
- [ ] Can create entity defs
- [ ] Can add fields

---

### T3-10: Tileset Defs Panel (Task 4F.3)

**Goal**: UI for managing tileset definitions

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/panel/EditTilesetDefs.hx` (420 lines)

**Output**:

- `src/components/panels/TilesetDefsPanel.tsx`

**Requirements**:

```typescript
export function TilesetDefsPanel() {
  const tilesetDefs = useProjectStore(s => s.project?.defs.tilesets);
  
  // List tilesets
  // Add tileset
  // Edit tileset:
  //   - Identifier
  //   - Path
  //   - Tile size
  //   - Spacing
  //   - Padding
  //   - Embed image
}
```

**Key Patterns**:

- EditTilesetDefs.hx lines 150-350: tileset settings
- List view
- Import/embed tileset
- Adjust grid parameters
- Preview grid overlay

**Acceptance**:

- [ ] Build passes
- [ ] Can manage tilesets
- [ ] Grid preview works

---

### T3-11: Enum Defs Panel (Task 4F.4)

**Goal**: UI for defining enums (for IntGrid, tags, etc.)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/panel/EditEnumDefs.hx` (486 lines)

**Output**:

- `src/components/panels/EnumDefsPanel.tsx`

**Requirements**:

```typescript
export function EnumDefsPanel() {
  const enumDefs = useProjectStore(s => s.project?.defs.enums);
  
  // List enum definitions
  // Add enum
  // Edit enum:
  //   - Identifier
  //   - Values (identifier, color, tile)
  //   - Reorder values
  //   - Delete values
}
```

**Key Patterns**:

- EditEnumDefs.hx lines 180-400: enum editor
- List of enums
- For each enum: list of values
- Add/remove values
- Set color per value
- Used by IntGrid layers

**Acceptance**:

- [ ] Build passes
- [ ] Can create enums
- [ ] Can add values

---

### T3-12: Project Saver (Task 5B.2)

**Goal**: Save Project to .ldtk file

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/ProjectSaver.hx` (660 lines)
- Existing: `src/lib/ldtk/json-io.ts`

**Output**:

- `src/lib/ldtk/project-saver.ts`

**Requirements**:

```typescript
export async function saveProject(project: LDtkProject, path: string): Promise<void>
export async function saveProjectToBuffer(project: LDtkProject): Promise<ArrayBuffer>
export function serializeProject(project: LDtkProject): string
```

**Key Patterns**:

- ProjectSaver.hx lines 200-500: serialization
- Use json-io.ts for serialization
- Handle external levels (separate .ldtkl files)
- Create backup before save
- Show progress for large projects
- Validate before save

**Acceptance**:

- [ ] Build passes
- [ ] Can save project
- [ ] File can be loaded back

---

## 🔥 TIER 4 PROMPTS (Major, 500+ lines, core systems)

### T4-01: World Renderer (Task 2C.1)

**Goal**: World map view showing all levels

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/display/WorldRender.hx` (985 lines)

**Output**:

- `src/components/WorldCanvas.tsx`

**Requirements**:

```typescript
export function WorldCanvas({ world }: { world: World }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera();
  
  // Render all levels as thumbnails
  // Show level positions
  // Click level to open
  // Drag levels to reposition
  // Show connections between levels
  // Grid snapping
}
```

**Key Patterns**:

- WorldRender.hx lines 150-500: level thumbnails
- WorldRender.hx lines 500-800: drag and drop
- Render miniature version of each level
- Show level identifiers
- Draw arrows for level links
- Handle drag to reposition
- Snap to grid
- Zoom world view

**Acceptance**:

- [ ] Build passes
- [ ] Shows world map
- [ ] Can click to open level
- [ ] Drag to reposition works

---

### T4-02: Field Instances Form (Task 4B.2)

**Goal**: Form for editing entity/level custom fields

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/FieldInstancesForm.hx` (827 lines)

**Output**:

- `src/components/FieldsForm.tsx`

**Requirements**:

```typescript
interface FieldsFormProps {
  fields: FieldInstance[];
  fieldDefs: FieldDefinition[];
  onChange: (fields: FieldInstance[]) => void;
}

export function FieldsForm({ fields, fieldDefs, onChange }: FieldsFormProps) {
  // For each field definition:
  //   - Render appropriate input based on type
  //   - Handle arrays (add/remove elements)
  //   - Show help text
  //   - Validate values
  //   - Default values
}
```

**Key Patterns**:

- FieldInstancesForm.hx lines 200-600: field types
- 12+ field types: String, Int, Float, Bool, Color, Point, Enum, FilePath, Tile, EntityRef, Multilines, Text
- Array support: dynamic add/remove
- Validation: min/max, regex, enum values
- Rich editors: color picker, file browser, entity picker
- Nested fields
- Help tooltips

**Acceptance**:

- [ ] Build passes
- [ ] All field types render
- [ ] Arrays work
- [ ] Validation works

---

### T4-03: Layer Defs Panel (Task 4F.1)

**Goal**: UI for defining layers

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/panel/EditLayerDefs.hx` (842 lines)

**Output**:

- `src/components/panels/LayerDefsPanel.tsx`

**Requirements**:

```typescript
export function LayerDefsPanel() {
  const layerDefs = useProjectStore(s => s.project?.defs.layers);
  
  // List layer definitions
  // Reorder layers (z-index)
  // Add layer
  // Edit layer:
  //   - Identifier
  //   - Type (Tiles, IntGrid, Entities, AutoLayer)
  //   - Grid size
  //   - Opacity
  //   - Tileset (for Tiles/AutoLayer)
  //   - IntGrid enum (for IntGrid)
  //   - Auto rules (for AutoLayer)
}
```

**Key Patterns**:

- EditLayerDefs.hx lines 300-700: layer editor
- Master-detail view
- Layer type selector
- Grid size validation
- Tileset picker
- Auto-layer rules editor (complex!)
- Reorder with drag-and-drop

**Acceptance**:

- [ ] Build passes
- [ ] Can create layers
- [ ] Can set layer type
- [ ] Reorder works

---

### T4-04: Auto Rules Panel (Task 4F.5)

**Goal**: UI for editing auto-layer rules (THE killer feature)

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/ui/modal/panel/EditAllAutoLayerRules.hx` (975 lines)

**Output**:

- `src/components/panels/AutoRulesPanel.tsx`

**Requirements**:

```typescript
export function AutoRulesPanel({ layerDef }: { layerDef: LayerDefinition }) {
  const rules = layerDef.autoRuleGroups;
  
  // List rule groups
  // Add rule group
  // Edit rule group:
  //   - Name
  //   - Active/inactive
  //   - Rules in group
  //     - Pattern (3x3 grid)
  //     - Result tile(s)
  //     - Chance (%)
  //     - Break on match
  //     - Flip X/Y
  //     - Perlin noise
}
```

**Key Patterns**:

- EditAllAutoLayerRules.hx lines 400-900: rule editor
- Rule groups (priority order)
- For each rule:
  - Pattern editor (use RulePatternEditor from T2-13)
  - Tile picker for result
  - Chance slider
  - Advanced options (flips, perlin, modulo)
- Preview pane showing rule effect
- Drag to reorder rules
- Enable/disable rules
- Copy/paste rules

**Acceptance**:

- [ ] Build passes
- [ ] Can create rule groups
- [ ] Can add rules
- [ ] Pattern editor works
- [ ] Preview shows results

---

### T4-05: Editor Core (Task 5A.1)

**Goal**: Central Editor class managing state, tools, history

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/Editor.hx` (2456 lines!)

**Output**:

- `src/lib/ldtk/editor.ts`

**Requirements**:

```typescript
export class Editor {
  project: LDtkProject;
  activeLevel: Level | null;
  activeLayer: LayerInstance | null;
  activeTool: Tool;
  camera: Camera;
  history: History;
  
  constructor(project: LDtkProject)
  
  // Tool management
  setTool(tool: Tool): void
  getTool(): Tool
  
  // Level navigation
  setActiveLevel(levelIid: string): void
  setActiveLayer(layerIid: string): void
  
  // Editing
  applyEdit(edit: Edit): void
  undo(): void
  redo(): void
  
  // Rendering
  render(ctx: CanvasRenderingContext2D): void
  
  // Events
  handleMouseDown(e: MouseEvent): void
  handleMouseMove(e: MouseEvent): void
  handleMouseUp(e: MouseEvent): void
  handleKeyDown(e: KeyboardEvent): void
  
  // Clipboard
  copy(): void
  cut(): void
  paste(): void
}
```

**Key Patterns**:

- Editor.hx lines 500-1000: tool coordination
- Editor.hx lines 1000-1500: undo/redo system
- Editor.hx lines 1500-2000: clipboard
- This is the "god class" - coordinates everything
- Manages undo/redo history
- Routes events to tools
- Applies edits to project
- Emits change events
- Auto-save

**Acceptance**:

- [ ] Build passes
- [ ] Can create Editor instance
- [ ] All methods compile
- [ ] Undo/redo works

---

### T4-06: App.tsx Rewrite (Task 5A.2)

**Goal**: Rewrite main App to use LDtk Editor

**Input Files**:

- `Tile-Editors_to-be-scrapped/LDtk/src/electron.renderer/App.hx` (961 lines)
- Existing: `src/App.tsx`

**Output**:

- Update `src/App.tsx`

**Requirements**:

```typescript
export function App() {
  const editor = useEditor();
  const [project, setProject] = useState<LDtkProject | null>(null);
  
  // Layout:
  // +--------------------------------------------------+
  // | Menu Bar                                         |
  // +--------+----------------------------+------------+
  // | Tool   | Canvas                      | Properties|
  // | Palette|                            | Panel     |
  // |        |                            |           |
  // | Tile   |                            | Layers    |
  // | Palette|                            |           |
  // |        |                            | Entities  |
  // +--------+----------------------------+------------+
  
  return (
    <div className="app">
      <MenuBar />
      <div className="main">
        <Sidebar left>
          <ToolPalette />
          <TilesetPanel />
        </Sidebar>
        
        <Canvas>
          {project && <LevelCanvas level={editor.activeLevel} />}
        </Canvas>
        
        <Sidebar right>
          <PropertiesPanel />
          <LayerPanel />
          <EntityPalette />
        </Sidebar>
      </div>
    </div>
  );
}
```

**Key Patterns**:

- App.hx lines 200-600: layout
- App.hx lines 600-900: keyboard shortcuts
- Panel system
- Resizable panels
- Save/load project
- Recent projects
- Keyboard shortcuts (Ctrl+S, Ctrl+Z, etc.)
- Menu bar
- Status bar
- Preserve existing AgentPanel

**Acceptance**:

- [ ] Build passes
- [ ] App renders
- [ ] Can load project
- [ ] Keyboard shortcuts work
- [ ] AgentPanel still accessible

---

## General Notes for All Agents

**Before starting**:

1. Read this entire prompt
2. Read the source Haxe file(s)
3. Check existing PrairieBob code for patterns
4. Understand the data model (Phase 1 files)

**While coding**:

- Follow TypeScript best practices
- Use functional components, hooks
- Zustand for state (not Redux)
- Canvas 2D for rendering (not WebGL/Heaps)
- shadcn/ui for UI components
- No jQuery, no class components

**Testing**:

1. `npm run build` must pass
2. No TypeScript errors
3. No console errors in dev mode
4. Test the feature manually

**Committing**:

- Use conventional commits: `feat(ldtk): add [component]`
- Reference task in commit body: `Task T1-01: Viewport hooks`

**Getting help**:

- If source Haxe is confusing, check LDtk docs: <https://ldtk.io/docs/>
- If stuck, ask in PR comments

---

## Summary Checklist

- [ ] I've read my assigned prompt
- [ ] I've studied the source Haxe file(s)
- [ ] I've checked existing PrairieBob patterns
- [ ] I understand the requirements
- [ ] I know what file(s) to create/edit
- [ ] I've verified build passes after my changes
- [ ] I've committed with clear message

**Let's ship this! 🚀**
