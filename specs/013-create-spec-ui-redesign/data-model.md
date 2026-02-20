# Data Model: Create New Spec UI Redesign

**Phase**: 1 — Design
**Date**: 2026-02-20
**References**: [research.md](./research.md), [spec.md](./spec.md)

---

## Overview of Changes

The redesign reduces the form from five structured fields to a single free-form description field, and adds image attachment metadata. All data flows through the existing webview–extension message passing protocol; no new persistent storage is introduced.

---

## Core Types

### `CreateSpecFormData` (simplified)

Replaces the existing 5-field structure in both `src/features/spec/types.ts` and `ui/src/features/create-spec-view/types.ts`.

```ts
// Was: { productContext, keyScenarios, technicalConstraints, relatedFiles, openQuestions }
// Now:
interface CreateSpecFormData {
  description: string;
}
```

### `ImageAttachmentMeta`

New type representing an image that the user attached in the webview. Lives in both `ui/src/features/create-spec-view/types.ts` and `src/features/spec/types.ts` (the extension-side mirror uses only `uri` and `name`).

```ts
// ui/src/features/create-spec-view/types.ts (webview-side — full shape)
interface ImageAttachmentMeta {
  id: string;       // unique local ID (crypto.randomUUID() or incrementing number string)
  uri: string;      // file:// URI string — passed back to extension at submit time
  name: string;     // filename for display (e.g. "screenshot.png")
  dataUrl: string;  // data:image/png;base64,... — used only for <img> thumbnail
}
```

### `CreateSpecDraftState` (unchanged shape, new field)

```ts
interface CreateSpecDraftState {
  formData: CreateSpecFormData; // now contains { description } instead of 5 fields
  lastUpdated: number;
}
```

Draft migration: if the persisted state has `productContext` (old format), concatenate all non-empty old fields into `description`. See [research.md — Decision 4](./research.md).

### `SpecSubmissionContext` (simplified)

Replaces the 5-field interface in `src/features/spec/spec-submission-strategy.ts`.

```ts
// Was: { productContext, keyScenarios, technicalConstraints, relatedFiles, openQuestions }
// Now:
interface SpecSubmissionContext {
  description: string;
  imageUris: string[]; // file:// URI strings; empty array when no images
}
```

---

## Webview State Model

The `CreateSpecView` React component manages:

| State variable | Type | Description |
|---|---|---|
| `description` | `string` | The main text area value |
| `attachments` | `ImageAttachmentMeta[]` | Currently attached images (max 5) |
| `isSubmitting` | `boolean` | Blocks re-submission while in-flight |
| `fieldError` | `string \| undefined` | Validation error for the description field |
| `submissionError` | `string \| undefined` | Error returned from extension on submit failure |
| `importError` | `string \| undefined` | Error or warning from markdown import |
| `isImporting` | `boolean` | Blocks concurrent import requests |
| `closeWarningVisible` | `boolean` | Shows "Changes discarded" banner if close was cancelled |
| `draftSavedAt` | `number \| undefined` | Timestamp of last persisted draft |
| `pendingImportConfirm` | `boolean` | True when inline overwrite confirmation is shown |

---

## Message Protocol

### Webview → Extension

| Message type | Payload | Description |
|---|---|---|
| `create-spec/ready` | — | Webview mounted, request init state |
| `create-spec/submit` | `{ description: string; imageUris: string[] }` | User clicked submit |
| `create-spec/autosave` | `{ description: string }` | Debounced draft save |
| `create-spec/close-attempt` | `{ hasDirtyChanges: boolean }` | User closed the panel or navigated away |
| `create-spec/import-markdown:request` | — | User confirmed file import; open file picker |
| `create-spec/attach-images:request` | `{ currentCount: number }` | User clicked attach images; open file picker. Extension uses `currentCount` to enforce the 5-image cap before processing the picker result. |

### Extension → Webview

| Message type | Payload | Description |
|---|---|---|
| `create-spec/init` | `{ draft?: CreateSpecDraftState; shouldFocusPrimaryField: boolean }` | Panel initialised |
| `create-spec/submit:success` | — | Submission sent to chat successfully |
| `create-spec/submit:error` | `{ message: string }` | Submission failed |
| `create-spec/confirm-close` | `{ shouldClose: boolean }` | Response to close-attempt |
| `create-spec/focus` | — | Request focus on primary field |
| `create-spec/import-markdown:result` | `{ content: string } \| { error: string }` | File content or error (size exceeded, etc.) |
| `create-spec/attach-images:result` | `{ images: ImageAttachmentMeta[] } \| { error: string }` | Attached image metadata or error |

---

## Entities

| Entity | Owner | Persistence | Notes |
|---|---|---|---|
| `CreateSpecFormData` | Extension + Webview | `workspaceState` (draft only) | Single `description` field |
| `CreateSpecDraftState` | Extension | `workspaceState` key `createSpecDraftState` | Survives panel close within VS Code session |
| `ImageAttachmentMeta` | Webview only | None (in-memory React state only) | Not persisted; lost on panel close |
| `SpecSubmissionContext` | Extension | None | Transient; built at submit time |

---

## State Transitions

```
[Empty form]
     │ user types
     ▼
[Dirty form] ──── auto-save debounce ──► [Draft persisted]
     │
     │ user clicks "Import from file" (field empty)
     ▼
     → postMessage import-markdown:request
     → extension reads file, validates
     → postMessage import-markdown:result { content }
     → [Field populated with imported content]
     │
     │ user clicks "Import from file" (field has content)
     ▼
     → inline confirm shown (pendingImportConfirm = true)
     → user confirms → postMessage import-markdown:request
     → user cancels  → pendingImportConfirm = false (no change)
     │
     │ user clicks "Attach images"
     ▼
     → postMessage attach-images:request
     → extension opens file picker
     → postMessage attach-images:result { images }
     → [Thumbnails shown; up to 5 total enforced in extension]
     │
     │ user submits
     ▼
     → validation (description not empty) → error if fails
     → postMessage submit { description, imageUris }
     → extension: build prompt → sendPromptToChat(prompt, ctx, files)
     → postMessage submit:success → panel disposed
```
