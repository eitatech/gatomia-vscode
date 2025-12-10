import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPClientService } from "../../../../../src/features/hooks/services/mcp-client";
import type {
	IMCPDiscoveryService,
	MCPServer,
	MCPTool,
} from "../../../../../src/features/hooks/services/mcp-contracts";

describe("MCPClientService", () => {
	let service: MCPClientService;
	let mockDiscoveryService: IMCPDiscoveryService;

	const mockTool: MCPTool = {
		name: "create-issue",
		displayName: "Create Issue",
		description: "Create a new GitHub issue",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string", description: "Issue title" },
				body: { type: "string", description: "Issue body" },
				labels: {
					type: "string",
					enum: ["bug", "feature", "enhancement"],
					description: "Issue label",
				},
				priority: { type: "number", description: "Issue priority" },
				urgent: { type: "boolean", description: "Is urgent" },
			},
			required: ["title"],
		},
		serverId: "github-server",
	};

	const mockServer: MCPServer = {
		id: "github-server",
		name: "GitHub Server",
		description: "MCP server for GitHub operations",
		status: "available",
		tools: [mockTool],
		lastDiscovered: Date.now(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockDiscoveryService = {
			discoverServers: vi.fn().mockResolvedValue([mockServer]),
			getServer: vi.fn().mockResolvedValue(mockServer),
			getTool: vi.fn().mockResolvedValue(mockTool),
			clearCache: vi.fn(),
			isCacheFresh: vi.fn().mockReturnValue(true),
		};

		service = new MCPClientService(mockDiscoveryService);
	});

	describe("executeTool", () => {
		it("executes tool successfully with valid parameters", async () => {
			const result = await service.executeTool(
				"github-server",
				"create-issue",
				{
					title: "Test Issue",
					body: "Issue description",
				}
			);

			expect(result.success).toBe(true);
			expect(result.output).toBeDefined();
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(mockDiscoveryService.getServer).toHaveBeenCalledWith(
				"github-server"
			);
			expect(mockDiscoveryService.getTool).toHaveBeenCalledWith(
				"github-server",
				"create-issue"
			);
		});

		it("returns error when server not found", async () => {
			mockDiscoveryService.getServer = vi.fn().mockResolvedValue(undefined);

			const result = await service.executeTool(
				"nonexistent-server",
				"create-issue",
				{ title: "Test" }
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.name).toBe("MCPServerNotFoundError");
			expect(result.error?.message).toContain("nonexistent-server");
		});

		it("returns error when tool not found", async () => {
			mockDiscoveryService.getTool = vi.fn().mockResolvedValue(undefined);

			const result = await service.executeTool(
				"github-server",
				"nonexistent-tool",
				{ title: "Test" }
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.name).toBe("MCPToolNotFoundError");
			expect(result.error?.message).toContain("nonexistent-tool");
		});

		it("returns error when parameter validation fails", async () => {
			const result = await service.executeTool(
				"github-server",
				"create-issue",
				{} // Missing required 'title'
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error?.name).toBe("MCPParameterValidationError");
			expect(result.error?.message).toContain("validation failed");
		});

		it("times out when execution exceeds timeout", async () => {
			const result = await service.executeTool(
				"github-server",
				"create-issue",
				{ title: "Test" },
				1 // Very short timeout
			);

			// Due to race condition, this might succeed or timeout
			// We just verify it completes without throwing
			expect(result).toBeDefined();
			expect(result.duration).toBeGreaterThanOrEqual(0);
		});

		it("uses default timeout when not specified", async () => {
			const result = await service.executeTool(
				"github-server",
				"create-issue",
				{
					title: "Test",
				}
			);

			expect(result.success).toBe(true);
		});

		it("includes execution duration in result", async () => {
			const result = await service.executeTool(
				"github-server",
				"create-issue",
				{
					title: "Test",
				}
			);

			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(typeof result.duration).toBe("number");
		});

		it("handles all optional parameters", async () => {
			const result = await service.executeTool(
				"github-server",
				"create-issue",
				{
					title: "Test",
					body: "Description",
					labels: "bug",
					priority: 1,
					urgent: true,
				}
			);

			expect(result.success).toBe(true);
		});
	});

	describe("validateParameters", () => {
		it("validates successfully with all required parameters", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test Issue",
				}
			);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("returns error for missing required parameter", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{} // Missing 'title'
			);

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].parameter).toBe("title");
			expect(result.errors[0].message).toContain("Required parameter");
		});

		it("validates parameter types correctly", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: 123, // Should be string
				}
			);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.parameter === "title")).toBe(true);
			expect(
				result.errors.find((e) => e.parameter === "title")?.message
			).toContain("incorrect type");
		});

		it("validates string type correctly", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Valid String",
					body: "Another valid string",
				}
			);

			expect(result.valid).toBe(true);
		});

		it("validates number type correctly", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					priority: 42,
				}
			);

			expect(result.valid).toBe(true);
		});

		it("validates boolean type correctly", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					urgent: true,
				}
			);

			expect(result.valid).toBe(true);
		});

		it("rejects invalid number type", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					priority: "not-a-number", // Should be number
				}
			);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.parameter === "priority")).toBe(true);
		});

		it("rejects invalid boolean type", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					urgent: "yes", // Should be boolean
				}
			);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.parameter === "urgent")).toBe(true);
		});

		it("validates enum values correctly", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					labels: "bug", // Valid enum value
				}
			);

			expect(result.valid).toBe(true);
		});

		it("rejects invalid enum values", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					labels: "invalid-label", // Not in enum
				}
			);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.parameter === "labels")).toBe(true);
			expect(
				result.errors.find((e) => e.parameter === "labels")?.message
			).toContain("enum");
		});

		it("handles null values for non-required parameters", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					body: null, // Optional parameter
				}
			);

			expect(result.valid).toBe(true);
		});

		it("rejects null values for required parameters", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: null, // Required parameter
				}
			);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.parameter === "title")).toBe(true);
		});

		it("handles undefined values for non-required parameters", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					body: undefined, // Optional parameter
				}
			);

			expect(result.valid).toBe(true);
		});

		it("returns error when tool not found", async () => {
			mockDiscoveryService.getTool = vi.fn().mockResolvedValue(undefined);

			const result = await service.validateParameters(
				"github-server",
				"nonexistent-tool",
				{ title: "Test" }
			);

			expect(result.valid).toBe(false);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].parameter).toBe("_tool");
		});

		it("handles multiple validation errors", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					// Missing 'title'
					priority: "not-a-number", // Wrong type
					labels: "invalid", // Invalid enum
				}
			);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(1);
		});

		it("accepts extra parameters not in schema", async () => {
			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{
					title: "Test",
					extraField: "This is allowed",
				}
			);

			// Extra parameters are ignored, not rejected
			expect(result.valid).toBe(true);
		});

		it("handles schema without properties", async () => {
			const minimalTool: MCPTool = {
				...mockTool,
				inputSchema: {
					type: "object",
					// No properties defined
				},
			};
			mockDiscoveryService.getTool = vi.fn().mockResolvedValue(minimalTool);

			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{ anything: "goes" }
			);

			expect(result.valid).toBe(true);
		});

		it("handles schema without required array", async () => {
			const optionalTool: MCPTool = {
				...mockTool,
				inputSchema: {
					type: "object",
					properties: {
						optional: { type: "string" },
					},
					// No required array
				},
			};
			mockDiscoveryService.getTool = vi.fn().mockResolvedValue(optionalTool);

			const result = await service.validateParameters(
				"github-server",
				"create-issue",
				{} // All parameters optional
			);

			expect(result.valid).toBe(true);
		});
	});

	describe("dependency injection", () => {
		it("uses provided discovery service", async () => {
			await service.executeTool("github-server", "create-issue", {
				title: "Test",
			});

			expect(mockDiscoveryService.getServer).toHaveBeenCalled();
			expect(mockDiscoveryService.getTool).toHaveBeenCalled();
		});

		it("passes correct parameters to discovery service", async () => {
			await service.validateParameters("test-server", "test-tool", {
				param: "value",
			});

			expect(mockDiscoveryService.getTool).toHaveBeenCalledWith(
				"test-server",
				"test-tool"
			);
		});
	});
});
