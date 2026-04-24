/**
 * ChatMessageItem — renders a single transcript entry.
 *
 * Dispatches by role to distinct visual variants so the transcript stays
 * scannable (user / agent / system / tool / error). Keeps markup minimal —
 * richer styling lives in `app.css` via the existing VS Code theme tokens.
 */

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
					<div className="agent-chat-message__content">{message.content}</div>
					<DeliveryBadge
						rejectionReason={message.rejectionReason}
						status={message.deliveryStatus}
					/>
				</div>
			);
		case "agent":
			return (
				<div className="agent-chat-message agent-chat-message--agent">
					<div className="agent-chat-message__content">{message.content}</div>
				</div>
			);
		case "system":
			return (
				<div
					className="agent-chat-message agent-chat-message--system"
					data-system-kind={message.kind}
				>
					<div className="agent-chat-message__content">{message.content}</div>
				</div>
			);
		case "tool":
			return (
				<div
					className="agent-chat-message agent-chat-message--tool"
					data-tool-call-id={message.toolCallId}
				>
					<div className="agent-chat-message__title">
						{message.title ?? message.toolCallId}
					</div>
					<div className="agent-chat-message__status">{message.status}</div>
				</div>
			);
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
