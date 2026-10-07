## Context

Play has practice/selftest/exam; attempts store count score/total; questions store options/correct/parts; editor tracks correct by option text.

## Goals / Non-Goals

**Goals:** cheat deterrence for Test mode, reusable stems, marks with automation, reliable radios.

**Non-Goals:** webcam/proctoring, plagiarism detection, partial credit, negative marking — deferred.

## Decisions

### 1. Focus guard is client-observed, server-recorded (over hard lockout)
`visibilitychange` + `blur` during Test running → overlay with 10s return countdown; expiry auto-submits (`auto`); `violations` count posts with answers and persists in the attempt filter JSON; shown in results.
Rationale: real lockout needs native apps; deterrence + audit trail fits the web.

### 2. Stems are questions with `type: "stem"` (over a new collection)
`stem` docs hold passage + optional shared `options`; items set `stemId` + `inheritOptions`; stems never enter grading (filtered from rows/totals, still resolvable for display). Runner groups items under their stem; inherited options render from the stem.
Rationale: zero new collections; bank/drive/play reuse everything; import remaps ids in two passes.

### 3. Marks default by scorable unit, override always (over fixed 1-mark)
`suggestMarks`: rubric → criteria total; essay → 5; part-based (mtf/emq/matching/kfq/meq/compound/multi-select) → unit count; else 1; +1 when difficultyIndex ≥ 4; min 1. Stored `marks` null = auto. Attempts keep count score AND add marks sums; results show both.
Rationale: explainable automation; irregular cases stay hand-settable.

### 4. Correct-by-index in the editor (over correct-by-text)
MCQ keeps a single selected index (true radio), multi keeps an index set; values derive on submit; edits/adds/removes never corrupt selection.
Rationale: fixes empty-option clearing and duplicate-text ambiguity at the root.

## Risks / Trade-offs

- [Focus false positives (OS dialogs, devtools)] → Mitigation: 10s grace + visible countdown; selftest warns only.
- [Stem deleted, items orphaned] → Mitigation: items fall back to own options; viewer notes a missing stem.
- [Marks change historic meaning] → Mitigation: counts preserved; marks additive in attempts/results/history display only.
