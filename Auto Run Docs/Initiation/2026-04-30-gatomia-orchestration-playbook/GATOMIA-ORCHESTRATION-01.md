# Phase 01: Running Agents Orchestration Prototype

This phase delivers the first end-to-end orchestration prototype for GatomIA by turning the existing running-agent, agent-chat, and cloud-agent surfaces into a single coherent experience that visibly tracks active sessions. It matters because it gives Product Engineers and Software Engineers a working orchestration dashboard immediately, proves the new direction with minimal refactoring risk, and creates the foundation that later phases will extend with hooks, visual flows, and autonomous task execution.

- NEVER push de code

## Tasks

- [x] Establish the orchestration prototype baseline by reusing existing extension and webview surfaces before creating new ones:
  - Inspect and map the current behavior in `src/providers/running-agents-tree-provider.ts`, `src/providers/agent-chat-view-provider.ts`, `src/providers/cloud-agent-progress-provider.ts`, `src/panels/agent-chat-panel.ts`, `src/panels/cloud-agent-progress-panel.ts`, and `ui/src/components/cloud-agents/cloud-agent-progress-view.tsx`
  - Identify the smallest viable prototype that can be built by composing existing session state, registry events, and view registration instead of introducing a second orchestration stack
  - Capture the target slice in `docs/architecture/orchestration/running-agents-prototype.md` using Obsidian-style markdown with YAML front matter, links to `[[Running-Agents-Model]]` and `[[Orchestration-UI-Contract]]`, and explicit notes about reused modules versus new modules
  - Note: baseline mapping and reuse-first target slice captured on 2026-04-30 in `docs/architecture/orchestration/running-agents-prototype.md`

- [x] Implement a unified orchestration read model for active and recent agents:
  - Reuse existing session and provider contracts before creating new types; search for agent session models, lifecycle state helpers, and existing telemetry patterns first
  - Create or refactor a narrow service that merges local running-agent sessions and cloud-agent session progress into one normalized projection for the UI
  - Preserve current tree-view behavior while exposing the same normalized data to a webview-friendly bridge so the prototype has one source of truth
  - Include lifecycle metadata that is already available or derivable now: session id, source, title, agent name, state, timestamps, worktree status, last visible activity, and blocking status
  - Note: completed on 2026-04-30 by extending `src/features/orchestration/orchestration-read-model.ts` to merge persisted and live agent-chat sessions, derive transcript-backed titles/activity, and normalize provider display names for cloud sessions without changing existing tree providers.
  - Validation: re-verified on 2026-04-30 with `tests/unit/features/orchestration/orchestration-read-model.test.ts` and `npm run check`; the check required clearing a disposable oversized `.entire/tmp` session artifact before passing.

- [x] Build the first orchestration prototype view that visibly works inside the extension:
  - Reuse the existing page registry, panel, and bridge patterns before introducing new routing or state libraries
  - Add a dedicated orchestration view or panel that renders the normalized session projection with clear columns or cards for Active, Waiting, Completed, and Failed work
  - Ensure the prototype allows at minimum: open session, refresh session state, inspect current status, and navigate back to the existing agent-chat or cloud-agent experience
  - Keep the UI intentionally simple but visually compelling so the user can see live orchestration progress as soon as the phase is complete
  - Note: completed on 2026-04-30 by wiring the existing orchestration webview provider into the extension bootstrap, adding a simple four-lane card UI in `ui/src/features/orchestration/index.tsx`, and fixing cloud-session navigation so the prototype can jump back to the Cloud Agents surface instead of only refreshing state.
  - Validation: re-verified on 2026-04-30 with `tests/unit/webview/cloud-agent-progress-view.test.tsx` and `npm run check`.

- [x] Connect orchestration events, telemetry, and empty states so the prototype behaves like a real product surface:
  - Reuse existing event emitters, output channels, and telemetry helpers before adding new instrumentation paths
  - Make tree updates and orchestration view updates respond to session-store, registry, and cloud-provider changes without manual reloads where possible
  - Add actionable empty, loading, and degraded states that explain whether there are no sessions, missing providers, or failed status reads
  - Write implementation notes in `docs/architecture/orchestration/orchestration-ui-contract.md` with YAML front matter and wiki-links to `[[Running-Agents-Prototype]]`
  - Note: completed on 2026-04-30 by wiring orchestration refreshes to existing `AgentSessionStorage` and `ProviderRegistry` change events, replacing the prototype's timer-based provider refresh path, and upgrading the orchestration webview with actionable no-session, missing-provider, and degraded-state messaging.
  - Validation: verified on 2026-04-30 with `tests/unit/features/orchestration/orchestration-read-model.test.ts`, `tests/unit/webview/cloud-agent-progress-view.test.tsx`, and `npm run check`.

- [x] Write test coverage for the orchestration prototype behavior:
  - Add or update unit tests for the normalized orchestration read model, lifecycle grouping, and any new state selectors or adapters
  - Add webview or provider-focused tests that verify the prototype renders meaningful empty, active, and failed states from representative session data
  - Prefer extending existing test suites around providers and stores before creating entirely new harnesses
  - Note: completed on 2026-04-30 by extending the existing orchestration read-model and webview suites with lifecycle bucket ordering coverage plus representative active/failed session rendering and action assertions.
  - Validation: verified on 2026-04-30 with `npm test -- tests/unit/features/orchestration/orchestration-read-model.test.ts tests/unit/webview/cloud-agent-progress-view.test.tsx` and `npm run check`.

- [ ] Run the orchestration quality gates and fix failures until the prototype is working end-to-end:
  - Run the relevant targeted tests for orchestration changes first
  - Run `npm run check`
  - Run the full affected test command if targeted tests expose regressions that require broader validation
  - Verify the extension can surface the new orchestration prototype without breaking the existing Running Agents and Cloud Agents views
