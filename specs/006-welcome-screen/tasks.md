# Tasks: Extension Welcome Screen

**Progress**: 139/162 tasks complete (86%)

**Input**: Design documents from `/specs/006-welcome-screen/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create directory structure for welcome screen feature (src/panels/, src/providers/, src/services/, ui/src/features/welcome/)
- [X] T002 [P] Create TypeScript types file in src/types/welcome.ts with message contracts
- [X] T003 [P] Create TypeScript types file in ui/src/features/welcome/types.ts with webview types
- [X] T004 [P] Add welcome screen styles to ui/src/features/welcome/welcome.css following VS Code theme variables

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement DependencyChecker service in src/services/dependency-checker.ts with caching (60s TTL)
- [X] T006 [P] Implement SystemDiagnostics service in src/services/system-diagnostics.ts with 24h rolling window and 5-entry limit
- [X] T007 [P] Implement LearningResources service in src/services/learning-resources.ts with hardcoded resource catalog
- [X] T008 Create workspace state utility functions in src/utils/workspace-state.ts for first-time tracking
- [X] T009 Create WelcomeScreenPanel class in src/panels/welcome-screen-panel.ts following DocumentPreviewPanel pattern
- [X] T010 Create WelcomeScreenProvider class in src/providers/welcome-screen-provider.ts for state aggregation and business logic
- [X] T011 Create Zustand store in ui/src/features/welcome/stores/welcome-store.ts for webview state management
- [X] T012 Create welcome screen HTML entry point using getWebviewContent utility in src/panels/welcome-screen-panel.ts
- [X] T013 Add welcome screen build target to ui/vite.config.ts for multi-entry build

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-Time Extension Activation (Priority: P1) 🎯 MVP

**Goal**: Automatically display welcome screen on first workspace activation with dependency status and guided setup

**Independent Test**: Install extension in fresh workspace. Welcome screen appears automatically, shows GitHub Copilot Chat status, displays spec system options. User can complete setup without external docs.

### Tests for User Story 1 (TDD - Write First)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T014 [P] [US1] Unit test for workspace state tracking in tests/unit/utils/workspace-state.test.ts
- [X] T015 [P] [US1] Unit test for DependencyChecker GitHub Copilot Chat detection in tests/unit/services/dependency-checker.test.ts
- [X] T016 [P] [US1] Unit test for first-time activation logic in tests/unit/providers/welcome-screen-provider.test.ts
- [X] T017 [US1] Integration test for first-time welcome screen display in tests/integration/welcome/welcome-first-time.test.ts
- [X] T018 [US1] Integration test for dependency installation buttons in tests/integration/welcome/welcome-install-deps.test.ts

### Implementation for User Story 1

- [X] T019 [US1] Implement first-time check in src/extension.ts activate() using workspaceState.get('gatomia.welcomeScreen.hasShownBefore')
- [X] T020 [US1] Implement automatic welcome screen display on first activation in src/extension.ts
- [X] T021 [US1] Create SetupSection component in ui/src/features/welcome/components/setup-section.tsx with dependency status display
- [X] T022 [US1] Implement GitHub Copilot Chat detection in DependencyChecker using vscode.extensions.getExtension API (see research.md section 0 for protocol)
- [X] T023 [US1] Implement SpecKit CLI detection in DependencyChecker via 'specify --version' command execution with 5s timeout and regex parsing (see research.md section 0 for protocol)
- [X] T024 [US1] Implement OpenSpec CLI detection in DependencyChecker via 'openspec --version' command execution with JSON/regex parsing (see research.md section 0 for protocol)
- [X] T025 [US1] Add install button handlers for GitHub Copilot Chat (open Extensions marketplace) in setup-section.tsx
- [X] T026 [US1] Add install button handlers for SpecKit CLI (copy command to clipboard) in setup-section.tsx
- [X] T027 [US1] Add install button handlers for OpenSpec CLI (copy command to clipboard) in setup-section.tsx
- [X] T028 [US1] Implement dependency refresh action to invalidate cache and re-check in WelcomeScreenProvider
- [X] T029 [US1] Add spec system initialization guidance display (SpecKit vs OpenSpec instructions) in setup-section.tsx
- [X] T030 [US1] Handle welcome/install-dependency message in WelcomeScreenProvider with executeCommand for extensions
- [X] T031 [US1] Handle welcome/refresh-dependencies message in WelcomeScreenProvider
- [X] T032 [US1] Implement welcome/dependency-status message sending from extension to webview
- [X] T033 [US1] Add "Get Started" button that advances to Features section in setup-section.tsx
- [X] T034 [US1] Add OutputChannel logging for dependency detection operations in DependencyChecker

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Welcome screen appears on first activation with working dependency detection.

---

## Phase 4: User Story 2 - Quick Access to Features and Commands (Priority: P2)

**Goal**: Provide command palette access to welcome screen with organized feature cards and direct action buttons

**Independent Test**: Open welcome screen via command palette. Click feature action buttons to execute commands (Create Spec, Configure Hooks, etc.). Verify commands execute immediately.

### Tests for User Story 2 (TDD - Write First)

- [X] T035 [P] [US2] Unit test for command registration in tests/unit/extension.test.ts
- [X] T036 [P] [US2] Unit test for command execution via feature actions in tests/unit/providers/welcome-screen-provider.test.ts
- [X] T037 [US2] Integration test for command palette access in tests/integration/welcome/welcome-command.test.ts
- [X] T038 [US2] Integration test for feature action button execution in tests/integration/welcome/welcome-actions.test.ts

### Implementation for User Story 2

- [X] T039 [US2] Register 'gatomia.showWelcome' command in src/extension.ts
- [X] T040 [US2] Add command to package.json contributes.commands section with title "GatomIA: Show Welcome Screen"
- [X] T040a [US2] Add activation events to package.json: "onCommand:gatomia.showWelcome" and "onStartupFinished" (for first-time check)
- [X] T040b [US2] Add welcome screen webview assets to package.json if required by build configuration
- [X] T041 [US2] Implement panel reveal logic in WelcomeScreenPanel.show() method
- [X] T042 [US2] Implement panel focus/singleton behavior (FR-017) in WelcomeScreenPanel.ensurePanel()
- [X] T043 [P] [US2] Create FeaturesSection component in ui/src/features/welcome/components/features-section.tsx with feature cards
- [X] T044 [US2] Define feature actions array in WelcomeScreenProvider.getWelcomeState() for Specs, Prompts, Hooks, Steering
- [X] T045 [US2] Implement welcome/execute-command message handler in WelcomeScreenProvider
- [X] T046 [US2] Add feature action cards for Spec Management (Create Spec, View Specs) in features-section.tsx
- [X] T047 [US2] Add feature action cards for Prompt Management (Open Prompts, Create Prompt) in features-section.tsx
- [X] T048 [US2] Add feature action cards for Hooks (Configure Hooks, View Logs) in features-section.tsx
- [X] T049 [US2] Add feature action cards for Steering (Create Constitution, Edit Constitution) in features-section.tsx
- [X] T050 [US2] Implement command execution via vscode.commands.executeCommand in WelcomeScreenProvider
- [X] T051 [US2] Add error handling for failed command execution with user-facing error messages
- [X] T052 [US2] Add OutputChannel logging for command execution operations

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Users can access welcome screen on-demand and execute feature commands.

---

## Phase 5: User Story 3 - Interactive Configuration Overview (Priority: P2)

**Goal**: Display all GatomIA settings with inline editing for spec system configuration

**Independent Test**: Open Configuration section. Edit spec system selection and paths. Verify changes persist to VS Code settings and UI updates immediately.

### Tests for User Story 3 (TDD - Write First)

- [X] T053 [P] [US3] Unit test for configuration loading in tests/unit/providers/welcome-screen-provider.test.ts
- [X] T054 [P] [US3] Unit test for configuration validation in tests/unit/providers/welcome-screen-provider.test.ts
- [X] T055 [US3] Integration test for configuration editing in tests/integration/welcome/welcome-config.test.ts
- [X] T056 [US3] Integration test for configuration persistence in tests/integration/welcome/welcome-config-persist.test.ts

### Implementation for User Story 3

- [X] T057 [P] [US3] Create ConfigSection component in ui/src/features/welcome/components/config-section.tsx
- [X] T058 [US3] Implement configuration loading in WelcomeScreenProvider.getWelcomeState() from workspace.getConfiguration('gatomia')
- [X] T059 [US3] Create ConfigurationItem interface with editable flag in src/types/welcome.ts
- [X] T060 [US3] Display spec system dropdown (Auto/SpecKit/OpenSpec) with current value in config-section.tsx
- [X] T061 [US3] Display SpecKit paths (specs, memory, templates) with text inputs in config-section.tsx
- [X] T062 [US3] Display OpenSpec path with text input in config-section.tsx
- [X] T063 [US3] Display prompts path with text input in config-section.tsx
- [X] T064 [US3] Display other settings as read-only with values in config-section.tsx
- [X] T065 [US3] Add "Open Full Settings" button that executes workbench.action.openSettings command
- [X] T066 [US3] Implement welcome/update-config message handler in WelcomeScreenProvider
- [X] T067 [US3] Add validation for editable configuration keys (must match exact list: gatomia.specSystem, gatomia.speckit.specsPath, gatomia.speckit.memoryPath, gatomia.speckit.templatesPath, gatomia.openspec.path, gatomia.prompts.path) in WelcomeScreenProvider
- [X] T068 [US3] Add validation for configuration value types before persisting in WelcomeScreenProvider (includes path validation: absolute or relative, valid characters, max 500 chars)
- [X] T069 [US3] Implement configuration persistence via workspace.getConfiguration().update() in WelcomeScreenProvider
- [X] T070 [US3] Implement welcome/config-updated message sending from extension to webview after successful update
- [X] T071 [US3] Update Zustand store with new configuration values on welcome/config-updated message
- [X] T072 [US3] Add error handling for invalid configuration updates with user-facing error messages
- [X] T073 [US3] Add tooltips/help icons for configuration items showing descriptions in config-section.tsx
- [X] T074 [US3] Add OutputChannel logging for configuration operations

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently. Users can edit spec system configuration directly from welcome screen.

---

## Phase 6: User Story 4 - Learning Resources and Documentation (Priority: P3)

**Goal**: Display categorized learning resources with search functionality and external link opening

**Independent Test**: Open Learning section. Browse resources by category. Search by keyword. Click documentation link and verify it opens in browser.

### Tests for User Story 4 (TDD - Write First)

- [X] T075 [P] [US4] Unit test for learning resources loading in tests/unit/services/learning-resources.test.ts
- [X] T076 [P] [US4] Unit test for keyword search in tests/unit/services/learning-resources.test.ts
- [X] T077 [US4] Integration test for learning resources display in tests/integration/welcome/welcome-learning.test.ts
- [X] T078 [US4] Integration test for external link opening in tests/integration/welcome/welcome-links.test.ts

### Implementation for User Story 4

- [X] T079 [P] [US4] Create LearningSection component in ui/src/features/welcome/components/learning-section.tsx
- [X] T080 [US4] Load learning resources from specs/006-welcome-screen/resources.json containing 15 resources across all categories (Getting Started, Advanced Features, Troubleshooting)
- [X] T081 [US4] Implement category filtering logic using resources from resources.json for Getting Started resources (5 items)
- [X] T082 [US4] Implement category filtering logic using resources from resources.json for Advanced Features resources (6 items)
- [X] T083 [US4] Implement category filtering logic using resources from resources.json for Troubleshooting resources (4 items)
- [X] T084 [US4] Implement category filtering UI with tabs or sections in learning-section.tsx (order: Getting Started → Advanced Features → Troubleshooting)
- [X] T085 [US4] Add search input box with real-time filtering in learning-section.tsx
- [X] T086 [US4] Implement keyword search in LearningResources.searchByKeyword() matching title, description, and keywords (sort by relevance score then alphabetical)
- [X] T087 [US4] Handle welcome/search-resources message in WelcomeScreenProvider returning filtered results sorted by relevance
- [X] T088 [US4] Display resource cards with title, description, category, and estimated time in learning-section.tsx
- [X] T089 [US4] Handle welcome/open-external message in WelcomeScreenProvider with URL validation (HTTPS only)
- [X] T090 [US4] Implement external link opening via vscode.env.openExternal in WelcomeScreenProvider
- [X] T091 [US4] Add external link icons to resource cards in learning-section.tsx
- [X] T092 [US4] Add OutputChannel logging for external link operations

**Checkpoint**: At this point, all 4 user stories should work independently. Users can discover and access documentation without leaving VS Code.

---

## Phase 7: User Story 5 - Extension Status and Health Check (Priority: P3)

**Goal**: Display extension health, dependency versions, and recent errors with actionable remediation

**Independent Test**: Open Status section with various system states (missing dependencies, recent errors). Verify accurate status display and remediation actions work.

### Tests for User Story 5 (TDD - Write First)

- [X] T093 [P] [US5] Unit test for diagnostic recording in tests/unit/services/system-diagnostics.test.ts
- [X] T094 [P] [US5] Unit test for 24-hour window cleanup in tests/unit/services/system-diagnostics.test.ts
- [X] T095 [P] [US5] Unit test for 5-entry limit in tests/unit/services/system-diagnostics.test.ts
- [X] T096 [US5] Integration test for status section display in tests/integration/welcome/welcome-status.test.ts
- [X] T097 [US5] Integration test for real-time diagnostic updates in tests/integration/welcome/welcome-diagnostics.test.ts

### Implementation for User Story 5

- [X] T098 [P] [US5] Create StatusSection component in ui/src/features/welcome/components/status-section.tsx
- [X] T099 [US5] Implement extension version display reading from package.json in StatusSection component
- [X] T100 [US5] Implement VS Code version display using vscode.version API in StatusSection component
- [X] T101 [US5] Add changelog link pointing to CHANGELOG.md in repository in StatusSection component
- [X] T102 [US5] Display dependency status with versions (Copilot Chat, SpecKit CLI, OpenSpec CLI) in StatusSection component
- [X] T103 [US5] Implement SystemDiagnostics.recordError() method with timestamp, severity, message, source, suggestedAction (tracks: spec operations, hook execution, prompt generation, dependency detection, config updates, system diagnostics only)
- [X] T104 [US5] Implement SystemDiagnostics.getRecentDiagnostics() filtering by 24-hour window and limiting to 5 entries
- [X] T105 [US5] Implement automatic cleanup of diagnostics older than 24 hours in SystemDiagnostics.cleanup()
- [X] T106 [US5] Display diagnostic list with timestamp, severity icon, message, and suggested action in StatusSection component
- [X] T107 [US5] Implement welcome/diagnostic-added message sending from extension to webview when errors occur
- [X] T108 [US5] Update Zustand store to append new diagnostics on welcome/diagnostic-added message
- [X] T109 [US5] Add install/remediation buttons for missing dependencies in StatusSection (reuse US1 install handlers)
- [X] T110 [US5] Add health status indicators (success/warning/error) for each dependency in StatusSection component
- [X] T111 [US5] Display "All systems healthy" message when no errors and all dependencies present in StatusSection component
- [X] T112 [US5] Integrate SystemDiagnostics.recordError() calls in existing error paths throughout extension
- [X] T113 [US5] Add OutputChannel logging for diagnostics operations

**Checkpoint**: All user stories should now be independently functional. Complete diagnostic and health monitoring available.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T114 [P] Implement main WelcomeApp component in ui/src/features/welcome/welcome-app.tsx orchestrating all sections
- [X] T115 [P] Implement welcome/ready handshake message handling in welcome-app.tsx
- [X] T116 [P] Implement welcome/state message handling to populate initial state in welcome-app.tsx
- [X] T117 [P] Add section navigation with smooth scrolling in welcome-app.tsx
- [X] T118 [P] Implement collapsible sections with expand/collapse UI in section components
- [X] T119 [P] Add welcome screen header with GatomIA branding and version in welcome-app.tsx
- [X] T120 [P] Implement "Don't show on startup" checkbox in welcome-app.tsx
- [X] T121 [P] Handle welcome/update-preference message for dontShowOnStartup in WelcomeScreenProvider
- [X] T122 [P] Implement theme support using VS Code CSS variables (--vscode-foreground, --vscode-button-background, etc.)
- [X] T123 [P] Test welcome screen rendering in both light and dark themes
- [X] T124 [P] Add loading spinner while initial state loads with 2-second timeout indicator
- [X] T125 [P] Implement error boundary in welcome-app.tsx for graceful error handling
- [X] T126 [P] Add welcome screen accessibility attributes (ARIA labels, keyboard navigation)
- [X] T127 [P] Optimize webview bundle size with code splitting for each section
- [X] T128 [P] Add telemetry logging for welcome screen interactions (sections viewed, actions clicked) if telemetry enabled
- [X] T129 [P] Implement welcome/navigate-section message for section navigation tracking
- [X] T130 Performance test: Verify welcome screen loads within 2 seconds under normal conditions (workspace <10,000 files/<100 MB, network <100ms latency, available memory >500 MB, no intensive extension operations)
- [X] T131 Performance test: Verify UI updates within 500ms for all interactions (SC-008)
- [X] T132 Add comprehensive JSDoc comments to all public APIs in extension host classes
- [X] T133 Update README.md with welcome screen feature description and screenshot
- [X] T134 Update CHANGELOG.md with welcome screen feature entry
- [X] T135 Run quickstart.md validation walkthrough end-to-end
- [X] T136 Final review of all OutputChannel logging messages for consistency
- [X] T137 Final review of error handling paths with user-friendly messages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories CAN proceed in parallel (if staffed)
  - Or sequentially in priority order: US1 (P1) → US2 (P2) → US3 (P2) → US4 (P3) → US5 (P3)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - MVP foundation with first-time activation and dependency detection
- **User Story 2 (P2)**: Can start after Foundational - Fully independent, adds command palette access
- **User Story 3 (P2)**: Can start after Foundational - Fully independent, adds configuration editing
- **User Story 4 (P3)**: Can start after Foundational - Fully independent, adds learning resources
- **User Story 5 (P3)**: Can start after Foundational - Fully independent, adds status monitoring

### Within Each User Story

1. **Tests first** (TDD): Write unit tests → Run and verify they FAIL
2. **Core implementation**: Models/services → Providers → Panel integration
3. **UI components**: React components → Message handlers → Store integration
4. **Integration**: Extension ↔ Webview communication
5. **Validation**: Run tests → Verify they PASS
6. **Checkpoint**: Verify story works independently before moving to next

### Parallel Opportunities

**Within Setup (Phase 1)**:
- T002, T003, T004 can run in parallel (different files)

**Within Foundational (Phase 2)**:
- T006, T007 can run in parallel (different service files)
- T014-T018 (US1 tests) can run in parallel (different test files)

**Within User Story 1**:
- T015, T016 can run in parallel (different test files)

**Within User Story 2**:
- T035, T036 can run in parallel (different test files)
- T043 can proceed while other tasks complete

**Within User Story 3**:
- T053, T054 can run in parallel (different test scenarios)
- T057 can start early (UI component independent)

**Within User Story 4**:
- T075, T076 can run in parallel (different test files)
- T079 can start early (UI component)

**Within User Story 5**:
- T093, T094, T095 can run in parallel (different test scenarios)
- T098 can start early (UI component)

**Within Polish (Phase 8)**:
- Most tasks marked [P] can run in parallel (T114-T129)

**Across User Stories** (if multiple developers):
- After Foundational complete: US1, US2, US3, US4, US5 can all proceed in parallel
- Developer A: US1 → US2
- Developer B: US3 → US4  
- Developer C: US5 → Polish

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (write tests first, verify they fail):
Task: T014 - Unit test workspace state tracking
Task: T015 - Unit test Copilot Chat detection
Task: T016 - Unit test first-time activation logic

# Then launch models/services together:
Task: T022 - Copilot Chat detection implementation
Task: T023 - SpecKit CLI detection implementation
Task: T024 - OpenSpec CLI detection implementation
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T013) - **CRITICAL blocking phase**
3. Complete Phase 3: User Story 1 (T014-T034)
4. **STOP and VALIDATE**: 
   - Install extension in fresh workspace
   - Verify welcome screen appears automatically
   - Verify dependency detection works
   - Verify install buttons work
5. Demo/Deploy MVP if ready

### Incremental Delivery

1. **Foundation** (Phase 1-2) → Infrastructure ready
2. **+US1** (Phase 3) → First-time onboarding works → **MVP Checkpoint**
3. **+US2** (Phase 4) → Command palette access → **v0.2 Checkpoint**
4. **+US3** (Phase 5) → Configuration editing → **v0.3 Checkpoint**
5. **+US4** (Phase 6) → Learning resources → **v0.4 Checkpoint**
6. **+US5** (Phase 7) → Health monitoring → **v0.5 Checkpoint**
7. **+Polish** (Phase 8) → Production ready → **v1.0 Release**

Each checkpoint delivers independent value without breaking previous functionality.

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

1. **Developer A**: US1 (P1) → US2 (P2) - Critical path for MVP
2. **Developer B**: US3 (P2) → US4 (P3) - Configuration and learning
3. **Developer C**: US5 (P3) → Polish tasks - Monitoring and refinement

Stories integrate independently without blocking each other.

---

## Validation Checklist

After completing all tasks, verify:

- [ ] Welcome screen appears automatically on first workspace activation (US1)
- [ ] GitHub Copilot Chat detection accurate (US1)
- [ ] SpecKit/OpenSpec CLI detection accurate (US1)
- [ ] Install buttons work for all dependencies (US1)
- [ ] Command palette access via "GatomIA: Show Welcome Screen" works (US2)
- [ ] All feature action buttons execute correct commands (US2)
- [ ] Configuration section displays all settings correctly (US3)
- [ ] Spec system configuration editing persists to VS Code settings (US3)
- [ ] Learning resources display with correct categories (US4)
- [ ] Search functionality filters resources by keyword (US4)
- [ ] External documentation links open in browser (US4)
- [ ] Status section shows extension and dependency versions (US5)
- [ ] Recent errors display with timestamps and actions (US5)
- [ ] "Don't show on startup" preference persists (US1, US5)
- [ ] Welcome screen supports both light and dark themes (FR-016)
- [ ] No duplicate welcome screen instances can be opened (FR-017)
- [ ] Welcome screen loads within 2 seconds (FR-018, SC-003)
- [ ] UI updates within 500ms for all interactions (SC-008)
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Code formatted: `npm run format`

---

## Notes

- [P] tasks = different files, no dependencies within that phase
- [Story] label maps task to specific user story for traceability
- Each user story designed to be independently completable and testable
- TDD enforced: Write tests first, verify they fail, then implement
- Commit after logical groups of tasks
- Stop at checkpoints to validate story independently before proceeding
- Priority order: P1 (MVP) → P2 → P3 for sequential development
- Parallel development possible after Foundational phase complete

---

## Task Summary

- **Total Tasks**: 139
- **Setup**: 4 tasks
- **Foundational**: 9 tasks (blocks all stories)
- **User Story 1 (P1)**: 21 tasks (MVP)
- **User Story 2 (P2)**: 20 tasks (includes package.json updates)
- **User Story 3 (P2)**: 22 tasks
- **User Story 4 (P3)**: 18 tasks
- **User Story 5 (P3)**: 21 tasks
- **Polish**: 24 tasks

**MVP Scope**: Phase 1-3 (34 tasks) delivers working first-time onboarding with dependency detection.

**Parallel Potential**: 30+ tasks marked [P] can execute concurrently within their phases.
