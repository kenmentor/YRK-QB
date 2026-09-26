## ADDED Requirements

### Requirement: Compact question editor
The editor SHALL present format, stem, answers, guide, and a collapsed-by-default profile; SHALL keep a sticky action bar with issue count and save; SHALL preserve all types, validation, and preview behavior.

#### Scenario: Quick compose
- **WHEN** a user opens the editor
- **THEN** stem + answers fit without scrolling past metadata

### Requirement: Guided free creation
Creation SHALL start from one shared entry; the builder SHALL show numbered steps with Back/Next and free jumps; finishing SHALL publish and land on the artifact; Publish SHALL remain available throughout.

#### Scenario: Skipped steps
- **WHEN** a user jumps Content → People → Publish
- **THEN** publishing succeeds without visiting middle steps
