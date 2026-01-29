/**
 * Copilot MCP Utilities
 *
 * Functions for interacting with GitHub Copilot's Model Context Protocol (MCP) servers
 * through the VS Code Extension API.
 */

import {
	CancellationTokenSource,
	type Extension,
	env,
	extensions,
	lm,
	version,
} from "vscode";
import { existsSync, readFileSync } from "fs";
import { getMcpConfigPath } from "./platform-utils";
import type { MCPServer, MCPTool } from "../features/hooks/types";

// Regex constant moved to top level for performance
const TOOL_NAME_SEPARATOR_REGEX = /[_\-. ]/;
const SERVER_PATH_SEPARATOR_REGEX = /[-_]/;

/**
 * MCP Configuration file structure
 */
interface MCPConfig {
	mcpServers: Record<string, MCPServerConfig>;
}

interface MCPServerConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

/**
 * Load MCP configuration from VS Code user settings
 *
 * Dynamically detects the correct path for the current VS Code profile
 * and platform (Windows, macOS, Linux, WSL).
 * Automatically finds the active profile's mcp.json if using VS Code profiles.
 *
 * @returns Map of server IDs to their configuration, or empty map if config not found
 */
async function loadMCPConfig(): Promise<Map<string, MCPServerConfig>> {
	try {
		// Get the MCP config path (automatically handles profiles)
		const mcpConfigPath = await getMcpConfigPath();

		console.info(`[MCP] Looking for config at: ${mcpConfigPath}`);

		if (!existsSync(mcpConfigPath)) {
			console.warn(`[MCP] Config file not found at: ${mcpConfigPath}`);
			return new Map();
		}

		const content = readFileSync(mcpConfigPath, "utf-8");
		const config = JSON.parse(content) as MCPConfig;

		if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
			console.warn("[MCP] Config file exists but has no servers configured");
			return new Map();
		}

		console.info(`[MCP] Loaded config from: ${mcpConfigPath}`);
		console.info(
			`[MCP] Found ${Object.keys(config.mcpServers).length} configured servers: ${Object.keys(config.mcpServers).join(", ")}`
		);

		return new Map(Object.entries(config.mcpServers));
	} catch (error) {
		console.error("[MCP] Failed to load MCP config:", error);
		return new Map();
	}
}

/**
 * Query available MCP servers from GitHub Copilot
 *
 * Uses VS Code's Language Model API (vscode.lm.tools) to discover all registered MCP tools.
 * Groups tools by their server name (extracted from tool name prefix).
 *
 * @returns Promise resolving to array of discovered MCP servers
 * @throws Error if Language Model API is unavailable or query fails
 */
export async function queryMCPServers(): Promise<MCPServer[]> {
	try {
		// Access registered language model tools
		if (!lm?.tools) {
			console.warn("[MCP] Language Model API not available");
			return [];
		}

		const allTools = lm.tools;

		if (allTools.length === 0) {
			console.info("[MCP] No MCP tools registered in Language Model API");
			return [];
		}

		console.info(
			`[MCP] Discovered ${allTools.length} registered tools from Language Model API`
		);

		// Log first few tool names for debugging
		if (allTools.length > 0) {
			const sampleTools = allTools.slice(0, 5).map((t) => t.name);
			console.info(`[MCP] Sample tool names: ${sampleTools.join(", ")}`);
		}

		// Load MCP configuration to know which servers are configured
		const mcpConfig = await loadMCPConfig();
		const configuredServerIds = Array.from(mcpConfig.keys());

		console.info(`[MCP] Configured servers: ${configuredServerIds.join(", ")}`);

		// Group tools by server using correlation heuristics
		const serverMap = new Map<string, MCPTool[]>();

		for (const toolInfo of allTools) {
			// Correlate tool with configured server
			const serverId = correlateToolWithServer(
				toolInfo.name,
				configuredServerIds
			);

			// Convert LanguageModelToolInformation to MCPTool
			const mcpTool: MCPTool = {
				name: toolInfo.name,
				displayName: formatDisplayName(toolInfo.name, serverId),
				description: toolInfo.description || "No description available",
				inputSchema: {
					type: "object",
					properties: (toolInfo.inputSchema as any)?.properties || {},
					required: (toolInfo.inputSchema as any)?.required || [],
				},
				serverId,
			};

			if (!serverMap.has(serverId)) {
				serverMap.set(serverId, []);
			}
			serverMap.get(serverId)!.push(mcpTool);
		}

		// Convert map to MCPServer array
		const servers: MCPServer[] = Array.from(serverMap.entries()).map(
			([serverId, tools]) => ({
				id: serverId,
				name: formatServerName(serverId),
				description: `MCP server with ${tools.length} available tools`,
				status: "available" as const,
				tools,
				lastDiscovered: Date.now(),
			})
		);

		console.info(
			`[MCP] Discovered ${servers.length} MCP servers: ${servers.map((s) => s.id).join(", ")}`
		);

		return servers;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		console.error(`[MCP] Failed to query MCP servers: ${message}`);
		throw new Error(`Failed to query MCP servers: ${message}`);
	}
}

/**
 * Query available tools for a specific MCP server
 *
 * Filters all registered Language Model tools to find those belonging to the specified server.
 *
 * @param serverId - ID of the MCP server to query
 * @returns Promise resolving to array of tools available on the server
 * @throws Error if server not found or query fails
 */
export async function queryMCPTools(serverId: string): Promise<MCPTool[]> {
	try {
		if (!lm?.tools) {
			console.warn("[MCP] Language Model API not available");
			return [];
		}

		const allTools = lm.tools;

		// Load MCP configuration to get all configured servers
		const mcpConfig = await loadMCPConfig();
		const configuredServerIds = Array.from(mcpConfig.keys());

		// Filter tools that belong to this server
		const serverTools: MCPTool[] = [];

		for (const toolInfo of allTools) {
			const toolServerId = correlateToolWithServer(
				toolInfo.name,
				configuredServerIds
			);

			if (toolServerId === serverId) {
				const mcpTool: MCPTool = {
					name: toolInfo.name,
					displayName: formatDisplayName(toolInfo.name, serverId),
					description: toolInfo.description || "No description available",
					inputSchema: {
						type: "object",
						properties: (toolInfo.inputSchema as any)?.properties || {},
						required: (toolInfo.inputSchema as any)?.required || [],
					},
					serverId,
				};
				serverTools.push(mcpTool);
			}
		}

		console.info(
			`[MCP] Found ${serverTools.length} tools for server '${serverId}'`
		);

		return serverTools;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		console.error(
			`[MCP] Failed to query tools for server '${serverId}': ${message}`
		);
		throw new Error(
			`Failed to query MCP tools for server '${serverId}': ${message}`
		);
	}
}

/**
 * Execute an MCP tool with given parameters
 *
 * Uses VS Code's Language Model API (vscode.lm.invokeTool) to execute the tool.
 *
 * @param serverId - ID of the MCP server hosting the tool
 * @param toolName - Name of the tool to execute
 * @param parameters - Tool parameters as key-value pairs
 * @returns Promise resolving to tool execution result
 * @throws Error if server/tool not found or execution fails
 */
export async function executeMCPTool(
	serverId: string,
	toolName: string,
	parameters: Record<string, unknown>
): Promise<unknown> {
	try {
		if (!lm?.invokeTool) {
			throw new Error("Language Model API not available");
		}

		console.info(
			`[MCP] Executing tool '${toolName}' on server '${serverId}' with parameters:`,
			parameters
		);

		// Invoke the tool using VS Code's Language Model API
		const result = await lm.invokeTool(
			toolName,
			{ input: parameters },
			new CancellationTokenSource().token
		);

		console.info(
			`[MCP] Tool '${toolName}' executed successfully. Result:`,
			result
		);

		return result;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		console.error(
			`[MCP] Failed to execute tool '${toolName}' on server '${serverId}': ${message}`
		);
		throw new Error(
			`Failed to execute MCP tool '${toolName}' on server '${serverId}': ${message}`
		);
	}
}

/**
 * Check if Language Model API with MCP tools is available
 *
 * This checks for the VS Code Language Model API (vscode.lm) which is used
 * to access MCP tools, rather than checking for the Copilot extension directly.
 *
 * @returns Promise resolving to true if Language Model API is available, false otherwise
 */
export function isCopilotAvailable(): boolean {
	try {
		// Check if Language Model API is available
		if (!lm?.tools) {
			console.warn(
				"[MCP] Language Model API not available in this VS Code version"
			);
			return false;
		}

		// Check if there are any registered tools
		const hasTools = lm.tools.length > 0;

		if (!hasTools) {
			console.info(
				"[MCP] Language Model API available but no MCP tools registered yet"
			);
		}

		return true; // API is available even if no tools are registered yet
	} catch (error) {
		console.error(
			"[MCP] Error checking Language Model API availability:",
			error
		);
		return false;
	}
}

/**
 * Get the Copilot extension API
 *
 * @returns Promise resolving to Copilot extension API or undefined if unavailable
 */
export async function getCopilotExtension(): Promise<
	Extension<unknown> | undefined
> {
	try {
		const copilotExtension = extensions.getExtension("github.copilot");
		if (!copilotExtension) {
			return;
		}

		// Activate if needed
		if (!copilotExtension.isActive) {
			await copilotExtension.activate();
		}

		return copilotExtension;
	} catch (error) {
		return;
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Correlate a tool name with a configured MCP server
 *
 * Uses heuristics to match tool names with server IDs from mcp.json:
 * 1. Exact match: tool name contains server ID
 * 2. Partial match: tool name contains parts of server ID
 * 3. Keywords: tool name matches known server patterns
 * 4. Fallback: "other-tools" for unmatched tools
 *
 * Examples:
 * - "mcp_github_search_repositories" → "github"
 * - "github_create_or_update_file" → "github"
 * - "mcp_sequentialthinking_think" → "sequentialthinking"
 * - "terminal_last_command" → "vscode-tools"
 *
 * @param toolName - Full tool name from vscode.lm.tools
 * @param configuredServerIds - List of server IDs from mcp.json
 * @returns Server ID that best matches the tool
 */
function correlateToolWithServer(
	toolName: string,
	configuredServerIds: string[]
): string {
	const normalizedToolName = toolName.toLowerCase();

	// Check for VS Code built-in tools (not MCP)
	if (isVSCodeBuiltInTool(normalizedToolName)) {
		return "vscode-tools";
	}

	// Try to match with configured servers
	const matchedServer = findMatchingServer(
		normalizedToolName,
		configuredServerIds
	);
	if (matchedServer) {
		return matchedServer;
	}

	// Try to extract from mcp_ prefix pattern
	const extractedServer = extractFromMCPPattern(
		normalizedToolName,
		configuredServerIds
	);
	if (extractedServer) {
		return extractedServer;
	}

	// Fallback: group under "other-tools"
	return "other-tools";
}

/**
 * Check if tool is a VS Code built-in tool
 */
function isVSCodeBuiltInTool(normalizedToolName: string): boolean {
	return (
		normalizedToolName.startsWith("vscode_") ||
		normalizedToolName.startsWith("terminal_") ||
		normalizedToolName.includes("_confirmation")
	);
}

/**
 * Find matching server for a tool name
 */
function findMatchingServer(
	normalizedToolName: string,
	configuredServerIds: string[]
): string | undefined {
	for (const serverId of configuredServerIds) {
		if (matchesServer(normalizedToolName, serverId)) {
			return serverId;
		}
	}
	return;
}

/**
 * Check if tool name matches a server ID
 */
function matchesServer(normalizedToolName: string, serverId: string): boolean {
	const normalizedServerId = serverId.toLowerCase();

	// Direct match
	if (normalizedToolName.includes(normalizedServerId)) {
		return true;
	}

	// Path-based match (e.g., "oraios/serena")
	if (serverId.includes("/")) {
		const parts = serverId.split("/");
		return parts.some((part) =>
			normalizedToolName.includes(part.toLowerCase())
		);
	}

	// Hyphenated match (e.g., "firecrawl-mcp-server")
	if (serverId.includes("-")) {
		const mainPart = serverId.split("-")[0];
		return normalizedToolName.includes(mainPart.toLowerCase());
	}

	return false;
}

/**
 * Extract server ID from mcp_ prefix pattern
 */
function extractFromMCPPattern(
	normalizedToolName: string,
	configuredServerIds: string[]
): string | undefined {
	if (!normalizedToolName.startsWith("mcp_")) {
		return;
	}

	const withoutPrefix = normalizedToolName.substring(4);
	const parts = withoutPrefix.split("_");

	// Check if first part matches any configured server
	for (const serverId of configuredServerIds) {
		if (parts[0] === serverId.toLowerCase()) {
			return serverId;
		}
	}

	return;
}

/**
 * Format server name for display
 *
 * Converts server ID to a human-readable name.
 * Includes mappings for known MCP servers based on common configurations.
 *
 * Examples:
 * - "github" → "GitHub"
 * - "microsoft/playwright-mcp" → "Microsoft Playwright"
 * - "io.github.github/github-mcp-server" → "GitHub MCP Server"
 * - "sequentialthinking" → "Sequential Thinking"
 *
 * @param serverId - Server identifier
 * @returns Formatted server name
 */
function formatServerName(serverId: string): string {
	// Handle known server names with exact mappings
	const knownServers: Record<string, string> = {
		// Special groups
		"vscode-tools": "VS Code Tools",
		"other-tools": "Other Tools",
		// Simple names
		sequentialthinking: "Sequential Thinking",
		memory: "Memory",
		alchemy: "Alchemy",
		flipside: "Flipside",
		etherscan: "Etherscan",
		// Path-based servers
		"microsoft/playwright-mcp": "Microsoft Playwright",
		"firecrawl/firecrawl-mcp-server": "Firecrawl",
		"oraios/serena": "Oraios Serena",
		// Reverse domain notation
		"io.github.github/github-mcp-server": "GitHub MCP Server",
		"io.github.upstash/context7": "Upstash Context7",
		// Other known servers
		github: "GitHub",
		gitlab: "GitLab",
		slack: "Slack",
		notion: "Notion",
		jira: "Jira",
		trello: "Trello",
		asana: "Asana",
	};

	// Check if we have a known mapping
	if (knownServers[serverId.toLowerCase()]) {
		return knownServers[serverId.toLowerCase()];
	}

	// For unknown servers, try to format intelligently
	// Handle reverse domain notation (io.github.org/server-name → Server Name)
	if (serverId.includes("/")) {
		const parts = serverId.split("/");
		const lastPart = parts.at(-1);
		if (lastPart) {
			return formatServerNameFromPath(lastPart);
		}
	}

	// Handle dot notation (io.github.org → Io Github Org)
	if (serverId.includes(".")) {
		return serverId
			.split(".")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	}

	// Default: capitalize first letter
	return serverId.charAt(0).toUpperCase() + serverId.slice(1);
}

/**
 * Format server name from path component
 *
 * Converts path-style server names to display format.
 * Examples:
 * - "playwright-mcp" → "Playwright MCP"
 * - "github-mcp-server" → "GitHub MCP Server"
 *
 * @param pathPart - Last part of server path
 * @returns Formatted name
 */
function formatServerNameFromPath(pathPart: string): string {
	return pathPart
		.split(SERVER_PATH_SEPARATOR_REGEX)
		.map((word) => {
			// Handle known acronyms
			if (word.toLowerCase() === "mcp") {
				return "MCP";
			}
			if (word.toLowerCase() === "github") {
				return "GitHub";
			}
			if (word.toLowerCase() === "gitlab") {
				return "GitLab";
			}
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(" ");
}

/**
 * Format tool name for display
 *
 * Converts tool name to a human-readable display name by removing
 * server prefixes and formatting the action name.
 *
 * Examples:
 * - "mcp_github_search_repositories" → "Search Repositories"
 * - "github_create_or_update_file" → "Create Or Update File"
 * - "mcp_sequentialthinking_think" → "Think"
 * - "terminal_last_command" → "Terminal Last Command"
 *
 * @param toolName - Full tool name from vscode.lm.tools
 * @param serverId - Server ID the tool belongs to (used to remove server prefix)
 * @returns Formatted display name
 */
function formatDisplayName(toolName: string, serverId: string): string {
	let actionPart = toolName.toLowerCase();

	// Remove common prefixes
	if (actionPart.startsWith("mcp_")) {
		actionPart = actionPart.substring(4);
	}

	// Remove server ID from the tool name if present
	const normalizedServerId = serverId.toLowerCase().replace(/[/-]/g, "_");
	if (actionPart.startsWith(`${normalizedServerId}_`)) {
		actionPart = actionPart.substring(normalizedServerId.length + 1);
	}

	// Handle path-based server IDs (e.g., "oraios/serena")
	if (serverId.includes("/")) {
		for (const part of serverId.split("/")) {
			const normalizedPart = part.toLowerCase();
			if (actionPart.startsWith(`${normalizedPart}_`)) {
				actionPart = actionPart.substring(normalizedPart.length + 1);
			}
		}
	}

	// Convert to title case
	return actionPart
		.split(TOOL_NAME_SEPARATOR_REGEX)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * Get VS Code version information
 *
 * Detects whether running in VS Code Stable or Insiders.
 *
 * @returns Object with version info
 */
export function getVSCodeVersionInfo(): {
	version: string;
	isInsiders: boolean;
	productName: string;
} {
	const isInsiders =
		env.appName.includes("Insiders") || env.appName.includes("insider");

	return {
		version,
		isInsiders,
		productName: env.appName,
	};
}
