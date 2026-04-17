# Tasks: Dynamic Extension Document Display in Spec Explorer

**Input**: Design documents from `/specs/017-extension-docs-tree/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Included per constitution (TDD mandatory). Tests MUST be written and FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define constants and types shared across all user stories

- [x] T001 Add `KNOWN_SPEC_FILES` Set constant (containing `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`) at top of `src/utils/spec-kit-adapter.ts`
- [x] T002 [P] Add `KNOWN_SPEC_FOLDERS` Set constant (containing `checklists`, `contracts`) at top of `src/utils/spec-kit-adapter.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core adapter changes that MUST be complete before user story tree rendering can work

- [x] T003 Write unit tests for extra file discovery in `getSpecKitFeatureFiles()` covering: spec directory with only known files returns unchanged result; spec directory with extra `.md` file includes it with `extra:` prefix key; non-markdown files are ignored; known files are not duplicated. Create `tests/unit/utils/spec-kit-adapter-extension-docs.test.ts`
- [x] T004 Modify `getSpecKitFeatureFiles()` in `src/utils/spec-kit-adapter.ts` to scan the feature directory with `readdirSync` after known-file processing, and add any remaining `.md` files as entries keyed with `extra:<filename>` prefix. Filter out non-markdown files and already-known files using the `KNOWN_SPEC_FILES` constant. Include `console.error` logging on `readdirSync` failure.

**Checkpoint**: Adapter now collects extra markdown files. Run `npm test -- tests/unit/utils/spec-kit-adapter-extension-docs.test.ts` to verify.

---

## Phase 3: User Story 1 - View Extension-Generated Documents (Priority: P1) MVP

**Goal**: Any extra `.md` files in a spec directory appear as leaf nodes in the Spec Explorer tree with a distinct `extensions` icon.

**Independent Test**: Place an extra `.md` file (e.g., `retrospective.md`) into any spec directory and verify it appears as a child node in the tree.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [US1] Write unit tests in `tests/unit/providers/spec-explorer-provider.test.ts` for `extension-document` rendering: given a spec with `extra:retrospective.md` in its files map, `getChildren()` returns a SpecItem with contextValue `extension-document`, label `Retrospective`, and `extensions` ThemeIcon. Also test: multiple extra files are sorted alphabetically after known documents; extra files with kebab-case names produce title-case labels (e.g., `acceptance-test-plan.md` becomes `Acceptance test plan`).

### Implementation for User Story 1

- [x] T006 [US1] Add `extension-document` handler in `getContextHandler()` within the `SpecItem` class in `src/providers/spec-explorer-provider.ts`. Handler sets `this.iconPath = new ThemeIcon("extensions")` and tooltip to `Extension document: ${this.label}`
- [x] T007 [US1] Add `extension-document` rendering branch in the `getChildren()` method of `SpecExplorerProvider` in `src/providers/spec-explorer-provider.ts`. When iterating over spec files, detect entries with `extra:` prefix key, create `SpecItem` with contextValue `extension-document`, collapsible state `None`, and command `gatomia.spec.open`. Derive label by stripping `.md` extension, capitalizing first letter, and replacing hyphens with spaces. Sort extra entries alphabetically and place them after all known document entries.
- [x] T008 [US1] Run `npm run check` and `npm test` to verify no regressions and all US1 tests pass

**Checkpoint**: Extra `.md` files in spec directories now appear in the tree. Run `npm test -- tests/unit/providers/spec-explorer-provider.test.ts` to validate.

---

## Phase 4: User Story 2 - Extension Documents Grouped in Subfolders (Priority: P2)

**Goal**: Unknown subfolders in a spec directory appear as collapsible folder nodes, with their contents displayed fully recursively.

**Independent Test**: Create a subfolder (e.g., `v-model/`) with markdown files inside a spec directory and verify it appears as a collapsible folder node in the tree.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [US2] Write unit tests in `tests/unit/utils/spec-kit-adapter-extension-docs.test.ts` for subfolder discovery: spec directory with unknown subfolder containing `.md` files includes it with `extra-folder:<dirname>` prefix key; empty subfolders are excluded; known folders (checklists, contracts) are excluded from extra-folder entries; nested subfolders are included.
- [x] T010 [P] [US2] Write unit tests in `tests/unit/providers/spec-explorer-provider.test.ts` for `extension-folder` rendering: given a spec with `extra-folder:v-model` in its files map, `getChildren()` returns a SpecItem with contextValue `extension-folder`, collapsible state `Collapsed`, label `V model`, and `folder-library` ThemeIcon. Test that expanding the folder node returns its contained `.md` files as `extension-document` children. Test that nested subfolders within an extension folder are shown as nested `extension-folder` nodes.

### Implementation for User Story 2

- [x] T011 [US2] Modify `getSpecKitFeatureFiles()` in `src/utils/spec-kit-adapter.ts` to also detect unknown subdirectories (not in `KNOWN_SPEC_FOLDERS`) and add them as entries keyed with `extra-folder:<dirname>` prefix. Skip empty directories (those with no `.md` files at any depth). Use a recursive helper function to check for markdown content.
- [x] T012 [US2] Add `extension-folder` handler in `getContextHandler()` within the `SpecItem` class in `src/providers/spec-explorer-provider.ts`. Handler sets `this.iconPath = new ThemeIcon("folder-library")` and tooltip to `Extension folder: ${this.label}`
- [x] T013 [US2] Add `extension-folder` rendering branch in the `getChildren()` method of `SpecExplorerProvider` in `src/providers/spec-explorer-provider.ts`. When iterating over spec files, detect entries with `extra-folder:` prefix key, create `SpecItem` with contextValue `extension-folder` and collapsible state `Collapsed`. Derive label from folder name using kebab-case to title case. Sort extension folders alphabetically after extra documents.
- [x] T014 [US2] Add `extension-folder` children expansion in `getChildren()` in `src/providers/spec-explorer-provider.ts`. When element has contextValue `extension-folder`, read the directory at `element.filePath`, and for each entry: create `extension-document` SpecItems for `.md` files, and create nested `extension-folder` SpecItems for subdirectories (fully recursive). Skip non-markdown files and empty subdirectories.
- [x] T015 [US2] Run `npm run check` and `npm test` to verify no regressions and all US2 tests pass

**Checkpoint**: Extension subfolders appear as collapsible folder nodes with recursive contents. Run `npm test` to validate.

---

## Phase 5: User Story 3 - Dynamic Refresh on File System Changes (Priority: P3)

**Goal**: The Spec Explorer tree automatically refreshes within 2 seconds (debounced) when files are added or removed from spec directories.

**Independent Test**: Add a new `.md` file to a spec directory while the tree is open and verify it appears within 2 seconds without manual refresh.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [US3] Write unit tests in `tests/unit/providers/spec-explorer-provider.test.ts` for file watcher registration: verify that `SpecExplorerProvider` creates a `FileSystemWatcher` for `**/specs/**/*.md` pattern on initialization. Verify the watcher is added to context subscriptions for disposal. Verify that the watcher callback calls `refresh()` with debounce.

### Implementation for User Story 3

- [x] T017 [US3] Add a debounced file system watcher in `SpecExplorerProvider` constructor in `src/providers/spec-explorer-provider.ts`. Use `workspace.createFileSystemWatcher` with glob pattern `**/specs/**/*.md`. On file create, change, or delete events, call `this.refresh()` debounced at 2000ms. Define `SPEC_FILE_WATCHER_DEBOUNCE_MS` constant at top of file. Add the watcher and a debounce `Timeout` reference as private fields. Dispose the watcher via `context.subscriptions`.
- [x] T018 [US3] Run `npm run check` and `npm test` to verify no regressions and all US3 tests pass

**Checkpoint**: Tree auto-refreshes when spec directory files change. Run `npm test` to validate.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration test, final validation, and cleanup

- [x] T019 [P] Write integration test in `tests/integration/spec-explorer/extension-docs-tree.test.ts` covering the full flow: adapter discovers extra files and folders, provider renders them as correct node types with correct icons, and clicking opens the file
- [x] T020 [P] Add telemetry logging in `src/providers/spec-explorer-provider.ts` to emit a count of discovered extension documents and extension folders when rendering a spec's children (Constitution IV: Observability). Log at debug level to avoid noise. Include spec name, extra file count, and extra folder count.
- [x] T021 Run `npm run check` to verify all lint and formatting passes
- [x] T022 Run full test suite with `npm test` and verify no coverage decrease
- [x] T023 Run quickstart.md validation: manually verify the smoke test steps from `specs/017-extension-docs-tree/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (constants must exist)
- **US1 (Phase 3)**: Depends on Phase 2 (adapter must collect extra files)
- **US2 (Phase 4)**: Depends on Phase 2 (adapter must collect folders); can run in parallel with US1 if independent, but US2 extends the same adapter method so it's sequential
- **US3 (Phase 5)**: Depends on Phase 2 (needs tree to exist); independent of US1/US2 implementation
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2). No dependencies on other stories.
- **User Story 2 (P2)**: Depends on Foundational (Phase 2). Extends the same adapter method as US1, so should follow US1 sequentially.
- **User Story 3 (P3)**: Depends on Foundational (Phase 2). Independent of US1/US2 (only needs the refresh() method which already exists). Can run in parallel with US1/US2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Adapter changes before provider changes
- Core rendering before children expansion
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (different constants, same file but no conflict)
- T009 and T010 can run in parallel (different test files)
- US3 (Phase 5) can run in parallel with US1 (Phase 3) if team capacity allows
- T019 and T020 can run in parallel with T021 (different concerns)

---

## Parallel Example: User Story 1

```text
# Tests first (single file, sequential):
T005: Unit tests for extension-document rendering in spec-explorer-provider.test.ts

# Then implementation (can be parallelized across files):
T006: Add extension-document handler in SpecItem class (spec-explorer-provider.ts)
T007: Add extension-document branch in getChildren() (spec-explorer-provider.ts)
# Note: T006 and T007 touch the same file so run sequentially

# Validate:
T008: npm run check && npm test
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T008)
4. **STOP and VALIDATE**: Extra `.md` files are visible in tree
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Extra files visible (MVP!)
3. Add User Story 2 -> Subfolder grouping works
4. Add User Story 3 -> Auto-refresh on file changes
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `npm run check` before marking any task complete (constitution requirement)
