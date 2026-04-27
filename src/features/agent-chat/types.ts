/**
 * Agent Chat Panel shared types.
 *
 * @see specs/018-agent-chat-panel/data-model.md (source of truth)
 * @see specs/018-agent-chat-panel/contracts/ for the panel protocol, capabilities,
 *      session-storage, and worktree-lifecycle contracts.
 *
 * This module is the single authoritative declaration for every entity persisted
 * by `AgentChatSessionStore` or shipped across the webview bridge. The
 * webview-side module `ui/src/features/agent-chat/types.ts` MUST mirror the
 * subset that crosses the postMessage boundary.
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

/**
 * Lifecycle states that are absorbing — once entered, no further transitions
 * are permitted. A new run of "the same" task is a new session with a new id.
 *
 * @see data-model.md §2
 */
export const TERMINAL_STATES: ReadonlySet<SessionLifecycleState> =
	new Set<SessionLifecycleState>([
		"completed",
		"failed",
		"cancelled",
		"ended-by-shutdown",
	]);

export function isTerminalState(state: SessionLifecycleState): boolean {
	return TERMINAL_STATES.has(state);
}

// ============================================================================
// Capabilities (hybrid discovery)
// ============================================================================

export interface ModeDescriptor {
	/** Machine id (e.g. "code", "ask", "plan"). */
	id: string;
	/** UI label (e.g. "Code"). */
	displayName: string;
	/**
	 * Prefix prepended to each turn's first message to steer the agent.
	 * Research R1: used when the agent does not support a native mode switch.
	 */
	promptPrefix?: string;
}

export interface ModelDescriptor {
	id: string;
	displayName: string;
	/** How the model is communicated to the agent at session start. */
	invocation: "initial-prompt" | "cli-flag";
	/** Optional template (e.g. "--model {id}" for cli-flag). */
	invocationTemplate?: string;
}

/**
 * Reasoning / thinking effort level surfaced by the agent.
 *
 * Distinct from {@link ModeDescriptor} (which is the high-level
 * conversational mode like "Agent / Plan / Ask") and from
 * {@link ModelDescriptor} (which selects the underlying LLM). Examples:
 *
 *   - GPT-5 / Codex: `low`, `medium`, `high`
 *   - Claude Extended Thinking: `off`, `on` (or budget tiers)
 *   - Qwen Thinking: `disabled`, `enabled`
 *
 * Optional per provider; agents that do not expose a knob omit the
 * `thinkingLevels` array entirely so the chip is hidden.
 */
export interface ThinkingLevelDescriptor {
	id: string;
	displayName: string;
	description?: string;
}

/**
 * High-level conversational role / agent type the user can pick before
 * a turn (e.g. Cursor's "Agent / Ask / Edit", Windsurf's "Cascade Auto
 * vs Cascade Plan"). Persisted alongside the session selection so each
 * turn can carry the user's intent.
 */
export interface AgentRoleDescriptor {
	id: string;
	displayName: string;
	description?: string;
}

/**
 * Result of the hybrid capability discovery resolver.
 *
 * Discriminated by `source`:
 *   - "agent"   — agent reported capabilities via ACP `initialize` (authoritative).
 *   - "catalog" — agent silent; gatomia-maintained catalog supplied the values.
 *   - "none"    — neither source has values; selectors MUST be hidden.
 *
 * `thinkingLevels` and `agentRoles` are optional even on `"agent"` /
 * `"catalog"` results because not every provider exposes them — the
 * picker MUST hide the corresponding chip when the array is undefined
 * or empty.
 *
 * @see contracts/agent-capabilities-contract.md
 */
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

// ============================================================================
// Worktree handle
// ============================================================================

export type WorktreeStatus = "created" | "in-use" | "abandoned" | "cleaned";

export interface WorktreeHandle {
	/**
	 * UUIDv4. Not necessarily equal to `sessionId`; v1 is 1:1 but the handle
	 * exists as a separate entity so future specs can reuse worktrees across
	 * sessions without a schema migration.
	 */
	id: string;
	/** Absolute path, e.g. `<repoRoot>/.gatomia/worktrees/<session-id>/`. */
	absolutePath: string;
	/** Branch name, e.g. `gatomia/agent-chat/<session-id>`. */
	branchName: string;
	/** SHA of the commit the branch was created from. */
	baseCommitSha: string;
	/** Lifecycle of the worktree itself (independent of the session). */
	status: WorktreeStatus;
	createdAt: number;
	cleanedAt?: number;
}

// ============================================================================
// Cloud linkage (spec 016 bridge)
// ============================================================================

export interface CloudLinkage {
	/** Provider id from spec 016 registry (e.g. "devin", "github-copilot-coding-agent"). */
	providerId: string;
	/** spec 016 `AgentSession.localId`. */
	cloudSessionLocalId: string;
	/** Provider-external URL (Devin session URL, GitHub issue URL). */
	externalUrl?: string;
}

// ============================================================================
// Session trigger
// ============================================================================

export type SessionTrigger =
	| { kind: "user" }
	| { kind: "hook"; hookId: string; executionId: string }
	| { kind: "command"; commandId: string }
	| { kind: "spec-task"; specId: string; taskId: string }
	| { kind: "restore-from-persistence" };

// ============================================================================
// Chat messages (transcript entries)
// ============================================================================

export interface ChatMessageBase {
	/** UUIDv4 unique within this session's transcript. */
	id: string;
	sessionId: string;
	/** Unix ms. */
	timestamp: number;
	/** Monotonic sequence number within the session (append order), starting at 0. */
	sequence: number;
	/** Snapshot of the mode/model in effect when this message was produced. */
	contextAtTurn?: {
		modeId?: string;
		modelId?: string;
		executionTarget: ExecutionTarget;
	};
}

/**
 * Delivery lifecycle for user follow-up messages. Initial-prompt messages are
 * always "delivered" at creation time.
 *
 * Transitions (follow-ups):
 *   "pending"   → webview submitted; extension has not yet routed it
 *   "queued"    → extension accepted it but the agent is mid-turn
 *   "delivered" → extension forwarded it to the agent (e.g. `AcpClient.sendPrompt`)
 *   "rejected"  → extension refused it (read-only session, no follow-ups,
 *                 terminal state, or cloud session); `rejectionReason` set
 *
 * Terminal statuses: "delivered", "rejected" (no further transitions).
 *
 * @see contracts/agent-chat-panel-protocol.md §4.2
 */
export type UserMessageDeliveryStatus =
	| "pending"
	| "queued"
	| "delivered"
	| "rejected";

export interface UserChatMessage extends ChatMessageBase {
	role: "user";
	content: string;
	/** True if this was the first prompt; false for follow-ups. */
	isInitialPrompt: boolean;
	deliveryStatus: UserMessageDeliveryStatus;
	/** Required when `deliveryStatus === "rejected"`; absent otherwise. */
	rejectionReason?: string;
}

export interface AgentChatMessage extends ChatMessageBase {
	role: "agent";
	/** Plain text content, possibly markdown. Streamed chunk-by-chunk; stored coalesced per turn. */
	content: string;
	/** Stable id of the agent turn this message belongs to (one turn = one assistant response). */
	turnId: string;
	/** True when the turn finished; false if this is an interim snapshot. */
	isTurnComplete: boolean;
	/** Populated when `isTurnComplete === true`. */
	stopReason?: string;
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
 * Per-tool-call projection of a file the agent is reading or
 * modifying. Populated from the ACP `Diff` payloads on `tool_call` /
 * `tool_call_update` notifications; the webview uses it to render the
 * Cursor-style `arquivo.ts +N -M` cards (Phase 3 redesign).
 */
export interface ToolCallAffectedFile {
	path: string;
	linesAdded: number;
	linesRemoved: number;
	languageId?: string;
}

export interface ToolCallChatMessage extends ChatMessageBase {
	role: "tool";
	toolCallId: string;
	title?: string;
	/** Latest status reported by the agent. */
	status: ToolCallStatus;
	/** ACP `ToolKind` (read/edit/execute/...) when the agent reports it. */
	toolKind?: string;
	/**
	 * Files referenced by this tool call. Empty / undefined for tools
	 * that do not touch files (e.g. `kind: "execute"`).
	 */
	affectedFiles?: readonly ToolCallAffectedFile[];
}

/**
 * Machine-readable error categories drive retry controls (FR-020, research R9).
 */
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
	| SystemChatMessage
	| ToolCallChatMessage
	| ErrorChatMessage;

// ============================================================================
// Aggregate root
// ============================================================================

export interface AgentChatSession {
	/** UUIDv4 assigned at creation. Primary key. */
	id: string;
	source: "acp" | "cloud";
	/** Reference to the underlying agent (ACP descriptor id or Cloud provider id). */
	agentId: string;
	/** Display name snapshotted at session start so UI stays stable if the catalog changes. */
	agentDisplayName: string;
	capabilities: ResolvedCapabilities;
	/** Current mode id (undefined when no mode selector is shown). */
	selectedModeId?: string;
	/** Current model id (undefined when no model selector is shown). */
	selectedModelId?: string;
	/**
	 * Models reported by the agent for this specific session via the
	 * ACP `NewSessionResponse.models.availableModels` payload. Empty
	 * array (or undefined for legacy sessions) means the agent did not
	 * surface dynamic models — the picker falls back to the static
	 * catalogue from `agent-capabilities-catalog.ts`.
	 */
	availableModels?: ModelDescriptor[];
	/**
	 * Currently selected model as last reported by the agent (via
	 * `NewSessionResponse.models.currentModelId` or after a successful
	 * `session/set_model` round-trip). `undefined` for sessions whose
	 * agent does not implement the experimental capability.
	 */
	currentModelId?: string;
	/** User-picked thinking level (e.g. "high"). Optional per provider. */
	selectedThinkingLevelId?: string;
	/** User-picked agent role (e.g. "agent" / "plan"). Optional per provider. */
	selectedAgentRoleId?: string;
	/**
	 * Thinking levels surfaced by this provider for this session,
	 * mirroring `availableModels`. When omitted/empty, the chip stays
	 * hidden. Filled from `capabilities.thinkingLevels` at session
	 * creation and refreshed if the agent updates them mid-session.
	 */
	availableThinkingLevels?: ThinkingLevelDescriptor[];
	/** Same as above, for the agent-role picker. */
	availableAgentRoles?: AgentRoleDescriptor[];
	executionTarget: ExecutionTarget;
	lifecycleState: SessionLifecycleState;
	trigger: SessionTrigger;
	/** Present when `executionTarget.kind === "worktree"`; null otherwise. */
	worktree: WorktreeHandle | null;
	/** Present when `source === "cloud"`; null otherwise. */
	cloud: CloudLinkage | null;
	createdAt: number;
	updatedAt: number;
	endedAt?: number;
	/** VS Code workspace folder uri (for scoping). */
	workspaceUri: string;
}

// ============================================================================
// Runtime event stream (runner -> panel/store)
// ============================================================================

export type AgentChatEvent =
	| { type: "session/started"; sessionId: string; at: number }
	| {
			type: "message/user-submitted";
			sessionId: string;
			message: UserChatMessage;
	  }
	| {
			type: "message/agent-chunk";
			sessionId: string;
			turnId: string;
			textDelta: string;
			at: number;
	  }
	| {
			type: "message/agent-turn-finished";
			sessionId: string;
			turnId: string;
			stopReason: string;
			at: number;
	  }
	| {
			type: "tool/call-started";
			sessionId: string;
			toolCallId: string;
			title?: string;
			at: number;
	  }
	| {
			type: "tool/call-updated";
			sessionId: string;
			toolCallId: string;
			status: ToolCallStatus;
			at: number;
	  }
	| {
			type: "lifecycle/transitioned";
			sessionId: string;
			from: SessionLifecycleState;
			to: SessionLifecycleState;
			at: number;
	  }
	| {
			type: "error";
			sessionId: string;
			category: ErrorChatMessageCategory;
			message: string;
			retryable: boolean;
			at: number;
	  }
	| {
			type: "pending-writes/changed";
			sessionId: string;
			writes: readonly PendingWriteSummary[];
			at: number;
	  }
	| {
			type: "session/models-changed";
			sessionId: string;
			availableModels: readonly ModelDescriptor[];
			currentModelId: string;
			at: number;
	  };

/**
 * Light projection of a queued ACP `writeTextFile` call. The webview
 * receives this through the `pending-writes/changed` event and renders
 * the Cursor-style "X file +Y -Z" bar above the input. The full
 * `proposedContent` is intentionally omitted to keep the bridge
 * payload small — the webview only needs the diff stats and path to
 * render the summary.
 */
export interface PendingWriteSummary {
	id: string;
	path: string;
	linesAdded: number;
	linesRemoved: number;
	languageId?: string;
}

// ============================================================================
// Runner handle (forward-compatible; see W3 fix)
// ============================================================================

/**
 * Forward-compatible runner interface so `AgentChatRegistry` can be typed
 * during Phase 2 before the concrete `AcpChatRunner` (T027) and
 * `CloudChatAdapter` (T060) classes exist.
 *
 * Both concrete runners MUST implement the required fields (`sessionId`,
 * `cancel`, `dispose`). `submit` and `retry` are optional because cloud
 * sessions are read-only (FR-003) and reject follow-up input; ACP runners
 * populate both.
 */
export interface AgentChatRunnerHandle {
	readonly sessionId: string;
	/** Cancel the in-flight turn (if any). Idempotent. */
	cancel(): Promise<void>;
	/** Release subprocess / subscription resources. Idempotent. */
	dispose(): void;
	/**
	 * Submit a follow-up message. Absent on read-only cloud sessions.
	 * Rejects with `{ message: /queued|already/i }` when a queued follow-up
	 * already exists (contract §4.2).
	 */
	submit?(content: string): Promise<void>;
	/**
	 * Restart the session. Returns the new session id (mode/model/target
	 * preserved). Absent on cloud sessions (they reuse their external
	 * provider's dispatch path instead).
	 */
	retry?(): Promise<string>;
}

// ============================================================================
// Session manifest (persistence projection)
// ============================================================================

/**
 * Lightweight per-session metadata persisted in the manifest. Excludes the
 * full transcript (stored separately per session).
 *
 * @see contracts/agent-chat-session-storage.md §2.1
 */
export interface SessionManifestEntry {
	id: string;
	source: "acp" | "cloud";
	agentId: string;
	agentDisplayName: string;
	lifecycleState: SessionLifecycleState;
	executionTargetKind: "local" | "worktree" | "cloud";
	createdAt: number;
	updatedAt: number;
	endedAt?: number;
	/** True when older transcript messages have been moved to on-disk archive. */
	transcriptArchived: boolean;
	/** Present when `executionTargetKind === "worktree"`. */
	worktreePath?: string;
	/** Present when `source === "cloud"`. */
	cloudSessionLocalId?: string;
}

export interface SessionManifest {
	schemaVersion: 1;
	sessions: SessionManifestEntry[];
	/** Unix ms timestamp of last write. */
	updatedAt: number;
}

// ============================================================================
// Settings
// ============================================================================

export interface AgentChatSettings {
	schemaVersion: 1;
	autoOpenPanelOnNewSession: boolean;
	maxConcurrentAcpSessions: number;
}

export const DEFAULT_AGENT_CHAT_SETTINGS: AgentChatSettings = {
	schemaVersion: 1,
	autoOpenPanelOnNewSession: true,
	maxConcurrentAcpSessions: 5,
};

// ============================================================================
// Orphaned worktrees (retention eviction rescue)
// ============================================================================

export interface OrphanedWorktreeEntry {
	/** The now-evicted session that owned this worktree. */
	sessionId: string;
	absolutePath: string;
	branchName: string;
	recordedAt: number;
	/** Set when the user runs cleanup on the orphan. */
	cleanedAt?: number;
}

export interface OrphanedWorktreeList {
	schemaVersion: 1;
	orphans: OrphanedWorktreeEntry[];
}

// ============================================================================
// Storage input shapes
// ============================================================================

export interface CreateSessionInput {
	source: "acp" | "cloud";
	agentId: string;
	agentDisplayName: string;
	capabilities: ResolvedCapabilities;
	selectedModeId?: string;
	selectedModelId?: string;
	availableModels?: ModelDescriptor[];
	currentModelId?: string;
	selectedThinkingLevelId?: string;
	selectedAgentRoleId?: string;
	availableThinkingLevels?: ThinkingLevelDescriptor[];
	availableAgentRoles?: AgentRoleDescriptor[];
	executionTarget: ExecutionTarget;
	trigger: SessionTrigger;
	worktree: WorktreeHandle | null;
	cloud: CloudLinkage | null;
	/** Optional override; defaults to `Date.now()`. Useful for deterministic tests. */
	createdAt?: number;
	/** Workspace folder uri. Defaults to the first workspace folder when omitted. */
	workspaceUri?: string;
}

// ============================================================================
// workspaceState keys (single source of truth)
// ============================================================================

export const AGENT_CHAT_STORAGE_KEYS = {
	MANIFEST: "gatomia.agentChat.sessions.index",
	TRANSCRIPT_PREFIX: "gatomia.agentChat.sessions.transcript.",
	ORPHANED_WORKTREES: "gatomia.agentChat.worktreesOrphaned",
	SETTINGS: "gatomia.agentChat.settings",
} as const;

/** Build the transcript key for a given session id. */
export function transcriptKeyFor(sessionId: string): string {
	return `${AGENT_CHAT_STORAGE_KEYS.TRANSCRIPT_PREFIX}${sessionId}`;
}
