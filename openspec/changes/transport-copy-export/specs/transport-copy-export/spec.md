## ADDED Requirements

### Requirement: Copy folders in place
Owners/editors SHALL deep-copy a folder (subfolders + files, top suffixed " (copy)") into the same or an accessible parent.

#### Scenario: Copy
- **WHEN** a user makes a copy of "Physics" in its parent
- **THEN** "Physics (copy)" appears with the same structure and independent files

### Requirement: Real-folder download
Any readable folder SHALL download as `.zip` (folder.json + question files + subfolders); any file SHALL download as single `.json` in the documented schema.

#### Scenario: Download round-trip
- **WHEN** a user downloads a folder and re-imports the zip untouched
- **THEN** an identical copy imports with zero errors

### Requirement: Validated JSON import with preview
Import SHALL accept `.zip`/`.json`/hand-written JSON, preview counts + per-file errors, and create only fully-valid bundles; topic paths SHALL resolve by name or file as general.

#### Scenario: Bad file rejected
- **WHEN** a zip holds an invalid question
- **THEN** preview names the fault and blocks confirm until removed or fixed
