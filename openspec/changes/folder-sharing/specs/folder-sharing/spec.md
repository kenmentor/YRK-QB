## ADDED Requirements

### Requirement: Invite to folder or root with a role
Owners SHALL invite existing users by email to a folder or bank root as viewer, reviewer, or editor; re-inviting SHALL update the role; invitees SHALL be notified.

#### Scenario: Invite and notify
- **WHEN** an owner invites ama@example.com as editor to "Physics"
- **THEN** Ama sees "Physics" in her drive and gets a notification

#### Scenario: Unknown email rejected
- **WHEN** an owner invites an unregistered email
- **THEN** the system 404s without minting ghosts

### Requirement: Role enforcement server-side
Viewers SHALL read only; reviewers SHALL additionally create files/folders but SHALL NOT edit, rename, move, or delete existing items; editors SHALL manage content but SHALL NOT manage shares nor delete/reparent unowned folders; all violations SHALL 403.

#### Scenario: Reviewer blocked from mutating
- **WHEN** a reviewer PATCHes another's question
- **THEN** the system 403s

#### Scenario: Editor blocked from share admin
- **WHEN** an editor invites or deletes folders they don't own
- **THEN** the system 403s

### Requirement: Shared inline with distinct color
Shared folders/banks SHALL appear inside the invitee's own drive root with emerald shared icons, "Shared" chips, and owner names; navigation, breadcrumb, and view screens SHALL work identically.

#### Scenario: Shared inline
- **WHEN** an invitee opens My Bank
- **THEN** shared entries appear alongside own items in emerald with owner attribution

### Requirement: Manage and leave shares
Owners SHALL list, re-role, and remove shares; invitees SHALL leave any share; leaving SHALL hide the content immediately.

#### Scenario: Leave
- **WHEN** an invitee leaves a share
- **THEN** the entries vanish from their drive
