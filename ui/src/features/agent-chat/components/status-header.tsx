/**
 * StatusHeader — compact banner showing agent name + lifecycle badge.
 */

import type { SessionLifecycleState } from "@/features/agent-chat/types";

interface StatusHeaderProps {
	readonly agentDisplayName: string;
	readonly lifecycleState: SessionLifecycleState;
}

const LIFECYCLE_LABEL: Record<SessionLifecycleState, string> = {
	initializing: "Initializing",
	running: "Running",
	"waiting-for-input": "Waiting for input",
	completed: "Completed",
	failed: "Failed",
	cancelled: "Cancelled",
	"ended-by-shutdown": "Ended by shutdown",
};

export function StatusHeader({
	agentDisplayName,
	lifecycleState,
}: StatusHeaderProps): JSX.Element {
	return (
		<div className="agent-chat-status-header">
			<span className="agent-chat-status-header__name">{agentDisplayName}</span>
			<span
				className={`agent-chat-status-header__badge agent-chat-status-header__badge--${lifecycleState}`}
			>
				{LIFECYCLE_LABEL[lifecycleState]}
			</span>
		</div>
	);
}
