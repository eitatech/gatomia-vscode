---
version: "1.0"
owner: "Italo <182202+italoag@users.noreply.github.com>"
---

# Tasks: Automatic Document Version and Author Tracking

**Feature**: 012-spec-version-tracking  
**Branch**: `012-spec-version-tracking`  
**Input**: Design documents from [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**TDD Approach**: All tasks follow Test-First Development (TDD) per project constitution. Write failing tests BEFORE implementation, ensure they pass, then refactor. Tests are embedded in implementation workflow, not separate tasks.

---

## Task Format

- **Checkbox**: `- [ ]` for not started, `- [x]` when complete
- **Task ID**: T001, T002, T003... (sequential execution order)
- **[P] marker**: Task can run in parallel (different files, no dependencies)
- **[Story] label**: Maps to user stories from spec.md (US1, US2, US3, US4)
- **File paths**: Exact absolute or relative paths included

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create directory structure and install dependencies

- [x] T001 Create feature directory structure in src/features/documents/version-tracking/
- [x] T002 Create test directory structure in tests/unit/features/documents/version-tracking/ and tests/integration/
- [x] T003 [P] Install gray-matter dependency for YAML frontmatter parsing (verify in package.json)
- [x] T004 [P] Create TypeScript type definitions from contracts/document-version-service.api.ts in src/features/documents/version-tracking/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared components that ALL user stories depend on. MUST complete before ANY user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is 100% complete.

### Pure Logic Components (No I/O)

- [x] T005 [P] Implement VersionIncrementer class in src/features/documents/version-tracking/version-incrementer.ts (TDD: test increment 1.0→1.1, 1.9→2.0, normalize malformed versions)
- [x] T006 [P] Create unit tests for VersionIncrementer in tests/unit/features/documents/version-tracking/version-incrementer.test.ts (cover all version increment scenarios, normalization edge cases)

### Git Integration Component

- [x] T007 [P] Implement GitUserInfoProvider in src/utils/git-user-info.ts (TDD: test Git config read, fallback to system username, format owner string)
- [x] T008 [P] Create unit tests for GitUserInfoProvider in tests/unit/utils/git-user-info.test.ts (mock child_process.execSync, test Git unavailable scenario)

### Frontmatter Processing Component

- [ ] T009 Implement FrontmatterProcessor class in src/features/documents/version-tracking/frontmatter-processor.ts (TDD: test extract metadata, update frontmatter, handle missing/malformed YAML, extract body content)
- [ ] T010 Create unit tests for FrontmatterProcessor in tests/unit/features/documents/version-tracking/frontmatter-processor.test.ts (use test fixtures in tests/fixtures/)

### Workspace State Management

- [ ] T011 Implement VersionHistoryManager class in src/features/documents/version-tracking/version-history-manager.ts (TDD: test add entry, FIFO rotation at 50 entries, get/update document state, workspace state serialization)
- [ ] T012 Create unit tests for VersionHistoryManager in tests/unit/features/documents/version-tracking/version-history-manager.test.ts (mock ExtensionContext.workspaceState, verify FIFO rotation)

### Debounce Logic

- [ ] T013 [P] Implement DebounceTracker class in src/features/documents/version-tracking/debounce-tracker.ts (TDD: test 30-second debounce window, per-document tracking, timestamp persistence)
- [ ] T014 [P] Create unit tests for DebounceTracker in tests/unit/features/documents/version-tracking/debounce-tracker.test.ts (use Vitest fake timers, test blocked saves don't reset timer)

### Change Detection

- [ ] T015 [P] Implement FileChangeDetector class in src/utils/file-change-detector.ts (TDD: test body content comparison, normalize whitespace, ignore frontmatter formatting changes)
- [ ] T016 [P] Create unit tests for FileChangeDetector in tests/unit/utils/file-change-detector.test.ts (test frontmatter-only changes don't trigger version increment)

**Checkpoint**: Foundation complete. All shared components implemented and tested. User story implementation can now begin.

---

## Phase 3: User Story 1 - Automatic Version Initialization (Priority: P1) 🎯 MVP

**Goal**: When a user creates a new spec/plan/tasks document, the system automatically initializes VERSION to "1.0" and OWNER to Git user info.

**Independent Test**: Create new spec via extension command, verify frontmatter contains `version: "1.0"` and `owner: "[Git User Name] <[email]>"`.

### Implementation

- [ ] T017 [US1] Implement DocumentVersionService.initializeVersionTracking() in src/features/documents/version-tracking/document-version-service.ts (TDD: test initialization for new document with no frontmatter, test Git user populated as owner)
- [ ] T018 [US1] Add initialization logic to DocumentVersionService constructor (detect documents without version/owner on extension activation)
- [ ] T019 [US1] Register workspace.onDidCreateFiles event in src/extension.ts to trigger initialization for new spec/plan/tasks documents
- [ ] T020 [US1] Create integration test for initialization flow in tests/integration/document-version-tracking.test.ts (test create new spec → has version 1.0 and owner)

**Checkpoint**: User Story 1 complete. New documents are automatically initialized with version 1.0 and Git user as owner.

---

## Phase 4: User Story 2 - Automatic Version Increment (Priority: P2)

**Goal**: When a user modifies an existing document, the system detects the change and automatically increments the version number (1.0→1.1→...→1.9→2.0).

**Independent Test**: Edit existing spec.md (version 1.0), save it, verify version increments to 1.1. Make 9 more saves, verify transition from 1.9 to 2.0.

### Implementation

- [ ] T021 [US2] Implement DocumentVersionService.processDocumentSave() in src/features/documents/version-tracking/document-version-service.ts (TDD: test version increment on save, test debounce enforcement, test body content change detection, test infinite loop prevention)
- [ ] T022 [US2] Add isSpecKitDocument() helper to identify spec/plan/tasks files by path pattern
- [ ] T023 [US2] Implement infinite loop prevention with processingDocuments Set (dirty flag pattern)
- [ ] T024 [US2] Register workspace.onDidSaveTextDocument event in src/extension.ts to trigger processDocumentSave()
- [ ] T025 [US2] Create integration test for save flow in tests/integration/document-version-tracking.test.ts (test edit → save → version increments, test rapid saves blocked by debounce)
- [ ] T026 [US2] Create integration test for version overflow in tests/integration/document-version-tracking.test.ts (test 1.9 → 2.0 transition)
- [ ] T027 [US2] Create integration test for manual version changes in tests/integration/document-version-tracking.test.ts (test user sets version to 5.7, next increment goes to 5.8)

**Checkpoint**: User Story 2 complete. Document versions automatically increment on save with proper debounce and change detection.

---

## Phase 5: User Story 3 - Post-Processing Architecture (Priority: P1)

**Goal**: Ensure version tracking works via post-processing hooks without modifying SpecKit template files, ensuring updateability.

**Independent Test**: Update SpecKit templates, run extension, verify new specs still get version/owner fields without template modifications.

### Implementation

- [ ] T028 [US3] Create DocumentVersionService factory function in src/features/documents/version-tracking/document-version-service.ts (createDocumentVersionService with dependency injection)
- [ ] T029 [US3] Verify DocumentVersionService does NOT modify template files in .specify/templates/ (code review + integration test)
- [ ] T030 [US3] Register DocumentVersionService in extension.ts activate() function with proper lifecycle management (dispose on deactivate)
- [ ] T031 [US3] Create integration test for template updateability in tests/integration/document-version-tracking.test.ts (simulate template change, verify version tracking still works)

**Checkpoint**: User Story 3 complete. Version tracking implemented via non-invasive post-processing, SpecKit templates remain unchanged.

---

## Phase 6: User Story 4 - Visual Display in Explorer (Priority: P3)

**Goal**: Display document version numbers in Spec Explorer tree view as badges or suffixes (e.g., "Feature Name (v2.3)").

**Independent Test**: Open Spec Explorer, verify spec items show version numbers. Edit and save a spec, verify version display updates within 1 second.

### Implementation

- [ ] T032 [P] [US4] Modify SpecExplorerProvider.getTreeItem() in src/providers/spec-explorer-provider.ts to fetch document metadata and add version suffix to TreeItem.description
- [ ] T033 [P] [US4] Register DocumentVersionService as dependency in SpecExplorerProvider constructor
- [ ] T034 [US4] Implement tree view refresh after version updates (fire onDidChangeTreeData event)
- [ ] T035 [US4] Add version tooltip to TreeItem showing full version history metadata (last modified, author)
- [ ] T036 [US4] Create integration test for tree view display in tests/integration/spec-explorer-version-display.test.ts (test version badge appears, test refresh after save)

**Checkpoint**: User Story 4 complete. Spec Explorer displays version numbers for all documents with proper refresh on changes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Commands, documentation, and final quality improvements

### Reset Version Command

- [ ] T037 [P] Create resetDocumentVersion command in src/commands/reset-document-version-command.ts (implement confirmation dialog, call DocumentVersionService.resetDocumentVersion())
- [ ] T038 [P] Register command in package.json (commands section + menus.view/item/context for Spec Explorer)
- [ ] T039 [P] Register command in extension.ts activate() function
- [ ] T040 [P] Create integration test for reset command in tests/integration/document-version-tracking.test.ts (test reset to 1.0, test confirmation dialog, test history entry created)

### Logging and Error Handling

- [ ] T041 [P] Add extension output channel logging for all version changes in src/features/documents/version-tracking/document-version-service.ts (**FR-010 compliance** - implement structured log format per data-model.md Log Format Specification: `[{timestamp}] [{level}] Version: {document} {prev}→{new} by {author} ({message})`. Log events: increment, reset, normalization, initialization, errors. Example: `[2026-01-29T19:45:23Z] [INFO] Version: specs/012/spec.md 1.0→1.1 by Italo <email>`)
- [ ] T042 [P] Implement error recovery for Git unavailable, YAML parsing failures, workspace state errors (log warnings with structured format, use fallbacks, don't block saves)
- [ ] T043 [P] Add telemetry events for version increments (success/failure rates) using VS Code telemetry API

### Documentation

- [ ] T044 [P] Update package.json with command descriptions, configuration schema (if needed), changelog entry
- [ ] T045 [P] Update README.md with feature description, usage examples, troubleshooting
- [ ] T046 [P] Create test fixtures in tests/fixtures/ for various document scenarios (valid frontmatter, missing frontmatter, malformed versions)

### Final Validation

- [ ] T047 Run all unit tests (`npm test`) and verify 100% pass rate
- [ ] T048 Run all integration tests and verify end-to-end workflows
- [ ] T049 Run quickstart.md manual validation (create spec, edit/save 10 times, verify 1.0→1.9→2.0, reset command)
- [ ] T050 Run linter and formatter (`npm run check`) and fix any violations (kebab-case filenames, no `any` types)

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS everything
    ↓
┌───────────────────┬─────────────────┬─────────────────┐
│ Phase 3 (US1)     │ Phase 4 (US2)   │ Phase 6 (US4)   │
│ Initialization    │ Auto Increment  │ Visual Display  │
│ (P1) 🎯 MVP       │ (P2)            │ (P3)            │
└───────────────────┴─────────────────┴─────────────────┘
                    ↓
            Phase 5 (US3)
       Post-Processing Check
            (P1)
                    ↓
            Phase 7 (Polish)
         Final Validation
```

### User Story Dependencies

- **US1 (Initialization)**: Can start immediately after Foundational phase
- **US2 (Auto Increment)**: Can start after Foundational phase (parallel with US1 if desired)
- **US3 (Post-Processing)**: Validation phase, runs after US1 and US2 complete
- **US4 (Visual Display)**: Independent, can start after Foundational phase (parallel with US1/US2)

### Within Foundational Phase

```text
T005-T006 (VersionIncrementer)    ← Pure logic, no dependencies
T007-T008 (GitUserInfoProvider)   ← Pure logic, no dependencies
T009-T010 (FrontmatterProcessor)  ← Needs T003 (gray-matter installed)
T011-T012 (VersionHistoryManager) ← No dependencies
T013-T014 (DebounceTracker)       ← Needs T011 (VersionHistoryManager)
T015-T016 (FileChangeDetector)    ← Needs T009 (FrontmatterProcessor)

Parallel opportunities:
- T005-T006, T007-T008, T011-T012 can all run in parallel
- T009-T010 must wait for T003
- T013-T014 must wait for T011
- T015-T016 must wait for T009
```

### Within User Story Phases

- **US1**: Tasks T017-T020 are sequential (implementation → registration → integration test)
- **US2**: Tasks T021-T027 are sequential (core implementation → event registration → tests)
- **US4**: Tasks T032-T036 can be done in sequence or some in parallel (T032-T035 can be parallel if different developers)

### Parallel Opportunities

**Foundational Phase** (after Phase 1 complete):
```bash
# Launch simultaneously:
T005-T006 (VersionIncrementer)
T007-T008 (GitUserInfoProvider)
T011-T012 (VersionHistoryManager)

# Then launch after dependencies:
T009-T010 (FrontmatterProcessor - after T003)
T013-T014 (DebounceTracker - after T011)
T015-T016 (FileChangeDetector - after T009)
```

**After Foundational Phase**:
```bash
# Launch all user story phases in parallel:
Phase 3 (US1) + Phase 4 (US2) + Phase 6 (US4)

# Example with 3 developers:
Developer A: US1 tasks (T017-T020)
Developer B: US2 tasks (T021-T027)
Developer C: US4 tasks (T032-T036)
```

**Polish Phase**:
```bash
# Most polish tasks can run in parallel:
T037-T040 (Reset command)
T041-T043 (Logging/telemetry)
T044-T046 (Documentation)

# Final validation must be sequential:
T047 → T048 → T049 → T050
```

---

## Implementation Strategy

### Strategy 1: MVP First (Recommended for Solo Developer)

**Goal**: Deliver working version tracking as quickly as possible.

1. **Week 1**: Complete Phase 1 (Setup) + Phase 2 (Foundational)
   - Focus: Build all shared components with TDD
   - Deliverable: All 6 core components tested and working

2. **Week 2, Days 1-2**: Complete Phase 3 (US1 - Initialization)
   - Focus: New documents get version 1.0
   - **STOP AND DEMO**: Create new specs, verify version/owner fields
   - Deliverable: ✅ MVP 1.0 - Initialization working

3. **Week 2, Days 3-5**: Complete Phase 4 (US2 - Auto Increment)
   - Focus: Existing documents increment on save
   - **STOP AND DEMO**: Edit/save specs, watch version increment 1.0→1.1→2.0
   - Deliverable: ✅ MVP 2.0 - Core feature complete

4. **Week 3, Days 1-2**: Complete Phase 5 (US3 - Post-Processing Check)
   - Focus: Verify non-invasive architecture
   - Deliverable: ✅ Architecture validated

5. **Week 3, Day 3**: Complete Phase 6 (US4 - Visual Display)
   - Focus: See versions in Spec Explorer
   - Deliverable: ✅ Feature complete

6. **Week 3, Days 4-5**: Complete Phase 7 (Polish)
   - Focus: Reset command, docs, final testing
   - Deliverable: ✅ Production ready

**Total Estimated Time**: 15 working days (3 weeks)

### Strategy 2: Parallel Team Development

**Goal**: Maximize parallelism with multiple developers.

1. **All team**: Complete Phase 1 + Phase 2 together (Week 1)

2. **After Foundational complete**, split into 3 parallel tracks:
   - **Developer A**: US1 (Initialization) → 2 days
   - **Developer B**: US2 (Auto Increment) → 3 days  
   - **Developer C**: US4 (Visual Display) → 1 day

3. **Merge and validate**: US3 (Post-Processing Check) → 1 day

4. **All team**: Polish phase → 2 days

**Total Estimated Time**: 9 working days (with 3 developers)

### Strategy 3: Incremental Delivery with Feedback

**Goal**: Get user feedback early, adjust scope based on learnings.

1. **Sprint 1** (Week 1): Foundation + US1 (MVP 1.0)
   - **Demo to users**: "New specs auto-initialize with version 1.0"
   - **Feedback**: Is version format correct? Is owner info useful?

2. **Sprint 2** (Week 2): US2 (MVP 2.0)
   - **Demo to users**: "Versions auto-increment on save"
   - **Feedback**: Is debounce timing right (30s)? Any edge cases?

3. **Sprint 3** (Week 3): US4 + Polish
   - **Demo to users**: "Version badges in Explorer + reset command"
   - **Feedback**: Is visual display clear? Any UX improvements?

**Total Estimated Time**: 15 days with continuous feedback loops

---

## Task Completion Criteria

Each task is considered complete when:

✅ **Code written**: Implementation follows contracts from contracts/document-version-service.api.ts  
✅ **Tests pass**: All unit tests written (TDD) and passing  
✅ **Types correct**: TypeScript strict mode, no `any` types  
✅ **Linter passes**: `npm run check` shows no violations  
✅ **Files named**: Kebab-case naming convention followed  
✅ **Documented**: JSDoc comments on public APIs  
✅ **Committed**: Git commit with descriptive message

---

## Notes

- **TDD Mandatory**: Constitution requires Test-First Development. Write failing test → implement → refactor.
- **Kebab-case filenames**: Constitution Rule I. All files use kebab-case (no camelCase, PascalCase).
- **No `any` types**: Constitution Rule II. TypeScript strict mode, no `any` without justification.
- **Observability**: Constitution Rule IV. Add logging for version changes, telemetry for success/failure rates.
- **YAGNI**: Constitution Rule V. Only implement what's in the spec, no premature abstractions.
- **Integration tests last**: Write integration tests after component implementation to verify end-to-end flows.
- **Stop at checkpoints**: Validate each user story independently before moving to next.
- **Parallel when possible**: Use [P] marker to identify tasks that can run simultaneously.

---

## Progress Tracking

**Current Phase**: Setup (Phase 1)  
**Completed Tasks**: 0/50  
**Estimated Completion**: Week 3 (15 working days assuming solo developer)

Track progress:
- Mark tasks complete with `[x]` as you finish them
- Update "Current Phase" as you progress
- Note any blockers or deviations from plan in commit messages
- Run `npm run check` before each commit
- Celebrate checkpoints! 🎉

---

**Last Updated**: 2026-01-29
