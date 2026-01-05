# Data Model - Spec Explorer review flow

## Entities

### Specification

- `id`: string (unique; derived from spec path or GUID)
- `title`: string
- `owner`: string
- `status`: enum `current | review | reopened | archived`
- `completedAt`: datetime | null (set when first moved to Review)
- `reviewEnteredAt`: datetime | null
- `archivedAt`: datetime | null
- `updatedAt`: datetime
- `links`: { `specPath`: string, `docUrl?`: string }
- `pendingTasks`: number
- `pendingChecklistItems`: number
- `changeRequests`: ChangeRequest[] (linked by `specId`)

### ChangeRequest

- `id`: string (unique per spec)
- `specId`: string (FK → Specification.id)
- `title`: string
- `description`: string
- `severity`: enum `low | medium | high | critical`
- `status`: enum `open | blocked | inProgress | addressed`
- `tasks`: TaskLink[]
- `submitter`: string
- `createdAt`: datetime
- `updatedAt`: datetime
- `sentToTasksAt`: datetime | null
- `notes?`: string
- `archivalBlocker`: boolean (derived; true when request prevents archiving)

### TaskLink

- `taskId`: string
- `source`: enum `tasksPrompt`
- `status`: enum `open | inProgress | done`
- `createdAt`: datetime

## Relationships

- Specification 1—N ChangeRequest (via `specId`).
- ChangeRequest 1—N TaskLink (tasks generated from the tasks prompt).

## State Transitions

- Specification:
  - `current` → `review` when Send to Review succeeds (requires `pendingTasks = 0` and `pendingChecklistItems = 0`).
  - `review` → `reopened` when a change request is created or reopened.
  - `reopened` → `review` when all linked change requests are `addressed`, `pendingTasks = 0`, and `pendingChecklistItems = 0`.
  - `review` → `archived` when reviewer triggers Send to Archived and no blockers remain.
  - `archived` → `reopened` only via explicit unarchive action (rare admin tooling) to handle post-archive blockers.
- ChangeRequest:
  - `open` → `blocked` when tasks prompt call fails/offline.
  - `open` → `inProgress` when tasks are created.
  - `inProgress` → `addressed` when all linked tasks are `done`.
  - `addressed` → `open` if reviewer reopens the request prior to archiving.

## Validation Rules

- `(specId, normalized title)` MUST be unique for open change requests.
- Severity required on creation.
- `status` transitions must follow the FSM above; invalid transitions rejected.
- `pendingTasks` and `pendingChecklistItems` are non-negative integers derived from linked tasks/checklist; Send to Review allowed only when both are zero.
- Archiving requires `status = review`, zero pending tasks/checklist items, and zero change requests with `archivalBlocker = true`.
- `tasks` must include `taskId` and `status` when attached.

## Derived Views

- **Current Specs**: specs with `status in {current, reopened}`.
- **Review**: specs with `status = review`.
- **Archived**: specs with `status = archived` (read-only list).
- **Changes**: change requests grouped by spec where `status in {open, blocked, inProgress}` with associated task/status metadata and `archivalBlocker`.
