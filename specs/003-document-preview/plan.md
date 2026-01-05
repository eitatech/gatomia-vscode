# Implementation Plan: Document Preview & Refinement

**Branch**: `[001-document-preview]` | **Date**: 2025-12-06 | **Spec**: [`specs/001-document-preview/spec.md`](spec.md)
**Input**: Feature specification from `/specs/001-document-preview/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a preview-first workflow to the VS Code extension so every supported document opens inside a rich webview that renders Markdown, Mermaid, and C4 diagrams, keeps interactive forms usable, and offers a "Refine Document" action that captures structured feedback without exposing the raw file. The technical approach centers on extending the extension host to route document selections into the webview, enhancing the React/Vite webview UI to render advanced Markdown and form inputs with state preservation, and wiring a refinement submission channel that tags the originating document metadata.

## Technical Context

**Language/Version**: TypeScript 5.x (extension + React webview)  
**Primary Dependencies**: VS Code Extension API, React 18, Vite tooling, Markdown-it + diagram plugins, existing SpecKit document services  
**Storage**: Local workspace files plus existing SpecKit metadata (no new datastore)  
**Testing**: Vitest for unit/UI, vscode-test harness for integration suites  
**Target Platform**: Desktop VS Code (v1.84+) with bundled webview  
**Project Type**: VS Code extension with bundled React webview  
**Performance Goals**: 95% of previews render within 3 seconds; diagram render success ≥90% (per spec success criteria)  
**Constraints**: Must avoid accidental edits, provide manual reload on concurrent updates, and degrade gracefully when standards unsupported  
**Scale/Scope**: All SpecKit document types (tasks, specs, plans, research, data models, APIs, quickstarts) within a single workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution placeholder defines no enforceable gates, so proceed under default SpecKit quality bars (testability, documentation, observability to be handled in design). No violations recorded.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── extension/          # VS Code activation, tree views, command handlers
├── panels/             # Webview providers, serialization helpers
└── utils/              # Shared helpers (telemetry, file IO)

ui/
├── src/
│   ├── components/     # React UI for preview + refinement form
│   ├── features/       # Zustand stores, hooks
│   └── lib/            # Markdown renderers, diagram adapters
└── tests/              # RTL + Vitest suites

tests/
├── unit/               # Extension + webview unit tests
├── integration/        # VS Code integration harness
└── __mocks__/          # Shared fixtures (VS Code APIs, document data)
```

**Structure Decision**: Maintain existing extension + webview split; add preview-specific modules under `src/panels` and `ui/src/features/preview` plus corresponding tests in `tests/unit/features/documents` and `ui/tests/preview`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Phase 0 – Research Outcomes

- Rendering stays within the React webview using Markdown-it plus diagram plugins (see `research.md`), preventing dual pipelines.
- Form interactions store state client-side and sync via VS Code messaging, avoiding accidental Markdown edits or lag.
- Refinement CTA reuses the existing SpecKit refinement endpoint but now transmits preview metadata for better triage.
- Concurrent file changes trigger warning banners rather than forced reloads, fulfilling FR-011.
- Accessibility follows VS Code webview guidelines with semantic markup and aria coverage.

## Phase 1 – Design Snapshot

- **Data Model**: Defined entities (DocumentArtifact, PreviewSession, DiagramBlock, FormField, RefinementRequest) along with validation rules and derived events in `data-model.md`.
- **Contracts**: Added OpenAPI spec (`contracts/preview.yaml`) for preview fetch, form submission, and refinement creation to formalize host ↔ service interactions.
- **Quickstart**: Authored `quickstart.md` detailing dev environment setup, manual test flows, and target test commands to validate previews, forms, and refinement submissions.

## Constitution Check (Post-Design)

Design artifacts comply with the standing principles: solutions remain TypeScript-first, expose actions via existing CLI/VS Code commands, and maintain test-first expectations through documented quickstart procedures. No new constraints introduced, so gates remain satisfied.
