## Context

Builder has separate search pickers + autosaving profile/rules; contents API already serves own/shared/public reads.

## Goals / Non-Goals

**Goals:** checkbox explorer with 3 tabs; staged builder with single Publish.

**Non-Goals:** version history of drafts, scheduled publish — deferred.

## Decisions

### 1. Explorer reuses contents API per tab (over new browser API)
Mine = own contents; Shared = shares/mine roots + contents by folder; Public = archive use-folders + public contents path. Checkboxes append `{kind,id}` refs.
Rationale: zero new endpoints; permissions already enforced.

### 2. Publish is one full PATCH (over draft/live field split)
Builder state is the draft; Publish sends title/banner/details/category/sector/subject/modes/rules/visibility/assembly together (visibility omitted for non-owners). Nothing persists before that.
Rationale: simplest true "only Publish goes live"; server already accepts the bundle.

## Risks / Trade-offs

- [Lost work on accidental close while dirty] → Mitigation: persistent "Unpublished changes" badge + confirm on tab-away (beforeunload while dirty).
- [Public folder linked then unpublished] → Mitigation: resolve skips dead/unusable at play with counts.
