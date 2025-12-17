# Tasks: Document Preview & Refinement

**Input**: Design documents from `/specs/001-document-preview/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Follow quickstart guidance for manual validation plus targeted Vitest suites called out per story.

**Organization**: Tasks grouped by user story so each slice can ship independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize preview-specific scaffolding and dependencies

- [X] T001 Scaffold preview panel module at `src/panels/document-preview-panel.ts`
- [X] T002 Add Markdown-it diagram plugins to root `package.json` and `ui/package.json`
- [X] T003 [P] Establish preview feature folder `ui/src/features/preview/` with base index file
- [X] T004 [P] Configure shared Markdown renderer utilities at `ui/src/lib/markdown/preview-renderer.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core plumbing between extension host, webview, and SpecKit services

- [X] T005 Implement `src/services/document-preview-service.ts` to fetch DocumentArtifact payloads via existing SpecKit APIs
- [X] T006 [P] Define preview messaging contracts and types in `src/types/preview.ts`
- [X] T007 Wire VS Code message passing + persistence bridge in `src/extension.ts`
- [X] T008 [P] Register workspace file watchers + stale-session banner dispatcher in `src/extension.ts`
- [X] T009 Create shared preview state store bootstrapper at `ui/src/features/preview/stores/preview-store.ts`
- [X] T010 Add preview edit guard that blocks raw Markdown edits from the webview in `src/extension.ts`

**Checkpoint**: Extension ↔ webview contract ready; user stories can start.

---

## Phase 3: User Story 1 - Preview authored documents without leaving context (Priority: P1) 🎯 MVP

**Goal**: Render any supported document inside a read-only preview webview with diagrams, metadata, and navigation aids.

**Independent Test**: From the Spec Explorer, open each document type and confirm the preview webview renders Markdown + diagrams without exposing the raw file.

### Implementation

- [X] T011 [US1] Connect spec tree selection to preview command in `src/extension.ts`
- [X] T012 [P] [US1] Build webview HTML host + resource loading in `src/panels/document-preview-panel.ts`
- [X] T013 [P] [US1] Implement PreviewApp shell with metadata header in `ui/src/features/preview/preview-app.tsx`
- [X] T014 [P] [US1] Render Markdown + Mermaid/C4 diagrams via `ui/src/lib/markdown/preview-renderer.ts`
- [X] T015 [US1] Add outline/nav aids + section anchors in `ui/src/components/preview/document-outline.tsx`
- [X] T016 [US1] Handle error/unsupported-state UI plus fallback editor CTA in `ui/src/features/preview/states/preview-fallback.tsx`
- [X] T017 [US1] Add integration test covering preview command in `tests/integration/preview/preview-webview.test.ts`
- [X] T018 [US1] Add regression test ensuring preview stays read-only in `tests/integration/preview/preview-readonly.test.ts`

**Checkpoint**: Documents open in preview webview with diagrams and navigation.

---

## Phase 4: User Story 2 - Interact with structured forms directly in the preview (Priority: P2)

**Goal**: Allow users to edit Markdown-embedded form fields within the preview with validation and persistence.

**Independent Test**: Load a document containing forms, change values, and verify they save via the standard pipeline with inline validation feedback.

### Implementation

- [X] T019 [US2] Create form state manager in `ui/src/features/preview/stores/form-store.ts`
- [X] T020 [P] [US2] Build reusable PreviewFormField components in `ui/src/components/forms/preview-form-field.tsx`
- [X] T021 [US2] Implement validation + error messaging in `ui/src/features/preview/hooks/use-form-validation.ts`
- [X] T022 [US2] Persist form deltas to the extension via `ui/src/features/preview/api/form-bridge.ts`
- [X] T023 [US2] Enforce read-only rendering for restricted users inside `ui/src/components/forms/preview-form-field.tsx`
- [X] T024 [US2] Add Vitest coverage for form flows in `ui/tests/preview/forms.spec.tsx`

**Checkpoint**: Structured forms editable (or read-only when required) entirely inside the preview.

---

## Phase 5: User Story 3 - Capture refinement requests from the preview page (Priority: P3)

**Goal**: Provide a "Refine Document" CTA that collects context-rich feedback and submits it to the refinement workflow.

**Independent Test**: Submit a refine request with section references from the preview and verify confirmation plus downstream queue entry.

### Implementation

- [X] T025 [US3] Create Refine CTA + dialog components in `ui/src/components/refine/refine-dialog.tsx`
- [X] T026 [P] [US3] Implement refine payload builder + validations in `ui/src/features/preview/api/refine-bridge.ts`
- [X] T027 [US3] Add refinement gateway wrapper calling `/refinements` contract in `src/services/refinement-gateway.ts`
- [X] T028 [US3] Display confirmation + request ID messaging in `ui/src/features/preview/components/refine-confirmation.tsx`
- [X] T029 [US3] Add unit test for refine submission happy path in `tests/unit/features/documents/refine-request.test.ts`

**Checkpoint**: Users can submit feedback directly from the preview with captured metadata.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Stabilize UX, performance visibility, and observability across stories.

- [X] T030 Add preview load-time + diagram success metrics instrumentation in `src/utils/telemetry.ts`
- [X] T031 [P] Build performance harness asserting SC-001/SC-002 targets in `tests/integration/preview/preview-performance.test.ts`
- [X] T032 [P] Audit accessibility (ARIA labels, focus traps) in `ui/src/components/preview/`
- [X] T033 [P] Refresh quickstart and docs with preview instructions in `specs/001-document-preview/quickstart.md`
- [X] T034 Run lint, type-check, and regression tests (`npm run lint`, `npm run check`, `npm run test`)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup must finish before establishing host/webview plumbing.
- **Phase 2 → User Stories**: Foundational services + messaging (including read-only guard) required before any story work.
- **User Stories (Phases 3–5)**: Can proceed sequentially (P1 → P2 → P3) or in parallel once prerequisites are complete, as they touch largely separate UI modules.
- **Polish (Phase 6)**: Runs after targeted stories are complete.

### User Story Dependency Graph
- US1 (Preview rendering) is the MVP baseline; US2 and US3 depend on preview shell existing.
- US2 (Forms) depends on US1 for base UI but can start once preview shell is routable.
- US3 (Refine) depends on US1 for preview context but not on US2.

## Parallel Execution Opportunities

- **Setup**: T003 and T004 can run parallel to dependency updates.
- **Foundational**: T006, T008, and T009 can proceed once service skeleton (T005) exists.
- **US1**: T012–T014 can run concurrently; T015–T016 follow renderer completion.
- **US2**: T020 and T021 can run in parallel to accelerate form component + validation work.
- **US3**: T026 and T027 can run simultaneously (frontend vs. extension integration).
- **Polish**: T032 and T033 in parallel while instrumentation efforts (T030–T031) are underway.

## Implementation Strategy

1. **MVP Focus**: Complete Phases 1–3 to deliver preview rendering with diagrams, navigation, and enforced read-only behavior before tackling forms/refinement.
2. **Incremental Delivery**: After MVP, layer in US2 (forms) followed by US3 (refinement), validating each via quickstart flows.
3. **Parallel Teams**: One developer can own webview UI (US1/US2) while another handles extension services, refinement gateway, and instrumentation (US1 foundational + US3 + Phase 6).
4. **Quality Gates**: After each story, run targeted Vitest suites plus `npm run test`; conclude with performance harness (T031) to confirm SC-001/SC-002 before release.
