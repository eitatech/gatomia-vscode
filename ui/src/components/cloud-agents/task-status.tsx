/**
 * Task Status
 *
 * Displays status information for individual tasks within a session.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import type { AgentTaskView } from "../../stores/cloud-agent-store";

// ============================================================================
// Props
// ============================================================================

interface TaskStatusProps {
	task: AgentTaskView;
}

// ============================================================================
// TaskStatus
// ============================================================================

/**
 * Task status display component.
 */
export function TaskStatus({ task }: TaskStatusProps): JSX.Element {
	return (
		<div className="task-item" data-testid={`task-${task.taskId}`}>
			<span className="task-title">{task.title}</span>
			<span className="task-status">{task.status}</span>
			{task.progress !== undefined && (
				<span className="task-progress">{task.progress}%</span>
			)}
		</div>
	);
}
