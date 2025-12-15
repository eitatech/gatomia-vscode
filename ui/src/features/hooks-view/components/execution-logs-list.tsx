import type { ChangeEvent } from "react";
import type { Hook, HookExecutionLog, ExecutionStatus } from "../types";

interface ExecutionLogsListProps {
	hooks: Hook[];
	logs: HookExecutionLog[];
	isLoading: boolean;
	selectedHookId?: string;
	onSelectHook: (hookId?: string) => void;
	onRefresh: () => void;
	onClose: () => void;
}

const statusStyles: Record<ExecutionStatus, string> = {
	success: "text-[color:var(--vscode-testing-iconPassed,#89d185)]",
	failure: "text-[color:var(--vscode-testing-iconFailed,#f48771)]",
	skipped: "text-[color:var(--vscode-descriptionForeground)]",
	timeout: "text-[color:var(--vscode-testing-iconFailed,#f48771)]",
};

const statusLabels: Record<ExecutionStatus, string> = {
	success: "Success",
	failure: "Failure",
	skipped: "Skipped",
	timeout: "Timeout",
};

export const ExecutionLogsList = ({
	hooks,
	isLoading,
	logs,
	onClose,
	onRefresh,
	onSelectHook,
	selectedHookId,
}: ExecutionLogsListProps) => {
	const hookLookup = new Map(hooks.map((hook) => [hook.id, hook.name]));
	const sortedLogs = [...logs].sort((a, b) => {
		const aTs = a.completedAt ?? a.triggeredAt;
		const bTs = b.completedAt ?? b.triggeredAt;
		return bTs - aTs;
	});

	const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
		const value = event.target.value;
		onSelectHook(value === "all" ? undefined : value);
	};

	const renderLog = (log: HookExecutionLog) => {
		const hookName = hookLookup.get(log.hookId) ?? log.hookId;
		const statusClass = statusStyles[log.status];
		const statusLabel = statusLabels[log.status];
		const timestamp = new Date(log.triggeredAt).toLocaleString();
		return (
			<article
				className="flex flex-col gap-1 border-[color:var(--vscode-panel-border)] border-b px-2 py-2 last:border-b-0"
				key={log.id}
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-col">
						<span className="font-medium text-[color:var(--vscode-foreground)] text-sm">
							{hookName}
						</span>
						<span className="text-[color:var(--vscode-descriptionForeground)] text-xs">
							Triggered at {timestamp}
						</span>
					</div>
					<div className={`font-semibold text-xs ${statusClass}`}>
						{statusLabel}
					</div>
				</div>
				<div className="text-[color:var(--vscode-descriptionForeground)] text-xs">
					<span className="mr-2">
						Chain depth: <strong>{log.chainDepth}</strong>
					</span>
					<span className="mr-2">
						Duration:{" "}
						<strong>
							{log.duration !== undefined ? `${log.duration}ms` : "—"}
						</strong>
					</span>
					<span>
						Execution ID: <strong>{log.executionId}</strong>
					</span>
				</div>
				{log.error?.message && (
					<div className="text-[color:var(--vscode-errorForeground)] text-xs">
						Error: {log.error.message}
					</div>
				)}
			</article>
		);
	};

	return (
		<section className="flex flex-col gap-3 rounded border border-[color:var(--vscode-panel-border)] bg-[color:var(--vscode-editor-background)] p-3">
			<div className="flex items-center justify-between gap-2">
				<h2 className="font-semibold text-[color:var(--vscode-foreground)] text-base">
					Execution Logs
				</h2>
				<div className="flex items-center gap-2">
					<button
						className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground)] px-3 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-xs hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
						onClick={onRefresh}
						type="button"
					>
						Refresh
					</button>
					<button
						className="rounded bg-[color:var(--vscode-button-background)] px-3 py-1 text-[color:var(--vscode-button-foreground)] text-xs hover:bg-[color:var(--vscode-button-hoverBackground)]"
						onClick={onClose}
						type="button"
					>
						Close
					</button>
				</div>
			</div>

			<label className="flex flex-col gap-1 text-[color:var(--vscode-descriptionForeground)] text-xs">
				Filter by hook
				<select
					className="rounded border border-[color:var(--vscode-input-border)] bg-[color:var(--vscode-input-background)] px-2 py-1 text-[color:var(--vscode-input-foreground)]"
					onChange={handleFilterChange}
					value={selectedHookId ?? "all"}
				>
					<option value="all">All hooks</option>
					{hooks.map((hook) => (
						<option key={hook.id} value={hook.id}>
							{hook.name}
						</option>
					))}
				</select>
			</label>

			<div className="max-h-64 overflow-auto rounded border border-[color:var(--vscode-panel-border)]">
				{(() => {
					if (isLoading) {
						return (
							<div className="flex items-center justify-center py-6 text-[color:var(--vscode-descriptionForeground)] text-sm">
								Loading logs...
							</div>
						);
					}

					if (sortedLogs.length === 0) {
						return (
							<div className="flex items-center justify-center py-6 text-[color:var(--vscode-descriptionForeground)] text-sm">
								No execution logs yet
							</div>
						);
					}

					return sortedLogs.map((log) => renderLog(log));
				})()}
			</div>
		</section>
	);
};
