# Copilot Spec UI Constitution

## Core Principles

### I. Biome-First Code Quality
All code must satisfy the repository lint/format suite (`npm run check` / `npm run fix`) before merging. No file may be left with lint warnings, formatting drift, or complexity violations. Prefer refactors over ignore comments; an ignore directive must include justification and a follow-up issue if the complexity cannot be reduced immediately.

### II. Exhaustive Agent Coverage
Whenever SpecKit/OpenSpec commands are added or modified, the Hooks feature must expose the same operations in both triggers and actions. Documentation, dropdowns, constants, and VS Code command registrations must stay in sync with `.github/agents` and `.github/prompts` to guarantee hook automation parity.

### III. UI Accessibility and Determinism
All UI changes must preserve accessibility semantics (SVG titles, aria labels, keyboard focus). Webview actions toggled from VS Code commands or buttons must always render deterministic fallbacks (e.g., "No execution logs yet" when empty) to prevent disappearing panels.

### IV. Test-Driven Stability (NON-NEGOTIABLE)
Every code path added or refactored must have corresponding tests (unit or integration). Tests must cover failure modes and guard against regressions in hooks, SpecKit command routing, and webview messaging.

### V. Simplicity & Maintainability
Favor small components and helper utilities to keep functions below complexity limits. Shared logic (file dialogs, message handlers) should live in helpers rather than repeated inline.

## Quality Gates
- `npm run check` must pass on every commit; `npm run fix` must be executed whenever biome suggests autofixes.
- Hooks commands/actions must be tested via the existing Vitest suites (`hook-form`, `hook-view-provider`, `hook-executor`, etc.).
- Any change that touches lint config or introduces exceptions requires explicit approval and documentation in PR notes.

## Development Workflow
1. Implement feature with TDD.
2. Run `npm run check` → `npm run test -- <target>` before committing.
3. If lint failures recur, stop and refactor immediately; do not push with `// biome-ignore` unless justified and documented.
4. Update docs (`plan.md`, `tasks.md`, quickstart) whenever file names or workflows change (kebab-case, new operations, etc.).

## Governance
This constitution supersedes prior informal practices. Amendments require updating this file, bumping the version, and recording the change in PR notes. Every PR reviewer must verify compliance.

**Version**: 1.0.0 | **Ratified**: 2025-12-04 | **Last Amended**: 2025-12-04
