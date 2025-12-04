import {
	commands,
	type CancellationToken,
	type Disposable,
	type ExtensionContext,
	type OutputChannel,
	type Uri,
	type WebviewView,
	type WebviewViewProvider,
	type WebviewViewResolveContext,
} from "vscode";
import type { HookManager } from "../features/hooks/hook-manager";
import type { HookExecutor } from "../features/hooks/hook-executor";
import type { Hook, HookExecutionLog } from "../features/hooks/types";
import { getWebviewContent } from "../utils/get-webview-content";

/**
 * Message types from webview to extension
 */
type WebviewMessage =
	| HookCreateMessage
	| HookUpdateMessage
	| HookDeleteMessage
	| HookToggleMessage
	| HookListRequestMessage
	| HookReadyMessage
	| HookLogsRequestMessage;

interface HookCreateMessage {
	command?: "hooks.create";
	type?: "hooks/create";
	data: Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount">;
}

interface HookUpdateMessage {
	command?: "hooks.update";
	type?: "hooks/update";
	data: {
		id: string;
		updates: Partial<Hook>;
	};
}

interface HookDeleteMessage {
	command?: "hooks.delete";
	type?: "hooks/delete";
	data: { id: string };
}

interface HookToggleMessage {
	command?: "hooks.toggle";
	type?: "hooks/toggle";
	data: { id: string; enabled: boolean };
}

interface HookListRequestMessage {
	command?: "hooks.list";
	type?: "hooks/list";
}

interface HookReadyMessage {
	command?: "hooks.ready";
	type?: "hooks/ready";
}

interface HookLogsRequestMessage {
	command?: "hooks.logs";
	type?: "hooks/logs";
	data?: { hookId?: string };
	payload?: { hookId?: string };
}

/**
 * Message types from extension to webview
 */
interface HooksSyncMessage {
	command: "hooks.sync";
	type: "hooks/sync";
	data: { hooks: Hook[] };
}

interface HookCreatedMessage {
	command: "hooks.created";
	type: "hooks/created";
	data: { hook: Hook };
}

interface HookUpdatedMessage {
	command: "hooks.updated";
	type: "hooks/updated";
	data: { hook: Hook };
}

interface HookDeletedMessage {
	command: "hooks.deleted";
	type: "hooks/deleted";
	data: { id: string };
}

interface ErrorMessage {
	command: "hooks.error";
	type: "hooks/error";
	data: {
		message: string;
		code?: string;
	};
}

interface ExecutionStatusMessage {
	command: "hooks.execution-status";
	type: "hooks/execution-status";
	data: HookExecutionStatusPayload;
}

interface HookExecutionStatusPayload {
	hookId: string;
	status: "executing" | "completed" | "failed";
	errorMessage?: string;
}

interface ExecutionLogsMessage {
	command: "hooks.logs";
	type: "hooks/logs";
	data: { logs: HookExecutionLog[] };
}

type ExtensionMessage =
	| HooksSyncMessage
	| HookCreatedMessage
	| HookUpdatedMessage
	| HookDeletedMessage
	| ErrorMessage
	| ExecutionStatusMessage
	| ExecutionLogsMessage
	| ShowFormMessage
	| ShowLogsPanelMessage;

interface ShowFormMessage {
	command: "hooks.show-form";
	type: "hooks/show-form";
	data?: { mode?: "create" | "edit" };
}

interface ShowLogsPanelMessage {
	command: "hooks.show-logs";
	type: "hooks/show-logs";
	data: { visible: boolean; hookId?: string };
}

/**
 * HookViewProvider - Manages the Hooks configuration webview
 *
 * Responsibilities:
 * - Initialize and manage webview lifecycle
 * - Route messages between webview and extension
 * - Synchronize hook state to webview
 * - Handle CRUD operations from webview
 */
export class HookViewProvider implements WebviewViewProvider {
	static readonly viewId = "alma.hooksView";

	private _view?: WebviewView;
	private readonly _extensionUri: Uri;
	private readonly hookManager: HookManager;
	private readonly hookExecutor: HookExecutor;
	private readonly outputChannel: OutputChannel;
	private readonly _disposables: Disposable[] = [];
	private readonly executionStatusCache = new Map<
		string,
		HookExecutionStatusPayload
	>();
	private readonly pendingMessages: ExtensionMessage[] = [];

	constructor(
		context: ExtensionContext,
		hookManager: HookManager,
		hookExecutor: HookExecutor,
		outputChannel: OutputChannel
	) {
		this._extensionUri = context.extensionUri;
		this.hookManager = hookManager;
		this.hookExecutor = hookExecutor;
		this.outputChannel = outputChannel;
	}

	/**
	 * Initialize the provider and subscribe to hook changes
	 */
	initialize(): void {
		// Subscribe to hook manager events
		this._disposables.push(
			this.hookManager.onHooksChanged(() => {
				this.syncHooksToWebview();
			}),
			this.hookExecutor.onExecutionStarted((event) => {
				this.handleExecutionStatus({
					hookId: event.hook.id,
					status: "executing",
				});
			}),
			this.hookExecutor.onExecutionCompleted((event) => {
				this.handleExecutionStatus({
					hookId: event.hook.id,
					status: "completed",
				});
			}),
			this.hookExecutor.onExecutionFailed((event) => {
				this.handleExecutionStatus({
					hookId: event.hook.id,
					status: "failed",
					errorMessage: event.result?.error?.message,
				});
			})
		);

		this.outputChannel.appendLine("[HookViewProvider] Initialized");
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this.outputChannel.appendLine("[HookViewProvider] Disposed");
	}

	/**
	 * Resolve the webview view - called when the view becomes visible
	 */
	resolveWebviewView(
		webviewView: WebviewView,
		context: WebviewViewResolveContext,
		_token: CancellationToken
	): void {
		this._view = webviewView;

		// Configure webview options
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		// Set HTML content
		webviewView.webview.html = getWebviewContent(
			webviewView.webview,
			this._extensionUri,
			"hooks"
		);

		// Setup message handling
		webviewView.webview.onDidReceiveMessage(
			(message) => this.handleWebviewMessage(message),
			undefined,
			this._disposables
		);
		webviewView.onDidDispose(
			() => {
				this._view = undefined;
			},
			undefined,
			this._disposables
		);

		// Initial sync
		this.syncHooksToWebview();
		this.flushExecutionStatuses();
		this.flushPendingMessages();

		this.outputChannel.appendLine("[HookViewProvider] Webview resolved");
	}

	/**
	 * Synchronize all hooks to the webview
	 */
	async syncHooksToWebview(): Promise<void> {
		if (!this._view) {
			return;
		}

		try {
			const hooks = await this.hookManager.getAllHooks();

			await this._view.webview.postMessage({
				command: "hooks.sync",
				type: "hooks/sync",
				data: { hooks },
			} as HooksSyncMessage);

			this.outputChannel.appendLine(
				`[HookViewProvider] Synced ${hooks.length} hooks to webview`
			);
			this.flushExecutionStatuses();
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] Error syncing hooks: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Manually refresh the webview
	 */
	async refreshWebview(): Promise<void> {
		await this.syncHooksToWebview();
	}

	/**
	 * Route incoming webview messages to appropriate handlers
	 */
	private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
		try {
			const normalizedCommand =
				message.command ??
				("type" in message && message.type
					? (message.type as string).replace(/\//g, ".")
					: undefined);
			const messageData = (message as any).data ?? (message as any).payload;

			switch (normalizedCommand) {
				case "hooks.create":
					await this.handleCreateHook(messageData);
					break;

				case "hooks.update":
					await this.handleUpdateHook(messageData.id, messageData.updates);
					break;

				case "hooks.delete":
					await this.handleDeleteHook(messageData.id);
					break;

				case "hooks.toggle":
					await this.handleToggleHook(messageData.id, messageData.enabled);
					break;

				case "hooks.list":
					await this.syncHooksToWebview();
					break;

				case "hooks.logs":
					await this.sendExecutionLogs(messageData?.hookId);
					break;

				case "hooks.ready":
					// no-op handshake
					break;

				default:
					this.outputChannel.appendLine(
						`[HookViewProvider] Unknown command: ${(message as any).command ?? (message as any).type}`
					);
			}
		} catch (error) {
			await this.sendError(error as Error);
		}
	}

	/**
	 * Handle create hook request from webview
	 */
	private async handleCreateHook(
		data: Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount">
	): Promise<void> {
		const hook = await this.hookManager.createHook(data);

		this.outputChannel.appendLine(
			`[HookViewProvider] Hook created: ${hook.name} (${hook.id})`
		);

		// Send confirmation to webview
		await this._view?.webview.postMessage({
			command: "hooks.created",
			type: "hooks/created",
			data: { hook },
		} as HookCreatedMessage);
	}

	/**
	 * Handle update hook request from webview
	 */
	private async handleUpdateHook(
		id: string,
		updates: Partial<Hook>
	): Promise<void> {
		const hook = await this.hookManager.updateHook(id, updates);

		this.outputChannel.appendLine(
			`[HookViewProvider] Hook updated: ${hook.name} (${hook.id})`
		);

		await this._view?.webview.postMessage({
			command: "hooks.updated",
			type: "hooks/updated",
			data: { hook },
		} as HookUpdatedMessage);
	}

	/**
	 * Handle delete hook request from webview
	 */
	private async handleDeleteHook(id: string): Promise<void> {
		const success = await this.hookManager.deleteHook(id);

		if (success) {
			this.outputChannel.appendLine(`[HookViewProvider] Hook deleted: ${id}`);

			await this._view?.webview.postMessage({
				command: "hooks.deleted",
				type: "hooks/deleted",
				data: { id },
			} as HookDeletedMessage);

			this.executionStatusCache.delete(id);
		}
	}

	/**
	 * Handle toggle hook enabled state from webview
	 */
	private async handleToggleHook(id: string, enabled: boolean): Promise<void> {
		await this.hookManager.updateHook(id, { enabled });

		this.outputChannel.appendLine(
			`[HookViewProvider] Hook toggled: ${id} -> ${enabled}`
		);
	}

	/**
	 * Send error message to webview
	 */
	private async sendError(error: Error): Promise<void> {
		this.outputChannel.appendLine(`[HookViewProvider] Error: ${error.message}`);

		await this._view?.webview.postMessage({
			command: "hooks.error",
			type: "hooks/error",
			data: {
				message: error.message,
				code: (error as any).code,
			},
		} as ErrorMessage);
	}

	/**
	 * Send execution logs to the webview
	 */
	private async sendExecutionLogs(hookId?: string): Promise<void> {
		if (!this._view) {
			await this.enqueueMessage({
				command: "hooks.logs",
				type: "hooks/logs",
				data: {
					logs: hookId
						? this.hookExecutor.getExecutionLogsForHook(hookId)
						: this.hookExecutor.getExecutionLogs(),
				},
			});
			return;
		}

		const logs = hookId
			? this.hookExecutor.getExecutionLogsForHook(hookId)
			: this.hookExecutor.getExecutionLogs();

		await this._view.webview.postMessage({
			command: "hooks.logs",
			type: "hooks/logs",
			data: { logs },
		} as ExecutionLogsMessage);
	}

	/**
	 * Cache and broadcast execution status updates
	 */
	private handleExecutionStatus(payload: HookExecutionStatusPayload): void {
		this.executionStatusCache.set(payload.hookId, payload);

		if (!this._view) {
			return;
		}

		this._view.webview.postMessage({
			command: "hooks.execution-status",
			type: "hooks/execution-status",
			data: payload,
		} as ExecutionStatusMessage);
	}

	/**
	 * Flush cached status updates to the active webview
	 */
	private flushExecutionStatuses(): void {
		if (!this._view) {
			return;
		}

		for (const payload of this.executionStatusCache.values()) {
			this._view.webview.postMessage({
				command: "hooks.execution-status",
				type: "hooks/execution-status",
				data: payload,
			} as ExecutionStatusMessage);
		}
	}

	private async revealView(): Promise<void> {
		if (this._view) {
			this._view.show?.(true);
			return;
		}
		await commands.executeCommand(`${HookViewProvider.viewId}.focus`);
	}

	private flushPendingMessages(): void {
		if (!this._view) {
			return;
		}

		while (this.pendingMessages.length > 0) {
			const message = this.pendingMessages.shift();
			if (message) {
				this._view.webview.postMessage(message);
			}
		}
	}

	private async enqueueMessage(message: ExtensionMessage): Promise<void> {
		this.pendingMessages.push(message);
		await this.revealView();
	}

	private async sendMessageToWebview(message: ExtensionMessage): Promise<void> {
		if (!this._view) {
			await this.enqueueMessage(message);
			return;
		}
		await this._view.webview.postMessage(message);
	}

	async showCreateHookForm(): Promise<void> {
		await this.revealView();
		await this.sendMessageToWebview({
			command: "hooks.show-form",
			type: "hooks/show-form",
			data: { mode: "create" },
		} as ShowFormMessage);
	}

	async showLogsPanel(hookId?: string): Promise<void> {
		await this.revealView();
		await this.sendMessageToWebview({
			command: "hooks.show-logs",
			type: "hooks/show-logs",
			data: { visible: true, hookId },
		} as ShowLogsPanelMessage);
	}
}
