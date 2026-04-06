/**
 * Unit Tests for AcpAgentDiscoveryService (T050b)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * @see src/features/hooks/services/acp-agent-discovery-service.ts
 * @feature 001-hooks-refactor Phase 6
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock node:fs/promises
// ---------------------------------------------------------------------------

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
	mockReaddir: vi.fn(),
	mockReadFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	default: { readdir: mockReaddir, readFile: mockReadFile },
	readdir: mockReaddir,
	readFile: mockReadFile,
}));

// ---------------------------------------------------------------------------
// Mock gray-matter
// ---------------------------------------------------------------------------

const { mockMatter } = vi.hoisted(() => ({
	mockMatter: vi.fn(),
}));

vi.mock("gray-matter", () => ({
	default: mockMatter,
}));

import { AcpAgentDiscoveryService } from "../../../../../src/features/hooks/services/acp-agent-discovery-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a minimal gray-matter parse result */
function makeGrayMatterResult(data: Record<string, unknown>, content = "") {
	return { data, content };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AcpAgentDiscoveryService", () => {
	let service: AcpAgentDiscoveryService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new AcpAgentDiscoveryService("/workspace/root");
	});

	// -----------------------------------------------------------------------
	// Constructor
	// -----------------------------------------------------------------------

	describe("constructor", () => {
		it("creates a service instance", () => {
			expect(service).toBeInstanceOf(AcpAgentDiscoveryService);
		});
	});

	// -----------------------------------------------------------------------
	// discoverAgents() — happy path
	// -----------------------------------------------------------------------

	describe("discoverAgents()", () => {
		it("returns empty array when .github/agents directory does not exist", async () => {
			const notFoundError = Object.assign(new Error("ENOENT"), {
				code: "ENOENT",
			});
			mockReaddir.mockRejectedValue(notFoundError);

			const agents = await service.discoverAgents();
			expect(agents).toEqual([]);
		});

		it("returns empty array when directory has no .agent.md files", async () => {
			mockReaddir.mockResolvedValue(["README.md", "other.ts"]);

			const agents = await service.discoverAgents();
			expect(agents).toEqual([]);
		});

		it("filters files that do not end with .agent.md", async () => {
			mockReaddir.mockResolvedValue(["not-an-agent.md", "valid.agent.md"]);
			mockReadFile.mockResolvedValue(
				"---\nacp: true\nagentCommand: npx agent --acp\n---\n"
			);
			mockMatter.mockReturnValue(
				makeGrayMatterResult({
					acp: true,
					agentCommand: "npx agent --acp",
				})
			);

			const agents = await service.discoverAgents();
			expect(agents).toHaveLength(1);
		});

		it("filters out files whose frontmatter does not have acp: true", async () => {
			mockReaddir.mockResolvedValue(["no-acp.agent.md", "has-acp.agent.md"]);
			mockReadFile.mockImplementation((filePath: string) => {
				if (String(filePath).includes("no-acp")) {
					return Promise.resolve(
						"---\nacp: false\nagentCommand: npx no-acp --acp\n---\n"
					);
				}
				return Promise.resolve(
					"---\nacp: true\nagentCommand: npx has-acp --acp\n---\n"
				);
			});
			mockMatter.mockImplementation((content: string) => {
				if (String(content).includes("acp: false")) {
					return makeGrayMatterResult({
						acp: false,
						agentCommand: "npx no-acp --acp",
					});
				}
				return makeGrayMatterResult({
					acp: true,
					agentCommand: "npx has-acp --acp",
				});
			});

			const agents = await service.discoverAgents();
			expect(agents).toHaveLength(1);
			expect(agents[0].agentCommand).toBe("npx has-acp --acp");
		});

		it("returns ACPAgentDescriptor[] with agentCommand from frontmatter", async () => {
			mockReaddir.mockResolvedValue(["my-agent.agent.md"]);
			mockReadFile.mockResolvedValue(
				"---\nacp: true\nagentCommand: npx my-agent --acp\n---\n"
			);
			mockMatter.mockReturnValue(
				makeGrayMatterResult({
					acp: true,
					agentCommand: "npx my-agent --acp",
				})
			);

			const agents = await service.discoverAgents();

			expect(agents).toHaveLength(1);
			expect(agents[0].agentCommand).toBe("npx my-agent --acp");
		});

		it("uses agentDisplayName from frontmatter when present", async () => {
			mockReaddir.mockResolvedValue(["my-agent.agent.md"]);
			mockReadFile.mockResolvedValue(
				"---\nacp: true\nagentCommand: npx my-agent --acp\nagentDisplayName: My Custom Agent\n---\n"
			);
			mockMatter.mockReturnValue(
				makeGrayMatterResult({
					acp: true,
					agentCommand: "npx my-agent --acp",
					agentDisplayName: "My Custom Agent",
				})
			);

			const agents = await service.discoverAgents();
			expect(agents[0].agentDisplayName).toBe("My Custom Agent");
		});

		it("falls back to filename (without .agent.md) as agentDisplayName when not in frontmatter", async () => {
			mockReaddir.mockResolvedValue(["my-agent.agent.md"]);
			mockReadFile.mockResolvedValue(
				"---\nacp: true\nagentCommand: npx my-agent --acp\n---\n"
			);
			mockMatter.mockReturnValue(
				makeGrayMatterResult({
					acp: true,
					agentCommand: "npx my-agent --acp",
					// no agentDisplayName
				})
			);

			const agents = await service.discoverAgents();
			expect(agents[0].agentDisplayName).toBe("my-agent");
		});

		it("sets source to 'workspace' for all returned agents", async () => {
			mockReaddir.mockResolvedValue(["agent-a.agent.md"]);
			mockReadFile.mockResolvedValue(
				"---\nacp: true\nagentCommand: npx agent-a --acp\n---\n"
			);
			mockMatter.mockReturnValue(
				makeGrayMatterResult({ acp: true, agentCommand: "npx agent-a --acp" })
			);

			const agents = await service.discoverAgents();
			expect(agents[0].source).toBe("workspace");
		});

		it("skips files that fail to parse and returns the rest", async () => {
			mockReaddir.mockResolvedValue(["bad.agent.md", "good.agent.md"]);
			mockReadFile.mockImplementation((filePath: string) => {
				if (String(filePath).includes("bad")) {
					return Promise.reject(new Error("Parse error"));
				}
				return Promise.resolve(
					"---\nacp: true\nagentCommand: npx good-agent --acp\n---\n"
				);
			});
			mockMatter.mockReturnValue(
				makeGrayMatterResult({
					acp: true,
					agentCommand: "npx good-agent --acp",
				})
			);

			const agents = await service.discoverAgents();
			expect(agents).toHaveLength(1);
			expect(agents[0].agentCommand).toBe("npx good-agent --acp");
		});

		it("returns multiple agents from multiple valid files", async () => {
			mockReaddir.mockResolvedValue(["agent-a.agent.md", "agent-b.agent.md"]);
			mockReadFile.mockImplementation((filePath: string) => {
				if (String(filePath).includes("agent-a")) {
					return Promise.resolve(
						"---\nacp: true\nagentCommand: npx agent-a --acp\nagentDisplayName: Agent A\n---\n"
					);
				}
				return Promise.resolve(
					"---\nacp: true\nagentCommand: npx agent-b --acp\nagentDisplayName: Agent B\n---\n"
				);
			});
			mockMatter.mockImplementation((content: string) => {
				if (String(content).includes("Agent A")) {
					return makeGrayMatterResult({
						acp: true,
						agentCommand: "npx agent-a --acp",
						agentDisplayName: "Agent A",
					});
				}
				return makeGrayMatterResult({
					acp: true,
					agentCommand: "npx agent-b --acp",
					agentDisplayName: "Agent B",
				});
			});

			const agents = await service.discoverAgents();
			expect(agents).toHaveLength(2);
		});

		it("scans .github/agents/ relative to the workspaceRoot provided", async () => {
			const customService = new AcpAgentDiscoveryService("/custom/workspace");
			mockReaddir.mockResolvedValue([]);

			await customService.discoverAgents();

			// Should have tried to read the agents dir under /custom/workspace
			expect(mockReaddir).toHaveBeenCalledWith(
				expect.stringContaining("custom/workspace")
			);
		});
	});
});
