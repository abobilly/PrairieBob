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

## TODO — Phase 2 (Context toolbar actions)

1. Tile context actions:
   - Rotate 90° (button exists disabled in ToolContextBar, needs implementation)
   - Palette snap controls
   - Tile action assignment quick-pick
2. Entity context actions:
   - Animation preview toggle
   - State mapper quick switch (N/E/S/W + interact)
   - Speed and zone quick controls
3. Collision context actions:
   - Paint/erase/fill mode toggle button (flood fill exists via Shift+click, no explicit toggle UI)
   - Source layer linking shortcuts in context bar

## TODO — Phase 3 (Inspector tabs)

1. Inspector tabs standardized across tools:
   - `Quick` / `Advanced` / `Bindings` / `Preview`
2. Keep panel hierarchy stable while swapping tab contents by tool/entity type.
3. Note: all 5 sections already use `InspectorSection` scaffold — tab system would add depth within each section.

## TODO — Phase 4 (Validation panel)

1. Standalone validation panel (currently warnings are inline in TileActionsPanel only):
   - Missing animation/state mappings
   - Invalid room links
   - Collision source conflicts
2. World+entity integration:
   - Door/NPC link diagnostics
   - Room graph health checks

## TODO — Phase 5 (Entity behavior editor)

1. Movement timelines and state transitions
2. On-load and on-interact behavior scripting controls
3. Per-state timing, direction sets, and previewable state graphs

## TODO — Phase 6 (Regression tests)

1. Panel sizing and resize persistence
2. Startup modal layout and overflow behavior
3. TMX/Kimbar load path and fallback behavior

## TODO — Phase 7 remaining

1. Visual state previews: frame/row thumbnails next to state names in behavior cards
2. Quick-jump from validation warnings to entity/action mapping editor
3. Definition merge: canonical ID strategy to prevent duplicate door groups on save/load

## TODO — Phase 8 (Behavior authoring polish)

1. "Open Entity" / "Fix Mapping" action buttons in warnings
2. Filter modes: All, Missing mappings, Definition-backed, Custom
3. Save/load roundtrip preserves merged mappings without regenerating duplicates

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
