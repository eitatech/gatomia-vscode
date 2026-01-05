# Quickstart: Automatic Review Transition

1. **Set up workspace**
   - `npm run install:all`
   - `npm run build` (ensures extension + webview bundles up to date)

2. **Implement auto-transition evaluator**
   - Extend `src/features/spec/review-flow/state.ts` with `_autoSendToReview` and `initializeAutoReviewTransitions`, wiring evaluator calls from pending-summary updates.
   - Emit `review.transition` telemetry and send review-alert notifications when auto transitions succeed.
   - On persistence failure, surface a warning, enqueue the spec for retry, and log the failed transition.

3. **Wire manual action enhancements**
   - Update `handleSendToReview` in `src/features/spec/review-flow/commands/send-to-review-command.ts` to call the shared helper, guard against duplicate triggers, and emit notifications via `NotificationUtils`.
   - Ensure `ui/src/components/spec-explorer/review-list/send-to-review-button.tsx` handles disabled/loading states that reflect networked command execution.

4. **Refreshing and notifications**
   - Use the existing `SpecExplorerProvider` refresh callback plus `onReviewFlowStateChange` subscriptions to reload the VS Code tree + React store inside 10 seconds.
   - Extend telemetry payloads in `src/features/spec/review-flow/telemetry.ts` with `triggerType`, `notificationRecipients`, and `deliveryStatus`.
   - When tasks or checklist items reopen, revert specs out of Review and log `review.left` telemetry plus a user-facing warning.

5. **Testing**
   - Unit: `npm test -- tests/unit/features/spec/review-flow-send-to-review.test.ts`
   - UI: `npm test -- tests/unit/webview/spec-explorer/send-to-review-button.test.tsx`
   - Integration: `npm test -- tests/integration/spec-explorer/send-to-review-flow.test.ts`
   - Add new specs for auto evaluator timing + duplicate/manual commands.

6. **Validation**
   - Manual smoke: create sample specs, toggle tarefas to verify automatic Review appearance, confirm watchers receive notifications, and reopen a tarefa to ensure the spec leaves Review immediately.
   - Track SC-003 by monitoring `review.transition` failure counts and any review-left events; annotate release notes if new error classes appear.
   - Run `npm run check` before marking the plan complete.
