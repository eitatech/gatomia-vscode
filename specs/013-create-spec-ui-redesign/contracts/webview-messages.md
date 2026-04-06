# Contract: Webview ↔ Extension Host Message Protocol

**Feature**: 013-create-spec-ui-redesign
**Date**: 2026-02-20
**Canonical types file (extension host)**: `src/features/spec/types.ts`
**Canonical types file (webview)**: `ui/src/features/create-spec-view/types.ts`

Both files MUST be kept in sync. Any message type change MUST be applied to both.

---

## Webview → Extension Host

### `create-spec/ready`
Sent on webview mount. Extension responds with `create-spec/init`.

```ts
{ type: "create-spec/ready" }
```

---

### `create-spec/submit`
User clicked the Submit button and all validation passed.

```ts
{
  type: "create-spec/submit";
  payload: {
    description: string;   // trimmed, non-empty
    imageUris: string[];   // file:// URI strings; may be empty
  };
}
```

**Invariants**:
- `description` is always non-empty after trim (validated in webview before sending).
- `imageUris.length` is always 0–5.
- Each entry in `imageUris` is a valid `file://` URI string previously returned by `create-spec/attach-images:result`.

---

### `create-spec/autosave`
Debounced draft persistence request. Sent whenever the description field changes (after a 600 ms debounce). Contains only the fields worth persisting.

```ts
{
  type: "create-spec/autosave";
  payload: {
    description: string;
  };
}
```

---

### `create-spec/close-attempt`
User closed the panel or triggered beforeunload while the form is dirty.

```ts
{
  type: "create-spec/close-attempt";
  payload: {
    hasDirtyChanges: boolean;
  };
}
```

---

### `create-spec/import-markdown:request`
User confirmed the import action (either the field was empty, or the user confirmed the overwrite dialog). Extension opens a file picker filtered to `.md` files.

```ts
{ type: "create-spec/import-markdown:request" }
```

**Extension behaviour**:
1. Open `window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ["md"] } })`.
2. If user cancels → send no response (the webview stays in its current state).
3. Read file bytes. If `bytes.byteLength > 524288` → send error result.
4. If file is empty → send `{ content: "" }` (webview shows warning).
5. Otherwise → send `{ content: decodedText }`.

---

### `create-spec/attach-images:request`
User clicked the "Attach images" button in the toolbar.

```ts
{ type: "create-spec/attach-images:request" }
```

**Extension behaviour**:
1. Determine how many images the user currently has (`currentCount` passed separately — see note below).
2. Open `window.showOpenDialog({ canSelectMany: true, filters: { Images: ["png","jpg","jpeg","gif","webp","svg"] } })`.
3. If user cancels → send no response.
4. Reject non-image files (enforced by `filters`).
5. For each accepted file: read bytes, check size ≤ 10 MB, generate base64 data URL.
6. Enforce cumulative 5-image cap: if `currentCount + selected > 5`, reject all beyond the cap, include `{ capped: true }` in the result so the webview can show a message.
7. Send `create-spec/attach-images:result` with the accepted images.

> **Note**: The webview must include the current attachment count in the request so the extension can enforce the 5-image cap. See updated payload below:

```ts
{
  type: "create-spec/attach-images:request";
  payload: {
    currentCount: number; // 0–5, current attachment count in webview
  };
}
```

---

## Extension Host → Webview

### `create-spec/init`
Sent in response to `create-spec/ready`. Contains persisted draft state and focus instructions.

```ts
{
  type: "create-spec/init";
  payload: {
    draft?: {
      formData: { description: string };
      lastUpdated: number;
    };
    shouldFocusPrimaryField: boolean;
  };
}
```

---

### `create-spec/submit:success`
Spec prompt successfully sent to the chat conversation.

```ts
{ type: "create-spec/submit:success" }
```

**Webview behaviour**: hide submitting indicator, close panel if desired (extension also disposes the panel server-side).

---

### `create-spec/submit:error`
Submission failed (e.g. chat not available, strategy threw).

```ts
{
  type: "create-spec/submit:error";
  payload: {
    message: string; // user-facing error text
  };
}
```

---

### `create-spec/confirm-close`
Response to `create-spec/close-attempt` when the user chose NOT to close (cancelled the discard dialog).

```ts
{
  type: "create-spec/confirm-close";
  payload: {
    shouldClose: false; // always false; if true, extension disposes panel (no message needed)
  };
}
```

---

### `create-spec/focus`
Request focus on the primary description field (sent when the panel is re-revealed).

```ts
{ type: "create-spec/focus" }
```

---

### `create-spec/import-markdown:result`
Result of a markdown file import. One of two shapes:

```ts
// Success
{
  type: "create-spec/import-markdown:result";
  payload: {
    content: string; // file content (may be empty string if file was empty)
    warning?: string; // e.g. "The selected file is empty."
  };
}

// Error
{
  type: "create-spec/import-markdown:result";
  payload: {
    error: string; // e.g. "File exceeds the 512 KB limit."
  };
}
```

**Webview behaviour**:
- On success (no error): populate description field with `content`; if `warning` present, show as info/warning banner.
- On error: show error banner; field unchanged.
- In both cases, `isImporting` is reset to `false`.

---

### `create-spec/attach-images:result`
Result of an image attachment request. One of two shapes:

```ts
// Success (may be partial if cap was hit)
{
  type: "create-spec/attach-images:result";
  payload: {
    images: Array<{
      id: string;       // stable ID for React key and removal
      uri: string;      // file:// URI string
      name: string;     // filename
      dataUrl: string;  // data:image/...;base64,... for thumbnail
    }>;
    capped?: boolean;   // true if some selected files were dropped due to 5-image limit
  };
}

// Error
{
  type: "create-spec/attach-images:result";
  payload: {
    error: string; // e.g. "One or more files exceed the 10 MB size limit."
  };
}
```

**Webview behaviour**:
- On success: append `images` to `attachments` state (not replace).
- If `capped: true`: show a brief info message ("Some images were not added: the 5-image limit was reached.").
- On error: show error banner; attachments unchanged.

---

## Invariants & Error Handling

| Condition | Where enforced |
|---|---|
| `description` non-empty (trimmed) | Webview (before submit message) + Extension (secondary guard) |
| `imageUris.length` ≤ 5 | Webview (state) + Extension (attach:result limits) |
| Image file size ≤ 10 MB per file | Extension host (before sending result) |
| Markdown size ≤ 512 KB | Extension host (before sending result) |
| Only `.md` files for import | OS file picker filter (extension host) |
| Only image MIME types for attach | OS file picker filter (extension host) |
| File picker cancel → no-op | Extension host (check for undefined result from showOpenDialog) |
