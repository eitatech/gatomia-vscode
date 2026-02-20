# Research: Create New Spec UI Redesign

**Phase**: 0 — Outline & Research
**Date**: 2026-02-20
**Feature**: [spec.md](./spec.md)

All `[NEEDS CLARIFICATION]` items from the Technical Context are resolved below.

---

## Decision 1: How images are sent to VS Code Chat

**Decision**: Pass image file URIs as the `files` parameter of `workbench.action.chat.open`.

**Rationale**: The `workbench.action.chat.open` command accepts `{ query: string, files?: Uri[] }`. When `files` is provided, VS Code attaches the files as structured references native to the chat panel — identical to drag-and-dropping an image onto the chat input. This is the "Option C" architecture confirmed by the user. It requires no base64 serialization in the chat prompt itself and leverages the built-in GitHub Copilot image understanding capability.

**How it works end-to-end**:
1. User attaches images in the webview (via toolbar button).
2. Webview sends `create-spec/attach-images:request` to extension host.
3. Extension host opens a system file picker (`window.showOpenDialog`, canSelectMany, image filters).
4. Extension reads each file to generate a base64 thumbnail (`data:image/...;base64,...`) for the webview preview, and holds onto the file URI string.
5. Extension sends `create-spec/attach-images:result` with `{ images: ImageAttachmentMeta[] }` back to the webview.
6. Webview stores the image metadata in React state, renders thumbnail strip.
7. User submits. Webview sends `{ description, imageUris: string[] }`.
8. Extension reconstructs `Uri[]` from the URI strings, calls `sendPromptToChat(prompt, context, imageUris)`.
9. `sendPromptToChat` calls `commands.executeCommand("workbench.action.chat.open", { query, files })`.

**Alternatives considered**:
- Base64 inline in prompt text — rejected (user explicitly chose Option C; also inflates prompt size dramatically for large images).
- Follow-up messages per image — rejected (poor UX; each image would be a separate turn).

**Version constraint**: The `files` parameter for `workbench.action.chat.open` was introduced in VS Code ~1.95. The extension currently declares `engines.vscode: "^1.84.0"`. The feature should degrade gracefully (send without `files` if VS Code version is below 1.95), OR the minimum can be bumped. This is flagged for implementation teams to decide; the spec does not prescribe a VS Code minimum version change.

---

## Decision 2: Webview cannot open file system dialogs directly

**Decision**: All file I/O (showOpenDialog, readFile) must be performed by the extension host. The webview requests them via `postMessage` and receives results via `postMessage`.

**Rationale**: VS Code webviews run in a sandboxed context and have no access to `vscode` APIs. The only way to trigger native OS dialogs or read local files is to send a message to the extension host and receive the result asynchronously.

**Pattern reference**: Already used in this codebase for hooks import (`extension.ts`, `window.showOpenDialog` with file reading via `workspace.fs.readFile`).

**Existing pattern**:
```ts
// extension.ts — hooks import (pattern to follow)
const openUris = await window.showOpenDialog({
  title: "Import Hooks",
  openLabel: "Import",
  canSelectMany: false,
  filters: { JSON: ["json"] },
});
if (!openUris || openUris.length === 0) return; // user cancelled
const bytes = await workspace.fs.readFile(openUris[0]);
const text = Buffer.from(bytes).toString("utf8");
```

---

## Decision 3: Markdown import — file size validation location

**Decision**: Validated in the extension host before sending content to the webview.

**Rationale**: The extension host reads the raw bytes. Byte-length check (`bytes.byteLength > MAX_MARKDOWN_IMPORT_BYTES`) is naturally performed there before decoding. The webview never receives oversized content, which prevents UI jank. If too large, the extension sends an error result instead.

**Limit**: 512 KB (524 288 bytes), as confirmed during spec clarification.

---

## Decision 4: Draft state migration from 5-field to 1-field form

**Decision**: Migrate gracefully by extracting `productContext` from the old draft format if `description` is absent; concatenate all non-empty old fields separated by newlines as the new `description`.

**Rationale**: Draft state is stored in `context.workspaceState` under key `createSpecDraftState`. After the redesign, `formData` changes from `{ productContext, keyScenarios, technicalConstraints, relatedFiles, openQuestions }` to `{ description }`. Any existing draft with the old shape should be hydrated into the new field rather than silently discarded, preserving user-typed content.

**Migration function** (to implement in the controller):
```ts
function migrateDraftFormData(raw: unknown): { description: string } {
  if (!raw || typeof raw !== "object") return { description: "" };
  const r = raw as Record<string, unknown>;
  if (typeof r.description === "string") return { description: r.description };
  // Old format — concatenate non-empty fields
  const parts = [r.productContext, r.keyScenarios, r.technicalConstraints,
                 r.relatedFiles, r.openQuestions]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return { description: parts.join("\n\n") };
}
```

---

## Decision 5: Inline confirmation for import-over-existing-text

**Decision**: The webview handles this entirely in the React layer, without involving the extension host.

**Rationale**: The webview already knows whether the text area has content — no round-trip to the extension is needed. When the user clicks "Import from file":
1. If the description field is empty → immediately send `create-spec/import-markdown:request`.
2. If description field has content → render an inline confirmation prompt first. Only on confirm → send `create-spec/import-markdown:request`.

This keeps the import request protocol simple (no "pending confirmation" state on the extension side).

---

## Decision 6: Image thumbnail generation

**Decision**: Extension host generates base64 data URIs for thumbnails and sends them to the webview.

**Rationale**: The webview cannot use `vscode.Uri.file(...)` directly. Thumbnails must be renderable as `<img src="...">` inside the sandboxed webview. Base64 data URIs are the only safe format. The full resolution image data is kept as a file URI string (not loaded into memory fully) solely for passing to `commands.executeCommand` at submission time.

**File URI ownership**: The webview stores image entries as `{ id, uri: string, name, dataUrl: string }`. At submit time it sends `{ description, imageUris: string[] }`. The extension reconstructs `Uri.parse(uriString)` for each.

---

## Decision 7: `sendPromptToChat` signature extension

**Decision**: Add an optional third parameter `files?: Uri[]` that is spread into the `executeCommand` call.

**Pattern**:
```ts
export const sendPromptToChat = async (
  prompt: string,
  context?: ChatContext,
  files?: Uri[]
): Promise<void> => {
  // ... existing prompt construction ...
  await commands.executeCommand("workbench.action.chat.open", {
    query: finalPrompt,
    ...(files && files.length > 0 ? { files } : {}),
  });
};
```

This is backward-compatible (all existing callers pass no `files` argument).

---

## Decision 8: `SpecSubmissionContext` simplification

**Decision**: Replace the 5-field `SpecSubmissionContext` with a 2-field version: `{ description: string; imageUris: string[] }`.

**Rationale**: The new UI collapses all fields into a single `description` textarea. The strategies (`OpenSpecSubmissionStrategy`, `SpecKitSubmissionStrategy`) will use `description` directly as the payload, replacing the old `formatDescription` multi-section assembler.

**Migration impact on strategies**:
- `OpenSpecSubmissionStrategy` — passes `description` directly to the prompt template (no multi-section formatting needed).
- `SpecKitSubmissionStrategy` — sends `/speckit.specify ${description}`.

---

## Technologies confirmed

| Technology | Version / Notes |
|---|---|
| TypeScript | 5.3+ strict mode |
| React | 18.3+ (webview) |
| Vitest | 3.2+ |
| VS Code Extension API | 1.84.0+ minimum; `files` param for chat needs ~1.95+ |
| Biome | Linter/formatter — top-level regex constants mandatory |
| `workspace.fs.readFile` | Used for local file reading in extension host |
| `window.showOpenDialog` | Used for OS file picker |
| `commands.executeCommand("workbench.action.chat.open")` | For chat submission |
