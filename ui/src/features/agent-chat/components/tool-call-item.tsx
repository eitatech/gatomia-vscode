/**
 * ToolCallItem — renders a tool-call transcript entry with distinct styling
 * so users can scan tool usage independently of chat text.
 */

import type { ToolCallChatMessage } from "@/features/agent-chat/types";

interface ToolCallItemProps {
	readonly message: ToolCallChatMessage;
}

const MAX_TITLE_LENGTH = 120;

export function ToolCallItem({ message }: ToolCallItemProps): JSX.Element {
	const title = truncate(message.title ?? message.toolCallId, MAX_TITLE_LENGTH);
	return (
		<div
			className={`agent-chat-tool-call agent-chat-tool-call--${message.status}`}
			data-tool-call-id={message.toolCallId}
		>
			<div
				className="agent-chat-tool-call__title"
				data-testid="tool-call-title"
			>
				{title}
			</div>
			<div className="agent-chat-tool-call__status">{message.status}</div>
		</div>
	);
}

function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}
