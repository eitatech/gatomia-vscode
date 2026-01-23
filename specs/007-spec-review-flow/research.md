# Research - Spec Explorer review flow

## Findings

### Spec state source and mutation surface

- **Decision**: Reuse the existing SpecExplorer spec state service as the source of truth, extending it with statuses `current`, `readyToReview`, and `reopened`; persist transitions using the same workspace-backed storage the feature already employs (no new storage layer).
- **Rationale**: Keeps a single authority for spec status, avoids duplicating state between extension and webview, and reduces migration risk.
- **Alternatives considered**: Introduce a dedicated status file per spec (adds drift risk); add a remote backing service (overkill and out of scope).

### Change request persistence

- **Decision**: Store change requests alongside spec metadata in the SpecExplorer state store, serializing to the existing persistence path so change requests survive reloads and can be rehydrated by both extension and webview.
- **Rationale**: Aligns lifecycle with specs, enables offline-friendly reloads, and avoids introducing a new persistence mechanism.
- **Alternatives considered**: Separate storage (e.g., new JSON file or remote DB) which increases complexity and divergence; volatile in-memory-only storage that loses reviewer inputs.

### Tasks prompt payload and invocation

- **Decision**: Send a structured payload to the tasks prompt containing spec id/title/path, changeRequestId/title/description/severity, submitter, and requested outcomes; include a `context` block with links to spec and change request. Await prompt response to attach returned task identifiers to the originating change request.
- **Rationale**: Provides sufficient context for task generation without extra lookups; keeps linkage for traceability when tasks are created.
- **Alternatives considered**: Free-form text payload (harder to automate and link tasks); multiple sequential calls (higher latency, more failure points).

### Offline or prompt-failure handling

- **Decision**: If the tasks prompt call fails or is offline, keep the change request in `open` with status `blocked`, surface an actionable error/toast, and allow retry from the Changes lane without losing form inputs.
- **Rationale**: Preserves reviewer effort, makes failure visible, and avoids silent drops that would desync spec state.
- **Alternatives considered**: Silent retry queue (opaque to users); auto-close change request on failure (loses signal and breaks workflow).

### Duplicate detection policy

- **Decision**: Enforce uniqueness on `(specId, normalized change request title)` at creation time; if a match exists, show the existing item instead of creating a duplicate, while allowing edits to the existing request.
- **Rationale**: Prevents noisy duplicates and matches the spec requirement to avoid duplicate open change requests.
- **Alternatives considered**: Allow duplicates and rely on manual triage; fuzzy matching that risks false positives without added benefit here.

### Send to Review gating source

- **Decision**: Gate the Send to Review button using aggregated task/checklist completion data already tracked in the spec state service; no new queries when rendering the UI.
- **Rationale**: Keeps enablement logic deterministic, enables near-real-time UI updates, and avoids additional prompt/service calls.
- **Alternatives considered**: Ask reviewers to self-confirm readiness (manual errors), or poll the tasks prompt on-demand (adds latency and network coupling).

### Archived representation

- **Decision**: Add an `archived` status plus an Archived lane/folder that is read-only, filtering these specs from Current Specs and Review lists.
- **Rationale**: Satisfies the requirement to keep Review lists short while preserving access to historical specs; status-based approach matches existing FSM.
- **Alternatives considered**: Moving files to a different workspace directory (breaks references), or tagging specs without dedicated lane (still clutters Review).

### Telemetry coverage

- **Decision**: Emit structured telemetry events for Send to Review, Send to Archived, reopen-from-change-request, and archive failures, logging duration from action to status change.
- **Rationale**: Constitution mandates observability and success criteria rely on measuring throughput/time; telemetry provides dashboards and alerting.
- **Alternatives considered**: Debug logs only (insufficient for metrics), or manual Excel tracking (labor-intensive, error-prone).
