/**
 * Session List
 *
 * Renders a provider-agnostic list of agent sessions.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import type { AgentSessionView } from "../../stores/cloud-agent-store";
import { TaskStatus } from "./task-status";
import { PullRequestActions } from "./pull-request-actions";

// ============================================================================
// Props
// ============================================================================

interface SessionListProps {
	sessions: AgentSessionView[];
	onOpenExternal?: (url: string) => void;
}

// ============================================================================
// SessionList
// ============================================================================

/**
 * Provider-agnostic session list component.
 */
export function SessionList({
	sessions,
	onOpenExternal,
}: SessionListProps): JSX.Element {
	if (sessions.length === 0) {
		return <div data-testid="session-list-empty">No sessions</div>;
	}

	return (
		<div data-testid="session-list">
			{sessions.map((session) => (
				<div
					className="session-item"
					data-testid={`session-${session.localId}`}
					key={session.localId}
				>
					<div className="session-header">
						<span className="session-status">{session.displayStatus}</span>
						<span className="session-branch">{session.branch}</span>
						{session.isReadOnly && (
							<span className="session-readonly">read-only</span>
						)}
					</div>
					{session.externalUrl && onOpenExternal && (
						<button
							onClick={() => onOpenExternal(session.externalUrl!)}
							type="button"
						>
							Open in browser
						</button>
					)}
					{session.tasks.length > 0 && (
						<div className="session-tasks">
							{session.tasks.map((task) => (
								<TaskStatus key={task.taskId} task={task} />
							))}
						</div>
					)}
					{session.pullRequests.length > 0 && (
						<PullRequestActions
							onOpenPr={onOpenExternal}
							pullRequests={session.pullRequests}
						/>
					)}
				</div>
			))}
		</div>
	);
}
