/**
 * Unit tests for MCPActionExecutor
 *
 * Tests cover:
 * - T069: Successful execution path
 * - T070: Parameter resolution and mapping
 * - T071: Parameter validation failure handling
 * - T072: Timeout handling
 * - T073: Concurrency pool limiting
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	MCPActionExecutor,
	MCPActionValidationError,
} from "../../../../../src/features/hooks/actions/mcp-action";
import {
	MCPParameterValidationError,
	MCPServerNotFoundError,
	MCPServerUnavailableError,
	MCPTimeoutError,
} from "../../../../../src/features/hooks/services/mcp-contracts";
import type {
	IMCPClientService,
	IMCPDiscoveryService,
	IMCPExecutionPool,
	IMCPParameterResolver,
	MCPServer,
	MCPTool,
	MCPToolExecutionResult,
} from "../../../../../src/features/hooks/services/mcp-contracts";
import type {
	MCPActionParams,
	TemplateContext,
} from "../../../../../src/features/hooks/types";

// Mock services
const createMockDiscoveryService = (): IMCPDiscoveryService => ({
	discoverServers: vi.fn(),
	getServer: vi.fn(),
	getTool: vi.fn(),
	clearCache: vi.fn(),
	isCacheFresh: vi.fn(),
});

const createMockClientService = (): IMCPClientService => ({
	executeTool: vi.fn(),
	validateParameters: vi.fn(),
});

const createMockParameterResolver = (): IMCPParameterResolver => ({
	resolve: vi.fn(),
	resolveSingle: vi.fn(),
});

const createMockExecutionPool = (): IMCPExecutionPool => ({
	execute: vi.fn(),
	getStatus: vi.fn(),
	drain: vi.fn(),
});

const mockLogger = {
	warn: vi.fn(),
	log: vi.fn(),
};

// Test fixtures
const templateContext: TemplateContext = {
	feature: "mcp-hooks",
	branch: "005-mcp-hooks-integration",
	timestamp: "2025-12-03T10:00:00.000Z",
	user: "Test User",
};

const mockServer: MCPServer = {
	id: "test-server",
	name: "Test MCP Server",
	description: "A test MCP server",
	status: "available",
	tools: [],
	lastDiscovered: Date.now(),
};

const mockTool: MCPTool = {
	name: "test-tool",
	displayName: "Test Tool",
	description: "A test tool",
	inputSchema: {
		type: "object",
		properties: {
			message: { type: "string", description: "Message to send" },
			priority: { type: "number", description: "Priority level" },
		},
		required: ["message"],
	},
	serverId: "test-server",
};

describe("MCPActionExecutor", () => {
	let discoveryService: IMCPDiscoveryService;
	let clientService: IMCPClientService;
	let parameterResolver: IMCPParameterResolver;
	let executionPool: IMCPExecutionPool;
	let executor: MCPActionExecutor;

	beforeEach(() => {
		vi.clearAllMocks();

		discoveryService = createMockDiscoveryService();
		clientService = createMockClientService();
		parameterResolver = createMockParameterResolver();
		executionPool = createMockExecutionPool();

		executor = new MCPActionExecutor({
			discoveryService,
			clientService,
			parameterResolver,
			executionPool,
			logger: mockLogger,
		});
	});

	// T069: Test successful execution path
	describe("successful execution", () => {
		it("should execute MCP action successfully", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [
					{
						toolParam: "message",
						source: "template",
						value: "Feature: $feature",
					},
				],
			};

			// Mock service responses
			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({
				message: "Feature: mcp-hooks",
			});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});

			const executionResult: MCPToolExecutionResult = {
				success: true,
				output: { result: "executed" },
				duration: 100,
			};

			vi.mocked(executionPool.execute).mockImplementation(
				async (task) => await task()
			);
			vi.mocked(clientService.executeTool).mockResolvedValue(executionResult);

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(result.output).toEqual({ result: "executed" });
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(discoveryService.getServer).toHaveBeenCalledWith("test-server");
			expect(parameterResolver.resolve).toHaveBeenCalledWith(
				params.parameterMappings,
				templateContext
			);
			expect(clientService.validateParameters).toHaveBeenCalledWith(
				"test-server",
				"test-tool",
				{ message: "Feature: mcp-hooks" }
			);
			expect(clientService.executeTool).toHaveBeenCalledWith(
				"test-server",
				"test-tool",
				{ message: "Feature: mcp-hooks" },
				30_000 // Default timeout
			);
		});

		it("should use custom timeout when provided", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
				timeout: 60_000,
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});
			vi.mocked(executionPool.execute).mockImplementation(async (task) =>
				task()
			);
			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: true,
				duration: 100,
			});

			await executor.execute(params, templateContext);

			expect(clientService.executeTool).toHaveBeenCalledWith(
				"test-server",
				"test-tool",
				{},
				60_000
			);
		});
	});

	// T070: Test parameter resolution and mapping
	describe("parameter resolution", () => {
		it("should resolve parameters from context", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [
					{
						toolParam: "message",
						source: "context",
						value: "feature",
					},
					{
						toolParam: "branch",
						source: "literal",
						value: "main",
					},
					{
						toolParam: "timestamp",
						source: "template",
						value: "Generated at $timestamp",
					},
				],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({
				message: "mcp-hooks",
				branch: "main",
				timestamp: "Generated at 2025-12-03T10:00:00.000Z",
			});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});
			vi.mocked(executionPool.execute).mockImplementation(async (task) =>
				task()
			);
			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: true,
				duration: 50,
			});

			await executor.execute(params, templateContext);

			expect(parameterResolver.resolve).toHaveBeenCalledWith(
				params.parameterMappings,
				templateContext
			);
			expect(clientService.executeTool).toHaveBeenCalledWith(
				"test-server",
				"test-tool",
				{
					message: "mcp-hooks",
					branch: "main",
					timestamp: "Generated at 2025-12-03T10:00:00.000Z",
				},
				30_000
			);
		});

		it("should handle empty parameter mappings", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});
			vi.mocked(executionPool.execute).mockImplementation(async (task) =>
				task()
			);
			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: true,
				duration: 25,
			});

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(parameterResolver.resolve).toHaveBeenCalledWith(
				[],
				templateContext
			);
		});
	});

	// T071: Test parameter validation failure handling
	describe("parameter validation", () => {
		it("should fail when required parameters are missing", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: false,
				errors: [
					{
						parameter: "message",
						message: "Required parameter 'message' is missing",
						expected: "defined",
						actual: "undefined",
					},
				],
			});

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPParameterValidationError);
			expect(result.error?.message).toContain(
				"Required parameter 'message' is missing"
			);
		});

		it("should fail when parameter types are incorrect", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [
					{
						toolParam: "priority",
						source: "literal",
						value: "high",
					},
				],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({
				priority: "high",
			});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: false,
				errors: [
					{
						parameter: "priority",
						message: "Parameter 'priority' has incorrect type",
						expected: "number",
						actual: "string",
					},
				],
			});

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPParameterValidationError);
			expect(result.error?.message).toContain("incorrect type");
		});

		it("should validate action parameters structure", async () => {
			const invalidParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: "not-an-array", // Invalid - should be array
			} as unknown as MCPActionParams;

			const result = await executor.execute(invalidParams, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPActionValidationError);
			expect(result.error?.message).toContain("Invalid MCP action parameters");
		});

		it("should validate timeout range", async () => {
			const invalidParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
				timeout: 500, // Too short - invalid
			} as unknown as MCPActionParams;

			const result = await executor.execute(invalidParams, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPActionValidationError);
			expect(result.error?.message).toContain("Invalid MCP action parameters");
		});
	});

	// T072: Test timeout handling
	describe("timeout handling", () => {
		it("should handle execution timeout", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
				timeout: 5000,
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});
			vi.mocked(executionPool.execute).mockImplementation(async (task) =>
				task()
			);
			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: false,
				error: {
					code: "MCPTimeoutError",
					message: "MCP tool execution timed out after 5000ms",
					details: { timeout: 5000 },
				},
				duration: 5000,
			});

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPTimeoutError);
			expect(result.error?.message).toContain("timed out");
		});
	});

	// T073: Test concurrency pool limiting
	describe("concurrency control", () => {
		it("should execute tasks through execution pool", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});

			let poolExecuteCalled = false;
			vi.mocked(executionPool.execute).mockImplementation(async (task) => {
				poolExecuteCalled = true;
				return await task();
			});
			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: true,
				duration: 50,
			});

			await executor.execute(params, templateContext);

			expect(poolExecuteCalled).toBe(true);
			expect(executionPool.execute).toHaveBeenCalled();
		});

		it("should handle pool execution errors", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});
			vi.mocked(executionPool.execute).mockRejectedValue(
				new Error("Pool capacity exceeded")
			);

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error?.message).toContain("Pool capacity exceeded");
		});
	});

	describe("server availability", () => {
		it("should fail when server not found", async () => {
			const params: MCPActionParams = {
				serverId: "unknown-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(undefined);

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPServerNotFoundError);
			expect(result.error?.message).toContain("unknown-server");
		});

		it("should fail when server is unavailable", async () => {
			const unavailableServer: MCPServer = {
				...mockServer,
				status: "unavailable",
			};

			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(
				unavailableServer
			);

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPServerUnavailableError);
			expect(result.error?.message).toContain("unavailable");
		});

		it("should log warnings on execution failure", async () => {
			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(undefined);

			await executor.execute(params, templateContext);

			expect(mockLogger.warn).toHaveBeenCalled();
		});
	});

	/**
	 * T095-T098: Error handling scenario tests (User Story 3)
	 */
	describe("Error Handling (User Story 3)", () => {
		/**
		 * T096: Test server unavailable error handling
		 */
		it("should handle server unavailable gracefully", async () => {
			const unavailableServer: MCPServer = {
				...mockServer,
				status: "unavailable",
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(
				unavailableServer
			);

			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPServerUnavailableError);
			expect(result.error?.message).toContain("test-server");
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Server unavailable")
			);
		});

		/**
		 * T097: Test tool not found error handling
		 */
		it("should handle tool not found gracefully", async () => {
			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(undefined);
			vi.mocked(parameterResolver.resolve).mockReturnValue({ message: "test" });
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: false,
				errors: [
					{
						parameter: "toolName",
						message: "Tool 'missing-tool' not found on server 'test-server'",
					},
				],
			});

			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "missing-tool",
				parameterMappings: [],
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPParameterValidationError);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Parameter validation failed")
			);
		});

		/**
		 * T098: Test parameter validation error with detailed messages
		 */
		it("should provide detailed error messages for parameter validation failures", async () => {
			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({
				message: 123, // Wrong type - should be string
			});
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: false,
				errors: [
					{
						parameter: "message",
						message: "Parameter 'message' must be of type string, got number",
						expected: "string",
						actual: "number",
					},
					{
						parameter: "message",
						message: "Required parameter 'message' has invalid value",
					},
				],
			});

			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [
					{
						toolParam: "message",
						source: "literal",
						value: "123",
					},
				],
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(result.error).toBeInstanceOf(MCPParameterValidationError);
			expect(
				(result.error as MCPParameterValidationError).errors[0]?.message
			).toContain("type string");
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Parameter validation failed")
			);
		});

		/**
		 * T092: Test retry logic for transient failures
		 */
		it("should retry transient failures with delay", async () => {
			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({ message: "test" });
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});

			// First attempt fails with timeout (transient), second succeeds
			let attemptCount = 0;
			vi.mocked(executionPool.execute).mockImplementation((fn) => {
				attemptCount += 1;
				if (attemptCount === 1) {
					return {
						success: false,
						error: {
							code: "MCPTimeoutError",
							message: "Execution timed out after 30000ms",
							details: { timeout: 30_000 },
						},
					};
				}
				return fn();
			});

			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: true,
				output: { result: "success after retry" },
				duration: 100,
			});

			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(attemptCount).toBe(2); // Initial + 1 retry
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Retrying")
			);
		});

		/**
		 * T093: Test large output payload truncation
		 */
		it("should truncate large output payloads over 1MB", async () => {
			vi.mocked(discoveryService.getServer).mockResolvedValue(mockServer);
			vi.mocked(discoveryService.getTool).mockResolvedValue(mockTool);
			vi.mocked(parameterResolver.resolve).mockReturnValue({ message: "test" });
			vi.mocked(clientService.validateParameters).mockResolvedValue({
				valid: true,
				errors: [],
			});

			// Create large output (>1MB)
			const largeOutput = "x".repeat(2 * 1024 * 1024); // 2MB string

			vi.mocked(executionPool.execute).mockImplementation(async (fn) => fn());
			vi.mocked(clientService.executeTool).mockResolvedValue({
				success: true,
				output: largeOutput,
				duration: 200,
			});

			const params: MCPActionParams = {
				serverId: "test-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(true);
			expect(result.truncated).toBe(true);
			expect(result.output).toContain("[TRUNCATED");
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Output truncated")
			);
		});

		/**
		 * T090: Test detailed error logging
		 */
		it("should log detailed error information for debugging", async () => {
			const params: MCPActionParams = {
				serverId: "nonexistent-server",
				toolName: "test-tool",
				parameterMappings: [],
			};

			vi.mocked(discoveryService.getServer).mockResolvedValue(undefined);

			const result = await executor.execute(params, templateContext);

			expect(result.success).toBe(false);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Server not found")
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining("Verify server ID")
			);
		});
	});
});
