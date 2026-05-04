import type * as React from "react";
import type {
	NormalizedTask,
	ExecutionState,
} from "../../../../src/features/tasks/task-model";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
	title: string;
	state: ExecutionState;
	tasks: NormalizedTask[];
	onTaskClick?: (task: NormalizedTask) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
	title,
	state,
	tasks,
	onTaskClick,
}) => (
	<div
		className="kanban-column"
		style={{
			display: "flex",
			flexDirection: "column",
			flex: "1 1 0",
			minWidth: "250px",
			backgroundColor: "var(--vscode-sideBar-background)",
			border: "1px solid var(--vscode-widget-border)",
			borderRadius: "4px",
			overflow: "hidden",
		}}
	>
		<div
			style={{
				padding: "8px",
				fontWeight: "bold",
				borderBottom: "1px solid var(--vscode-widget-border)",
				backgroundColor: "var(--vscode-editorGroupHeader-tabsBackground)",
				color: "var(--vscode-editorGroupHeader-tabsForeground)",
				display: "flex",
				justifyContent: "space-between",
			}}
		>
			<span>{title}</span>
			<span
				style={{
					backgroundColor: "var(--vscode-badge-background)",
					color: "var(--vscode-badge-foreground)",
					padding: "0 6px",
					borderRadius: "10px",
					fontSize: "11px",
				}}
			>
				{tasks.length}
			</span>
		</div>
		<div
			style={{
				padding: "8px",
				overflowY: "auto",
				flex: 1,
			}}
		>
			{tasks.map((task) => (
				<KanbanCard
					key={task.id}
					onClick={() => onTaskClick?.(task)}
					task={task}
				/>
			))}
			{tasks.length === 0 && (
				<div
					style={{
						textAlign: "center",
						padding: "16px",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
						fontStyle: "italic",
					}}
				>
					No tasks
				</div>
			)}
		</div>
	</div>
);
