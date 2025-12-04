import { useCallback, useState } from "react";
import type { Hook, HookExecutionStatusEntry } from "../types";

interface HookListItemProps {
	hook: Hook;
	executionStatus?: HookExecutionStatusEntry;
	onToggle: (id: string, enabled: boolean) => void;
	onDelete: (id: string) => void;
	onEdit: (hook: Hook) => void;
}

export const HookListItem = ({
	executionStatus,
	hook,
	onToggle,
	onDelete,
	onEdit,
}: HookListItemProps) => {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const handleToggle = useCallback(() => {
		onToggle(hook.id, !hook.enabled);
	}, [hook.id, hook.enabled, onToggle]);

	const handleEdit = useCallback(() => {
		onEdit(hook);
	}, [hook, onEdit]);

	const handleDeleteClick = useCallback(() => {
		setShowDeleteConfirm(true);
	}, []);

	const handleDeleteConfirm = useCallback(() => {
		onDelete(hook.id);
		setShowDeleteConfirm(false);
	}, [hook.id, onDelete]);

	const handleDeleteCancel = useCallback(() => {
		setShowDeleteConfirm(false);
	}, []);

	// Format trigger display
	const triggerDisplay = `${hook.trigger.agent}/${hook.trigger.operation}`;

	// Format action display
	const getActionDisplay = (): string => {
		switch (hook.action.type) {
			case "agent":
				return `Agent: ${(hook.action.parameters as { command: string }).command}`;
			case "git":
				return `Git: ${(hook.action.parameters as { operation: string }).operation}`;
			case "github":
				return `GitHub: ${(hook.action.parameters as { operation: string }).operation}`;
			case "custom":
				return `Custom: ${(hook.action.parameters as { agentName: string }).agentName}`;
			default:
				return hook.action.type;
		}
	};

	const renderExecutionStatus = () => {
		if (!executionStatus) {
			return null;
		}

		const { status, errorMessage } = executionStatus;
		let label = "";
		let statusClass = "";
		let icon: JSX.Element | null = null;

		const badgeBaseClass =
			"flex items-center gap-1 rounded bg-[color:var(--vscode-editorWidget-background,#1e1e1e)] px-2 py-0.5 text-xs font-medium";

		switch (status) {
			case "executing":
				label = "Running";
				statusClass =
					"text-[color:var(--vscode-progressBar-background,#3794ff)]";
				icon = (
					<svg
						aria-hidden="true"
						className="h-3 w-3 animate-spin"
						role="presentation"
						viewBox="0 0 16 16"
					>
						<path
							d="M8 1.5a6.5 6.5 0 1 0 6.3 5.12"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeWidth="2"
						/>
					</svg>
				);
				break;
			case "completed":
				label = "Completed";
				statusClass = "text-[color:var(--vscode-testing-iconPassed,#89d185)]";
				icon = (
					<svg
						aria-hidden="true"
						className="h-3 w-3"
						role="presentation"
						viewBox="0 0 16 16"
					>
						<path
							d="M6.5 10.2 4.1 7.8 3.3 8.6l3.2 3.2 6-6-.7-.7z"
							fill="currentColor"
						/>
					</svg>
				);
				break;
			case "failed":
				label = "Failed";
				statusClass = "text-[color:var(--vscode-testing-iconFailed,#f48771)]";
				icon = (
					<svg
						aria-hidden="true"
						className="h-3 w-3"
						role="presentation"
						viewBox="0 0 16 16"
					>
						<path
							d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeWidth="1.5"
						/>
					</svg>
				);
				break;
			default:
				return null;
		}

		return (
			<span
				className={`${badgeBaseClass} ${statusClass}`}
				data-testid={`hook-status-${hook.id}`}
				title={errorMessage}
			>
				{icon}
				<span>{label}</span>
			</span>
		);
	};

	return (
		<div className="flex flex-col gap-2 rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-3">
			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="truncate font-medium text-[color:var(--vscode-foreground)] text-sm">
							{hook.name}
						</h3>
						{!hook.enabled && (
							<span className="rounded bg-[color:var(--vscode-badge-background)] px-1.5 py-0.5 text-[color:var(--vscode-badge-foreground)] text-xs">
								Disabled
							</span>
						)}
						{renderExecutionStatus()}
					</div>
					<div className="flex flex-col gap-0.5 text-[color:var(--vscode-descriptionForeground)] text-xs">
						<div>
							<span className="font-medium">Trigger:</span> {triggerDisplay}
						</div>
						<div className="truncate">
							<span className="font-medium">Action:</span> {getActionDisplay()}
						</div>
						{hook.executionCount > 0 && (
							<div className="text-[color:var(--vscode-descriptionForeground)] text-xs opacity-70">
								Executed {hook.executionCount} time
								{hook.executionCount !== 1 ? "s" : ""}
								{hook.lastExecutedAt &&
									` • Last: ${new Date(hook.lastExecutedAt).toLocaleString()}`}
							</div>
						)}
					</div>
				</div>

				<div className="flex items-center gap-1">
					{/* Toggle switch */}
					<button
						aria-checked={hook.enabled}
						aria-label={`${hook.enabled ? "Disable" : "Enable"} hook`}
						className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[color:var(--vscode-focusBorder)] ${
							hook.enabled
								? "bg-[color:var(--vscode-button-background)]"
								: "bg-[color:var(--vscode-input-background)]"
						}`}
						onClick={handleToggle}
						role="switch"
						type="button"
					>
						<span
							aria-hidden="true"
							className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
								hook.enabled ? "translate-x-4" : "translate-x-0"
							}`}
						/>
					</button>

					{/* Edit button */}
					<button
						className="rounded p-1 text-[color:var(--vscode-foreground)] hover:bg-[color:var(--vscode-list-hoverBackground)]"
						onClick={handleEdit}
						title="Edit hook"
						type="button"
					>
						<svg
							fill="currentColor"
							height="16"
							viewBox="0 0 16 16"
							width="16"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>Edit hook</title>
							<path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z" />
						</svg>
					</button>

					{/* Delete button */}
					<button
						className="rounded p-1 text-[color:var(--vscode-errorForeground)] hover:bg-[color:var(--vscode-list-hoverBackground)]"
						onClick={handleDeleteClick}
						title="Delete hook"
						type="button"
					>
						<svg
							fill="currentColor"
							height="16"
							viewBox="0 0 16 16"
							width="16"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>Delete hook</title>
							<path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z" />
						</svg>
					</button>
				</div>
			</div>

			{/* Delete confirmation */}
			{showDeleteConfirm && (
				<div className="flex items-center justify-between gap-2 rounded bg-[color:var(--vscode-inputValidation-warningBackground)] px-3 py-2">
					<span className="text-[color:var(--vscode-inputValidation-warningForeground)] text-xs">
						Delete "{hook.name}"?
					</span>
					<div className="flex gap-2">
						<button
							className="rounded bg-[color:var(--vscode-button-background)] px-2 py-1 text-[color:var(--vscode-button-foreground)] text-xs hover:bg-[color:var(--vscode-button-hoverBackground)]"
							onClick={handleDeleteConfirm}
							type="button"
						>
							Delete
						</button>
						<button
							className="rounded bg-[color:var(--vscode-button-secondaryBackground)] px-2 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-xs hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
							onClick={handleDeleteCancel}
							type="button"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
