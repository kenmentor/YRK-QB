## Context

Greenfield system. No existing code, auth, or data model. Stakeholders are contributors (small teams of 3-4 building questions), reviewers (approve quality), and learners (prep for any exam: high-school, college, professional, non-professional). Explore phase established: workspaces support both single-question co-edit and set co-build; merge covers approve-to-live, deduplicate, and set-publish; both contribute and learn loops are v1.

Constraints for v1: small team, fast to value, minimal ops. Async collaboration preferred over real-time. Relational integrity matters (workspaces, memberships, versions, reviews, taxonomy).

## Goals / Non-Goals

**Goals:**
- Ship thin-but-complete contribute loop: workspace → draft → review → merge → published.
- Ship thin-but-complete learn loop: browse bank → practice quiz + timed mock → history.
- Establish clean domain model (Workspace, Question, Version, Review, Taxonomy, Attempt) that future real-time, reputation, and analytics can extend.
- Enforce quality via roles and review without creating bottlenecks.

**Non-Goals:**
- Real-time co-editing (cursors, presence, CRDT/OT) — async edit + comments only in v1.
- Reputation, points, leaderboards.
- Rich media beyond single image per question, rich text beyond markdown.
- Offline mode, plagiarism/AI-detection, auto-grading of free text.
- Multi-language UI, accessibility beyond basics.

## Decisions

### 1. Workspace as the collaboration container (over per-question sharing)
A Workspace has members, one topic/focus (e.g. "WAEC Physics 2024 set"), and contains many QuestionDrafts. A single QuestionDraft can also have multiple co-editors. This unifies both modes the user asked for (single-question + set) under one permission and review surface.
Alternative considered: share each question individually (like Google Doc per question) — rejected because invite/review overhead explodes for 50-question sets.

### 2. Async edit + comments, last-write-wins with version history (over CRDT)
V1 uses simple optimistic locking: each save creates a QuestionVersion with author, timestamp, diff note. Concurrent saves create branches; reviewer picks canonical on merge. No live cursors.
Rationale: 3-4 person teams tolerate async; CRDT adds major complexity for little v1 value. Version history gives safety net and audit trail.
Alternative: real-time Yjs/CRDT — deferred to v2 if teams demand it.

### 3. Three fixed roles: Owner / Editor / Reviewer
- Owner: manage members, request review, merge, publish.
- Editor: create/edit drafts, comment.
- Reviewer: comment, approve/request-changes; cannot edit in v1 (forces clear authorship, avoids silent overwrites).
Permission checks enforced server-side per workspace + per action. A user can have different roles in different workspaces.
Alternative: fully custom RBAC — rejected as overkill for v1.

### 4. Explicit question state machine
`draft → in_review → approved | changes_requested → (back to draft) → merged/published`. Plus `flagged_duplicate` for dedup flow: Owner proposes merge of Q-A + Q-B → Reviewer approves → one canonical Question survives, other becomes alias with `merged_into` pointer (never hard-deleted, preserves attempts/history).
Rationale: makes review bottleneck visible, preserves history, handles all three merge meanings with one mechanism.

### 5. MongoDB document model with hierarchical taxonomy + free tags
Collections: users (with bcrypt password + global role learner/professor/admin), workspaces, memberships (user, workspace, role owner/editor/reviewer), examBodies, exams, subjects, topics, questions (canonical, published), questionDrafts + questionVersions, reviews, mergeRecords, quizAttempts + attemptAnswers.
Runtime uses mongodb driver directly (Prisma CLI hangs in this env). FKs stored as strings, app-level joins. Taxonomy hierarchical (Body → Exam → Subject → Topic) + tags. Curation queue prevents sprawl.

### 6. Quiz engine is read-only over published questions
Practice mode fetches filtered published questions, reveals answer/explanation immediately. Exam mode snapshots question IDs + time limit at start, grades at submit, stores Attempt with per-question correctness. No mutation of bank during quiz. Weak-area basics = aggregate correctness by topic from attempts.
Rationale: decouples learn loop from contribute loop; allows safe timed mocks even while drafts evolve.

### 7. Web-first with shadcn/ui frontend
Frontend SHALL use shadcn/ui (React + Tailwind + Radix primitives) for all UI: workspace dashboards, draft editors, review queues, bank browse/search, quiz practice + exam mode, history views. Backend is REST API + MongoDB + JWT-cookie auth (bcrypt). No other new external dependencies beyond image storage.
Rationale: shadcn gives accessible, themeable components out of the box and keeps UI consistent across contribute + learn loops without locking into a paid component library.

## Risks / Trade-offs

- [Reviewer bottleneck → stall] → Mitigation: Owner can reassign reviewer, nudge reminders; allow self-merge after N days with warning flag (policy decision, default off in v1 but schema supports it).
- [Duplicate explosion across workspaces] → Mitigation: on publish, fuzzy-match on normalized stem (exact + trigram) surfaces "possible duplicate" warning; hard merge requires reviewer approval; alias pointer preserves links.
- [Taxonomy sprawl ("Physics" vs "physics")] → Mitigation: normalized unique index + curation queue; contributors suggest, Owner/curator approves.
- [Edit conflicts in async model] → Mitigation: version history + branch-on-conflict; reviewer resolves; UI shows diff.
- [Scope creep from "any exam"] → Mitigation: taxonomy is generic but v1 seeds only 2-3 exam bodies for dogfooding; general creation gated behind curation.
- [Quiz fidelity vs simplicity] → Mitigation: v1 timer + scoring only; no sectional timing, negative marking configurability deferred (schema has fields, UI hides).
