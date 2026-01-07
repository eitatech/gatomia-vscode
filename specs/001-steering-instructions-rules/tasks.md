# Tasks: Steering Instructions & Rules

**Input**: Design documents from `/specs/001-steering-instructions-rules/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md), [contracts/steering-instructions-rules.yaml](contracts/steering-instructions-rules.yaml)

**Tests**: Included (TDD approach) because the project constitution requires test-first development.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- **File paths**: Each task includes exact locations in the repository

---

## Phase 1: Setup & Preparation

**Purpose**: Baseline verification and alignment with the plan/spec

- [x] T001 Review requirements and acceptance scenarios in specs/001-steering-instructions-rules/spec.md
- [x] T002 Review technical approach in specs/001-steering-instructions-rules/plan.md
- [x] T003 Review quickstart validation flow in specs/001-steering-instructions-rules/quickstart.md
- [x] T004 Confirm quality gate command and expectations in AGENTS.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared helpers + test scaffolding needed by all user stories

**CRITICAL**: Complete this phase before implementing any user story logic.

### Tests (write first)

- [x] T005 [P] Add unit tests for name normalization and template generation in src/features/steering/instruction-rules.test.ts
- [x] T006 [P] Add unit tests for safe path resolution (project + user dirs) in src/features/steering/instruction-rules.test.ts

### Implementation

- [x] T007 Create instruction utilities in src/features/steering/instruction-rules.ts (normalize-to-kebab-case, compute dirs, build template)
- [x] T008 Implement “no overwrite by default” helper (exists-check + actionable error message) in src/features/steering/instruction-rules.ts
- [x] T009 Wire tests to pass for instruction utilities in src/features/steering/instruction-rules.test.ts

**Checkpoint**: Shared helpers exist and are fully unit-tested.

---

## Phase 3: User Story 1 - View project + user instructions in Steering (Priority: P1) 🎯 MVP

**Goal**: Steering view lists `.github/instructions/*.instructions.md` and `$HOME/.github/instructions/*.instructions.md` and opens files.

**Independent Test**: Open Steering view → see instruction items for both scopes → click item → document opens.

### Tests for User Story 1 (write first)

- [x] T010 [P] [US1] Add provider tests for listing project instruction rules in src/providers/steering-explorer-provider.test.ts
- [x] T011 [P] [US1] Add provider tests for listing user instruction rules in src/providers/steering-explorer-provider.test.ts
- [x] T012 [P] [US1] Add provider tests for filtering by `.instructions.md` suffix in src/providers/steering-explorer-provider.test.ts

### Implementation for User Story 1

- [x] T013 [US1] Add project instruction group + children in src/providers/steering-explorer-provider.ts (list `.github/instructions/*.instructions.md`)
- [x] T014 [US1] Add user instruction group + children in src/providers/steering-explorer-provider.ts (list `$HOME/.github/instructions/*.instructions.md`)
- [x] T015 [US1] Ensure instruction items open in editor on selection in src/providers/steering-explorer-provider.ts
- [x] T016 [US1] Add user-facing error handling for unreadable directories in src/providers/steering-explorer-provider.ts

**Checkpoint**: US1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Create a project rule (Priority: P2)

**Goal**: Prompt for name → create `.github/instructions/<name>.instructions.md` with template → refresh list.

**Independent Test**: Trigger Create Project Rule → enter `TypeScript Rules` → file created → visible in Steering list.

### Tests for User Story 2 (write first)

- [x] T017 [P] [US2] Add tests for successful project rule creation in src/features/steering/steering-manager.test.ts
- [x] T018 [P] [US2] Add tests for "directory missing → created" in src/features/steering/steering-manager.test.ts
- [x] T019 [P] [US2] Add tests for "file exists → do not overwrite + actionable message" in src/features/steering/steering-manager.test.ts
- [x] T020 [P] [US2] Add tests for normalization (`TypeScript Rules` → `typescript-rules.instructions.md`) in src/features/steering/steering-manager.test.ts

### Implementation for User Story 2

- [x] T021 [US2] Implement `createProjectInstructionRule()` in src/features/steering/steering-manager.ts (prompt, normalize, create dir, write file, open doc)
- [x] T022 [US2] Update command handler to call the new method in src/extension.ts (command: `gatomia.steering.createProjectRule`)
- [x] T023 [US2] Ensure Steering tree refresh after creation in src/extension.ts (call `steeringExplorer.refresh()` after success)

**Checkpoint**: US2 works independently (even if US1 listing is not implemented yet).

---

## Phase 5: User Story 3 - Create a user rule (Priority: P3)

**Goal**: Prompt for name → create `$HOME/.github/instructions/<name>.instructions.md` with template → refresh list.

**Independent Test**: Trigger Create User Rule → enter `TypeScript Rules` → file created in home dir path → visible in Steering list.

### Tests for User Story 3 (write first)

- [x] T024 [P] [US3] Add tests for successful user rule creation in src/features/steering/steering-manager.test.ts
- [x] T025 [P] [US3] Add tests for "home instructions dir missing → created" in src/features/steering/steering-manager.test.ts
- [x] T026 [P] [US3] Add tests for "file exists → do not overwrite + actionable message" in src/features/steering/steering-manager.test.ts

### Implementation for User Story 3

- [x] T027 [US3] Implement `createUserInstructionRule()` in src/features/steering/steering-manager.ts (prompt, normalize, create dir, write file, open doc)
- [x] T028 [US3] Update command handler to call the new method in src/extension.ts (command: `gatomia.steering.createUserRule`)
- [x] T029 [US3] Ensure Steering tree refresh after creation in src/extension.ts (call `steeringExplorer.refresh()` after success)

**Checkpoint**: US3 works independently.

---

## Phase 6: User Story 4 - Request a Constitution document (Priority: P4)

**Goal**: Prompt for short description → send `/speckit.constitution <description>` via chat integration → no post-processing.

**Independent Test**: Trigger Create Constitution → enter short description → Copilot Chat opens with correct prompt.

### Tests for User Story 4 (write first)

- [X] T030 [P] [US4] Add tests for constitution request sending `/speckit.constitution ...` in src/features/steering/steering-manager.test.ts
- [X] T031 [P] [US4] Add tests for cancel/empty description (no chat request) in src/features/steering/steering-manager.test.ts

### Implementation for User Story 4

- [X] T032 [US4] Add command contribution `gatomia.steering.createConstitution` in package.json
- [X] T033 [US4] Register command handler in src/extension.ts to call a new method on `SteeringManager`
- [X] T034 [US4] Implement `createConstitutionRequest()` in src/features/steering/steering-manager.ts (prompt + `sendPromptToChat()`)
- [X] T035 [US4] Add Steering view welcome/links button for Create Constitution in package.json

**Checkpoint**: US4 works independently and performs no agent post-processing.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, docs, and final validation across all stories

- [X] T036 Update Steering documentation to include new instruction rules + constitution entry point in README.md
- [X] T037 Ensure all user-facing messages are actionable and consistent in src/features/steering/steering-manager.ts
- [X] T038 Run focused test suite for steering + provider changes (Vitest) and fix failures: src/features/steering/steering-manager.test.ts, src/providers/steering-explorer-provider.test.ts
- [X] T039 Run full quality gate `npm run check` and fix any violations (Biome/Ultracite) per AGENTS.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories
- **User Stories (Phase 3–6)**: Depend on Foundational
- **Polish (Phase 7)**: Depends on all desired user stories

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only
- **US2 (P2)**: Depends on Phase 2 only (can be implemented without US1; refresh becomes visible once US1 exists)
- **US3 (P3)**: Depends on Phase 2 only (same as US2)
- **US4 (P4)**: Depends on Phase 2 only

### Parallel Opportunities

- Provider tests (T010–T012) can be written in parallel.
- Steering manager tests for US2/US3/US4 can be written in parallel (different test cases in the same file, but coordinate to avoid merge conflicts).
- US2 and US3 implementation can proceed in parallel once Phase 2 is complete.

---

## Parallel Example: User Story 1

```bash
Task: T010 [US1] Provider tests for project listing
Task: T011 [US1] Provider tests for user listing
Task: T012 [US1] Provider tests for suffix filtering
```

---

## Parallel Example: User Story 2

```bash
Task: T017 [US2] Test successful creation
Task: T019 [US2] Test no-overwrite behavior
Task: T020 [US2] Test name normalization
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Complete US1 (Phase 3)
3. Validate via quickstart instructions in specs/001-steering-instructions-rules/quickstart.md

### Incremental Delivery

- Add US2 → validate independently
- Add US3 → validate independently
- Add US4 → validate independently
- Finish with Phase 7 polish
