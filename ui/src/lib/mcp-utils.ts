/**
 * MCP Utility Functions for UI
 *
 * UI-compatible versions of MCP parsing and formatting functions.
 * These functions extract server IDs and format display names from
 * MCP tool names following the convention: mcp_<server-id>_<tool-name>
 */

// Regex for splitting server path components (e.g., "github-mcp-server" → ["github", "mcp", "server"])
const SERVER_PATH_SEPARATOR_REGEX = /[-_]/;

// Regex for splitting tool name components
const TOOL_NAME_SEPARATOR_REGEX = /[_\-. ]/;

/**
 * Extract server ID from MCP tool name
 *
 * MCP tool names from vscode.lm.tools typically follow pattern:
 * "mcp_<server-id>_<tool-name>"
 *
 * Server IDs can be:
 * - Simple names: "sequentialthinking", "memory", "alchemy"
 * - Paths with slashes: "microsoft/playwright-mcp", "firecrawl/firecrawl-mcp-server"
 * - Reverse domain notation: "io.github.github/github-mcp-server", "io.github.upstash/context7"
 *
 * IMPORTANT: Server IDs do NOT contain underscores. They may contain:
 * - Dots (.) for domain notation
 * - Slashes (/) for paths
 * - Hyphens (-) for word separation within segments
 *
 * Examples:
 * - "mcp_sequentialthinking_think" → "sequentialthinking"
 * - "mcp_memory_add_observations" → "memory"
 * - "mcp_io.github.github/github-mcp-server_create_or_update_file" → "io.github.github/github-mcp-server"
 * - "mcp_microsoft/playwright-mcp_take_screenshot" → "microsoft/playwright-mcp"
 *
 * @param toolName - Full MCP tool name from vscode.lm.tools
 * @returns Server ID extracted from tool name
 */
export function extractServerIdFromToolName(toolName: string): string {
	if (!toolName.startsWith("mcp_")) {
		// Fallback for non-standard naming
		return toolName.toLowerCase();
	}

	// Remove "mcp_" prefix
	const withoutPrefix = toolName.substring(4);

	// Server IDs do NOT contain underscores - find the first underscore to get the boundary
	// For complex server IDs (with / or .), we need to find where the server ends
	// Strategy: find the first underscore that is NOT part of a path segment

	// Check if this looks like a path-based or domain-based server ID
	// These contain / or . and the server ID ends at the underscore after the path
	if (withoutPrefix.includes("/") || withoutPrefix.includes(".")) {
		// Find the position of the first underscore that comes AFTER any / or .
		// This is where the tool action begins
		const slashIndex = withoutPrefix.lastIndexOf("/");
		const dotIndex = withoutPrefix.lastIndexOf(".");
		const pathEnd = Math.max(slashIndex, dotIndex);

		if (pathEnd !== -1) {
			// Find the underscore after the path segment
			const underscoreAfterPath = withoutPrefix.indexOf("_", pathEnd);
			if (underscoreAfterPath !== -1) {
				return withoutPrefix.substring(0, underscoreAfterPath).toLowerCase();
			}
		}
	}

	// Simple server ID - find the first underscore
	const firstUnderscoreIndex = withoutPrefix.indexOf("_");

	if (firstUnderscoreIndex === -1) {
		// No underscore found, entire string is server ID
		return withoutPrefix.toLowerCase();
	}

	// Extract server ID (everything before first underscore)
	const serverId = withoutPrefix.substring(0, firstUnderscoreIndex);
	return serverId.toLowerCase();
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
export function formatServerName(serverId: string): string {
	// Handle known server names with exact mappings
	const knownServers: Record<string, string> = {
		// Simple names
		sequentialthinking: "Sequential Thinking",
		memory: "Memory",
		alchemy: "Alchemy",
		flipside: "Flipside",
		etherscan: "Etherscan",
		// Path-based servers
		"microsoft/playwright-mcp": "Playwright MCP",
		"firecrawl/firecrawl-mcp-server": "Firecrawl MCP Server",
		"oraios/serena": "Serena",
		// Reverse domain notation
		"io.github.github/github-mcp-server": "GitHub MCP Server",
		"io.github.upstash/context7": "Context7",
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
	const lowerServerId = serverId.toLowerCase();
	if (knownServers[lowerServerId]) {
		return knownServers[lowerServerId];
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
 * Format tool name for display
 *
 * Converts tool name to a human-readable display name.
 * Handles the MCP naming convention: mcp_<server-id>_<tool-name>
 *
 * The function extracts the action part by removing the server ID from the tool name.
 * This ensures compound action names are fully displayed.
 *
 * Examples:
 * - "mcp_memory_add_observations" → "Add Observations"
 * - "mcp_github_search_repositories" → "Search Repositories"
 * - "mcp_sequentialthinking_think" → "Think"
 * - "mcp_io.github.github/github-mcp-server_create_or_update_file" → "Create Or Update File"
 *
 * @param toolName - Full MCP tool name from vscode.lm.tools
 * @returns Formatted display name
 */
export function formatDisplayName(toolName: string): string {
	// First extract the server ID to know how much to remove
	const serverId = extractServerIdFromToolName(toolName);

	// Remove mcp_ prefix if present
	let remaining = toolName;
	if (toolName.startsWith("mcp_")) {
		remaining = toolName.substring(4);
	}

	// Remove the server ID prefix and the underscore separator
	// The action part is everything after "serverId_"
	const serverIdPrefix = `${serverId}_`;
	let actionPart = remaining;

	if (remaining.toLowerCase().startsWith(serverIdPrefix.toLowerCase())) {
		actionPart = remaining.substring(serverIdPrefix.length);
	} else if (remaining.toLowerCase() === serverId.toLowerCase()) {
		// Edge case: tool name is just the server ID (no action part)
		actionPart = serverId;
	}

	// Convert underscores, hyphens, dots, spaces to title case words
	return actionPart
		.split(TOOL_NAME_SEPARATOR_REGEX)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}
