# PrairieBob Tier 1 MVP - GitHub Spark Prompt

> Copy this entire prompt into GitHub Spark to generate the initial application.

---

## Project Description

Build "PrairieBob" - a web-based tile map editor designed for AI-assisted game development. The editor links to external game projects via filesystem paths and provides a visual editing experience for 2D tile-based games.

**Key differentiator**: Unlike Tiled or LDtk, PrairieBob shows live interaction previews (e.g., door open/close states) and exposes a CLI command surface for AI assistants to manipulate maps programmatically.

---

## Core Features (Tier 1 MVP)

### 1. Project Linking & Startup Screen

On launch, show a prominent startup screen with:

- Linked project name and status (e.g., "kimbar - Connected")
- Project root path display
- Quick action buttons: "Open Project", "New Map", "Recent Maps"
- If no project linked: Setup wizard to configure `prairiebob.config.json`

**Config format** (stored in IndexedDB or localStorage for web):

```json
{
  "linkedProjects": [{
    "name": "kimbar",
    "rootPath": "C:/Users/andre/lawchuck/badgey.org/kimbar",
    "contentPath": "public/content",
    "specsPath": "specs",
    "tileSize": 16,
    "paths": {
      "tilesets": "public/assets/tilesets",
      "tiledRooms": "public/content/tiled/rooms",
      "characters": "specs/characters",
      "roomEntries": "specs/room_entries"
    }
  }],
  "defaultProject": "kimbar"
}
```

### 2. Tileset Picker Panel

Left sidebar showing available tilesets:

- Grid of tile thumbnails (16x16 tiles)
- Click to select active tile
- Multi-select for stamp tool (shift+click)
- Search/filter by tileset name

**Sample tilesets** (for demo, embed these as base64 or fetch from URLs):

- Floor tiles (stone, wood, marble variants)
- Wall tiles (interior, exterior)
- Decorative props

### 3. Canvas & Painting Tools

Center canvas area:

- Pan: Middle mouse drag or Space+drag
- Zoom: Mouse wheel (0.25x to 4x)
- Grid overlay toggle (G key)

Painting tools (toolbar):

- **Brush** (B): Paint single tile at cursor
- **Bucket Fill** (F): Flood fill connected same-tiles
- **Rectangle** (R): Click-drag to fill rectangle
- **Eraser** (E): Remove tiles (set to empty)
- **Select** (S): Rectangle selection for copy/paste

### 4. Layer System

Layer panel (right sidebar):

- Predefined layers for kimbar compatibility:
  1. Floor (tilelayer)
  2. Walls (tilelayer)
  3. Trim (tilelayer)
  4. Overlays (tilelayer)
  5. Collision (tilelayer - special: renders as red overlay)
  6. Entities (objectgroup)

- Layer visibility toggle (eye icon)
- Layer lock toggle (lock icon)
- Active layer highlight

### 5. Entity Placement

Entity palette showing available entity types:

```typescript
type EntityType = 
  | "spawn_point"      // Player/NPC spawn locations
  | "door"             // Transitions between rooms
  | "npc"              // Non-player characters
  | "trigger"          // Interaction zones
  | "prop";            // Interactive objects
```

Entity property panel when selected:

- **spawn_point**: `id: string`
- **door**: `id: string, targetRoom: string, targetSpawn: string`
- **npc**: `id: string, characterId: string` (dropdown from characters list)
- **trigger**: `id: string, action: string`
- **prop**: `id: string, propType: string`

**Sample character list** (for NPC dropdown):

```json
[
  { "id": "npc.justice_roberts", "name": "Chief Justice Roberts" },
  { "id": "npc.justice_thomas", "name": "Justice Thomas" },
  { "id": "npc.justice_alito", "name": "Justice Alito" },
  { "id": "npc.justice_sotomayor", "name": "Justice Sotomayor" },
  { "id": "npc.justice_kagan", "name": "Justice Kagan" },
  { "id": "npc.justice_gorsuch", "name": "Justice Gorsuch" },
  { "id": "npc.justice_kavanaugh", "name": "Justice Kavanaugh" },
  { "id": "npc.justice_barrett", "name": "Justice Barrett" },
  { "id": "npc.justice_jackson", "name": "Justice Jackson" },
  { "id": "npc.clerk", "name": "Court Clerk" },
  { "id": "npc.bailiff", "name": "Bailiff" },
  { "id": "npc.librarian", "name": "Librarian" }
]
```

### 6. Simple Interactions (Door Preview)

**THE KILLER FEATURE**: Live interaction state preview.

Interaction definition format:

```typescript
interface Interaction {
  id: string;
  type: "door" | "chest" | "switch";
  states: {
    [stateName: string]: {
      tiles: number[][];  // 2D array of tile IDs
      collision: boolean;
    }
  };
  defaultState: string;
}
```

Example door interaction:

```json
{
  "id": "door_wooden",
  "type": "door",
  "states": {
    "closed": {
      "tiles": [[101, 102], [103, 104]],
      "collision": true
    },
    "open": {
      "tiles": [[105, 106], [107, 108]],
      "collision": false
    }
  },
  "defaultState": "closed"
}
```

UI: When a door entity is selected, show toggle buttons for each state. Clicking a state button:

1. Updates the canvas to show those tiles
2. Updates collision overlay
3. Shows visual feedback (highlight the door)

### 7. Export to KimBar Format

Export button generates JSON matching this schema:

```typescript
interface LevelData {
  id: string;
  width: number;   // in tiles
  height: number;  // in tiles
  tileSize: number;
  layers: {
    name: string;
    type: "tilelayer" | "objectgroup";
    data?: number[];  // 1D array, row-major (for tilelayer)
    objects?: EntityData[];  // (for objectgroup)
  }[];
  metadata: {
    editedAt: string;  // ISO timestamp
    exportedFrom: "prairiebob";
    version: "1.0.0";
  };
}

interface EntityData {
  id: string;
  type: string;
  x: number;  // pixel position
  y: number;
  width: number;
  height: number;
  properties: Record<string, string | number | boolean>;
}
```

Export workflow:

1. Click "Export" button
2. Validate map (check for missing required entities)
3. Generate JSON
4. Download as `{mapId}.json`

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [PrairieBob]  [File ▼]  [Edit ▼]  [View ▼]   │kimbar│  [Export] │
├─────────────┬───────────────────────────────┬───────────────────┤
│ TILESETS    │                               │ LAYERS            │
│ ┌─────────┐ │                               │ ☑ Entities        │
│ │ ▦ ▦ ▦ ▦ │ │                               │ ☑ Collision       │
│ │ ▦ ▦ ▦ ▦ │ │         CANVAS                │ ☑ Overlays        │
│ │ ▦ ▦ ▦ ▦ │ │                               │ ☑ Trim            │
│ └─────────┘ │      (pan/zoom/paint)         │ ☑ Walls           │
│             │                               │ ☐ Floor           │
│ ENTITIES    │                               ├───────────────────┤
│ ○ spawn     │                               │ PROPERTIES        │
│ ◇ door      │                               │ id: [door_01    ] │
│ ● npc       │                               │ target: [lobby  ] │
│ □ trigger   │                               │ spawn: [default ] │
│             │                               │                   │
├─────────────┴───────────────────────────────┴───────────────────┤
│ Tool: Brush │ Layer: Floor │ Pos: (12, 8) │ Zoom: 100%          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Preferences

- **Framework**: React with hooks
- **Rendering**: HTML5 Canvas 2D (not WebGL for simplicity)
- **State**: React Context or Zustand for global state
- **Styling**: Tailwind CSS or CSS modules
- **Storage**: IndexedDB for map persistence, localStorage for settings

---

## Sample Data for Testing

### Sample Map (20x15 tiles)

```json
{
  "id": "test_room",
  "width": 20,
  "height": 15,
  "tileSize": 16,
  "layers": [
    {
      "name": "Floor",
      "type": "tilelayer",
      "data": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
               1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
               1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,
               "...repeat for 15 rows..."]
    },
    {
      "name": "Entities",
      "type": "objectgroup",
      "objects": [
        { "id": "spawn_default", "type": "spawn_point", "x": 160, "y": 120, "width": 16, "height": 16, "properties": {} },
        { "id": "door_to_lobby", "type": "door", "x": 160, "y": 0, "width": 32, "height": 16, "properties": { "targetRoom": "scotus_1_lobby", "targetSpawn": "default" } }
      ]
    }
  ]
}
```

### Embedded Tileset (for demo - 4x4 basic tiles)

Create a simple 64x64 pixel tileset image with 16 tiles (4x4 grid):

- Tile 0: Empty (transparent)
- Tile 1: Stone floor (gray)
- Tile 2: Wood floor (brown)
- Tile 3: Marble floor (white with veins)
- Tile 4-7: Wall variations
- Tile 8-11: Door tiles (closed top-left, top-right, bottom-left, bottom-right)
- Tile 12-15: Door tiles (open variants)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| B | Brush tool |
| E | Eraser tool |
| F | Fill tool |
| R | Rectangle tool |
| S | Select tool |
| G | Toggle grid |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save map |
| Ctrl+E | Export |
| Delete | Delete selected entity |
| 1-6 | Quick-select layer |

---

## Acceptance Criteria

1. ✅ Startup shows linked project prominently
2. ✅ Can paint tiles on a canvas with brush tool
3. ✅ Can place entities and edit their properties
4. ✅ Layers are visible and can be toggled
5. ✅ Door interactions show state preview (closed/open)
6. ✅ Export produces valid JSON matching the schema
7. ✅ Map persists between sessions (IndexedDB)

---

## Future Enhancements (Not for MVP)

- File System Access API for direct project folder access
- Copilot CLI command generation
- BobTile atlas packing integration
- Auto-tiling with Wang tiles
- Multi-room world view
- Animation preview for NPCs
- Validation against kimbar schemas

---

*This prompt is designed for GitHub Spark. Adjust complexity based on Spark's capabilities.*
