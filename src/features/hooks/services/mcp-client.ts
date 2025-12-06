/**
 * MCP Client Service
 *
 * Executes MCP tools with parameter validation.
 * Handles tool invocation, timeout control, and result processing.
 */

import { executeMCPTool } from "../../../utils/copilot-mcp-utils";
import { MCP_DEFAULT_TIMEOUT } from "../types";
import type {
	IMCPClientService,
	IMCPDiscoveryService,
	MCPExecutionError,
	MCPParameterValidationError,
	MCPServerNotFoundError,
	MCPTimeoutError,
	MCPToolExecutionResult,
	MCPToolNotFoundError,
	ParameterValidationError,
	ParameterValidationResult,
} from "./mcp-contracts";

/**
 * MCPClientService implementation
 *
 * Executes MCP tools with parameter validation and timeout handling.
 */
export class MCPClientService implements IMCPClientService {
	private readonly discoveryService: IMCPDiscoveryService;

	constructor(discoveryService: IMCPDiscoveryService) {
		this.discoveryService = discoveryService;
	}

	/**
	 * Execute an MCP tool with resolved parameters
	 * @param serverId - Server identifier
	 * @param toolName - Tool to execute
	 * @param parameters - Resolved parameter values (JSON object)
	 * @param timeout - Execution timeout in milliseconds
	 * @returns Promise resolving to execution result
	 */
	async executeTool(
		serverId: string,
		toolName: string,
		parameters: Record<string, unknown>,
		timeout = MCP_DEFAULT_TIMEOUT
	): Promise<MCPToolExecutionResult> {
		const startTime = Date.now();

		try {
			// Verify server exists
			const server = await this.discoveryService.getServer(serverId);
			if (!server) {
				const error: MCPServerNotFoundError = {
					name: "MCPServerNotFoundError",
					message: `MCP server not found: ${serverId}`,
				};
				throw error;
			}

			// Verify tool exists
			const tool = await this.discoveryService.getTool(serverId, toolName);
			if (!tool) {
				const error: MCPToolNotFoundError = {
					name: "MCPToolNotFoundError",
					message: `MCP tool '${toolName}' not found on server '${serverId}'`,
				};
				throw error;
			}

			// Validate parameters
			const validation = await this.validateParameters(
				serverId,
				toolName,
				parameters
			);
			if (!validation.valid) {
				const error: MCPParameterValidationError = {
					name: "MCPParameterValidationError",
					message: `Parameter validation failed: ${validation.errors.map((e) => e.message).join(", ")}`,
					errors: validation.errors,
				};
				throw error;
			}

			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					const error: MCPTimeoutError = {
						name: "MCPTimeoutError",
						message: `MCP tool execution timed out after ${timeout}ms`,
						timeout,
					};
					reject(error);
				}, timeout);
			});

			// TODO: Implement actual MCP tool execution via Copilot API
			// For now, return mock success result
			const executionPromise = (async () => {
				const output = await executeMCPTool(serverId, toolName, parameters);
				return {
					success: true,
					output,
					duration: Date.now() - startTime,
				};
			})();

			// Race between execution and timeout
			const result = await Promise.race([executionPromise, timeoutPromise]);

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;

			// If error is already one of our custom types, wrap it in result
			if (
				error &&
				typeof error === "object" &&
				"name" in error &&
				(error.name === "MCPServerNotFoundError" ||
					error.name === "MCPToolNotFoundError" ||
					error.name === "MCPParameterValidationError" ||
					error.name === "MCPTimeoutError")
			) {
				return {
					success: false,
					error: error as unknown as MCPExecutionError,
					duration,
				};
			}

			// Unknown error - wrap it
			return {
				success: false,
				error: {
					code: "EXECUTION_ERROR",
					message: error instanceof Error ? error.message : String(error),
					details: error,
				},
				duration,
			};
		}
	}

	/**
	 * Validate parameters against tool's input schema
	 * @param serverId - Server identifier
	 * @param toolName - Tool name
	 * @param parameters - Parameters to validate
	 * @returns Validation result with errors if invalid
	 */
	async validateParameters(
		serverId: string,
		toolName: string,
		parameters: Record<string, unknown>
	): Promise<ParameterValidationResult> {
		const errors: ParameterValidationError[] = [];

		try {
			// Get tool schema
			const tool = await this.discoveryService.getTool(serverId, toolName);
			if (!tool) {
				errors.push({
					parameter: "_tool",
					message: `Tool '${toolName}' not found on server '${serverId}'`,
				});
				return { valid: false, errors };
			}

			const schema = tool.inputSchema;

			// Validate required parameters
			this.validateRequiredParameters(schema, parameters, errors);

			// Validate parameter types
			this.validateParameterTypes(schema, parameters, errors);

			return {
				valid: errors.length === 0,
				errors,
			};
		} catch (error) {
			errors.push({
				parameter: "_validation",
				message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
			});
			return { valid: false, errors };
		}
	}

	/**
	 * Validate required parameters are present
	 */
	private validateRequiredParameters(
		schema: { required?: string[] },
		parameters: Record<string, unknown>,
		errors: ParameterValidationError[]
	): void {
		if (!schema.required) {
			return;
		}

		for (const requiredParam of schema.required) {
			if (!(requiredParam in parameters)) {
				errors.push({
					parameter: requiredParam,
					message: `Required parameter '${requiredParam}' is missing`,
					expected: "defined",
					actual: "undefined",
				});
			}
		}
	}

	/**
	 * Validate parameter types match schema
	 */
	private validateParameterTypes(
		schema: {
			properties?: Record<
				string,
				{ type: string; enum?: unknown[]; default?: unknown }
			>;
			required?: string[];
		},
		parameters: Record<string, unknown>,
		errors: ParameterValidationError[]
	): void {
		if (!schema.properties) {
			return;
		}

		for (const [paramName, paramValue] of Object.entries(parameters)) {
			const propSchema = schema.properties[paramName];
			if (!propSchema) {
				continue;
			}

			// Handle null/undefined
			if (paramValue === null || paramValue === undefined) {
				if (schema.required?.includes(paramName)) {
					errors.push({
						parameter: paramName,
						message: `Required parameter '${paramName}' is null or undefined`,
						expected: propSchema.type,
						actual: String(paramValue),
					});
				}
				continue;
			}

			// Type validation
			this.validateParameterType(paramName, paramValue, propSchema, errors);

			// Enum validation
			this.validateParameterEnum(paramName, paramValue, propSchema, errors);
		}
	}

	/**
	 * Validate a single parameter's type
	 */
	private validateParameterType(
		paramName: string,
		paramValue: unknown,
		propSchema: { type: string },
		errors: ParameterValidationError[]
	): void {
		const actualType = typeof paramValue;
		const expectedType = propSchema.type;

		const typeMatches =
			(expectedType === "string" && actualType === "string") ||
			(expectedType === "number" && actualType === "number") ||
			(expectedType === "boolean" && actualType === "boolean");

		if (
			!typeMatches &&
			["string", "number", "boolean"].includes(expectedType)
		) {
			errors.push({
				parameter: paramName,
				message: `Parameter '${paramName}' has incorrect type`,
				expected: expectedType,
				actual: actualType,
			});
		}
	}

	/**
	 * Validate a parameter's value against enum constraints
	 */
	private validateParameterEnum(
		paramName: string,
		paramValue: unknown,
		propSchema: { enum?: unknown[] },
		errors: ParameterValidationError[]
	): void {
		if (propSchema.enum && !propSchema.enum.includes(paramValue)) {
			errors.push({
				parameter: paramName,
				message: `Parameter '${paramName}' value not in allowed enum values`,
				expected: `one of [${propSchema.enum.join(", ")}]`,
				actual: String(paramValue),
			});
		}
	}
}
