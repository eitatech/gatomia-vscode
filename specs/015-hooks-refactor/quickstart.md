# Quickstart: Hooks Refactor Development Guide

**Feature**: [spec.md](./spec.md)
**Branch**: `001-hooks-refactor`
**Created**: 2026-02-18

---

## Prerequisites

```bash
# Ensure you are on the correct branch
git checkout 001-hooks-refactor

# Install all dependencies (root + ui)
npm run install:all

# Add the new ACP SDK dependency
npm install @agentclientprotocol/sdk@^0.14.1
```

---

## Build and Run

```bash
# Full build (extension + webview)
npm run build

# Watch mode during development
npm run watch

# Launch extension in debug mode
# Press F5 in VS Code to open the Extension Development Host
```

---

## Key Files to Change

| File | Change Type | What Changes |
|---|---|---|
| `package.json` | MODIFY | Bump `engines.vscode` to `^1.90.0`; add `@agentclientprotocol/sdk` |
| `src/features/hooks/types.ts` | MODIFY | Extend `ActionType`, `GitOperation`, `GitHubOperation`; add `ACPActionParams`; deprecate `CopilotModel` |
| `src/features/hooks/actions/git-action.ts` | MODIFY | Add 6 new Git operation cases |
| `src/features/hooks/actions/github-action.ts` | MODIFY | Add 7 new GitHub operation cases |
| `src/features/hooks/actions/acp-action.ts` | NEW | ACP executor using `@agentclientprotocol/sdk` |
| `src/features/hooks/services/model-cache-service.ts` | NEW | `vscode.lm.selectChatModels` wrapper with TTL cache |
| `src/features/hooks/hook-executor.ts` | MODIFY | Add `"acp"` branch in action dispatch; wire `$acpAgentOutput` |
| `src/features/hooks/template-variable-constants.ts` | MODIFY | Add `$acpAgentOutput` variable definition |
| `src/providers/hook-view-provider.ts` | MODIFY | Handle `hooks/models-request`; inject `ModelCacheService`; send `hooks/models-available` |
| `ui/src/features/hooks-view/types.ts` | MODIFY | Add `ModelsAvailableMessage`, `RequestModelsMessage` |
| `ui/src/features/hooks-view/index.tsx` | MODIFY | Handle `hooks/models-available` message |
| `ui/src/features/hooks-view/hooks/use-available-models.ts` | NEW | React hook that requests and caches model list |
| `ui/src/features/hooks-view/components/cli-options/model-execution-options.tsx` | MODIFY | Replace `AVAILABLE_MODELS` const with `useAvailableModels()` |
| `ui/src/features/hooks-view/components/mcp-tools-selector.tsx` | MODIFY | Group tools by `serverName` using `MCPProviderGroup` |
| `ui/src/features/hooks-view/components/acp-agent-form.tsx` | NEW | ACP configuration form (mode, agentCommand, taskInstruction) |

---

## Implementation Order (TDD — write tests first)

### Step 1: Type foundation

1. Extend `src/features/hooks/types.ts` (add `"acp"` to `ActionType`, extend `GitOperation`, `GitHubOperation`, add `ACPActionParams`)
2. Run `npm run check` — no test required for pure type changes

### Step 2: ModelCacheService

1. Write test: `tests/unit/features/hooks/services/model-cache-service.test.ts`
2. Implement: `src/features/hooks/services/model-cache-service.ts`
3. Inject into `HookViewProvider` in `extension.ts`
4. Add `hooks/models-request` handler in `hook-view-provider.ts`
5. Write webview test: `tests/unit/webview/use-available-models.test.ts`
6. Implement: `ui/src/features/hooks-view/hooks/use-available-models.ts`
7. Modify `model-execution-options.tsx` to use the new hook

### Step 3: MCP Tools Grouping (UI only)

1. Write test: `tests/unit/webview/mcp-tools-selector.test.tsx`
2. Modify `mcp-tools-selector.tsx` to render `MCPProviderGroup[]`
3. No backend changes needed

### Step 4: Git Operations

1. Write test: `tests/unit/features/hooks/actions/git-action.test.ts` (add test cases for 6 new operations)
2. Extend `git-action.ts` switch statement
3. Run tests for the action in isolation

### Step 5: GitHub Operations

1. Write test: `tests/unit/features/hooks/actions/github-action.test.ts` (add test cases for 7 new operations)
2. Extend `github-action.ts` switch statement and `GitHubMcpClient` interface
3. Run tests for the action in isolation

### Step 6: ACP Action

1. Write test: `tests/unit/features/hooks/actions/acp-action.test.ts` (mock `@agentclientprotocol/sdk`)
2. Implement `src/features/hooks/actions/acp-action.ts`
3. Add `"acp"` dispatch branch in `hook-executor.ts`
4. Add `$acpAgentOutput` to `template-variable-constants.ts` and `template-variable-parser.ts`
5. Write integration test: `tests/integration/hooks/acp-hook-execution.test.ts`
6. Write webview form test: `tests/unit/webview/acp-agent-form.test.tsx`
7. Implement: `ui/src/features/hooks-view/components/acp-agent-form.tsx`

---

## Running Tests

```bash
# All tests
npm test

# Feature-specific tests
npm test -- tests/unit/features/hooks/
npm test -- tests/unit/webview/
npm test -- tests/integration/hooks/

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Quality Gate (before every commit)

```bash
npm run check    # lint + format validation — MUST pass
npm test         # all tests — MUST pass
```

---

## ACP Local Development Setup

To test ACP hook execution locally, you need a running ACP-compatible agent:

```bash
# Option 1: GitHub Copilot Language Server (requires Copilot subscription)
npx @github/copilot-language-server@latest --acp

# Option 2: OpenCode (open source)
npx opencode-ai@latest acp

# Option 3: Gemini CLI (requires Google API key)
npx @google/gemini-cli@latest --experimental-acp
```

Configure a hook with action type "ACP Agent", set `agentCommand` to one of the above, set `taskInstruction` to any prompt, and fire the hook trigger. The agent response will appear in the GatomIA output channel and be stored as `$acpAgentOutput`.

---

## Backward Compatibility Verification

After implementation, verify existing hooks still work:

```bash
# Run the full hooks test suite
npm test -- tests/unit/features/hooks/

# Specific backward compat checks
npm test -- -t "existing Git operations"
npm test -- -t "existing GitHub operations"
npm test -- -t "hook migration"
```

The `loadHooks()` migration in `hook-manager.ts` handles any stored hooks with the old `CopilotModel` enum values — they are already valid strings and require no migration.
