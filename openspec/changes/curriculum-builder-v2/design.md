## Context

Activities resolve explicit questionIds then folderIds; builder has separate pickers; archive/Play list flatly.

## Goals / Non-Goals

**Goals:** categorized curriculum Play, categorized free Archive, single link flow, tabbed minimal builder.

**Non-Goals:** drag-reorder (up/down stays), scheduled publishing, ratings — deferred.

## Decisions

### 1. Ordered mixed `assembly` with legacy fallback (over two ordered lists)
`assembly: [{kind, id}]` preserves exact interleaving; resolve walks it in order; PATCH derives legacy `questionIds`/`folderIds` so old readers keep working.
Rationale: "whatever you link is extracted" in the order shown.

### 2. Categories reuse the question taxonomy (over a new one)
`category ∈ primary/secondary/tertiary/professional/other` + free `sector`/`subject` on activities; Play orders groups along that ladder; archive filters by chips.
Rationale: one vocabulary across bank, profiles, and curriculum.

### 3. Folder category derived by majority vote (over manual tagging)
Archive computes each public folder's dominant question category/sector (≤200 scan).
Rationale: folders stay tag-free; archive still shows category.

### 4. Tabbed builder with autosave profile (over long page)
Content (unified add + assembly + previews), Presentation, Rules, People. Assembly saves explicitly; profile/rules autosave on blur.
Rationale: tool-like, minimal, no clutter; matches exam-set builder patterns.

## Risks / Trade-offs

- [Mixed order vs legacy readers] → Mitigation: legacy fields derived in link order on every save.
- [Folder preview fan-out] → Mitigation: lazy expand, cached, contents API already scoped.
