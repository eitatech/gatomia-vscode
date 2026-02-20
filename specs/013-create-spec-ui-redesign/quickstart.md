# Quickstart: Create Spec UI Redesign (013)

**Branch**: `013-create-spec-ui-redesign`
**Feature spec**: `specs/013-create-spec-ui-redesign/spec.md`

---

## Prerequisites

```bash
node --version  # 18.x or later
npm --version   # 9.x or later
```

## Initial Setup

```bash
# Install all dependencies (root and webview)
npm run install:all
```

## Running the Extension Locally

```bash
# Terminal 1: compile everything in watch mode
npm run watch   # builds extension (esbuild) + webview (Vite) simultaneously

# Terminal 2: open VS Code Extension Development Host
# In VS Code, press F5  (or Run → Start Debugging → "Extension + Webview")
```

Once the Extension Development Host opens:
1. Open a workspace folder that uses SpecKit (`.specify/` present) or OpenSpec (`openspec/` present).
2. Run the command `GatomIA: Create New Spec` via the Command Palette (`Cmd+Shift+P`).
3. The redesigned Create Spec panel opens.

---

## Feature-Specific Smoke Tests

### US1 — Single description field

1. Open the Create Spec panel.
2. Verify there is **one** text area labelled "Spec description" (and no other input fields).
3. Type a description and click **Submit**.
4. Verify VS Code Chat opens with the description text.

### US2 — Markdown import

1. Open the panel.
2. Click **Import from file** in the toolbar above the text area.
3. In the system file picker, choose a `.md` file ≤ 512 KB.
4. Verify the description text area is populated with the file content.
5. Repeat with a file > 512 KB — verify an error banner appears.
6. Repeat when the text area already has text — verify an inline overwrite confirmation appears before replacing.

### US3 — Image attachments

1. Open the panel with a description already typed.
2. Click **Attach images** in the toolbar.
3. Select 1–5 image files in the system picker.
4. Verify thumbnails appear in the attachment strip below the toolbar.
5. Click the **×** on a thumbnail — verify it is removed.
6. Try to add more images after already having 5 — verify a "limit reached" message.
7. Submit — verify VS Code Chat opens with both the description and the image files attached.

---

## Running Automated Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (TDD)
npm run test:watch

# Run only the create-spec related tests
npm test -- tests/unit/features/spec/create-spec
npm test -- ui/tests/create-spec

# Coverage report
npm run test:coverage
```

## Code Quality Gate

```bash
# Must pass before any commit
npm run check
```

---

## Key Source Locations

| Area | Path |
|---|---|
| Extension message handlers | `src/features/spec/create-spec-input-controller.ts` |
| Extension type definitions | `src/features/spec/types.ts` |
| Submission strategies | `src/features/spec/spec-submission-strategy.ts` |
| Chat runner utility | `src/utils/chat-prompt-runner.ts` |
| Webview root component | `ui/src/features/create-spec-view/index.tsx` |
| Webview form component | `ui/src/features/create-spec-view/components/create-spec-form.tsx` |
| Webview toolbar | `ui/src/features/create-spec-view/components/spec-toolbar.tsx` |
| Webview image strip | `ui/src/features/create-spec-view/components/image-attachment-strip.tsx` |
| Webview type definitions | `ui/src/features/create-spec-view/types.ts` |
| Webview ↔ Extension bridge | `ui/src/bridge/vscode.ts` |

## Message Protocol Contract

Full typed protocol specification: `specs/013-create-spec-ui-redesign/contracts/webview-messages.md`

---

## Known Limitations

- Image attachment tests require a real VS Code host; the `workspace.fs.readFile` and `window.showOpenDialog` APIs are not available in the Vitest JSDOM environment. Mock them via `vi.mock("vscode")`.
- The `files` parameter on `workbench.action.chat.open` requires VS Code 1.95+. On older builds images will be submitted as description-embedded references; the extension should log a telemetry event and degrade gracefully.
