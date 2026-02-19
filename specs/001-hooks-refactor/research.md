# Research: Hooks Refactor

**Feature**: [spec.md](./spec.md)
**Created**: 2026-02-18
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: Dynamic Model Enumeration API

**Decision**: Use `vscode.lm.selectChatModels({ vendor: "copilot" })` to enumerate available models at runtime. Replace the static `CopilotModel` hardcoded union type with a `string` type for stored model IDs and a service (`ModelCacheService`) that maintains a live, cached list of `LanguageModelChat` objects.

**Rationale**:
- `vscode.lm.selectChatModels()` already filters by the user's active subscription — the returned array contains only models the user can call. No manual subscription-tier filtering is needed.
- Each returned `LanguageModelChat` object has: `id`, `name`, `vendor`, `family`, `version`, `maxInputTokens` — sufficient to populate a dropdown with display names and persist model IDs.
- `vscode.lm.onDidChangeChatModels` event allows the cache to be invalidated exactly when the available set changes (subscription upgrade/downgrade, Copilot re-auth), with no polling required.
- The spec requires (FR-004) that the list be refreshed on panel open and (FR-005) that the last known list be shown when offline — both are naturally satisfied by a cache-first pattern with in-memory TTL.

**Alternatives considered**:
- Keep `CopilotModel` as a hardcoded union and add a VS Code setting for overrides — rejected because it requires manual maintenance as Copilot adds/removes models and does not solve the subscription-filtering problem.
- Call a GitHub REST API endpoint to enumerate subscription models — rejected because it requires a separate auth token, introduces a network dependency not mediated by VS Code, and `vscode.lm.selectChatModels` is the correct VS Code-native approach.

**Breaking change required**: `engines.vscode` in `package.json` must be bumped from `^1.84.0` to `^1.90.0`. `vscode.lm.selectChatModels` was introduced in VS Code 1.90 (June 2024). A runtime guard (`if (vscode.lm?.selectChatModels)`) must be used in case the extension runs on an older host, with fallback to the last known cached list (FR-005 compliance).

**Cache design**: 5-minute in-memory TTL (matching the existing `MCP_DISCOVERY_CACHE_TTL` pattern from `mcp-discovery.ts`). Invalidated immediately on `onDidChangeChatModels`. The stored `modelId` field on `CopilotCliOptions` becomes `string` (was a member of the `CopilotModel` union) — no migration needed since stored IDs are valid strings.

---

## Decision 2: MCP Tools Grouping Implementation Strategy

**Decision**: Implement provider grouping as a **pure UI-side transformation** in the webview's `mcp-tools-selector.tsx` component. Use the existing `serverName` field already present on `SelectedMCPTool` (and `serverId` on `MCPTool`) to group tools. No backend changes are required.

**Rationale**:
- `SelectedMCPTool` already carries `{ serverId, serverName, toolName, toolDisplayName }` — the server name is available without any new data fetching.
- `MCPServer[]` is already sent to the webview via the `hooks/mcp-servers` message — the webview has both the server name and the tools list.
- Grouping is presentation-only (spec FR-009 explicitly states: "MCP provider grouping is a presentation-only change; the underlying `SelectedMCPTool` data structure remains unchanged").
- The existing `use-mcp-servers.ts` React hook already manages the discovered server/tool list — it just needs to expose a grouped view alongside the flat list.

**Alternatives considered**:
- Group on the extension side and send pre-grouped data to the webview — rejected because it adds unnecessary complexity to the backend, couples backend to UI concerns, and the spec explicitly calls this a presentation-only change.
- Create a new `groupedTools` field on `MCPServer` — rejected (YAGNI): the grouping can be derived from existing `serverId`/`serverName` fields at render time.

**Sort order**: Provider groups sorted alphabetically by `serverName`; tools within each group sorted alphabetically by `toolDisplayName`. Tools with no `serverName` (empty string or undefined) go into an "Other" group rendered last (FR-007, FR-008).

---

## Decision 3: Extended Git Operations Implementation Strategy

**Decision**: Extend `GitActionExecutor` (`src/features/hooks/actions/git-action.ts`) to handle 6 new operations using the existing `vscode.git` extension API (already used for `commit` and `push`). The `GitOperation` union type is expanded in `types.ts`; per-operation parameter shapes are added to `GitActionParams`.

**New operations and their VS Code Git API mapping**:

| Operation | VS Code Git API | Key fields |
|---|---|---|
| `create-branch` | `repository.createBranch(name, checkout)` | `branchName: string` (template supported) |
| `checkout-branch` | `repository.checkout(name)` | `branchName: string` |
| `pull` | `repository.pull()` | (no additional params) |
| `merge` | `repository.merge(ref)` | `branchName: string` |
| `tag` | `repository.tag(name, message?)` | `tagName: string`, `tagMessage?: string` |
| `stash` | `repository.createStash(message?, includeUntracked?)` | `stashMessage?: string` |

**Rationale**: The VS Code Git extension API (`vscode.extensions.getExtension("vscode.git")`) is already used in `git-action.ts`. All new operations are covered by the same API surface. No new dependencies are required.

**Alternatives considered**:
- Spawn `git` CLI commands via `child_process` — rejected because it duplicates what the VS Code Git extension already handles, introduces PATH dependency, and bypasses VS Code's Git credential manager.
- Use `simple-git` npm library — rejected (YAGNI): the existing API is sufficient and avoids adding a dependency.

**Backward compatibility**: `GitActionParams.operation` is currently `"commit" | "push"`. Extending the union is additive. Existing hooks with `operation: "commit"` or `"push"` continue to route to the existing code paths without modification (FR-014).

---

## Decision 4: Extended GitHub Operations Implementation Strategy

**Decision**: Extend `GitHubActionExecutor` (`src/features/hooks/actions/github-action.ts`) to handle 7 new operations. The existing executor already delegates to an injected `GitHubMcpClient` interface — extend that interface with the new operation methods. The default no-op implementation (which returns `undefined`) will need a real client wired in `extension.ts`.

**New operations and their GitHub API mapping** (via GitHub REST API / Octokit, invoked through the existing MCP GitHub server pattern):

| Operation | GitHub REST endpoint | Key fields |
|---|---|---|
| `merge-pr` | `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge` | `prNumber`, `mergeMethod?: "merge"\|"squash"\|"rebase"` |
| `close-pr` | `PATCH /repos/.../pulls/{number}` `state=closed` | `prNumber` |
| `add-label` | `POST /repos/.../issues/{number}/labels` | `issueNumber`, `labels: string[]` |
| `remove-label` | `DELETE /repos/.../issues/{number}/labels/{name}` | `issueNumber`, `labelName` |
| `request-review` | `POST /repos/.../pulls/{number}/requested_reviewers` | `prNumber`, `reviewers: string[]` |
| `assign-issue` | `POST /repos/.../issues/{number}/assignees` | `issueNumber`, `assignees: string[]` |
| `create-release` | `POST /repos/.../releases` | `tagName`, `releaseName`, `releaseBody`, `draft?: boolean`, `prerelease?: boolean` |

**Rationale**: The existing `GitHubMcpClient` interface pattern cleanly extends. The MCP GitHub server (when present) already provides these operations as tools — the executor delegates to the MCP client which translates to the appropriate GitHub REST calls.

**Backward compatibility**: Existing operations (`open-issue`, `close-issue`, `create-pr`, `add-comment`) are not modified. The union extension is additive (FR-018).

---

## Decision 5: ACP Integration Architecture

**Decision**: Implement ACP as a new `"acp"` action type using `@agentclientprotocol/sdk` (`ClientSideConnection`). For **this iteration, only local agents (stdio/JSON-RPC subprocess) are supported**. Remote agent support (HTTP/WebSocket) is deferred — the spec assumption confirms "Remote ACP agent authentication will support Bearer token auth as a minimum; OAuth flows are out of scope for this iteration" and the ACP remote transport spec is still in draft.

**Implementation approach**:
1. New file `src/features/hooks/actions/acp-action.ts` contains `ACPActionExecutor` class.
2. Executor spawns the local agent process using `child_process.spawn` with the configured command.
3. Uses `ClientSideConnection` from `@agentclientprotocol/sdk` for the JSON-RPC framing.
4. Protocol sequence: `initialize` → `session/new` → `session/prompt` → collect `session/update` notifications → return final output.
5. Timeout is enforced via a `setTimeout` that calls `session/cancel`.
6. Response content from `session/update` notifications with `sessionUpdate: "agent_message_chunk"` is accumulated and exposed as `$acpAgentOutput`.

**ACP agent discovery**: Local agents are listed from:
- The workspace's `.github/agents/` directory (same path as Custom Agents, filtered to entries with `acp: true` frontmatter) — **IN SCOPE for Iteration 1** (FR-024; implemented by `AcpAgentDiscoveryService`)
- A user-configurable list of agent commands (e.g., `npx @github/copilot-language-server@latest --acp`) — exposed as the "Custom command…" free-text fallback in the form dropdown — **IN SCOPE for Iteration 1**
- The public ACP registry at `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` — **OUT OF SCOPE for Iteration 1**. This is an optional network fetch that adds complexity (error handling, caching, privacy review) without being required by any FR. Deferred to a follow-up if user demand warrants it.

**New `ACPActionParams` shape**:
```typescript
interface ACPActionParams {
  mode: "local";               // only "local" in this iteration
  agentCommand: string;        // e.g., "npx @github/copilot-language-server@latest --acp"
  agentDisplayName?: string;   // human label
  taskInstruction: string;     // template-variable-supported prompt
  cwd?: string;                // defaults to workspace root
}
```

**Rationale**: `@agentclientprotocol/sdk` is the official TypeScript SDK (~1.5M weekly downloads), used by the reference `formulahendry/vscode-acp` VS Code extension. Implementing from scratch would duplicate the JSON-RPC framing and session management. The SDK handles `ClientSideConnection`, `initialize`, `session/new`, `session/prompt` sequencing, and `session/update` notification routing.

**Alternatives considered**:
- Implement the JSON-RPC framing manually without the SDK — rejected because the official SDK is stable, well-tested, and the correct tool for the job.
- Support remote (HTTP) agents in this iteration — rejected (out of scope per spec assumptions; remote transport spec is still in draft and not production-ready).
- Reuse the `CustomActionExecutor` path — rejected because ACP has fundamentally different lifecycle management (subprocess spawn, handshake, session, cancel) that does not fit the existing pattern.

**Dependencies to add**:
- Root `package.json`: `"@agentclientprotocol/sdk": "^0.14.1"` (runtime, bundled by esbuild)
- No changes to `ui/package.json` — the ACP executor runs entirely in the extension host

---

## Integration Points and Constraints

### engines.vscode Bump
- **Current**: `^1.84.0`
- **Required**: `^1.90.0`
- **Reason**: `vscode.lm.selectChatModels` introduced in VS Code 1.90
- **Risk**: Low — VS Code 1.90 was released June 2024; virtually all active installs are ≥1.90

### Existing Migration Pattern
`hook-manager.ts:loadHooks()` already performs two in-line migrations on load:
1. Adds default `timing: "after"` if missing
2. Renames `agentId` → `modelId` in MCP params

The `CopilotModel`-to-`string` change for stored hooks requires no migration because stored model IDs are already strings — the TypeScript type narrowing was the only constraint.

### ACP SDK Bundling
`@agentclientprotocol/sdk` must be added to esbuild's bundle. It is a pure ESM package. Verify the esbuild config in `esbuild.js` handles ESM-to-CJS transformation (the existing `copilot-mcp-utils.ts` already imports VS Code's ESM APIs, so the bundler handles this).

### No NEEDS CLARIFICATION Remaining
All unknowns identified during Technical Context analysis have been resolved by this research.

---

## Phase 8: Simplified Known Agent Selection — Architecture Decisions

### Problem
The previous `acp-agent-form.tsx` required users to know and type the exact ACP agent command manually. This created friction for the 7 most common ACP agents already in the public registry.

### Solution: Two-Path UX
1. **Known agents checklist** — 7 pre-configured catalog entries with checkbox enable + detection badge
2. **Custom agents** — retained for any agent not in the catalog

### The 7 Catalog Entries (`KnownAgentCatalog`)

| ID | Display Name | Command | Install Check Strategy |
|----|---|---|---|
| `claude-acp` | Claude Code | `npx @zed-industries/claude-agent-acp` | npm-global |
| `kimi` | Kimi Code CLI | `kimi acp` | path |
| `gemini` | Gemini CLI | `npx @google/gemini-cli --experimental-acp` | npm-global |
| `github-copilot` | GitHub Copilot | `npx @github/copilot-language-server --acp` | npm-global |
| `codex-acp` | OpenAI Codex | `npx @zed-industries/codex-acp` | npm-global |
| `mistral-vibe` | Mistral Vibe | `vibe-acp` | path |
| `opencode` | OpenCode | `opencode acp` | path |

### New Services
- **`KnownAgentDetector`** — stateless, two strategies: `npm-global` (`npm list -g <pkg>`) and `path` (`which`/`where`)
- **`KnownAgentPreferencesService`** — persists enabled IDs in `globalState` under key `gatomia.acp.knownAgents.enabled`

### New Bridge Messages
- `hooks/acp-known-agents-request` (webview → extension) — request current status
- `hooks/acp-known-agents-status` (extension → webview) — full per-agent status array
- `hooks/acp-known-agents-toggle` (webview → extension) — toggle one agent on/off

### Key Design Decision: Only Show Enabled+Detected
`descriptor` in `KnownAgentStatus` is non-null **only** when both `enabled=true` AND `isDetected=true`. This prevents users from selecting an agent that isn't installed, avoiding silent spawn failures.

### New UI Component: `AcpKnownAgentsPanel`
Checklist component rendering `KnownAgentStatus[]`. Each row: checkbox + display name + detected/not-installed badge.

### Backward Compatibility
- `ACPAgentDescriptor.source` expanded from `"workspace"` to `"workspace" | "known" | "custom"` — no breaking change since webview only read the value
- `AcpAgentDiscoveryService` constructor gains optional `detector?` and `prefs?` params — existing call sites without these args continue to work
- All existing `AcpAgentForm` tests (20 tests) continue to pass unchanged
