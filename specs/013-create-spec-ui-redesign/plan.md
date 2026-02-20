# Implementation Plan: Create Spec UI Redesign

**Branch**: `013-create-spec-ui-redesign` | **Date**: 2026-02-20 | **Spec**: `specs/013-create-spec-ui-redesign/spec.md`
**Input**: Feature specification from `specs/013-create-spec-ui-redesign/spec.md`

## Summary

Redesign the "Create New Spec" panel from a 5-field form to a single description text area with a toolbar offering markdown file import (FR-001 through FR-006) and image attachment (FR-007 through FR-011). On submission the existing `sendPromptToChat` mechanism is extended to pass a `files: Uri[]` parameter so VS Code Chat receives both the description prompt and any attached images natively.

The implementation is entirely within the existing extension panel lifecycle managed by `create-spec-input-controller.ts` and the React webview in `ui/src/features/create-spec-view/`. No new services, providers, or panels are introduced.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict mode, target ES2022)
**Primary Dependencies**: VS Code Extension API 1.84.0+; React 18.3+ (webview); Vite (webview build); esbuild (extension build); Biome (linter/formatter); Vitest 3.2+ (tests)
**Storage**: `context.workspaceState` — key `createSpecDraftState`; shape `{ formData: { description: string }; lastUpdated: number }`. Draft migration required for old 5-field shape.
**Testing**: Vitest + jsdom; VS Code API mocked via `tests/__mocks__/vscode.ts`
**Target Platform**: VS Code Extension Host (Node.js) + webview (browser/jsdom)
**Project Type**: VS Code extension (dual build: extension + webview)
**Performance Goals**: Markdown read ≤ 512 KB synchronously; image base64 generation ≤ 10 MB per file; debounce autosave at 600 ms
**Constraints**: Webview cannot access file system — all I/O routed through extension host via postMessage. `files` parameter on `workbench.action.chat.open` requires VS Code ≥ 1.95+; graceful degradation required for older builds.
**Scale/Scope**: Single panel; 1 description field; up to 5 image attachments; 1 markdown import per session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — all clear.*

| Gate | Status | Notes |
|---|---|---|
| I. Kebab-case filenames | PASS | All new files follow kebab-case: `spec-toolbar.tsx`, `image-attachment-strip.tsx`; overwrite confirmation is an inline banner inside `create-spec-form.tsx`, not a separate file |
| II. TypeScript strict | PASS | All types explicitly defined in `types.ts` (both sides); no `any` |
| III. TDD — tests before implementation | PASS | Each phase begins with test file creation |
| IV. Observability | PASS | File I/O errors logged with context; submit errors sent to telemetry; no silent failures |
| V. Simplicity / YAGNI | PASS | No new services, providers, or panels; all changes contained within the existing create-spec module |

**Biome rules verified:**
- Regex patterns will be top-level constants (MARKDOWN_SIZE_LIMIT, IMAGE_MIME_PATTERN, etc.)
- No variable shadowing in new code
- Function complexity kept below 15 (file read and thumbnail generation extracted to helpers)

## Project Structure

### Documentation (this feature)

```text
specs/013-create-spec-ui-redesign/
├── spec.md              # Fully clarified feature spec
├── plan.md              # This file
├── research.md          # Phase 0: 8 architectural decisions
├── data-model.md        # Phase 1: types, message protocol, state transitions
├── quickstart.md        # Phase 1: dev setup + smoke tests
├── checklists/
│   └── requirements.md
└── contracts/
    └── webview-messages.md  # Full typed message protocol
```

### Source Code

```text
src/features/spec/
├── types.ts                        # MODIFY: simplify CreateSpecFormData, add new message types
├── create-spec-input-controller.ts # MODIFY: add import/attach handlers, update submit
└── spec-submission-strategy.ts     # MODIFY: SpecSubmissionContext → { description, imageUris }

src/utils/
└── chat-prompt-runner.ts           # MODIFY: add optional files?: Uri[] param

tests/unit/features/spec/
├── create-spec-input-controller.test.ts   # NEW: unit tests for new handlers
└── spec-submission-strategy.test.ts       # MODIFY: update for new context shape

ui/src/features/create-spec-view/
├── types.ts                               # MODIFY: simplify form data, add new messages
├── index.tsx                              # MODIFY: single-field + attachment state
└── components/
    ├── create-spec-form.tsx               # MODIFY: complete redesign (single textarea + zones)
    ├── spec-toolbar.tsx                   # NEW: toolbar row with import + attach buttons
    └── image-attachment-strip.tsx         # NEW: horizontal thumbnail strip

ui/tests/create-spec-view/
├── create-spec-form.test.tsx              # NEW: toolbar + form rendering tests
└── image-attachment-strip.test.tsx        # NEW: strip rendering + remove tests
```

**Structure Decision**: Dual-project (extension host + webview). No new top-level directories. All changes are within the existing `features/spec` domain on the extension side and `features/create-spec-view` on the webview side.

## Phase 0: Research (Complete)

**Artifacts**: `specs/013-create-spec-ui-redesign/research.md`

All unknowns resolved. Key decisions:

1. Image delivery uses `workbench.action.chat.open { query, files: Uri[] }` — VS Code Chat native attachment
2. Webview FS constraint confirmed — all file I/O via extension host postMessage
3. Markdown validation (512 KB) in extension host before sending result to webview
4. Draft migration: old 5-field shape concatenated to single `description` on first load
5. Inline import confirmation handled purely in React (no round-trip needed)
6. Thumbnails: base64 data URLs generated in extension host, full URIs reused at submit time
7. `sendPromptToChat` extended with optional `files?: Uri[]` backward-compatibly
8. `SpecSubmissionContext` simplified to `{ description: string; imageUris: string[] }`

## Phase 1: Design (Complete)

**Artifacts**: `data-model.md`, `contracts/webview-messages.md`, `quickstart.md`

All types, message shapes, and behavioral contracts are specified. No open questions remain.

## Phase 2: Implementation

### Prerequisites

- [ ] `npm run install:all` — confirm dependencies installed
- [ ] `npm test` — confirm tests currently passing (green baseline)
- [ ] `npm run check` — confirm linter passing (clean baseline)

### Step 1 — Extension Types (TDD first)

**Test file**: `tests/unit/features/spec/create-spec-input-controller.test.ts`

Write failing tests for:
- `handleImportMarkdownRequest` opens file picker and returns content
- `handleImportMarkdownRequest` returns error when file > 512 KB
- `handleImportMarkdownRequest` no-ops when user cancels picker
- `handleAttachImagesRequest` opens multi-select picker and returns base64 thumbnails
- `handleAttachImagesRequest` enforces 5-image cap with `capped: true`
- `handleAttachImagesRequest` no-ops when user cancels picker
- `handleSubmit` passes `imageUris` to submission strategy
- Draft migration: old 5-field draft is converted to single `description`

**Implementation**:
1. Update `src/features/spec/types.ts`:
   - Simplify `CreateSpecFormData` to `{ description: string }`
   - Add `ImageAttachmentMeta` interface
   - Add new message type literals and union types per contract
2. Update `src/features/spec/create-spec-input-controller.ts`:
   - Add `handleImportMarkdownRequest()` private method
   - Add `handleAttachImagesRequest(currentCount: number)` private method
   - Update `normalizeFormData()` for new shape
   - Add `migrateDraftFormData()` for legacy 5-field drafts
   - Wire new cases in `handleMessage()`
3. Update `src/features/spec/spec-submission-strategy.ts`:
   - `SpecSubmissionContext → { description: string; imageUris: string[] }`
   - Both strategies use `description` directly (no more multi-field assembly)
   - Pass `imageUris.map(Uri.parse)` to `sendPromptToChat`
4. Update `src/utils/chat-prompt-runner.ts`:
   - Add optional `files?: Uri[]` parameter
   - Spread `files` into `executeCommand` call when present

### Step 2 — Webview Types

**Test coverage**: existing webview integration tests catch type mismatches at compile time.

1. Update `ui/src/features/create-spec-view/types.ts`:
   - `CreateSpecFormData → { description: string }`
   - Add `ImageAttachmentMeta`
   - Add new inbound/outbound message type literals and unions

### Step 3 — New Webview Components (TDD first)

**Test file**: `ui/tests/create-spec-view/create-spec-form.test.tsx`
**Test file**: `ui/tests/create-spec-view/image-attachment-strip.test.tsx`

Tests for `spec-toolbar.tsx`:
- "Import from file" button visible
- "Attach images" button visible
- Clicking "Import from file" sends `create-spec/import-markdown:request` message
- Clicking "Attach images" sends `create-spec/attach-images:request` with `currentCount`

Tests for `image-attachment-strip.tsx`:
- Renders thumbnails for each attachment
- Clicking "×" on a thumbnail calls `onRemove(id)`
- Strip hidden when `attachments` is empty

**Implementation**:
1. Create `ui/src/features/create-spec-view/components/spec-toolbar.tsx`
2. Create `ui/src/features/create-spec-view/components/image-attachment-strip.tsx`

### Step 4 — Webview Form Redesign (TDD first)

**Test file**: extended `ui/tests/create-spec-view/create-spec-form.test.tsx`

Tests for `create-spec-form.tsx`:
- Renders single `<textarea>` for description
- Shows toolbar above textarea
- Shows image strip when `attachments.length > 0`
- Shows inline overwrite confirmation when import result arrives on non-empty field
- Confirms replace → field updated with imported content
- Cancels replace → field unchanged

**Implementation**:
1. Rewrite `ui/src/features/create-spec-view/components/create-spec-form.tsx`:
   - Zone 1: `<SpecToolbar>` component
   - Zone 2: single `<textarea>` for description
   - Zone 3: `<ImportConfirmBanner>` (inline, conditional)
   - Zone 4: `<ImageAttachmentStrip>` (conditional on attachments)
   - Zone 5: footer (Submit + Cancel)

### Step 5 — Webview Root Component

**Test coverage**: end-to-end message handling validated in form tests + manual smoke test.

1. Update `ui/src/features/create-spec-view/index.tsx`:
   - State: `description: string`, `attachments: ImageAttachmentMeta[]`, `pendingImport: string | null`
   - Remove: all 5-field state, multi-ref management, old areFormsEqual
   - Add handlers for `create-spec/import-markdown:result` and `create-spec/attach-images:result`
   - Update `areFormsDirty()` to compare single description string
   - Update `EMPTY_FORM` constant

### Step 6 — Quality Gate

```bash
npm test       # all tests pass
npm run check  # linter + formatter clean
```

### Step 7 — Manual Smoke Test

Follow scenarios in `specs/013-create-spec-ui-redesign/quickstart.md`:
- US1: single field submission
- US2: markdown import with overwrite confirmation
- US3: image attachment strip + submit with files

## Complexity Tracking

No constitution violations. All architectural choices remain within established patterns. No new abstractions introduced beyond what is directly required (YAGNI).
