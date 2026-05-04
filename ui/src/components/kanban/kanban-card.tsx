import type * as React from "react";
import type { NormalizedTask } from "../../../../src/features/tasks/task-model";

interface KanbanCardProps {
	task: NormalizedTask;
	onClick?: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ task, onClick }) => {
	const metadata = task.metadata || {};
	const execution = task.execution || {};

	// Mock data for timestamps and agent ownership if not present
	const agentOwnership = execution.suggestedRole || "Unassigned";
	const blockers =
		execution.dependsOn && execution.dependsOn.length > 0
			? execution.dependsOn.join(", ")
			: null;

	const formatDate = (timestamp?: number) =>
		timestamp ? new Date(timestamp).toLocaleTimeString() : null;

	return (
		// biome-ignore lint/a11y/useSemanticElements: this is a card container that can be clicked
		<div
			className="kanban-card"
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					onClick?.();
				}
			}}
			role="button"
			style={{
				backgroundColor: "var(--vscode-editor-background)",
				border: "1px solid var(--vscode-widget-border)",
				padding: "8px",
				marginBottom: "8px",
				borderRadius: "4px",
				cursor: onClick ? "pointer" : "default",
				display: "flex",
				flexDirection: "column",
				gap: "4px",
			}}
			tabIndex={onClick ? 0 : undefined}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
				}}
			>
				<span
					style={{
						fontWeight: "bold",
						fontSize: "13px",
						color: "var(--vscode-editor-foreground)",
					}}
				>
					{task.title}
				</span>
				{metadata.priority && (
					<span
						style={{
							fontSize: "10px",
							padding: "2px 4px",
							backgroundColor: "var(--vscode-badge-background)",
							color: "var(--vscode-badge-foreground)",
							borderRadius: "2px",
						}}
					>
						{metadata.priority}
					</span>
				)}
			</div>

			<div
				style={{
					fontSize: "11px",
					color: "var(--vscode-descriptionForeground)",
					display: "flex",
					flexDirection: "column",
					gap: "2px",
				}}
			>
				<div>Source: {task.source.system}</div>
				{agentOwnership && <div>Agent: {agentOwnership}</div>}
				{execution.startedAt && (
					<div>Started: {formatDate(execution.startedAt)}</div>
				)}
				{execution.completedAt && (
					<div>Completed: {formatDate(execution.completedAt)}</div>
				)}
				{blockers && (
					<div style={{ color: "var(--vscode-errorForeground)" }}>
						Blocked by: {blockers}
					</div>
				)}
				{execution.errorMessage && (
					<div style={{ color: "var(--vscode-errorForeground)" }}>
						Error: {execution.errorMessage}
					</div>
				)}
				{execution.intent && (
					<div
						style={{
							marginTop: "4px",
							fontStyle: "italic",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
						}}
					>
						Activity: {execution.intent}
					</div>
				)}
			</div>
		</div>
	);
};
