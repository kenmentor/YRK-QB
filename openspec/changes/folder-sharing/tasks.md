## 1. Backend

- [x] 1.1 `folderShares` model in `src/lib/db.ts` + `src/lib/share.ts` (roles, rank, ancestry, `getFolderAccess`, `annotateFolders`)
- [x] 1.2 `GET/POST /api/drive/shares` (owner list/invite-upsert + notify) + `DELETE /api/drive/shares/[id]` (owner remove / self leave)
- [x] 1.3 Folders GET (shared-visible + access annotate) / POST (shared-parent create, inherit owner) / `[id]` PATCH+DELETE (editor rename, owner reparent/delete)
- [x] 1.4 Contents GET (`ownerId` shared roots, folder-scoped files, access + owner in response)
- [x] 1.5 Drive questions POST + bank PATCH (shared create/edit/move with role gates)

## 2. Frontend

- [x] 2.1 Bank page: shared-mode nav (`ownerId`), access-driven UI, Share modal, sidebar Shared group + leave
- [x] 2.2 Grid/tiles: emerald shared icons + chips, shared-root entries, drag only when managing
- [x] 2.3 Tree: owner-aware select for shared groups

## 3. Verification

- [x] 3.1 Contracts: share routes, gates, notify; `npm test` green, `tsc` clean on touched files
