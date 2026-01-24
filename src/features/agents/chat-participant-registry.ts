/**
 * ChatParticipantRegistry
 * Registers agents as VS Code chat participants and handles tool execution
 * Enhanced with error rendering and telemetry (T061-T062)
 */

import {
	Uri,
	Disposable,
	chat,
	workspace,
	window,
	commands,
	type ChatParticipant,
	type ChatRequest,
	type ChatContext,
	type ChatResponseStream,
	type CancellationToken,
	type ChatResult,
	type OutputChannel,
} from "vscode";
import type {
	AgentDefinition,
	ToolExecutionContext,
	AgentResources,
	TelemetryReporter,
} from "./types";
import type { ToolRegistry } from "./tool-registry";
import type { ResourceCache } from "./resource-cache";
import {
	formatError,
	getErrorSeverity,
	type ErrorCategory,
} from "./error-formatter";

export class ChatParticipantRegistry {
	private readonly participants = new Map<string, ChatParticipant>();
	private readonly outputChannel: OutputChannel;
	private toolRegistry: ToolRegistry | null = null;
	private resourceCache: ResourceCache | null = null;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
	}

	/**
	 * Set tool registry for command execution
	 */
	setToolRegistry(registry: ToolRegistry): void {
		this.toolRegistry = registry;
		this.outputChannel.appendLine(
			"[ChatParticipantRegistry] Tool registry configured"
		);
	}

	/**
	 * Set resource cache for loading agent resources
	 */
	setResourceCache(cache: ResourceCache): void {
		this.resourceCache = cache;
		this.outputChannel.appendLine(
			"[ChatParticipantRegistry] Resource cache configured"
		);
	}

	/**
	 * Register an agent as a chat participant
	 * @param agent Agent definition to register
	 * @returns Disposable to unregister the participant
	 */
	registerAgent(agent: AgentDefinition): Disposable | null {
		try {
			// Check if VS Code Chat API is available
			if (!chat) {
				this.outputChannel.appendLine(
					`[ChatParticipantRegistry] VS Code Chat API not available. Skipping registration for agent: ${agent.id}`
				);
				return null;
			}

			// Check if already registered
			if (this.participants.has(agent.id)) {
				this.outputChannel.appendLine(
					`[ChatParticipantRegistry] Agent already registered: ${agent.id}`
				);
				return null;
			}

			this.outputChannel.appendLine(
				`[ChatParticipantRegistry] Registering agent: ${agent.id}`
			);

			// Create chat participant
			const participant = chat.createChatParticipant(
				agent.id,
				(
					request: ChatRequest,
					context: ChatContext,
					stream: ChatResponseStream,
					token: CancellationToken
				) => this.handleChatRequest({ agent, request, context, stream, token })
			);

			// Set participant metadata
			participant.iconPath = agent.icon ? Uri.file(agent.icon) : undefined;

			// Register commands as follow-ups
			participant.followupProvider = {
				provideFollowups: (
					result: ChatResult,
					context: ChatContext,
					token: CancellationToken
				) =>
					agent.commands.map((cmd) => ({
						prompt: `/${cmd.name}`,
						label: cmd.description,
						command: cmd.name,
					})),
			};

			// Store participant
			this.participants.set(agent.id, participant);

			this.outputChannel.appendLine(
				`[ChatParticipantRegistry] Successfully registered agent: ${agent.id} with ${agent.commands.length} commands`
			);

			// Return disposable to unregister
			return new Disposable(() => {
				participant.dispose();
				this.participants.delete(agent.id);
				this.outputChannel.appendLine(
					`[ChatParticipantRegistry] Unregistered agent: ${agent.id}`
				);
			});
		} catch (error) {
			this.outputChannel.appendLine(
				`[ChatParticipantRegistry] Error registering agent ${agent.id}: ${error}`
			);
			return null;
		}
	}

	/**
	 * Handle chat request for an agent
	 */
	private async handleChatRequest(options: {
		agent: AgentDefinition;
		request: ChatRequest;
		context: ChatContext;
		stream: ChatResponseStream;
		token: CancellationToken;
	}): Promise<void> {
		const { agent, request, context, stream, token } = options;
		try {
			// Parse command from request
			const commandName = request.command;

			if (!commandName) {
				stream.markdown(
					`Available commands for ${agent.name}:\n\n${agent.commands
						.map((cmd) => `- \`/${cmd.name}\`: ${cmd.description}`)
						.join("\n")}`
				);
				return;
			}

			// Find command
			const command = agent.commands.find((cmd) => cmd.name === commandName);

			if (!command) {
				stream.markdown(
					`Unknown command: \`/${commandName}\`. Available commands:\n\n${agent.commands
						.map((cmd) => `- \`/${cmd.name}\`: ${cmd.description}`)
						.join("\n")}`
				);
				return;
			}

			this.outputChannel.appendLine(
				`[ChatParticipantRegistry] Executing command: ${agent.id}/${commandName}`
			);

			// Check if tool registry is available
			if (!this.toolRegistry) {
				stream.markdown(
					"⚠️ Tool execution is not available. Tool registry not initialized."
				);
				return;
			}

			// Show progress
			stream.progress(`Executing /${commandName}...`);

			// Build execution context
			const executionContext = this.buildExecutionContext(agent, context);

			// Load agent resources
			const resources = this.loadAgentResources(agent);

			// Execute tool
			const startTime = Date.now();
			try {
				const response = await this.toolRegistry.execute(command.tool, {
					input: request.prompt,
					context: executionContext,
					resources,
					token,
				});

				const duration = Date.now() - startTime;

				// Render response
				this.renderResponse(stream, response);

				// Send telemetry
				context.telemetry.sendTelemetryEvent(
					"agent.tool.executed",
					{
						agentId: agent.id,
						commandName,
						toolName: command.tool,
						success: "true",
					},
					{
						duration,
					}
				);

				this.outputChannel.appendLine(
					`[ChatParticipantRegistry] Tool '${command.tool}' completed in ${duration}ms`
				);
			} catch (error) {
				const duration = Date.now() - startTime;

				// T061 - Render error with actionable guidance
				// T062 - Send error telemetry with classification
				this.handleToolExecutionError(error, stream, context.telemetry, {
					agentId: agent.id,
					commandName,
					toolName: command.tool,
					duration,
				});
			}
		} catch (error) {
			this.outputChannel.appendLine(
				`[ChatParticipantRegistry] Error handling request for ${agent.id}: ${error}`
			);
			stream.markdown(`Error: ${error}`);
		}
	}

	/**
	 * Build execution context for tool handlers
	 */
	private buildExecutionContext(
		agent: AgentDefinition,
		chatContext: ChatContext
	): ToolExecutionContext {
		const workspaceFolders = workspace.workspaceFolders || [];
		const workspaceUri = workspaceFolders[0]?.uri || Uri.file(process.cwd());
		const workspaceName = workspaceFolders[0]?.name || "Workspace";

		return {
			agent,
			workspace: {
				uri: workspaceUri,
				name: workspaceName,
				folders: workspaceFolders,
			},
			vscode: {
				window,
				workspace,
				commands,
			},
			chatContext,
			outputChannel: this.outputChannel,
			telemetry: {
				sendTelemetryEvent: (eventName, properties, measurements) => {
					this.outputChannel.appendLine(
						`[Telemetry] ${eventName} ${JSON.stringify({ properties, measurements })}`
					);
				},
				sendTelemetryErrorEvent: (eventName, properties, measurements) => {
					this.outputChannel.appendLine(
						`[Telemetry Error] ${eventName} ${JSON.stringify({ properties, measurements })}`
					);
				},
			},
		};
	}

	/**
	 * T061 - Handle tool execution errors with user-friendly rendering
	 * T062 - Send detailed error telemetry with classification
	 */
	private handleToolExecutionError(
		error: unknown,
		stream: ChatResponseStream,
		telemetry: TelemetryReporter,
		context: {
			agentId: string;
			commandName: string;
			toolName: string;
			duration: number;
		}
	): void {
		const err = error instanceof Error ? error : new Error(String(error));

		// Format error for display and logging
		const formatted = formatError(err, {
			agent: context.agentId,
			tool: context.toolName,
		});

		// T061 - Render user-friendly error message with actionable guidance
		stream.markdown(`## ❌ Command Failed\n\n${formatted.userMessage}`);

		if (formatted.actionableGuidance) {
			stream.markdown(
				`\n\n**What you can do:**\n${formatted.actionableGuidance}`
			);
		}

		stream.markdown(
			`\n\n<details>\n<summary>Technical Details</summary>\n\n\`\`\`\n${formatted.technicalDetails}\n\`\`\`\n</details>`
		);

		// T062 - Send error telemetry with classification
		telemetry.sendTelemetryErrorEvent(
			"agent.tool.failed",
			{
				agentId: context.agentId,
				commandName: context.commandName,
				toolName: context.toolName,
				errorType: err.name,
				errorCategory: formatted.category,
				errorCode: formatted.code || "none",
			},
			{
				duration: context.duration,
			}
		);

		// Log with appropriate severity
		const severity = getErrorSeverity(formatted.category as ErrorCategory);
		const logPrefix = `[ChatParticipantRegistry] ${severity.toUpperCase()}`;

		this.outputChannel.appendLine(
			`${logPrefix}: Tool '${context.toolName}' failed after ${context.duration}ms`
		);
		this.outputChannel.appendLine(
			`${logPrefix}: ${formatted.technicalDetails}`
		);

		if (err.stack) {
			this.outputChannel.appendLine(`${logPrefix}: Stack trace:\n${err.stack}`);
		}
	}

	/**
	 * Load agent-specific resources from cache
	 */
	private loadAgentResources(agent: AgentDefinition): AgentResources {
		const resources: AgentResources = {
			prompts: new Map(),
			skills: new Map(),
			instructions: new Map(),
		};

		if (!this.resourceCache) {
			this.outputChannel.appendLine(
				"[ChatParticipantRegistry] Resource cache not available, returning empty resources"
			);
			return resources;
		}

		// Load prompts
		this.loadResourcesByType(
			agent.resources.prompts || [],
			"prompt",
			resources.prompts
		);

		// Load skills
		this.loadResourcesByType(
			agent.resources.skills || [],
			"skill",
			resources.skills
		);

		// Load instructions
		this.loadResourcesByType(
			agent.resources.instructions || [],
			"instruction",
			resources.instructions
		);

		this.outputChannel.appendLine(
			`[ChatParticipantRegistry] Loaded resources for ${agent.id}: ${resources.prompts.size} prompts, ${resources.skills.size} skills, ${resources.instructions.size} instructions`
		);

		return resources;
	}

	/**
	 * Load resources by type from cache
	 */
	private loadResourcesByType(
		resourceNames: string[],
		type: "prompt" | "skill" | "instruction",
		targetMap: Map<string, string>
	): void {
		if (!this.resourceCache) {
			return;
		}

		for (const name of resourceNames) {
			const content = this.resourceCache.get(type, name);
			if (content) {
				targetMap.set(name, content);
			}
		}
	}

	/**
	 * Render tool response in chat stream
	 */
	private renderResponse(
		stream: ChatResponseStream,
		response: {
			content: string;
			files?: Array<{
				uri: Uri;
				label?: string;
				action?: "created" | "modified" | "deleted";
			}>;
			metadata?: Record<string, unknown>;
		}
	): void {
		// Render markdown content
		stream.markdown(response.content);

		// Render file references
		if (response.files && response.files.length > 0) {
			stream.markdown("\n\n**Files:**\n");
			for (const file of response.files) {
				const action = file.action ? `[${file.action}]` : "";
				const label = file.label || file.uri.fsPath.split("/").pop() || "file";
				stream.markdown(`- ${action} [${label}](${file.uri.toString()})\n`);
			}
		}
	}

	/**
	 * Get all registered participant IDs
	 */
	getRegisteredAgents(): string[] {
		return Array.from(this.participants.keys());
	}

	/**
	 * Check if an agent is registered
	 */
	isRegistered(agentId: string): boolean {
		return this.participants.has(agentId);
	}

	/**
	 * Dispose all participants
	 */
	dispose(): void {
		for (const participant of this.participants.values()) {
			participant.dispose();
		}
		this.participants.clear();
		this.outputChannel.appendLine(
			"[ChatParticipantRegistry] Disposed all participants"
		);
	}
}
