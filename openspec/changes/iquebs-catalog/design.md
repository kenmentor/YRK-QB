## Context

Base: Drive-bank (`/bank` folders/files, `creatorId` + `folderId` on questions), Play (`/play` practice/selftest/exam), Mongo via `src/lib/db.ts` (schemaless, no migrations), `QuestionEditor` + `QuestionView` + runner covering 6 types. Source spec: iQueBS v1.0 Google Form.

## Goals / Non-Goals

**Goals:**
- Full form catalog creatable, viewable, playable, graded.
- Profiles (question + exam set) stored and editable.
- Exam sets playable in all 3 Play modes incl. strict Test tickets.

**Non-Goals:**
- OSCE dual-interface (candidate + examiner screens), anti-cheat, set publishing/sharing, media upload (URL only), plagiarism — deferred.

## Decisions

### 1. One `parts` JSON field carries sub-structure (over per-type collections)
New optional `parts` (JSON string) on questions: Q&A parts `{stem}` for mtf/emq/matching/kfq/meq/compound, criteria `{label, max}` for osce/dops/minicex/msf/viva. `correct[i]` aligns to `parts[i]`; `||` separates accepted alternatives within one part (e.g. `"myocardium||cardiac muscle"`).
Rationale: zero migration, one editor/runner pattern for all compound formats. Alternative — typed sub-collections — rejected as overkill for v1.

### 2. Rubric types self/peer-score in the runner (over examiner-only)
osce/dops/minicex/msf/viva render criteria with 0..max steppers; the runner totals and submits `manual: [{questionId, score}]`; server clamps to criteria total and marks ok at ≥50%. Rationale: makes practical formats playable today; examiner workflows build on the same shape later.

### 3. Difficulty index 1–5 primary, band derived (over replacing the band)
New `difficultyIndex` (1–5, default 3); `difficulty` band derived (≤2 easy, 3 medium, ≥4 hard) and still stored for existing filters/quiz. Rationale: form's index + backwards-compatible browsing.

### 4. Exam sets are owner-scoped ordered lists (over copies)
`examSets {ownerId, title, institution, department, domain, level, term, subject, questionIds(JSON ordered)}` reference live questions (edits flow through). Play `?set=` loads order; Test mode signs a ticket over the set's live ids (server-resolved, never client-chosen).
Rationale: matches "Create Exam Set" profile; no duplication drift; ticket trust preserved.

### 5. MENU maps onto existing sections (over new top-level routes)
Create Question Item → Bank New; Create Question Set → Bank folders; Create Exam Set → `/exam-sets`; Practice/Self test/Test → `/play?mode=`. Home renders the 6 MENU cards.

## Risks / Trade-offs

- [Parts-shape misuse (criteria vs stems mixed)] → Mitigation: per-type validation enforces shape server + client.
- [Manual rubric scores are self-reported] → Mitigation: documented as self/peer assessment; examiner signing deferred.
- [19 types complicate the editor] → Mitigation: grouped style picker (Objective / Written / Matching / Clinical rubric) + per-type sections.
- [Set references deleted/aliased questions] → Mitigation: set play resolves live ids server-side and skips dead ones, reporting count.
