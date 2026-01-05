# Feature Specification: Spec Explorer review flow

**Feature Branch**: `001-spec-review-flow`  \
**Created**: 2025-12-07  \
**Status**: Draft  \
**Input**: User description: "Currently, all completed specification tasks remain in the `Current Specs` area of SpecExplorer, even after completion. I need a specification to be moved to a new user review area called `Ready to Review` when it is completed. If a user identifies a problem, they can create an `issue` to have it changed, corrected, or adjusted according to the user's description and observations. These issues should be added to the `Changes` area where they should be refined as follows: The reported item added to the changes area provides a button that sends a request to the `tasks` prompt, referencing the related specification and requesting the creation of tasks to review, correct, or implement what was pointed out in this `Change Request`. We then create these new tasks with the necessary observations, which enter the standard SpecKit workflow. When the change request is created and sent, we consider the spec to be reopened, so it returns to the `Current Specs` area and, upon completion, goes back to the `Review` area."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send completed spec to review (Priority: P1)

A spec author completes a spec in Current Specs and uses a Send to Review button to move it into the Review folder only when there are no remaining tasks or checklist items.

**Why this priority**: Prevents partially completed work from entering review, keeps the Review list tidy, and gives authors ownership of when a spec is ready to hand off.

**Independent Test**: Complete all tasks/checklist items for a spec, observe the Send to Review button enable, click it, and confirm the spec appears in Review while disappearing from Current Specs.

**Acceptance Scenarios**:

1. **Given** a spec in Current Specs with open tasks or checklist items, **When** the author views the spec, **Then** the Send to Review button is disabled with contextual messaging.
2. **Given** a spec in Current Specs with zero open tasks or checklist items, **When** the author clicks Send to Review, **Then** the spec moves to Review with owner, status, and link data intact and no longer appears in Current Specs.
3. **Given** a spec was moved to Review, **When** a reviewer opens SpecExplorer, **Then** the spec is listed under Review and is omitted from Current Specs.

---

### User Story 2 - File change request from review (Priority: P2)

A reviewer identifies an issue while reading a spec in Review and files a change request that lands in the Changes area, capturing context and reviewer notes.

**Why this priority**: Creates a structured way to capture review feedback and prevents approvals from blocking on undocumented issues.

**Independent Test**: From a Review spec, submit a change request and verify it appears in Changes with spec linkage and reviewer-provided details.

**Acceptance Scenarios**:

1. **Given** a spec in Review, **When** a reviewer submits a change request with description and severity, **Then** a new entry shows in Changes with the linked spec and submitted details.
2. **Given** a change request in Changes, **When** the reviewer inspects it, **Then** it displays the originating spec reference and reviewer notes.

---

### User Story 3 - Archive reviewed specs (Priority: P2)

A reviewer finishes verifying a spec in Review and selects Send to Archived so the spec leaves the Review list and lives in the Archived folder for historical reference.

**Why this priority**: Keeps the Review area lean, helps stakeholders focus on active items, and ensures reviewers have a clear done state.

**Independent Test**: From a Review spec with no pending change requests or checklist items, click Send to Archived and confirm the spec is removed from Review and appears in Archived with traceable metadata.

**Acceptance Scenarios**:

1. **Given** a spec in Review that still has open change requests, **When** the reviewer opens the action buttons, **Then** Send to Archived is disabled and highlights the blocking items.
2. **Given** a reviewer confirms the spec has no open change requests, tasks, or checklist items, **When** they click Send to Archived, **Then** the spec leaves Review, appears in the Archived folder, and its activity log records the transition.

---

### User Story 4 - Generate tasks and reopen spec (Priority: P3)

A reviewer triggers task generation from a change request so corrective tasks are created and the spec reopens in Current Specs until the tasks are completed.

**Why this priority**: Keeps remediation work tracked in the standard SpecKit workflow and ensures specs return to review only after fixes.

**Independent Test**: Trigger task creation from a change request, confirm tasks exist with the referenced spec, and observe the spec moves back to Review after tasks are marked complete.

**Acceptance Scenarios**:

1. **Given** a change request in Changes, **When** the reviewer clicks the button to send it to the tasks prompt, **Then** a request is created referencing the spec and reviewer notes, and the spec status updates to Reopened in Current Specs.
2. **Given** all tasks generated from the change request are completed, **When** the workflow detects completion, **Then** the spec returns to Review and the change request shows as addressed.

---

### Edge Cases

- What happens when multiple change requests are opened on the same spec before the first is resolved?
- How does the system handle a failed task creation request (e.g., prompt error or missing spec reference)?
- What occurs if a reviewer attempts to reopen a spec that already returned to Review after a prior change cycle?
- How are specs handled when a reviewer attempts to archive while there are hidden or background tasks still running?
- How should the system respond if a spec was archived and a new blocker is later discovered (e.g., should it be unarchived or cloned)? → Archived specs gain an explicit “Unarchive for new blocker” action that reopens them in Current Specs while logging the audit trail.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A Send to Review button MUST only be enabled for specs in Current Specs when all associated tasks and checklist items show as completed; otherwise it remains disabled with a reason.
- **FR-002**: Clicking Send to Review MUST move the spec (with title, owner, status, and links) from Current Specs to the Review folder and remove it from Current Specs immediately.
- **FR-003**: The Review list MUST show only specs awaiting review (i.e., not archived or reopened) and surface blockers if new tasks/checklist items appear after entry.
- **FR-004**: Reviewers MUST be able to file a change request from any spec in Review, including description, severity/impact, and optional attachments or notes.
- **FR-005**: Each submitted change request MUST appear in the Changes area with a direct reference to the originating spec and the submission timestamp.
- **FR-006**: A change request entry MUST expose a button that sends a structured request to the tasks prompt, including spec link, change description, and requested outcomes.
- **FR-007**: The system MUST create tasks in the standard SpecKit workflow from the tasks prompt response and associate them back to the originating change request.
- **FR-008**: Upon change request submission, the spec MUST transition to a Reopened state and reappear in Current Specs until linked tasks are completed.
- **FR-009**: When all tasks tied to a change request are completed, the spec MUST move back to Review and the change request MUST be marked addressed/ready for verification.
- **FR-010**: Specs in Review MUST expose a Send to Archived action that is only enabled when there are zero open change requests, tasks, or checklist items tied to that spec.
- **FR-011**: Triggering Send to Archived MUST remove the spec from Review, place it in the Archived folder with its metadata intact, and log the transition with user/time/context.
- **FR-012**: Users MUST be able to reference archived specs in a read-only state while preventing them from appearing in Current Specs or Review lists.
- **FR-013**: The system MUST log status transitions for specs and change requests for traceability (e.g., sent to Review, reopened, returned to Review, archived).
- **FR-014**: The UI MUST prevent duplicate open change requests with identical title+spec pairs or clearly show existing open items to avoid duplication.
- **FR-015**: Multiple change requests MAY be open concurrently for the same spec; the spec remains in Reopened until all linked change requests and their tasks are addressed, and archived specs MUST provide an Unarchive action to return to Current Specs when new blockers emerge.

### Key Entities *(include if feature involves data)*

- **Specification**: A document tracked in SpecExplorer with statuses Current Specs, Review, Reopened, or Archived; holds metadata such as owner, title, links, completion timestamps, and outstanding task/checklist summaries.
- **Change Request**: A reviewer-submitted item linked to a Specification, capturing description, severity, submitter, timestamps, and linked tasks; resides in Changes with status (open, in progress, addressed).
- **Task Request/Tasks**: The structured payload sent to the tasks prompt and the resulting tasks added to the standard workflow; store linkage to the originating Change Request and Specification.

### Assumptions

- SpecExplorer already tracks spec completion state and user roles (authors, reviewers).
- The tasks prompt can accept structured payloads and return task items that enter the existing SpecKit workflow without additional configuration.
- Task, change request, and checklist completion status is detectable so specs can automatically return to Review or enable Archive actions when all blockers are cleared.
- Archived specs remain accessible for read-only reference without affecting current workflow quotas or reporting.
- Notifications or visibility for duplicate change requests rely on UI surfacing, not external tooling.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of specs with zero open tasks/checklist items display an enabled Send to Review button within 1 minute of the final item closing.
- **SC-002**: 95% of specs moved via Send to Review appear in the Review folder within 2 minutes and are removed from Current Specs.
- **SC-003**: Reviewers can file a change request from a Review spec in under 60 seconds with spec linkage auto-populated.
- **SC-004**: 95% of submitted change requests create associated tasks in the standard workflow within 2 minutes of the send action.
- **SC-005**: 90% of specs with all linked change-request tasks completed automatically return to Review without manual intervention.
- **SC-006**: 90% of specs marked complete by reviewers transition to Archived within 2 minutes of clicking Send to Archived, resulting in fewer than 10 lingering reviewed specs at the end of each week.
- **SC-007**: Reviewers report fewer than 5% duplicate change requests per spec over a release cycle due to duplicate detection or visibility.

## Clarifications

### Session 2025-12-07

- Q: Allow multiple change requests per spec or constrain to one? → A: Allow multiple open change requests per spec; spec stays Reopened until all linked requests are addressed.
