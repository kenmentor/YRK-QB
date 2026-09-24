## 1. Foundation

- [x] 1.1 Scaffold web app + relational DB schema (users, workspaces, memberships, taxonomy, questions, drafts, versions, reviews, merges, attempts)
- [x] 1.2 Add auth (email/OAuth) with server-side permission helpers for Owner/Editor/Reviewer per workspace
- [x] 1.3 Seed 2-3 exam bodies with sample hierarchy for dogfooding

## 2. Workspace Collaboration

- [x] 2.1 Implement workspace CRUD + invite link/code with role assignment
- [x] 2.2 Implement draft list in workspace with author + status badges
- [x] 2.3 Implement async draft edit with version append + conflict branch flag + diff view
- [x] 2.4 Implement comments on drafts/versions with notifications
- [x] 2.5 Enforce Reviewer cannot-edit rule server-side with UI prompt to comment

## 3. Question Lifecycle (Review + Merge)

- [x] 3.1 Implement state machine draft → in_review → approved | changes_requested → merged/published with frozen review snapshot
- [x] 3.2 Implement review request, approve, request-changes with comments + reassignment
- [x] 3.3 Implement merge approve-to-live (draft → canonical Question + merge record)
- [x] 3.4 Implement duplicate detection warning (normalized stem match) + merge duplicates with merged_into alias, reviewer approval required
- [x] 3.5 Implement set publish (bulk merge approved drafts, skip + report unapproved)

## 4. Question Bank + Taxonomy

- [x] 4.1 Implement question model validation (MCQ single-answer, multi-select, true/false, fill-in + required explanation, difficulty, tags, optional image)
- [x] 4.2 Implement taxonomy curation queue (normalize case/whitespace, suggest existing, approve flow)
- [x] 4.3 Implement bank browse Body → Exam → Subject → Topic + filter by difficulty/tags + full-text stem search (published canonical only)

## 5. Quiz Engine

- [x] 5.1 Implement practice mode (filter → quiz, instant correctness + explanation)
- [x] 5.2 Implement timed exam mode (snapshot set, countdown, auto-submit, grading, per-question results)
- [x] 5.3 Implement attempt history + per-topic accuracy summary

## 6. Verification

- [x] 6.1 End-to-end check: workspace → co-edit → review → merge → bank → practice + timed mock → history
- [x] 6.2 Verify role denials, version conflicts, duplicate-merge alias integrity, and draft exclusion from quizzes

## 7. Hardening (25-hole audit fix)

- [x] 7.1 Remove x-user-email impersonation fallback; secure cookie + loud JWT secret
- [x] 7.2 Register role whitelist (no self-admin) + login/register rate limits
- [x] 7.3 Dedup admin-only with live-canonical checks; single-draft approve; single-workspace publish; direct dup lookup
- [x] 7.4 Review membership gate, no self-approval with reviewer present, 400s, real version snapshot
- [x] 7.5 Proposal commit validation + dup + topic-scope; admin-only legacy claim; regex escape
- [x] 7.6 Private reads gated; member remove/leave + last-owner guard; draft/workspace delete; taxonomy decision endpoint
- [x] 7.7 Quiz full-snapshot grading + filter lock + server clock; bank pagination; aggregation rank; batched history
- [x] 7.8 Edge-safe middleware; UI conflict versions, member/delete controls, taxonomy inbox; security regression tests
