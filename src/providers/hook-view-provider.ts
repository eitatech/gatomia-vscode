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
import type { IModelCacheService } from "../features/hooks/services/model-cache-service";
import type { IAcpAgentDiscoveryService } from "../features/hooks/services/acp-agent-discovery-service";
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
	| AgentListRequestMessage
	| ModelRequestMessage
	| ACPAgentsRequestMessage;

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

interface ModelRequestMessage {
	command?: "hooks.models-request";
	type?: "hooks/models-request";
	data?: { forceRefresh?: boolean };
	payload?: { forceRefresh?: boolean };
}

interface ACPAgentsRequestMessage {
	command?: "hooks.acp-agents-request";
	type?: "hooks/acp-agents-request";
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

interface ModelsAvailableMessage {
	command: "hooks.models-available";
	type: "hooks/models-available";
	models: Array<{
		id: string;
		name: string;
		family: string;
		maxInputTokens: number;
	}>;
	isStale: boolean;
}

interface ModelsErrorMessage {
	command: "hooks.models-error";
	type: "hooks/models-error";
	message: string;
}

interface ACPAgentsAvailableMessage {
	command: "hooks.acp-agents-available";
	type: "hooks/acp-agents-available";
	agents: Array<{
		agentCommand: string;
		agentDisplayName: string;
		source: "workspace";
	}>;
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
	| ModelsAvailableMessage
	| ModelsErrorMessage
	| ACPAgentsAvailableMessage
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
	private readonly modelCacheService: IModelCacheService;
	private readonly acpAgentDiscoveryService: IAcpAgentDiscoveryService;
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
		modelCacheService: IModelCacheService;
		acpAgentDiscoveryService: IAcpAgentDiscoveryService;
		outputChannel: OutputChannel;
	}) {
		this.context = options.context;
		this.hookManager = options.hookManager;
		this.hookExecutor = options.hookExecutor;
		this.mcpDiscoveryService = options.mcpDiscoveryService;
		this.modelCacheService = options.modelCacheService;
		this.acpAgentDiscoveryService = options.acpAgentDiscoveryService;
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
				case "hooks.models-request":
					await this.handleModelsRequest(messageData?.forceRefresh ?? false);
					break;
				case "hooks.acp-agents-request":
					await this.handleACPAgentsRequest();
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
		await this.hookManager.createHook(hookData);
		// Hook list is automatically synced via onHooksChanged event
	}

	private async handleUpdateHook(
		hookId: string,
		updates: Partial<Hook>
	): Promise<void> {
		await this.hookManager.updateHook(hookId, updates);
		// Hook list is automatically synced via onHooksChanged event
	}

	private async handleDeleteHook(hookId: string): Promise<void> {
		await this.hookManager.deleteHook(hookId);
		// Hook list is automatically synced via onHooksChanged event
	}

	private async handleToggleHook(
		hookId: string,
		enabled: boolean
	): Promise<void> {
		await this.hookManager.updateHook(hookId, { enabled });
		// Hook list is automatically synced via onHooksChanged event
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

		// Extract validation errors if this is a HookValidationError
		const validationErrors =
			(error as any).errors &&
			Array.isArray((error as any).errors) &&
			(error as any).errors.length > 0
				? (error as any).errors
				: undefined;

		if (validationErrors) {
			this.outputChannel.appendLine(
				`[HookViewProvider] Validation errors: ${JSON.stringify(validationErrors)}`
			);
		}

		await this.sendMessageToWebview({
			command: "hooks.error",
			type: "hooks/error",
			data: {
				message: error.message,
				code: (error as any).code,
				validationErrors,
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
			const { workspace } = await import("vscode");

			const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceRoot) {
				throw new Error("No workspace folder found");
			}

			this.outputChannel.appendLine(
				`[HookViewProvider] Workspace root: ${workspaceRoot}`
			);

			const agentsDir = join(workspaceRoot, ".github", "agents");
			this.outputChannel.appendLine(
				`[HookViewProvider] Looking for agents in: ${agentsDir}`
			);

			const files = await fs.readdir(agentsDir).catch((err) => {
				this.outputChannel.appendLine(
					`[HookViewProvider] Error reading directory: ${err.message}`
				);
				return [];
			});

			this.outputChannel.appendLine(
				`[HookViewProvider] Found ${files.length} files in directory`
			);

			const agentFiles = files.filter(
				(file) => file.endsWith(".agent.md") && !file.startsWith(".")
			);

			this.outputChannel.appendLine(
				`[HookViewProvider] Filtered to ${agentFiles.length} .agent.md files`
			);

			const agents = await Promise.all(
				agentFiles.map(async (filename) => {
					try {
						const filePath = join(agentsDir, filename);
						const content = await fs.readFile(filePath, "utf-8");
						const parsed = matter(content);
						// Extract agent ID from frontmatter, fallback to filename
						const agentId =
							typeof parsed.data.id === "string"
								? parsed.data.id
								: filename.replace(".agent.md", "");
						const name = filename.replace(".agent.md", "");
						const description =
							typeof parsed.data.description === "string"
								? parsed.data.description
								: "No description available";
						// Use 'local:' prefix to match AgentRegistry convention (AGENT_ID_PREFIX.FILE = "local")
						return {
							id: `local:${agentId}`,
							name,
							displayName: name,
							description,
						};
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

			this.outputChannel.appendLine(
				`[HookViewProvider] Sending ${validAgents.length} agents to webview`
			);

			// Send directly to webview if available, bypassing ready check
			// This is needed because AgentDropdown mounts before hooks.ready is sent
			const message: AgentListMessage = {
				command: "hooks.agents-list",
				type: "hooks/agents-list",
				data: { local: validAgents, background: [] },
			};

			if (this.webview) {
				await this.webview.postMessage(message);
			} else {
				// If webview doesn't exist yet, queue it
				this.pendingMessages.push(message);
			}

			this.outputChannel.appendLine(
				`[HookViewProvider] Sent ${validAgents.length} agents from .github/agents/ to webview`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] Agent list error: ${(error as Error).message}`
			);
			this.outputChannel.appendLine(
				`[HookViewProvider] Stack: ${(error as Error).stack}`
			);

			// Send error directly to webview if available
			const errorMessage: AgentErrorMessage = {
				command: "hooks.agents-error",
				type: "hooks/agents-error",
				data: {
					message: (error as Error).message || "Failed to load agents",
				},
			};

			if (this.webview) {
				await this.webview.postMessage(errorMessage);
			} else {
				this.pendingMessages.push(errorMessage);
			}
		}
	}

	private async handleModelsRequest(forceRefresh: boolean): Promise<void> {
		try {
			this.outputChannel.appendLine(
				`[HookViewProvider] Models request (forceRefresh: ${forceRefresh})`
			);

			const result =
				await this.modelCacheService.getAvailableModels(forceRefresh);

			await this.sendMessageToWebview({
				command: "hooks.models-available",
				type: "hooks/models-available",
				models: result.models,
				isStale: result.isStale,
			} as ModelsAvailableMessage);

			this.outputChannel.appendLine(
				`[HookViewProvider] Sent ${result.models.length} models to webview (isStale: ${result.isStale})`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] Models request error: ${(error as Error).message}`
			);

			await this.sendMessageToWebview({
				command: "hooks.models-error",
				type: "hooks/models-error",
				message:
					(error as Error).message || "Failed to retrieve available models",
			} as ModelsErrorMessage);
		}
	}

	private async handleACPAgentsRequest(): Promise<void> {
		try {
			this.outputChannel.appendLine("[HookViewProvider] ACP agents request");
			const agents = await this.acpAgentDiscoveryService.discoverAgents();
			await this.sendMessageToWebview({
				command: "hooks.acp-agents-available",
				type: "hooks/acp-agents-available",
				agents,
			} as ACPAgentsAvailableMessage);
			this.outputChannel.appendLine(
				`[HookViewProvider] Sent ${agents.length} ACP agents to webview`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookViewProvider] ACP agents request error: ${(error as Error).message}`
			);
			// Send empty list on error — non-fatal
			await this.sendMessageToWebview({
				command: "hooks.acp-agents-available",
				type: "hooks/acp-agents-available",
				agents: [],
			} as ACPAgentsAvailableMessage);
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
		const panelExisted = !!this.panel;
		await this.ensurePanel();

		// Only sync if panel was just created (webview needs initial data)
		// If panel already existed, avoid sync to prevent race condition
		if (!panelExisted) {
			await this.syncHooksToWebview();
			// Wait for webview to be fully ready after panel creation
			if (!this.isWebviewReady) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		await this.sendMessageToWebview({
			command: "hooks.show-form",
			type: "hooks/show-form",
			data: { mode: "create" },
		} as ShowFormMessage);
	}

	async showEditHookForm(hook: Hook): Promise<void> {
		const panelExisted = !!this.panel;
		await this.ensurePanel();

		// Only sync if panel was just created (webview needs initial data)
		// If panel already existed, avoid sync to prevent race condition
		if (!panelExisted) {
			await this.syncHooksToWebview();
			// Wait for webview to be fully ready after panel creation
			if (!this.isWebviewReady) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		await this.sendMessageToWebview({
			command: "hooks.show-form",
			type: "hooks/show-form",
			data: { mode: "edit", hook },
		} as ShowFormMessage);
	}

	async showLogsPanel(hookId?: string): Promise<void> {
		const panelExisted = !!this.panel;
		await this.ensurePanel();

		// Only sync if panel was just created (webview needs initial data)
		// If panel already existed, avoid sync to prevent race condition
		if (!panelExisted) {
			await this.syncHooksToWebview();
			// Wait for webview to be fully ready after panel creation
			if (!this.isWebviewReady) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

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
