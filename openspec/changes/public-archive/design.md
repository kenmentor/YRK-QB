## Context

Drive-bank with folder shares; Play with practice/selftest/exam + tickets; notifications; Mongo schemaless. This change adds the public layer + activities on top.

## Goals / Non-Goals

**Goals:** logged-out archive, publishable artifacts with rules-gated play, public folders with use/view levels, activity shares, builder.

**Non-Goals:** SEO/sitemaps, activity comments/ratings, scheduled publishes, link sharing — deferred.

## Decisions

### 1. Activities are presentation over live references (over copies)
`activities {ownerId, title, banner, details, rulesPractice, rulesTest, modes[], visibility, questionIds[], folderIds[]}`. Play resolves live questions at start (dead skipped + reported). Contributors = owner + distinct content authors.
Rationale: edits flow through; consistent with exam sets; no drift.

### 2. Public folders carry a use level (over binary public)
`isPublic + publicAccess: view|use`. View = read-only browsing; use = playable + addable to activities. Only `use` folders resolve into activity play.
Rationale: matches "depending on the access level you can put this folder together into an activity".

### 3. Rules live on the activity, per mode family (over global terms)
`rulesPractice` (practice/selftest) + `rulesTest` (test), owner-editable with sane defaults. Detail page gates Accept before `/play?activity=&mode=`.
Rationale: "greeted with the rules the user made… depends on practice or test".

### 4. Public contents read path (over separate browser API)
`contents` allows unauthenticated read of `isPublic` folders (viewer, public subfolders only). Archive lists via `/api/archive`.
Rationale: one code path; logged-out archive browsable.

### 5. Activity shares mirror folder shares (over open editing)
`activityShares {activityId, ownerId, userId, role: viewer|editor}`. Viewer plays; editor co-builds; owner admins. Private activities visible to owner + shares; public to all logged-in players.
Rationale: "an activity you were added to".

## Risks / Trade-offs

- [Public folder leaks drafts] → Mitigation: only live bank questions resolve; drafts never leave workspaces.
- [Owner unpublishes mid-play] → Mitigation: tickets freeze live ids at start; late publishes don't affect running rounds.
- [Contributor spam in shared folders surfacing publicly] → Mitigation: owner moderates (move/remove); public shows live content only.
