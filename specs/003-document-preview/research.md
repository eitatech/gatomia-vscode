# Research: Document Preview & Refinement

## Rendering stack
Decision: Extend the existing Markdown-it toolchain in the webview with mermaid and C4 plugin adapters so every supported syntax renders inside a single React entry point.
Rationale: Markdown-it already powers prompt previews, so reusing it minimizes bundle size, keeps SSR-compatible parsing, and only requires adding diagram plugins plus CSS tailored to the webview theme.
Alternatives considered: Client-side convert to HTML via VS Code's Markdown engine (harder to intercept for forms) ; server-side rendering (not possible offline) ; bespoke renderer per syntax (higher maintenance and inconsistent layout).

## Form state + persistence
Decision: Keep form interactions entirely inside the React webview with a dedicated store (e.g., Zustand) and sync deltas to the extension via VS Code message passing before writes.
Rationale: Local state guarantees responsive inputs even for large documents and allows validation before hitting filesystem APIs, while message passing already exists for other SpecKit flows.
Alternatives considered: Editing the raw Markdown in-place (risks merge conflicts and violates "no accidental edits") ; pushing every keystroke to the extension (adds chatter and latency) ; bypassing forms until a backend rewrite (blocks the feature’s main promise).

## Refinement request channel
Decision: Reuse the current SpecKit refinement handler (same endpoint/command used by editor-based refine) but enrich payloads with preview metadata (document id, section anchor, timestamp, preview session id).
Rationale: Keeps downstream automation untouched while giving reviewers the extra context they need to act on preview-submitted feedback.
Alternatives considered: Creating a brand-new refine queue (would split triage) ; writing comments back into the Markdown (breaks clear separation between source and feedback) ; deferring refinement capture until a future release (would fail success criteria SC-004).

## Concurrent document updates
Decision: Watch workspace file events; if the active document changes, show a warning toast in the preview with options to save/discard local form edits before manually reloading the freshest content.
Rationale: Aligns with FR-011, prevents silent data loss, and mirrors VS Code’s own dirty-buffer workflow that users already understand.
Alternatives considered: Auto-refresh with merge heuristics (too brittle without full diff UX) ; blocking preview usage after a change (hurts flow) ; ignoring concurrent changes (high risk of stale reviews).

## Accessibility + internationalization
Decision: Adopt VS Code webview accessibility guidelines—preferring semantic HTML, aria-labels for diagram canvases, keyboard navigable accordions, and locale-aware date formatting for metadata.
Rationale: Ensures preview parity with rest of GatomIA UI, keeps us compliant with screen-reader support requirements, and takes minimal effort because React components already centralize these props.
Alternatives considered: Postponing accessibility polish (unacceptable for user-facing view) ; building a separate accessible mode (would fork UI) ; relying on VS Code default Markdown preview (cannot host refine forms).
