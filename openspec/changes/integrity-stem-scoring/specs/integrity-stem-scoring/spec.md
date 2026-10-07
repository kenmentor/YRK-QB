## ADDED Requirements

### Requirement: Focus guard in Test mode
Running Test rounds SHALL watch tab visibility and window blur; hiding SHALL raise an overlay with a 10-second return countdown; expiry SHALL auto-submit; each excursion SHALL increment a violations count stored on the attempt and shown in results. Self test SHALL warn without auto-submit.

#### Scenario: Tab out and return
- **WHEN** a candidate leaves mid-Test and returns in 5s
- **THEN** the round continues with 1 violation logged

#### Scenario: Tab out too long
- **WHEN** a candidate stays away past the countdown
- **THEN** the round auto-submits marked late-excursion

### Requirement: Shared stems
Authors SHALL create `stem` items (passage + optional shared options, never scored) and link items via `stemId` with inherited or own options; play SHALL display items grouped under their stem; option lists of any length SHALL render lettered and wrapped; grading SHALL skip stems.

#### Scenario: 15-option stem
- **WHEN** an item inherits 15 stem options
- **THEN** all render labeled and selectable without layout breakage

#### Scenario: Orphaned item
- **WHEN** a stem is deleted
- **THEN** its items play standalone on own options with a missing-stem note

### Requirement: Smart scoring with override
Every question SHALL carry `marks` (null = auto); auto SHALL equal scorable units (rubric totals, essay 5, parts/correct counts, else 1) +1 when hard; editors SHALL see the suggestion and override per question; attempts SHALL store marks earned/totals; results SHALL show counts and marks.

#### Scenario: Auto marks
- **WHEN** an author files a 3-part EMQ without touching marks
- **THEN** it scores out of 3 automatically

#### Scenario: Override
- **WHEN** an author sets an essay to 10 marks
- **THEN** grading and results honor 10

### Requirement: Reliable correct-answer radios
MCQ SHALL use a true single-select radio by index; multi-select SHALL track an index set; empty or duplicate option text SHALL NOT corrupt selection.

#### Scenario: Empty options
- **WHEN** an author ticks the radio on an empty option then types into it
- **THEN** the tick follows the row, not the text
