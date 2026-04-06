// Hook entity types (matching backend data model)

export type AgentType = "speckit" | "openspec";

export type OperationType =
	| "research"
	| "datamodel"
	| "design"
	| "specify"
	| "clarify"
	| "plan"
	| "tasks"
	| "taskstoissues"
	| "analyze"
	| "checklist"
	| "constitution"
	| "implementation"
	| "unit-test"
	| "integration-test";

export type TriggerTiming = "before" | "after";

export interface TriggerCondition {
	agent: AgentType;
	operation: OperationType;
	timing: TriggerTiming;
	waitForCompletion?: boolean; // Only for "before" timing: block operation until hook completes
}

export type ActionType = "agent" | "git" | "github" | "custom" | "mcp" | "acp";

export interface AgentActionParams {
	command: string;
}

export interface GitActionParams {
	operation:
		| "commit"
		| "push"
		| "create-branch"
		| "checkout-branch"
		| "pull"
		| "merge"
		| "tag"
		| "stash";
	messageTemplate: string;
	pushToRemote?: boolean;
	branchName?: string; // For create-branch, checkout-branch, merge
	tagName?: string; // For tag operation
	tagMessage?: string; // For tag operation (optional annotation)
	stashMessage?: string; // For stash operation (optional label)
}

export interface GitHubActionParams {
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
	repository?: string;
	titleTemplate?: string;
	bodyTemplate?: string;
	issueNumber?: number;
	prNumber?: number; // For merge-pr, close-pr, request-review
	mergeMethod?: "merge" | "squash" | "rebase"; // For merge-pr
	labels?: string[]; // For add-label (comma-separated list in UI)
	labelName?: string; // For remove-label
	reviewers?: string[]; // For request-review (comma-separated list in UI)
	assignees?: string[]; // For assign-issue (comma-separated list in UI)
	tagName?: string; // For create-release
	releaseName?: string; // For create-release
	releaseBody?: string; // For create-release
	draft?: boolean; // For create-release
	prerelease?: boolean; // For create-release
}

export interface CustomActionParams {
	agentId?: string; // Optional: Agent ID from agent registry
	agentName?: string; // Custom agent identifier (deprecated - use agentId)
	agentType?: "local" | "background"; // Explicit execution type override
	prompt?: string; // Instruction/action text for the agent
	selectedTools?: SelectedMCPTool[]; // Optional: MCP tools available to agent
	arguments?: string; // Template string with $variable syntax for passing trigger context
	cliOptions?: CopilotCliOptions; // GitHub Copilot CLI options
}

/**
 * GitHub Copilot CLI Options - All available CLI parameters
 */
export interface CopilotCliOptions {
	// Directory and Path Options
	addDir?: string[];
	allowAllPaths?: boolean;
	disallowTempDir?: boolean;

	// Tool Permissions
	allowAllTools?: boolean;
	allowTool?: string[];
	availableTools?: string[];
	excludedTools?: string[];
	denyTool?: string[];

	// URL Permissions
	allowAllUrls?: boolean;
	allowUrl?: string[];
	denyUrl?: string[];

	// GitHub MCP Server Options
	addGithubMcpTool?: string[];
	addGithubMcpToolset?: string[];
	enableAllGithubMcpTools?: boolean;

	// MCP Server Configuration
	additionalMcpConfig?: string[];
	disableBuiltinMcps?: boolean;
	disableMcpServer?: string[];

	// Execution Options
	agent?: string;
	modelId?: CopilotModel;
	noAskUser?: boolean;
	disableParallelToolsExecution?: boolean;
	noCustomInstructions?: boolean;

	// Output and Logging Options
	silent?: boolean;
	logLevel?: CopilotLogLevel;
	logDir?: string;
	noColor?: boolean;
	plainDiff?: boolean;
	screenReader?: boolean;
	stream?: "on" | "off";

	// Session Options
	resume?: boolean | string;
	continue?: boolean;
	share?: boolean | string;
	shareGist?: boolean;

	// Configuration
	configDir?: string;
	banner?: boolean;
	noAutoUpdate?: boolean;

	// Combined Flags
	allowAll?: boolean;
}

/**
 * @deprecated Use string (dynamic model ID from ModelCacheService) instead.
 *   This type is kept as a string alias to avoid breaking external consumers.
 */
export type CopilotModel = string;

export type CopilotLogLevel =
	| "none"
	| "error"
	| "warning"
	| "info"
	| "debug"
	| "all"
	| "default";

export interface MCPActionParams {
	// Model and instruction
	modelId?: string; // Optional: LLM model ID from GitHub subscription (e.g., 'gpt-4o', 'claude-3-5-sonnet')
	prompt: string; // Instruction/action text for the agent to execute

	// Selected tools (multiple selection supported)
	selectedTools: SelectedMCPTool[]; // Array of selected MCP tools

	// Legacy fields (kept for backward compatibility)
	serverId?: string; // MCP server identifier (deprecated, use selectedTools)
	serverName?: string; // Server display name (deprecated)
	toolName?: string; // Tool to execute (deprecated, use selectedTools)
	toolDisplayName?: string; // Tool display name (deprecated)
	parameterMappings?: Array<{
		toolParam: string;
		source: "context" | "literal" | "template";
		value: string;
	}>;
	timeout?: number;
}

export interface SelectedMCPTool {
	serverId: string; // Server providing the tool
	serverName: string; // Display name of server
	toolName: string; // Tool identifier
	toolDisplayName: string; // Human-readable tool name
}

/**
 * ACPExecutionMode - Only "local" (stdio/JSON-RPC subprocess) is supported in v1.
 */
export type ACPExecutionMode = "local";

/**
 * ACPAgentDescriptor - Describes a discoverable local ACP agent.
 * Populated from .github/agents/*.agent.md files with `acp: true` frontmatter,
 * or from the known-agent catalog, or from a custom JSON config blob.
 */
export interface ACPAgentDescriptor {
	/** Shell command used to spawn the agent. */
	agentCommand: string;
	/** Human-readable label shown in the dropdown. */
	agentDisplayName: string;
	/** Origin of this descriptor. */
	source: "workspace" | "known" | "custom";
	/** For known agents: the catalog ID (e.g. "gemini", "opencode"). */
	knownAgentId?: string;
}

/**
 * KnownAgentStatus - Per-agent status payload sent from the extension
 * in response to `hooks/acp-known-agents-request`.
 */
export interface KnownAgentStatus {
	/** Catalog ID (e.g. "gemini", "opencode"). */
	id: string;
	/** Human-readable name. */
	displayName: string;
	/** Shell command to spawn this agent. */
	agentCommand: string;
	/** Whether the user has enabled this agent in their preferences. */
	enabled: boolean;
	/** Whether the agent binary/package was detected on the system. */
	isDetected: boolean;
	/** Non-null only when enabled AND detected. */
	descriptor: ACPAgentDescriptor | null;
}

/**
 * ACPActionParams - Parameters for ACP Agent hook actions.
 * Executes a local ACP-compatible agent as a subprocess via stdio/JSON-RPC.
 */
export interface ACPActionParams {
	mode: ACPExecutionMode;
	/** The subprocess command that starts the ACP agent. */
	agentCommand: string;
	/** Human-readable label shown in hook list and logs. */
	agentDisplayName?: string;
	/** Task instruction sent to the agent. Supports $variable template substitution. */
	taskInstruction: string;
	/** Working directory for the subprocess. Defaults to workspace root. */
	cwd?: string;
}

export type ActionParameters =
	| AgentActionParams
	| GitActionParams
	| GitHubActionParams
	| CustomActionParams
	| MCPActionParams
	| ACPActionParams;

export interface ActionConfig {
	type: ActionType;
	parameters: ActionParameters;
}

export interface Hook {
	id: string;
	name: string;
	enabled: boolean;
	trigger: TriggerCondition;
	action: ActionConfig;
	createdAt: number;
	modifiedAt: number;
	lastExecutedAt?: number;
	executionCount: number;
}

export type HookExecutionStatusState = "executing" | "completed" | "failed";

export interface HookExecutionStatusPayload {
	hookId: string;
	status: HookExecutionStatusState;
	errorMessage?: string;
}

export interface HookExecutionStatusEntry extends HookExecutionStatusPayload {
	updatedAt: number;
}

export type ExecutionStatus = "success" | "failure" | "skipped" | "timeout";

export interface HookExecutionLog {
	id: string;
	hookId: string;
	executionId: string;
	chainDepth: number;
	triggeredAt: number;
	completedAt?: number;
	duration?: number;
	status: ExecutionStatus;
	error?: {
		code?: string;
		message: string;
	};
	contextSnapshot: Record<string, unknown>;
}

/**
 * UI-only: A single MCP tool option within a provider group, enriched with
 * selection state for rendering in MCPToolsSelector.
 */
export interface MCPToolOption {
	/** Tool identifier (matches MCPTool.name) */
	toolName: string;
	/** Human-readable tool name */
	toolDisplayName: string;
	/** Tool description */
	description: string;
	/** Whether this tool is currently selected */
	isSelected: boolean;
}

/**
 * UI-only: A group of MCP tools belonging to the same provider/server.
 * Produced by groupToolsByProvider() for consumption by MCPToolsSelector.
 */
export interface MCPProviderGroup {
	/** Server identifier */
	serverId: string;
	/** Server display name (used as group label) */
	serverName: string;
	/** Tools in this group, sorted alphabetically by toolDisplayName */
	tools: MCPToolOption[];
	/** True when this group collects orphaned selected tools from unknown servers */
	isOther?: boolean;
}

/**
 * Serialisable info about a single language model returned by ModelCacheService.
 * Mirrors the backend LanguageModelInfoPayload shape.
 */
export interface LanguageModelInfoPayload {
	id: string;
	name: string;
	family: string;
	maxInputTokens: number;
}

// Extension -> Webview messages
export type HooksExtensionMessage =
	| {
			type: "hooks/sync";
			command?: "hooks.sync";
			payload: { hooks: Hook[] };
	  }
	| {
			type: "hooks/created";
			command?: "hooks.created";
			payload: { hook: Hook };
	  }
	| {
			type: "hooks/updated";
			command?: "hooks.updated";
			payload: { hook: Hook };
	  }
	| {
			type: "hooks/deleted";
			command?: "hooks.deleted";
			payload: { id: string };
	  }
	| {
			type: "hooks/error";
			command?: "hooks.error";
			payload: {
				message: string;
				validationErrors?: Array<{ field: string; message: string }>;
			};
	  }
	| {
			type: "hooks/execution-status";
			command?: "hooks.execution-status";
			payload: HookExecutionStatusPayload;
	  }
	| {
			type: "hooks/logs";
			command?: "hooks.logs";
			payload: { logs: HookExecutionLog[] };
	  }
	| {
			type: "hooks/show-form";
			command?: "hooks.show-form";
			payload?: { mode?: "create" | "edit"; hook?: Hook };
	  }
	| {
			type: "hooks/show-logs";
			command?: "hooks.show-logs";
			payload: { visible: boolean; hookId?: string };
	  }
	| {
			type: "hooks/models-available";
			command?: "hooks.models-available";
			models: LanguageModelInfoPayload[];
			isStale: boolean;
	  }
	| {
			type: "hooks/models-error";
			command?: "hooks.models-error";
			message: string;
	  }
	| {
			type: "hooks/acp-agents-available";
			command?: "hooks.acp-agents-available";
			agents: ACPAgentDescriptor[];
	  }
	| {
			type: "hooks/acp-known-agents-status";
			command?: "hooks.acp-known-agents-status";
			agents: KnownAgentStatus[];
	  };

// Webview -> Extension messages
export type HooksWebviewMessage =
	| { type: "hooks/ready"; command?: "hooks.ready" }
	| { type: "hooks/list"; command?: "hooks.list" }
	| {
			type: "hooks/create";
			command?: "hooks.create";
			payload: Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount">;
	  }
	| {
			type: "hooks/update";
			command?: "hooks.update";
			payload: { id: string; updates: Partial<Hook> };
	  }
	| { type: "hooks/delete"; command?: "hooks.delete"; payload: { id: string } }
	| {
			type: "hooks/toggle";
			command?: "hooks.toggle";
			payload: { id: string; enabled: boolean };
	  }
	| {
			type: "hooks/logs";
			command?: "hooks.logs";
			payload?: { hookId?: string };
	  }
	| {
			type: "hooks/models-request";
			command?: "hooks.models-request";
			payload?: { forceRefresh?: boolean };
	  }
	| {
			type: "hooks/acp-agents-request";
			command?: "hooks.acp-agents-request";
	  }
	| {
			type: "hooks/acp-known-agents-request";
			command?: "hooks.acp-known-agents-request";
	  }
	| {
			type: "hooks/acp-known-agents-toggle";
			command?: "hooks.acp-known-agents-toggle";
			agentId: string;
			enabled: boolean;
	  };
