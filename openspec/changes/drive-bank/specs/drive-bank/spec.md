## ADDED Requirements

### Requirement: Personal bank root per user
Every authenticated user SHALL have an implicit Bank root listing their own folders (ownerId == me) and their own question files (creatorId == me, folderId null = root).

#### Scenario: Open My Bank
- **WHEN** a logged-in user opens `/bank`
- **THEN** the system shows their root folders and unfiled questions, not the global subject list

#### Scenario: Unauthenticated visit
- **WHEN** an anonymous user opens `/bank`
- **THEN** the system prompts login for My Bank and offers read-only Explore

### Requirement: Folder CRUD and nesting
Users SHALL create, rename, move, and delete folders; folders MAY nest via parentId; delete SHALL be blocked when non-empty.

#### Scenario: Create folder
- **WHEN** user creates "Physics" at root
- **THEN** a folder appears at root and in the sidebar tree

#### Scenario: Drill into folder
- **WHEN** user clicks a folder
- **THEN** the view steps one level deeper, URL becomes `?folder=<id>`, breadcrumb gains a crumb, and only that folder's children show

#### Scenario: Block unsafe delete
- **WHEN** user deletes a folder containing items
- **THEN** the system rejects with 400 and keeps contents intact

#### Scenario: Block folder cycles
- **WHEN** user moves a folder into its own descendant
- **THEN** the system rejects with 400

### Requirement: Files are questions of any type
Each file SHALL be one question (mcq, multi_select, true_false, fill_in, essay, short_answer); users SHALL create files in the current folder, move files between folders, and open files in a view screen.

#### Scenario: Create question file
- **WHEN** user composes a valid question in the current folder
- **THEN** the file appears in that folder's grid with a type-specific icon

#### Scenario: Move question file
- **WHEN** user moves a question to another owned folder
- **THEN** contents update and the question disappears from the old folder

### Requirement: Question view screen with small Edit entry
Clicking a file SHALL open a view screen rendering the question as a learner sees it (stem, options/gaps/guide per type, explanation, difficulty, tags); an "Edit question" control SHALL be small and cleanly placed (ghost button, top-right of the viewer, Drive-style).

#### Scenario: View each type
- **WHEN** user opens an mcq / multi_select / true_false / fill_in / essay / short_answer file
- **THEN** stem, options or gaps or guide, correct answer, and explanation render correctly for that type

#### Scenario: Edit from viewer
- **WHEN** user clicks "Edit question"
- **THEN** an editor opens prefilled and saving updates the file in place

### Requirement: Sidebar folder tree and Drive chrome
The bank SHALL show a sidebar folder tree (expand/collapse, current highlight, counts), a breadcrumb bar, search-within-bank, and folder/file icons throughout.

#### Scenario: Tree navigation
- **WHEN** user clicks a tree node
- **THEN** the main panel navigates to that folder and highlights the node

#### Scenario: Icon language
- **WHEN** folders and files render
- **THEN** folders use folder icons and files use type-specific file icons
