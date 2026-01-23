# Data Model: Automatic Review Transition

## Entities

### Specification
- **id** (string, required): Stable identifier used across extension, provider, and telemetry.
- **title** (string, required): Display label shown in Spec Explorer and notifications.
- **owner** (string, required): Copilot user responsible for the spec; used for auditing.
- **status** (`current | review | reopened | archived`, required): Review-flow finite state; legacy `readyToReview` is normalized to `review` inside `state.ts`.
- **pendingTasks** (number ≥ 0, default 0): Count of tarefas still abertas/inProgress linked to the spec; drives eligibility checks.
- **pendingChecklistItems** (number ≥ 0, default 0): Count of checklist blockers surfaced by Spec Explorer.
- **completedAt** (Date|null): Timestamp when last tarefa was concluída; used for SLA tracking.
- **reviewEnteredAt** (Date|null): Timestamp recorded when spec enters Review, whether automatic or manual.
- **updatedAt** (Date, required): Last mutation timestamp; triggers provider refresh.
- **changeRequests** (`ChangeRequest[]`, optional): Reviewer feedback plus task links.
- **watchers** (`string[]`, optional): Emails/usernames that must be alerted when Review transitions fire (populated from Spec Explorer metadata if available).

**Relationships & Derivations**:
- `Specification` aggregates multiple `TaskLink` records indirectly through `changeRequests.tasks`.
- `reviewEligible` is a derived boolean computed as `(status in {current,reopened}) && pendingTasks === 0 && pendingChecklistItems === 0`.
- `notificationAudience = {owner} ∪ reviewers ∪ watchers`; stored alongside telemetry for FR-008.

### TaskLink
- **taskId** (string, required): Identifier matching MCP/task tracker.
- **status** (`open | inProgress | done`, required): Drives `pendingTasks` summarization.
- **createdAt** (Date, required) / **updatedAt** (Date, required): Audit fields.
- **source** (enum, currently `tasksPrompt`): Where the task originated.

### ChangeRequest
- **id** (string, required)
- **specId** (string, foreign key → Specification.id)
- **status** (`open | blocked | inProgress | addressed`, required)
- **severity** (`low | medium | high | critical`)
- **tasks** (`TaskLink[]`)
- **archivalBlocker** (boolean): Prevents archival when true.

### ReviewTransitionEvent (new persisted log/telemetry payload)
- **eventId** (string)
- **specId** (string)
- **triggerType** (`auto | manual`)
- **initiatedBy** (string, optional for auto)
- **occurredAt** (Date)
- **notificationRecipients** (`string[]`)
- **status** (`succeeded | failed`)
- **failureReason** (string | null)

## State Transitions

1. **Current → Review (automatic)**
   - Preconditions: `reviewEligible === true` AND `status === current`.
   - Action: call `sendToReview` internally, set `reviewEnteredAt = now`, emit `ReviewTransitionEvent` with `triggerType=auto`, notify audience, refresh provider/webview.

2. **Current/Reopened → Review (manual command)**
   - Preconditions: `canSendToReview` returns `canSend`.
   - Action: same mutation path as automatic but `triggerType=manual` and `initiatedBy = vscode.window.activeTextEditor?.id ?? command context`.

3. **Review → Current/Reopened (task reopened)**
   - Triggered when `pendingTasks` or `pendingChecklistItems` increments above zero or a change request reopens.
   - Action: remove from Review tab, revert status to `current` (or `reopened` if change requests exist), log transition + watcher notification describing why it left Review.

4. **Review → Archived**
   - Unaffected by this feature but remains dependent on `pendingTasks` = `0`, `pendingChecklistItems` = `0`, and no blocking change requests.

## Validation Rules
- Counts must never be negative; `updatePendingSummary` clamps values via `Math.max(0, count)`.
- Concurrent triggers must honor idempotency: transitions ignore if spec already `review` and log a duplicate warning.
- Notification recipients list must be deduplicated before dispatch and capped to avoid UI flooding (e.g., limit to 10 names + “+N more”).
- Transition events require telemetry emission before provider refresh to satisfy observability mandates.
