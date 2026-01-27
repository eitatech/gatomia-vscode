import {
	EventEmitter,
	type Event,
	type OutputChannel,
	extensions,
	window,
	commands,
} from "vscode";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { HookManager } from "./hook-manager";
import type { TriggerRegistry } from "./trigger-registry";
import type { AgentRegistry } from "./agent-registry";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { AgentActionExecutor } from "./actions/agent-action";
import { GitActionExecutor } from "./actions/git-action";
import { GitHubActionExecutor } from "./actions/github-action";
import { MCPActionExecutor } from "./actions/mcp-action";
import { MCPClientService } from "./services/mcp-client";
import { MCPParameterResolver } from "./services/mcp-parameter-resolver";
import { MCPExecutionPool } from "./services/mcp-execution-pool";
import type { IMCPDiscoveryService } from "./services/mcp-contracts";
import {
	TemplateVariableParser,
	type TemplateContext as ParserTemplateContext,
} from "./template-variable-parser";
import type {
	Hook,
	ExecutionContext,
	HookExecutionLog,
	AgentActionParams,
	GitActionParams,
	GitHubActionParams,
	MCPActionParams,
	CustomActionParams,
	OperationType,
} from "./types";
import {
	MAX_CHAIN_DEPTH,
	MAX_EXECUTION_LOGS,
	ACTION_TIMEOUT_MS,
} from "./types";

/**
 * Regex pattern for extracting feature name from branch (NNN-feature-name)
 */
const FEATURE_NAME_PATTERN = /^\d+-(.+)$/;

/**
 * ExecutionStatus - Status of hook execution
 */
export type ExecutionStatus = "success" | "failure" | "skipped" | "timeout";

/**
 * ExecutionError - Error during hook execution
 */
export interface ExecutionError {
	message: string;
	code: string;
	details?: unknown;
}

/**
 * ExecutionResult - Result of hook execution
 */
export interface ExecutionResult {
	hookId: string;
	hookName: string;
	status: ExecutionStatus;
	duration?: number;
	error?: ExecutionError;
}

/**
 * ExecutionEvent - Event emitted during hook execution
 */
export interface ExecutionEvent {
	hook: Hook;
	context: ExecutionContext;
	result?: ExecutionResult;
}

/**
 * Custom error classes
 */
export class CircularDependencyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CircularDependencyError";
	}
}

export class MaxDepthExceededError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MaxDepthExceededError";
	}
}

export class ExecutionTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ExecutionTimeoutError";
	}
}

/**
 * HookExecutor - Core hook execution engine
 *
 * Executes hooks when triggered, manages execution context,
 * prevents circular dependencies, and logs execution history.
 */
export class HookExecutor {
	private readonly hookManager: HookManager;
	private readonly triggerRegistry: TriggerRegistry;
	private readonly agentRegistry: AgentRegistry;
	private readonly outputChannel: OutputChannel;
	private readonly agentExecutor: AgentActionExecutor;
	private readonly gitExecutor: GitActionExecutor;
	private readonly githubExecutor: GitHubActionExecutor;
	private readonly mcpExecutor: MCPActionExecutor;
	private readonly templateParser: TemplateVariableParser;
	private executionLogs: HookExecutionLog[] = [];

	// Event emitters
	private readonly _onExecutionStarted = new EventEmitter<ExecutionEvent>();
	private readonly _onExecutionCompleted = new EventEmitter<ExecutionEvent>();
	private readonly _onExecutionFailed = new EventEmitter<ExecutionEvent>();

	// Public events
	readonly onExecutionStarted: Event<ExecutionEvent> =
		this._onExecutionStarted.event;
	readonly onExecutionCompleted: Event<ExecutionEvent> =
		this._onExecutionCompleted.event;
	readonly onExecutionFailed: Event<ExecutionEvent> =
		this._onExecutionFailed.event;

	// biome-ignore lint/nursery/useMaxParams: Dependency injection pattern requires multiple constructor parameters
	constructor(
		hookManager: HookManager,
		triggerRegistry: TriggerRegistry,
		outputChannel: OutputChannel,
		mcpDiscoveryService: IMCPDiscoveryService,
		agentRegistry: AgentRegistry
	) {
		this.hookManager = hookManager;
		this.triggerRegistry = triggerRegistry;
		this.outputChannel = outputChannel;
		this.agentRegistry = agentRegistry;
		this.agentExecutor = new AgentActionExecutor();
		this.gitExecutor = new GitActionExecutor();
		this.githubExecutor = new GitHubActionExecutor();
		this.templateParser = new TemplateVariableParser();

		// Initialize MCP executor with all required services
		const clientService = new MCPClientService(mcpDiscoveryService);
		const parameterResolver = new MCPParameterResolver();
		const executionPool = new MCPExecutionPool(5); // Concurrency limit of 5

		this.mcpExecutor = new MCPActionExecutor({
			discoveryService: mcpDiscoveryService,
			clientService,
			parameterResolver,
			executionPool,
			logger: outputChannel,
		});
	}

	/**
	 * Initialize the hook executor
	 * Subscribes to trigger events
	 */
	initialize(): void {
		// Subscribe to trigger events
		this.triggerRegistry.onTrigger(async (event) => {
			await this.executeHooksForTrigger(event.agent, event.operation);
		});

		this.outputChannel.appendLine("[HookExecutor] Initialized");
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		this._onExecutionStarted.dispose();
		this._onExecutionCompleted.dispose();
		this._onExecutionFailed.dispose();
		this.outputChannel.appendLine("[HookExecutor] Disposed");
	}

	/**
	 * Execute a single hook
	 * T087: Prevent execution of invalid hooks
	 */
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The hook pipeline coordinates validation, execution, logging, and retries within a single flow.
	async executeHook(
		hook: Hook,
		context?: ExecutionContext
	): Promise<ExecutionResult> {
		const startTime = Date.now();

		// Check if hook is enabled
		if (!hook.enabled) {
			this.outputChannel.appendLine(
				`[HookExecutor] Skipping disabled hook: ${hook.name} (${hook.id})`
			);

			return {
				hookId: hook.id,
				hookName: hook.name,
				status: "skipped",
				duration: Date.now() - startTime,
			};
		}

		// T087: Validate MCP hooks before execution
		if (hook.action.type === "mcp") {
			try {
				const validation = await this.hookManager.validateHook(hook);
				if (!validation.valid) {
					const errorMessages = validation.errors
						.map((e) => `${e.field}: ${e.message}`)
						.join(", ");

					this.outputChannel.appendLine(
						`[HookExecutor] Skipping invalid MCP hook: ${hook.name} - ${errorMessages}`
					);

					// T088-T089: Show error notification with actions
					const mcpParams = hook.action.parameters as MCPActionParams;
					const action = await window.showErrorMessage(
						`Hook "${hook.name}" has invalid MCP configuration: ${validation.errors[0]?.message ?? "Unknown error"}`,
						"Update Hook",
						"Remove Hook",
						"Cancel"
					);

					if (action === "Update Hook") {
						// Trigger hook edit (command will be implemented in hook view)
						await commands.executeCommand("gatomia.hooks.editHook", hook.id);
					} else if (action === "Remove Hook") {
						await this.hookManager.deleteHook(hook.id);
						window.showInformationMessage(`Hook "${hook.name}" removed`);
					}

					return {
						hookId: hook.id,
						hookName: hook.name,
						status: "skipped",
						duration: Date.now() - startTime,
						error: {
							message: errorMessages,
							code: "InvalidMCPConfiguration",
						},
					};
				}
			} catch (error) {
				// Graceful degradation - log error and continue
				const err = error as Error;
				this.outputChannel.appendLine(
					`[HookExecutor] Warning: Failed to validate MCP hook: ${err.message}`
				);
			}
		}

		// T081: Check agent availability before execution for custom hooks
		if (hook.action.type === "custom") {
			const customParams = hook.action.parameters as CustomActionParams;
			const agentId = customParams.agentId || customParams.agentName;

			if (agentId && this.agentRegistry) {
				try {
					// Check agent availability
					const availability =
						await this.agentRegistry.checkAgentAvailability(agentId);

					if (!availability.available) {
						// Determine reason text
						let reasonText: string;
						if (availability.reason === "FILE_DELETED") {
							reasonText = "agent file was deleted";
						} else if (availability.reason === "EXTENSION_UNINSTALLED") {
							reasonText = "extension is uninstalled";
						} else {
							reasonText = "agent is unavailable";
						}

						const errorMessage = `Agent "${agentId}" is not available: ${reasonText}`;

						// T082: Log detailed error information
						this.outputChannel.appendLine(
							`[HookExecutor] Agent unavailable - Hook: ${hook.name} (${hook.id})`
						);
						this.outputChannel.appendLine(
							`[HookExecutor] Agent ID: ${agentId}, Reason: ${availability.reason}`
						);
						this.outputChannel.appendLine(
							`[HookExecutor] Trigger: ${hook.trigger.agent}.${hook.trigger.operation} (${hook.trigger.timing})`
						);

						// Emit execution failed event
						const errorResult: ExecutionResult = {
							hookId: hook.id,
							hookName: hook.name,
							status: "failure",
							duration: Date.now() - startTime,
							error: {
								message: errorMessage,
								code: "AgentUnavailable",
								details: {
									agentId,
									reason: availability.reason,
									checkedAt: availability.checkedAt,
								},
							},
						};

						this._onExecutionFailed.fire({
							hook,
							context: context || this.createExecutionContext(),
							result: errorResult,
						});

						// Show error notification with retry option
						const action = await window.showErrorMessage(
							`Hook "${hook.name}" failed: ${errorMessage}`,
							"Retry",
							"Update Hook",
							"Cancel"
						);

						if (action === "Retry") {
							// Retry execution
							return await this.executeHook(hook, context);
						}
						if (action === "Update Hook") {
							await commands.executeCommand("gatomia.hooks.editHook", hook.id);
						}

						return errorResult;
					}
				} catch (error) {
					// Graceful degradation - log error and continue
					const err = error as Error;
					this.outputChannel.appendLine(
						`[HookExecutor] Warning: Failed to check agent availability: ${err.message}`
					);
				}
			}
		}

		// Create or use existing context
		const execContext = context || this.createExecutionContext();

		try {
			// Check for circular dependency
			if (this.isCircularDependency(hook.id, execContext)) {
				throw new CircularDependencyError(
					`Circular dependency detected: ${hook.name}`
				);
			}

			// Check max depth
			if (this.isMaxDepthExceeded(execContext)) {
				throw new MaxDepthExceededError(
					`Maximum chain depth (${MAX_CHAIN_DEPTH}) exceeded`
				);
			}

			// Add hook to executed set
			execContext.executedHooks.add(hook.id);
			execContext.chainDepth += 1;

			// Build template context
			// Extract trigger type from hook's trigger configuration
			const templateContext = await this.buildTemplateContext(
				hook.trigger.operation
			);

			// Emit execution started event
			this._onExecutionStarted.fire({
				hook,
				context: execContext,
			});

			this.outputChannel.appendLine(
				`[HookExecutor] Executing hook: ${hook.name} (${hook.id})`
			);

			// Execute action based on type
			let actionResult: { success: boolean; error?: Error };

			// T074: Add detailed logging for MCP actions
			if (hook.action.type === "mcp") {
				const mcpParams = hook.action.parameters as MCPActionParams;
				this.outputChannel.appendLine(
					`[HookExecutor] MCP Action: ${mcpParams.serverId}/${mcpParams.toolName}`
				);
			}

			switch (hook.action.type) {
				case "agent": {
					// Expand templates in command
					const agentParams = hook.action.parameters as AgentActionParams;
					const command = this.expandTemplate(
						agentParams.command,
						templateContext
					);

					// Execute with timeout
					actionResult = await this.executeWithTimeout(
						() =>
							this.agentExecutor.execute({
								command,
							}),
						ACTION_TIMEOUT_MS
					);
					break;
				}
				case "git": {
					const gitParams = hook.action.parameters as GitActionParams;
					actionResult = await this.executeWithTimeout(
						() => this.gitExecutor.execute(gitParams, templateContext),
						ACTION_TIMEOUT_MS
					);
					break;
				}
				case "github": {
					const githubParams = hook.action.parameters as GitHubActionParams;
					actionResult = await this.executeWithTimeout(
						() => this.githubExecutor.execute(githubParams, templateContext),
						ACTION_TIMEOUT_MS
					);
					break;
				}
				case "mcp": {
					const mcpParams = hook.action.parameters as MCPActionParams;
					actionResult = await this.executeWithTimeout(
						() => this.mcpExecutor.execute(mcpParams, templateContext),
						ACTION_TIMEOUT_MS
					);
					break;
				}
				case "custom": {
					const customParams = hook.action.parameters as CustomActionParams;

					// Determine agent type (override or default from registry)
					let agentType = customParams.agentType;
					if (!agentType && customParams.agentId) {
						const agent = this.agentRegistry.getAgentById(customParams.agentId);
						agentType = agent?.type;
					}

					this.outputChannel.appendLine(
						`[HookExecutor] Custom action - Agent type: ${agentType || "unknown"}`
					);

					// Route based on agent type
					if (agentType === "local") {
						actionResult = await this.executeWithTimeout(
							() => this.executeLocalAgent(customParams, templateContext),
							ACTION_TIMEOUT_MS
						);
					} else if (agentType === "background") {
						actionResult = await this.executeWithTimeout(
							() => this.executeBackgroundAgent(customParams, templateContext),
							ACTION_TIMEOUT_MS
						);
					} else {
						throw new Error(
							`Unknown agent type: ${agentType}. Agent ID: ${customParams.agentId}`
						);
					}
					break;
				}

				default:
					throw new Error(`Unsupported action type: ${hook.action.type}`);
			}

			const duration = Date.now() - startTime;

			// Create execution result
			const result: ExecutionResult = {
				hookId: hook.id,
				hookName: hook.name,
				status: actionResult.success ? "success" : "failure",
				duration,
				error: actionResult.error
					? {
							message: actionResult.error.message,
							code: actionResult.error.name || "UnknownError",
							details: actionResult.error,
						}
					: undefined,
			};

			// Record execution log
			this.recordExecutionLog({
				id: randomUUID(),
				hookId: hook.id,
				executionId: execContext.executionId,
				chainDepth: execContext.chainDepth,
				triggeredAt: startTime,
				completedAt: Date.now(),
				duration,
				status: result.status,
				error: result.error,
				contextSnapshot: templateContext,
			});

			// Emit appropriate event
			if (result.status === "success") {
				this._onExecutionCompleted.fire({
					hook,
					context: execContext,
					result,
				});

				// T076: Show success notification for MCP actions
				if (hook.action.type === "mcp") {
					const mcpParams = hook.action.parameters as MCPActionParams;
					window.showInformationMessage(
						`MCP Tool "${mcpParams.toolName}" executed successfully (${duration}ms)`
					);
				}

				this.outputChannel.appendLine(
					`[HookExecutor] ✓ Hook execution success: ${hook.name} (${duration}ms)`
				);
			} else {
				// T084: Enhanced failure logging with full context
				this.outputChannel.appendLine(
					"[HookExecutor] ==================== HOOK EXECUTION FAILURE ===================="
				);
				this.outputChannel.appendLine(
					`[HookExecutor] Hook: ${hook.name} (${hook.id})`
				);
				this.outputChannel.appendLine(
					`[HookExecutor] Trigger: ${hook.trigger.agent}.${hook.trigger.operation} (${hook.trigger.timing})`
				);
				this.outputChannel.appendLine(
					`[HookExecutor] Action Type: ${hook.action.type}`
				);

				// Add action-specific context
				if (hook.action.type === "custom") {
					const customParams = hook.action.parameters as CustomActionParams;
					this.outputChannel.appendLine(
						`[HookExecutor] Agent ID: ${customParams.agentId || customParams.agentName || "unknown"}`
					);
					this.outputChannel.appendLine(
						`[HookExecutor] Agent Type: ${customParams.agentType || "unknown"}`
					);
				} else if (hook.action.type === "mcp") {
					const mcpParams = hook.action.parameters as MCPActionParams;
					this.outputChannel.appendLine(
						`[HookExecutor] MCP Server: ${mcpParams.serverId}`
					);
					this.outputChannel.appendLine(
						`[HookExecutor] MCP Tool: ${mcpParams.toolName}`
					);
				}

				if (result.error) {
					this.outputChannel.appendLine(
						`[HookExecutor] Error Code: ${result.error.code}`
					);
					this.outputChannel.appendLine(
						`[HookExecutor] Error Message: ${result.error.message}`
					);

					// Log stack trace if available in details
					const errorDetails = result.error.details as any;
					if (errorDetails?.stack) {
						this.outputChannel.appendLine(
							`[HookExecutor] Stack Trace:\n${errorDetails.stack}`
						);
					}
				}

				this.outputChannel.appendLine(`[HookExecutor] Duration: ${duration}ms`);
				this.outputChannel.appendLine(
					`[HookExecutor] Execution ID: ${execContext.executionId}`
				);
				this.outputChannel.appendLine(
					`[HookExecutor] Chain Depth: ${execContext.chainDepth}`
				);
				this.outputChannel.appendLine(
					"[HookExecutor] ================================================================"
				);

				this._onExecutionFailed.fire({
					hook,
					context: execContext,
					result,
				});

				// T077: Show error notification for MCP actions
				if (hook.action.type === "mcp") {
					const mcpParams = hook.action.parameters as MCPActionParams;
					const errorMsg = result.error?.message ?? "Unknown error";
					window.showErrorMessage(
						`MCP Tool "${mcpParams.toolName}" failed: ${errorMsg}`
					);
				}
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error as Error;

			// T084: Enhanced error logging with full context
			this.outputChannel.appendLine(
				"[HookExecutor] ==================== HOOK EXECUTION ERROR ===================="
			);
			this.outputChannel.appendLine(
				`[HookExecutor] Hook: ${hook.name} (${hook.id})`
			);
			this.outputChannel.appendLine(
				`[HookExecutor] Trigger: ${hook.trigger.agent}.${hook.trigger.operation} (${hook.trigger.timing})`
			);
			this.outputChannel.appendLine(
				`[HookExecutor] Action Type: ${hook.action.type}`
			);

			// Add action-specific context
			if (hook.action.type === "custom") {
				const customParams = hook.action.parameters as CustomActionParams;
				this.outputChannel.appendLine(
					`[HookExecutor] Agent ID: ${customParams.agentId || customParams.agentName || "unknown"}`
				);
				this.outputChannel.appendLine(
					`[HookExecutor] Agent Type: ${customParams.agentType || "unknown"}`
				);
			} else if (hook.action.type === "mcp") {
				const mcpParams = hook.action.parameters as MCPActionParams;
				this.outputChannel.appendLine(
					`[HookExecutor] MCP Server: ${mcpParams.serverId}`
				);
				this.outputChannel.appendLine(
					`[HookExecutor] MCP Tool: ${mcpParams.toolName}`
				);
			}

			this.outputChannel.appendLine(`[HookExecutor] Error: ${err.name}`);
			this.outputChannel.appendLine(`[HookExecutor] Message: ${err.message}`);

			// Include stack trace for debugging
			if (err.stack) {
				this.outputChannel.appendLine(
					`[HookExecutor] Stack Trace:\n${err.stack}`
				);
			}

			this.outputChannel.appendLine(`[HookExecutor] Duration: ${duration}ms`);
			this.outputChannel.appendLine(
				`[HookExecutor] Execution ID: ${execContext.executionId}`
			);
			this.outputChannel.appendLine(
				`[HookExecutor] Chain Depth: ${execContext.chainDepth}`
			);
			this.outputChannel.appendLine(
				"[HookExecutor] ================================================================"
			);

			const result: ExecutionResult = {
				hookId: hook.id,
				hookName: hook.name,
				status: "failure",
				duration,
				error: {
					message: err.message,
					code: err.name || "UnknownError",
					details: err,
				},
			};

			// Record execution log
			this.recordExecutionLog({
				id: randomUUID(),
				hookId: hook.id,
				executionId: execContext.executionId,
				chainDepth: execContext.chainDepth,
				triggeredAt: startTime,
				completedAt: Date.now(),
				duration,
				status: "failure",
				error: result.error,
				contextSnapshot: {}, // Empty context on early failure
			});

			// Emit failed event
			this._onExecutionFailed.fire({
				hook,
				context: execContext,
				result,
			});

			return result;
		}
	}

	/**
	 * Execute all hooks matching a trigger
	 */
	async executeHooksForTrigger(
		agent: string,
		operation: string
	): Promise<ExecutionResult[]> {
		this.outputChannel.appendLine(
			`[HookExecutor] Executing hooks for trigger: ${agent}.${operation}`
		);

		// Get all enabled hooks matching trigger
		const allHooks = await this.hookManager.getAllHooks();
		const matchingHooks = allHooks
			.filter(
				(h) =>
					h.enabled &&
					h.trigger.agent === agent &&
					h.trigger.operation === operation
			)
			.sort((a, b) => a.createdAt - b.createdAt); // Deterministic order

		if (matchingHooks.length === 0) {
			this.outputChannel.appendLine(
				`[HookExecutor] No enabled hooks found for trigger: ${agent}.${operation}`
			);
			return [];
		}

		// Create shared execution context
		const context = this.createExecutionContext();

		// Execute each hook with shared context
		const results: ExecutionResult[] = [];
		for (const hook of matchingHooks) {
			const result = await this.executeHook(hook, context);
			results.push(result);
		}

		this.outputChannel.appendLine(
			`[HookExecutor] Executed ${results.length} hooks for trigger: ${agent}.${operation}`
		);

		return results;
	}

	/**
	 * Create a new execution context
	 */
	createExecutionContext(): ExecutionContext {
		return {
			executionId: randomUUID(),
			chainDepth: 0,
			executedHooks: new Set<string>(),
			startedAt: Date.now(),
		};
	}

	/**
	 * Check if executing a hook would create a circular dependency
	 */
	isCircularDependency(hookId: string, context: ExecutionContext): boolean {
		return context.executedHooks.has(hookId);
	}

	/**
	 * Check if max chain depth has been exceeded
	 */
	isMaxDepthExceeded(context: ExecutionContext): boolean {
		return context.chainDepth >= MAX_CHAIN_DEPTH;
	}

	/**
	 * Build template context with runtime variables
	 */
	async buildTemplateContext(
		triggerOperation: string
	): Promise<ParserTemplateContext> {
		try {
			// Get Git extension
			const gitExtension = extensions.getExtension("vscode.git");
			const git = gitExtension?.exports.getAPI(1);

			const repository = git?.repositories[0];
			const branch = repository?.state.HEAD?.name;
			const user = await repository?.getConfig("user.name");

			// Extract feature name from branch (pattern: NNN-feature-name)
			const feature = branch ? this.extractFeatureName(branch) : undefined;

			return {
				timestamp: new Date().toISOString(),
				triggerType: triggerOperation as OperationType,
				feature,
				branch,
				user,
			};
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookExecutor] Warning: Failed to build template context: ${error}`
			);

			// Return minimal context
			return {
				timestamp: new Date().toISOString(),
				triggerType: triggerOperation as OperationType,
			};
		}
	}

	/**
	 * Extract feature name from branch name
	 * Pattern: NNN-feature-name → 'feature-name'
	 */
	private extractFeatureName(branch: string): string | undefined {
		const match = branch.match(FEATURE_NAME_PATTERN);
		return match ? match[1] : undefined;
	}

	/**
	 * Expand template variables in a string
	 * Uses TemplateVariableParser to replace {variable} with values from context
	 */
	expandTemplate(template: string, context: ParserTemplateContext): string {
		// Log template expansion for debugging
		this.outputChannel.appendLine(
			`[HookExecutor] Expanding template: "${template}"`
		);

		// Extract and log variables found
		const variables = this.templateParser.extractVariables(template);
		this.outputChannel.appendLine(
			`[HookExecutor] Variables found: ${variables.length > 0 ? variables.join(", ") : "(none)"}`
		);

		// Log context values for found variables
		if (variables.length > 0) {
			const contextValues = variables
				.map((varName) => {
					const value = context[varName];
					return `${varName}=${value !== undefined ? JSON.stringify(value) : "(undefined)"}`;
				})
				.join(", ");
			this.outputChannel.appendLine(
				`[HookExecutor] Context values: ${contextValues}`
			);
		}

		// Perform substitution
		const result = this.templateParser.substitute(template, context);

		// Log final result
		this.outputChannel.appendLine(`[HookExecutor] Result: "${result}"`);

		return result;
	}

	/**
	 * Execute a function with timeout
	 */
	private executeWithTimeout<T>(
		fn: () => Promise<T>,
		timeoutMs: number
	): Promise<T> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(
					new ExecutionTimeoutError(`Execution timed out after ${timeoutMs}ms`)
				);
			}, timeoutMs);

			fn()
				.then((result) => {
					clearTimeout(timer);
					resolve(result);
				})
				.catch((error) => {
					clearTimeout(timer);
					reject(error);
				});
		});
	}

	/**
	 * Record an execution log
	 */
	private recordExecutionLog(log: HookExecutionLog): void {
		this.executionLogs.push(log);

		// Prune old logs (FIFO)
		if (this.executionLogs.length > MAX_EXECUTION_LOGS) {
			this.executionLogs.shift();
		}
	}

	/**
	 * Get all execution logs
	 */
	getExecutionLogs(): HookExecutionLog[] {
		return [...this.executionLogs]; // Return copy
	}

	/**
	 * Get execution logs for a specific hook
	 */
	getExecutionLogsForHook(hookId: string): HookExecutionLog[] {
		return this.executionLogs.filter((log) => log.hookId === hookId);
	}

	/**
	 * Clear all execution logs
	 */
	clearExecutionLogs(): void {
		this.executionLogs = [];
		this.outputChannel.appendLine("[HookExecutor] Execution logs cleared");
	}

	/**
	 * Execute a local agent (in-process via sendPromptToChat)
	 * T053: Implement local agent execution path
	 */
	private executeLocalAgent(
		params: CustomActionParams,
		templateContext: ParserTemplateContext
	): Promise<{ success: boolean; error?: Error }> {
		this.outputChannel.appendLine(
			`[HookExecutor] Executing local agent: ${params.agentId}`
		);

		return (async () => {
			try {
				// Expand template variables in prompt
				const prompt = params.prompt
					? this.expandTemplate(params.prompt, templateContext)
					: "";

				// Send prompt to GitHub Copilot Chat (in-process execution)
				await sendPromptToChat(prompt);

				this.outputChannel.appendLine(
					"[HookExecutor] Local agent execution completed successfully"
				);

				return { success: true };
			} catch (error) {
				const err = error as Error;
				this.outputChannel.appendLine(
					`[HookExecutor] Local agent execution failed: ${err.message}`
				);
				return { success: false, error: err };
			}
		})();
	}

	/**
	 * Execute a background agent (external CLI process)
	 * T054: Implement background agent execution path
	 */
	private executeBackgroundAgent(
		params: CustomActionParams,
		templateContext: ParserTemplateContext
	): Promise<{ success: boolean; error?: Error }> {
		this.outputChannel.appendLine(
			`[HookExecutor] Executing background agent: ${params.agentId}`
		);

		try {
			// Get agent from registry to determine executable path
			const agent = params.agentId
				? this.agentRegistry.getAgentById(params.agentId)
				: undefined;

			if (!agent) {
				throw new Error(`Agent not found in registry: ${params.agentId}`);
			}

			// Expand template variables in arguments
			const args = params.arguments
				? this.expandTemplate(params.arguments, templateContext)
				: "";

			// Expand prompt if provided
			const prompt = params.prompt
				? this.expandTemplate(params.prompt, templateContext)
				: "";

			// For file-based agents, we simulate background execution
			// In a real implementation, extension-based agents would provide executable paths
			const proc = spawn("echo", [
				`Background agent executed: ${agent.name}`,
				prompt,
				args,
			]);

			return new Promise((resolve) => {
				let stdout = "";
				let stderr = "";

				proc.stdout.on("data", (data: Buffer) => {
					stdout += data.toString();
					this.outputChannel.append(data.toString());
				});

				proc.stderr.on("data", (data: Buffer) => {
					stderr += data.toString();
					this.outputChannel.append(data.toString());
				});

				proc.on("exit", (code: number | null) => {
					if (code === 0) {
						this.outputChannel.appendLine(
							"[HookExecutor] Background agent execution completed successfully"
						);
						resolve({ success: true });
					} else {
						const error = new Error(
							`Background agent failed with exit code ${code}: ${stderr}`
						);
						this.outputChannel.appendLine(
							`[HookExecutor] Background agent execution failed: ${error.message}`
						);
						resolve({ success: false, error });
					}
				});

				proc.on("error", (error: Error) => {
					this.outputChannel.appendLine(
						`[HookExecutor] Background agent execution error: ${error.message}`
					);
					resolve({ success: false, error });
				});
			});
		} catch (error) {
			const err = error as Error;
			this.outputChannel.appendLine(
				`[HookExecutor] Background agent execution failed: ${err.message}`
			);
			return Promise.resolve({ success: false, error: err });
		}
	}
}
