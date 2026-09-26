## Why

The current bank is a website (browse subjects → open lists). Users asked for a web app: Google Drive but just for questions — every user owns a personal Bank space organised as folders (sets of questions) and files (single questions of any type).

## What Changes

- **BREAKING**: `/bank` becomes a Drive-style app (sidebar + grid), replacing the subject-card browser. Old subject browse moves under "Explore" within the same page.
- Every authenticated user gets a personal **Bank root** containing folders and question files they created.
- Folders hold questions and nested folders; files are single questions (mcq, multi_select, true_false, fill_in, essay, short_answer).
- Clicking a folder drills one level deeper (breadcrumb + URL `?folder=`); clicking a file opens a question view screen with a small, cleanly placed "Edit question" button (Drive-style).
- Sidebar folder tree for fast navigation; real folder/file icons (lucide) throughout.

## Capabilities

### New Capabilities
- `drive-bank`: personal bank space, folder/file CRUD + move, tree + breadcrumb + grid navigation, question view screen with edit entry, all question-type rendering.

### Modified Capabilities
- None (old subject-browse kept as read-only "Explore" tab; no spec requirements change).

## Impact

- New `folders` collection + `folderId` link on questions (schemaless Mongo, no migration).
- New APIs: `GET/POST /api/drive/folders`, `PATCH/DELETE /api/drive/folders/[id]`, `GET /api/drive/contents`, `POST /api/drive/questions`, extended `PATCH /api/bank/[id]` (folder move).
- Reworked `src/app/bank/page.tsx` + new `src/components/drive-*` components; `shadcn/ui` + lucide icons only, no new deps.
