# Feature Specification: Fix Delete Spec for SpecKit

**Feature Branch**: `004-fix-delete-spec`  
**Created**: 2024-12-05  
**Status**: Draft  
**Input**: User description: "O botão delete spec não está funcionando para as specs relacionadas ao SpecKit, precisamos corrigir essa funcionalidade para que o usuário seja capaz de excluir uma spec normalmente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete SpecKit Spec (Priority: P1)

As a user working with the SpecKit system, I want to delete a spec from the Spec Explorer so that I can remove specifications that are no longer needed.

**Why this priority**: This is the core bug fix that the user reported. The delete functionality is completely broken for SpecKit specs, preventing users from managing their specifications.

**Independent Test**: Can be fully tested by selecting a SpecKit spec in the Spec Explorer, right-clicking and selecting "Delete Spec", and verifying the spec directory is removed from the `specs/` folder.

**Acceptance Scenarios**:

1. **Given** a SpecKit spec exists (e.g., `specs/001-feature-name/`), **When** the user right-clicks on the spec in the Spec Explorer and selects "Delete Spec", **Then** the spec directory and all its contents are permanently deleted from the filesystem.

2. **Given** a SpecKit spec is successfully deleted, **When** the deletion completes, **Then** a success notification is displayed to the user and the Spec Explorer refreshes to show the updated list.

3. **Given** a SpecKit spec deletion fails (e.g., permission error, file in use), **When** the deletion encounters an error, **Then** an error message is displayed explaining why the deletion failed.

---

### User Story 2 - Delete OpenSpec Spec (Priority: P2)

As a user working with the OpenSpec system, I want the existing delete functionality to continue working correctly so that backward compatibility is maintained.

**Why this priority**: Important for regression prevention - the fix must not break existing OpenSpec delete functionality.

**Independent Test**: Can be fully tested by selecting an OpenSpec spec in the Spec Explorer, right-clicking and selecting "Delete Spec", and verifying the spec directory is removed from the `openspec/specs/` folder.

**Acceptance Scenarios**:

1. **Given** an OpenSpec spec exists (e.g., `openspec/specs/my-feature/`), **When** the user right-clicks on the spec and selects "Delete Spec", **Then** the spec directory and all its contents are permanently deleted from the filesystem.

2. **Given** a successful OpenSpec spec deletion, **When** the deletion completes, **Then** a success notification is displayed and the Spec Explorer refreshes.

---

### User Story 3 - Confirmation Dialog Before Deletion (Priority: P3)

As a user, I want to confirm before deleting a spec so that I don't accidentally lose important work.

**Why this priority**: Safety feature to prevent accidental data loss. While important, the core functionality must work first.

**Independent Test**: Can be tested by attempting to delete any spec and verifying a confirmation dialog appears before deletion proceeds.

**Acceptance Scenarios**:

1. **Given** the user initiates a spec deletion, **When** the delete action is triggered, **Then** a confirmation dialog appears asking the user to confirm the deletion with the spec name displayed.

2. **Given** a confirmation dialog is displayed, **When** the user clicks "Cancel" or dismisses the dialog, **Then** no deletion occurs and the spec remains intact.

3. **Given** a confirmation dialog is displayed, **When** the user confirms the deletion, **Then** the spec is deleted as expected.

---

### Edge Cases

- What happens when attempting to delete a spec that no longer exists on the filesystem (stale tree item)?
- How does the system handle deletion when the spec directory contains read-only files?
- What happens if the user tries to delete a spec while a file from that spec is open in the editor?
- How does deletion behave when the Spec Explorer shows specs from both OpenSpec and SpecKit systems simultaneously?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST correctly identify the spec system (SpecKit or OpenSpec) when deleting a spec to construct the correct filesystem path.

- **FR-002**: System MUST delete SpecKit specs from the `specs/<spec-name>/` directory path.

- **FR-003**: System MUST delete OpenSpec specs from the `openspec/specs/<spec-name>/` directory path.

- **FR-004**: System MUST use the `system` property from the SpecItem when determining which path to use for deletion.

- **FR-005**: System MUST display a success notification after successful deletion.

- **FR-006**: System MUST display an error message if deletion fails, including relevant error details.

- **FR-007**: System MUST refresh the Spec Explorer tree view after successful deletion to reflect the updated state.

- **FR-008**: System MUST prompt the user for confirmation before deleting a spec, displaying the spec name in the confirmation message.

- **FR-009**: System MUST NOT delete any files if the user cancels or dismisses the confirmation dialog.

### Key Entities *(include if feature involves data)*

- **SpecItem**: Tree item representing a spec in the Spec Explorer, contains `specName`, `system` (SpecKit/OpenSpec), and `filePath` properties.
- **SpecManager**: Service class responsible for spec operations including deletion, maintains the current active spec system.
- **SpecSystemAdapter**: Adapter providing unified interface for both spec systems, manages path resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully delete SpecKit specs via the context menu with 100% reliability.

- **SC-002**: Users can successfully delete OpenSpec specs via the context menu (existing functionality preserved).

- **SC-003**: Confirmation dialog prevents accidental deletions - users must explicitly confirm before any spec is removed.

- **SC-004**: All spec deletions complete in under 2 seconds for typical spec directories (< 20 files).

- **SC-005**: Error messages clearly communicate the reason for deletion failures, enabling users to resolve issues independently.

- **SC-006**: Spec Explorer tree view updates immediately after deletion without requiring manual refresh.

## Assumptions

- The `SpecItem` class already has the `system` property populated correctly when specs are listed in the tree view.
- The `SpecSystemAdapter` singleton is already initialized before delete operations are attempted.
- Users have appropriate filesystem permissions to delete files in their workspace.
- The confirmation dialog will use VS Code's built-in modal dialog API for consistency with platform UX patterns.
