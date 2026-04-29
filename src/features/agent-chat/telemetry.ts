/**
 * Agent Chat Panel telemetry events.
 *
 * Follows the project-wide `logTelemetry(event, properties)` pattern used in
 * `src/features/hooks/actions/acp-action.ts:163-168` and
 * `src/features/devin/telemetry.ts:53-58`.
 *
 * Event names match `plan.md` Constitution row IV. Adding a new event requires
 * declaring it in this file AND updating the plan's enumeration.
 *
 * @see specs/018-agent-chat-panel/plan.md Constitution check row IV
 */

export const AGENT_CHAT_TELEMETRY_EVENTS = {
	// Session lifecycle
	SESSION_STARTED: "agent-chat.session.started",
	SESSION_STREAMED: "agent-chat.session.streamed",
	SESSION_FOLLOW_UP_SENT: "agent-chat.session.follow-up-sent",
	SESSION_CANCELLED: "agent-chat.session.cancelled",
	SESSION_ENDED_BY_SHUTDOWN: "agent-chat.session.ended-by-shutdown",

	// Worktree lifecycle
	WORKTREE_CREATED: "agent-chat.worktree.created",
	WORKTREE_FAILED: "agent-chat.worktree.failed",
	WORKTREE_CLEANED: "agent-chat.worktree.cleaned",
	WORKTREE_ABANDONED: "agent-chat.worktree.abandoned",

	// Capability resolution
	CAPABILITIES_RESOLVED: "agent-chat.capabilities.resolved",

	// Panel lifecycle
	PANEL_OPENED: "agent-chat.panel.opened",
	PANEL_REOPENED: "agent-chat.panel.reopened",

	// Errors
	ERROR: "agent-chat.error",

	// Concurrency
	CONCURRENT_CAP_HIT: "agent-chat.concurrent-cap.hit",
} as const;

export type AgentChatTelemetryEventName =
	(typeof AGENT_CHAT_TELEMETRY_EVENTS)[keyof typeof AGENT_CHAT_TELEMETRY_EVENTS];

/**
 * Log a telemetry event. Currently writes to console for debugging; can be
 * routed to a real telemetry service in a later phase without touching
 * callers.
 *
 * Signature intentionally matches the project-wide pattern to keep callers
 * portable across feature modules.
 */
export function logTelemetry(
	event: AgentChatTelemetryEventName | string,
	properties: Record<string, string | number | boolean>
): void {
	// Mirror the existing devin/telemetry.ts and acp-action.ts call pattern.
	console.log(`[agent-chat] ${event}`, JSON.stringify(properties));
}
