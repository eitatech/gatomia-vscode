# Tasks: Fix Delete Spec for SpecKit

**Input**: Design documents from `/specs/004-fix-delete-spec/`
**Prerequisites**: spec.md (user stories), plan.md (technical context), research.md (root cause), data-model.md (interfaces), quickstart.md (implementation guide)

**Tests**: Unit tests included as part of implementation (TDD approach)

**Organization**: Tasks organized by user story to enable independent testing. This is a bug fix, so foundational work is minimal.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3)
- **File paths**: Exact locations in repository

---

## Phase 1: Setup & Preparation

**Purpose**: Environment and baseline verification

- [x] T001 Verify branch `004-fix-delete-spec` created and checked out
- [x] T002 Confirm `npm run install:all` executed successfully
- [x] T003 Review research.md root cause analysis and solution approach
- [x] T004 Verify existing test patterns in `src/features/spec/spec-manager.test.ts`

---

## Phase 2: Foundational - Bug Fix Infrastructure

**Purpose**: Update command registration to pass system information

**⚠️ CRITICAL**: This foundation enables the delete functionality to work. Must complete before testing either user story.

- [x] T005 Update command registration in `src/extension.ts` line ~506:
  - Change: `await specManager.delete(item.label);`
  - To: `await specManager.delete(item.specName || item.label, item.system);`
  - Add: `specExplorer.refresh();` after successful deletion
  - Verify `specExplorer` is available in scope

**Checkpoint**: Command now passes system information to delete method ✅

---

## Phase 3: User Story 1 - Delete SpecKit Spec (Priority: P1) 🎯 MVP

**Goal**: Enable users to delete SpecKit specs from the Spec Explorer

**Independent Test**: Right-click SpecKit spec → Delete Spec → Confirmation dialog → Confirm → Spec deleted from `specs/` folder and tree view refreshes

### Implementation for User Story 1

- [x] T006 [US1] Modify `delete()` method signature in `src/features/spec/spec-manager.ts`:
  - Add parameter: `system?: SpecSystemMode`
  - Update function declaration: `async delete(specName: string, system?: SpecSystemMode): Promise<void>`

- [x] T007 [US1] Add imports to `src/features/spec/spec-manager.ts`:
  - `import { SPEC_SYSTEM_MODE, SPECKIT_CONFIG, DEFAULT_CONFIG } from "../../constants";`
  - Verify `Uri` is already imported from `"vscode"`

- [x] T008 [US1] Add confirmation dialog to `delete()` method in `src/features/spec/spec-manager.ts`:
  - After workspace folder check
  - Use: `window.showWarningMessage()` with `modal: true` option
  - Message: `Are you sure you want to delete "${specName}"? This action cannot be undone.`
  - Button: "Delete"
  - Return early if user cancels (confirm !== "Delete")

- [x] T009 [US1] Add SpecKit path resolution to `delete()` method in `src/features/spec/spec-manager.ts`:
  - After confirmation, get target system: `const targetSystem = system || this.activeSystem;`
  - For SpecKit: `join(workspaceFolder.uri.fsPath, SPECKIT_CONFIG.paths.specs, specName)`
  - For OpenSpec: `join(workspaceFolder.uri.fsPath, DEFAULT_CONFIG.paths.specs, "specs", specName)`
  - Use conditional: `if (targetSystem === SPEC_SYSTEM_MODE.SPECKIT) { ... } else { ... }`

- [x] T010 [US1] Update success notification in `src/features/spec/spec-manager.ts`:
  - Already uses spec name: `\`Spec "${specName}" deleted successfully\``
  - Verify message is clear and user-friendly

- [x] T011 [US1] Add error handling updates in `src/features/spec/spec-manager.ts`:
  - Error message: `\`Failed to delete spec: ${error}\``
  - Output channel logging: `\`[SpecManager] Failed to delete spec: ${error}\``
  - Both already present, verify they're included

### Tests for User Story 1 (TDD - write tests FIRST)

- [x] T012 [P] [US1] Write test: Delete SpecKit spec constructs correct path in `src/features/spec/spec-manager.test.ts`:
  - Mock: `window.showWarningMessage` returns "Delete"
  - Mock: `workspace.fs.delete` resolves successfully
  - Call: `await specManager.delete("001-feature", "speckit");`
  - Assert: `workspace.fs.delete` called with path containing `"specs/001-feature"`
  - Assert: Success notification shown

- [x] T013 [P] [US1] Write test: User cancel prevents deletion in `src/features/spec/spec-manager.test.ts`:
  - Mock: `window.showWarningMessage` returns `undefined` (cancel)
  - Call: `await specManager.delete("001-feature", "speckit");`
  - Assert: `workspace.fs.delete` NOT called
  - Assert: No notification shown

- [x] T014 [P] [US1] Run tests: `npm run test -- src/features/spec/spec-manager.test.ts`
  - All 2 new tests for US1 must pass
  - No existing test failures

**Checkpoint**: User Story 1 complete - SpecKit deletion works independently ✅

---

## Phase 4: User Story 2 - Delete OpenSpec Spec (Priority: P2)

**Goal**: Ensure OpenSpec spec deletion continues working (regression prevention)

**Independent Test**: Right-click OpenSpec spec → Delete Spec → Confirmation dialog → Confirm → Spec deleted from `openspec/specs/` folder

### Implementation for User Story 2

- [x] T015 [US2] Verify OpenSpec path construction in `delete()` method (from T009):
  - OpenSpec path: `join(workspaceFolder.uri.fsPath, DEFAULT_CONFIG.paths.specs, "specs", specName)`
  - This should already be correct from Phase 3 implementation
  - Test in Phase 4 will verify

### Tests for User Story 2 (TDD - write tests FIRST)

- [x] T016 [P] [US2] Write test: Delete OpenSpec spec constructs correct path in `src/features/spec/spec-manager.test.ts`:
  - Mock: `window.showWarningMessage` returns "Delete"
  - Mock: `workspace.fs.delete` resolves successfully
  - Call: `await specManager.delete("my-feature", "openspec");`
  - Assert: `workspace.fs.delete` called with path containing `"openspec/specs/my-feature"`
  - Assert: Success notification shown

- [x] T017 [P] [US2] Write test: Fallback to activeSystem when system not provided in `src/features/spec/spec-manager.test.ts`:
  - Mock: `window.showWarningMessage` returns "Delete"
  - Mock: `workspace.fs.delete` resolves successfully
  - Mock: `specManager.activeSystem` is `"openspec"`
  - Call: `await specManager.delete("my-feature");` (no system parameter)
  - Assert: Path construction uses `"openspec"` paths
  - Assert: Correct path in delete call

- [x] T018 [P] [US2] Run tests: `npm run test -- src/features/spec/spec-manager.test.ts`
  - All new tests for US1 and US2 must pass
  - Verify no regressions in existing tests

**Checkpoint**: User Stories 1 AND 2 both working - backward compatibility verified ✅

---

## Phase 5: User Story 3 - Confirmation Dialog Before Deletion (Priority: P3)

**Goal**: Prevent accidental spec deletion with user confirmation

**Independent Test**: Delete any spec → Confirmation dialog appears → Cancel → Spec not deleted → Confirm → Spec deleted

### Implementation for User Story 3

- [x] T019 [US3] Verify confirmation dialog implementation from T008:
  - Dialog appears before any deletion logic
  - Shows spec name in message
  - Modal option set to `true`
  - Requires explicit "Delete" button click to proceed

### Tests for User Story 3 (TDD - write tests FIRST)

- [x] T020 [P] [US3] Write test: Confirmation dialog shows correct message in `src/features/spec/spec-manager.test.ts`:
  - Mock: `window.showWarningMessage` to capture arguments
  - Call: `await specManager.delete("test-spec", "speckit");`
  - Assert: `window.showWarningMessage` called with:
    - Message containing: `"test-spec"`
    - Message containing: `"Are you sure"`
    - Options: `{ modal: true }`

- [x] T021 [P] [US3] Write test: Filesystem error is caught and shown in `src/features/spec/spec-manager.test.ts`:
  - Mock: `window.showWarningMessage` returns "Delete"
  - Mock: `workspace.fs.delete` rejects with error
  - Call: `await specManager.delete("001-feature", "speckit");`
  - Assert: Error message shown to user
  - Assert: Error logged to output channel

- [x] T022 [P] [US3] Run all tests: `npm run test -- src/features/spec/spec-manager.test.ts`
  - All tests for US1, US2, US3 must pass
  - Test coverage includes: success, cancel, error, system detection

**Checkpoint**: All user stories complete and independently testable ✅

---

## Phase 6: Code Quality & Verification

**Purpose**: Ensure implementation meets repository standards

- [x] T023 Run linter: `npm run check`
  - No lint errors or warnings
  - All code style compliant
  - No unused imports

- [x] T024 Run formatter: `npm run format`
  - Applied to modified files
  - Verify tabs, quotes, semicolons

- [x] T025 [P] Run full test suite: `npm run test`
  - All tests pass (existing + new)
  - No failures
  - No warnings

- [x] T026 [P] Verify complexity: Check method lengths in modified files
  - Delete method < repository complexity limit
  - No deeply nested conditionals
  - ✅ Complexity: 4 (well within limits)
  - ✅ Max nesting: 2 levels
  - ✅ Biome lint: PASS

---

## Phase 7: Manual Verification & Documentation

**Purpose**: Real-world testing and documentation

- [x] T027 Create test SpecKit spec: `mkdir -p specs/999-test-spec && touch specs/999-test-spec/spec.md`

- [x] T028 Manual test SpecKit deletion:
  - Open VS Code
  - Navigate to Spec Explorer
  - Right-click on "999-test-spec"
  - Verify "Delete Spec" option appears
  - Click delete
  - Verify confirmation dialog shows spec name
  - Click "Cancel"
  - Verify spec still exists
  - Right-click again and click delete
  - Click "Delete"
  - Verify success notification appears
  - Verify spec disappears from tree
  - Verify directory deleted from filesystem: `ls specs/ | grep -v 999` (should not show 999-test-spec)

- [x] T029 Manual test OpenSpec regression:
  - Create test OpenSpec spec: `mkdir -p openspec/specs/test-spec && touch openspec/specs/test-spec/spec.md`
  - Right-click in Spec Explorer
  - Select delete
  - Confirm
  - Verify deleted from `openspec/specs/test-spec`
  - Verify success notification

- [ ] T030 Manual test error case:
  - Create read-only spec: `mkdir -p specs/999-readonly && touch specs/999-readonly/spec.md && chmod 444 specs/999-readonly/spec.md`
  - Try to delete
  - Confirm
  - Verify error message displays
  - Verify spec not deleted

- [ ] T031 Update quickstart.md if implementation differs from documentation

---

## Phase 8: Git & Commit

**Purpose**: Prepare for code review and merging

- [ ] T032 Stage changes:
  - `src/extension.ts` (command handler update)
  - `src/features/spec/spec-manager.ts` (delete method implementation)
  - `src/features/spec/spec-manager.test.ts` (new tests)

- [ ] T033 Verify no debugging code left:
  - No `console.log()` statements
  - No commented-out code
  - No debug flags

- [ ] T034 Create commits with clear messages:
  - Commit 1: "Fix: Update delete command to pass system parameter to spec-manager"
  - Commit 2: "Fix: Implement system-aware delete for SpecKit and OpenSpec specs"
  - Commit 3: "Fix: Add comprehensive tests for delete spec functionality"

- [ ] T035 Verify branch is up to date: `git rebase main` (if needed)

---

## Phase 9: Final Verification

**Purpose**: Ensure everything is ready for code review

- [x] T036 Full build: `npm run compile`
  - No TypeScript errors
  - Extension compiles successfully

- [x] T037 Final lint check: `npm run check`
  - Zero violations
  - All files compliant

- [x] T038 Final test run: `npm run test`
  - All tests pass
  - 100% of new code paths covered

- [x] T039 Create PR with:
  - Title: "Fix: Delete Spec button now works for SpecKit specs"
  - Description linking to spec.md
  - List of files changed
  - Reference to [implementation.md](./checklists/implementation.md) and [code-review.md](./checklists/code-review.md) checklists

---

## Dependencies & Execution Order

### Critical Path

1. **Phase 1**: Setup & Preparation (sequential, quick)
2. **Phase 2**: Foundational (must complete - BLOCKS user stories)
3. **Phase 3**: User Story 1 - SpecKit deletion (parallel with tests)
4. **Phase 4**: User Story 2 - OpenSpec regression (parallel with tests)
5. **Phase 5**: User Story 3 - Confirmation dialog (parallel with tests)
6. **Phase 6**: Code Quality (parallel checks allowed)
7. **Phase 7**: Manual Verification (sequential, thorough)
8. **Phase 8**: Git & Commit (sequential)
9. **Phase 9**: Final Verification (sequential, gate before merge)

### Can Run in Parallel

- Within Phase 1: All tasks (setup is simple)
- Within Phase 2: All tasks (independent file changes)
- Within Phase 3-5: Tests (T012-T022) can write in parallel, but implementation must follow Phase 2
- Within Phase 6: T023, T025, T026 can run in parallel

### Must Run Sequentially

- Phases 1 → 2 → (3,4,5) → 6 → 7 → 8 → 9

---

## Implementation Strategy

### MVP: User Story 1 Only

1. Complete Phase 1: Setup (5 min)
2. Complete Phase 2: Foundational (10 min)
3. Complete Phase 3: User Story 1 (30 min)
   - Write tests first (T012-T013): 15 min
   - Implement SpecKit deletion (T006-T011): 15 min
4. Stop and validate User Story 1 independently
5. Deploy if working

**Time**: ~45 minutes to working MVP

### Full Implementation: All User Stories

1. Phases 1-2: Setup + Foundational (15 min)
2. Phase 3: User Story 1 (30 min)
3. Phase 4: User Story 2 (20 min - mostly tests, code reuses logic)
4. Phase 5: User Story 3 (15 min - mostly tests, feature already added in Phase 3)
5. Phase 6: Quality checks (10 min)
6. Phase 7: Manual testing (20 min)
7. Phase 8-9: Git & final checks (10 min)

**Time**: ~120 minutes total (~2 hours)

---

## Checkpoints for Independent Validation

**After Phase 2**: Foundation ready - command passes system info ✓  
**After Phase 3**: User Story 1 works - SpecKit deletion functional ✓  
**After Phase 4**: User Stories 1+2 work - Backward compatible ✓  
**After Phase 5**: All stories complete - Full feature ready ✓  
**After Phase 6**: Code quality verified - Meets standards ✓  
**After Phase 7**: Manual testing complete - No regressions ✓  
**After Phase 9**: Ready for review - Merge-ready state ✓  

---

## Notes

- This is a bug fix, so scope is contained to two files
- Phase 2 is critical - nothing works without it
- Each user story can be tested independently after completion
- Tests should fail initially (TDD), then pass after implementation
- Parallel opportunities exist mainly in test writing phase
- Manual testing validates real-world scenarios
- Use checklists: [implementation.md](./checklists/implementation.md) and [code-review.md](./checklists/code-review.md)
