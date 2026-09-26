## 1. Backend (folders + file links)

- [ ] 1.1 Add `folder` model to `src/lib/db.ts` (`folders` collection)
- [ ] 1.2 Create `GET/POST /api/drive/folders` (owner-scoped list ≤500, create `{name, parentId?}` with ownership + cycle checks)
- [ ] 1.3 Create `PATCH/DELETE /api/drive/folders/[id]` (rename/move with cycle guard, delete blocked when non-empty)
- [ ] 1.4 Create `GET /api/drive/contents?folderId=` returning `{ folders, questions, breadcrumbs }` (questions = mine by creatorId + folderId)
- [ ] 1.5 Create `POST /api/drive/questions` (validate via `validateQuestion`, create with creatorId + folderId)
- [ ] 1.6 Extend `PATCH /api/bank/[id]` with `{ folderId, stem?, options?, correct?, explanation?, difficulty? }` for move + edit (creator/editor/admin)

## 2. Frontend (Drive UI)

- [x] 2.1 Rebuild `src/app/bank/page.tsx` as Drive app: sidebar tree + breadcrumb + grid, `?folder=` state, My Bank / Explore tabs
- [x] 2.2 Build `src/components/drive-tree.tsx` (recursive tree, expand/collapse, counts, icons + drop-to-move targets)
- [x] 2.3 Build `src/components/drive-grid.tsx` (Explorer details list + tiles view, icons, context actions, drag-and-drop move)
- [ ] 2.4 Build `src/components/question-view.tsx` (all 6 types render + small ghost Edit button)
- [ ] 2.5 Wire New folder / New question / Rename / Move / Delete modals + toasts

## 3. Verification

- [ ] 3.1 `npm test` still passes; `tsc --noEmit` clean for touched files
- [ ] 3.2 Manual check: root → folder → nested folder → file view → edit → move → delete guards
