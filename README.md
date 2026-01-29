# PrairieBob

AI-assisted tile editor for pixel art games. Designed to integrate with kimbar's Tiled pipeline.

## Features

- **Tile painting** - Brush, fill, rectangle, eraser tools
- **Layer management** - Floor, Walls, Trim, Overlays, Collision, Entities
- **Entity placement** - NPCs, doors, spawn points with properties
- **Keyboard shortcuts** - B(rush), F(ill), R(ect), E(raser), S(elect), G(rid)
- **Export** - JSON format compatible with Tiled/LDtk
- **Embedded AI Agent** - Chat or terminal interface powered by Copilot SDK

## Copilot SDK Integration

PrairieBob embeds GitHub Copilot as an AI assistant that can directly manipulate your maps.

### Agent Panel (bottom of editor)

**Chat tab** - Natural language commands:
- "Fill the floor with grass tiles"
- "Add a door at position 5,3"
- "Export this map as kimbar format"

**Terminal tab** - CLI-style commands:
```bash
pb help                              # Show commands
pb list layers|tilesets|entities     # List resources
pb fill --layer Floor --tile 5       # Fill layer
pb paint --layer Walls --tile 3 --at 5,5
pb spawn --entity door --at 100,50
pb ask <natural language>            # Ask agent anything
```

### Custom Tools

The agent has access to these editor tools:
- `paint_tiles` - Paint tiles on any layer
- `fill_layer` - Fill a layer or region
- `place_entity` - Add entities (door, npc, spawn_point, trigger, prop)
- `export_map` - Export to kimbar/tiled/json
- `get_map_info` - Query current map state
- `list_tiles` - List available tiles

### SDK Setup

All four Copilot SDKs are installed:

| SDK | Location | Use |
|-----|----------|-----|
| Node.js | `package.json` | Editor UI integration |
| Go | `cli/` | Standalone CLI tool |
| Python | Global | Scripts/automation |
| .NET | `CopilotApp/` | Future Unity tooling |

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run electron:dev # Full Electron app
```

## CLI (Go)

```bash
cd cli
go build -o prairiebob.exe .
./prairiebob --help
```

## Upgrade dependencies

```bash
npm run upgrade
```

## License

MIT
