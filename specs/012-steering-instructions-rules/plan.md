# Implementation Plan: Steering Instructions & Rules

**Branch**: `001-steering-instructions-rules` | **Date**: 2026-01-05 | **Spec**: `spec.md`
**Input**: Feature specification from `specs/001-steering-instructions-rules/spec.md`

## Summary

Extend the Steering documents experience to:
- List project instruction rules from `.github/instructions/*.instructions.md`.
- List user instruction rules from `$HOME/.github/instructions/*.instructions.md`.
- Create new rule files (project/user) from a name prompt using a standard instruction template.
- Add `Create Constitution` to prompt for a short description and send `/speckit.constitution <description>` via Copilot Chat, with no post-processing.

Implementation uses existing extension patterns:
- Tree listing in `src/providers/steering-explorer-provider.ts`.
- Commands wired in `src/extension.ts` delegating to `src/features/steering/steering-manager.ts`.
- Chat invocation via `src/utils/chat-prompt-runner.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), target ES2022  
**Primary Dependencies**: VS Code Extension API, Node.js (extension host), React 18 + Vite (webview), Biome  
**Storage**: Filesystem (`workspace.fs`) and existing workspace JSON state where applicable  
**Testing**: Vitest (unit + integration), VS Code API mocks  
**Target Platform**: VS Code 1.84.0+ (desktop), compatible with remote workspaces  
**Project Type**: VS Code extension + React webview (dual build)  
**Performance Goals**: Steering list usable <2s for ~10 instruction files (SC-001)  
**Constraints**: No silent failures; actionable user errors; no overwrite-by-default on create  
**Scale/Scope**: Single repo + per-user home directory rules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- English-only documentation and comments: satisfied.
- Kebab-case source files: enforced; any new source files must be kebab-case.
- TDD: tests written before implementation in Phase 2 (`/speckit.tasks`).
- Observability: log failures with enough context; no silent failures.
- Simplicity/YAGNI: implement listing + create + constitution request only.

**Post-design check:** No planned violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-steering-instructions-rules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── steering-instructions-rules.yaml
└── tasks.md             # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── extension.ts
├── providers/
│   └── steering-explorer-provider.ts
├── features/
│   └── steering/
│       ├── steering-manager.ts
│       └── constitution-manager.ts
└── utils/
    └── chat-prompt-runner.ts

tests/
├── unit/
└── integration/

ui/
└── src/
```

**Structure Decision**: This repo is a VS Code extension with a React webview; changes for this feature will be concentrated in `SteeringExplorerProvider`, `SteeringManager`, and command wiring.

## Complexity Tracking

No constitution violations are required for this feature.
