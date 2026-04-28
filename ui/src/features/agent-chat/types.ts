/**
 * Agent Chat Panel webview types.
 *
 * This file mirrors the subset of `src/features/agent-chat/types.ts` that
 * crosses the postMessage bridge, plus a few webview-only projection types
 * from `contracts/agent-chat-panel-protocol.md` §3.1.
 *
 * Keep these shapes in lock-step with the extension-side declarations. When
 * the extension-side file changes, update this file in the same commit.
 *
 * Webview modules MUST NOT import anything from `src/` — this mirror is the
 * entire contract surface.
 */

// ============================================================================
// Session lifecycle
// ============================================================================

export type SessionLifecycleState =
	| "initializing"
	| "running"
	| "waiting-for-input"
	| "completed"
	| "failed"
	| "cancelled"
	| "ended-by-shutdown";

export const TERMINAL_STATES: ReadonlySet<SessionLifecycleState> =
	new Set<SessionLifecycleState>([
		"completed",
		"failed",
		"cancelled",
		"ended-by-shutdown",
	]);

// ============================================================================
// Capabilities
// ============================================================================

export interface ModeDescriptor {
	id: string;
	displayName: string;
	promptPrefix?: string;
}

export interface ModelDescriptor {
	id: string;
	displayName: string;
	invocation: "initial-prompt" | "cli-flag";
	invocationTemplate?: string;
}

/**
 * Reasoning / thinking effort surfaced by the agent (e.g. "low",
 * "medium", "high"). Mirrors `ThinkingLevelDescriptor` on the
 * extension side; chips stay hidden when the array is empty.
 */
export interface ThinkingLevelDescriptor {
	id: string;
	displayName: string;
	description?: string;
}

/**
 * High-level agent role / type (e.g. "Agent", "Plan", "Ask"). Mirrors
 * `AgentRoleDescriptor` on the extension side; chips stay hidden when
 * the array is empty.
 */
export interface AgentRoleDescriptor {
	id: string;
	displayName: string;
	description?: string;
}

export type ResolvedCapabilities =
	| {
			source: "agent";
			modes: ModeDescriptor[];
			models: ModelDescriptor[];
			thinkingLevels?: ThinkingLevelDescriptor[];
			agentRoles?: AgentRoleDescriptor[];
			acceptsFollowUp: boolean;
	  }
	| {
			source: "catalog";
			modes: ModeDescriptor[];
			models: ModelDescriptor[];
			thinkingLevels?: ThinkingLevelDescriptor[];
			agentRoles?: AgentRoleDescriptor[];
			acceptsFollowUp: boolean;
	  }
	| { source: "none" };

// ============================================================================
// Execution target
// ============================================================================

export type ExecutionTarget =
	| { kind: "local" }
	| { kind: "worktree"; worktreeId: string }
	| { kind: "cloud"; providerId: string; cloudSessionId: string };

export interface ExecutionTargetView {
	kind: "local" | "worktree" | "cloud";
	label: string;
}

export interface ExecutionTargetOption {
	kind: "local" | "worktree" | "cloud";
	label: string;
	enabled: boolean;
	/** Present when `enabled === false`; explains why. */
	disabledReason?: string;
}

// ============================================================================
// Chat messages
// ============================================================================

export interface ChatMessageBase {
	id: string;
	sessionId: string;
	timestamp: number;
	sequence: number;
	contextAtTurn?: {
		modeId?: string;
		modelId?: string;
		executionTarget: ExecutionTarget;
	};
}

export type UserMessageDeliveryStatus =
	| "pending"
	| "queued"
	| "delivered"
	| "rejected";

export interface UserChatMessage extends ChatMessageBase {
	role: "user";
	content: string;
	isInitialPrompt: boolean;
	deliveryStatus: UserMessageDeliveryStatus;
	rejectionReason?: string;
}

export interface AgentChatMessage extends ChatMessageBase {
	role: "agent";
	content: string;
	turnId: string;
	isTurnComplete: boolean;
	stopReason?: string;
}

/**
 * Streaming chain-of-thought / reasoning emitted via the ACP
 * `agent_thought_chunk` notification. Renders as a collapsible muted
 * block above the agent's user-facing message so the user can see *why*
 * the agent decided to do what it did.
 */
export interface ThoughtChatMessage extends ChatMessageBase {
	role: "thought";
	content: string;
	turnId: string;
	isTurnComplete: boolean;
}

/** Single entry in an ACP `plan` update. */
export interface PlanEntry {
	content: string;
	priority?: "low" | "medium" | "high";
	status: "pending" | "in_progress" | "completed";
}

/**
 * Plan snapshot from the agent. Replaces the previous entries list
 * each time it arrives — the runner overwrites the same message
 * instead of appending a new one.
 */
export interface PlanChatMessage extends ChatMessageBase {
	role: "plan";
	turnId: string;
	entries: readonly PlanEntry[];
}

export type SystemChatMessageKind =
	| "session-started"
	| "mode-changed"
	| "model-changed"
	| "target-changed"
	| "worktree-created"
	| "worktree-cleaned"
	| "read-only-notice"
	| "ended-by-shutdown"
	| "restored-from-persistence";

export interface SystemChatMessage extends ChatMessageBase {
	role: "system";
	kind: SystemChatMessageKind;
	content: string;
}

export type ToolCallStatus =
	| "pending"
	| "running"
	| "succeeded"
	| "failed"
	| "cancelled";

/**
 * Per-tool-call projection of a file the agent is reading or modifying.
 * Mirrors `ToolCallAffectedFile` from the extension types — kept in
 * lockstep so the bridge can serialise the message verbatim.
 */
export interface ToolCallAffectedFile {
	path: string;
	linesAdded: number;
	linesRemoved: number;
	languageId?: string;
}

/**
 * Summary of a file write the agent has queued via `writeTextFile` and
 * is awaiting accept/reject from the user. Surfaced through the
 * `agent-chat/pending-writes/changed` event when the
 * `gatomia.agentChat.bufferFileWrites` flag is on.
 */
export interface PendingFileWriteSummary {
	id: string;
	path: string;
	linesAdded: number;
	linesRemoved: number;
	languageId?: string;
}

export interface ToolCallChatMessage extends ChatMessageBase {
	role: "tool";
	toolCallId: string;
	title?: string;
	status: ToolCallStatus;
	/** ACP `ToolKind` (read/edit/execute/...) when the agent reports it. */
	toolKind?: string;
	/**
	 * Files referenced by this tool call. The webview renders a
	 * `ToolCallCard` when this is non-empty; otherwise it falls back to
	 * a plain title row.
	 */
	affectedFiles?: readonly ToolCallAffectedFile[];
}

export type ErrorChatMessageCategory =
	| "acp-handshake"
	| "acp-empty-response"
	| "acp-timeout"
	| "acp-spawn-failed"
	| "worktree-create-failed"
	| "worktree-cleanup-failed"
	| "cloud-dispatch-failed"
	| "cloud-disconnected"
	| "unknown";

export interface ErrorChatMessage extends ChatMessageBase {
	role: "error";
	content: string;
	category: ErrorChatMessageCategory;
	retryable: boolean;
}

export type ChatMessage =
	| UserChatMessage
	| AgentChatMessage
	| ThoughtChatMessage
	| PlanChatMessage
	| SystemChatMessage
	| ToolCallChatMessage
	| ErrorChatMessage;

// ============================================================================
// Session projection (extension -> webview)
// ============================================================================

export interface AgentChatSessionView {
	id: string;
	source: "acp" | "cloud";
	/**
	 * Provider id of the underlying agent. For ACP sessions this is the
	 * `AcpProviderDescriptor.id` (e.g. `"github-copilot"`); for cloud
	 * sessions it mirrors the `cloud.providerId`. Used by the webview
	 * to dispatch `probe-models` against the correct provider when the
	 * user clicks the refresh button on the model chip.
	 */
	agentId: string;
	agentDisplayName: string;
	selectedModeId?: string;
	selectedModelId?: string;
	/**
	 * Models the agent surfaced for this specific session via the ACP
	 * `NewSessionResponse.models.availableModels` payload (or any
	 * subsequent `setSessionModel` round-trip). The webview renders the
	 * dynamic model chip from this list and falls back to the catalog
	 * entry only when the array is empty/undefined.
	 */
	availableModels?: ModelDescriptor[];
	/**
	 * Mirrors `selectedModelId` for sessions whose agent reported the
	 * value over the wire. Kept as a separate field so the chip can
	 * tell the difference between "user chose this in the composer"
	 * and "agent confirmed this via session/set_model".
	 */
	currentModelId?: string;
	/**
	 * Thinking level the user picked for this session (id, e.g. "high").
	 * Undefined when the agent does not expose a thinking-level knob.
	 */
	selectedThinkingLevelId?: string;
	/** Same, for the agent role / agent type chip. */
	selectedAgentRoleId?: string;
	/**
	 * Thinking levels available for this session — empty/undefined hides
	 * the chip. Sourced from `capabilities.thinkingLevels`.
	 */
	availableThinkingLevels?: ThinkingLevelDescriptor[];
	availableAgentRoles?: AgentRoleDescriptor[];
	executionTarget: ExecutionTargetView;
	lifecycleState: SessionLifecycleState;
	acceptsFollowUp: boolean;
	/** True for cloud sessions (FR-003). */
	isReadOnly: boolean;
	worktree?: {
		path: string;
		branch: string;
		status: "created" | "in-use" | "abandoned" | "cleaned";
	};
	cloud?: {
		providerId: string;
		providerDisplayName: string;
		externalUrl?: string;
	};
}

// ============================================================================
// Sidebar catalog + session list (sidebar-only postMessage payloads)
// ============================================================================

export type ProviderAvailability =
	| "installed"
	| "available-via-npx"
	| "install-required";

export interface AgentChatProviderOption {
	id: string;
	displayName: string;
	description?: string;
	availability: ProviderAvailability;
	enabled: boolean;
	source: "built-in" | "local" | "remote";
	npxPackage?: string;
	installUrl?: string;
	models: ModelDescriptor[];
	/**
	 * Static catalogue of thinking levels — empty array hides the chip
	 * on the empty-state composer. The on-session InputBar mirrors the
	 * value via `AgentChatSessionView.availableThinkingLevels`.
	 */
	thinkingLevels: ThinkingLevelDescriptor[];
	/** Static catalogue of agent roles — same hide-when-empty contract. */
	agentRoles: AgentRoleDescriptor[];
}

export interface AgentChatAgentFileOption {
	id: string;
	displayName: string;
	description?: string;
	source: "file" | "extension";
	absolutePath?: string;
}

export interface AgentChatCatalog {
	providers: AgentChatProviderOption[];
	agentFiles: AgentChatAgentFileOption[];
}

export interface SidebarSessionListItem {
	id: string;
	agentDisplayName: string;
	lifecycleState: SessionLifecycleState;
	updatedAt: number;
	selectedModeId?: string;
	selectedModelId?: string;
	isTerminal: boolean;
	/**
	 * Short human-readable label derived from the session's first user
	 * prompt. Webview falls back to `agentDisplayName` when omitted.
	 */
	title?: string;
}

/**
 * Mirrors the `gatomia.acp.permissionDefault` enum exposed by the host
 * extension. Drives both the segmented control on the empty-state
 * composer and the persistent chip on the active-session toolbar.
 */
export type PermissionDefaultMode = "ask" | "allow" | "deny";

/**
 * Composer payload sent when the user submits the empty-state composer to
 * spawn a fresh session. The host translates this into
 * `gatomia.agentChat.startNew`.
 */
export interface NewSessionRequest {
	providerId: string;
	modelId?: string;
	agentFileId?: string;
	/** Optional thinking-level pick (e.g. "high") propagated to the agent. */
	thinkingLevelId?: string;
	/** Optional agent-role pick (e.g. "agent" / "plan"). */
	agentRoleId?: string;
	taskInstruction: string;
}
