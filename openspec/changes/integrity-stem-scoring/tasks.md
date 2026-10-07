## 1. Editor radios (fix first)

- [x] 1.1 Index-based correct selection (mcq radio, multi set) + marks row (suggestion + override) in `QuestionEditor`

## 2. Focus guard

- [x] 2.1 Runner overlay + countdown + violations in `play/page.tsx` (exam strict, selftest warn)
- [x] 2.2 `violations` through `quiz/attempts` into filter JSON + results display

## 3. Stem system

- [x] 3.1 `stem` type + `stemId`/`inheritOptions` in validation; grading skips stems
- [x] 3.2 Editor: stem authoring + item linking UI; viewer/runner grouped display; 15-option-safe option lists
- [x] 3.3 APIs carry the fields (drive/drafts/merges/proposals/export/import with ID remap)

## 4. Smart scoring

- [x] 4.1 `suggestMarks` in lifecycle; `marks` validated/stored; attempts + breakdown carry max/earned; results show both

## 5. Verification

- [x] 5.1 Contracts + `tsc` + `npm test` green + production build

## 6. Submissions drill-down + exam controls (follow-up)

- [x] 6.1 tookSecs capture + attempt storage
- [x] 6.2 Submissions detail page (present/absent/time/answers)
- [x] 6.3 Bank tab slimmed to group cards
- [x] 6.4 Examiner controls (kind/schedule/clock/caps/shuffle/score/release)
- [x] 6.5 Attempt caps + window + hidden-score enforcement + history masking
