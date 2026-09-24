## ADDED Requirements

### Requirement: Workspace creation and membership
The system SHALL allow users to create team workspaces with a name, focus description, and target exam linkage, and manage members with Owner, Editor, and Reviewer roles.

#### Scenario: Create workspace
- **WHEN** a user creates a workspace with a name and focus
- **THEN** the system creates the workspace with that user as Owner and generates an invite link/code

#### Scenario: Invite members with roles
- **WHEN** an Owner invites users as Editor or Reviewer
- **THEN** invitees join with the assigned role and role-specific permissions apply immediately

#### Scenario: Role enforcement
- **WHEN** a Reviewer attempts to directly edit a draft
- **THEN** the system denies the edit and prompts to leave a comment or change request instead

### Requirement: Single-question co-edit and set co-build
The system SHALL support both co-editing a single question draft by multiple editors and co-building a set where each member contributes drafts within one workspace, with async saves and comments.

#### Scenario: Co-edit single question
- **WHEN** two Editors save changes to the same draft
- **THEN** the system stores both as separate versions, flags a conflict branch, and shows a diff for resolution

#### Scenario: Co-build set
- **WHEN** members add drafts to a workspace set
- **THEN** the workspace lists each draft with author and status (draft, in_review, approved, merged)

#### Scenario: Comment on draft
- **WHEN** any member comments on a draft or version
- **THEN** the comment is visible to all workspace members with author and timestamp

### Requirement: Review request and reassignment
The system SHALL allow Owners to request review on one or many drafts, and reassign reviewers to avoid bottlenecks.

#### Scenario: Request review
- **WHEN** an Owner requests review on drafts
- **THEN** assigned Reviewers are notified and drafts move to in_review status

#### Scenario: Reassign reviewer
- **WHEN** an Owner reassigns a pending review to a different Reviewer
- **THEN** the new Reviewer is notified and the prior assignment is revoked
