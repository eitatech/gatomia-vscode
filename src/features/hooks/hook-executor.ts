import {
	EventEmitter,
	type Event,
	type OutputChannel,
	extensions,
	window,
	commands,
} from "vscode";
import { randomUUID } from "node:crypto";
import type { HookManager } from "./hook-manager";
import type { TriggerRegistry } from "./trigger-registry";
import { AgentActionExecutor } from "./actions/agent-action";
import { GitActionExecutor } from "./actions/git-action";
import { GitHubActionExecutor } from "./actions/github-action";
import { MCPActionExecutor } from "./actions/mcp-action";
import { MCPClientService } from "./services/mcp-client";
import { MCPParameterResolver } from "./services/mcp-parameter-resolver";
import { MCPExecutionPool } from "./services/mcp-execution-pool";
import type { IMCPDiscoveryService } from "./services/mcp-contracts";
import type {
	Hook,
	ExecutionContext,
	HookExecutionLog,
	TemplateContext,
	AgentActionParams,
	GitActionParams,
	GitHubActionParams,
	MCPActionParams,
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
	private readonly outputChannel: OutputChannel;
	private readonly agentExecutor: AgentActionExecutor;
	private readonly gitExecutor: GitActionExecutor;
	private readonly githubExecutor: GitHubActionExecutor;
	private readonly mcpExecutor: MCPActionExecutor;
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

	constructor(
		hookManager: HookManager,
		triggerRegistry: TriggerRegistry,
		outputChannel: OutputChannel,
		mcpDiscoveryService: IMCPDiscoveryService
	) {
		this.hookManager = hookManager;
		this.triggerRegistry = triggerRegistry;
		this.outputChannel = outputChannel;
		this.agentExecutor = new AgentActionExecutor();
		this.gitExecutor = new GitActionExecutor();
		this.githubExecutor = new GitHubActionExecutor();

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
			const templateContext = await this.buildTemplateContext();

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
			} else {
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

			this.outputChannel.appendLine(
				`[HookExecutor] Hook execution ${result.status}: ${hook.name} (${duration}ms)`
			);

			// T074: Additional logging for MCP actions
			if (hook.action.type === "mcp") {
				const mcpParams = hook.action.parameters as MCPActionParams;
				if (result.status === "success") {
					this.outputChannel.appendLine(
						`[HookExecutor] MCP Tool ${mcpParams.serverId}/${mcpParams.toolName} completed successfully`
					);
				} else if (result.error) {
					this.outputChannel.appendLine(
						`[HookExecutor] MCP Tool ${mcpParams.serverId}/${mcpParams.toolName} failed: ${result.error.code} - ${result.error.message}`
					);
				}
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error as Error;

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

			this.outputChannel.appendLine(
				`[HookExecutor] Hook execution failed: ${hook.name} - ${err.message}`
			);

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
	async buildTemplateContext(): Promise<TemplateContext> {
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
				feature,
				branch,
				timestamp: new Date().toISOString(),
				user,
			};
		} catch (error) {
			this.outputChannel.appendLine(
				`[HookExecutor] Warning: Failed to build template context: ${error}`
			);

			// Return minimal context
			return {
				timestamp: new Date().toISOString(),
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
	 * Replaces {variable} with values from context
	 */
	expandTemplate(template: string, context: TemplateContext): string {
		let expanded = template;

		// Replace each variable
		for (const [key, value] of Object.entries(context)) {
			if (value !== undefined) {
				const placeholder = `{${key}}`;
				expanded = expanded.replace(
					new RegExp(placeholder, "g"),
					String(value)
				);
			}
		}

		return expanded;
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
}
