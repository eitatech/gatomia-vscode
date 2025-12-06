# Implementation Plan: Fix Delete Spec for SpecKit

**Branch**: `004-fix-delete-spec` | **Date**: 2024-12-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-fix-delete-spec/spec.md`

## Summary

The delete functionality for SpecKit specs is broken because the `SpecManager.delete()` method constructs paths assuming OpenSpec structure (`openspec/specs/<name>`) but SpecKit uses a different path (`specs/<name>`). The fix requires modifying the delete method to accept the spec system type and construct the correct path accordingly. Additionally, a confirmation dialog should be added for safety.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022 target)  
**Primary Dependencies**: VS Code Extension API, Node.js path/fs  
**Storage**: Filesystem (workspace directories)  
**Testing**: Vitest with VS Code mocks  
**Target Platform**: VS Code Desktop (Windows, macOS, Linux)  
**Project Type**: VS Code Extension (single project)  
**Performance Goals**: Deletion completes in <2 seconds for typical specs (<20 files)  
**Constraints**: Must preserve backward compatibility with OpenSpec specs  
**Scale/Scope**: Extension with ~20k lines of code, single user at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Biome-First Code Quality | ✅ PASS | Will run `npm run check` before commit |
| II. Exhaustive Agent Coverage | ✅ N/A | Delete is not a hook trigger/action |
| III. UI Accessibility and Determinism | ✅ PASS | Confirmation dialog uses VS Code native APIs |
| IV. Test-Driven Stability | ✅ PASS | Unit tests required for delete method changes |
| V. Simplicity & Maintainability | ✅ PASS | Minimal changes to existing code structure |

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-delete-spec/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Root cause analysis
├── data-model.md        # Interface changes
├── quickstart.md        # Implementation guide
├── contracts/           # N/A - no API contracts needed
└── tasks.md             # Task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── constants.ts                              # SPECKIT_CONFIG, DEFAULT_CONFIG paths
├── extension.ts                              # Command registration (gatomia.spec.delete)
├── features/
│   └── spec/
│       ├── spec-manager.ts                   # delete() method - PRIMARY CHANGE
│       └── spec-manager.test.ts              # Unit tests for delete
├── providers/
│   └── spec-explorer-provider.ts             # SpecItem class with system property
└── utils/
    └── spec-kit-adapter.ts                   # SpecSystemAdapter for path resolution

tests/
└── unit/
    └── features/
        └── spec/
            └── spec-manager.test.ts          # Test file location
```

**Structure Decision**: Single project structure - changes are localized to existing files in `src/features/spec/` and `src/extension.ts`.

## Complexity Tracking

> No violations - implementation is straightforward with minimal changes.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion.*

| Gate | Status | Verification |
|------|--------|--------------|
| I. Biome-First Code Quality | ✅ PASS | All code changes will pass `npm run check` |
| II. Exhaustive Agent Coverage | ✅ N/A | Delete is a fix, not a new hook trigger/action |
| III. UI Accessibility and Determinism | ✅ PASS | Uses VS Code native modal dialog with keyboard support |
| IV. Test-Driven Stability | ✅ PASS | Test cases defined in quickstart.md, covering success, cancel, and error paths |
| V. Simplicity & Maintainability | ✅ PASS | Single method update + command registration change; no new abstractions |

**All gates passed. Ready for Phase 2 task generation (`/speckit.tasks`).**
