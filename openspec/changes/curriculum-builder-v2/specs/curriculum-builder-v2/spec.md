## ADDED Requirements

### Requirement: Curriculum grouping
Activities SHALL carry category/sector/subject; Play SHALL group activities along the ladder primary → secondary → tertiary → professional → other; archive SHALL filter by category chips and show each item's category.

#### Scenario: Curriculum Play
- **WHEN** a user opens Play
- **THEN** activities appear under curriculum group headers in ladder order

#### Scenario: Archive filter
- **WHEN** a user picks the Tertiary chip
- **THEN** only tertiary activities and folders show

### Requirement: Unified linking with ordered extraction
Builders SHALL link questions and folders from one Add flow; assembly SHALL be a single ordered mixed list; play SHALL extract in that exact order; folder rows SHALL preview contained questions.

#### Scenario: Mixed assembly
- **WHEN** a builder links Q1, folder F, Q2 and saves
- **THEN** play runs Q1, F's live questions, Q2 in that order

### Requirement: Tabbed minimal builder
The builder SHALL use Content / Presentation / Rules / People tabs with autosaving profile and explicit assembly save, fitting without clutter on desktop and mobile.

#### Scenario: Focused building
- **WHEN** a builder works on content
- **THEN** profile, rules, and people stay one tab away, not on screen
