## ADDED Requirements

### Requirement: Draft lifecycle states
The system SHALL manage question drafts through states draft, in_review, approved, changes_requested, and merged/published with visible transitions and history.

#### Scenario: Submit for review
- **WHEN** an Owner or Editor submits a draft for review
- **THEN** the draft status becomes in_review and its current version is frozen as the review snapshot

#### Scenario: Approve or request changes
- **WHEN** a Reviewer approves a draft
- **THEN** its status becomes approved and it becomes eligible for merge
- **WHEN** a Reviewer requests changes with a comment
- **THEN** its status becomes changes_requested and returns to editable draft on next save

#### Scenario: Version history preserved
- **WHEN** any edit is saved
- **THEN** the system appends a new version with author, timestamp, and optional change note, never overwriting prior versions

### Requirement: Merge approve-to-live
The system SHALL allow Owners to merge approved drafts into published canonical questions.

#### Scenario: Merge approved draft
- **WHEN** an Owner merges an approved draft
- **THEN** the system creates or updates a canonical published Question, marks the draft merged, and records a merge record with actor and timestamp

### Requirement: Merge duplicates into canonical
The system SHALL allow Owners to propose merging two or more published or draft questions as duplicates into one canonical question, requiring Reviewer approval, preserving the loser as an alias.

#### Scenario: Deduplicate questions
- **WHEN** an Owner proposes Q-B as duplicate of Q-A and a Reviewer approves
- **THEN** Q-A remains canonical, Q-B gets merged_into pointing to Q-A, and prior quiz attempts referencing Q-B remain valid

#### Scenario: Duplicate warning on publish
- **WHEN** an Owner attempts to publish a draft whose normalized stem matches an existing published question
- **THEN** the system shows a possible-duplicate warning with links but still allows proceeding to merge-review flow

### Requirement: Merge set publish
The system SHALL allow Owners to publish an entire workspace set of approved drafts to the bank in one action.

#### Scenario: Publish set
- **WHEN** an Owner publishes a set containing approved drafts
- **THEN** each approved draft becomes a published Question linked to the set, unapproved drafts are skipped and reported, and a set-level merge record is created
