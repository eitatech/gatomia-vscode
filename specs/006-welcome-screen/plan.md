# Implementation Plan: Extension Welcome Screen

**Branch**: `006-welcome-screen` | **Date**: December 16, 2025 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-welcome-screen/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a comprehensive welcome screen for the GatomIA VS Code extension that provides first-time users with guided onboarding, displays system status and dependencies, offers quick access to all major features, and enables direct configuration of spec system settings. The welcome screen will be a webview panel that automatically appears on first activation per workspace and can be accessed on-demand via command palette.

## Technical Context

**Language/Version**: TypeScript 5.x, target ES2020 (extension) + React 18 with TypeScript (webview UI)  
**Primary Dependencies**: VS Code Extension API ^1.84.0, React 18.x, Vite (webview build), esbuild (extension build), Vitest (testing)  
**Storage**: VS Code workspace state API (for first-time tracking), VS Code configuration API (for settings persistence), no external database  
**Testing**: Vitest with React Testing Library for UI components, Vitest with VS Code API mocks for extension logic  
**Target Platform**: VS Code extension running in Node.js environment (extension host), webview runs in VS Code webview context (browser-like)  
**Project Type**: VS Code extension with React webview UI (existing architecture: src/ for extension, ui/ for webview)  
**Performance Goals**: Welcome screen loads within 2 seconds, UI updates within 500ms, no blocking operations on main thread  
**Constraints**: Must follow VS Code webview security model (CSP), respect VS Code theme API for light/dark mode, follow VS Code UX patterns for consistency  
**Scale/Scope**: Single-user desktop application, ~20 configuration settings, 5 major feature sections, support for both SpecKit and OpenSpec workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**✅ I. Kebab-Case File Naming**: All new files will follow kebab-case convention (welcome-screen-panel.ts, welcome-screen-provider.ts, welcome-screen.tsx). No violations expected.

**✅ II. TypeScript-First Development**: Feature implemented entirely in TypeScript with strict mode enabled. Existing tsconfig.json enforces strict: true. No violations.

**⚠️ III. Test-First Development (TDD)**: Tests must be written before implementation. This is a constitutional requirement that must be enforced during implementation phase. No current violations - tests will be created in Phase 2 tasks.

**✅ IV. Observability & Instrumentation**: Welcome screen will include telemetry for load times, user interactions, dependency status checks. OutputChannel logging for debugging. Performance metrics trackable via instrumentation. No violations.

**✅ V. Simplicity & YAGNI**: Implementation focuses only on specified requirements. No premature abstractions. Reuses existing webview infrastructure (DocumentPreviewPanel, HookViewProvider patterns). No violations.

**Status**: ✅ PASS - All gates satisfied. Proceed to Phase 0 research.

---

**Post-Phase 1 Re-Check (December 16, 2025)**:

**✅ I. Kebab-Case File Naming**: Design documents specify kebab-case for all new files. Architecture follows existing patterns. No violations.

**✅ II. TypeScript-First Development**: All contracts defined with TypeScript interfaces. Type safety maintained throughout. No violations.

**✅ III. Test-First Development (TDD)**: Test structure defined in quickstart.md. Unit and integration tests planned before implementation. No violations in design phase.

**✅ IV. Observability & Instrumentation**: SystemDiagnostics service captures errors with timestamps. OutputChannel logging included in all components. Performance targets specified (2s load, 500ms updates). No violations.

**✅ V. Simplicity & YAGNI**: Architecture reuses proven patterns (Panel + Provider). No unnecessary abstractions. Services focused on single responsibilities. Learning resources hardcoded (no over-engineering). No violations.

**Final Status**: ✅ PASS - All constitutional requirements satisfied in design phase. Ready for Phase 2 (task generation).

## Project Structure

### Documentation (this feature)

```text
specs/006-welcome-screen/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── messages.md      # Extension ↔ Webview message contracts
│   └── api.md           # Internal API contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── extension.ts                        # Register welcome screen command and first-time check
├── panels/
│   ├── document-preview-panel.ts       # Existing (reference pattern)
│   └── welcome-screen-panel.ts         # NEW - Welcome screen webview lifecycle
├── providers/
│   ├── hook-view-provider.ts           # Existing (reference pattern)
│   └── welcome-screen-provider.ts      # NEW - Welcome screen state management
├── services/
│   ├── dependency-checker.ts           # NEW - Check GitHub Copilot Chat, CLIs
│   ├── system-diagnostics.ts           # NEW - Collect errors/warnings from past 24h
│   └── learning-resources.ts           # NEW - Manage documentation links
└── utils/
    └── workspace-state.ts              # NEW - First-time tracking utilities

ui/
└── src/
    └── features/
        └── welcome/
            ├── welcome-app.tsx          # NEW - Main welcome screen React app
            ├── components/
            │   ├── setup-section.tsx    # NEW - Dependency status & setup
            │   ├── features-section.tsx # NEW - Feature cards with actions
            │   ├── config-section.tsx   # NEW - Spec system configuration
            │   ├── status-section.tsx   # NEW - Health & diagnostics
            │   └── learning-section.tsx # NEW - Documentation resources
            ├── stores/
            │   └── welcome-store.ts     # NEW - Zustand store for welcome state
            └── types.ts                 # NEW - Welcome screen TypeScript types

tests/
├── unit/
│   ├── panels/
│   │   └── welcome-screen-panel.test.ts    # NEW
│   ├── providers/
│   │   └── welcome-screen-provider.test.ts # NEW
│   └── services/
│       ├── dependency-checker.test.ts      # NEW
│       └── system-diagnostics.test.ts      # NEW
└── integration/
    └── welcome/
        ├── welcome-first-time.test.ts      # NEW - First-time activation
        ├── welcome-command.test.ts         # NEW - Command palette access
        └── welcome-config.test.ts          # NEW - Configuration editing
```

**Structure Decision**: Following existing VS Code extension architecture with webview pattern. Extension code in `src/panels/` and `src/providers/` follows established patterns from DocumentPreviewPanel and HookViewProvider. React UI in `ui/src/features/welcome/` mirrors existing `ui/src/features/preview/` structure. This maintains consistency with codebase conventions while supporting the new welcome screen feature.

## Complexity Tracking

> **No constitution violations identified. This section intentionally left empty.**

All requirements can be satisfied within existing architectural patterns and constitutional constraints.
