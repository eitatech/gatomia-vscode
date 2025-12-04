import { vscode } from "@/bridge/vscode";
import { useCallback, useEffect, useState } from "react";
import type {
	Hook,
	HookExecutionLog,
	HookExecutionStatusEntry,
	HooksExtensionMessage,
	HooksWebviewMessage,
} from "./types";
import { HooksList } from "./components/hooks-list";
import { HookForm } from "./components/hook-form";
import { ExecutionLogsList } from "./components/execution-logs-list";

export const HooksView = () => {
	const [hooks, setHooks] = useState<Hook[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const [showForm, setShowForm] = useState(false);
	const [editingHook, setEditingHook] = useState<Hook | undefined>();
	const [executionStatuses, setExecutionStatuses] = useState<
		Record<string, HookExecutionStatusEntry>
	>({});
	const [showLogsPanel, setShowLogsPanel] = useState(false);
	const [executionLogs, setExecutionLogs] = useState<HookExecutionLog[]>([]);
	const [logsLoading, setLogsLoading] = useState(false);
	const [selectedHookForLogs, setSelectedHookForLogs] = useState<string>("all");

	// Send message to extension
	const sendMessage = useCallback((message: HooksWebviewMessage) => {
		const command =
			message.command ?? (message.type?.replace(/\//g, ".") as string);
		vscode.postMessage({ ...message, command });
	}, []);
	const requestLogs = useCallback(
		(hookId?: string) => {
			if (hookId) {
				sendMessage({ type: "hooks/logs", payload: { hookId } });
			} else {
				sendMessage({ type: "hooks/logs" });
			}
		},
		[sendMessage]
	);

	// Handle incoming messages from extension
	useEffect(() => {
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: handles multiple extension messages
		const handleMessage = (event: MessageEvent<HooksExtensionMessage>) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}

			const messageType = payload.type ?? payload.command;
			const body = (payload as any).payload ?? (payload as any).data;

			switch (messageType) {
				case "hooks/sync":
				case "hooks.sync": {
					if (!body) {
						break;
					}
					const syncedHooks = Array.isArray(body.hooks) ? body.hooks : [];
					setHooks(syncedHooks);
					setIsLoading(false);
					setError(undefined);
					setExecutionStatuses((prev) => {
						const next: Record<string, HookExecutionStatusEntry> = {};
						for (const hook of syncedHooks) {
							if (prev[hook.id]) {
								next[hook.id] = prev[hook.id];
							}
						}
						return next;
					});
					break;
				}
				case "hooks/created":
				case "hooks.created": {
					if (!body?.hook) {
						break;
					}
					setHooks((prev) => [...prev, body.hook]);
					setError(undefined);
					setShowForm(false);
					setEditingHook(undefined);
					break;
				}
				case "hooks/updated":
				case "hooks.updated": {
					if (!body?.hook) {
						break;
					}
					setHooks((prev) =>
						prev.map((hook) => (hook.id === body.hook.id ? body.hook : hook))
					);
					setError(undefined);
					setShowForm(false);
					setEditingHook(undefined);
					break;
				}
				case "hooks/deleted":
				case "hooks.deleted": {
					if (!body?.id) {
						break;
					}
					setHooks((prev) => prev.filter((hook) => hook.id !== body.id));
					setError(undefined);
					setExecutionStatuses((prev) => {
						if (!prev[body.id]) {
							return prev;
						}
						const { [body.id]: _removed, ...rest } = prev;
						return rest;
					});
					break;
				}
				case "hooks/error":
				case "hooks.error": {
					if (!body?.message) {
						break;
					}
					setError(body.message);
					break;
				}
				case "hooks/execution-status":
				case "hooks.execution-status": {
					if (!body?.hookId) {
						break;
					}
					setExecutionStatuses((prev) => ({
						...prev,
						[body.hookId]: {
							...body,
							updatedAt: Date.now(),
						},
					}));
					break;
				}
				case "hooks/logs":
				case "hooks.logs": {
					const logs = Array.isArray(body?.logs) ? body.logs : [];
					setExecutionLogs(logs);
					setLogsLoading(false);
					break;
				}
				case "hooks/show-form":
				case "hooks.show-form": {
					setShowForm(true);
					setEditingHook(undefined);
					setError(undefined);
					setShowLogsPanel(false);
					setLogsLoading(false);
					break;
				}
				case "hooks/show-logs":
				case "hooks.show-logs": {
					const visible = Boolean(body?.visible);
					if (visible) {
						const hookId =
							typeof body?.hookId === "string" ? body.hookId : "all";
						setSelectedHookForLogs(hookId);
						setLogsLoading(true);
					} else {
						setLogsLoading(false);
					}
					setShowLogsPanel(visible);
					break;
				}
				default:
					break;
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	// Request initial hook list on mount
	useEffect(() => {
		sendMessage({ type: "hooks/ready" });
		sendMessage({ type: "hooks/list" });
	}, [sendMessage]);

	useEffect(() => {
		if (!showLogsPanel) {
			return;
		}
		const hookId =
			selectedHookForLogs === "all" ? undefined : selectedHookForLogs;
		setLogsLoading(true);
		requestLogs(hookId);
	}, [requestLogs, selectedHookForLogs, showLogsPanel]);

	useEffect(() => {
		if (
			selectedHookForLogs !== "all" &&
			!hooks.some((hook) => hook.id === selectedHookForLogs)
		) {
			setSelectedHookForLogs("all");
		}
	}, [hooks, selectedHookForLogs]);

	const handleToggle = useCallback(
		(id: string, enabled: boolean) => {
			sendMessage({ type: "hooks/toggle", payload: { id, enabled } });
		},
		[sendMessage]
	);

	const handleDelete = useCallback(
		(id: string) => {
			sendMessage({ type: "hooks/delete", payload: { id } });
		},
		[sendMessage]
	);

	const handleAddHook = useCallback(() => {
		setShowForm(true);
		setEditingHook(undefined);
		setError(undefined);
	}, []);

	const handleEditHook = useCallback((hook: Hook) => {
		setShowForm(true);
		setEditingHook(hook);
		setError(undefined);
	}, []);

	const handleFormCancel = useCallback(() => {
		setShowForm(false);
		setEditingHook(undefined);
		setError(undefined);
	}, []);

	const handleFormSubmit = useCallback(
		(
			hookData: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount" | "lastExecutedAt"
			>
		) => {
			if (editingHook) {
				// Update existing hook
				sendMessage({
					type: "hooks/update",
					payload: {
						id: editingHook.id,
						updates: hookData,
					},
				});
			} else {
				// Create new hook
				sendMessage({
					type: "hooks/create",
					payload: hookData,
				});
			}
		},
		[editingHook, sendMessage]
	);

	const handleToggleLogsPanel = useCallback(() => {
		if (showLogsPanel) {
			setShowLogsPanel(false);
			setLogsLoading(false);
		} else {
			setShowLogsPanel(true);
		}
	}, [showLogsPanel]);

	const handleSelectHookForLogs = useCallback((hookId?: string) => {
		setSelectedHookForLogs(hookId ?? "all");
	}, []);

	const handleRefreshLogs = useCallback(() => {
		if (!showLogsPanel) {
			setShowLogsPanel(true);
			return;
		}

		const hookId =
			selectedHookForLogs === "all" ? undefined : selectedHookForLogs;
		setLogsLoading(true);
		requestLogs(hookId);
	}, [requestLogs, selectedHookForLogs, showLogsPanel]);

	const selectedHookIdForLogs =
		selectedHookForLogs === "all" ? undefined : selectedHookForLogs;

	return (
		<div className="flex h-full w-full flex-col gap-4 px-4 py-4">
			<header className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-xl">
						Hooks
					</h1>
					<div className="flex items-center gap-2">
						<button
							className="rounded border border-[color:var(--vscode-button-border,transparent)] bg-[color:var(--vscode-button-secondaryBackground)] px-3 py-1 text-[color:var(--vscode-button-secondaryForeground)] text-sm hover:bg-[color:var(--vscode-button-secondaryHoverBackground)]"
							onClick={handleToggleLogsPanel}
							type="button"
						>
							{showLogsPanel ? "Hide Logs" : "View Logs"}
						</button>
						<button
							className="rounded bg-[color:var(--vscode-button-background)] px-3 py-1 text-[color:var(--vscode-button-foreground)] text-sm hover:bg-[color:var(--vscode-button-hoverBackground)]"
							onClick={handleAddHook}
							type="button"
						>
							Add Hook
						</button>
					</div>
				</div>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
					Configure automated actions triggered by agent operations
				</p>
			</header>

			{error && (
				<div
					className="rounded border border-[color:var(--vscode-inputValidation-errorBorder)] bg-[color:var(--vscode-inputValidation-errorBackground)] px-3 py-2 text-[color:var(--vscode-inputValidation-errorForeground)] text-sm"
					role="alert"
				>
					{error}
				</div>
			)}

			{showForm ? (
				<HookForm
					error={error}
					initialData={editingHook}
					mode={editingHook ? "edit" : "create"}
					onCancel={handleFormCancel}
					onSubmit={handleFormSubmit}
				/>
			) : (
				<HooksList
					executionStatuses={executionStatuses}
					hooks={hooks}
					isLoading={isLoading}
					onDelete={handleDelete}
					onEdit={handleEditHook}
					onToggle={handleToggle}
				/>
			)}

			{showLogsPanel && (
				<ExecutionLogsList
					hooks={hooks}
					isLoading={logsLoading}
					logs={executionLogs}
					onClose={handleToggleLogsPanel}
					onRefresh={handleRefreshLogs}
					onSelectHook={handleSelectHookForLogs}
					selectedHookId={selectedHookIdForLogs}
				/>
			)}
		</div>
	);
};

export default HooksView;
