# PrairieBob - Tile Map Editor PRD

A web-based tile map editor designed for AI-assisted game development with live interaction previews and CLI-ready architecture.

**Experience Qualities**:
1. **Precise** - Every pixel matters in tile-based games; the editor provides pixel-perfect placement with snap-to-grid controls and clear visual feedback
2. **Efficient** - Game developers need speed; keyboard shortcuts, context menus, and smart defaults minimize clicks and maximize flow
3. **Transparent** - Complex data structures should be visible; real-time property editing and live state previews show exactly what's being exported

**Complexity Level**: Complex Application (advanced functionality with multiple views)
- This is a full-featured editor with canvas rendering, entity management, layer systems, interaction states, file I/O, and persistent storage. It requires coordinated state management across toolbars, panels, canvas, and property inspectors.

## Essential Features

### Project Linking & Configuration
- **Functionality**: Persists project configuration linking to external game folders with paths to tilesets, rooms, and specs
- **Purpose**: Enables PrairieBob to integrate with existing game projects and maintain context across sessions
- **Trigger**: App launch or "Link Project" button
- **Progression**: Empty state → Configuration wizard → Path validation → Project dashboard → Ready state
- **Success criteria**: Config saved to IndexedDB, project name displays in header, paths resolve correctly

### Canvas Rendering & Navigation
- **Functionality**: HTML5 Canvas 2D rendering of tile layers with pan/zoom controls
- **Purpose**: Visual workspace for map creation with smooth navigation of large maps
- **Trigger**: Map loaded or new map created
- **Progression**: Initialize canvas → Render grid → Render layers (bottom-up) → Apply camera transform → Handle input
- **Success criteria**: 60fps at 100% zoom, smooth pan with middle-mouse, zoom 0.25x-4x with wheel

### Tile Painting Tools
- **Functionality**: Brush, fill, rectangle, eraser tools for painting tiles onto active layer
- **Purpose**: Core editing capability for building tile-based environments
- **Trigger**: Tool selected + click/drag on canvas
- **Progression**: Select tool → Choose tile from palette → Click/drag on canvas → Update layer data → Render change
- **Success criteria**: Immediate visual feedback, undo/redo support, works on all tile layers

### Layer Management System
- **Functionality**: Six predefined layers (Floor, Walls, Trim, Overlays, Collision, Entities) with visibility/lock toggles
- **Purpose**: Organizes map content by rendering order and functionality
- **Trigger**: Layer panel interaction
- **Progression**: Select layer → Toggle visibility/lock → Active layer highlighted → Only active layer editable
- **Success criteria**: Layers render in correct order, collision shows as red overlay, entities appear on top

### Entity Placement & Properties
- **Functionality**: Place spawn points, doors, NPCs, triggers, props with editable properties
- **Purpose**: Defines game logic, transitions, and character placement beyond visual tiles
- **Trigger**: Select entity type from palette + click canvas
- **Progression**: Choose entity type → Click placement → Properties panel opens → Edit ID/properties → Save to entities layer
- **Success criteria**: Entities draggable, properties persist, NPCs link to character specs, doors define room transitions

### Live Interaction Preview (Doors)
- **Functionality**: Toggle between door states (closed/open) with live tile and collision updates
- **Purpose**: Killer feature - preview interaction states without running the game
- **Trigger**: Select door entity → Click state button in properties panel
- **Progression**: Door selected → State buttons appear → Click "open" → Tiles update on canvas → Collision overlay changes → Visual highlight feedback
- **Success criteria**: Instant state switching, collision visualization updates, works for multiple door types

### Export to KimBar Format
- **Functionality**: Serializes map to JSON matching game engine schema with validation
- **Purpose**: Bridge between editor and game runtime
- **Trigger**: Export button or Ctrl+E
- **Progression**: Validate required entities → Flatten layer data → Serialize entities → Generate metadata → Download JSON file
- **Success criteria**: Valid JSON schema, all layers included, entity properties preserved, imports cleanly into game

## Edge Case Handling

- **Out of bounds painting**: Clamp cursor to map dimensions or show ghost preview
- **Missing tilesets**: Display checkerboard pattern, show warning, provide fallback texture
- **Invalid entity properties**: Highlight invalid fields in red, disable export until fixed
- **Corrupted map data**: Load recovery mode showing JSON editor, backup previous version
- **Empty layers**: Show helper text "Click to paint" when active layer is empty
- **Overlapping entities**: Visual stacking order indicator, z-index sorting in properties
- **Unsaved changes**: Prompt on exit, auto-save to IndexedDB every 30 seconds
- **Large maps**: Render only visible tiles (viewport culling), virtual scrolling for layers

## Design Direction

The design should evoke a **professional game development tool** - utilitarian yet polished. Think Unity Inspector meets Figma precision. The interface prioritizes information density and keyboard-driven workflows while maintaining clarity through subtle borders and muted backgrounds. Color accents highlight the active tool/layer to reduce cognitive load.

## Color Selection

A neutral, low-saturation workspace lets colorful game art pop while maintaining professional tool aesthetics.

- **Primary Color**: Deep charcoal `oklch(0.28 0.015 265)` - Professional and unobtrusive, grounds the UI without competing with canvas content
- **Secondary Colors**: Steel gray `oklch(0.45 0.01 265)` for panels and borders; warm tan `oklch(0.75 0.04 75)` for hover states echoing the prairie theme
- **Accent Color**: Prairie gold `oklch(0.72 0.15 85)` - Earthy and distinctive, draws attention to active tools and selected entities
- **Foreground/Background Pairings**: 
  - Background (Canvas) `oklch(0.35 0.01 265)`: Light gray text `oklch(0.92 0.005 265)` - Ratio 7.2:1 ✓
  - Primary (Toolbar) `oklch(0.28 0.015 265)`: White text `oklch(0.98 0 0)` - Ratio 11.5:1 ✓
  - Accent (Active Tool) `oklch(0.72 0.15 85)`: Charcoal text `oklch(0.28 0.015 265)` - Ratio 5.1:1 ✓
  - Secondary (Panels) `oklch(0.45 0.01 265)`: Light text `oklch(0.92 0.005 265)` - Ratio 4.8:1 ✓

## Font Selection

Typography should be legible at small sizes for property labels while maintaining character for headers. The typeface needs excellent number/symbol clarity for coordinates and IDs.

- **Typographic Hierarchy**:
  - H1 (App Title): Space Grotesk Bold/24px/tight letter spacing - Geometric, technical feel
  - H2 (Panel Headers): Space Grotesk Medium/14px/0.5px spacing - Clear hierarchy
  - Body (Properties): Inter Regular/13px/normal spacing - Maximum readability
  - Monospace (IDs/Coords): JetBrains Mono Regular/12px/normal - Code-like precision
  - Small (Tooltips): Inter Regular/11px/0.3px spacing - Compact yet clear

## Animations

Animations reinforce spatial relationships and provide feedback without distracting from creative flow. Micro-interactions confirm actions (button press springs), while canvas operations remain instant.

Use subtle, purposeful motion: tool selection highlight slides (150ms ease-out), panel expansions unfold smoothly (200ms ease-in-out), entity dragging shows elevation shadow. Avoid animating the canvas render itself - painting should feel zero-latency. State preview transitions (door open/close) crossfade tiles over 120ms to emphasize the change without feeling sluggish.

## Component Selection

- **Components**: 
  - `Button` - Tool palette icons, action buttons (Tailwind: hover:scale-105 for active tool feedback)
  - `Card` - Panel containers for Layers, Properties, Entities (subtle shadow for depth)
  - `Tabs` - Switching between Tilesets/Entities in left sidebar
  - `Label` + `Input` - Property editing forms with inline validation
  - `Select` - NPC character dropdown, room target selection
  - `Separator` - Divide panels and toolbar sections
  - `Tooltip` - Keyboard shortcuts and tool descriptions
  - `ScrollArea` - Tileset palette, entity list, layer stack
  - `Toggle` - Layer visibility/lock icons
  - `ContextMenu` - Right-click canvas for quick actions
  - Custom Canvas Component - Main editing surface (not Shadcn)

- **Customizations**:
  - Custom Canvas Renderer with grid overlay, multi-layer compositing
  - Tool palette with icon-based toggle buttons (active state = accent border)
  - Layer stack with drag-to-reorder (not MVP, but styled for it)
  - Entity property inspector with dynamic field generation
  - Zoom slider with percentage display

- **States**:
  - Buttons: default (muted), hover (secondary), active (accent border + slight scale), disabled (opacity-50)
  - Inputs: focus (accent ring), error (destructive border), valid (subtle success glow)
  - Canvas: idle (default cursor), painting (crosshair), panning (grab/grabbing), selecting (crosshair)
  - Entities: default (subtle outline), hover (accent outline), selected (thick accent border + handles)

- **Icon Selection**:
  - Tools: Pencil (Brush), PaintBucket (Fill), Rectangle, Eraser, CursorClick (Select)
  - Entities: MapPin (spawn), DoorOpen (door), User (NPC), Lightning (trigger), Package (prop)
  - Layers: Eye/EyeSlash (visibility), Lock/LockOpen (lock toggle)
  - Actions: FloppyDisk (save), Export, FolderOpen, Plus, Trash

- **Spacing**:
  - Toolbar: p-2 gap-1 (compact tool access)
  - Panels: p-4 gap-3 (comfortable reading)
  - Canvas area: No padding (full bleed)
  - Property fields: gap-2 (tight forms)
  - Status bar: px-4 py-2 (minimal footer)

- **Mobile**:
  - Not primary target (desktop tool), but responsive:
  - Collapse left sidebar to icon-only drawer
  - Right panel becomes bottom sheet
  - Canvas remains center, touch-optimized pan/zoom
  - Tool palette becomes horizontal scrolling strip
  - Properties open as modal overlay
