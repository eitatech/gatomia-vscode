# Quickstart - Spec Explorer Review Flow

## Overview

The Spec Explorer review flow enables collaborative spec refinement through three integrated workflows:

1. **Send to Review**: Authors explicitly move completed specs from Current Specs to the Review lane once all tasks/checklist items are cleared.
2. **Change Requests**: Reviewers file structured change requests with severity levels and descriptions.
3. **Tasks Dispatch**: Change requests generate actionable tasks via the tasks prompt, with automatic status tracking.
4. **Archive Reviewed Specs**: Reviewers close the loop by archiving verified specs so Review stays focused on active work.

## Prerequisites

- Node 18+, npm
- VS Code Extension Development environment
- Install dependencies: `npm run install:all`

## Quick Start (Development)

### 1. Setup

```bash
npm run install:all
npm run watch
```

### 2. Open Extension Development Host

1. Press `F5` or Run → Start Debugging
2. Open a workspace with specs in the Extension Development Host window
3. Open SpecExplorer view to see Current Specs, Review, Archived, and Changes lanes

### 3. Run Tests

```bash
npm run test              # Run all tests once
npm run test:watch        # Watch mode for TDD
npm run test:coverage     # Generate coverage report
```

## User Workflows

### Workflow 1: Send completed spec to Review (US1)

**As a spec author**, I want control over when a spec leaves Current Specs, ensuring no pending tasks/checklist items remain.

1. Complete all tasks and checklist items associated with the spec.
2. Open the spec details in Current Specs.
3. Observe the **Send to Review** button:
   - Disabled state lists blockers (e.g., "2 open tasks" or "Checklist item: Verify diagrams").
   - Enabled once `pendingTasks = 0` and `pendingChecklistItems = 0`.
4. Click **Send to Review**.
5. **Result**:
   - Spec moves from Current Specs → Review lane.
   - `status` changes `current|reopened` → `review`.
   - `completedAt` and `reviewEnteredAt` timestamps update.
   - Current Specs and Review lists update immediately; telemetry logs action latency.

**Implementation files:**

- State: `src/features/spec/review-flow/state.ts` (`canSendToReview`, `sendToReview`)
- Provider: `src/providers/spec-explorer-provider.ts` (Review lane)
- UI: `ui/src/components/spec-explorer/review-list/send-to-review-button.tsx`
- Tests: `tests/unit/features/spec/review-flow-send-to-review.test.ts`

---

### Workflow 2: File Change Request (US2)

**As a reviewer**, I want to file change requests on specs in Review.

1. Navigate to Review lane
2. Select a spec and click "Request Changes"
3. Fill out change request form:
   - **Title**: Brief summary (e.g., "Add OAuth2 flow details")
   - **Description**: Detailed feedback
   - **Severity**: `low | medium | high | critical`
   - **Notes** (optional): Additional context
4. Submit change request
5. **Result**:
   - Change request appears in Changes lane
   - Spec moves from `review` → `reopened` status
   - Spec returns to Current Specs with linked change requests
   - Author is notified via telemetry event

**Duplicate Prevention:**

- System checks for existing open change requests with same title (normalized, case-insensitive)
- If duplicate found, shows existing change request instead of creating new one
- Reviewers can edit existing change requests

**Implementation files:**

- Service: `src/features/spec/review-flow/change-requests-service.ts`
- State: `src/features/spec/review-flow/state.ts` (`addChangeRequest()`)
- Duplicate Guard: `src/features/spec/review-flow/duplicate-guard.ts`
- Form UI: `ui/src/components/spec-explorer/change-request-form.tsx`
- Changes Lane: `ui/src/components/spec-explorer/changes-list.tsx`
- Tests: `tests/unit/features/spec/review-flow-change-requests.test.ts`

---

### Workflow 3: Dispatch to Tasks & Return to Review (US4 in spec, continues numbering)

**As a reviewer or author**, I want change requests to generate actionable tasks and track completion.

#### 3.1 Dispatch Change Request to Tasks Prompt

1. Navigate to Changes lane
2. Find change request with status `open`
3. Click "Dispatch to Tasks" button
4. **Success path**:
   - Tasks prompt generates tasks from change request context
   - Tasks are attached to change request with `open` status
   - Change request status updates: `open` → `inProgress`
   - `sentToTasksAt` timestamp is set
5. **Failure path** (tasks prompt offline/error):
   - Change request status updates: `open` → `blocked`
   - Error message displayed with retry option
   - Retry button appears in Changes lane
   - Click "Retry" when service is back online

##### 3.2 Complete Tasks

1. Tasks are displayed in Changes lane under their change request
2. As tasks are completed, their status updates: `open` → `inProgress` → `done`
3. Track progress via task status badges

##### 3.3 Automatic Return to Review

1. **Trigger**: All tasks in all linked change requests are marked `done`
2. **System automatically**:
   - Updates change request status: `inProgress` → `addressed`
   - Moves spec: `reopened` → `review`
   - Spec reappears in the Review lane with refreshed metadata
3. **Reviewer can verify** changes and either:
   - Approve (spec stays in Review)
   - File new change request (cycle repeats)

**Tasks Prompt Payload Structure:**

```json
{
  "specId": "spec-001",
  "specTitle": "Authentication Flow",
  "specPath": "/workspace/specs/auth-flow/spec.md",
  "changeRequestId": "cr-001",
  "changeRequestTitle": "Add OAuth2 support",
  "changeRequestDescription": "The spec should include OAuth2 authentication flow",
  "severity": "high",
  "submitter": "reviewer@example.com",
  "context": {
    "specLink": "vscode://file/workspace/specs/auth-flow/spec.md"
  },
  "notes": "Critical for enterprise deployment"
}
```

**Implementation files:**

- Dispatch Service: `src/features/spec/review-flow/tasks-dispatch.ts`
- State Updates: `src/features/spec/review-flow/state.ts` (`attachTasksToChangeRequest()`, `shouldReturnToReview()`)
- Actions UI: `ui/src/components/spec-explorer/change-request-actions.tsx`
- Tests: `tests/unit/features/spec/review-flow-tasks-dispatch.test.ts`, `tests/integration/spec-explorer/review-flow.test.ts`

---

## State Transitions (FSM)

### Specification Status

```text
current → review → reopened → review → archived
   ↑                       ↓        ↑
   └──────────────┬────────┘        └─(unarchive, rare)
                  └───────> archived
```

- **current|reopened → review**: Send to Review after tasks/checklists reach zero (US1/US3).
- **review → reopened**: Change request created (US2).
- **reopened → review**: All change requests addressed + all tasks done (US3).
- **review → archived**: Reviewer clicks Send to Archived with no blockers (US4).
- **archived → reopened**: Explicit unarchive when a blocker is discovered post-archive.

### Change Request Status

```text
open → blocked (retry) → inProgress → addressed
   ↓
addressed → open (if reviewer reopens before archiving)
```

- **open → blocked**: Tasks prompt fails/offline (US3 failure path)
- **open → inProgress**: Tasks successfully created (US3 success path)
- **blocked → inProgress**: Retry succeeds (US3 retry)
- **inProgress → addressed**: All linked tasks completed (US3)
- **addressed → open**: Reviewer reopens request if Review fails prior to archiving.

### Task Status

```text
open → inProgress → done
```

## SpecExplorer Lane Structure

### Current Specs

- All specs with `status = current` or `status = reopened`
- Shows specs actively being worked on

### Review

- Specs with `status = review`
- All Send to Review buttons originate from Current/Reopened specs
- Review lane surfaces gating reasons for Send to Archived button

### Archived

- Specs with `status = archived`
- Read-only list with metadata and audit trail links

### Workflow 4: Archive reviewed spec (US3 in spec ordering)

**As a reviewer**, I want to archive a spec once I verify all change requests are addressed so the Review lane stays small.

1. Open a spec inside the Review lane.
2. Check the **Send to Archived** button:
   - Disabled if any change requests remain open/blocked/inProgress or if new tasks/checklist items appeared.
   - Tooltip lists blockers (change request titles, counts).
3. Once all blockers clear, click **Send to Archived**.
4. **Result**:
   - Spec status `review` → `archived`.
   - Spec disappears from Review and moves to Archived view.
   - `archivedAt` timestamp set; telemetry records completion.
   - Archived entry is read-only; unarchive command available only to maintainers for regressions.

**Implementation files:**

- State: `src/features/spec/review-flow/state.ts` (`canArchive`, `archiveSpec`)
- UI: `ui/src/components/spec-explorer/review-list/archive-button.tsx`
- Lane/View: `ui/src/components/spec-explorer/archived-list.tsx`
- Tests: `tests/unit/features/spec/review-flow-archive.test.ts`, `tests/integration/spec-explorer/archive-flow.test.ts`
- Reopened specs display linked change request count badge

### Changes

- All active change requests grouped by spec
- Filters: `status in {open, blocked, inProgress}`
- Shows:
  - Change request title, description, severity
  - Linked spec reference
  - Task count and completion status
  - Action buttons: Dispatch, Retry (if blocked)
  - Status badges: In Progress (N tasks), Addressed

## Testing Guide

### Unit Tests (34 passing)

1. **Status Transitions** (`review-flow-status.test.ts`):
   - Valid FSM transitions (current → review → reopened)
   - Invalid transition rejection
   - Metadata preservation (completedAt, owner)

2. **Change Requests** (`review-flow-change-requests.test.ts`):
   - Creation with duplicate detection
   - Spec reopening on change request
   - Multiple concurrent change requests

3. **Tasks Dispatch** (`review-flow-tasks-dispatch.test.ts`):
   - Payload builder with all severity levels
   - Success path: task attachment
   - Failure path: blocked status
   - Retry from blocked state
   - Task linkage and completion detection

### Integration Tests (6 passing)

**Full Cycle Test** (`review-flow.test.ts`):

- Dispatch → tasks created → tasks completed → spec returns to Review
- Multiple change requests before returning
- Incomplete tasks keep spec reopened
- Tasks prompt failure with successful retry

### Running Tests

```bash
# All review flow tests
npm test -- review-flow

# Specific test file
npm test -- review-flow-status.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Telemetry Events

The review flow emits telemetry at key transition points:

1. **Spec Status Changes**:

   ```json
   {
     "type": "spec.status.changed",
     "specId": "spec-001",
    "fromStatus": "current",
    "toStatus": "review",
     "timestamp": "2025-12-07T10:00:00Z"
   }
   ```

2. **Change Request Created**:

   ```json
   {
     "type": "change_request.created",
     "specId": "spec-001",
     "changeRequestId": "cr-001",
     "severity": "high",
     "titleLength": 25,
     "submitter": "reviewer@example.com",
     "timestamp": "2025-12-07T11:00:00Z"
   }
   ```

3. **Change Request Status Changes**:

   ```json
   {
     "type": "change_request.status.changed",
     "changeRequestId": "cr-001",
     "fromStatus": "open",
     "toStatus": "inProgress",
     "timestamp": "2025-12-07T12:00:00Z"
   }
   ```

## Manual Validation Checklist

- [ ] Complete a spec → appears in Review with metadata
- [ ] File change request → spec moves to reopened, CR shows in Changes
- [ ] Verify duplicate detection prevents same-title change requests
- [ ] Dispatch change request → tasks attached, status = inProgress
- [ ] Simulate tasks prompt failure → status = blocked, retry button appears
- [ ] Retry blocked change request → status = inProgress, tasks attached
- [ ] Mark all tasks done → change request = addressed, spec returns to Review
- [ ] Archive spec → disappears from Review, appears in Archived
- [ ] Verify telemetry events emitted at each transition

## Architecture Notes

### Persistence Strategy

- **State Storage**: `.vscode/gatomia/spec-review-state.json`
- **Structure**: `{ specStates: { [specId]: Specification } }`
- **In-Memory Cache**: `Map<string, Specification>` synced with workspace storage
- **Load Strategy**: Lazy load on first access, persist after mutations

### Messaging Protocol (Extension ↔ Webview)

**From Webview to Extension**:

- `changeRequest:submit` - Create new change request
- `changes:fetch` - Request active change requests
- `changeRequest:dispatch` - Dispatch to tasks prompt
- `changeRequest:retry` - Retry blocked change request

**From Extension to Webview**:

- `changes:updated` - Change requests list updated
- `spec:statusChanged` - Spec moved between lanes
- `error` - Operation failed (with retry guidance)

### Performance Considerations

- UI status transitions: < 2 seconds (SC-001)
- Tasks prompt roundtrip: ≤ 2 minutes (SC-003)
- Duplicate detection: O(n) where n = open change requests per spec (typically < 10)

## Troubleshooting

### Change request not appearing in Changes lane

- Check spec status is `reopened`
- Verify change request status is not `addressed`
- Check webview messaging connection

### Tasks prompt dispatch fails

- Verify tasks prompt service is running
- Check network connectivity
- Use retry button when service is restored
- Check telemetry logs for error details

### Spec not returning to Review

- Verify all change requests are `addressed`
- Verify all tasks in all change requests are `done`
- Check `shouldReturnToReview()` logic in state.ts

## Next Steps

- Integrate with real tasks prompt API (replace mock in `tasks-dispatch.ts`)
- Add UI for task status updates (currently manual in state)
- Implement webview messaging for real-time updates
- Add persistence for reopened specs across extension reloads
