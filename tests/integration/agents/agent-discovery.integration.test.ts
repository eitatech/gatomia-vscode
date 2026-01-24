/**
 * Integration tests for agent discovery
 * Tests full agent loading workflow with real file system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentLoader } from "../../../src/features/agents/agent-loader";
import type { OutputChannel } from "vscode";

// Mock VS Code workspace.fs to use real filesystem for integration tests
vi.mock("vscode", async () => {
	const actual = await vi.importActual("vscode");
	return {
		...actual,
		workspace: {
			fs: {
				stat: async (uri: { fsPath: string }) => {
					const stats = await fs.stat(uri.fsPath);
					return {
						type: stats.isDirectory() ? 2 : 1,
						ctime: stats.ctimeMs,
						mtime: stats.mtimeMs,
						size: stats.size,
					};
				},
				readDirectory: async (uri: { fsPath: string }) => {
					const entries = await fs.readdir(uri.fsPath, { withFileTypes: true });
					return entries.map((entry) => [
						entry.name,
						entry.isDirectory() ? 2 : 1,
					]);
				},
				readFile: async (uri: { fsPath: string }) => {
					const content = await fs.readFile(uri.fsPath);
					return content;
				},
			},
		},
		Uri: {
			file: (path: string) => ({ fsPath: path, scheme: "file", path }),
		},
	};
});

describe("Agent Discovery Integration", () => {
	let tempDir: string;
	let mockOutputChannel: OutputChannel;

	beforeEach(async () => {
		// Create temp directory for test agent files
		tempDir = join(tmpdir(), `agent-test-${Date.now()}`);
		await fs.mkdir(tempDir, { recursive: true });

		// Mock OutputChannel
		mockOutputChannel = {
			appendLine: () => {
				// Intentionally empty for testing
			},
			append: () => {
				// Intentionally empty for testing
			},
			clear: () => {
				// Intentionally empty for testing
			},
			show: () => {
				// Intentionally empty for testing
			},
			hide: () => {
				// Intentionally empty for testing
			},
			dispose: () => {
				// Intentionally empty for testing
			},
			name: "test",
			replace: () => {
				// Intentionally empty for testing
			},
		} as OutputChannel;
	});

	afterEach(async () => {
		// Cleanup temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	it("should discover agents from resources/agents directory", async () => {
		// T010: Test full agent discovery flow
		// 1. Create test agent files in temp directory
		const validAgent = `---
id: test-agent
name: Test Agent
fullName: Test Agent Full Name
description: Test agent for integration testing
commands:
  - name: test
    description: Test command
    tool: test.tool
resources:
  prompts: [test.prompt.md]
---

# Test Agent

This is a test agent for integration testing.
`;

		await fs.writeFile(join(tempDir, "test-agent.agent.md"), validAgent);

		// 2. Call AgentLoader.loadAgents()
		const loader = new AgentLoader(mockOutputChannel);
		const agents = await loader.loadAgents(tempDir);

		// 3. Verify all valid agents are discovered
		expect(agents).toHaveLength(1);
		expect(agents[0].id).toBe("test-agent");
		expect(agents[0].name).toBe("Test Agent");
		expect(agents[0].fullName).toBe("Test Agent Full Name");
		expect(agents[0].description).toBe("Test agent for integration testing");
		expect(agents[0].commands).toHaveLength(2); // test + auto-injected help
		expect(agents[0].commands[0].name).toBe("test");
		expect(agents[0].commands[1].name).toBe("help"); // T068 - auto-injected
		expect(agents[0].resources.prompts).toEqual(["test.prompt.md"]);
	});

	it("should skip invalid agents with errors logged", async () => {
		// Create valid and invalid agent files
		const validAgent = `---
id: valid-agent
name: Valid Agent
fullName: Valid Agent Full
description: Valid agent
commands:
  - name: test
    description: Test
    tool: test.tool
---
# Valid
`;

		const invalidAgent = `---
id: INVALID-ID
name: Invalid Agent
description: Invalid agent with bad ID
---
# Invalid
`;

		await fs.writeFile(join(tempDir, "valid.agent.md"), validAgent);
		await fs.writeFile(join(tempDir, "invalid.agent.md"), invalidAgent);

		// Load agents
		const loader = new AgentLoader(mockOutputChannel);
		const agents = await loader.loadAgents(tempDir);

		// Should only load valid agent
		expect(agents).toHaveLength(1);
		expect(agents[0].id).toBe("valid-agent");
	});

	it("should handle nested directories", async () => {
		// Should discover agents in subdirectories
		// resources/agents/category/agent.agent.md
		const categoryDir = join(tempDir, "category");
		await fs.mkdir(categoryDir, { recursive: true });

		const agent = `---
id: nested-agent
name: Nested Agent
fullName: Nested Agent Full
description: Agent in subdirectory
commands:
  - name: test
    description: Test
    tool: test.tool
---
# Nested
`;

		await fs.writeFile(join(categoryDir, "nested.agent.md"), agent);

		const loader = new AgentLoader(mockOutputChannel);
		const agents = await loader.loadAgents(tempDir);

		expect(agents).toHaveLength(1);
		expect(agents[0].id).toBe("nested-agent");
		expect(agents[0].filePath).toContain("category");
	});

	it("should handle empty directory gracefully", async () => {
		const loader = new AgentLoader(mockOutputChannel);
		const agents = await loader.loadAgents(tempDir);

		expect(agents).toHaveLength(0);
	});

	it("should skip non-agent markdown files", async () => {
		await fs.writeFile(join(tempDir, "README.md"), "# Not an agent");
		await fs.writeFile(join(tempDir, "notes.txt"), "Some notes");

		const loader = new AgentLoader(mockOutputChannel);
		const agents = await loader.loadAgents(tempDir);

		expect(agents).toHaveLength(0);
	});
});
