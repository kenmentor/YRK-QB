## Why

Archive and Play both list artifacts but feel identical: Play should read as curriculum (activities grouped along a ladder), Archive as a free world that still shows each item's category. The builder splits linking into questions-vs-folders (one flow should link either — both extract into the activity), and its single long page is cluttered instead of tool-like.

## What Changes

- Activities gain `category`/`sector`/`subject`; archive + Play group by category (curriculum order: primary → secondary → tertiary → professional → other); archive adds category chips + search; public folders show derived dominant category/sector.
- Assembly becomes one ordered list of mixed refs (`assembly: [{kind:'q'|'f', id}]`); resolve honors exact order; legacy fields derived for compat.
- Builder becomes tabbed (Content | Presentation | Rules | People): unified Add-content search (bank files + folders together, incl. public-use), inline question creation, ordered mixed assembly with folder previews, autosaving profile/rules, people + danger in place.

## Capabilities

### New Capabilities
- `curriculum-grouping`: activity categories, archive chips/sections, Play curriculum ladder, folder category derivation.
- `builder-v2`: tabbed builder, unified linking, ordered mixed assembly, folder previews, inline creation.

### Modified Capabilities
- None (assembly additive with legacy fallback).

## Impact

- `src/lib/activity.ts` (assembly resolve), activities PATCH (new fields), archive API (categories).
- Play picker grouping; archive chips; builder rewrite. No new deps.
