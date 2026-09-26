## Context

Drive-bank: folders `{ownerId, name, parentId}`, questions `{creatorId, folderId}`. All folder APIs owner-check today. Notifications infra exists (`{userId, kind, title, body, link, read}`).

## Goals / Non-Goals

**Goals:** invite-to-folder/root with 3 roles; inline shared listing with distinct color; owner-keeps-admin; server-enforced.

**Non-Goals:** link-based sharing, groups/domains, per-file shares, share expiry — deferred.

## Decisions

### 1. `folderShares {folderId: string|null, ownerId, userId, role}` (over ACL arrays)
Null folderId = whole bank root. One doc per (scope, user) via upsert. Inheritance: share applies to folder + descendants; max role wins (viewer 1 < reviewer 2 < editor 3; owner implicit 4).
Rationale: one query (`{userId: me}`) resolves everything; root + folder uniformly.

### 2. Roles: viewer = read; reviewer = read + create; editor = manage; owner = admin
Reviewer can file new questions/folders into shared space (submit work) but cannot edit/rename/move/delete existing items. Editors cannot manage shares or delete/reparent folders they don't own.
Rationale: distinct, safe middle tier; mirrors workspace reviewer-can't-mutate.

### 3. Shared items render inline with emerald color (over separate section only)
My root merges shared folder/bank entries into the same grid with emerald folders + "Shared" chips (+ sidebar Shared group for navigation). Ownership shown ("X's bank").
Rationale: matches the request exactly; Drive-like recognition.

### 4. Folder contents scoped by folder, not creator, in shared space
Shared folder lists owner's subfolders + all questions filed there (contributors' files included). Own root unchanged (mine + shared entries).
Rationale: contributors' files must be visible where filed.

### 5. Created subfolders inherit the bank owner's id
New folders under a shared parent get `ownerId = parent owner` so trees stay coherent; question files keep `creatorId = me` for authorship.

## Risks / Trade-offs

- [Privilege via move (editor drags owner's folder away)] → Mitigation: reparent/delete require folder ownership; editors rename only.
- [Reviewer spam in shared space] → Mitigation: owner removes content/shares; no quota in v1.
- [Tree fan-out for big shared banks] → Mitigation: folders GET caps 500/owner; fine for v1.
