# Implementation Plan: Automatic Review Transition

**Branch**: `001-auto-review-transition` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Ensure specs that finish every tarefa enter the Review tab automatically while preserving a reliable manual “Send to review” shortcut. The solution extends the review flow FSM (`src/features/spec/review-flow/state.ts`), VS Code commands (`commands/send-to-review-command.ts`), and Spec Explorer UI (`ui/src/components/spec-explorer/review-list/*`) so transitions update persistence, emit telemetry, refresh UI, and notify reviewers/watchers through the existing review-alert channel.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.3+ (strict)  
**Primary Dependencies**: VS Code Extension API, React 18, Spec Explorer stores, telemetry helpers in `src/features/spec/review-flow/telemetry.ts`  
**Storage**: JSON workspace state `.vscode/gatomia/spec-review-state.json` managed via `review-flow/state.ts` + `storage.ts`  
**Testing**: Vitest (root + ui) with integration suites under `tests/integration/spec-explorer` and UI unit suites under `tests/unit/webview/spec-explorer`  
**Target Platform**: VS Code desktop extension host + embedded Chromium webview  
**Project Type**: VS Code extension + React webview  
**Performance Goals**: Auto transition + UI refresh ≤10s after last tarefa closure (SC-001)  
**Constraints**: Every transition logs telemetry (FR-007), sends watcher notifications (FR-008), and blocks duplicates; no new configuration formats introduced  
**Scale/Scope**: Dozens of concurrent specs per workspace with dozens of tarefas; evaluation loop must be lightweight enough to run after every task mutation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Kebab-Case Naming**: All updated/added modules (e.g., `auto-review-scheduler.ts`, `send-to-review-command.tsx`) use kebab-case; no exceptions planned.  
- **II. TypeScript-First**: Both extension and UI changes remain TypeScript with strict typing; no `any` without justification.  
- **III. Test-First Development**: Plan includes new Vitest unit + integration suites for auto evaluation, manual action, and notifications before coding; coverage must not drop.  
- **IV. Observability & Instrumentation**: Telemetry events will be added/extended to record trigger type, timestamps, result, and notification recipients.  
- **V. Simplicity & YAGNI**: Scope restricted to automatic/manual transitions + notifications; no speculative workflow engines or cross-workspace syncing.

**Post-Design Check**: Phase 1 artifacts (data model, contracts, quickstart) reference only required functionality, maintain telemetry + TDD commitments, and introduce no non-kebab-case files—gates remain satisfied.

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
├── extension.ts
├── features/
│   └── spec/
│       ├── review-flow/
│       │   ├── commands/
│       │   ├── state.ts
│       │   ├── telemetry.ts
│       │   └── storage.ts
│       └── explorer/
├── providers/
│   └── spec-explorer-provider.ts
└── services/…

ui/
├── src/
│   ├── components/spec-explorer/review-list/
│   ├── stores/
│   └── bridge/
└── tests/unit/webview/spec-explorer/

tests/
├── integration/spec-explorer/
└── unit/features/spec/
```

**Structure Decision**: Implementation stays within existing VS Code extension + React webview directories listed above; no new top-level projects or packages introduced.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
