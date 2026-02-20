# Tasks: Create Spec UI Redesign

**Input**: `specs/013-create-spec-ui-redesign/` — spec.md, plan.md, research.md, data-model.md, contracts/webview-messages.md
**Branch**: `013-create-spec-ui-redesign`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no blocking dependency)
- **[Story]**: Maps to user story (US1, US2, US3) from `spec.md`
- Exact file paths required in all implementation tasks

---

## Phase 1: Setup

**Purpose**: Confirm green baseline before any changes

- [X] T001 Confirm green test and lint baseline: run `npm test` and `npm run check` and verify both pass with no pre-existing failures

**Checkpoint**: Both commands exit 0 — safe to begin changes

---

## Phase 2: Foundational — Core Types (blocks all user stories)

**Purpose**: Update the type definitions on both sides of the postMessage bridge. Every user story depends on these new types. Must complete before any story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Update `src/features/spec/types.ts` — simplify `CreateSpecFormData` to `{ description: string }`, add `ImageAttachmentMeta` interface, add new message type literals (`create-spec/import-markdown:request`, `create-spec/import-markdown:result`, `create-spec/attach-images:request`, `create-spec/attach-images:result`) and update `CreateSpecWebviewMessage` and `CreateSpecExtensionMessage` union types per `contracts/webview-messages.md`
- [X] T003 [P] Update `ui/src/features/create-spec-view/types.ts` — mirror T002: `CreateSpecFormData → { description: string }`, add webview-side `ImageAttachmentMeta` (full shape with `dataUrl`), add new inbound and outbound message variant types

**Checkpoint**: TypeScript compilation reflects new shapes on both sides — user story implementation can now begin

---

## Phase 3: User Story 1 — Single Description Field (Priority: P1) 🎯 MVP

**Goal**: Replace the 5-field form with a single free-form text area; submit description text to Copilot Chat exactly as before.

**Independent Test**: Open the panel, type a description, submit — verify the text appears in the Copilot Chat conversation. Draft persistence (close and reopen) also testable independently.

### Tests for User Story 1 ⚠️ Write first — must FAIL before implementation

- [X] T004 [P] [US1] Create failing unit tests for `handleSubmit` (simplified form data), `handleAutosave`, `normalizeFormData`, and `migrateDraftFormData` (old 5-field→single-field migration) in `tests/unit/features/spec/create-spec-input-controller.test.ts`
- [X] T005 [P] [US1] Create or update `tests/unit/features/spec/spec-submission-strategy.test.ts` (create the file if it does not yet exist; reference existing patterns in `create-spec-input-controller.test.ts`) — write failing tests expecting new `SpecSubmissionContext` shape `{ description: string; imageUris: string[] }`
- [X] T006 [P] [US1] Write failing tests for single-textarea rendering, submit-blocked-when-empty validation, and form-dirty detection in `ui/tests/create-spec-view/create-spec-form.test.tsx`

### Implementation for User Story 1

- [X] T007 [P] [US1] Implement simplified `SpecSubmissionContext` in `src/features/spec/spec-submission-strategy.ts` — change context to `{ description: string; imageUris: string[] }`, both `OpenSpecStrategy` and `SpecKitStrategy` use `description` directly without multi-field assembly
- [X] T008 [P] [US1] Implement controller changes in `src/features/spec/create-spec-input-controller.ts` — add `migrateDraftFormData()` for legacy 5-field drafts, update `normalizeFormData()` for `{ description }` shape, update `handleSubmit` to pass `imageUris: []` initially, update `handleAutosave` for new shape, update `handleMessage()` switch for new types from T002
- [X] T009 [P] [US1] Rewrite `ui/src/features/create-spec-view/components/create-spec-form.tsx` — single `<textarea>` for description with full-width layout, required-field validation error, and footer (Submit + Cancel buttons); no toolbar yet (added in US2)
- [X] T010 [P] [US1] Simplify `ui/src/features/create-spec-view/index.tsx` — reduce state to `description: string`, remove all 5-field state and multi-ref management, simplify `areFormsDirty()` to compare single string, update `EMPTY_FORM` constant, wire `create-spec/init`, `create-spec/submit`, `create-spec/autosave`, and `create-spec/close-attempt` handlers with new shape

**Checkpoint**: US1 fully functional and independently testable — submit a description to chat. All T004–T006 tests pass.

---

## Phase 4: User Story 2 — Import Spec from Markdown File (Priority: P2)

**Goal**: "Import from file" toolbar button opens the OS file picker (`.md` only), reads the file in the extension host, and loads the content into the description field. Shows inline overwrite confirmation when the field already has text.

**Independent Test**: Click "Import from file", select a `.md` file, verify content fills the text area. Test cancel (field unchanged), >512 KB file (error banner, field unchanged), and overwrite confirm/cancel paths.

### Tests for User Story 2 ⚠️ Write first — must FAIL before implementation

- [X] T011 [P] [US2] Write failing tests for `handleImportMarkdownRequest` in `tests/unit/features/spec/create-spec-input-controller.test.ts` — covers: success (content returned), file >512 KB (error result), user cancels picker (no message sent), and empty file (content `""` with warning)
- [X] T012 [P] [US2] Write failing tests for toolbar render ("Import from file" button present), import button click sends `create-spec/import-markdown:request`, and inline overwrite confirmation banner show/confirm/cancel behavior in `ui/tests/create-spec-view/create-spec-form.test.tsx`

### Implementation for User Story 2

- [X] T013 [US2] Add `handleImportMarkdownRequest()` private method to `src/features/spec/create-spec-input-controller.ts` — call `window.showOpenDialog` filtered to `.md`, check cancellation, read bytes via `workspace.fs.readFile`, validate size ≤ 512 KB, decode to UTF-8 string, send `create-spec/import-markdown:result` with `{ content }` or `{ error }` per contract; define `MARKDOWN_SIZE_LIMIT_BYTES` as top-level constant; **add telemetry** — emit a success event (`createSpec.importMarkdown`, include `fileSize` property) and an error event (`createSpec.importMarkdownError`, include `reason`: `'sizeLimitExceeded'` | `'cancelled'` | `'readError'`)
- [X] T014 [US2] Create `ui/src/features/create-spec-view/components/spec-toolbar.tsx` — compact row with "Import from file" button; empty slot/placeholder for the attach-images button added in US3; receives `onImport: () => void` and `isImporting: boolean` props
- [X] T015 [US2] Update `ui/src/features/create-spec-view/components/create-spec-form.tsx` — add `<SpecToolbar>` above the textarea and an inline `<ImportConfirmBanner>` (shown when `pendingImportConfirm` is `true`) with "Replace" and "Cancel" actions
- [X] T016 [US2] Update `ui/src/features/create-spec-view/index.tsx` — add `pendingImportConfirm: boolean`, `isImporting: boolean`, and `importError: string | undefined` state; add handler for `create-spec/import-markdown:result` that populates description or sets error; implement confirm/cancel logic for the overwrite banner; send `create-spec/import-markdown:request` from toolbar click

**Checkpoint**: US2 fully functional and independently testable — import flow works end-to-end including overwrite confirm, errors, and cancel. All T011–T012 tests pass.

---

## Phase 5: User Story 3 — Attach Images to Specification (Priority: P3)

**Goal**: "Attach images" toolbar button opens a multi-select file picker for image files; up to 5 thumbnails appear in a strip below the toolbar; on submit, images are sent to chat as native VS Code Chat attachments alongside the description.

**Independent Test**: Attach 1–3 images, verify thumbnails appear, remove one, submit — verify both description text and image files appear attached in the Copilot Chat conversation.

### Tests for User Story 3 ⚠️ Write first — must FAIL before implementation

- [X] T017 [P] [US3] Write failing tests for `handleAttachImagesRequest` in `tests/unit/features/spec/create-spec-input-controller.test.ts` — covers: success path (returns `ImageAttachmentMeta[]` with base64 thumbnails), 5-image cap enforcement (`capped: true`), user cancels picker (no message sent), file >10 MB (error result), **non-image extension bypass** (when `showOpenDialog` mock returns a URI whose filename has a non-image extension such as `.pdf`, no result message is sent and an error result is emitted — satisfies FR-011 for the case where the OS picker filter is bypassed in tests)
- [X] T018 [P] [US3] Write failing tests for `image-attachment-strip.tsx` rendering in `ui/tests/create-spec-view/image-attachment-strip.test.tsx` — covers: renders one `<img>` per attachment, each has a remove button calling `onRemove(id)`, strip is hidden when `attachments` is empty, names are displayed

### Implementation for User Story 3

- [X] T019 [US3] Update `src/utils/chat-prompt-runner.ts` — add optional `files?: vscode.Uri[]` parameter to `sendPromptToChat`, spread `files` into the `workbench.action.chat.open` `executeCommand` call when the array is non-empty; maintain full backward compatibility (no existing callers break); **version degradation**: before including `files`, check that VS Code supports the parameter (e.g. test `vscode.version >= '1.95.0'` or guard with a try/catch on the extended call); if not supported, execute the command without `files` and emit a telemetry event `createSpec.imageAttachFallback`; add a test that mocks an older VS Code version and asserts the command still succeeds
- [X] T020 [US3] Add `handleAttachImagesRequest(currentCount: number)` private method to `src/features/spec/create-spec-input-controller.ts` — call `window.showOpenDialog` with `canSelectMany: true` filtered to image extensions, validate each file ≤ 10 MB, generate base64 `dataUrl` thumbnail via `workspace.fs.readFile`, enforce cumulative 5-image cap (set `capped: true` when limit reached), send `create-spec/attach-images:result`; define `IMAGE_MAX_SIZE_BYTES` and `IMAGE_EXTENSIONS` as top-level constants; **add telemetry** — emit a success event (`createSpec.attachImages`, include `count` and `totalBytes` properties) and an error event (`createSpec.attachImagesError`, include `reason`: `'sizeLimitExceeded'` | `'cancelled'` | `'capReached'`); **thumbnail strategy (document this decision)**: send full-size raw bytes as base64 `dataUrl` (accepted tradeoff given 10 MB per-file limit and max 5 images); thumbnails are display-only and CSS `max-width`/`max-height` constrains rendering — no server-side resize required
- [X] T021 [US3] Update `handleSubmit` in `src/features/spec/create-spec-input-controller.ts` and `src/features/spec/spec-submission-strategy.ts` — pass `imageUris.map(vscode.Uri.parse)` as `files` to `sendPromptToChat` when `imageUris` is non-empty
- [X] T022 [US3] Create `ui/src/features/create-spec-view/components/image-attachment-strip.tsx` — horizontal strip component displaying one thumbnail card per `ImageAttachmentMeta`; each card shows `<img src={dataUrl}>`, filename, and a remove "×" button; strip renders `null` when `attachments` is empty; `onRemove(id: string)` prop required
- [X] T023 [US3] Update `ui/src/features/create-spec-view/components/spec-toolbar.tsx` — add "Attach images" button alongside the import button; receives `onAttach: () => void`, `isAttaching: boolean`, and `attachCount: number` (disable "Attach" when `attachCount >= 5`) props
- [X] T024 [US3] Update `ui/src/features/create-spec-view/index.tsx` — add `attachments: ImageAttachmentMeta[]` state, add handler for `create-spec/attach-images:result` that appends new images (or shows error), add `handleRemoveAttachment(id)` to splice attachments array, wire `attachCount` prop to toolbar, render `<ImageAttachmentStrip>` below toolbar, update submit payload to include `imageUris: attachments.map(a => a.uri)`

**Checkpoint**: US3 fully functional and independently testable — images attach, preview, remove, and submit correctly. All T017–T018 tests pass.

---

## Final Phase: Polish & Quality Gate

- [X] T025 [P] Run `npm test` — verify all tests across extension and webview pass (zero failures)
- [X] T026 [P] Run `npm run check` — verify Biome linter and formatter clean (zero errors); confirm: (a) all regex **literals** are defined as top-level constants (Biome `useTopLevelRegex` rule — e.g. `IMAGE_EXTENSIONS_PATTERN`), and (b) all numeric size limits are top-level constants (e.g. `MARKDOWN_SIZE_LIMIT_BYTES`, `IMAGE_MAX_SIZE_BYTES`)
- [ ] T027 Manual smoke test: follow `specs/013-create-spec-ui-redesign/quickstart.md` — verify US1 (submit description), US2 (import markdown with overwrite confirm), and US3 (attach images + submit) all work end-to-end in the Extension Development Host

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phases 3–5)**: All depend on Foundational completion; can proceed in priority order or in parallel
- **Polish (Final)**: Depends on all desired user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Foundational — no dependency on US2 or US3
- **US2 (P2)**: Can start after Foundational — no dependency on US1 (separate code paths: import handler + toolbar)
- **US3 (P3)**: Can start after Foundational — depends on the `spec-toolbar.tsx` component stub created in US2 (T014) for the toolbar slot, but can start in parallel and merge the toolbar addition

### Within Each User Story

- All Tests [P] within a story must be written and confirmed FAILING before implementation begins
- Tests for different files within a story can be written in parallel
- Implementation tasks [P] with different files can run in parallel
- Same-file implementation tasks must be sequential

---

## Parallel Opportunities

### Phase 2 (Foundational)
```
T002 [P] src/features/spec/types.ts
T003 [P] ui/src/features/create-spec-view/types.ts
```
→ Different projects, no cross-dependency

### Phase 3 — US1 Tests
```
T004 [P] tests/unit/features/spec/create-spec-input-controller.test.ts
T005 [P] tests/unit/features/spec/spec-submission-strategy.test.ts
T006 [P] ui/tests/create-spec-view/create-spec-form.test.tsx
```
→ Three separate test files, all independent

### Phase 3 — US1 Implementation
```
T007 [P] src/features/spec/spec-submission-strategy.ts
T008 [P] src/features/spec/create-spec-input-controller.ts
T009 [P] ui/src/features/create-spec-view/components/create-spec-form.tsx
T010 [P] ui/src/features/create-spec-view/index.tsx
```
→ Four separate files; T007 and T008 both depend on T002 types but not each other

### Phase 4 — US2 Tests
```
T011 [P] tests/unit/features/spec/create-spec-input-controller.test.ts
T012 [P] ui/tests/create-spec-view/create-spec-form.test.tsx
```

### Phase 5 — US3 Tests
```
T017 [P] tests/unit/features/spec/create-spec-input-controller.test.ts
T018 [P] ui/tests/create-spec-view/image-attachment-strip.test.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational types (T002–T003)
3. Complete Phase 3: US1 (T004–T010)
4. **STOP and VALIDATE**: `npm test`, `npm run check`, manual US1 smoke test
5. The panel is usable with a single text area — MVP delivered

### Incremental Delivery

1. Setup + Foundational → types ready
2. US1 → single-field submit (MVP)
3. US2 → adds markdown import
4. US3 → adds image attachments
5. Each story adds value without breaking earlier stories

### Suggested Execution Order (single developer)

```
T001 → T002+T003 → T004+T005+T006 → T007+T008 → T009+T010
     → T011+T012 → T013 → T014 → T015 → T016
     → T017+T018 → T019 → T020 → T021 → T022 → T023 → T024
     → T025+T026 → T027
```
