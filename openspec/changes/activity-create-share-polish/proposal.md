## Why

Archive visitors can't start activities — creation lives elsewhere. Bank 3-dot menus are thin (no delete file, publish, assign, or assigned-people view). And shared items scream in emerald, which reads unprofessional next to Drive-like chrome.

## What Changes

- Archive gains **New activity** (logged in): title → builder, where questions/folders are picked or **created on the fly** (inline editor files into your root and links into the activity).
- Bank 3-dot menus grow: folders get Open / Rename / Share / Assigned people / Make public-or-private (+access) / Delete; files get Open / Edit / Assign someone / Move to / Delete (new file-delete endpoint).
- Shared indication goes subtle/professional: amber folders and type icons stay; a small slate **people badge** with "Shared by X" tooltip marks shared items; emerald fills and chips removed.

## Capabilities

### New Capabilities
- `activity-entry`: archive-side creation + builder inline question creation.
- `drive-context-menus`: expanded folder/file menus with delete-file endpoint and assign flows.

### Modified Capabilities
- None (additive; sharing model unchanged).

## Impact

- New `DELETE /api/bank/[id]`; archive + builder UI; grid menus/indicator rework. No new deps.
