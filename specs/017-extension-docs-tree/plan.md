# Implementation Plan: Dynamic Extension Document Display in Spec Explorer

**Branch**: `017-extension-docs-tree` | **Date**: 2026-04-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/017-extension-docs-tree/spec.md`

## Summary

Display extension-generated markdown documents dynamically in the Spec Explorer tree view. The adapter layer (`getSpecKitFeatureFiles`) will be extended to collect any extra `.md` files and unknown subfolders (recursively) alongside the existing known documents. The tree provider will render these as new node types with distinct icons. A debounced file system watcher (2s) will trigger automatic tree refresh.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict: true, target: ES2022)
**Primary Dependencies**: VS Code Extension API 1.84.0+, Node.js `fs` module
**Storage**: Filesystem (spec directories under `specs/`)
**Testing**: Vitest 3.2+ (unit + integration)
**Target Platform**: VS Code Extension (Node.js host)
**Project Type**: VS Code Extension (desktop-app)
**Performance Goals**: Tree rendering under 100ms for typical spec directories (< 50 files)
**Constraints**: No synchronous blocking of the extension host; debounced refresh at 2s
**Scale/Scope**: Typically 1-20 extra files per spec directory; recursive folder depth unbounded but practically shallow (2-3 levels)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Kebab-Case File Naming | PASS | All new files will use kebab-case |
| II. TypeScript-First | PASS | All code in strict TypeScript, no `any` types |
| III. Test-First (TDD) | PASS | Tests written before implementation per task order |
| IV. Observability | PASS | Logging for file discovery errors; telemetry for extension doc counts |
| V. Simplicity & YAGNI | PASS | No extension.yml parsing; pure filesystem scan; no abstractions beyond needed |

No violations. No Complexity Tracking needed.

**Post-Phase-1 Re-check**: All gates still PASS. New test files use kebab-case. `ExtraFileEntry` type is fully typed. Recursive scan includes error logging. No new abstractions introduced.

## Project Structure

### Documentation (this feature)

```text
specs/017-extension-docs-tree/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── utils/
│   └── spec-kit-adapter.ts          # MODIFY: getSpecKitFeatureFiles() to collect extra docs/folders
├── providers/
│   └── spec-explorer-provider.ts    # MODIFY: render extra-document and extension-folder nodes

tests/
├── unit/
│   ├── utils/
│   │   └── spec-kit-adapter-extension-docs.test.ts   # NEW: tests for extra file discovery
│   └── providers/
│       └── spec-explorer-provider.test.ts             # MODIFY: add extension doc tree tests
└── integration/
    └── spec-explorer/
        └── extension-docs-tree.test.ts                # NEW: integration test for full flow
```

**Structure Decision**: Existing single-project structure. Changes are scoped to two existing files (adapter + provider) plus new test files. No new modules or services needed.
