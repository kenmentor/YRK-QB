## Context

Activities + builder exist; archive lists; bank grid has minimal menus; sharing model (viewer/reviewer/editor) enforced server-side.

## Goals / Non-Goals

**Goals:** create-from-archive, create-on-the-fly in builder, full context menus incl. file delete, subtle shared badge.

**Non-Goals:** per-file public/shares (folder remains the unit), bulk ops — deferred.

## Decisions

### 1. Files delete via `DELETE /api/bank/[id]` (over soft-delete)
Creator, containing-folder owner, or admin may delete; attempt history rows stay (history resolves missing as Untagged).
Rationale: personal files need real removal; history integrity preserved by tolerant reads.

### 2. Assign/view-people reuse the Share modal with scope (over new screens)
Menus open the existing Share dialog scoped to the item's folder (files inherit folder shares); "Assign" focuses email, "Assigned people" opens the list.
Rationale: one screen, no duplicated role logic.

### 3. Shared = slate people glyph + tooltip (over color wash)
Amber folders / type icons unchanged; shared items get a small overlapping people badge with "Shared by X" title. Sidebar uses the same glyph, active states stay indigo.
Rationale: matches Drive's professional affordance; color stays semantic (selection/focus only).

## Risks / Trade-offs

- [File delete orphans exam-set/activity refs] → Mitigation: resolvers skip dead ids and report counts (already).
- [Menu growth crowds mobile] → Mitigation: menus stay in the ⋮ sheet; primary actions unchanged.
