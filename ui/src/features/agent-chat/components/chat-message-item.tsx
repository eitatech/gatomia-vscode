/**
 * ChatMessageItem — renders a single transcript entry.
 *
 * Dispatches by role to distinct visual variants so the transcript stays
 * scannable (user / agent / system / tool / error). Layout follows the
 * Cursor-style mockup: user messages right-aligned with a soft pill,
 * agent messages flat-left with a leading avatar dot, tool calls render
 * as compact cards (delegated to `ToolCallCard` from Phase 3 onward —
 * this Phase 2 step keeps the simpler "title · status" line as a
 * fallback so the redesign can ship before the diff-card work lands).
 *
 * All styling lives in `app.css` and uses VS Code theme tokens so the
 * webview adapts to light/dark/high-contrast without recompiling.
 */

import { ToolCallCard } from "@/features/agent-chat/components/tool-call-card";
import type { ChatMessage } from "@/features/agent-chat/types";

interface ChatMessageItemProps {
	readonly message: ChatMessage;
}

export function ChatMessageItem({
	message,
}: ChatMessageItemProps): JSX.Element {
	switch (message.role) {
		case "user":
			return (
				<div className="agent-chat-message agent-chat-message--user">
					<div className="agent-chat-message__bubble">
						<div className="agent-chat-message__content">{message.content}</div>
					</div>
					<DeliveryBadge
						rejectionReason={message.rejectionReason}
						status={message.deliveryStatus}
					/>
				</div>
			);
		case "agent":
			return (
				<div className="agent-chat-message agent-chat-message--agent">
					<div
						aria-hidden="true"
						className="agent-chat-message__avatar"
						data-testid="agent-avatar"
					/>
					<div className="agent-chat-message__content">{message.content}</div>
				</div>
			);
		case "thought":
			// Chain-of-thought block — surfaced verbatim so the user can
			// see WHY the agent decided to call the next tool / write a
			// file. Rendered as a muted `<details>` that auto-expands
			// while streaming and stays collapsible after the turn ends.
			return (
				<div
					className="agent-chat-message agent-chat-message--thought"
					data-thought-complete={message.isTurnComplete ? "true" : "false"}
					data-turn-id={message.turnId}
				>
					<details
						className="agent-chat-message__thought"
						open={!message.isTurnComplete}
					>
						<summary className="agent-chat-message__thought-summary">
							<i aria-hidden="true" className="codicon codicon-lightbulb" />
							<span>{message.isTurnComplete ? "Thoughts" : "Thinking…"}</span>
						</summary>
						<div className="agent-chat-message__thought-content">
							{message.content}
						</div>
					</details>
				</div>
			);
		case "plan": {
			// Idempotent task list the agent is working through. We
			// render it as a checkbox-style summary so progress is
			// scannable. Status drives the icon (pending / running /
			// done) and the strikethrough on the text.
			const total = message.entries.length;
			const done = message.entries.filter(
				(e) => e.status === "completed"
			).length;
			return (
				<div
					className="agent-chat-message agent-chat-message--plan"
					data-turn-id={message.turnId}
				>
					<div className="agent-chat-message__plan-header">
						<i aria-hidden="true" className="codicon codicon-checklist" />
						<span>
							Plan ({done}/{total})
						</span>
					</div>
					<ul className="agent-chat-message__plan-list">
						{message.entries.map((entry, idx) => (
							<li
								className={`agent-chat-message__plan-item agent-chat-message__plan-item--${entry.status}`}
								key={`${message.id}-${idx}`}
							>
								<i
									aria-hidden="true"
									className={`codicon ${planIconClass(entry.status)}`}
								/>
								<span className="agent-chat-message__plan-text">
									{entry.content}
								</span>
								{entry.priority ? (
									<span
										className={`agent-chat-message__plan-priority agent-chat-message__plan-priority--${entry.priority}`}
									>
										{entry.priority}
									</span>
								) : null}
							</li>
						))}
					</ul>
				</div>
			);
		}
		case "system":
			return (
				<div
					className="agent-chat-message agent-chat-message--system"
					data-system-kind={message.kind}
				>
					<div className="agent-chat-message__content">{message.content}</div>
				</div>
			);
		case "tool": {
			// Phase 3: when the agent reported any affected files we
			// render the Cursor-style diff card instead of the plain
			// title row. Tools that do not touch files (e.g. `kind:
			// execute`) keep the legacy compact line so the transcript
			// still surfaces them.
			const files = message.affectedFiles ?? [];
			if (files.length > 0) {
				return (
					<div
						className="agent-chat-message agent-chat-message--tool agent-chat-message--tool-card"
						data-tool-call-id={message.toolCallId}
					>
						<ToolCallCard
							affectedFiles={files}
							status={message.status}
							title={message.title}
							toolCallId={message.toolCallId}
						/>
					</div>
				);
			}
			return (
				<div
					className="agent-chat-message agent-chat-message--tool"
					data-tool-call-id={message.toolCallId}
				>
					<div className="agent-chat-message__tool-title">
						<span
							aria-hidden="true"
							className={`agent-chat-message__tool-dot agent-chat-message__tool-dot--${message.status}`}
						/>
						<span className="agent-chat-message__tool-text">
							{message.title ?? message.toolCallId}
						</span>
					</div>
					<div
						className={`agent-chat-message__status agent-chat-message__status--${message.status}`}
					>
						{message.status}
					</div>
				</div>
			);
		}
		case "error":
			return (
				<div
					className="agent-chat-message agent-chat-message--error"
					data-category={message.category}
				>
					<div className="agent-chat-message__content">{message.content}</div>
				</div>
			);
		default:
			return <div />;
	}
}

interface DeliveryBadgeProps {
	readonly status: "pending" | "queued" | "delivered" | "rejected";
	readonly rejectionReason?: string;
}

function DeliveryBadge({
	status,
	rejectionReason,
}: DeliveryBadgeProps): JSX.Element | null {
	if (status === "delivered") {
		return null;
	}
	return (
		<div
			className={`agent-chat-message__badge agent-chat-message__badge--${status}`}
		>
			<span>{status}</span>
			{status === "rejected" && rejectionReason ? (
				<span className="agent-chat-message__badge-reason">
					{" "}
					— {rejectionReason}
				</span>
			) : null}
		</div>
	);
}

/**
 * Map a `PlanEntry.status` to the codicon class that visually
 * represents that state. Used by the plan-list renderer above so
 * pending / running / completed items each get their own glyph and the
 * progress is scannable at a glance.
 */
function planIconClass(
	status: "pending" | "in_progress" | "completed"
): string {
	switch (status) {
		case "completed":
			return "codicon-pass-filled";
		case "in_progress":
			return "codicon-loading codicon-modifier-spin";
		default:
			return "codicon-circle-large-outline";
	}
}
