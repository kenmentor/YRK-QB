## Why

Tests can be cheated by tabbing out; long-form exams need shared stems (one passage/option list feeding many items, itself unscored); scoring is all-or-nothing with no marks model; and the editor's correct-answer radios misbehave on empty/duplicate options.

## What Changes

- **Focus guard**: Test mode watches visibility/blur — overlay warning with return countdown, auto-submit on expiry, violations recorded on the attempt.
- **Stem system**: new `stem` format (stimulus, optional shared options, never scored); items link via `stemId` and either inherit the stem's options or keep their own; option lists render cleanly at any count (lettered, wrapping grid).
- **Smart scoring**: per-question `marks` with explainable auto-defaults (per scorable unit, essay weight, hard bonus), editable override; attempts store marks earned/totals alongside counts; results show both.
- **Radio fix**: correct-answer selection becomes index-based (single radio for MCQ, index set for multi) — immune to empty/duplicate option text.

## Capabilities

### New Capabilities
- `focus-guard`: tab-out detection, return countdown, auto-submit, violation log.
- `stem-questions`: stem format, item links, option inheritance, unscored display.
- `smart-scoring`: marks model with auto defaults + override, marks-weighted results.

### Modified Capabilities
- None (additive; existing grading counts preserved).

## Impact

- Runner overlay + `violations` on attempts; `stemId`/`inheritOptions` + `marks` fields (schemaless, validated); editor radio/index rework + marks row; export/import carry stems with ID remap; merge keeps payload fields.
