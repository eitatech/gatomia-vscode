# Phase 02: Visual Design System Foundation

This phase creates the reusable visual and interaction foundation for the redesign so later orchestration, hook, and workflow features look and behave like one product instead of several unrelated panels. It matters because the project already has multiple webview surfaces, and a shared design system reduces UI drift, speeds feature delivery, and makes the later React Flow and Kanban work much easier to implement consistently.

## Tasks

- [x] Audit existing webview UI patterns and define the minimal design-system contract before creating new components:
  - Inspect existing shared UI, page registry, hooks, cloud-agent, preview, and agent-chat components under `ui/src/components/` and `ui/src/features/`
  - Reuse naming, tokens, and component conventions where they already work; note duplication, inconsistent spacing, state styling, and interaction patterns that must be normalized
  - Capture the baseline in `docs/architecture/design-system/design-system-audit.md` with YAML front matter, tags, and wiki-links to `[[Design-System-Foundations]]` and `[[Workflow-Interaction-Patterns]]`
  - Completed 2026-04-30: audited page bootstrapping and the orchestration, hooks, preview, agent-chat, and cloud-agent surfaces; documented the current token usage, styling dialect split, duplicated button and empty-state patterns, and the minimal shared contract to extract next.

- [x] Create the first design-system foundations for orchestration-heavy workflows:
  - Add or refine shared tokens for spacing, density, panel grouping, status colors, badges, and elevation using the current VS Code theme variable strategy before inventing custom styling primitives
  - Create reusable components or wrappers for status badge, panel section, metric row, empty state, and action toolbar only where existing components cannot be cleanly reused
  - Keep file names kebab-case and colocate styles and tests according to current repository patterns
  - Completed 2026-04-30: added VS Code token-backed workflow CSS variables in `ui/src/app.css`, introduced shared workflow primitives under `ui/src/components/workflow/`, and covered the new status mapping and component shells with focused webview tests for later orchestration and cloud-agent adoption.

- [ ] Apply the new design-system foundations to the orchestration prototype and one existing adjacent surface:
  - Refactor the Phase 01 orchestration UI to consume the shared foundations instead of one-off styling
  - Update one related surface, preferably `Cloud Agents` or `Hooks`, to prove the new components work outside orchestration
  - Preserve existing behavior while improving visual hierarchy, scannability, and state feedback

- [ ] Document the design system in structured markdown for future feature phases:
  - Create `docs/architecture/design-system/design-system-foundations.md` with YAML front matter and wiki-links to `[[Design-System-Audit]]` and `[[Workflow-Interaction-Patterns]]`
  - Create `docs/architecture/design-system/workflow-interaction-patterns.md` describing cards, flows, boards, inspector panels, and task-state visuals in a way later phases can directly reuse
  - Include examples of how orchestration, hooks, and Kanban should share status semantics and action affordances

- [ ] Write tests for the new shared UI foundations:
  - Add focused component tests for the new shared primitives and any refactored state badge logic
  - Extend existing webview tests where possible instead of creating parallel test infrastructure

- [ ] Run validation for the design-system phase and fix issues:
  - Run targeted UI tests for the affected components and pages
  - Run `npm run check`
  - Verify the updated surfaces still load through the existing page registration and webview bootstrapping flow
