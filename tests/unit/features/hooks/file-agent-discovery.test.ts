/**
 * Unit Tests for FileAgentDiscovery
 *
 * Tests agent discovery from .github/agents/*.agent.md files including
 * file scanning, YAML frontmatter parsing, and error handling.
 *
 * @see src/features/hooks/file-agent-discovery.ts
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join, isAbsolute } from "node:path";

// Import actual FileAgentDiscovery class (T016)
import { FileAgentDiscovery } from "../../../../src/features/hooks/file-agent-discovery";

describe("FileAgentDiscovery", () => {
	let discovery: FileAgentDiscovery;
	const testAgentsDir = join(__dirname, ".test-agents");

	beforeEach(async () => {
		// Instantiate FileAgentDiscovery (T016)
		discovery = new FileAgentDiscovery();

		// Create test directory for agent files
		await fs.mkdir(testAgentsDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testAgentsDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	// ============================================================================
	// T014: Unit test for FileAgentDiscovery class
	// ============================================================================

	describe("discoverFromDirectory()", () => {
		it("should discover all .agent.md files in directory", async () => {
			// Create test agent files
			await createTestAgentFile(testAgentsDir, "code-reviewer.agent.md", {
				id: "code-reviewer",
				name: "Code Reviewer",
				description: "Reviews code quality",
			});

			await createTestAgentFile(testAgentsDir, "test-generator.agent.md", {
				id: "test-generator",
				name: "Test Generator",
				description: "Generates unit tests",
			});

			const result = await discovery.discoverFromDirectory(testAgentsDir);

			// Should find both agents
			expect(result.source).toBe("file");
			expect(result.agents.length).toBeGreaterThanOrEqual(2);
			expect(result.errors).toHaveLength(0);
		});

		it("should parse YAML frontmatter from agent files", async () => {
			const agentMeta = {
				id: "spec-analyst",
				name: "Spec Analyst",
				fullName: "Specification Analyst",
				description: "Analyzes specifications for completeness",
				icon: "📋",
			};

			await createTestAgentFile(
				testAgentsDir,
				"spec-analyst.agent.md",
				agentMeta
			);

			const result = await discovery.discoverFromDirectory(testAgentsDir);

			// Find the agent we created
			const agent = result.agents.find((a) => a.name === "Spec Analyst");

			expect(agent).toBeDefined();
			expect(agent?.schema).toBeDefined();
			expect(agent?.schema?.id).toBe("spec-analyst");
			expect(agent?.schema?.name).toBe("Spec Analyst");
			expect(agent?.schema?.fullName).toBe("Specification Analyst");
			expect(agent?.schema?.description).toBe(
				"Analyzes specifications for completeness"
			);
		});

		it("should set agent ID format to 'local:{name}'", async () => {
			await createTestAgentFile(testAgentsDir, "my-agent.agent.md", {
				id: "my-agent",
				name: "My Agent",
				description: "Test agent",
			});

			const result = await discovery.discoverFromDirectory(testAgentsDir);
			const agent = result.agents.find((a) => a.name === "My Agent");

			expect(agent?.id).toBe("local:my-agent");
		});

		it("should set agent type to 'local' for all file-based agents", async () => {
			await createTestAgentFile(testAgentsDir, "agent1.agent.md", {
				id: "agent1",
				name: "Agent 1",
				description: "Test",
			});

			const result = await discovery.discoverFromDirectory(testAgentsDir);
			const agent = result.agents[0];

			expect(agent?.type).toBe("local");
		});

		it("should set agent source to 'file' for all discovered agents", async () => {
			await createTestAgentFile(testAgentsDir, "agent1.agent.md", {
				id: "agent1",
				name: "Agent 1",
				description: "Test",
			});

			const result = await discovery.discoverFromDirectory(testAgentsDir);
			const agent = result.agents[0];

			expect(agent?.source).toBe("file");
		});

		it("should include absolute file path in sourcePath", async () => {
			await createTestAgentFile(testAgentsDir, "path-test.agent.md", {
				id: "path-test",
				name: "Path Test",
				description: "Test",
			});

			const result = await discovery.discoverFromDirectory(testAgentsDir);
			const agent = result.agents[0];

			expect(agent?.sourcePath).toBeDefined();
			expect(isAbsolute(agent?.sourcePath || "")).toBe(true);
			expect(agent?.sourcePath).toContain("path-test.agent.md");
		});

		it("should handle missing directory gracefully", async () => {
			const nonExistentDir = "/path/that/does/not/exist";

			const result = await discovery.discoverFromDirectory(nonExistentDir);

			// Should not throw, but return empty result
			expect(result.agents).toHaveLength(0);
			// May or may not have errors depending on implementation
		});

		it("should skip non-.agent.md files", async () => {
			// Create valid agent file
			await createTestAgentFile(testAgentsDir, "valid.agent.md", {
				id: "valid",
				name: "Valid",
				description: "Valid agent",
			});

			// Create files that should be ignored
			await fs.writeFile(join(testAgentsDir, "README.md"), "# Not an agent");
			await fs.writeFile(join(testAgentsDir, "agent.txt"), "Not an agent");
			await fs.writeFile(
				join(testAgentsDir, ".hidden.agent.md"),
				"Hidden file"
			);

			const result = await discovery.discoverFromDirectory(testAgentsDir);

			// Should only find the valid agent file
			expect(result.agents).toHaveLength(1);
		});

		it("should handle malformed YAML frontmatter gracefully", async () => {
			const malformedContent = `---
id: broken
name: "Broken Agent
description: Missing closing quote
---
# Agent content
`;

			await fs.writeFile(
				join(testAgentsDir, "broken.agent.md"),
				malformedContent
			);

			const result = await discovery.discoverFromDirectory(testAgentsDir);

			// Should not throw, but report error
			expect(result.errors.length).toBeGreaterThan(0);
			const error = result.errors[0];
			expect(error?.code).toBe("PARSE_ERROR");
			expect(error?.message).toBeDefined();
		});

		it("should handle files without frontmatter gracefully", async () => {
			const noFrontmatterContent = `# Agent Without Frontmatter

This file has no YAML frontmatter.
`;

			await fs.writeFile(
				join(testAgentsDir, "no-frontmatter.agent.md"),
				noFrontmatterContent
			);

			const result = await discovery.discoverFromDirectory(testAgentsDir);

			// Should skip or report error
			if (result.agents.length === 0) {
				// Skipped silently
				expect(result.agents).toHaveLength(0);
			} else {
				// Reported as error
				expect(result.errors.length).toBeGreaterThan(0);
			}
		});

		it("should validate required fields in frontmatter", async () => {
			const incompleteContent = `---
name: "Missing ID Agent"
---
# Agent content
`;

			await fs.writeFile(
				join(testAgentsDir, "incomplete.agent.md"),
				incompleteContent
			);

			const result = await discovery.discoverFromDirectory(testAgentsDir);

			// Should report validation error
			expect(result.errors.length).toBeGreaterThan(0);
			const error = result.errors.find((e) => e.code === "INVALID_SCHEMA");
			expect(error).toBeDefined();
		});

		it("should set discoveredAt timestamp for each agent", async () => {
			await createTestAgentFile(testAgentsDir, "timestamp-test.agent.md", {
				id: "timestamp-test",
				name: "Timestamp Test",
				description: "Test",
			});

			const before = Date.now();
			const result = await discovery.discoverFromDirectory(testAgentsDir);
			const after = Date.now();

			const agent = result.agents[0];
			expect(agent?.discoveredAt).toBeGreaterThanOrEqual(before);
			expect(agent?.discoveredAt).toBeLessThanOrEqual(after);
		});

		it("should set available=true for all discovered agents", async () => {
			await createTestAgentFile(testAgentsDir, "available-test.agent.md", {
				id: "available-test",
				name: "Available Test",
				description: "Test",
			});

			const result = await discovery.discoverFromDirectory(testAgentsDir);
			const agent = result.agents[0];

			expect(agent?.available).toBe(true);
		});
	});

	// ============================================================================
	// Helper Functions
	// ============================================================================

	/**
	 * Create a test agent file with YAML frontmatter
	 */
	async function createTestAgentFile(
		dir: string,
		filename: string,
		metadata: {
			id: string;
			name: string;
			description: string;
			fullName?: string;
			icon?: string;
		}
	): Promise<void> {
		const content = `---
id: ${metadata.id}
name: ${metadata.name}
${metadata.fullName ? `fullName: ${metadata.fullName}` : ""}
description: ${metadata.description}
${metadata.icon ? `icon: ${metadata.icon}` : ""}
commands: []
resources:
  mcp: []
---

# ${metadata.name}

${metadata.description}
`;

		await fs.writeFile(join(dir, filename), content, "utf-8");
	}
});
