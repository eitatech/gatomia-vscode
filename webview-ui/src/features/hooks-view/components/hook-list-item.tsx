import { useCallback, useState } from "react";
import type { Hook, HookExecutionStatusEntry } from "../types";

interface HookListItemProps {
	hook: Hook;
	executionStatus?: HookExecutionStatusEntry;
	onToggle: (id: string, enabled: boolean) => void;
	onDelete: (id: string) => void;
	onEdit: (hook: Hook) => void;
	className?: string;
}

export const HookListItem = ({
	executionStatus,
	hook,
	onToggle,
	onDelete,
	onEdit,
	className,
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
		<div
			className={`group flex items-center justify-between gap-3 rounded px-2 py-1 transition-colors focus-within:bg-[color:var(--vscode-list-hoverBackground)] hover:bg-[color:var(--vscode-list-hoverBackground)] ${
				className ?? ""
			}`}
		>
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex items-center gap-2">
					<span
						aria-hidden="true"
						className="codicon codicon-git-pull-request text-[color:var(--vscode-foreground)] text-sm"
					/>
					<span className="truncate font-medium text-[color:var(--vscode-foreground)] text-sm">
						{hook.name}
					</span>
					{!hook.enabled && (
						<span className="rounded bg-[color:var(--vscode-badge-background)] px-1.5 py-0.5 text-[10px] text-[color:var(--vscode-badge-foreground)] uppercase tracking-widest">
							Paused
						</span>
					)}
					{renderExecutionStatus()}
				</div>
				<div className="flex flex-wrap gap-2 text-[color:var(--vscode-descriptionForeground)] text-xs">
					<span className="rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)] px-2 py-0.5">
						{triggerDisplay}
					</span>
					<span className="rounded border border-[color:color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)] px-2 py-0.5">
						{hook.action.type} action
					</span>
					<span className="truncate">
						{getActionDisplay()}
						{hook.executionCount > 0 &&
							` • ${hook.executionCount} run${hook.executionCount === 1 ? "" : "s"}`}
					</span>
				</div>
			</div>
			<div className="flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
				<IconActionButton
					ariaLabel={hook.enabled ? "Pause hook" : "Resume hook"}
					iconClass={hook.enabled ? "codicon-debug-pause" : "codicon-play"}
					onClick={handleToggle}
					title={hook.enabled ? "Pause hook" : "Resume hook"}
				/>
				<IconActionButton
					ariaLabel="Edit hook"
					iconClass="codicon-edit"
					onClick={handleEdit}
					title="Edit hook"
				/>
				<IconActionButton
					ariaLabel="Delete hook"
					iconClass="codicon-trash"
					onClick={handleDeleteClick}
					title="Delete hook"
					tone="danger"
				/>
			</div>

			{/* Delete confirmation */}
			{showDeleteConfirm && (
				<div className="mt-2 flex items-center justify-between gap-2 rounded border border-[color:var(--vscode-inputValidation-warningBorder,#cca700)] bg-[color:var(--vscode-inputValidation-warningBackground)] px-3 py-2 text-[color:var(--vscode-inputValidation-warningForeground)]">
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

interface IconActionButtonProps {
	ariaLabel: string;
	iconClass: string;
	title: string;
	onClick: () => void;
	tone?: "default" | "danger";
}

const IconActionButton = ({
	ariaLabel,
	iconClass,
	title,
	onClick,
	tone = "default",
}: IconActionButtonProps) => (
	<button
		aria-label={ariaLabel}
		className={`flex h-7 w-7 items-center justify-center rounded border border-transparent text-base transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--vscode-focusBorder)] ${
			tone === "danger"
				? "text-[color:var(--vscode-errorForeground)] hover:bg-[color:color-mix(in_srgb,var(--vscode-errorForeground)_15%,transparent)]"
				: "text-[color:var(--vscode-foreground)] hover:bg-[color:var(--vscode-list-hoverBackground)]"
		}`}
		onClick={onClick}
		title={title}
		type="button"
	>
		<span aria-hidden="true" className={`codicon ${iconClass}`} />
	</button>
);
