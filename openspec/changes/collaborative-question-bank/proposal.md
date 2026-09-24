## Why

Learners preparing for high-school, college, professional, and non-professional exams lack a shared, high-quality question bank they can both contribute to and learn from. Existing quiz apps are single-author or read-only; collaboration is ad-hoc (spreadsheets, chats) with no review or merge flow, so quality is inconsistent and duplication is rampant.

## What Changes

- Introduce team **Workspaces** where 3-4 collaborators co-build questions: co-edit a single hard question together and co-build a set (each member drafts, others comment/edit).
- Add **Roles**: Owner (invite, merge, publish), Editor (add/edit questions), Reviewer (comment, request changes, approve; no direct edit in v1).
- Add **Review + Merge flow**: Draft → In Review → Approved/Rejected → Merged/Published, supporting all three merge meanings: approve draft to live, combine duplicates into one canonical version, publish a set to the bank.
- Introduce flexible **Exam taxonomy** (Exam Body → Exam → Subject → Topic → Question) with curation to prevent duplicates like "Physics" vs "physics".
- Introduce **Question Bank** browsing/search by exam, subject, topic.
- Introduce **Quiz engine** with Practice mode (untimed, instant answer + explanation) and Exam mode (timed, score at end + history). Both contribute and learn sides ship in v1.
- Out of scope for v1: real-time cursors/presence, reputation/points, rich media beyond images, offline mode, plagiarism detection.

## Capabilities

### New Capabilities
- `workspace-collaboration`: team workspaces, invites, Owner/Editor/Reviewer roles, async co-edit + comments on single questions and sets.
- `question-lifecycle`: draft, review, approve/reject, merge (approve-to-live, deduplicate, set-publish), version history, publish to bank.
- `question-bank`: flexible exam taxonomy, question model (MCQ, multi-select, true/false, fill-in with explanation, difficulty, tags), search/browse, curation.
- `quiz-engine`: practice mode, timed exam mode, scoring, attempt history, weak-area basics.

### Modified Capabilities
- None (greenfield; `openspec/specs/` is empty).

## Impact

Greenfield system. No existing code, APIs, or dependencies to migrate. Establishes data model (Workspace, Membership, Question, QuestionVersion, Review, MergeRecord, Exam taxonomy, QuizAttempt), auth/permissions foundation for roles, and UX patterns for contribute and learn loops. Future work (real-time collab, reputation, analytics) will build on these contracts.
