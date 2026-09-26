## 1. Backend

- [x] 1.1 Extend `questionSchema` (19 types, parts/criteria shapes, profile fields, difficultyIndex) in `src/lib/validation.ts`
- [x] 1.2 Extend `gradeAnswer` + add rubric helpers (`isRubricType`, `rubricTotal`, `parseParts`) in `src/lib/lifecycle.ts`
- [x] 1.3 `POST /api/quiz/attempts`: per-part breakdown + `manual` rubric scores (clamped, ok at ≥50%)
- [x] 1.4 Add `examSet` model to `src/lib/db.ts`; `GET/POST /api/exam-sets`; `GET/PATCH/DELETE /api/exam-sets/[id]` (owner-only)
- [x] 1.5 `POST /api/quiz/start`: accept `setId` (owner's set → live ordered ids ticket)

## 2. Frontend — authoring + viewing

- [x] 2.1 `QuestionEditor`: grouped style picker (Objective/Written/Matching/Rubric), per-type sections (parts, criteria, Likert, alternatives with `||`), profile fields (category, sector, 1–5, media, tags)
- [x] 2.2 `QuestionView`: render all catalog types + profile chips + media link
- [x] 2.3 Drive create/edit calls carry parts/profile fields (`/api/drive/questions`, `PATCH /api/bank/[id]`)

## 3. Frontend — play

- [x] 3.1 Runner inputs per type (mtf toggles, emq selects, matching drag-and-drop + fallback, per-part inputs, meq stepwise reveal, sct Likert, rubric steppers) + `?mode=`/`?set=` loading
- [x] 3.2 Results render per-part breakdown rows
- [x] 3.3 History already generic — verify new modes display

## 4. Exam sets + MENU

- [x] 4.1 `/exam-sets` list + `/exam-sets/[id]` builder (profile form, bank picker, reorder)
- [x] 4.2 Home MENU (6 cards) + header stays Bank/Play
- [x] 4.3 Tests: extend contracts for catalog validation/grading + exam-set routes; `npm test` green, `tsc` clean on touched files
