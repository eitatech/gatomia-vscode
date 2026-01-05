# Feature Specification: Automatic Review Transition

**Feature Branch**: `001-auto-review-transition`  
**Created**: 2025-12-24  
**Status**: Draft  
**Input**: User description: "Specifications that have been completed are not going to the review area. This should happen automatically, after all tasks in a specification have been marked as completed, or if the user right-clicks and selects "send to review." We need to correct this flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto move when work is done (Priority: P1)

Spec owners need their completed specifications to appear in the Review area as soon as every task linked to that spec is marked as concluída so they can hand off for approval without extra clicks.

**Why this priority**: Prevents the review backlog from stalling because owners forget to manually move the card, which currently blocks reviewers entirely.

**Independent Test**: Complete all tasks for a single specification in isolation and confirm the specification transitions to Review automatically within the promised time window.

**Acceptance Scenarios**:

1. **Given** a specification is in the **“In Progress”**  and has at least one pending task, **When** the last remaining task is marked **Completed**, **Then** the specification status automatically updates to **“Review”** and the specification appears in the **Review** tree without any user action.

2. **Given** a specification has already been moved to **Review** automatically, **When** reviewers open the **Review** tree, **Then** the specification is visible with the **completion timestamp** and is **awaiting reviewer assignment**.


---

### User Story 2 - Manual “Send to review” action (Priority: P2)

Spec owners sometimes prefer to trigger the review handoff manually (e.g., after a quick audit), so a contexto menu action must reliably move the specification to Review on demand.

**Why this priority**: Provides agency when automation is delayed or when owners deliberately override the auto-trigger after double-checking the work.

**Independent Test**: From a clean workspace, right-click an eligible specification, choose “Send to review,” and verify the Review tree reflects the change immediately and acknowledges the triggering user.

**Acceptance Scenarios**:

1. **Given** a specification that is eligible for review, **When** the user right-clicks it (in any relevant item) and selects “Send to review,” **Then** the specification status, Review tree entry, and audit log all update with the initiating user and timestamp.

---

### User Story 3 - Consistent status handling (Priority: P3)

Coordinators must trust that specs do not bounce between tabs or stay stuck when tasks are reopened, ensuring reviewers always see only ready items.

**Why this priority**: Maintains predictability and prevents reviewers from wasting tempo on specs that are not really ready.

**Independent Test**: Simulate reopening one task after a review transition and verify the specification leaves the Review tab until it becomes eligible again.

**Acceptance Scenarios**:

1. **Given** a specification sitting in Review because all tasks were completed, **When** any task is reopened or marked as pending again, **Then** the specification is removed from Review and flagged back to the execution column until all tasks return to completed.

---

### Edge Cases

- All but one task are concluídas, and the final one is created after the others finish; ensure the automation still re-evaluates eligibility whenever new tasks appear.
- Manual “Send to review” is executed twice (by the same or a different usuário) while the transition is already in progress; the system must ignore duplicates and surface a friendly confirmation.
- Network or sync failures occur exactly when the transition should fire; specs must retry or notify the user instead of remaining invisíveis da aba de Review.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST continuously evaluate each specification’s tasks and flag a specification as “eligible for review” only when 100% of its tasks have a completed status.
- **FR-002**: When a specification first becomes eligible, the system MUST automatically change the status to “Review”, move the card to the respective tab, and record the time and user (or process) that triggered the change.
- **FR-003**: The Review tab MUST refresh (or receive a push) to reflect the new card within 10 seconds after the automatic transition without requiring a manual UI reload.
- **FR-004**: The “Send to review” context action MUST be available for all ready specifications and, when triggered, execute the same transition flow, including success messages and immediate user feedback.
- **FR-005**: If a manual transition is requested for an item already in Review, the system MUST block duplicate operations and inform the user that the item is already there.
- **FR-006**: If any task is reopened after going to Review, the system MUST remove the card from the Review tab, restore the previous status, and notify the relevant stakeholders.
- **FR-007**: Each transition (automatic or manual) MUST emit telemetry and logs with the specification ID, user involved (when applicable), timestamps, and result (success/failure) for auditing purposes.
- **FR-008**: Every transition to Review MUST trigger notifications on the standard review alert channel to all assigned reviewers or watchers, ensuring immediate confirmation of the new item.

### Key Entities *(include if feature involves data)*

- **Specification**: Main item containing title, author, current status, displayed column, and the set of linked tasks; it is the object moved between “In Progress” and “Review”.
- **Task**: Granular work associated with a specification, possessing status (pending, in progress, completed) and timestamps; determines the eligibility of the specification.
- **Transition to Review Event**: Audible record that captures source (automatic X manual), user, time, and result; feeds reports and telemetry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of specifications with all tasks completed must appear in the Review tab within 10 seconds of the last task being closed, measured in a staging environment.
- **SC-002**: 100% of executions of the “Send to review” command on eligible specifications must result in a successful transition on the first attempt during end-to-end testing.
- **SC-003**: 0 support tickets related to “completed spec does not appear in Review” during the release cycle immediately after launch.
- **SC-004**: 100% of Review inbound or outbound events must be recorded in the logs/telemetry with the required fields (Specification ID, trigger type, user if applicable, timestamp, and status).

## Clarifications

### Session 2025-12-24

- Q: Who must be notified when a spec moves to Review automatically or via manual command? → A: Notify all assigned reviewers/watchers via the existing review-alert channel.

## Assumptions

- “All tasks completed” means that no item associated with the specification is marked as pending or in progress; newly created tasks immediately count towards the review.
- The “Send to review” action remains available in the context menus of the lists where the specifications are currently displayed (explorer and main panel).
- Error notifications can use the same mechanisms already existing for alerts in the product; it is not necessary to create new specific channels.
