## ADDED Requirements

### Requirement: Entry routing without a landing page
`/` SHALL redirect logged-in users to `/bank` and visitors to `/archive`; header SHALL offer Bank, Play, Archive.

#### Scenario: Visitor entry
- **WHEN** a logged-out visitor opens `/`
- **THEN** they land on the public archive

#### Scenario: Member entry
- **WHEN** a logged-in user opens `/`
- **THEN** they land in their personal root

### Requirement: Public archive
The archive SHALL list public activities (banner, title, contributors, details, modes, counts) and public folders, browsable without login; each public folder SHALL show owner, access level, and live contents.

#### Scenario: Browse logged-out
- **WHEN** a visitor opens `/archive`
- **THEN** they see all public artifacts and folders with banners and contributors

### Requirement: Artifact detail with rules gate
Each artifact page SHALL show banner, title, contributors, details, and mode-specific owner rules; starting SHALL require reading + accepting the rules, and login to record the round.

#### Scenario: Rules accept to play
- **WHEN** a user opens an artifact, picks Test, accepts the test rules
- **THEN** the strict round starts with the activity's order

### Requirement: Activities assembly and shares
Owners (and activity editors) SHALL build activities from bank questions, own/shared folders, and public-`use` folders; SHALL set visibility, modes, banner, details, rules; SHALL invite viewers/editors; private activities SHALL be visible only to owner + shares.

#### Scenario: Build from public folders
- **WHEN** an owner adds a public-`use` folder to an activity
- **THEN** its live questions play as part of the activity

#### Scenario: Added member plays
- **WHEN** a user is added to a private activity
- **THEN** it appears in their Play section and plays in allowed modes

### Requirement: Play section activities
Play SHALL list my, shared-with-me, and public activities above the quick-round config, each deep-linking with mode preselected.

#### Scenario: Play listing
- **WHEN** a user opens Play
- **THEN** they see every activity available to them plus quick rounds
