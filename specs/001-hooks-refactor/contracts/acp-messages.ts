/**
 * Contract: Bridge Message Types for Hooks Refactor
 *
 * This file defines the complete message contract between the VS Code extension
 * host and the webview for the 001-hooks-refactor feature additions.
 * New messages are additive — all existing messages are unchanged.
 *
 * Actual implementation: src/features/hooks/types.ts (extension side)
 *                        ui/src/features/hooks-view/types.ts (webview side)
 *
 * @feature 001-hooks-refactor
 */

// ---------------------------------------------------------------------------
// Reference stubs (actual types live in src/features/hooks/types.ts)
// ---------------------------------------------------------------------------

/** @see src/features/hooks/types.ts AgentActionParams */
export type AgentActionParamsRef = unknown;
/** @see src/features/hooks/types.ts MCPActionParams */
export type MCPActionParamsRef = unknown;
/** @see src/features/hooks/types.ts CustomActionParams */
export type CustomActionParamsRef = unknown;

// ---------------------------------------------------------------------------
// New: Extension → Webview messages
// ---------------------------------------------------------------------------

/**
 * Sent when the available model list has been fetched or refreshed.
 * The webview replaces its dropdown list with this payload.
 *
 * Trigger: panel open, or after onDidChangeChatModels fires.
 */
export interface ModelsAvailableMessage {
	type: "hooks/models-available";
	/** Empty array means no models accessible (show warning + disable model field). */
	models: LanguageModelInfoPayload[];
	/** True when served from stale cache (offline / API unavailable). */
	isStale: boolean;
}

export interface LanguageModelInfoPayload {
	id: string;
	name: string;
	family: string;
	maxInputTokens: number;
}

/**
 * Sent when model fetch fails and the cache is completely empty (first-ever open, offline).
 * Webview should show an error notice and disable the model selector.
 */
export interface ModelsErrorMessage {
	type: "hooks/models-error";
	message: string;
}

// ---------------------------------------------------------------------------
// New: Webview → Extension messages
// ---------------------------------------------------------------------------

/**
 * Webview requests a fresh model list.
 * Sent on panel open and on user-triggered "Refresh models" action.
 */
export interface RequestModelsMessage {
	type: "hooks/models-request";
	/** If true, bypass cache and call selectChatModels unconditionally. */
	forceRefresh?: boolean;
}

// ---------------------------------------------------------------------------
// ACP action bridge messages (hook create/update carry ACPActionParams inline)
// — no separate message type needed; ACPActionParams travels inside Hook.actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ACP agent discovery messages
// ---------------------------------------------------------------------------

/**
 * Describes a discoverable local ACP agent (FR-024).
 * Populated by AcpAgentDiscoveryService from .github/agents/*.agent.md files
 * that have `acp: true` in their YAML frontmatter.
 */
export interface ACPAgentDescriptor {
	/** Shell command used to spawn the agent (from frontmatter agentCommand field). */
	agentCommand: string;
	/** Human-readable label shown in the dropdown (from frontmatter agentDisplayName or filename). */
	agentDisplayName: string;
	/** Where this descriptor originated. */
	source: "workspace";
}

/**
 * Extension → Webview: list of discovered ACP agents.
 * Sent in response to hooks/acp-agents-request.
 * An empty array is valid (no agents found in workspace).
 */
export interface ACPAgentsAvailableMessage {
	type: "hooks/acp-agents-available";
	agents: ACPAgentDescriptor[];
}

/**
 * Webview → Extension: request the discovered agent list.
 * Sent when the ACP agent form mounts.
 */
export interface ACPAgentsRequestMessage {
	type: "hooks/acp-agents-request";
}

// ---------------------------------------------------------------------------
// Complete new message union additions
// ---------------------------------------------------------------------------

/** Union of NEW extension → webview messages added by this feature. */
export type NewExtensionMessage =
	| ModelsAvailableMessage
	| ModelsErrorMessage
	| ACPAgentsAvailableMessage;

/** Union of NEW webview → extension messages added by this feature. */
export type NewWebviewMessage = RequestModelsMessage | ACPAgentsRequestMessage;

// ---------------------------------------------------------------------------
// ModelCacheService interface contract
// ---------------------------------------------------------------------------

/**
 * Public interface that ModelCacheService must implement.
 * Registered in extension.ts and injected into HookViewProvider.
 */
export interface IModelCacheService {
	/**
	 * Returns available models.
	 * - On first call: fetches via vscode.lm.selectChatModels (triggers consent dialog if needed)
	 * - Subsequent calls within TTL: returns cached result
	 * - On onDidChangeChatModels: invalidates cache; next call re-fetches
	 * - On fetch failure: returns last known cache with isStale=true; never throws
	 */
	getAvailableModels(forceRefresh?: boolean): Promise<{
		models: LanguageModelInfoPayload[];
		isStale: boolean;
	}>;

	/** Dispose event subscriptions. */
	dispose(): void;
}

// ---------------------------------------------------------------------------
// ACPActionExecutor interface contract
// ---------------------------------------------------------------------------

/**
 * Public interface that ACPActionExecutor must implement.
 * Mirrors the existing action executor pattern.
 */
export interface IACPActionExecutor {
	/**
	 * Execute an ACP agent action.
	 * @param params - ACP action configuration
	 * @param templateContext - resolved template variable values
	 * @returns agent response content (exposed as $acpAgentOutput)
	 * @throws ACPExecutionError on timeout, spawn failure, or protocol error
	 */
	execute(
		params: ACPActionParamsExecute,
		templateContext: Record<string, string>,
	): Promise<ACPExecutionResult>;
}

export interface ACPActionParamsExecute {
	mode: "local";
	agentCommand: string;
	agentDisplayName?: string;
	taskInstruction: string;
	cwd?: string;
}

export interface ACPExecutionResult {
	/** Accumulated agent response text (all agent_message_chunk content joined). */
	output: string;
	/** ACP stopReason from the final session/prompt response. */
	stopReason: "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
	/** Duration in ms from subprocess spawn to final response. */
	durationMs: number;
}

/**
 * Error thrown by ACPActionExecutor on any non-successful execution.
 * The `message` field MUST be actionable (FR-026): it must tell the developer
 * what went wrong AND what to do next.
 *
 * Required message format: "[Context]: [What happened]. [What to do]."
 *
 * Examples of COMPLIANT messages:
 *   "ACP agent spawn failed: command 'npx @github/copilot-ls --acp' not found.
 *    Verify the agentCommand is installed and on PATH."
 *
 *   "ACP agent timed out after 30s waiting for session/prompt response.
 *    Increase the hook timeout in settings or check if the agent process is
 *    unresponsive (PID 12345)."
 *
 *   "ACP handshake failed: agent returned error code -32600 (Invalid Request).
 *    Confirm the agent supports ACP protocol version 0.14 or later."
 *
 * Examples of NON-COMPLIANT messages (forbidden):
 *   "Execution failed"          — no context, no action
 *   "Error: ENOENT"             — raw OS error, not actionable
 *   "Something went wrong"      — no detail
 *
 * The `code` field is machine-readable for telemetry and test assertions.
 */
export interface ACPExecutionError extends Error {
	/** Machine-readable error code for telemetry and test assertions. */
	code:
		| "SPAWN_FAILED"          // child_process.spawn threw / ENOENT / EACCES
		| "HANDSHAKE_TIMEOUT"     // initialize did not complete within timeout
		| "SESSION_TIMEOUT"       // session/prompt did not respond within timeout
		| "PROTOCOL_ERROR"        // JSON-RPC error response received
		| "EMPTY_RESPONSE"        // agent responded but produced no output chunks
		| "CANCELLED";            // hook was cancelled externally
	/** Human-readable, actionable message (see format rules above). */
	message: string;
	/** Optional subprocess PID for debugging (available after spawn). */
	pid?: number;
}

// ---------------------------------------------------------------------------
// Git / GitHub executor interface additions
// ---------------------------------------------------------------------------

/** Extended Git executor interface — all new operations must be covered. */
export interface IGitActionExecutorExtended {
	execute(
		params: GitActionParamsExecute,
		templateContext: Record<string, string>,
	): Promise<void>;
}

export interface GitActionParamsExecute {
	operation:
		| "commit"
		| "push"
		| "create-branch"
		| "checkout-branch"
		| "pull"
		| "merge"
		| "tag"
		| "stash";
	message?: string;
	branchName?: string;
	tagName?: string;
	tagMessage?: string;
	stashMessage?: string;
}

/** Extended GitHub executor interface — all new operations must be covered. */
export interface IGitHubActionExecutorExtended {
	execute(
		params: GitHubActionParamsExecute,
		templateContext: Record<string, string>,
	): Promise<void>;
}

export interface GitHubActionParamsExecute {
	operation:
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
	// existing fields
	title?: string;
	body?: string;
	issueNumber?: number;
	baseBranch?: string;
	// new fields
	prNumber?: number;
	mergeMethod?: "merge" | "squash" | "rebase";
	labels?: string[];
	labelName?: string;
	reviewers?: string[];
	assignees?: string[];
	tagName?: string;
	releaseName?: string;
	releaseBody?: string;
	draft?: boolean;
	prerelease?: boolean;
}
