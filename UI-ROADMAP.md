# SpudTile UI Roadmap

## Goal
Stabilize layout and ship a scalable, tool-context editor UI so new features do not force repeated layout rewrites.

## Phase 1 (Shipped in this pass)
1. Keep top toolbar global-only.
2. Add a second context toolbar under the global bar.
3. Move tile flip controls into context toolbar (icon-only, tile tools only).
4. Add context messaging for `Tile`, `Entity`, and `Collision` workflows.

## Phase 2 (Next)
1. Tile context actions:
   - Rotate 90
   - Palette snap controls
   - Tile action assignment quick-pick
2. Entity context actions:
   - Animation preview toggle
   - State mapper quick switch (N/E/S/W + interact)
   - Speed and zone quick controls
3. Collision context actions:
   - Paint/erase/fill toggle
   - Source layer linking shortcuts
   - Derived strategy selector (`occupied`, `alpha`, `edge`)

## Phase 3
1. Inspector tabs standardized across tools:
   - `Quick`
   - `Advanced`
   - `Bindings`
   - `Preview`
2. Keep panel hierarchy stable while swapping tab contents by tool/entity type.

## Phase 4
1. Validation panel:
   - Missing animation/state mappings
   - Invalid room links
   - Collision source conflicts
2. World+entity integration:
   - Door/NPC link diagnostics
   - Room graph health checks

## Phase 5
1. Entity behavior editor depth:
   - Movement timelines and state transitions
   - On-load and on-interact behavior scripting controls
   - Per-state timing, direction sets, and previewable state graphs

## Phase 6
1. Regression test matrix:
   - Panel sizing and resize persistence
   - Startup modal layout and overflow behavior
   - TMX/Kimbar load path and fallback behavior

## Phase 7
1. Inspector IA refactor:
   - Properties collapsed by default with sticky summary row
   - Tool-aware inspector sections (`Properties`, `Layers`, `Tile Actions`, `Entities`)
   - Consistent light/dark tokens for all inspector controls (no mixed dark widgets in light theme)
2. Collision UX model:
   - Represent source-layer linking as part of collision workflow, not a detached checklist
   - Show explicit derived collision status (`n linked`, overlay on/off, source strategy)
   - Add one-click presets (Walls+Furniture default, custom set, manual-only)
3. Tile actions and entity behavior alignment:
   - Replace flat list with grouped behavior cards (`Doors`, `NPC`, `Player`, `Props`)
   - Show visual state previews (frame/row thumbnails) next to state names
   - Bind action groups directly to entity/interaction definitions to eliminate duplicate door groups
   - Surface missing NPC/player action mappings in inspector validation

## Handoff Notes
1. Immediate bug guardrail:
   - Radix `SelectItem` values must never be empty string; use sentinel values for "None".
2. Focus follow-up:
   - Migrate remaining inspector widgets to a unified section scaffold before adding more behavior features.

## Layout Rules (Do Not Break)
1. Side panels must never render below usable width.
2. Global controls stay in top toolbar only.
3. Tool-specific controls only in context toolbar + inspector.
4. Agent/terminal controls stay bottom panel only.
