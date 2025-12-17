# Project Consistency Analysis: Spec Explorer review flow (001-spec-review-flow)

**Date**: 2025-12-07  
**Feature Branch**: `001-spec-review-flow`  
**Analysis Scope**: spec.md, plan.md, data-model.md, contracts/, research.md, quickstart.md, tasks.md

---

## Executive Summary

✅ **CONSISTENCY: PASS** — All core artifacts align on entities, statuses, flows, and implementation order.

- **Terminology**: Consistent across spec, data model, and contracts (Current Specs, Ready to Review, Reopened, Changes, ChangeRequest, TaskLink).
- **Status FSM**: Unified state transitions defined and replicated across spec (FR-007/FR-008), data-model (State Transitions), contracts (enums), and tasks (T004).
- **Requirements → Tasks mapping**: All 11 FRs covered by at least one task; acceptance scenarios drive test design (T008–T009, T014–T015, T021–T022).
- **File paths**: Consistent with project structure (src/features/spec/review-flow, webview-ui/src/components/spec-explorer, tests/).

### Issues Found: 0 critical, 0 high, 1 low

---

## Detailed Cross-Artifact Analysis

### 1. Entity Definitions (Spec ↔ Data Model ↔ Contracts)

| Entity | Spec §Key Entities | Data Model | Contracts | Status |
|--------|-------------------|-----------|-----------|--------|
| Specification | ✅ Defined | ✅ Fields: id, title, owner, status, completedAt, updatedAt, links, changeRequests | ✅ OpenAPI Specification schema with status enum [current, readyToReview, reopened] | **CONSISTENT** |
| ChangeRequest | ✅ Defined | ✅ Fields: id, specId, title, description, severity, status, tasks, submitter, createdAt, updatedAt, sentToTasksAt, notes | ✅ OpenAPI ChangeRequest schema with status enum [open, blocked, inProgress, addressed] | **CONSISTENT** |
| TaskLink | ✅ Implied (spec §FR-005 §FR-006) | ✅ Fields: taskId, source, status, createdAt | ✅ OpenAPI TaskLink schema with status enum [open, inProgress, done] | **CONSISTENT** |

**Findings**: All three entities are fully specified across all three artifacts. No field mismatches or schema divergence detected.

### 2. Status Transitions (Spec ↔ Data Model ↔ Tasks)

#### Specification Status FSM

| Transition | Spec Requirement | Data Model | Tasks | Status |
|------------|------------------|-----------|-------|--------|
| current → readyToReview | FR-001 "marked completed" | "when spec marked completed" | T010 "transition + completedAt" | ✅ **ALIGNED** |
| readyToReview → reopened | FR-007 "change request submission" | "when a change request is created" | T016 "change request creation service" + spec status update | ✅ **ALIGNED** |
| reopened → readyToReview | FR-008 "all tasks completed" | "all change requests addressed + all tasks done" | T025 "auto-move when all tasks done" | ✅ **ALIGNED** |

#### ChangeRequest Status FSM

| Transition | Spec Requirement | Data Model | Tasks | Status |
|------------|------------------|-----------|-------|--------|
| open → blocked | FR-? (implied error path) | "tasks prompt call fails/offline" | T023 "failure handling + blocked" | ✅ **ALIGNED** |
| open → inProgress | FR-006 "tasks created" | "when tasks are created" | T024 "attach returned tasks" | ✅ **ALIGNED** |
| inProgress → addressed | FR-008 "linked tasks done" | "all linked tasks done" | T025 "task completion detection" | ✅ **ALIGNED** |

**Findings**: All state transitions are documented, non-contradictory, and fully traced through tasks.

### 3. Requirements to Tasks Coverage

**Total FRs**: 11 (FR-001 through FR-011)  
**Total Tasks**: 29 (T001–T029)

| FR | Requirement Summary | Mapped Tasks | Coverage |
|----|-------------------|--------------|----------|
| FR-001 | Completed spec → Ready to Review | T010, T011, T012 | ✅ **FULL** (state + provider + UI) |
| FR-002 | Ready to Review filter exclusivity | T012, T018 | ✅ **FULL** (UI + tests) |
| FR-003 | Change request form + fields | T017, T014–T015 | ✅ **FULL** (form + tests) |
| FR-004 | Changes lane display + spec link | T018, T019 | ✅ **FULL** (UI + messaging) |
| FR-005 | Dispatch button + structured payload | T026, T023 | ✅ **FULL** (UI + payload builder) |
| FR-006 | Task creation + linkage | T024, T021 | ✅ **FULL** (state + tests) |
| FR-007 | Reopen on change request | T016, T019 | ✅ **FULL** (service + messaging) |
| FR-008 | Return to Ready to Review | T025, T022 | ✅ **FULL** (state + integration test) |
| FR-009 | Log transitions | T006, T013, T020, T028 | ✅ **FULL** (telemetry layer + tasks) |
| FR-010 | Prevent/display duplicates | T005, T014 | ✅ **FULL** (duplicate guard + tests) |
| FR-011 | Allow concurrent change requests | T004, T016 | ✅ **FULL** (state persistence + service) |

**Findings**: 100% FR coverage. No requirement orphaned.

### 4. User Story → Task Mapping

| User Story | Priority | Test Tasks | Implementation Tasks | Status |
|------------|----------|-----------|----------------------|--------|
| US1: Move to review | P1 | T008–T009 | T010–T013 | ✅ **MAPPED** |
| US2: File change request | P2 | T014–T015 | T016–T020 | ✅ **MAPPED** |
| US3: Generate tasks + reopen | P3 | T021–T022 | T023–T026 | ✅ **MAPPED** |

**Findings**: All three stories have corresponding test and implementation tasks. Phase ordering (US1 → US2 → US3) respects dependencies.

### 5. Acceptance Scenarios → Tests

| User Story | Acceptance Scenario | Test Task | Status |
|------------|-------------------|-----------|--------|
| US1 | Spec appears in Ready to Review after completion | T008, T009 | ✅ **COVERED** |
| US1 | Spec not in Current Specs after move | T008, T009 | ✅ **COVERED** |
| US2 | Change request created with description/severity | T014, T015 | ✅ **COVERED** |
| US2 | Change request displays spec reference | T015 | ✅ **COVERED** |
| US3 | Tasks created and linked on dispatch | T021, T022 | ✅ **COVERED** |
| US3 | Spec returns to Ready to Review after tasks done | T022 | ✅ **COVERED** |

**Findings**: All 6 acceptance scenarios mapped to test tasks.

### 6. Data Model Validation Rules → Tasks

| Validation Rule | Data Model | Test Task | Implementation Task | Status |
|-----------------|-----------|-----------|-------|--------|
| (specId, normalized title) uniqueness | ✅ Defined | T014 | T005, T016 | ✅ **COVERED** |
| Severity required | ✅ Defined | T014 | T017 | ✅ **COVERED** |
| Status FSM enforcement | ✅ Defined | T008, T014, T021 | T004, T010, T016, T024 | ✅ **COVERED** |

**Findings**: All validation rules covered by tests and implementation tasks.

### 7. File Path & Structure Consistency

**Project Structure (from Plan)**:
```
src/features/spec/review-flow/         # State + services
webview-ui/src/components/spec-explorer/  # UI
tests/unit/features/spec/              # Unit tests
tests/integration/spec-explorer/       # Integration tests
```

**Referenced in Tasks**:
- `src/features/spec/review-flow/types.ts` (T003)
- `src/features/spec/review-flow/state.ts` (T004, T010, T024, T025)
- `src/features/spec/review-flow/duplicate-guard.ts` (T005)
- `src/features/spec/review-flow/telemetry.ts` (T006, T013, T020, T028)
- `webview-ui/src/components/spec-explorer/ReadyToReviewList.tsx` (T012)
- `tests/unit/features/spec/review-flow-status.test.ts` (T008)
- `tests/integration/spec-explorer/review-flow.test.ts` (T022)

**Findings**: All paths align with planned structure. Naming follows kebab-case convention per constitution.

### 8. Dependencies & Phases

| Phase | Tasks | Blocking | Depends On | Status |
|-------|-------|----------|-----------|--------|
| 1: Setup | T001–T002 | None | N/A | ✅ **CAN START IMMEDIATELY** |
| 2: Foundational | T003–T007 | Yes (blocks all stories) | Phase 1 | ✅ **SEQUENTIAL GATE** |
| 3: US1 | T008–T013 | No | Phase 2 | ✅ **CAN PARALLEL WITH US2/US3 AFTER PHASE 2** |
| 4: US2 | T014–T020 | No | Phase 2 (+ optionally US1 for reuse) | ✅ **CAN PARALLEL WITH US1/US3 AFTER PHASE 2** |
| 5: US3 | T021–T026 | No | Phase 2 | ✅ **CAN PARALLEL WITH US1/US2 AFTER PHASE 2** |
| 6: Polish | T027–T029 | No | All user stories | ✅ **FINAL PHASE** |

**Findings**: Dependencies are well-defined and unambiguous. No circular dependencies. Parallel opportunities clearly marked [P].

### 9. Test-First Discipline (Constitution §III)

**Constitution Requirement**: "Tests MUST be written and approved BEFORE implementation begins."

| Phase | Test Tasks | Implementation Tasks | Order | Status |
|-------|-----------|----------------------|-------|--------|
| US1 | T008–T009 | T010–T013 | Tests first | ✅ **ALIGNED** |
| US2 | T014–T015 | T016–T020 | Tests first | ✅ **ALIGNED** |
| US3 | T021–T022 | T023–T026 | Tests first | ✅ **ALIGNED** |

**Findings**: Test-first ordering is explicit in task numbering and phase descriptions. Tests are listed before implementations within each user story.

### 10. Observability & Telemetry (Constitution §IV)

| Dimension | Spec Coverage | Data Model | Tasks | Status |
|-----------|---------------|-----------|-------|--------|
| Status transitions (FR-009) | ✅ Explicit requirement | ✅ Implicit in FSM | T006, T013, T020, T028 | ✅ **COVERED** |
| Change request creation | ✅ Implicit in user journey | ✅ Timestamps present | T020 | ✅ **COVERED** |
| Task dispatch outcomes | ✅ Success/failure paths in research | ✅ TaskLink states | T023 (success), T023 (failure/blocked) | ✅ **COVERED** |

**Findings**: Telemetry requirements are defined across spec and research; tasks explicitly call out a dedicated telemetry layer (T006) and emit points (T013, T020, T028).

---

## Issues & Findings

### 🟢 Non-Issues (Clarified by Research)

1. **"Where do specs store status?" (Resolved)**  
   Research §Spec state source: Reuse existing SpecExplorer state service; no new storage layer.  
   Implementation: T004 extends existing persistence.

2. **"How does duplicate detection work?" (Resolved)**  
   Research §Duplicate detection: Enforce uniqueness on (specId, normalized title) at creation.  
   Implementation: T005 creates guard; T014–T015 test it.

3. **"What happens if tasks prompt fails?" (Resolved)**  
   Research §Offline/failure: Mark change request blocked; surface error/toast; allow retry.  
   Implementation: T023 handles both success and failure paths.

### 🟡 Low-Severity Findings

**L001: Spec status term inconsistency (minor)**
- **Location**: Spec uses mixed terminology: "Current Specs", "Ready to Review", "Reopened" vs. data model and contracts use snake_case enums (current, readyToReview, reopened).
- **Impact**: None (spec prose vs. code enums; intentional for readability).
- **Recommendation**: Document the mapping explicitly in implementation guide (existing in quickstart.md).
- **Status**: ✅ **No action required** (intent is clear; mapping documented).

**L002: Tasks prompt response contract implicit**
- **Location**: Spec §FR-006 says "tasks created in standard workflow"; exact payload shape from tasks prompt is not in contracts/.
- **Impact**: Low (implementation detail; T023 will define payload builder).
- **Recommendation**: Add tasks-prompt-request.yaml and tasks-prompt-response.yaml to contracts/ during T023 (already referenced in quickstart).
- **Status**: ⚠️ **TRACKED** (captured in T023 "structured payload" and T021 "payload builder tests").

### ✅ No Critical or High-Severity Issues Found

---

## Cross-Checks: Spec ↔ Plan ↔ Tasks

| Artifact Pair | Check | Result |
|---------------|-------|--------|
| Spec ↔ Data Model | All FRs → Entity fields/FSM | ✅ **1:1 mapping** |
| Spec ↔ Contracts | All FRs → API operations + schemas | ✅ **1:1 mapping** |
| Spec ↔ Tasks | All FRs → ≥1 task | ✅ **100% coverage** |
| Plan ↔ Tasks | All file paths + structure | ✅ **Consistent** |
| Data Model ↔ Contracts | Entities ↔ OpenAPI schemas | ✅ **Field-level match** |
| Tasks ↔ Quickstart | Implementation order | ✅ **Same 5-step sequence** |

---

## Recommendations

### Immediate (Pre-Implementation)

1. ✅ **Complete**: All mandatory artifacts (spec, plan, data-model, contracts, quickstart, tasks) are present and consistent.
2. 📋 **Optional enhancement**: Add tasks-prompt request/response contracts to contracts/ (L002); reference during T023.

### During Implementation

1. 🔄 **Enforce test-first**: Verify T008–T009, T014–T015, T021–T022 are RED before implementing T010–T013, T016–T020, T023–T026.
2. 📊 **Telemetry checkpoints**: Confirm T006 and T013/T020/T028 emit all transition events required by FR-009 and SC-001–SC-005.
3. 🧪 **Duplicate guard tests**: Ensure T014 covers edge cases (same title, different case; similar titles, fuzzy matching disabled per research).

### Post-Implementation

1. ✅ **Update checklist**: Cross off [specs/001-spec-review-flow/checklists/review-flow.md](specs/001-spec-review-flow/checklists/review-flow.md) items as tasks complete.
2. 📖 **Keep docs in sync**: If FSM or entity structure changes during implementation, update data-model.md and contracts/ and reflect in test suite.

---

## Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Requirements (FRs) | 11 | ✅ All mapped |
| Total Tasks | 29 | ✅ All phases/stories covered |
| Requirement Coverage | 100% (11/11) | ✅ **COMPLETE** |
| Acceptance Scenarios | 6 | ✅ All test-driven |
| Entities | 3 (Specification, ChangeRequest, TaskLink) | ✅ Fully modeled |
| Status FSM states | 7 (current, readyToReview, reopened for Spec; open, blocked, inProgress, addressed for CR) | ✅ Consistent |
| Dependencies (inter-phase) | 6 | ✅ Acyclic |
| Parallel opportunities marked [P] | 16 | ✅ Good concurrency |
| Test-first tasks | 6 | ✅ Precede implementation |
| Telemetry touchpoints | 4 | ✅ NFR tracked |

---

## Conclusion

✅ **The feature is ready for implementation.** All artifacts are internally consistent, cross-referenced, and aligned with constitution principles (test-first, observability, simplicity). No blocking issues detected. Low-severity L002 is tracked and can be addressed during T023.

**Next step**: Begin Phase 1 (Setup) → Phase 2 (Foundational) → User stories in priority order (US1 → US2 → US3).
