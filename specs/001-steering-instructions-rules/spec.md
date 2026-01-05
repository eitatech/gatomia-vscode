# Feature Specification: Steering Instructions & Rules

**Feature Branch**: `001-steering-instructions-rules`  
**Created**: 2026-01-05  
**Status**: Draft  
**Input**: User description: "Steering documents should list project instruction files from `.github/instructions/*.instructions.md`. The `Create User Rule` action should prompt for a rule name (e.g., `typescript`) and create `<name>.instructions.md` under `$HOME/.github/instructions/` (creating the directory if needed). The `Create Project Rule` action should do the same under `.github/instructions/`. Add a `Create Constitution` button that prompts for a short description and sends a Copilot Chat request using agent `speckit.constitution` with that text as the request parameter."

## Clarifications

### Session 2026-01-05

- Q: What should the initial content be for files created by `Create User Rule` / `Create Project Rule`? → A: Create a standard instruction template (frontmatter `description`/`applyTo` + heading).
- Q: How should the user-provided “instruction name” be handled (normalization/validation)? → A: Normalize automatically to lowercase `kebab-case`.
- Q: Should Steering also list user rules (`$HOME/.github/instructions/*.instructions.md`)? → A: Yes, list them (e.g., under a “User Instructions” section).
- Q: After the `speckit.constitution` agent responds, what do we do with the result? → A: Nothing; the agent creates/updates the document, and Steering already handles showing it.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - View project instructions in Steering (Priority: P1)

As a user, I want the Steering documents area to list the project instruction documents that exist in the repository, so I can discover and open them without leaving the product.

**Why this priority**: It fixes the current visibility gap and makes existing project governance rules usable.

**Independent Test**: Can be fully tested by opening the Steering documents area in a repository that contains `.github/instructions/*.instructions.md` and confirming they appear and can be opened.

**Acceptance Scenarios**:

1. **Given** a repository with `.github/instructions/typescript.instructions.md`, **When** I open the Steering documents area, **Then** I see an item for `typescript.instructions.md`.
2. **Given** the instructions list is visible, **When** I select an instruction document, **Then** the document opens for viewing/editing.
3. **Given** a user instructions file exists at `$HOME/.github/instructions/typescript.instructions.md`, **When** I open the Steering documents area, **Then** I see it listed under a user-scoped section (e.g., “User Instructions”).
4. **Given** a user instruction item is visible, **When** I select it, **Then** the document opens for viewing/editing.

---

### User Story 2 - Create a project rule (Priority: P2)

As a user, I want to create a new project instruction rule by choosing a name, so the project can standardize and evolve its guidelines in a consistent place.

**Why this priority**: It streamlines authoring of project rules and keeps them inside the repository.

**Independent Test**: Can be fully tested by creating a project rule with a new name and confirming the new file is created under `.github/instructions/` and appears in the list.

**Acceptance Scenarios**:

1. **Given** I am viewing Steering documents, **When** I click `Create Project Rule` and enter `typescript`, **Then** a new file named `typescript.instructions.md` is created under `.github/instructions/`.
2. **Given** the new file was created, **When** the list refreshes, **Then** `typescript.instructions.md` appears in the project instructions list.
3. **Given** I enter a name that already exists, **When** I confirm creation, **Then** the system does not overwrite the existing file and shows an actionable message.
4. **Given** I created a new project rule, **When** I open the created file, **Then** it contains a standard instruction template (frontmatter + heading) ready for editing.
5. **Given** I enter `TypeScript Rules`, **When** I confirm creation, **Then** the created filename is `typescript-rules.instructions.md`.

---

### User Story 3 - Create a user rule (Priority: P3)

As a user, I want to create a personal instruction rule by choosing a name, so I can define reusable guidance without committing it to the repository.

**Why this priority**: It supports personal workflows and keeps user-level guidance separate from project governance.

**Independent Test**: Can be fully tested by creating a user rule and confirming the file exists in the user instructions directory.

**Acceptance Scenarios**:

1. **Given** I am viewing Steering documents, **When** I click `Create User Rule` and enter `typescript`, **Then** a new file named `typescript.instructions.md` is created under `$HOME/.github/instructions/`.
2. **Given** the user instructions directory does not exist, **When** I create a user rule, **Then** the directory is created automatically and the file is created successfully.
3. **Given** the file already exists, **When** I confirm creation, **Then** the system does not overwrite it and shows an actionable message.
4. **Given** I created a new user rule, **When** I open the created file, **Then** it contains a standard instruction template (frontmatter + heading) ready for editing.
5. **Given** I enter `TypeScript Rules`, **When** I confirm creation, **Then** the created filename is `typescript-rules.instructions.md`.

---

### User Story 4 - Request a Constitution document (Priority: P4)

As a user, I want to request a Constitution document by providing a short description, so the Copilot agent can draft a Constitution aligned with my intent.

**Why this priority**: It accelerates governance setup by making Constitution drafting an in-product workflow.

**Independent Test**: Can be fully tested by submitting a Constitution request and observing that a chat request is issued using the expected agent and input text.

**Acceptance Scenarios**:

1. **Given** I am viewing Steering documents, **When** I click `Create Constitution` and submit a short description, **Then** a chat request is created using agent `speckit.constitution` with the submitted description.
2. **Given** the `speckit.constitution` agent completes its work, **When** the response arrives, **Then** the system performs no additional post-processing beyond surfacing status to the user (the agent owns creating/updating the Constitution document).

### Edge Cases

- User cancels any input prompt (no file is created, no request is sent).
- User enters an empty name or whitespace-only name (creation is blocked with a clear message).
- User enters a name that normalizes to an empty string (e.g., only punctuation/emojis); creation is blocked with a clear message explaining valid examples.
- The target directory cannot be created due to permissions (error is reported with next steps).
- The file already exists (no overwrite by default; user is informed).
- Different inputs normalize to the same name (e.g., "TypeScript" and "type script"), causing a collision; system treats it as an existing-file case.
- Repository does not contain `.github/instructions/` (project rule creation still works by creating the directory).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Steering documents area MUST list all project instruction documents located under `.github/instructions/` with the suffix `.instructions.md`.
- **FR-001a**: The Steering documents area MUST list all user instruction documents located under `$HOME/.github/instructions/` with the suffix `.instructions.md`.
- **FR-002**: Users MUST be able to open any listed project instruction document from the Steering documents area.
- **FR-003**: The system MUST provide a `Create Project Rule` action that prompts the user for an instruction name.
- **FR-004**: When creating a project rule, the system MUST create `.github/instructions/<name>.instructions.md` (and create the directory if needed) using a standard instruction template (frontmatter + heading).
- **FR-005**: The system MUST provide a `Create User Rule` action that prompts the user for an instruction name.
- **FR-006**: When creating a user rule, the system MUST create `$HOME/.github/instructions/<name>.instructions.md` (and create the directory if needed) using a standard instruction template (frontmatter + heading).
- **FR-007**: If the target file already exists (project or user), the system MUST NOT overwrite it by default and MUST show an actionable message.
- **FR-008**: The system MUST validate that the provided instruction name is non-empty and MUST normalize it to a safe lowercase `kebab-case` filename before creating the file. The system MUST NOT reject names solely due to “unsupported characters”; instead it MUST normalize and only reject if the normalized result is empty or invalid per the normalization regex.
- **FR-009**: The system MUST provide a `Create Constitution` action that prompts the user for a brief description.
- **FR-010**: When creating a Constitution request, the system MUST send a request to GitHub Copilot Chat using agent `speckit.constitution` with the user-provided description as the request input.
- **FR-010a**: After the agent responds, the system MUST NOT perform additional actions to create/update the Constitution document; the agent is responsible for creating/updating it, and Steering documents already handles showing Constitution documents.

### Key Entities *(include if feature involves data)*

- **Instruction Document**: A markdown document containing guidance, identified by a name, a scope (project or user), and a location.
- **Constitution Request**: A user-submitted description that triggers a Constitution drafting request.

### Assumptions

- The Steering documents area already exists and supports listing and opening documents.
- The user environment has a writable home directory path used for user-level rules.
- The GitHub Copilot Chat experience supports running the `speckit.constitution` agent from within the product.

### Dependencies

- Users have filesystem permissions to create files/directories in the target locations.
- The repository workspace is writeable for project rule creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a repository with at least 10 instruction files, the Steering documents list renders and is interactive in under 2 seconds on a typical developer machine:
  - the tree view populates with the instruction groups and their children, and
  - at least one instruction item can be selected and opened.
  - Measurement can be validated via timestamped logs around list computation and first render completion.
- **SC-002**: Users can create a project rule (name prompt -> file created) in under 30 seconds without needing to manually create folders.
- **SC-003**: Users can create a user rule (name prompt -> file created) in under 30 seconds without needing to manually create folders.
- **SC-004**: When a creation fails (invalid name, already exists, permission issues), the user sees a clear message explaining what happened and how to proceed.
- **SC-005**: A Constitution request is successfully issued to Copilot Chat for 100% of valid submissions (non-empty description).
