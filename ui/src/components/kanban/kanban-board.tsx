import type * as React from "react";
import type {
	NormalizedTask,
	ExecutionState,
} from "../../../../src/features/tasks/task-model";
import { KanbanColumn } from "./kanban-column";

interface KanbanBoardProps {
	tasks: NormalizedTask[];
	onTaskClick?: (task: NormalizedTask) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
	tasks,
	onTaskClick,
}) => {
	// Group tasks by execution state
	// "Implement columns for queued, ready, running, blocked, completed, and failed work"

	const getTasksByState = (state: ExecutionState) =>
		tasks.filter((t) => t.execution?.state === state);

	const columns: { title: string; state: ExecutionState }[] = [
		{ title: "Queued", state: "queued" },
		{ title: "Ready", state: "ready" },
		{ title: "Running", state: "running" },
		{ title: "Blocked", state: "blocked" },
		{ title: "Completed", state: "completed" },
		{ title: "Failed", state: "failed" },
	];

	return (
		<div
			className="kanban-board"
			style={{
				display: "flex",
				gap: "16px",
				padding: "16px",
				height: "100%",
				width: "100%",
				overflowX: "auto",
				boxSizing: "border-box",
				color: "var(--vscode-editor-foreground)",
				backgroundColor: "var(--vscode-editor-background)",
			}}
		>
			{columns.map((col) => (
				<KanbanColumn
					key={col.state}
					onTaskClick={onTaskClick}
					state={col.state}
					tasks={getTasksByState(col.state)}
					title={col.title}
				/>
			))}
		</div>
	);
};
