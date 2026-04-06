# Implementation Plan: Hooks Refactor — Model Selection, MCP Grouping, Git/GitHub Expansion, ACP Integration

**Branch**: `001-hooks-refactor` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-hooks-refactor/spec.md`

## Summary

Replace the static `CopilotModel` hardcoded enum with a dynamic model list fetched from `vscode.lm.selectChatModels()`, group MCP tools in the picker UI by their originating server, expand the `GitOperation` and `GitHubOperation` union types with additional operations and per-operation config forms, and introduce a new `"acp"` action type that delegates tasks to ACP-compatible local agents via stdio/JSON-RPC using `@agentclientprotocol/sdk`.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict mode, target: ES2022)
**Primary Dependencies**:

- VS Code Extension API 1.90+ (bumped from 1.84 for `vscode.lm.selectChatModels`)
- React 18.3+ (webview UI — hooks config form)
- `@agentclientprotocol/sdk` 0.14.1 (new — ACP client-side connection)
- Vitest 3.2+ (testing)
- Biome (linting/formatting)
- esbuild (extension bundle), Vite (webview bundle)

**Storage**: VS Code `workspaceState` API, key `gatomia.hooks.configurations` (existing, JSON array of `Hook[]`)
**Testing**: Vitest — unit tests in `tests/unit/features/hooks/`, webview tests in `tests/unit/webview/`, integration tests in `tests/integration/`
**Target Platform**: VS Code Extension Host (Node.js), Browser (webview)
**Project Type**: Dual — extension (Node.js) + webview (React SPA)
**Performance Goals**: Model list fetch ≤ 500ms on first open; MCP picker grouping renders in ≤ 100ms with 50+ tools; ACP agent handshake + first response ≤ configured hook timeout (default 30s)
**Constraints**: Zero regressions on existing hooks; VS Code engines bump to `^1.90.0`; `@agentclientprotocol/sdk` must be bundled with esbuild (not dynamic require)
**Scale/Scope**: Affects 5 action type executors, 1 storage migration, 2 TypeScript union type expansions, 1 new action type, UI changes across 4–6 webview components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Notes |
|------|--------|-------|
| I. Kebab-case file naming | PASS | All new files must use kebab-case (e.g., `acp-action.ts`, `model-cache.ts`) |
| II. TypeScript strict | PASS | All new code uses `strict: true`; no `any` without justification |
| III. TDD — tests before implementation | PASS | Task plan will require test files created before implementation files |
| IV. Observability | PASS | ACP execution, model fetches, and new Git/GitHub ops must emit telemetry and log errors |
| V. YAGNI | PASS | Remote ACP transport (HTTP/WebSocket) is out of scope for this iteration (spec assumption); no speculative abstractions |
| Biome — top-level regex | PASS | Any regex in new action files must be top-level constants |
| Biome — complexity ≤ 15 | WATCH | `acp-action.ts` dispatch and `git-action.ts` extended switch must be checked; extract helpers proactively |
| Biome — no variable shadowing | PASS | Audit callback parameter names in new executor code |
| engines.vscode bump | REQUIRED | Must bump `package.json` `engines.vscode` from `^1.84.0` to `^1.90.0` before using `lm.selectChatModels` |

**No violations requiring justification.** The engines bump is the only breaking change — it is necessary for dynamic model enumeration (FR-001) and has no simpler alternative.

## Project Structure

### Documentation (this feature)

```text
specs/001-hooks-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── hook-types.ts    # Extended TypeScript types contract
│   └── acp-messages.ts  # ACP bridge message contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/features/hooks/
├── types.ts                          # MODIFY: extend ActionType, GitOperation,
│                                     # GitHubOperation; replace CopilotModel with
│                                     # dynamic type; add ACPActionParams
├── hook-manager.ts                   # MODIFY: inject ModelCacheService; add
│                                     # migration for legacy model field references
├── hook-executor.ts                  # MODIFY: add "acp" branch to action dispatch
├── template-variable-parser.ts       # MODIFY: add $acpAgentOutput variable
├── template-variable-constants.ts    # MODIFY: add $acpAgentOutput definition
├── actions/
│   ├── git-action.ts                 # MODIFY: extend to support 6 new operations
│   ├── github-action.ts              # MODIFY: extend to support 7 new operations
│   └── acp-action.ts                 # NEW: ACP agent action executor
└── services/
    ├── model-cache-service.ts        # NEW: vscode.lm.selectChatModels wrapper
    │                                 # with 5-minute cache + onDidChangeChatModels
    └── acp-agent-discovery-service.ts # NEW: scans .github/agents/ for acp:true
                                       # agent descriptors (FR-024)

src/providers/
└── hook-view-provider.ts             # MODIFY: add hooks/models-request and
                                      # hooks/acp-agents-request message handlers

src/extension.ts                      # MODIFY: register ModelCacheService and
                                      # AcpAgentDiscoveryService; inject into
                                      # HookViewProvider constructor

ui/src/features/hooks-view/
├── types.ts                          # MODIFY: add hooks/models-available,
│                                     # hooks/models-error, hooks/acp-agents-available
│                                     # message types; MCPProviderGroup interface
├── index.tsx                         # MODIFY: handle models-available,
│                                     # models-error, acp-agents-available messages
├── hooks/
│   ├── use-available-models.ts       # NEW: React hook for dynamic model list
│   └── use-mcp-servers.ts            # MODIFY: add groupToolsByProvider()
└── components/
    ├── mcp-tools-selector.tsx         # MODIFY: group by server/provider
    ├── git-action-form.tsx            # MODIFY: add new operation fields
    ├── github-action-form.tsx         # MODIFY: add new operation fields
    ├── acp-agent-form.tsx             # NEW: ACP agent configuration form
    ├── hook-form.tsx                  # MODIFY: register "acp" action type,
    │                                  # render AcpAgentForm for action.type === "acp"
    └── cli-options/
        └── model-execution-options.tsx  # MODIFY: replace AVAILABLE_MODELS const
                                         # with dynamic list from use-available-models

tests/unit/features/hooks/
├── actions/
│   ├── acp-action.test.ts            # NEW (write first)
│   ├── git-action.test.ts            # MODIFY: extend for new operations
│   └── github-action.test.ts         # MODIFY: extend for new operations
├── services/
│   ├── model-cache-service.test.ts   # NEW (write first)
│   └── acp-agent-discovery-service.test.ts  # NEW (write first)
└── hook-manager.test.ts              # MODIFY: add migration regression test
                                      # for stored CopilotModel string values

tests/unit/webview/
├── use-available-models.test.ts      # NEW (write first)
├── acp-agent-form.test.tsx           # NEW (write first)
├── mcp-tools-selector.test.tsx       # NEW (write first)
├── git-action-form.test.tsx          # NEW (write first)
└── github-action-form.test.tsx       # NEW (write first)

tests/integration/
└── hooks/
    └── acp-hook-execution.test.ts    # NEW (write first)
```

**Structure Decision**: This is a dual-project feature (extension + webview). Both packages share the same repository root with separate dependency trees (`node_modules/` for extension, `ui/node_modules/` for webview). New files follow the existing pattern: kebab-case, co-located tests, service injection via constructor.

## Complexity Tracking

No constitution violations requiring justification.

### WATCH: Functions at Risk of Exceeding Complexity Limit (15)

The Biome `noExcessiveCognitiveComplexity` rule enforces a maximum cognitive complexity of 15 per function.
The following functions are pre-identified as at risk and must use the mitigation strategies noted.

| Function | File | Risk reason | Mitigation |
|---|---|---|---|
| `ACPActionExecutor.execute()` | `src/features/hooks/actions/acp-action.ts` | Subprocess spawn + handshake + session + timeout + error branches = ~18 paths | Extract `spawnAgent()`, `runHandshake()`, `runSession()`, `enforceTimeout()` as private methods; keep `execute()` as an orchestrator only |
| `GitActionExecutor.execute()` switch | `src/features/hooks/actions/git-action.ts` | 8 operation cases × validation branches | Extract `validateGitParams()` and one private handler per operation; keep switch thin (delegate only) |
| `GitHubActionExecutor.execute()` switch | `src/features/hooks/actions/github-action.ts` | 11 operation cases | Same pattern: extract `validateGitHubParams()` and thin switch with private handlers |
| `AcpAgentDiscoveryService.discoverAgents()` | `src/features/hooks/services/acp-agent-discovery-service.ts` | File scanning + frontmatter parsing + filtering | Extract `parseAgentFile()` as a pure function; keep scanning loop simple |

**Rule**: Run `npm run check` after implementing each function above. If Biome reports a complexity violation, apply the mitigation before proceeding to the next task.
