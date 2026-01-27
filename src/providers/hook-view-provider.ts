import {
	type Disposable,
	type ExtensionContext,
	type OutputChannel,
	type Webview,
	type WebviewPanel,
	ViewColumn,
	window,
} from "vscode";
import type { HookManager } from "../features/hooks/hook-manager";
import type { HookExecutor } from "../features/hooks/hook-executor";
import type {
	Hook,
	HookExecutionLog,
	MCPServer,
} from "../features/hooks/types";
import type { IMCPDiscoveryService } from "../features/hooks/services/mcp-contracts";
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
	| HookLogsRequestMessage
	| MCPDiscoveryRequestMessage
	| AgentListRequestMessage;

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

interface MCPDiscoveryRequestMessage {
	command?: "hooks.mcp-discover";
	type?: "hooks/mcp-discover";
	data?: { forceRefresh?: boolean };
	payload?: { forceRefresh?: boolean };
}

interface AgentListRequestMessage {
	command?: "hooks.agents-list";
	type?: "hooks/agents-list";
	data?: { forceRefresh?: boolean };
	payload?: { forceRefresh?: boolean };
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

interface MCPServersMessage {
	command: "hooks.mcp-servers";
	type: "hooks/mcp-servers";
	data: { servers: MCPServer[] };
}

interface MCPErrorMessage {
	command: "hooks.mcp-error";
	type: "hooks/mcp-error";
	data: { message: string };
}

interface AgentListMessage {
	command: "hooks.agents-list";
	type: "hooks/agents-list";
	data: {
		local: Array<{
			id: string;
			name: string;
			displayName: string;
			description?: string;
		}>;
		background: Array<{
			id: string;
			name: string;
			displayName: string;
			description?: string;
		}>;
	};
}

interface AgentErrorMessage {
	command: "hooks.agents-error";
	type: "hooks/agents-error";
	data: { message: string };
}

type ExtensionMessage =
	| HooksSyncMessage
	| HookCreatedMessage
	| HookUpdatedMessage
	| HookDeletedMessage
	| ErrorMessage
	| ExecutionStatusMessage
	| ExecutionLogsMessage
	| MCPServersMessage
	| MCPErrorMessage
	| AgentListMessage
	| AgentErrorMessage
	| ShowFormMessage
	| ShowLogsPanelMessage;

interface ShowFormMessage {
	command: "hooks.show-form";
	type: "hooks/show-form";
	data?: { mode?: "create" | "edit"; hook?: Hook };
}

interface ShowLogsPanelMessage {
	command: "hooks.show-logs";
	type: "hooks/show-logs";
	data: { visible: boolean; hookId?: string };
}

/**
 * HookViewProvider - Manages the Hooks configuration webview panel
 *
 * Responsibilities:
 * - Initialize panel lifecycle
 * - Route messages between webview and extension
 * - Synchronize hook state to webview
 * - Handle CRUD operations and execution logs from webview
 */
export class HookViewProvider {
	static readonly panelType = "gatomia.hooksPanel";

	private panel?: WebviewPanel;
	private readonly context: ExtensionContext;
	private readonly hookManager: HookManager;
	private readonly hookExecutor: HookExecutor;
	private readonly mcpDiscoveryService: IMCPDiscoveryService;
	private readonly agentRegistry: AgentRegistry;
	private readonly outputChannel: OutputChannel;
	private readonly disposables: Disposable[] = [];
	private readonly executionStatusCache = new Map<
		string,
		HookExecutionStatusPayload
	>();
	private readonly pendingMessages: ExtensionMessage[] = [];
	private isWebviewReady = false;

	constructor(options: {
		context: ExtensionContext;
		hookManager: HookManager;
		hookExecutor: HookExecutor;
		mcpDiscoveryService: IMCPDiscoveryService;
		agentRegistry: AgentRegistry;
		outputChannel: OutputChannel;
	}) {
		this.context = options.context;
		this.hookManager = options.hookManager;
		this.hookExecutor = options.hookExecutor;
		this.mcpDiscoveryService = options.mcpDiscoveryService;
		this.agentRegistry = options.agentRegistry;
		this.outputChannel = options.outputChannel;
	}

	initialize(): void {
		this.disposables.push(
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
			}),
			this.agentRegistry.onAgentsChanged(() => {
				// Agent registry changed - notify webview to refresh agent list
				this.syncAgentsToWebview();
			})
		);
		this.outputChannel.appendLine("[HookViewProvider] Initialized");
	}

	dispose(): void {
		this.panel?.dispose();
		this.panel = undefined;
		this.isWebviewReady = false;
		while (this.disposables.length > 0) {
			this.disposables.pop()?.dispose();
		}
		this.outputChannel.appendLine("[HookViewProvider] Disposed");
	}

	private get webview(): Webview | undefined {
		return this.panel?.webview;
	}

	async syncHooksToWebview(): Promise<void> {
		const hooks = await this.hookManager.getAllHooks();
		await this.sendMessageToWebview({
			command: "hooks.sync",
			type: "hooks/sync",
			data: { hooks },
		} as HooksSyncMessage);
		this.outputChannel.appendLine(
			`[HookViewProvider] Synced ${hooks.length} hooks to webview`
		);
	}

	async syncAgentsToWebview(): Promise<void> {
		try {
			// Get agents grouped by type
			const grouped = this.agentRegistry.getAgentsGroupedByType();

			// Convert to simplified format for webview
			const local = grouped.local.map((agent) => ({
				id: agent.id,
				name: agent.name,
				displayName: agent.displayName,
				description: agent.description,
			}));

			const background = grouped.background.map((agent) => ({
				id: agent.id,
				name: agent.name,
				displayName: agent.displayName,
				description: agent.description,
			}));

			await this.sendMessageToWebview({
				command: "hooks.agents-list",
				type: "hooks/agents-list",
				data: { local, background },
			} as AgentListMessage);

			this.outputChannel.appendLine(
				`[HookViewProvider] Synced ${local.length} local agents and ${background.length} background agents to webview`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] Agent sync error: ${(error as Error).message}`
			);

			await this.sendMessageToWebview({
				command: "hooks.agents-error",
				type: "hooks/agents-error",
				data: {
					message: (error as Error).message || "Failed to load agents",
				},
			} as AgentErrorMessage);
		}
	}

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
					this.isWebviewReady = true;
					this.flushPendingMessages();
					this.flushExecutionStatuses();
					await this.syncHooksToWebview();
					break;
				case "hooks.mcp-discover":
					await this.handleMCPDiscovery(messageData?.forceRefresh ?? false);
					break;
				case "hooks.agents-list":
					await this.handleAgentListRequest(messageData?.forceRefresh ?? false);
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

	private async handleCreateHook(
		hookData: Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount">
	): Promise<void> {
		const hook = await this.hookManager.createHook(hookData);
		await this.sendMessageToWebview({
			command: "hooks.created",
			type: "hooks/created",
			data: { hook },
		} as HookCreatedMessage);
	}

	private async handleUpdateHook(
		hookId: string,
		updates: Partial<Hook>
	): Promise<void> {
		const hook = await this.hookManager.updateHook(hookId, updates);
		await this.sendMessageToWebview({
			command: "hooks.updated",
			type: "hooks/updated",
			data: { hook },
		} as HookUpdatedMessage);
	}

	private async handleDeleteHook(hookId: string): Promise<void> {
		await this.hookManager.deleteHook(hookId);
		await this.sendMessageToWebview({
			command: "hooks.deleted",
			type: "hooks/deleted",
			data: { id: hookId },
		} as HookDeletedMessage);
	}

	private async handleToggleHook(
		hookId: string,
		enabled: boolean
	): Promise<void> {
		const hook = await this.hookManager.updateHook(hookId, { enabled });
		await this.sendMessageToWebview({
			command: "hooks.updated",
			type: "hooks/updated",
			data: { hook },
		} as HookUpdatedMessage);
	}

	private async sendExecutionLogs(hookId?: string): Promise<void> {
		const logs = hookId
			? this.hookExecutor.getExecutionLogsForHook(hookId)
			: this.hookExecutor.getExecutionLogs();
		await this.sendMessageToWebview({
			command: "hooks.logs",
			type: "hooks/logs",
			data: { logs },
		} as ExecutionLogsMessage);
	}

	private async sendError(error: Error): Promise<void> {
		this.outputChannel.appendLine(
			`[HookViewProvider] Webview error: ${error.message}`
		);

		await this.sendMessageToWebview({
			command: "hooks.error",
			type: "hooks/error",
			data: {
				message: error.message,
				code: (error as any).code,
			},
		} as ErrorMessage);
	}

	private async handleMCPDiscovery(forceRefresh: boolean): Promise<void> {
		try {
			this.outputChannel.appendLine(
				`[HookViewProvider] MCP discovery requested (forceRefresh: ${forceRefresh})`
			);

			const servers =
				await this.mcpDiscoveryService.discoverServers(forceRefresh);

			await this.sendMessageToWebview({
				command: "hooks.mcp-servers",
				type: "hooks/mcp-servers",
				data: { servers },
			} as MCPServersMessage);

			this.outputChannel.appendLine(
				`[HookViewProvider] Sent ${servers.length} MCP servers to webview`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] MCP discovery error: ${(error as Error).message}`
			);

			await this.sendMessageToWebview({
				command: "hooks.mcp-error",
				type: "hooks/mcp-error",
				data: {
					message: (error as Error).message || "Failed to discover MCP servers",
				},
			} as MCPErrorMessage);
		}
	}

	private async handleAgentListRequest(forceRefresh: boolean): Promise<void> {
		try {
			this.outputChannel.appendLine(
				`[HookViewProvider] Agent list requested (forceRefresh: ${forceRefresh})`
			);

			const { promises: fs } = await import("node:fs");
			const { join } = await import("node:path");
			const matter = (await import("gray-matter")).default;
			const workspaceRoot =
				this.context.workspaceState.get<string>("workspaceRoot") || "";
			const agentsDir = join(workspaceRoot, ".github", "agents");

			const files = await fs.readdir(agentsDir).catch(() => []);
			const agentFiles = files.filter(
				(file) => file.endsWith(".agent.md") && !file.startsWith(".")
			);

			const agents = await Promise.all(
				agentFiles.map(async (filename) => {
					try {
						const filePath = join(agentsDir, filename);
						const content = await fs.readFile(filePath, "utf-8");
						const parsed = matter(content);
						const name = filename.replace(".agent.md", "");
						const description =
							typeof parsed.data.description === "string"
								? parsed.data.description
								: "No description available";
						return { id: `file:${name}`, name, displayName: name, description };
					} catch (error) {
						this.outputChannel.appendLine(
							`[HookViewProvider] Failed to parse ${filename}: ${(error as Error).message}`
						);
						return null;
					}
				})
			);

			const validAgents = agents.filter(
				(a): a is NonNullable<typeof a> => a !== null
			);

			await this.sendMessageToWebview({
				command: "hooks.agents-list",
				type: "hooks/agents-list",
				data: { local: validAgents, background: [] },
			} as AgentListMessage);

			this.outputChannel.appendLine(
				`[HookViewProvider] Sent ${validAgents.length} agents from .github/agents/ to webview`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] Agent list error: ${(error as Error).message}`
			);

			await this.sendMessageToWebview({
				command: "hooks.agents-error",
				type: "hooks/agents-error",
				data: {
					message: (error as Error).message || "Failed to load agents",
				},
			} as AgentErrorMessage);
		}
	}

	private handleExecutionStatus(payload: HookExecutionStatusPayload): void {
		if (!this.webview) {
			this.executionStatusCache.set(payload.hookId, payload);
			return;
		}

		this.webview.postMessage({
			command: "hooks.execution-status",
			type: "hooks/execution-status",
			data: payload,
		} as ExecutionStatusMessage);
	}

	private flushExecutionStatuses(): void {
		if (!this.webview) {
			return;
		}

		for (const payload of this.executionStatusCache.values()) {
			this.webview.postMessage({
				command: "hooks.execution-status",
				type: "hooks/execution-status",
				data: payload,
			} as ExecutionStatusMessage);
		}
	}

	private flushPendingMessages(): void {
		if (!(this.webview && this.isWebviewReady)) {
			return;
		}

		while (this.pendingMessages.length > 0) {
			const message = this.pendingMessages.shift();
			if (message) {
				this.webview.postMessage(message);
			}
		}
	}

	private async sendMessageToWebview(message: ExtensionMessage): Promise<void> {
		if (!(this.webview && this.isWebviewReady)) {
			this.pendingMessages.push(message);
			return;
		}

		await this.webview.postMessage(message);
	}

	async showCreateHookForm(): Promise<void> {
		await this.ensurePanel();
		await this.syncHooksToWebview();
		await this.sendMessageToWebview({
			command: "hooks.show-form",
			type: "hooks/show-form",
			data: { mode: "create" },
		} as ShowFormMessage);
	}

	async showEditHookForm(hook: Hook): Promise<void> {
		await this.ensurePanel();
		await this.syncHooksToWebview();
		await this.sendMessageToWebview({
			command: "hooks.show-form",
			type: "hooks/show-form",
			data: { mode: "edit", hook },
		} as ShowFormMessage);
	}

	async showLogsPanel(hookId?: string): Promise<void> {
		await this.ensurePanel();
		await this.syncHooksToWebview();
		await this.sendMessageToWebview({
			command: "hooks.show-logs",
			type: "hooks/show-logs",
			data: { visible: true, hookId },
		} as ShowLogsPanelMessage);
	}

	private ensurePanel(): void {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Active, false);
			return;
		}

		const panel = window.createWebviewPanel(
			HookViewProvider.panelType,
			"Hooks",
			{
				viewColumn: ViewColumn.Active,
				preserveFocus: false,
			},
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.context.extensionUri],
			}
		);

		this.isWebviewReady = false;
		panel.webview.html = this.getHtmlForWebview(panel.webview);
		panel.webview.onDidReceiveMessage(
			(message) => this.handleWebviewMessage(message),
			undefined,
			this.disposables
		);
		panel.onDidDispose(
			() => {
				this.panel = undefined;
				this.isWebviewReady = false;
				this.outputChannel.appendLine("[HookViewProvider] Panel disposed");
			},
			undefined,
			this.disposables
		);

		this.panel = panel;
		this.flushPendingMessages();
		this.flushExecutionStatuses();
		this.outputChannel.appendLine("[HookViewProvider] Panel created");
	}

	private getHtmlForWebview(webview: Webview): string {
		return getWebviewContent(webview, this.context.extensionUri, "hooks");
	}
}
