## ADDED Requirements

### Requirement: Flexible exam taxonomy
The system SHALL provide a hierarchical taxonomy Exam Body → Exam → Subject → Topic with normalized uniqueness and a curation queue for new nodes.

#### Scenario: Browse hierarchy
- **WHEN** a user browses the bank
- **THEN** they can drill down Body → Exam → Subject → Topic to filtered questions

#### Scenario: Propose new taxonomy node
- **WHEN** a contributor proposes a new Subject or Topic with different casing or whitespace of an existing node
- **THEN** the system suggests the existing node and routes the proposal to a curation queue instead of creating a duplicate

#### Scenario: Curator approves node
- **WHEN** a curator approves a queued taxonomy proposal
- **THEN** the node becomes available for tagging questions

### Requirement: Question model
The system SHALL support question types MCQ (single answer), multi-select, true/false, and fill-in, each with stem (markdown + optional single image), options where applicable, correct answer(s), explanation/rationale, difficulty, and tags.

#### Scenario: Create MCQ with explanation
- **WHEN** an Editor creates an MCQ with 4 options, one correct answer, and an explanation
- **THEN** the system validates exactly one correct answer and requires a non-empty explanation before allowing review submission

#### Scenario: Validate multi-select and true/false
- **WHEN** an Editor creates a multi-select or true/false question
- **THEN** the system validates at least one correct answer (multi-select) or exactly two fixed options (true/false)

### Requirement: Search and browse bank
The system SHALL allow filtering published questions by exam, subject, topic, difficulty, tags, and full-text search on the stem.

#### Scenario: Filtered search
- **WHEN** a learner filters by Exam + Topic + difficulty and searches a keyword
- **THEN** the system returns only published canonical questions matching all filters, excluding drafts and merged-away aliases
