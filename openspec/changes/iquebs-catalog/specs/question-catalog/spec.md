## ADDED Requirements

### Requirement: Catalog formats are creatable and validatable
The system SHALL support the form's types — mcq, multi_select, true_false, matching (drag-and-drop), fill_in, saq, short_answer, essay (Descriptive/LEQ), compound, emq, kfq, meq, mtf, sct, osce, dops, minicex, msf, viva — each with validation: mtf needs ≥2 statements each True/False; emq/matching need ≥1 part + ≥2 shared options with one match per part; kfq/meq/compound need ≥1 part each with an expected answer; sct needs exactly the 5-point scale with one expert choice; rubric types need ≥1 criterion with max > 0; explanation/guide required throughout.

#### Scenario: Create each format
- **WHEN** a user files a question of any catalog type with valid payload
- **THEN** the system stores it with aligned parts/correct and accepts it for review/play

#### Scenario: Reject malformed compound formats
- **WHEN** payload parts and correct arrays misalign (e.g. emq part without a match)
- **THEN** the system rejects with 400 naming the fault

### Requirement: Catalog formats render, play, and grade
Every catalog type SHALL render in the viewer, run in all Play modes with an appropriate input (toggles for mtf, dropdowns + drag-and-drop for matching/emq, per-part inputs for kfq/meq/compound/saq, Likert for sct, steppers for rubrics, stepwise reveal for meq), and grade server-side with per-part breakdown rows.

#### Scenario: Play a matching question by dragging
- **WHEN** a candidate drags choices onto prompts and submits
- **THEN** each prompt grades against its match and the breakdown shows per-prompt results

#### Scenario: Self-score a rubric
- **WHEN** a candidate sets criteria scores and submits
- **THEN** the server clamps to criteria maxima, totals, and marks ok at ≥50%

### Requirement: Question profiles
Every question file SHALL carry category (primary/secondary/tertiary/professional/other), sector (free text), difficulty index 1–5, media URL (optional), and tags; the band (easy/medium/hard) SHALL derive from the index.

#### Scenario: Profile round-trip
- **WHEN** a user sets category, sector, index, media, tags and saves
- **THEN** the viewer shows them and the bank can filter by them

### Requirement: Exam sets
Users SHALL create exam sets with the form's profile (title, institution, department, domain, level, term, subject), assemble ordered questions from the bank, reorder/remove them, and play the set in Practice, Self test, and strict Test (server ticket over live ids, dead ids skipped + reported).

#### Scenario: Build and play a set
- **WHEN** a user profiles a set, adds 5 questions, reorders, and starts it as a Test
- **THEN** the strict run follows set order and grades against live questions

### Requirement: MENU home
The landing page SHALL present the form's MENU — Create Question Item, Create Question Set, Create Exam Set, Practice, Self test, Test — each routing to its section with mode preselected for the three play entries.

#### Scenario: MENU navigation
- **WHEN** a user picks "Self test"
- **THEN** Play opens with self-test mode preselected
