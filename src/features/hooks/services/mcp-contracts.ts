/**
 * MCP Service Contracts
 *
 * TypeScript interfaces defining the contracts for MCP server integration.
 * These interfaces abstract MCP-specific implementation details.
 */

// ============================================================================
// Core Types (from data-model.md)
// ============================================================================

export type ServerStatus = "available" | "unavailable" | "unknown";

export interface MCPServer {
	id: string;
	name: string;
	description?: string;
	status: ServerStatus;
	tools: MCPTool[];
	lastDiscovered: number;
}

export interface MCPTool {
	name: string;
	displayName: string;
	description: string;
	inputSchema: JSONSchema;
	serverId: string;
}

export interface JSONSchema {
	type: string;
	properties?: Record<string, JSONSchemaProperty>;
	required?: string[];
}

export interface JSONSchemaProperty {
	type: string;
	description?: string;
	enum?: unknown[];
	default?: unknown;
}

export interface ParameterMapping {
	toolParam: string;
	source: "context" | "literal" | "template";
	value: string;
}

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * MCPDiscoveryService - Discovers MCP servers and their available tools
 */
export interface IMCPDiscoveryService {
	/**
	 * Discover all MCP servers configured in Copilot
	 * @param forceRefresh - Skip cache and force fresh discovery
	 * @returns Promise resolving to array of MCP servers with their tools
	 */
	discoverServers(forceRefresh?: boolean): Promise<MCPServer[]>;

	/**
	 * Get a specific MCP server by ID
	 * @param serverId - Server identifier
	 * @returns Promise resolving to server or undefined if not found
	 */
	getServer(serverId: string): Promise<MCPServer | undefined>;

	/**
	 * Get a specific tool from a server
	 * @param serverId - Server identifier
	 * @param toolName - Tool name
	 * @returns Promise resolving to tool or undefined if not found
	 */
	getTool(serverId: string, toolName: string): Promise<MCPTool | undefined>;

	/**
	 * Clear the discovery cache
	 */
	clearCache(): void;

	/**
	 * Check if cache is fresh
	 */
	isCacheFresh(): boolean;
}

/**
 * MCPClientService - Executes MCP tools with parameter resolution
 */
export interface IMCPClientService {
	/**
	 * Execute an MCP tool with resolved parameters
	 * @param serverId - Server identifier
	 * @param toolName - Tool to execute
	 * @param parameters - Resolved parameter values (JSON object)
	 * @param timeout - Execution timeout in milliseconds
	 * @returns Promise resolving to execution result
	 */
	executeTool(
		serverId: string,
		toolName: string,
		parameters: Record<string, unknown>,
		timeout?: number
	): Promise<MCPToolExecutionResult>;

	/**
	 * Validate parameters against tool's input schema
	 * @param serverId - Server identifier
	 * @param toolName - Tool name
	 * @param parameters - Parameters to validate
	 * @returns Validation result with errors if invalid
	 */
	validateParameters(
		serverId: string,
		toolName: string,
		parameters: Record<string, unknown>
	): Promise<ParameterValidationResult>;
}

/**
 * MCPParameterResolver - Resolves parameter mappings to actual values
 */
export interface IMCPParameterResolver {
	/**
	 * Resolve parameter mappings using template context
	 * @param mappings - Parameter mapping definitions
	 * @param context - Template context (feature, branch, etc.)
	 * @returns Resolved parameters as key-value pairs
	 */
	resolve(
		mappings: ParameterMapping[],
		context: TemplateContext
	): Record<string, unknown>;

	/**
	 * Resolve a single parameter mapping
	 * @param mapping - Single parameter mapping
	 * @param context - Template context
	 * @returns Resolved value (string, number, boolean, etc.)
	 */
	resolveSingle(mapping: ParameterMapping, context: TemplateContext): unknown;
}

// ============================================================================
// Result Types
// ============================================================================

export interface MCPToolExecutionResult {
	success: boolean;
	output?: unknown;
	error?: MCPExecutionError;
	duration: number;
}

export interface MCPExecutionError {
	code: string;
	message: string;
	details?: unknown;
}

export interface ParameterValidationResult {
	valid: boolean;
	errors: ParameterValidationError[];
}

export interface ParameterValidationError {
	parameter: string;
	message: string;
	expected?: string;
	actual?: string;
}

// ============================================================================
// Template Context (from existing hooks types)
// ============================================================================

export interface TemplateContext {
	feature?: string;
	branch?: string;
	timestamp?: string;
	user?: string;
}

// ============================================================================
// Concurrency Control
// ============================================================================

/**
 * MCPExecutionPool - Manages concurrent MCP action executions
 */
export interface IMCPExecutionPool {
	/**
	 * Execute a task with concurrency control
	 * @param task - Async task to execute
	 * @returns Promise that resolves when task completes
	 */
	execute<T>(task: () => Promise<T>): Promise<T>;

	/**
	 * Get current pool status
	 */
	getStatus(): PoolStatus;

	/**
	 * Wait for all queued tasks to complete
	 */
	drain(): Promise<void>;
}

export interface PoolStatus {
	active: number;
	queued: number;
	capacity: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class MCPServerNotFoundError extends Error {
	constructor(serverId: string) {
		super(`MCP server not found: ${serverId}`);
		this.name = "MCPServerNotFoundError";
	}
}

export class MCPToolNotFoundError extends Error {
	constructor(serverId: string, toolName: string) {
		super(`MCP tool '${toolName}' not found on server '${serverId}'`);
		this.name = "MCPToolNotFoundError";
	}
}

export class MCPServerUnavailableError extends Error {
	constructor(serverId: string) {
		super(`MCP server unavailable: ${serverId}`);
		this.name = "MCPServerUnavailableError";
	}
}

export class MCPParameterValidationError extends Error {
	errors: ParameterValidationError[];

	constructor(errors: ParameterValidationError[]) {
		super(
			`Parameter validation failed: ${errors.map((e) => e.message).join(", ")}`
		);
		this.name = "MCPParameterValidationError";
		this.errors = errors;
	}
}

export class MCPTimeoutError extends Error {
	timeout: number;

	constructor(timeout: number) {
		super(`MCP tool execution timed out after ${timeout}ms`);
		this.name = "MCPTimeoutError";
		this.timeout = timeout;
	}
}

export class MCPDiscoveryError extends Error {
	cause?: Error;

	constructor(message: string, cause?: Error) {
		super(message);
		this.name = "MCPDiscoveryError";
		this.cause = cause;
	}
}
