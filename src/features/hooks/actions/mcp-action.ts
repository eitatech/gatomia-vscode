/**
 * MCP Action Executor
 *
 * Executes MCP server tool actions when triggered by hooks.
 * Handles server availability, parameter resolution, validation,
 * concurrency control, and timeout management.
 */

import type {
	IMCPClientService,
	IMCPDiscoveryService,
	IMCPExecutionPool,
	IMCPParameterResolver,
	MCPToolExecutionResult,
} from "../services/mcp-contracts";
import {
	MCPParameterValidationError,
	MCPServerNotFoundError,
	MCPServerUnavailableError,
	MCPTimeoutError,
	MCPToolNotFoundError,
} from "../services/mcp-contracts";
import type { MCPActionParams, TemplateContext } from "../types";
import { isValidMCPParams, MCP_DEFAULT_TIMEOUT } from "../types";

/**
 * Result of MCP action execution
 */
export interface MCPActionExecutionResult {
	success: boolean;
	output?: unknown;
	error?: Error;
	duration?: number;
	truncated?: boolean; // T093: Flag if output was truncated
}

/**
 * Options for constructing MCPActionExecutor
 */
export interface MCPActionExecutorOptions {
	discoveryService: IMCPDiscoveryService;
	clientService: IMCPClientService;
	parameterResolver: IMCPParameterResolver;
	executionPool: IMCPExecutionPool;
	logger?: Pick<typeof console, "warn" | "log">;
	maxRetries?: number; // T092: Maximum retries for transient failures
	retryDelayMs?: number; // T092: Delay between retries
}

/**
 * Error classes for MCP action execution
 */
export class MCPActionValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MCPActionValidationError";
	}
}

/**
 * MCPActionExecutor - Executes MCP server tool actions
 *
 * Orchestrates the complete execution flow:
 * 1. Validate action parameters
 * 2. Check server availability
 * 3. Resolve parameter mappings from context
 * 4. Validate resolved parameters against schema
 * 5. Execute tool with concurrency control
 * 6. Handle timeout and errors
 * 7. Return execution result
 */
export class MCPActionExecutor {
	private readonly discoveryService: IMCPDiscoveryService;
	private readonly clientService: IMCPClientService;
	private readonly parameterResolver: IMCPParameterResolver;
	private readonly executionPool: IMCPExecutionPool;
	private readonly logger: Pick<typeof console, "warn" | "log">;
	private readonly maxRetries: number; // T092
	private readonly retryDelayMs: number; // T092

	constructor(options: MCPActionExecutorOptions) {
		this.discoveryService = options.discoveryService;
		this.clientService = options.clientService;
		this.parameterResolver = options.parameterResolver;
		this.executionPool = options.executionPool;
		this.logger = options.logger ?? console;
		this.maxRetries = options.maxRetries ?? 1; // T092: Default 1 retry
		this.retryDelayMs = options.retryDelayMs ?? 2000; // T092: Default 2s delay
	}

	/**
	 * Execute an MCP action with the given parameters and context
	 *
	 * @param params - MCP action parameters (serverId, toolName, parameterMappings, timeout)
	 * @param templateContext - Template context for parameter resolution (feature, branch, etc.)
	 * @returns Execution result with success status, output, error, and duration
	 */
	async execute(
		params: MCPActionParams,
		templateContext: TemplateContext
	): Promise<MCPActionExecutionResult> {
		const startTime = Date.now();

		try {
			// T059: Validate action parameters
			this.validateActionParameters(params);

			// T081-T082: Check server availability with graceful degradation
			await this.checkServerAvailability(params.serverId);

			// T060: Resolve parameter mappings from context
			const resolvedParams = this.resolveParameters(params, templateContext);

			// T090: Detailed logging for parameter resolution
			this.logger.log?.(
				`[MCPActionExecutor] Resolved parameters for ${params.toolName}:`,
				JSON.stringify(resolvedParams)
			);

			// T061: Validate resolved parameters against tool schema
			await this.validateResolvedParameters(
				params.serverId,
				params.toolName,
				resolvedParams
			);

			// T062 + T063: Execute tool with concurrency control
			const timeout = params.timeout ?? MCP_DEFAULT_TIMEOUT;
			const result = await this.executeToolWithPool(
				params.serverId,
				params.toolName,
				resolvedParams,
				timeout
			);

			// T093: Handle large output payloads (truncate if >1MB)
			const { output, truncated } = this.handleLargeOutput(result.output);

			// T065: Return execution result
			return {
				success: result.success,
				output,
				truncated,
				error: result.error ? this.convertToError(result.error) : undefined,
				duration: Date.now() - startTime,
			};
		} catch (error) {
			const err = error as Error;
			const duration = Date.now() - startTime;

			// T090: Detailed error logging for MCP failures
			this.logger.warn?.(
				`[MCPActionExecutor] Execution failed for ${params.serverId}/${params.toolName}: ${err.name} - ${err.message}`
			);

			// Log additional error details
			if (err instanceof MCPServerNotFoundError) {
				this.logger.warn?.(
					"[MCPActionExecutor] Server not found. Verify server ID and Copilot configuration."
				);
			} else if (err instanceof MCPServerUnavailableError) {
				this.logger.warn?.(
					"[MCPActionExecutor] Server is currently unavailable. Check server status."
				);
			} else if (err instanceof MCPToolNotFoundError) {
				this.logger.warn?.(
					"[MCPActionExecutor] Tool not found. Verify tool name in server configuration."
				);
			} else if (err instanceof MCPParameterValidationError) {
				this.logger.warn?.(
					"[MCPActionExecutor] Parameter validation failed. Check parameter mappings."
				);
			} else if (err instanceof MCPTimeoutError) {
				this.logger.warn?.(
					"[MCPActionExecutor] Execution timed out. Consider increasing timeout value."
				);
			}

			return {
				success: false,
				error: err,
				duration,
			};
		}
	}

	/**
	 * Validate action parameters structure and types
	 */
	private validateActionParameters(params: MCPActionParams): void {
		if (!isValidMCPParams(params)) {
			throw new MCPActionValidationError(
				"Invalid MCP action parameters structure"
			);
		}
	}

	/**
	 * Check if the MCP server is available
	 * T081: Server availability validation before execution
	 * T082: Graceful degradation - throw error but don't crash the system
	 */
	private async checkServerAvailability(serverId: string): Promise<void> {
		const server = await this.discoveryService.getServer(serverId);

		if (!server) {
			this.logger.warn?.(
				`[MCPActionExecutor] Server not found: ${serverId}. Hook execution will be skipped.`
			);
			throw new MCPServerNotFoundError(serverId);
		}

		if (server.status === "unavailable") {
			this.logger.warn?.(
				`[MCPActionExecutor] Server unavailable: ${serverId}. Hook execution will be skipped.`
			);
			throw new MCPServerUnavailableError(serverId);
		}

		this.logger.log?.(
			`[MCPActionExecutor] Server available: ${serverId} (${server.name})`
		);
	}

	/**
	 * Resolve parameter mappings using the template context
	 */
	private resolveParameters(
		params: MCPActionParams,
		templateContext: TemplateContext
	): Record<string, unknown> {
		return this.parameterResolver.resolve(
			params.parameterMappings,
			templateContext
		);
	}

	/**
	 * Validate resolved parameters against the tool's input schema
	 */
	private async validateResolvedParameters(
		serverId: string,
		toolName: string,
		resolvedParams: Record<string, unknown>
	): Promise<void> {
		const validation = await this.clientService.validateParameters(
			serverId,
			toolName,
			resolvedParams
		);

		if (!validation.valid) {
			throw new MCPParameterValidationError(validation.errors);
		}
	}

	/**
	 * Execute the MCP tool with concurrency control via execution pool
	 * T092: Includes automatic retry logic for transient failures
	 */
	private async executeToolWithPool(
		serverId: string,
		toolName: string,
		resolvedParams: Record<string, unknown>,
		timeout: number
	): Promise<MCPToolExecutionResult> {
		let lastError: Error | undefined;

		// T092: Retry loop (1 initial attempt + maxRetries retries)
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				// Wrap execution in pool to enforce concurrency limit
				const result = await this.executionPool.execute(() =>
					this.clientService.executeTool(
						serverId,
						toolName,
						resolvedParams,
						timeout
					)
				);

				// Success - return immediately
				if (result.success || attempt === this.maxRetries) {
					if (attempt > 0) {
						this.logger.log?.(
							`[MCPActionExecutor] Execution succeeded after ${attempt} retries`
						);
					}
					return result;
				}

				// If not successful and not last attempt, prepare for retry
				lastError = result.error
					? this.convertToError(result.error)
					: new Error("Execution failed");

				// Check if error is transient (retryable)
				const isTransient = this.isTransientError(lastError);
				if (!isTransient) {
					this.logger.warn?.(
						`[MCPActionExecutor] Non-transient error, skipping retries: ${lastError.name}`
					);
					return result;
				}

				// Log retry attempt
				this.logger.warn?.(
					`[MCPActionExecutor] Execution failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${this.retryDelayMs}ms...`
				);

				// Wait before retrying (T092: 2s delay)
				await this.delay(this.retryDelayMs);
			} catch (error) {
				lastError = error as Error;

				// Check if error is transient
				const isTransient = this.isTransientError(lastError);
				if (!isTransient || attempt === this.maxRetries) {
					throw lastError;
				}

				// Log retry attempt
				this.logger.warn?.(
					`[MCPActionExecutor] Execution error (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${this.retryDelayMs}ms...`
				);

				// Wait before retrying
				await this.delay(this.retryDelayMs);
			}
		}

		// All retries exhausted
		throw lastError ?? new Error("Execution failed after all retry attempts");
	}

	/**
	 * T092: Check if error is transient (retryable)
	 * Transient errors: timeout, network, server temporarily unavailable
	 * Non-transient: validation errors, server not found, tool not found
	 */
	private isTransientError(error: Error): boolean {
		return (
			error instanceof MCPTimeoutError ||
			error instanceof MCPServerUnavailableError ||
			error.message.includes("timeout") ||
			error.message.includes("network") ||
			error.message.includes("ETIMEDOUT") ||
			error.message.includes("ECONNREFUSED")
		);
	}

	/**
	 * T092: Delay helper for retry logic
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * T093: Handle large MCP output payloads
	 * Truncates output if size exceeds 1MB to prevent memory issues
	 */
	private handleLargeOutput(output: unknown): {
		output: unknown;
		truncated: boolean;
	} {
		const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

		try {
			const outputStr = JSON.stringify(output);
			const sizeBytes = new TextEncoder().encode(outputStr).length;

			if (sizeBytes > MAX_OUTPUT_SIZE) {
				this.logger.warn?.(
					`[MCPActionExecutor] Output truncated: ${sizeBytes} bytes exceeds maximum ${MAX_OUTPUT_SIZE} bytes`
				);

				// Truncate to max size
				const truncated = outputStr.substring(
					0,
					Math.floor(MAX_OUTPUT_SIZE / 2)
				); // Use half to account for encoding
				return {
					output: `${truncated}... [TRUNCATED - Original size: ${sizeBytes} bytes]`,
					truncated: true,
				};
			}

			return { output, truncated: false };
		} catch (error) {
			// If serialization fails, return as-is
			this.logger.warn?.(
				`[MCPActionExecutor] Failed to measure output size: ${error}`
			);
			return { output, truncated: false };
		}
	}

	/**
	 * Convert MCP execution error to standard Error object
	 */
	private convertToError(mcpError: {
		code: string;
		message: string;
		details?: unknown;
	}): Error {
		// Check if it's one of our known error types
		if (mcpError.code === "MCPTimeoutError") {
			const timeout =
				typeof mcpError.details === "object" &&
				mcpError.details !== null &&
				"timeout" in mcpError.details
					? (mcpError.details.timeout as number)
					: MCP_DEFAULT_TIMEOUT;
			return new MCPTimeoutError(timeout);
		}

		if (mcpError.code === "MCPServerNotFoundError") {
			const serverId =
				typeof mcpError.details === "string"
					? mcpError.details
					: "unknown server";
			return new MCPServerNotFoundError(serverId);
		}

		if (mcpError.code === "MCPToolNotFoundError") {
			const parts = mcpError.message.split("'");
			const toolName = parts[1] ?? "unknown tool";
			const serverId = parts[3] ?? "unknown server";
			return new MCPToolNotFoundError(serverId, toolName);
		}

		if (mcpError.code === "MCPServerUnavailableError") {
			const serverId =
				typeof mcpError.details === "string"
					? mcpError.details
					: "unknown server";
			return new MCPServerUnavailableError(serverId);
		}

		// Generic error
		const error = new Error(mcpError.message);
		error.name = mcpError.code;
		return error;
	}
}
