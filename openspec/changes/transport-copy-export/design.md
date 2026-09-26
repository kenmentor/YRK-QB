## Context

Folders `{ownerId,name,parentId}`, questions with catalog validation; shares gate access; jszip absent.

## Goals / Non-Goals

**Goals:** in-place copy, real-folder zip download, validated JSON import incl. hand-written files.

**Non-Goals:** cross-bank server copy, image/media binaries in zips (URLs only), version migration beyond v1 — deferred.

## Decisions

### 1. Bundle JSON over the wire, zip at the edge (over server zips)
Export/import APIs trade the validated bundle; the client builds/parses `.zip` with jszip (dynamic import, single new dep).
Rationale: server stays light and testable; zip is a presentation of the bundle.

### 2. One versioned schema for files, bundles wrap them (over ad-hoc shapes)
`yrk-question/1` per file; `yrk-folder/1` bundles nest. Import sniffs `format` to accept either; unknown versions rejected with a clear error.
Rationale: hand-transport works — write correct JSON anywhere, it imports.

### 3. Copies are new docs owned in the destination bank (over references)
Copied folders inherit destination owner; copied questions get `creatorId = copier`.
Rationale: copies are independent; no cross-bank aliasing.

## Risks / Trade-offs

- [Zip bombs / giant imports] → Mitigation: caps (500 Qs, 100 folders, depth 6) + per-question schema validation.
- [Topic paths don't resolve] → Mitigation: file as general, reported in preview, never blocking.
