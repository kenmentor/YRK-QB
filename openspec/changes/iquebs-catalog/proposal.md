## Why

The iQueBS v1.0 Google Form drafts the real product: a MENU (Create Question Item, Create Question Set, Create Exam Set, Practice, Self test, Test), a 16-format question catalog (MCQ, MTF, EMQ, KFQ, SAQ, MEQ, LEQ, matching, SCT, OSCE/OSPE, DOPS, mini-CEX, MSF, viva, true/false, fill-in, compound), question profiles (category/sector/subject/topic/tags, difficulty 1–5, media), exam-set profiles (institution, department, domain, level, term, title, subjects), and play modes. The current base only has 6 formats, no profiles, and no exam sets — this change builds the form out on the Drive-bank base.

## What Changes

- **Question catalog** grows to the form's formats: adds `matching` (drag-and-drop), `saq`, `meq`, `compound`, `emq`, `kfq`, `mtf`, `sct`, plus rubric/examiner-scored `osce`, `dops`, `minicex`, `msf`, `viva`. Keeps legacy `mcq`, `multi_select`, `true_false`, `fill_in`, `essay` (Descriptive/LEQ), `short_answer`.
- **Question profile** on every file: category, sector, subject/topic (existing), tags, difficulty index 1–5 (existing easy/medium/hard derived), media URL.
- **Exam sets**: owner-scoped sets with form profile (institution, department, domain, level, term, title, subject) + ordered questions; playable from Play via `?set=`.
- **Play** gains `?mode=` preselect and set-based Test tickets; rubric types self/peer-score via checklist in the runner.
- **Home** becomes the form's MENU (6 entries) mapping onto Bank / Exam Sets / Play.

## Capabilities

### New Capabilities
- `question-catalog`: 19-format type system, per-type validation, grading, and runner/viewer/editor rendering contracts.
- `question-profile`: category, sector, difficulty 1–5, media URL, tags on question files.
- `exam-sets`: set profiles, ordered question assembly, set-based play.

### Modified Capabilities
- None (additive; existing 6 types and flows unchanged).

## Impact

- `src/lib/validation.ts` (enum + per-type rules), `src/lib/lifecycle.ts` (`gradeAnswer` + rubric helpers), `POST /api/quiz/attempts` (manual rubric scores), `POST /api/quiz/start` (`setId` tickets).
- New `examSets` collection + `GET/POST /api/exam-sets`, `GET/PATCH/DELETE /api/exam-sets/[id]`.
- `QuestionEditor`, `QuestionView`, Play runner/results extended per type; new `/exam-sets` pages; home MENU rewrite. No new deps.
