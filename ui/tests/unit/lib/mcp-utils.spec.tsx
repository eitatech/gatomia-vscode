import { describe, expect, it } from "vitest";
import {
	extractServerIdFromToolName,
	formatDisplayName,
	formatServerName,
} from "../../../src/lib/mcp-utils";

describe("MCP Utils", () => {
	describe("extractServerIdFromToolName", () => {
		describe("simple server IDs (no underscores in server name)", () => {
			it("should extract 'memory' from 'mcp_memory_add_observations'", () => {
				expect(extractServerIdFromToolName("mcp_memory_add_observations")).toBe(
					"memory"
				);
			});

			it("should extract 'memory' from 'mcp_memory_create_entities'", () => {
				expect(extractServerIdFromToolName("mcp_memory_create_entities")).toBe(
					"memory"
				);
			});

			it("should extract 'memory' from 'mcp_memory_read_graph'", () => {
				expect(extractServerIdFromToolName("mcp_memory_read_graph")).toBe(
					"memory"
				);
			});

			it("should extract 'github' from 'mcp_github_search_repositories'", () => {
				expect(
					extractServerIdFromToolName("mcp_github_search_repositories")
				).toBe("github");
			});

			it("should extract 'github' from 'mcp_github_create_pull_request'", () => {
				expect(
					extractServerIdFromToolName("mcp_github_create_pull_request")
				).toBe("github");
			});

			it("should extract 'sequentialthinking' from 'mcp_sequentialthinking_think'", () => {
				expect(
					extractServerIdFromToolName("mcp_sequentialthinking_think")
				).toBe("sequentialthinking");
			});

			it("should extract 'alchemy' from 'mcp_alchemy_get_block'", () => {
				expect(extractServerIdFromToolName("mcp_alchemy_get_block")).toBe(
					"alchemy"
				);
			});
		});

		describe("path-based server IDs (with slashes)", () => {
			it("should extract 'microsoft/playwright-mcp' from 'mcp_microsoft/playwright-mcp_take_screenshot'", () => {
				expect(
					extractServerIdFromToolName(
						"mcp_microsoft/playwright-mcp_take_screenshot"
					)
				).toBe("microsoft/playwright-mcp");
			});

			it("should extract 'firecrawl/firecrawl-mcp-server' from 'mcp_firecrawl/firecrawl-mcp-server_scrape'", () => {
				expect(
					extractServerIdFromToolName(
						"mcp_firecrawl/firecrawl-mcp-server_scrape"
					)
				).toBe("firecrawl/firecrawl-mcp-server");
			});
		});

		describe("reverse domain notation server IDs (with dots and slashes)", () => {
			it("should extract 'io.github.github/github-mcp-server' from 'mcp_io.github.github/github-mcp-server_create_or_update_file'", () => {
				expect(
					extractServerIdFromToolName(
						"mcp_io.github.github/github-mcp-server_create_or_update_file"
					)
				).toBe("io.github.github/github-mcp-server");
			});

			it("should extract 'io.github.upstash/context7' from 'mcp_io.github.upstash/context7_get_library_docs'", () => {
				expect(
					extractServerIdFromToolName(
						"mcp_io.github.upstash/context7_get_library_docs"
					)
				).toBe("io.github.upstash/context7");
			});

			it("should extract 'io.github.ups' from 'mcp_io.github.ups_resolve-library-id'", () => {
				expect(
					extractServerIdFromToolName("mcp_io.github.ups_resolve-library-id")
				).toBe("io.github.ups");
			});
		});

		describe("edge cases", () => {
			it("should handle tool name without mcp_ prefix", () => {
				expect(extractServerIdFromToolName("custom_tool")).toBe("custom_tool");
			});

			it("should handle tool name with only server ID (no action)", () => {
				expect(extractServerIdFromToolName("mcp_memory")).toBe("memory");
			});

			it("should return lowercase", () => {
				expect(extractServerIdFromToolName("mcp_GitHub_search")).toBe("github");
			});
		});
	});

	describe("formatDisplayName", () => {
		describe("simple server IDs", () => {
			it("should format 'mcp_memory_add_observations' as 'Add Observations'", () => {
				expect(formatDisplayName("mcp_memory_add_observations")).toBe(
					"Add Observations"
				);
			});

			it("should format 'mcp_memory_create_entities' as 'Create Entities'", () => {
				expect(formatDisplayName("mcp_memory_create_entities")).toBe(
					"Create Entities"
				);
			});

			it("should format 'mcp_github_search_repositories' as 'Search Repositories'", () => {
				expect(formatDisplayName("mcp_github_search_repositories")).toBe(
					"Search Repositories"
				);
			});

			it("should format 'mcp_sequentialthinking_think' as 'Think'", () => {
				expect(formatDisplayName("mcp_sequentialthinking_think")).toBe("Think");
			});
		});

		describe("path-based server IDs", () => {
			it("should format 'mcp_microsoft/playwright-mcp_take_screenshot' as 'Take Screenshot'", () => {
				expect(
					formatDisplayName("mcp_microsoft/playwright-mcp_take_screenshot")
				).toBe("Take Screenshot");
			});
		});

		describe("reverse domain notation", () => {
			it("should format 'mcp_io.github.github/github-mcp-server_create_or_update_file' as 'Create Or Update File'", () => {
				expect(
					formatDisplayName(
						"mcp_io.github.github/github-mcp-server_create_or_update_file"
					)
				).toBe("Create Or Update File");
			});
		});
	});

	describe("formatServerName", () => {
		it("should format 'memory' as 'Memory'", () => {
			expect(formatServerName("memory")).toBe("Memory");
		});

		it("should format 'github' as 'GitHub'", () => {
			expect(formatServerName("github")).toBe("GitHub");
		});

		it("should format 'sequentialthinking' as 'Sequential Thinking'", () => {
			expect(formatServerName("sequentialthinking")).toBe(
				"Sequential Thinking"
			);
		});

		it("should format 'io.github.github/github-mcp-server' as 'GitHub MCP Server'", () => {
			expect(formatServerName("io.github.github/github-mcp-server")).toBe(
				"GitHub MCP Server"
			);
		});

		it("should format 'oraios/serena' as 'Serena'", () => {
			expect(formatServerName("oraios/serena")).toBe("Serena");
		});

		it("should format 'microsoft/playwright-mcp' as 'Playwright MCP'", () => {
			expect(formatServerName("microsoft/playwright-mcp")).toBe(
				"Playwright MCP"
			);
		});

		it("should format 'firecrawl/firecrawl-mcp-server' as 'Firecrawl MCP Server'", () => {
			expect(formatServerName("firecrawl/firecrawl-mcp-server")).toBe(
				"Firecrawl MCP Server"
			);
		});

		it("should format 'io.github.upstash/context7' as 'Context7'", () => {
			expect(formatServerName("io.github.upstash/context7")).toBe("Context7");
		});

		it("should format unknown path server with intelligent formatting", () => {
			expect(formatServerName("unknown/my-custom-server")).toBe(
				"My Custom Server"
			);
		});
	});

	describe("Real-world MCP Server Examples", () => {
		// Test based on the user's actual mcp.json configuration
		it("should correctly format all servers from mcp.json", () => {
			const servers = [
				{ id: "sequentialthinking", expected: "Sequential Thinking" },
				{ id: "memory", expected: "Memory" },
				{ id: "alchemy", expected: "Alchemy" },
				{ id: "microsoft/playwright-mcp", expected: "Playwright MCP" },
				{ id: "flipside", expected: "Flipside" },
				{
					id: "io.github.github/github-mcp-server",
					expected: "GitHub MCP Server",
				},
				{ id: "io.github.upstash/context7", expected: "Context7" },
				{ id: "oraios/serena", expected: "Serena" },
				{
					id: "firecrawl/firecrawl-mcp-server",
					expected: "Firecrawl MCP Server",
				},
				{ id: "etherscan", expected: "Etherscan" },
			];

			for (const { id, expected } of servers) {
				expect(formatServerName(id)).toBe(expected);
			}
		});

		it("should correctly extract and format tool names for oraios/serena", () => {
			const serenaTools = [
				{
					name: "mcp_oraios/serena_list",
					expectedServer: "oraios/serena",
					expectedDisplay: "List",
				},
				{
					name: "mcp_oraios/serena_read",
					expectedServer: "oraios/serena",
					expectedDisplay: "Read",
				},
				{
					name: "mcp_oraios/serena_insert_before_symbol",
					expectedServer: "oraios/serena",
					expectedDisplay: "Insert Before Symbol",
				},
				{
					name: "mcp_oraios/serena_rename_symbol",
					expectedServer: "oraios/serena",
					expectedDisplay: "Rename Symbol",
				},
				{
					name: "mcp_oraios/serena_search_for_pattern",
					expectedServer: "oraios/serena",
					expectedDisplay: "Search For Pattern",
				},
				{
					name: "mcp_oraios/serena_think_about_collected_information",
					expectedServer: "oraios/serena",
					expectedDisplay: "Think About Collected Information",
				},
			];

			for (const tool of serenaTools) {
				const serverId = extractServerIdFromToolName(tool.name);
				expect(serverId).toBe(tool.expectedServer);

				const displayName = formatDisplayName(tool.name);
				expect(displayName).toBe(tool.expectedDisplay);

				const serverName = formatServerName(serverId);
				expect(serverName).toBe("Serena");
			}
		});

		it("should correctly extract and format tool names for io.github.github/github-mcp-server", () => {
			const githubTools = [
				{
					name: "mcp_io.github.github/github-mcp-server_create_or_update_file",
					expectedServer: "io.github.github/github-mcp-server",
					expectedDisplay: "Create Or Update File",
				},
				{
					name: "mcp_io.github.github/github-mcp-server_search_repositories",
					expectedServer: "io.github.github/github-mcp-server",
					expectedDisplay: "Search Repositories",
				},
				{
					name: "mcp_io.github.github/github-mcp-server_create_pull_request",
					expectedServer: "io.github.github/github-mcp-server",
					expectedDisplay: "Create Pull Request",
				},
			];

			for (const tool of githubTools) {
				const serverId = extractServerIdFromToolName(tool.name);
				expect(serverId).toBe(tool.expectedServer);

				const displayName = formatDisplayName(tool.name);
				expect(displayName).toBe(tool.expectedDisplay);

				const serverName = formatServerName(serverId);
				expect(serverName).toBe("GitHub MCP Server");
			}
		});
	});
});
