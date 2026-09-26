## Context

`/bank` today is a subject-card browser (`GET /api/subjects` → cards). Questions live globally under taxonomy (Body → Exam → Subject → Topic), owned via `creatorId`. There is no personal organisation. Users want Drive semantics: My Bank = root, folders nest, files are questions.

Constraints: Mongo schemaless via `src/lib/db.ts` (no migrations); JWT-cookie auth (`getAuthUser`); shadcn/ui + lucide only; keep quiz/workspace flows untouched.

## Goals / Non-Goals

**Goals:**
- Personal root per user (implicit — folders with `ownerId == me`, questions with `creatorId == me`).
- Folder CRUD + move + tree + breadcrumb + grid; file view screen for all 6 question types with small Edit entry.
- Drive look: sidebar tree, folder/file icons, breadcrumb bar, grid/list.

**Non-Goals:**
- Sharing/permissions on folders, trash, starred, recent, real-time sync — deferred.
- Migrating old global bank into personal banks; global Explore stays read-only.

## Decisions

### 1. Folders as a flat collection with `parentId` (over nested docs)
`folders { id, ownerId, name, parentId: string|null, createdAt }`. Tree built client-side from one `GET /api/drive/folders` (≤500, owner-scoped). Questions link via `folderId: string|null` (new optional field on question docs; absent = Bank root).
Rationale: matches Drive mental model, one query for tree, cheap move/rename. Alternative — materialised path — rejected as overkill.

### 2. Personal scope = `creatorId == me` for files (over new ownership table)
A user's Bank shows only questions they created (`creatorId`), plus unfiled at root. Global Explore tab keeps the old taxonomy browse for everything else.
Rationale: zero backfill; seed data already sets `creatorId`.

### 3. Three APIs, owner-enforced server-side
- `GET/POST /api/drive/folders` — list mine / create `{ name, parentId? }`.
- `PATCH/DELETE /api/drive/folders/[id]` — rename/move (`{ name?, parentId? }`, cycle-guarded) / delete (only if empty, else 400).
- `GET /api/drive/contents?folderId=` — one call returns `{ folders, questions, breadcrumbs }` for the current level.
- Extend `PATCH /api/bank/[id]` with `{ folderId }` (creator/editor/admin only) for file moves; new `POST /api/drive/questions` creates a question directly in a folder via `validateQuestion`.
Alternative — separate move endpoint — folded into PATCH to reuse auth.

### 4. Single-page Drive UI at `/bank` with query-state navigation
`?folder=<id>` drives level; sidebar tree + main grid share state; file click → full-screen view overlay (Drive preview) with breadcrumb, type-specific render, and small ghost "Edit question" button opening `QuestionEditor` in a modal.
Rationale: no router churn, back-button friendly, reuses existing `QuestionEditor` + validation.

### 5. Lucide icon language
Folder → `Folder` / `FolderOpen`; files by type: mcq `ListChecks`, multi_select `CheckSquare`, true_false `ToggleLeft`, fill_in `PenLine`, essay/short_answer `FileText`. Sidebar tree uses chevron + folder icons.

## Risks / Trade-offs

- [Orphaned folderId after folder delete → files strand] → Mitigation: block non-empty folder delete (400 "Move or delete contents first").
- [Folder cycles on move] → Mitigation: walk ancestors server-side, reject descendant moves.
- [Large personal banks] → Mitigation: cap tree fetch 500, contents paginated by `take/skip` later; fine for v1.
- [Global questions with no creatorId invisible in My Bank] → Mitigation: they stay visible under Explore tab.
