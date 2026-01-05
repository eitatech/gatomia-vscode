# Research: Automatic Review Transition

## Decision 1: Event-driven eligibility checks inside review-flow state
- **Decision**: Extend `src/features/spec/review-flow/state.ts` with an auto-review evaluator that listens to `_onReviewFlowStateChange` and pending-task summary updates, triggering `canSendToReview` → `sendToReview` plus telemetry when a spec first meets the zero-pending gate.
- **Rationale**: The state layer already centralizes persistence and exposes `EventEmitter` hooks; running eligibility there avoids duplicated logic in UI/providers and keeps the FSM authoritative about transitions.
- **Alternatives considered**: (a) Polling timer from the extension entry point—simpler to wire but wastes cycles and risks race conditions; (b) Performing checks inside the webview store—would miss automation when UI is closed and violates single-source-of-truth for statuses.

## Decision 2: Notification delivery via existing NotificationUtils + review-alert topic metadata
- **Decision**: Surface watcher/reviewer alerts from the extension command handler by reusing `NotificationUtils` (already used by `spec-manager`) while tagging telemetry with `triggerType: "auto" | "manual"` so downstream alert routing (e.g., chat ops) can fan-out to watchers.
- **Rationale**: Keeps messaging within established VS Code notification UX while leveraging telemetry/log streams for broader alert dissemination without inventing a new channel.
- **Alternatives considered**: (a) Creating a dedicated status bar widget—adds persistent UI noise and still requires notifications; (b) Sending alerts solely through telemetry—provides no immediate feedback inside VS Code and fails SC-002 expectations.

## Decision 3: Provider/UI refresh through existing SpecExplorer signals
- **Decision**: Use `onReviewFlowStateChange` plus the `SpecExplorerProvider` refresh callback that already powers manual transitions, ensuring both the VS Code tree and React webview respond to automatic transitions without manual reload.
- **Rationale**: Provider + webview already subscribe to review-flow events; pushing refreshes from the same emitter minimizes new plumbing and maintains the <10s SLA.
- **Alternatives considered**: (a) Broadcasting bespoke VS Code notifications to trigger refresh—duplicates provider logic; (b) Relying on webview polling—reduces responsiveness and introduces extra timers.
