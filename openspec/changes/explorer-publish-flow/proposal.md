## Why

Linking is one-item-at-a-time search; builders want an explorer to check-select files and folders, including a Public tab for usable public folders. And builder edits autosave straight to live — there should be one Publish action that is the only moment changes go live.

## What Changes

- New **content explorer** modal in the builder: My bank / Shared / Public tabs, breadcrumb navigation, checkboxes on files and folders, selected tray, Add-selected appends mixed refs in order.
- Builder holds all edits locally (profile, rules, assembly); header **Publish** sends one PATCH — the sole go-live; unpublished badge while dirty; people invites stay immediate.

## Capabilities

### New Capabilities
- `content-explorer`: tabbed checkbox explorer (own/shared/public-use) for linking.
- `builder-publish`: staged edits with single Publish go-live.

### Modified Capabilities
- None.

## Impact

- New `src/components/content-explorer.tsx`; builder rewrite of save flow (APIs unchanged — one PATCH already supports all fields).
