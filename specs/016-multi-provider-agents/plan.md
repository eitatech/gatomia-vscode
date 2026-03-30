# Implementation Plan: Multi-Provider Cloud Agent Support

**Branch**: `016-multi-provider-agents` | **Date**: 2025-07-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-multi-provider-agents/spec.md`

## Summary

Refactor the existing Devin-only cloud agent integration into a provider-agnostic architecture that supports multiple cloud agent platforms (Devin, GitHub Copilot coding agent, and future providers). The approach introduces a **Provider Adapter** contract that abstracts credentials, session management, polling, and dispatch behind a common interface. The existing Devin code becomes the first adapter implementation (wrapping all 36 existing files without breaking changes), and a new GitHub Copilot coding agent adapter is added. A **Provider Registry** manages adapter registration and active provider state. Existing UI components (tree view, webview panel, commands) are replaced with provider-agnostic equivalents that delegate to the active adapter. Existing Devin users are auto-migrated silently (FR-018).

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict: true, target: ES2022)
**Primary Dependencies**: VS Code Extension API 1.84.0+, React 18.3+ (webview), GitHub GraphQL API (for Copilot coding agent issue assignment and session tracking)
**Storage**: VS Code `workspaceState` (provider preference, session data as JSON), VS Code `SecretStorage` (credentials)
**Testing**: Vitest 3.2+ (unit + integration), TDD required per constitution
**Target Platform**: VS Code Desktop (all OS)
**Project Type**: VS Code extension (dual-build: esbuild for extension, Vite for webview)
**Performance Goals**: Provider selection <60s (SC-001), status polling within 30s interval (SC-003), error display <5s (SC-006)
**Constraints**: Single active provider at a time, 7-day session retention, zero regression for existing Devin users (FR-012), kebab-case filenames
**Scale/Scope**: 2 providers at launch, extensible to N; ~36 Devin source files wrapped behind adapter; ~7 webview components generalized

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Kebab-Case File Naming | PASS | All new files: `cloud-agent-provider.ts`, `provider-registry.ts`, `github-copilot-adapter.ts`, etc. |
| II. TypeScript-First | PASS | Provider adapter contract as TypeScript interface. No `any`. All public APIs with JSDoc. |
| III. Test-First (TDD) | PASS | Tests before implementation for adapter contract, registry, migration, each adapter. |
| IV. Observability | PASS | FR-016 requires logging all provider operations. Telemetry for selection, dispatch, errors. |
| V. Simplicity & YAGNI | PASS | Single active provider (not multi-concurrent). Minimal adapter contract. Devin adapter wraps existing code. |

All gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/016-multi-provider-agents/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── provider-adapter.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── cloud-agents/                    # NEW: Provider-agnostic cloud agent module
│   │   ├── types.ts                     # Provider-agnostic types (AgentSession, AgentTask, SessionStatus)
│   │   ├── cloud-agent-provider.ts      # Provider adapter interface contract
│   │   ├── provider-registry.ts         # Registry: register/get/switch active provider
│   │   ├── provider-config-store.ts     # Workspace state for active provider preference
│   │   ├── agent-session-storage.ts     # Provider-agnostic session storage
│   │   ├── agent-polling-service.ts     # Delegates polling to active provider adapter
│   │   ├── session-cleanup-service.ts   # 7-day retention for all provider sessions
│   │   ├── migration-service.ts         # Auto-migrate existing Devin users (FR-018)
│   │   └── adapters/
│   │       ├── devin-adapter.ts         # Wraps existing src/features/devin/* behind adapter
│   │       └── github-copilot-adapter.ts # GitHub Copilot coding agent adapter
│   └── devin/                           # EXISTING: Preserved as-is (36 files, no breaking changes)
│       └── ...
├── providers/
│   └── cloud-agent-progress-provider.ts # NEW: Replaces devin-progress-provider.ts
├── panels/
│   ├── cloud-agent-progress-panel.ts    # NEW: Replaces devin-progress-panel.ts
│   └── cloud-agent-message-handler.ts   # NEW: Replaces devin-message-handler.ts
├── commands/
│   └── cloud-agent-commands.ts          # NEW: Replaces devin-commands.ts
└── extension.ts                         # UPDATED: Register cloud-agents module

ui/src/
├── components/
│   └── cloud-agents/                    # NEW: Replaces ui/src/components/devin/
│       ├── cloud-agent-progress-view.tsx # Main view (delegates to active provider)
│       ├── session-list.tsx             # Provider-agnostic session list
│       ├── task-status.tsx              # Task status display
│       ├── empty-state.tsx              # Empty/welcome state
│       ├── error-display.tsx            # Error rendering
│       ├── loading-states.tsx           # Loading indicators
│       └── pull-request-actions.tsx     # PR link actions
└── stores/
    └── cloud-agent-store.ts             # NEW: Replaces devin-store.ts

tests/
├── unit/
│   ├── features/cloud-agents/
│   │   ├── provider-registry.test.ts
│   │   ├── provider-config-store.test.ts
│   │   ├── agent-session-storage.test.ts
│   │   ├── agent-polling-service.test.ts
│   │   ├── migration-service.test.ts
│   │   └── adapters/
│   │       ├── devin-adapter.test.ts
│   │       └── github-copilot-adapter.test.ts
│   └── webview/
│       └── cloud-agent-store.test.ts
└── integration/
    └── cloud-agents/
        └── provider-switching.test.ts
```

**Structure Decision**: Follows existing extension architecture with a new `features/cloud-agents/` module alongside the preserved `features/devin/` module. The Devin module is kept intact (FR-012, zero regression) and wrapped by a Devin adapter. New provider-agnostic replacements are created for providers, panels, commands, and webview components. The `adapters/` subdirectory holds provider-specific implementations.

## Complexity Tracking

> No violations to track. All Constitution Check gates passed.
