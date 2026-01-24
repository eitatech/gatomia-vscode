/**
 * ToolRegistry
 * Manages registration and execution of agent tools
 * Enhanced with comprehensive error handling (T059-T060)
 */

import type { OutputChannel } from "vscode";
import {
	ToolExecutionError,
	type ToolHandler,
	type ToolExecutionParams,
	type ToolResponse,
} from "./types";
import { formatError, getErrorSeverity } from "./error-formatter";

/**
 * Registry for agent tool handlers
 * Maps tool names to implementation functions
 */
export class ToolRegistry {
	private readonly tools: Map<string, ToolHandler> = new Map();
	private readonly outputChannel: OutputChannel;

	// Regex for valid tool names: lowercase alphanumeric with dots and hyphens
	private static readonly TOOL_NAME_PATTERN = /^[a-z0-9.-]+$/;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
		this.outputChannel.appendLine("[ToolRegistry] Initialized");
	}

	/**
	 * Register a tool handler
	 * @param name Tool name (must be lowercase, alphanumeric with dots/hyphens)
	 * @param handler Tool implementation function
	 * @throws Error if tool name is invalid or already registered
	 */
	register(name: string, handler: ToolHandler): void {
		// Validate tool name format
		if (!ToolRegistry.TOOL_NAME_PATTERN.test(name)) {
			const error = `Invalid tool name format: '${name}'. Must be lowercase alphanumeric with dots and hyphens only.`;
			this.outputChannel.appendLine(`[ToolRegistry] ${error}`);
			throw new Error("Invalid tool name format");
		}

		// Check for duplicates
		if (this.tools.has(name)) {
			const error = `Tool '${name}' is already registered`;
			this.outputChannel.appendLine(`[ToolRegistry] ${error}`);
			throw new Error(error);
		}

		// Register tool
		this.tools.set(name, handler);
		this.outputChannel.appendLine(`[ToolRegistry] Registered tool: ${name}`);
	}

	/**
	 * Execute a registered tool with comprehensive error handling
	 * T059 - Error classification and handling
	 * T060 - Error logging with full context
	 * @param name Tool name
	 * @param params Execution parameters
	 * @returns Tool response
	 * @throws ToolExecutionError if tool not registered or execution fails
	 */
	async execute(
		name: string,
		params: ToolExecutionParams
	): Promise<ToolResponse> {
		// T063 - Validate parameters before execution
		this.validateExecutionParams(name, params);

		// Check if tool exists
		const handler = this.tools.get(name);
		if (!handler) {
			const availableTools = this.getRegisteredTools();
			const errorMsg = `Tool '${name}' is not registered. Available tools: ${availableTools.join(", ") || "none"}`;

			// T060 - Log error with full context
			this.outputChannel.appendLine(`[ToolRegistry] ERROR: ${errorMsg}`);
			this.outputChannel.appendLine(
				`[ToolRegistry] Context: ${availableTools.length} tools registered, requested tool not found`
			);

			throw new Error(errorMsg);
		}

		this.outputChannel.appendLine(
			`[ToolRegistry] Executing tool: ${name} with input: ${params.input.substring(0, 50)}${params.input.length > 50 ? "..." : ""}`
		);

		const startTime = Date.now();

		try {
			// Execute tool handler
			const response = await handler(params);

			const duration = Date.now() - startTime;
			this.outputChannel.appendLine(
				`[ToolRegistry] Tool '${name}' completed successfully in ${duration}ms`
			);

			// Add duration to metadata if not already set
			if (!response.metadata) {
				response.metadata = {};
			}
			if (!response.metadata.duration) {
				response.metadata.duration = duration;
			}

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;

			// T059 - Classify and wrap error
			const wrappedError = this.wrapError(error, name);

			// T060 - Log error with full context
			const formatted = formatError(wrappedError, { tool: name });
			const severity = getErrorSeverity(formatted.category);

			this.outputChannel.appendLine(
				`[ToolRegistry] ${severity.toUpperCase()}: Tool '${name}' failed after ${duration}ms`
			);
			this.outputChannel.appendLine(
				`[ToolRegistry] Error Type: ${wrappedError.name}`
			);
			this.outputChannel.appendLine(
				`[ToolRegistry] Technical Details: ${formatted.technicalDetails}`
			);
			this.outputChannel.appendLine(
				`[ToolRegistry] Category: ${formatted.category}`
			);

			if (wrappedError instanceof ToolExecutionError && wrappedError.cause) {
				this.outputChannel.appendLine(
					`[ToolRegistry] Caused by: ${wrappedError.cause.name}: ${wrappedError.cause.message}`
				);
				if (wrappedError.cause.stack) {
					this.outputChannel.appendLine(
						`[ToolRegistry] Stack: ${wrappedError.cause.stack}`
					);
				}
			}

			// Re-throw wrapped error
			throw wrappedError;
		}
	}

	/**
	 * T063 - Validate execution parameters
	 * @param name Tool name
	 * @param params Execution parameters
	 * @throws Error if validation fails
	 */
	private validateExecutionParams(
		name: string,
		params: ToolExecutionParams
	): void {
		if (!params) {
			throw new Error("Execution parameters are required");
		}

		if (params.input === undefined || params.input === null) {
			this.outputChannel.appendLine(
				`[ToolRegistry] WARNING: Tool '${name}' called with undefined/null input`
			);
		}

		if (!params.context) {
			throw new Error("Execution context is required");
		}

		if (!params.resources) {
			throw new Error("Resources are required");
		}

		if (!params.token) {
			throw new Error("Cancellation token is required");
		}
	}

	/**
	 * T059 - Wrap errors in ToolExecutionError if not already wrapped
	 * @param error Original error
	 * @param toolName Tool name
	 * @returns ToolExecutionError
	 */
	private wrapError(error: unknown, toolName: string): ToolExecutionError {
		if (error instanceof ToolExecutionError) {
			return error;
		}

		const originalError =
			error instanceof Error ? error : new Error(String(error));
		return new ToolExecutionError(
			`Tool '${toolName}' execution failed: ${originalError.message}`,
			toolName,
			originalError
		);
	}

	/**
	 * Unregister a tool
	 * @param name Tool name
	 */
	unregister(name: string): void {
		if (this.tools.has(name)) {
			this.tools.delete(name);
			this.outputChannel.appendLine(
				`[ToolRegistry] Unregistered tool: ${name}`
			);
		}
	}

	/**
	 * Check if a tool is registered
	 * @param name Tool name
	 * @returns true if registered
	 */
	isRegistered(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Get list of all registered tool names
	 * @returns Array of tool names
	 */
	getRegisteredTools(): string[] {
		return Array.from(this.tools.keys());
	}

	/**
	 * Get count of registered tools
	 * @returns Number of registered tools
	 */
	getToolCount(): number {
		return this.tools.size;
	}
}
