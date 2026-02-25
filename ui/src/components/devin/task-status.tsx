/**
 * TaskStatus Component
 *
 * Displays the status of a single Devin task with icon and label.
 */

import type { DevinTaskView } from "../../stores/devin-store";

const STATUS_ICONS: Record<string, string> = {
	pending: "circle-outline",
	queued: "clock",
	"in-progress": "sync~spin",
	completed: "check",
	failed: "error",
	cancelled: "circle-slash",
};

const STATUS_COLORS: Record<string, string> = {
	pending: "var(--vscode-descriptionForeground)",
	queued: "var(--vscode-charts-yellow)",
	"in-progress": "var(--vscode-charts-blue)",
	completed: "var(--vscode-charts-green)",
	failed: "var(--vscode-charts-red)",
	cancelled: "var(--vscode-descriptionForeground)",
};

interface TaskStatusProps {
	readonly task: DevinTaskView;
}

export function TaskStatus({ task }: TaskStatusProps) {
	const color = STATUS_COLORS[task.status] ?? "inherit";
	const icon = STATUS_ICONS[task.status] ?? "question";

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "8px",
				padding: "4px 0",
			}}
		>
			<span className={`codicon codicon-${icon}`} style={{ color }} />
			<span style={{ flex: 1 }}>
				<strong>{task.specTaskId}</strong>: {task.title}
			</span>
			<span
				style={{
					fontSize: "0.85em",
					color,
					textTransform: "uppercase",
				}}
			>
				{task.status}
			</span>
		</div>
	);
}
