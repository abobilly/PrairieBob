# SpudTile UI Roadmap

## Goal
Stabilize layout and ship a scalable, tool-context editor UI so new features do not force repeated layout rewrites.

---

## DONE — Phase 1 (Toolbar layout)

1. ~~Top toolbar global-only.~~
2. ~~Context toolbar under global bar.~~ → `ToolContextBar.tsx`, `.pb-context-toolbar`
3. ~~Tile flip controls in context toolbar.~~ → FlipH/FlipV buttons wired to `toolStore`
4. ~~Context messaging for Tile, Entity, and Collision.~~ → kicker + hint per tool context

## DONE — Phase 7.1 (Inspector IA refactor)

1. ~~Properties collapsed by default with sticky summary row.~~
2. ~~Tool-aware inspector sections.~~ → `InspectorSection.tsx` with 5 sections: Properties, Layers, Collision, Tile Actions, Entities
3. ~~Consistent light/dark tokens.~~ → `ldtk-theme.css` token system

## DONE — Phase 7.2 (Collision UX model)

1. ~~Source-layer linking as part of collision workflow.~~ → `CollisionPanel.tsx`
2. ~~Derived collision status (n linked, overlay on/off, strategy).~~ → status row
3. ~~One-click strategy presets (Walls+Furniture, Custom, Manual).~~ → strategy buttons
4. ~~Derived overlay toggle.~~ → eye/eyeoff checkbox
5. ~~Collision model (merged/manual/derived).~~ → `collision-model.ts`, wired into RunTestOverlay + LevelCanvas

## DONE — Phase 7.3 (Tile actions + behavior alignment)

1. ~~Grouped behavior cards (Doors, NPC, Player, Props, Custom).~~ → `TileActionsPanel.tsx` with `BehaviorCategory`
2. ~~Entity/interaction definition binding.~~ → `inferBehaviorCategory()`, defs wired from App.tsx
3. ~~Missing mapping validation warnings.~~ → `validateBehaviorMappings()` + warnings panel
4. ~~Inline tile ID badges for state previews.~~ → `TileIdBadge` component

---

## DONE — Phase 2 (Context toolbar actions)

1. Tile context actions:
   - ~~Rotate 90°~~ ✅ (tileRotation state in toolStore, rotation bits in f field, all tile tools + rendering)
   - ~~Palette snap controls~~ ✅ (paletteSnap in toolStore, Grid3x3 toggle in ToolContextBar)
   - ~~Tile action assignment quick-pick~~ ✅ (Zap icon select dropdown in tile context, fires onAssignTileAction)
2. Entity context actions:
   - ~~Animation preview toggle~~ ✅ (entityAnimPreview in toolStore, Play/Pause toggle in entity context)
   - ~~State mapper quick switch (N/E/S/W + interact)~~ ✅ (ArrowUp/Right/Down/Left + MousePointerClick for direction types; state preset toggles for door/lock/switch)
   - ~~Speed and zone quick controls~~ ✅ (native range slider for speed, native select for zone, NPC-only)
3. Collision context actions:
   - ~~Paint/erase/fill mode toggle button~~ ✅ (collisionPaintMode in toolStore, paint/erase/fill buttons in ToolContextBar, IntGridTool respects mode)
   - ~~Source layer linking shortcuts in context bar~~ ✅ (chip-style layer toggles in collision context, custom strategy only, Link/Unlink icons)

## DONE — Phase 3 (Inspector tabs)

1. ~~Inspector tabs standardized across tools:~~
   - ~~`Quick` / `Advanced` / `Bindings` / `Preview`~~ ✅ `InspectorTab` type in InspectorSection.tsx, tab bar CSS in ldtk-theme.css
2. ~~Keep panel hierarchy stable while swapping tab contents by tool/entity type.~~ ✅ Tab state managed in App.tsx, passed to InspectorSection + child panels
3. ~~Properties: Quick / Advanced / Bindings tabs~~ ✅ PropertiesPanel.tsx — Quick (ID/position/state/character), Advanced (movement/animations/speed/zones/triggers), Bindings (targetRoom/spawn/interactionId/entityDefId/storyKnot/zoneId)
4. ~~Collision: Quick / Advanced tabs~~ ✅ CollisionPanel.tsx — Quick (status + strategy + overlay), Advanced (source layer configuration)
5. ~~Tile Actions: Quick / Advanced tabs~~ ✅ TileActionsPanel.tsx — Quick (category overview, read-only), Advanced (full state/trigger/effect editors + add group)
6. Layers and Entities sections remain tab-free (already compact)

## DONE — Phase 4 (Validation panel)

1. ~~Standalone validation panel~~ ✅ `ValidationPanel.tsx` — aggregated project-wide diagnostics as new InspectorSection (collapsed by default, orange accent)
   - ~~Missing animation/state mappings~~ ✅ NPC no-states, spawn no-group, door few-states checks
   - ~~Invalid room links~~ ✅ Entity targetRoom → roomRegistry lookup
   - ~~Collision source conflicts~~ ✅ Custom strategy with 0 layers, auto_walls with no matching layers
2. ~~World+entity integration~~ ✅
   - ~~Door/NPC link diagnostics~~ ✅ Unbound door (no interactionId/entityDefId), unbound NPC, bad references to missing definitions
   - ~~Room graph health checks~~ ✅ Invalid room references detected per-entity
3. Validation engine: `src/lib/validation.ts` — `validateProject()` aggregates 4 check categories, `groupByCategory()` for display
4. Severity filter (All/Errors/Warnings/Info) + collapsible category groups + issue count badge

## DONE — Phase 5 (Entity behavior editor)

1. ~~Movement timelines and state transitions~~ ✅ `BehaviorEditor.tsx` — `MovementSection` renders mode/speed/direction-change-interval, `StateDetailsSection` shows state nodes with tile IDs and collision flags
2. ~~On-load and on-interact behavior scripting controls~~ ✅ `TriggerSection` renders onLoad/onInteract triggers with resolved animation badges
3. ~~Per-state timing, direction sets, and previewable state graphs~~ ✅ `StateGraph.tsx` SVG state machine visualization (auto-layout, bidirectional edge curves, default/collision indicators), `DirectionSetSection` classifies direction-based animation groups, `behavior-graph.ts` model (~311 lines) with `buildEntityGraph()`, `buildInteractionGraph()`, `extractMovementTimeline()`, `extractBehaviorTriggers()`, `classifyDirectionSets()`
4. Wired into `PropertiesPanel.tsx` "preview" tab via `BehaviorEditor` component, resolves entityDefId/interactionId from entity properties

## DONE — Phase 6 (Regression tests)

1. ~~Panel sizing and resize persistence~~ ✅ `src/lib/__tests__/ui-store-persistence.test.ts` — 7 tests covering persist merge, migrate, corrupted/legacy data recovery, runtime normalization, collapsed state roundtrip
2. ~~Startup modal layout and overflow behavior~~ ✅ `src/lib/__tests__/project-selector-layout.test.ts` — 7 structural tests verifying min() width cap, max-height overflow, responsive grid-cols-1→sm:grid-cols-2, min-w-0 flex guards, dismiss blocking, truncation, and bounded scroll height
3. ~~TMX/Kimbar load path and fallback behavior~~ ✅ `src/lib/__tests__/room-loader.test.ts` — 15 tests covering TMX CSV + XML tile elements + object groups, Tiled JSON maps + object layers, SpudTile JSON normalization, LDtk project parsing, and 6 error/fallback cases (invalid content, unrecognized JSON, TSX rejection, missing map root, empty string, array input)
4. Test infrastructure: vitest 4.x added (`vitest.config.ts`, `npm test` script in package.json)

## TODO — Phase 7 remaining

1. Visual state previews: frame/row thumbnails next to state names in behavior cards
2. Quick-jump from validation warnings to entity/action mapping editor

## DONE — Phase 7.3 (Definition merge dedup)

1. ~~Definition merge: canonical ID strategy to prevent duplicate door groups on save/load~~ ✅ `combineTileActionGroups()` in `projectStore.ts` refactored to use `Map<id, group>` for guaranteed uniqueness — definition-backed groups (entity:/interaction:) always take precedence, custom groups only appear if their ID doesn't collide
2. ~~Save path safety filter~~ ✅ `saveMap()` now filters `customTileActionGroups` through `isDefinitionBackedGroupId()` before serialization — prevents stale definition-backed groups from leaking into project.json
3. Tests: `src/lib/__tests__/tile-action-dedup.test.ts` — 10 tests covering dedup, precedence, collisions, roundtrip serialization, and edge cases

## DONE — Phase 8.2 (Filter modes for TileActionsPanel)

1. ~~Filter modes: All, Missing mappings, Definition-backed, Custom~~ ✅ `TileActionsPanel.tsx` — filter bar with Funnel icon + 4 chip-style toggle buttons above category cards, `useState<FilterMode>` local to panel, `filteredGroups` memo using `inferBehaviorCategory()` + `validateBehaviorMappings()` from `tile-actions.ts`, counter badge shows filtered/total when active, empty state message is filter-aware

## DONE — Phase 8.3 (Save/load roundtrip preservation)

1. ~~Save/load roundtrip preserves merged mappings without regenerating duplicates~~ ✅ Load path: persisted groups filtered by `!isDefinitionBackedGroupId()` before merge. Save path: `customTileActionGroups` filtered to exclude definition-backed groups before serialization. Combined via `combineTileActionGroups()` with Map-based dedup. Definition-backed group state synced back to definition files via `syncInteractionDefinitionFromActionGroup()`/`syncEntityDefinitionFromActionGroup()`, so re-derivation on load preserves edits.

## TODO — Phase 8 remaining (Behavior authoring polish)

1. "Open Entity" / "Fix Mapping" action buttons in warnings

---

## Handoff Notes

1. Radix `SelectItem` values must never be empty string; use sentinel values for "None".
2. Inspector section headers must be `shrink-0` to avoid clipped/cropped controls.
3. Startup/project selector actions should collapse to one column on narrow widths.

## Layout Rules (Do Not Break)

1. Side panels must never render below usable width.
2. Global controls stay in top toolbar only.
3. Tool-specific controls only in context toolbar + inspector.
4. Agent/terminal controls stay bottom panel only.
