# Data Model: Hooks Refactor

**Feature**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Created**: 2026-02-18

---

## Entities and Type Changes

### 1. `ActionType` — Extended Union

**File**: `src/features/hooks/types.ts`

```
Before: "agent" | "git" | "github" | "mcp" | "custom"
After:  "agent" | "git" | "github" | "mcp" | "custom" | "acp"
```

- New variant `"acp"` added
- All existing variants unchanged

---

### 2. `GitOperation` — Extended Union

**File**: `src/features/hooks/types.ts`

```
Before: "commit" | "push"
After:  "commit" | "push" | "create-branch" | "checkout-branch" | "pull" | "merge" | "tag" | "stash"
```

**Per-operation parameter shapes** (added to `GitActionParams`):

| Operation | Additional fields |
|---|---|
| `commit` | `message: string` (existing) |
| `push` | (none; existing) |
| `create-branch` | `branchName: string` — template variables supported |
| `checkout-branch` | `branchName: string` |
| `pull` | (none) |
| `merge` | `branchName: string` (the branch to merge into current) |
| `tag` | `tagName: string`, `tagMessage?: string` |
| `stash` | `stashMessage?: string` |

**Validation rules**:
- `branchName` must be non-empty for `create-branch`, `checkout-branch`, `merge`
- `tagName` must be non-empty for `tag`
- All name/message fields support `$variable` template substitution

---

### 3. `GitHubOperation` — Extended Union

**File**: `src/features/hooks/types.ts`

```
Before: "open-issue" | "close-issue" | "create-pr" | "add-comment"
After:  "open-issue" | "close-issue" | "create-pr" | "add-comment"
      | "merge-pr" | "close-pr" | "add-label" | "remove-label"
      | "request-review" | "assign-issue" | "create-release"
```

**Per-operation parameter shapes** (added to `GitHubActionParams`):

| Operation | Required fields | Optional fields |
|---|---|---|
| `open-issue` | `title`, `body` | (existing) |
| `close-issue` | `issueNumber` | (existing) |
| `create-pr` | `title`, `body`, `baseBranch` | (existing) |
| `add-comment` | `issueNumber`, `body` | (existing) |
| `merge-pr` | `prNumber` | `mergeMethod: "merge"\|"squash"\|"rebase"` (default: `"merge"`) |
| `close-pr` | `prNumber` | |
| `add-label` | `issueNumber`, `labels: string[]` | |
| `remove-label` | `issueNumber`, `labelName: string` | |
| `request-review` | `prNumber`, `reviewers: string[]` | |
| `assign-issue` | `issueNumber`, `assignees: string[]` | |
| `create-release` | `tagName`, `releaseName`, `releaseBody` | `draft?: boolean`, `prerelease?: boolean` |

**Validation rules**:
- All numeric fields (`prNumber`, `issueNumber`) must be positive integers
- `labels` and `reviewers` and `assignees` must be non-empty arrays
- All text fields support template variable substitution

---

### 4. `CopilotModel` — Replaced with Dynamic Source

**File**: `src/features/hooks/types.ts`

The static `CopilotModel` union type is deprecated. The `model` field in `CopilotCliOptions` becomes:

```
Before: model?: CopilotModel
After:  modelId?: string   (opaque model ID string from vscode.lm)
```

**`CopilotModel` type itself** is kept as a deprecated alias (`type CopilotModel = string`) to avoid breaking any external consumers.

**Storage**: No migration needed — stored values are already strings. The TypeScript type change is additive.

---

### 5. `ACPActionParams` — New Entity

**File**: `src/features/hooks/types.ts`

```typescript
interface ACPActionParams {
  mode: "local";                // only "local" in this iteration
  agentCommand: string;         // the subprocess command string
                                // e.g., "npx @github/copilot-language-server@latest --acp"
  agentDisplayName?: string;    // human-readable label shown in UI
  taskInstruction: string;      // the task prompt; supports $variable substitution
  cwd?: string;                 // working dir for subprocess; defaults to workspace root
}
```

**Validation rules**:
- `agentCommand` must be non-empty
- `taskInstruction` must be non-empty
- `mode` must be `"local"` (future: `"remote"`)
- `cwd`, if provided, must be an absolute path

**State transitions** (hook execution lifecycle for ACP):

```
PENDING → SPAWNING → HANDSHAKE → SESSION_CREATED → PROMPTING → COLLECTING → DONE
                                                                           → TIMEOUT
                                                                           → ERROR
```

---

### 6. `ModelAvailabilityRecord` — New Entity (Service-Only)

**File**: `src/features/hooks/services/model-cache-service.ts`

Not persisted to storage. Lives only in memory as a service cache.

```typescript
interface ModelAvailabilityRecord {
  models: LanguageModelInfo[];   // ordered list of available models
  fetchedAt: number;             // Date.now() timestamp
  isStale: boolean;              // true when onDidChangeChatModels fired since last fetch
}

interface LanguageModelInfo {
  id: string;           // opaque model ID (used for storage in CopilotCliOptions.modelId)
  name: string;         // human-readable display name for UI dropdown
  family: string;       // e.g., "gpt-4o", "claude-3.5-sonnet"
  maxInputTokens: number;
}
```

**Cache policy**:
- TTL: 5 minutes (`MODEL_CACHE_TTL_MS = 300_000`)
- Invalidated immediately on `vscode.lm.onDidChangeChatModels` event
- Never empty on return: falls back to stale cache with `isStale: true` when fetch fails (FR-005)
- First call triggers VS Code's user consent dialog (by design — `selectChatModels` is user-initiated)

---

### 7. `MCPProviderGroup` — New UI-Only Entity

**File**: `ui/src/features/hooks-view/types.ts` (UI side only; never persisted)

Used only within `mcp-tools-selector.tsx` for rendering grouped tools.

```typescript
interface MCPProviderGroup {
  serverName: string;          // display label for the group header
  serverId: string;            // used for keying
  tools: MCPToolOption[];      // tools belonging to this server, sorted alphabetically
  isOther: boolean;            // true for the catch-all "Other" group
}

interface MCPToolOption {
  serverId: string;
  serverName: string;
  toolName: string;
  toolDisplayName: string;
  isSelected: boolean;
}
```

**Derivation rules**:
- Derived from the existing `MCPServer[]` + `selectedTools: SelectedMCPTool[]` at render time
- Tools with no `serverName` → `isOther: true` group
- Groups sorted: named groups alphabetically, then "Other" last
- `SelectedMCPTool` data structure on stored hooks is **unchanged**

---

## Relationships and Invariants

```
Hook
 └── actions: ActionConfig[]
      └── ActionConfig
           ├── type: ActionType  ("agent" | "git" | "github" | "mcp" | "custom" | "acp")
           └── params: ActionParameters
                ├── AgentActionParams      (type: "agent")
                ├── GitActionParams        (type: "git")   — EXTENDED
                ├── GitHubActionParams     (type: "github") — EXTENDED
                ├── MCPActionParams        (type: "mcp")
                ├── CustomActionParams     (type: "custom")
                └── ACPActionParams        (type: "acp")   — NEW
```

**Invariants**:
- `ActionType` and `params` must be consistent (enforced by type guard `isACPActionParams`, etc.)
- `GitActionParams.branchName` is required iff `operation` is `"create-branch"`, `"checkout-branch"`, or `"merge"`
- `GitActionParams.tagName` is required iff `operation` is `"tag"`
- `GitHubActionParams.prNumber` is required iff `operation` is one of `"merge-pr"`, `"close-pr"`, `"request-review"`
- `GitHubActionParams.issueNumber` is required iff `operation` is one of `"close-issue"`, `"add-comment"`, `"add-label"`, `"remove-label"`, `"assign-issue"`
- `ACPActionParams.mode` must be `"local"` in v1
- Stored `modelId` strings are opaque; no validation against a known list at rest (validation occurs at configuration time, not at load time)
