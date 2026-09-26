## ADDED Requirements

### Requirement: Checkbox content explorer
The builder's link flow SHALL open an explorer with My bank, Shared, and Public tabs; SHALL navigate folders with breadcrumbs; SHALL checkbox files and folders (multi-select) with a selected tray; SHALL append selections as ordered mixed refs.

#### Scenario: Multi-select link
- **WHEN** a builder checks 3 questions and 1 folder in the explorer and adds them
- **THEN** all four append to the assembly in checked order

#### Scenario: Public tab
- **WHEN** a builder opens the Public tab
- **THEN** usable public folders appear and link as folder refs

### Requirement: Single Publish go-live
Builder profile, rules, and assembly edits SHALL stay local until Publish; Publish SHALL send one update; a badge SHALL mark unpublished changes; leaving with unsaved work SHALL confirm.

#### Scenario: Staged edit
- **WHEN** a builder retitles and reorders then closes without publishing
- **THEN** archive and Play still show the previous live version
