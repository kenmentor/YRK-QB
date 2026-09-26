## Why

Banks are solo today. Users want to invite others into a folder — or their whole root — as viewer, reviewer, or editor, and invitees should see shared items right inside their own drive with a distinct icon color (Drive-style shared affordance).

## What Changes

- Owners invite by email to a folder or to bank root with role **viewer** (read), **reviewer** (read + create, no mutate), **editor** (full manage, no share admin).
- Shares inherit down the tree; highest applicable role wins; root shares cover the whole bank.
- My Bank root lists shared folders/banks inline with emerald shared icons + "Shared" chips; sidebar keeps a compact Shared group.
- Server enforces every op; UI hides what the role can't do.

## Capabilities

### New Capabilities
- `folder-sharing`: folder/root shares, role enforcement, shared-inline listing with distinct color, share inbox/leave, invite notifications.

### Modified Capabilities
- None (additive; owners keep full control).

## Impact

- New `folderShares` collection + `src/lib/share.ts` access helper.
- Shares APIs; folders/contents/questions/bank-PATCH extended with access checks.
- Bank page, grid, tree updated; no new deps.
