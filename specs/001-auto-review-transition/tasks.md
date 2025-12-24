# Tasks: Automatic Review Transition

**Input**: Design documents from `/specs/001-auto-review-transition/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Constitution enforces TDD, so each user story contains explicit test tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare workspace tooling so review-flow updates can build and test cleanly.

- [X] T001 Validate dependency tree by running `npm run install:all` at repository root
- [X] T002 Build extension + webview bundles via `npm run build` to surface existing issues before coding
- [X] T003 Execute baseline suites with `npm test` and `npm run check` to record current failures

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data + telemetry scaffolding required by every story.

- [X] T004 Persist `watchers` metadata inside `src/features/spec/review-flow/storage.ts` and `state.ts` so notifications know the audience
- [X] T005 Introduce `ReviewTransitionEvent` interfaces and TypeScript types in `src/features/spec/review-flow/types.ts`
- [X] T006 Extend contract schema `specs/001-auto-review-transition/contracts/review-flow.yaml` to include telemetry + notification fields and regenerate any derived typings
- [X] T007 Add reusable review-alert helper around `NotificationUtils` in `src/utils/notification-utils.ts` for both auto and manual triggers

**Checkpoint**: Foundation ready — user story phases may now execute.

---

## Phase 3: User Story 1 – Auto move when work is done (Priority: P1) 🎯 MVP

**Goal**: Automatically move a spec to Review when every tarefa is concluída.

**Independent Test**: Close every tarefa for a sample spec; confirm it appears in the Review tab within 10 seconds and telemetry records an auto trigger.

### Tests (write first)

- [X] T008 [P] [US1] Create auto-transition unit tests in `tests/unit/features/spec/review-flow-auto-transition.test.ts`
- [X] T009 [P] [US1] Add auto-notification unit tests in `tests/unit/features/spec/review-flow-auto-transition.test.ts`
- [X] T010 [P] [US1] Add integration test ensuring Review tab refresh within 10 seconds in `tests/integration/spec-explorer/auto-review-transition.test.ts`
- [X] T011 [P] [US1] Add failure scenario test when transition persistence fails in `tests/unit/features/spec/review-flow-auto-transition.test.ts`

### Implementation

- [X] T012 [US1] Implement `_autoSendToReview` evaluator & subscriptions in `src/features/spec/review-flow/state.ts`
- [X] T013 [US1] Hook evaluator bootstrapping into `src/extension.ts` so it starts with the extension lifecycle
- [X] T014 [US1] Ensure `src/providers/spec-explorer-provider.ts` reacts to auto state changes without manual refresh
- [X] T015 [US1] Emit telemetry + ReviewTransitionEvent records (auto) in `src/features/spec/review-flow/telemetry.ts`
- [X] T016 [US1] Send review-alert notifications for auto transitions in `src/features/spec/review-flow/state.ts`
- [X] T017 [US1] Handle persistence failure with user-visible error + retry signal in `src/features/spec/review-flow/state.ts`

**Checkpoint**: Specs auto-transition once tasks hit zero and reviewers see them instantly.

---

## Phase 4: User Story 2 – Manual “Send to review” action (Priority: P2)

**Goal**: Guarantee the context action mirrors the auto flow, prevents duplicates, and notifies watchers.

**Independent Test**: From Spec Explorer, right-click “Send to review” on an eligible spec; confirm success banner, Review tab update, telemetry entry (`triggerType=manual`), and watcher notification.

### Tests (write first)

- [X] T018 [P] [US2] Expand command tests covering duplicate prevention + telemetry in `tests/unit/features/spec/review-flow-send-to-review.test.ts`
- [X] T019 [P] [US2] Update React button tests for loading/disabled states in `tests/unit/webview/spec-explorer/send-to-review-button.test.tsx`

### Implementation

- [X] T020 [US2] Refactor `src/features/spec/review-flow/commands/send-to-review-command.ts` to call shared evaluator + block duplicates
- [X] T021 [US2] Invoke review-alert helper so manual triggers notify watchers with initiator info
- [X] T022 [US2] Update `ui/src/components/spec-explorer/review-list/send-to-review-button.tsx` to surface loading, success, and duplicate feedback
- [X] T023 [US2] Ensure `src/providers/spec-explorer-provider.ts` refreshes tree view immediately after manual send
- [X] T024 [US2] Record manual ReviewTransitionEvent details (initiatedBy, blockers) inside `src/features/spec/review-flow/telemetry.ts`

**Checkpoint**: Manual send matches automation behavior and provides clear user feedback.

---

## Phase 5: User Story 3 – Consistent status handling (Priority: P3)

**Goal**: Remove specs from Review when tarefas reabrem and broadcast the change.

**Independent Test**: After a spec sits in Review, reopen qualquer tarefa; confirm the spec disappears from Review, status reverts, and stakeholders are notified.

### Tests (write first)

- [X] T025 [P] [US3] Add regression cases for reopened tarefa handling in `tests/unit/features/spec/review-flow-state.test.ts`
- [X] T026 [P] [US3] Create integration test verifying Review tab removal in `tests/integration/spec-explorer/reopen-flow.test.ts`

### Implementation

- [X] T027 [US3] Update `src/features/spec/review-flow/state.ts` to detect reopened tarefas and revert status automatically
- [X] T028 [US3] Emit “left review” telemetry + notifications when statuses change in `src/features/spec/review-flow/telemetry.ts`
- [X] T029 [US3] Surface UI cues for specs returning to execution columns inside `ui/src/components/spec-explorer/review-list/*`
- [X] T030 [US3] Document removal reasons in provider tooltips (`src/providers/spec-explorer-provider.ts`) to guide coordinators

**Checkpoint**: Review tab only shows ready specs; reopened work reverts instantly with traceable logs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide refinements after primary stories.

- [X] T031 [P] Document new flows plus manual smoke steps in `specs/001-auto-review-transition/quickstart.md`
- [X] T032 Verify contracts + telemetry docs align with implementation in `specs/001-auto-review-transition/contracts/review-flow.yaml`
- [X] T033 [P] Perform final accessibility + copy review for Review tab strings in `ui/src/components/spec-explorer/review-list/`
- [X] T034 [P] Add SC-003 monitoring guidance and failure-reason telemetry notes in `specs/001-auto-review-transition/quickstart.md`
- [X] T035 Run full `npm test`, `npm run check`, and record pass results before handoff

---

## Dependencies & Execution Order

1. **Setup (Phase 1)** → completes before any coding.
2. **Foundational (Phase 2)** → depends on Setup; blocks all user stories.
3. **User Story Phases** → start in priority order (US1 → US2 → US3) once Phase 2 completes; individual tasks marked [P] can run concurrently when files do not overlap.
4. **Polish (Phase 6)** → runs after targeted user stories reach their checkpoints.

## Parallel Execution Examples

- **US1**: T008–T011 can execute concurrently while implementation tasks wait for test scaffolding; T013–T016 touch different files and can proceed in parallel after T012.
- **US2**: T018 and T019 run simultaneously; T020 (command refactor) and T022 (UI update) can proceed in parallel once shared helper signatures are finalized.
- **US3**: T025 and T026 cover separate suites; T027 (state) and T029 (UI) may proceed concurrently after agreeing on new status events.

## Implementation Strategy

- **MVP Scope**: Complete User Story 1 (auto transitions) to deliver immediate reviewer value; release once telemetry confirms stability.
- **Incremental Delivery**: After MVP, roll out US2 (manual parity) to close workflow gaps, then US3 (reopen consistency) to harden the pipeline. Keep telemetry + notifications feature-flagged if staged rollout desired.
