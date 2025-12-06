/**
 * MCP Discovery Service
 *
 * Discovers MCP servers and their available tools from GitHub Copilot configuration.
 * Implements caching to avoid repeated discovery calls.
 */

import {
	queryMCPServers,
	queryMCPTools,
} from "../../../utils/copilot-mcp-utils";
import { MCP_DISCOVERY_CACHE_TTL } from "../types";
import type {
	IMCPDiscoveryService,
	MCPDiscoveryError,
	MCPServer,
	MCPTool,
} from "./mcp-contracts";

/**
 * Discovery cache entry
 */
interface DiscoveryCache {
	servers: MCPServer[];
	timestamp: number;
}

/**
 * MCPDiscoveryService implementation
 *
 * Discovers MCP servers configured in Copilot and caches results
 * for performance optimization.
 */
export class MCPDiscoveryService implements IMCPDiscoveryService {
	private cache: DiscoveryCache | null = null;

	/**
	 * Discover all MCP servers configured in Copilot
	 * @param forceRefresh - Skip cache and force fresh discovery
	 * @returns Promise resolving to array of MCP servers with their tools
	 */
	async discoverServers(forceRefresh = false): Promise<MCPServer[]> {
		// Return cached results if fresh and not forcing refresh
		if (!forceRefresh && this.isCacheFresh()) {
			return this.cache!.servers;
		}

		try {
			// Query MCP servers from Copilot
			const servers = await queryMCPServers();

			// Enrich each server with its tools
			const serversWithTools = await Promise.all(
				servers.map(async (server) => {
					try {
						// Query tools for this server
						const tools = await queryMCPTools(server.id);

						// Return server with populated tools array
						return {
							...server,
							tools,
							lastDiscovered: Date.now(),
						};
					} catch (error) {
						// If tool discovery fails, return server with empty tools
						return {
							...server,
							tools: [] as MCPTool[],
							status: "unavailable" as const,
							lastDiscovered: Date.now(),
						};
					}
				})
			);

			// Update cache with 5-minute TTL
			this.cache = {
				servers: serversWithTools,
				timestamp: Date.now(),
			};

			return serversWithTools;
		} catch (error) {
			const mcpError: MCPDiscoveryError = {
				name: "MCPDiscoveryError",
				message: `Failed to discover MCP servers: ${error instanceof Error ? error.message : String(error)}`,
				cause: error instanceof Error ? error : undefined,
			};
			throw mcpError;
		}
	}

	/**
	 * Get a specific MCP server by ID
	 * @param serverId - Server identifier
	 * @returns Promise resolving to server or undefined if not found
	 */
	async getServer(serverId: string): Promise<MCPServer | undefined> {
		const servers = await this.discoverServers();
		return servers.find((server) => server.id === serverId);
	}

	/**
	 * Get a specific tool from a server
	 * @param serverId - Server identifier
	 * @param toolName - Tool name
	 * @returns Promise resolving to tool or undefined if not found
	 */
	async getTool(
		serverId: string,
		toolName: string
	): Promise<MCPTool | undefined> {
		const server = await this.getServer(serverId);
		if (!server) {
			return;
		}

		return server.tools.find((tool) => tool.name === toolName);
	}

	/**
	 * Clear the discovery cache
	 */
	clearCache(): void {
		this.cache = null;
	}

	/**
	 * Check if cache is fresh
	 */
	isCacheFresh(): boolean {
		if (!this.cache) {
			return false;
		}

		const age = Date.now() - this.cache.timestamp;
		return age < MCP_DISCOVERY_CACHE_TTL;
	}
}
