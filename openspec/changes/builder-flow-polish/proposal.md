## Why

The question editor is one long scrolling form — it needs a planned, minimal layout that uses space well. Activity creation should feel procedural (Next → Next → Done) without ever locking the user in, and starting an activity should work the same from Archive and Play.

## What Changes

- **Question editor, compact**: format row, stem, answers, guide, collapsible profile (collapsed unless filled), sticky action bar with issue count + save; preview rail unchanged in shape, tighter.
- **Procedural but free builder**: numbered stepper (Content → Presentation → Rules → People) with Back/Next plus always-clickable tabs; last step offers Publish & finish; Publish stays in the hero throughout.
- **Shared creation entry**: one `NewActivityButton` (title, category, sector, visibility) used by Archive and Play, replacing the inline modal and the native prompt.

## Capabilities

### New Capabilities
- `guided-creation`: shared creation entry + builder stepper with free navigation.
- `compact-editor`: space-efficient question editor layout.

### Modified Capabilities
- None.

## Impact

- New `src/components/new-activity-button.tsx`; builder stepper; editor rewrite (same props/data). No new deps.
