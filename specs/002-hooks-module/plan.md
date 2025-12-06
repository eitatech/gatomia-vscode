# Implementation Plan: Hooks Module

**Branch**: `001-hooks-module` | **Date**: 2025-12-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-hooks-module/spec.md`

## Summary

The Hooks Module enables users to automate SDD workflow sequences by configuring triggers that execute actions automatically when specific agent operations complete. The primary requirement is to add a Hooks configuration area below the Steering section in the extension's webview UI, allowing users to create, edit, enable/disable, and delete hooks that trigger actions like running subsequent SpecKit/OpenSpec commands, executing Git operations, or invoking GitHub MCP Server operations.

## Technical Context

**Language/Version**: TypeScript 5.x (VSCode Extension API)  
**Primary Dependencies**: VSCode Extension API, React (webview), Vite (webview build), esbuild (extension build)  
**Storage**: VSCode ExtensionContext globalState/workspaceState for hook persistence  
**Testing**: Vitest (extension + webview unit tests)  
**Target Platform**: VS Code 1.84.0+  
**Project Type**: VS Code Extension with React Webview (dual-component architecture)  
**Performance Goals**: Hook execution within 5 seconds, UI response <2 seconds  
**Constraints**: Sequential execution (no parallel hooks), <200ms UI interaction latency  
**Scale/Scope**: Support 50+ hooks per workspace, handle 10+ simultaneous trigger evaluations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Unified Build System ✅
- Change integrates with existing `npm run build` (builds extension + webview)
- No new build steps required beyond existing `build:ext` and `build:webview`
- Hooks module follows existing feature structure pattern

### Quality Assurance ✅
- Will add Vitest tests for hook management logic (extension side)
- Will add Vitest tests for hooks UI components (webview side)
- Will comply with Biome linting/formatting via `npm run check`

### Prompt Engineering ✅
- No new prompts required for MVP (uses existing agent command infrastructure)
- Future: May add prompts for template variable expansion in hook actions

### Webview Isolation ✅
- Hooks UI components will reside in `webview-ui/src/features/hooks-view/`
- Will follow existing feature pattern (similar to `create-steering-view`)
- Can be developed in isolation via `npm --prefix webview-ui run dev`

### Extension Packaging ✅
- No packaging changes required
- Feature code integrates into existing extension bundle
- No new activation events needed (uses existing `onStartupFinished`)

**Result**: ✅ All constitution principles satisfied - no violations

## Project Structure

### Documentation (this feature)

```text
specs/001-hooks-module/
├── plan.md              # This file
├── research.md          # Phase 0: Architecture research
├── data-model.md        # Phase 1: Hook entities and persistence
├── quickstart.md        # Phase 1: Developer onboarding
├── contracts/           # Phase 1: Component contracts
│   ├── hook-manager.contract.md
│   ├── hook-executor.contract.md
│   ├── hook-ui.contract.md
│   └── trigger-registry.contract.md
└── tasks.md             # Phase 2: Implementation tasks (from /speckit.tasks)
```

### Source Code (repository root)

```text
# Extension (Backend/Logic)
src/
├── features/
│   └── hooks/
│       ├── HookManager.ts           # CRUD operations, persistence
│       ├── HookExecutor.ts          # Execution engine, circular detection
│       ├── TriggerRegistry.ts       # Agent event listener registration
│       ├── actions/                 # Action implementations
│       │   ├── AgentAction.ts       # Run SpecKit/OpenSpec commands
│       │   ├── GitAction.ts         # Git commit/push operations
│       │   └── GitHubAction.ts      # MCP Server GitHub operations
│       └── types.ts                 # Hook, TriggerCondition, Action types
├── providers/
│   └── HookProvider.ts              # VS Code TreeView provider (optional UI)
└── services/
    └── HookService.ts               # Extension-level hook coordination

# Webview (Frontend/UI)
webview-ui/src/features/
└── hooks-view/
    ├── index.tsx                    # Main Hooks view component
    ├── types.ts                     # UI-specific types
    └── components/
        ├── HooksList.tsx            # Display all configured hooks
        ├── hook-form.tsx            # Create/Edit hook form
        ├── HookListItem.tsx         # Individual hook row with actions
        └── trigger-action-selector.tsx # Dropdowns for triggers and actions

# Tests
tests/
├── unit/
│   ├── features/
│   │   └── hooks/
│   │       ├── HookManager.test.ts
│   │       ├── HookExecutor.test.ts
│   │       └── TriggerRegistry.test.ts
│   └── webview/
│       └── hooks-view/
│           ├── HooksList.test.tsx
│           └── HookForm.test.tsx
└── integration/
    └── hooks-workflow.test.ts       # End-to-end hook creation & execution
```

**Structure Decision**: 

This VS Code extension uses a dual-component architecture:
- **Extension (src/)**: TypeScript logic running in Node.js context, handles hook storage, execution engine, and agent event listening
- **Webview (webview-ui/)**: React UI running in webview context, handles hook configuration UI below Steering section

The hooks feature follows the existing pattern established by `create-steering-view`, with backend logic in `src/features/hooks/` and frontend UI in `webview-ui/src/features/hooks-view/`. Communication between extension and webview uses VSCode's message passing API.

## Complexity Tracking

> **No constitution violations detected - section not required**
