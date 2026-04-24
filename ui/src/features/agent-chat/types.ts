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

export type ResolvedCapabilities =
	| {
			source: "agent";
			modes: ModeDescriptor[];
			models: ModelDescriptor[];
			acceptsFollowUp: boolean;
	  }
	| {
			source: "catalog";
			modes: ModeDescriptor[];
			models: ModelDescriptor[];
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

export interface ToolCallChatMessage extends ChatMessageBase {
	role: "tool";
	toolCallId: string;
	title?: string;
	status: ToolCallStatus;
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
	| SystemChatMessage
	| ToolCallChatMessage
	| ErrorChatMessage;

// ============================================================================
// Session projection (extension -> webview)
// ============================================================================

export interface AgentChatSessionView {
	id: string;
	source: "acp" | "cloud";
	agentDisplayName: string;
	selectedModeId?: string;
	selectedModelId?: string;
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
