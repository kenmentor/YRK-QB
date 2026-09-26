## ADDED Requirements

### Requirement: Create activities from the archive
Logged-in archive visitors SHALL start an activity (title → builder); the builder SHALL let them pick bank/archive folders and questions or create questions on the fly (filed to their root and linked).

#### Scenario: Archive to builder
- **WHEN** a logged-in user clicks New activity and names it
- **THEN** the builder opens ready for assembly

#### Scenario: On-the-fly question
- **WHEN** a builder creates a question inline
- **THEN** it files to their root and links into the activity

### Requirement: Rich bank context menus
Folder menus SHALL offer Open, Rename, Share, Assigned people, Make public/private (+access), Delete; file menus SHALL offer Open, Edit, Assign someone, Move to, Delete; deletes SHALL confirm and toast; publish toggles SHALL reflect state.

#### Scenario: Folder menu
- **WHEN** an owner opens a folder's ⋮
- **THEN** all six actions appear with correct gating (delete owner-only etc.)

#### Scenario: File delete
- **WHEN** an authorized user deletes a file
- **THEN** it vanishes from the bank while attempt history stays intact

### Requirement: Professional shared indication
Shared items SHALL keep standard icons with a small slate people badge ("Shared by X" tooltip); no green fills or chips; sidebar and tab accents SHALL stay in the app palette.

#### Scenario: Shared recognition
- **WHEN** an invitee browses their drive
- **THEN** shared items are recognizable via badge + tooltip without color wash
