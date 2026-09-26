## Why

Banks are stuck in the app: users want to copy folders in place, download a folder as a real on-disk folder, and import folders/questions back from a documented JSON format — so any correct JSON can be downloaded, imported, or hand-carried between banks.

## What Changes

- **Copy**: folder ⋮ → Make a copy (deep: subfolders + files, top named "X (copy)").
- **Download**: folder ⋮ → .zip mirroring real structure (`folder.json` + `q-NN.json` + subfolders); file ⋮ → single `.json`.
- **Import**: ribbon/folder Import opens a modal: pick `.zip`/`.json` (or hand-written JSON), preview counts + errors, confirm posts a validated bundle; sample JSON downloadable.
- **Format** (`yrk-folder/1`, `yrk-question/1`): versioned, validated server-side with the catalog schema; topic paths resolve by name or file as general.

## Capabilities

### New Capabilities
- `bank-transport`: copy, zip export, JSON import with preview + sample.

### Modified Capabilities
- None.

## Impact

- New APIs: export (bundle JSON), import (validated create), folder copy; client zips via jszip (new dep); grid menus + ribbon + import modal. No other flows change.
