/**
 * Integration Test: Agent Refresh Flow
 *
 * Tests the complete flow from file system changes to agent registry refresh.
 * Since this is running in a test environment with mocked VS Code APIs,
 * we test the registry's ability to refresh when triggered, rather than
 * relying on actual file system watching (which is tested in FileWatcherService unit tests).
 *
 * Test Coverage:
 * - T059: Integration test for file changes → registry refresh flow
 *
 * @see src/features/hooks/file-watcher-service.ts
 * @see src/features/hooks/agent-registry.ts
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentRegistry } from "../../src/features/hooks/agent-registry";
import type { AgentRegistryEntry } from "../../src/features/hooks/agent-registry-types";

// ============================================================================
// Test Suite
// ============================================================================

describe("Agent Refresh Integration", () => {
	let registry: AgentRegistry;
	let testWorkspaceDir: string;
	let testAgentsDir: string;

	beforeEach(async () => {
		// Create temporary test workspace
		testWorkspaceDir = join(tmpdir(), `agent-refresh-test-${Date.now()}`);
		testAgentsDir = join(testWorkspaceDir, ".github", "agents");

		await fs.mkdir(testAgentsDir, { recursive: true });

		// Initialize agent registry with test workspace root
		registry = new AgentRegistry(testWorkspaceDir);
		await registry.initialize();
	});

	afterEach(async () => {
		// Clean up test workspace
		try {
			await fs.rm(testWorkspaceDir, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}

		// Dispose registry
		registry.dispose();
	});

	// ============================================================================
	// T059: File Changes → Registry Refresh Flow
	// ============================================================================

	describe("T059: File changes → registry refresh flow", () => {
		it("should detect new agent file and refresh registry", async () => {
			// Get initial agent count
			const initialAgents = registry.getAllAgents();
			const initialCount = initialAgents.length;

			// Subscribe to registry changes
			const changedAgents: AgentRegistryEntry[][] = [];
			registry.onAgentsChanged((agents) => {
				changedAgents.push(agents);
			});

			// Create new agent file
			const newAgentFile = join(testAgentsDir, "test-agent.agent.md");
			const agentContent = `---
id: test-agent
name: Test Agent
fullName: Test Agent for Integration Testing
description: A test agent for integration testing
commands:
  - name: test
    description: Run a test
    tool: agent.test
resources:
  prompts: []
  skills: []
---

# Test Agent

This is a test agent for integration testing.
`;

			await fs.writeFile(newAgentFile, agentContent, "utf-8");

			// Manually trigger refresh (simulates file watcher triggering)
			await registry.refresh();

			// Verify registry was updated
			const updatedAgents = registry.getAllAgents();
			expect(updatedAgents.length).toBeGreaterThan(initialCount);

			// Verify the new agent exists in registry
			const testAgent = updatedAgents.find((a) => a.id === "local:test-agent");
			expect(testAgent).toBeDefined();
			expect(testAgent?.name).toBe("Test Agent");
			expect(testAgent?.type).toBe("local");
			expect(testAgent?.source).toBe("file");

			// Verify change event was emitted
			expect(changedAgents.length).toBeGreaterThan(0);
		});

		it("should detect modified agent file and refresh registry", async () => {
			// Create initial agent file
			const agentFile = join(testAgentsDir, "modify-test.agent.md");
			const initialContent = `---
id: modify-test
name: Initial Name
fullName: Initial Full Name
description: Initial description
commands:
  - name: test
    description: Run a test
    tool: agent.test
resources:
  prompts: []
---

Initial content
`;

			await fs.writeFile(agentFile, initialContent, "utf-8");

			// Initialize registry to pick up the file
			await registry.refresh();

			// Subscribe to changes
			const changedAgents: AgentRegistryEntry[][] = [];
			registry.onAgentsChanged((agentList) => {
				changedAgents.push(agentList);
			});

			// Modify agent file
			const modifiedContent = `---
id: modify-test
name: Modified Name
fullName: Modified Full Name
description: Modified description
commands:
  - name: test
    description: Run a test
    tool: agent.test
resources:
  prompts: []
---

Modified content
`;

			await fs.writeFile(agentFile, modifiedContent, "utf-8");

			// Trigger refresh
			await registry.refresh();

			// Verify registry has updated agent
			const agents = registry.getAllAgents();
			const modifiedAgent = agents.find((a) => a.id === "local:modify-test");
			expect(modifiedAgent).toBeDefined();
			expect(modifiedAgent?.name).toBe("Modified Name");

			// Verify change event was emitted
			expect(changedAgents.length).toBeGreaterThan(0);
		});

		it("should detect deleted agent file and refresh registry", async () => {
			// Create agent file
			const agentFile = join(testAgentsDir, "delete-test.agent.md");
			const agentContent = `---
id: delete-test
name: Delete Test
fullName: Agent to be Deleted
description: This agent will be deleted
commands:
  - name: test
    description: Run a test
    tool: agent.test
resources:
  prompts: []
---

Content
`;

			await fs.writeFile(agentFile, agentContent, "utf-8");

			// Initialize registry to pick up the file
			await registry.refresh();

			// Verify agent exists
			let agents = registry.getAllAgents();
			let deleteTestAgent = agents.find((a) => a.id === "local:delete-test");
			expect(deleteTestAgent).toBeDefined();

			// Subscribe to changes
			const changedAgents: AgentRegistryEntry[][] = [];
			registry.onAgentsChanged((agentList) => {
				changedAgents.push(agentList);
			});

			// Delete agent file
			await fs.unlink(agentFile);

			// Trigger refresh
			await registry.refresh();

			// Verify agent no longer in registry
			agents = registry.getAllAgents();
			deleteTestAgent = agents.find((a) => a.id === "local:delete-test");
			expect(deleteTestAgent).toBeUndefined();

			// Verify change event was emitted
			expect(changedAgents.length).toBeGreaterThan(0);
		});

		it("should batch multiple rapid file changes", async () => {
			// Subscribe to changes
			const changedAgents: AgentRegistryEntry[][] = [];
			registry.onAgentsChanged((agentList) => {
				changedAgents.push(agentList);
			});

			// Create multiple agent files rapidly
			const agent1 = join(testAgentsDir, "batch-1.agent.md");
			const agent2 = join(testAgentsDir, "batch-2.agent.md");
			const agent3 = join(testAgentsDir, "batch-3.agent.md");

			const agentTemplate = (id: string) => `---
id: ${id}
name: ${id}
fullName: Batch Test ${id}
description: Test agent
commands:
  - name: test
    description: Test
    tool: agent.test
resources:
  prompts: []
---

Content
`;

			// Write files rapidly
			await Promise.all([
				fs.writeFile(agent1, agentTemplate("batch-1"), "utf-8"),
				fs.writeFile(agent2, agentTemplate("batch-2"), "utf-8"),
				fs.writeFile(agent3, agentTemplate("batch-3"), "utf-8"),
			]);

			// Trigger refresh once (simulates debounced file watcher)
			await registry.refresh();

			// Verify all agents are in registry
			const agents = registry.getAllAgents();
			expect(agents.find((a) => a.id === "local:batch-1")).toBeDefined();
			expect(agents.find((a) => a.id === "local:batch-2")).toBeDefined();
			expect(agents.find((a) => a.id === "local:batch-3")).toBeDefined();

			// Should have triggered at least one change event
			expect(changedAgents.length).toBeGreaterThan(0);
		});
	});
});
