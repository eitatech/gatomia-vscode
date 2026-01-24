/**
 * AgentService
 * Coordinates agent operations: discovery, registration, and lifecycle management
 */

import {
	Uri,
	workspace,
	type Disposable,
	type OutputChannel,
	chat,
} from "vscode";
import { AgentLoader } from "../features/agents/agent-loader";
import { ChatParticipantRegistry } from "../features/agents/chat-participant-registry";
import { ResourceCache } from "../features/agents/resource-cache";
import { FileWatcher } from "../features/agents/file-watcher";
import { ToolRegistry } from "../features/agents/tool-registry";
import { helpHandler } from "../features/agents/tools/help-handler";
import type { AgentDefinition } from "../features/agents/types";
import { ConfigurationService } from "./configuration-service";

export class AgentService {
	private readonly loader: AgentLoader;
	private readonly registry: ChatParticipantRegistry;
	private readonly resourceCache: ResourceCache;
	private readonly toolRegistry: ToolRegistry;
	private readonly configService: ConfigurationService;
	private readonly outputChannel: OutputChannel;
	private disposables: Disposable[] = [];
	private agents: AgentDefinition[] = [];
	private fileWatcher: FileWatcher | null = null;
	private extensionPath = "";

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
		this.loader = new AgentLoader(outputChannel);
		this.registry = new ChatParticipantRegistry(outputChannel);
		this.resourceCache = new ResourceCache(outputChannel);
		this.toolRegistry = new ToolRegistry(outputChannel);
		this.configService = new ConfigurationService();
	}

	/**
	 * Initialize the agent service
	 * Discovers and registers all agents, loads resources, and sets up file watching
	 */
	async initialize(extensionPath: string): Promise<void> {
		try {
			this.extensionPath = extensionPath;
			this.outputChannel.appendLine("[AgentService] Initializing...");

			// Log configuration
			const config = this.configService.getConfiguration();
			this.outputChannel.appendLine(
				`[AgentService] Configuration: resourcesPath=${config.resourcesPath}, enableHotReload=${config.enableHotReload}, logLevel=${config.logLevel}`
			);

			// Check if GitHub Copilot Chat is available
			if (!chat) {
				this.outputChannel.appendLine(
					"[AgentService] GitHub Copilot Chat API not available. Agent registration skipped."
				);
				this.outputChannel.appendLine(
					"[AgentService] Please ensure GitHub Copilot extension is installed and enabled."
				);
				return;
			}

			// Discover agents from resources/agents directory using configured resources path
			const agentsDir = Uri.joinPath(
				Uri.file(extensionPath),
				config.resourcesPath,
				"agents"
			).fsPath;

			this.outputChannel.appendLine(
				`[AgentService] Loading agents from: ${agentsDir}`
			);

			const startTime = Date.now();
			this.agents = await this.loader.loadAgents(agentsDir);
			const loadDuration = Date.now() - startTime;

			this.outputChannel.appendLine(
				`[AgentService] Loaded ${this.agents.length} agents in ${loadDuration}ms`
			);

			// Register each agent as a chat participant
			let successCount = 0;
			let failCount = 0;

			for (const agent of this.agents) {
				const disposable = this.registry.registerAgent(agent);

				if (disposable) {
					this.disposables.push(disposable);
					successCount += 1;
				} else {
					failCount += 1;
				}
			}

			this.outputChannel.appendLine(
				`[AgentService] Registration complete: ${successCount} succeeded, ${failCount} failed`
			);

			// Wire up tool registry and resource cache to chat registry
			this.registry.setToolRegistry(this.toolRegistry);
			this.registry.setResourceCache(this.resourceCache);

			// T067 - Register built-in help handler
			this.toolRegistry.register("agent.help", helpHandler);
			this.outputChannel.appendLine(
				"[AgentService] Registered built-in help handler"
			);

			// Load resources (prompts, skills, instructions)
			const resourcesDir = Uri.joinPath(
				Uri.file(extensionPath),
				config.resourcesPath
			).fsPath;

			this.outputChannel.appendLine(
				`[AgentService] Loading resources from: ${resourcesDir}`
			);

			const resourceLoadStart = Date.now();
			await this.resourceCache.load(resourcesDir);
			const resourceLoadDuration = Date.now() - resourceLoadStart;

			const totalResources =
				this.resourceCache.prompts.size +
				this.resourceCache.skills.size +
				this.resourceCache.instructions.size;

			this.outputChannel.appendLine(
				`[AgentService] Loaded ${totalResources} resources in ${resourceLoadDuration}ms`
			);

			// Set up file watcher for hot-reload (only if enabled)
			if (config.enableHotReload) {
				const watchPattern = `${resourcesDir}/**/*.{md,prompt.md,skill.md,instructions.md}`;
				const fsWatcher = workspace.createFileSystemWatcher(watchPattern);

				this.fileWatcher = new FileWatcher(
					this.outputChannel,
					fsWatcher,
					async (changedFiles: string[]) => {
						await this.resourceCache.reload(changedFiles);
						this.sendTelemetry("agent.resources.reloaded", {
							fileCount: changedFiles.length,
						});
					}
				);

				this.disposables.push(this.fileWatcher);
				this.outputChannel.appendLine(
					"[AgentService] File watcher initialized"
				);
			} else {
				this.outputChannel.appendLine(
					"[AgentService] Hot-reload disabled via configuration"
				);
			}

			// Wire up configuration change listener
			const configChangeDisposable = workspace.onDidChangeConfiguration(
				(event) => this.handleConfigurationChange(event)
			);
			this.disposables.push(configChangeDisposable);

			// Send telemetry
			this.sendTelemetry("agent.service.initialized", {
				agentCount: this.agents.length,
				successCount,
				failCount,
				loadDuration,
				resourceCount: totalResources,
				resourceLoadDuration,
			});

			this.outputChannel.appendLine("[AgentService] Initialization complete");
		} catch (error) {
			this.outputChannel.appendLine(
				`[AgentService] Initialization failed: ${error}`
			);

			// Send error telemetry
			this.sendTelemetry("agent.service.initialization.failed", {
				error: String(error),
			});

			throw error;
		}
	}

	/**
	 * Handle configuration changes
	 */
	private handleConfigurationChange(event: any): void {
		if (event.affectsConfiguration("gatomia.agents")) {
			this.outputChannel.appendLine(
				"[AgentService] Agent settings changed, reloading configuration..."
			);

			const oldConfig = this.configService.getConfiguration();
			const newConfig = this.configService.reloadConfiguration();

			// Check if resources path changed
			if (oldConfig.resourcesPath !== newConfig.resourcesPath) {
				this.outputChannel.appendLine(
					`[AgentService] Resources path changed: ${oldConfig.resourcesPath} -> ${newConfig.resourcesPath}`
				);
				this.sendTelemetry("agent.config.resourcesPath.changed", {
					oldPath: oldConfig.resourcesPath,
					newPath: newConfig.resourcesPath,
				});
			}

			// Check if hot-reload setting changed
			if (oldConfig.enableHotReload !== newConfig.enableHotReload) {
				this.outputChannel.appendLine(
					`[AgentService] Hot-reload setting changed: ${oldConfig.enableHotReload} -> ${newConfig.enableHotReload}`
				);
				this.sendTelemetry("agent.config.hotReload.changed", {
					enabled: newConfig.enableHotReload,
				});
			}

			// Check if log level changed
			if (oldConfig.logLevel !== newConfig.logLevel) {
				this.outputChannel.appendLine(
					`[AgentService] Log level changed: ${oldConfig.logLevel} -> ${newConfig.logLevel}`
				);
				this.sendTelemetry("agent.config.logLevel.changed", {
					oldLevel: oldConfig.logLevel,
					newLevel: newConfig.logLevel,
				});
			}

			// Send general configuration change telemetry
			this.sendTelemetry("agent.configuration.changed", {
				resourcesPath: newConfig.resourcesPath,
				enableHotReload: newConfig.enableHotReload,
				logLevel: newConfig.logLevel,
			});
		}
	}

	/**
	 * Reload agent configuration and resources
	 * Called when configuration changes
	 */
	async reload(): Promise<void> {
		try {
			this.outputChannel.appendLine("[AgentService] Reloading agents...");

			// Reload configuration
			const config = this.configService.reloadConfiguration();

			// Reload resources if path exists
			const resourcesDir = Uri.joinPath(
				Uri.file(this.extensionPath),
				config.resourcesPath
			).fsPath;

			const resourceLoadStart = Date.now();
			await this.resourceCache.load(resourcesDir);
			const resourceLoadDuration = Date.now() - resourceLoadStart;

			this.outputChannel.appendLine(
				`[AgentService] Resources reloaded in ${resourceLoadDuration}ms`
			);

			this.sendTelemetry("agent.service.reloaded", {
				resourceLoadDuration,
			});
		} catch (error) {
			this.outputChannel.appendLine(`[AgentService] Reload failed: ${error}`);
			this.sendTelemetry("agent.service.reload.failed", {
				error: String(error),
			});
		}
	}

	/**
	 * Get the resource cache instance
	 */
	getResourceCache(): ResourceCache {
		return this.resourceCache;
	}

	/**
	 * Get the tool registry instance
	 */
	getToolRegistry(): ToolRegistry {
		return this.toolRegistry;
	}

	/**
	 * Get all loaded agents
	 */
	getAgents(): AgentDefinition[] {
		return [...this.agents];
	}

	/**
	 * Get registered agent IDs
	 */
	getRegisteredAgentIds(): string[] {
		return this.registry.getRegisteredAgents();
	}

	/**
	 * Check if an agent is registered
	 */
	isAgentRegistered(agentId: string): boolean {
		return this.registry.isRegistered(agentId);
	}

	/**
	 * Send telemetry event
	 */
	private sendTelemetry(
		eventName: string,
		properties?: Record<string, any>
	): void {
		try {
			// In production, this would send to a telemetry service
			// For now, just log to output channel
			this.outputChannel.appendLine(
				`[AgentService] Telemetry: ${eventName} ${JSON.stringify(properties || {})}`
			);
		} catch (error) {
			// Silently fail telemetry
		}
	}

	/**
	 * Dispose the service and cleanup resources
	 */
	dispose(): void {
		this.outputChannel.appendLine("[AgentService] Disposing...");

		// Dispose all registered participants and watchers
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];

		// Dispose registry
		this.registry.dispose();

		// Dispose resource cache
		this.resourceCache.dispose();

		// Clear agents
		this.agents = [];

		this.outputChannel.appendLine("[AgentService] Disposed");
	}
}
