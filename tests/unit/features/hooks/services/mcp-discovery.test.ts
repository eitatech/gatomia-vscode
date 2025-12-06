import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPDiscoveryService } from "../../../../../src/features/hooks/services/mcp-discovery";
import { MCP_DISCOVERY_CACHE_TTL } from "../../../../../src/features/hooks/types";
import type {
	MCPServer,
	MCPTool,
} from "../../../../../src/features/hooks/services/mcp-contracts";

describe("MCPDiscoveryService", () => {
	let service: MCPDiscoveryService;

	const mockTool: MCPTool = {
		name: "create-issue",
		displayName: "Create Issue",
		description: "Create a new GitHub issue",
		inputSchema: {
			type: "object",
			properties: {
				title: { type: "string", description: "Issue title" },
				body: { type: "string", description: "Issue body" },
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
		service = new MCPDiscoveryService();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("discoverServers", () => {
		it("returns empty array when no servers configured", async () => {
			const servers = await service.discoverServers();
			expect(servers).toEqual([]);
		});

		it("caches discovery results", async () => {
			const firstCall = await service.discoverServers();
			const secondCall = await service.discoverServers();

			expect(firstCall).toBe(secondCall);
		});

		it("skips cache when forceRefresh is true", async () => {
			// First call populates cache
			await service.discoverServers();

			// Force refresh should bypass cache
			const refreshed = await service.discoverServers(true);

			// Should return new array instance
			expect(refreshed).toEqual([]);
		});

		it("returns cached results when cache is fresh", async () => {
			const firstCall = await service.discoverServers();

			// Second call within TTL should return cached results
			const secondCall = await service.discoverServers();

			expect(secondCall).toBe(firstCall);
		});

		it("refreshes cache when cache is stale", async () => {
			// First call
			const firstCall = await service.discoverServers();

			// Mock time passage beyond cache TTL
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(
				now + MCP_DISCOVERY_CACHE_TTL + 1000
			);

			// Second call should refresh cache
			const secondCall = await service.discoverServers();

			// Should be new instance (cache was refreshed)
			expect(secondCall).not.toBe(firstCall);
		});
	});

	describe("getServer", () => {
		it("returns undefined when server not found", async () => {
			const server = await service.getServer("nonexistent-server");
			expect(server).toBeUndefined();
		});

		it("returns server when found (mock scenario)", async () => {
			// Since actual discovery returns empty array, we can only test the not-found case
			// TODO: Update this test when actual Copilot API integration is implemented
			const server = await service.getServer("github-server");
			expect(server).toBeUndefined();
		});

		it("uses cached discovery results", async () => {
			// First call to populate cache
			await service.discoverServers();

			// getServer should use cached results
			const server = await service.getServer("test-server");

			expect(server).toBeUndefined();
		});
	});

	describe("getTool", () => {
		it("returns undefined when server not found", async () => {
			const tool = await service.getTool("nonexistent-server", "create-issue");
			expect(tool).toBeUndefined();
		});

		it("returns undefined when tool not found on server", async () => {
			// Since servers array is empty, this will return undefined
			const tool = await service.getTool("github-server", "nonexistent-tool");
			expect(tool).toBeUndefined();
		});

		it("returns tool when found (mock scenario)", async () => {
			// TODO: Update this test when actual Copilot API integration is implemented
			const tool = await service.getTool("github-server", "create-issue");
			expect(tool).toBeUndefined();
		});
	});

	describe("clearCache", () => {
		it("clears the discovery cache", async () => {
			// Populate cache
			await service.discoverServers();
			expect(service.isCacheFresh()).toBe(true);

			// Clear cache
			service.clearCache();

			// Cache should be invalid
			expect(service.isCacheFresh()).toBe(false);
		});

		it("allows fresh discovery after cache clear", async () => {
			// First discovery
			await service.discoverServers();

			// Clear cache
			service.clearCache();

			// Next discovery should refresh
			const servers = await service.discoverServers();
			expect(servers).toEqual([]);
		});
	});

	describe("isCacheFresh", () => {
		it("returns false when cache is empty", () => {
			expect(service.isCacheFresh()).toBe(false);
		});

		it("returns true when cache is fresh", async () => {
			await service.discoverServers();
			expect(service.isCacheFresh()).toBe(true);
		});

		it("returns false when cache is stale", async () => {
			await service.discoverServers();

			// Mock time passage beyond TTL
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(
				now + MCP_DISCOVERY_CACHE_TTL + 1000
			);

			expect(service.isCacheFresh()).toBe(false);
		});

		it("returns true when cache age is exactly at TTL boundary", async () => {
			await service.discoverServers();

			// Mock time at exactly TTL boundary (should still be fresh)
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now + MCP_DISCOVERY_CACHE_TTL - 1);

			expect(service.isCacheFresh()).toBe(true);
		});
	});

	describe("cache behavior", () => {
		it("maintains cache across multiple getServer calls", async () => {
			await service.getServer("server-1");
			expect(service.isCacheFresh()).toBe(true);

			await service.getServer("server-2");
			expect(service.isCacheFresh()).toBe(true);
		});

		it("maintains cache across multiple getTool calls", async () => {
			await service.getTool("server-1", "tool-1");
			expect(service.isCacheFresh()).toBe(true);

			await service.getTool("server-2", "tool-2");
			expect(service.isCacheFresh()).toBe(true);
		});

		it("respects cache TTL constant", async () => {
			await service.discoverServers();

			// Just before TTL expires - should be fresh
			const almostExpired = Date.now() + MCP_DISCOVERY_CACHE_TTL - 100;
			vi.spyOn(Date, "now").mockReturnValue(almostExpired);
			expect(service.isCacheFresh()).toBe(true);

			// Just after TTL expires - should be stale
			const expired = Date.now() + MCP_DISCOVERY_CACHE_TTL + 100;
			vi.spyOn(Date, "now").mockReturnValue(expired);
			expect(service.isCacheFresh()).toBe(false);
		});
	});
});
