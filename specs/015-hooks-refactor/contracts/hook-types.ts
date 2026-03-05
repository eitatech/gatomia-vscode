/**
 * Contract: Extended Hook Types
 *
 * This file defines the TypeScript type contract for all type changes introduced
 * by the 001-hooks-refactor feature. These are the "before and after" interfaces
 * that implementation MUST satisfy. Actual implementation lives in:
 *   src/features/hooks/types.ts
 *
 * @feature 001-hooks-refactor
 * @spec specs/001-hooks-refactor/spec.md
 * @data-model specs/001-hooks-refactor/data-model.md
 */

// ---------------------------------------------------------------------------
// Action Type
// ---------------------------------------------------------------------------

/** Extended action type union — adds "acp" to the existing set. */
export type ActionType = "agent" | "git" | "github" | "mcp" | "custom" | "acp";

// ---------------------------------------------------------------------------
// Git Operations — Extended
// ---------------------------------------------------------------------------

/** Extended Git operation union.
 *  Backward-compatible: existing "commit" | "push" values remain valid. */
export type GitOperation =
	| "commit"
	| "push"
	| "create-branch"
	| "checkout-branch"
	| "pull"
	| "merge"
	| "tag"
	| "stash";

/** Parameters for Git hook actions — extended with per-operation fields. */
export interface GitActionParams {
	operation: GitOperation;

	// commit / push (existing)
	message?: string;

	// create-branch | checkout-branch | merge
	branchName?: string;

	// tag
	tagName?: string;
	tagMessage?: string;

	// stash
	stashMessage?: string;
}

/** Validation invariants (enforced at hook-save time, not type-system level):
 *  - operation "create-branch" | "checkout-branch" | "merge": branchName required
 *  - operation "tag": tagName required
 *  - operation "commit": message required
 */

// ---------------------------------------------------------------------------
// GitHub Operations — Extended
// ---------------------------------------------------------------------------

/** Extended GitHub operation union.
 *  Backward-compatible: existing 4 values remain valid. */
export type GitHubOperation =
	| "open-issue"
	| "close-issue"
	| "create-pr"
	| "add-comment"
	| "merge-pr"
	| "close-pr"
	| "add-label"
	| "remove-label"
	| "request-review"
	| "assign-issue"
	| "create-release";

/** Parameters for GitHub hook actions — extended with per-operation fields. */
export interface GitHubActionParams {
	operation: GitHubOperation;

	// open-issue (existing)
	title?: string;
	body?: string;

	// close-issue | add-comment | add-label | remove-label | assign-issue (existing + new)
	issueNumber?: number;

	// create-pr (existing)
	baseBranch?: string;

	// merge-pr | close-pr | request-review (new)
	prNumber?: number;

	// merge-pr (new)
	mergeMethod?: "merge" | "squash" | "rebase";

	// add-label (new)
	labels?: string[];

	// remove-label (new)
	labelName?: string;

	// request-review (new)
	reviewers?: string[];

	// assign-issue (new)
	assignees?: string[];

	// create-release (new)
	tagName?: string;
	releaseName?: string;
	releaseBody?: string;
	draft?: boolean;
	prerelease?: boolean;
}

// ---------------------------------------------------------------------------
// Model Availability — Dynamic (replaces hardcoded CopilotModel union)
// ---------------------------------------------------------------------------

/** Runtime model descriptor returned by ModelCacheService.
 *  Derived from vscode.LanguageModelChat fields. */
export interface LanguageModelInfo {
	/** Opaque model ID — persisted as CopilotCliOptions.modelId */
	id: string;
	/** Human-readable display name for UI dropdown */
	name: string;
	/** Model family (e.g., "gpt-4o", "claude-3.5-sonnet") */
	family: string;
	/** Maximum input tokens for this model */
	maxInputTokens: number;
}

/** Cache record held by ModelCacheService (not persisted). */
export interface ModelAvailabilityRecord {
	models: LanguageModelInfo[];
	fetchedAt: number;
	/** True when onDidChangeChatModels fired since last successful fetch. */
	isStale: boolean;
}

/** Deprecated static type — kept as alias to avoid breaking external consumers.
 *  Use LanguageModelInfo.id (string) instead. */
export type CopilotModel = string;

// ---------------------------------------------------------------------------
// ACP Action — New Entity
// ---------------------------------------------------------------------------

/** Execution mode for ACP agent actions.
 *  Only "local" (stdio/JSON-RPC subprocess) is supported in v1. */
export type ACPExecutionMode = "local";

/** Parameters for ACP Agent hook actions. */
export interface ACPActionParams {
	mode: ACPExecutionMode;
	/** The subprocess command that starts the ACP agent.
	 *  Examples:
	 *    "npx @github/copilot-language-server@latest --acp"
	 *    "npx opencode-ai@latest acp"
	 */
	agentCommand: string;
	/** Human-readable label shown in hook list and logs. */
	agentDisplayName?: string;
	/** Task instruction sent to the agent. Supports $variable template substitution. */
	taskInstruction: string;
	/** Working directory for the subprocess. Defaults to workspace root. */
	cwd?: string;
}

/** ACP execution lifecycle states (used in telemetry and logging). */
export type ACPExecutionState =
	| "PENDING"
	| "SPAWNING"
	| "HANDSHAKE"
	| "SESSION_CREATED"
	| "PROMPTING"
	| "COLLECTING"
	| "DONE"
	| "TIMEOUT"
	| "ERROR";

// ---------------------------------------------------------------------------
// UI-only: MCP Provider Grouping
// ---------------------------------------------------------------------------

/** A group of MCP tools from a single server/provider (UI-only, never persisted). */
export interface MCPProviderGroup {
	serverName: string;
	serverId: string;
	tools: MCPToolOption[];
	/** True for the catch-all "Other" group (tools with unknown/missing serverId). */
	isOther: boolean;
}

/** Individual MCP tool option in the picker (UI-only). */
export interface MCPToolOption {
	serverId: string;
	serverName: string;
	toolName: string;
	toolDisplayName: string;
	isSelected: boolean;
}

// ---------------------------------------------------------------------------
// Extended ActionParameters union
// ---------------------------------------------------------------------------

/** Updated ActionParameters union — adds ACPActionParams. */
export type ActionParameters =
	| { type: "agent"; params: import("./acp-messages").AgentActionParamsRef }
	| { type: "git"; params: GitActionParams }
	| { type: "github"; params: GitHubActionParams }
	| { type: "mcp"; params: import("./acp-messages").MCPActionParamsRef }
	| { type: "custom"; params: import("./acp-messages").CustomActionParamsRef }
	| { type: "acp"; params: ACPActionParams };
