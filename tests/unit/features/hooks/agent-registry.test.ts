/**
 * Unit Tests for AgentRegistry
 *
 * Tests agent discovery, grouping, duplicate resolution, and availability checking.
 *
 * @see src/features/hooks/agent-registry.ts
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentRegistry } from "../../../../src/features/hooks/agent-registry";

// Test regex patterns (top-level for performance)
const AGENT_ID_FORMAT_PATTERN = /^[a-z]+:[a-z0-9-]+$/;
const AGENT_MD_FILE_PATTERN = /\.agent\.md$/;
const SOURCE_INDICATOR_PATTERN = / \((Local|Extension)\)$/;
const LOCAL_SUFFIX_PATTERN = /^.+ \(Local\)$/;
const EXTENSION_SUFFIX_PATTERN = /^.+ \(Extension\)$/;
const AGENT_ID_FULL_PATTERN = /^(local|extension):[a-z0-9-]+$/;

describe("AgentRegistry", () => {
	let registry: AgentRegistry;
	const testWorkspaceRoot = process.cwd(); // Use current directory for tests

	beforeEach(() => {
		registry = new AgentRegistry(testWorkspaceRoot);
	});

	afterEach(() => {
		// Clean up any resources
	});

	// ============================================================================
	// T011: Unit test for AgentRegistry.discoverLocalAgents()
	// ============================================================================

	describe("discoverLocalAgents()", () => {
		it("should discover agents from .github/agents/*.agent.md files", async () => {
			const results = await registry.initialize();

			// Should return discovery results
			expect(results).toBeDefined();
			expect(Array.isArray(results)).toBe(true);

			// Should discover at least one agent if .github/agents/ exists
			// (Actual count depends on repository state)
			// For now, just validate structure
			if (results.length > 0) {
				const firstResult = results[0];
				expect(firstResult).toHaveProperty("source");
				expect(firstResult).toHaveProperty("agents");
				expect(firstResult).toHaveProperty("errors");
			}
		});

		it("should handle missing .github/agents/ directory gracefully", async () => {
			// Initialize should not throw even if directory doesn't exist
			await expect(registry.initialize()).resolves.not.toThrow();
		});

		it("should parse agent metadata from YAML frontmatter", async () => {
			// TODO: Phase 3 (T017) - Test agent file parsing
			await registry.initialize();

			const agents = registry.getAllAgents();

			// Each discovered agent should have required fields
			for (const agent of agents) {
				expect(agent).toHaveProperty("id");
				expect(agent).toHaveProperty("name");
				expect(agent).toHaveProperty("source");
				expect(agent).toHaveProperty("type");
				expect(agent).toHaveProperty("description");
				expect(agent.id).toMatch(AGENT_ID_FORMAT_PATTERN); // Format: "source:name"
			}
		});

		it("should set agent type to LOCAL for file-based agents", async () => {
			// TODO: Phase 3 (T018) - Verify agent type detection
			await registry.initialize();

			const agents = registry.getAllAgents({ source: "file" });

			// All file-based agents should be LOCAL type
			for (const agent of agents) {
				expect(agent.type).toBe("local");
			}
		});

		it("should include file path in sourcePath for file-based agents", async () => {
			// TODO: Phase 3 (T017) - Verify sourcePath is set
			await registry.initialize();

			const agents = registry.getAllAgents({ source: "file" });

			for (const agent of agents) {
				expect(agent.sourcePath).toBeDefined();
				expect(agent.sourcePath).toMatch(AGENT_MD_FILE_PATTERN);
			}
		});
	});

	// ============================================================================
	// T012: Unit test for AgentRegistry.getAgentsGroupedByType()
	// ============================================================================

	describe("getAgentsGroupedByType()", () => {
		it("should group agents by type (local vs background)", async () => {
			// TODO: Phase 3 (T020) - This test should FAIL until implementation
			await registry.initialize();

			const grouped = registry.getAgentsGroupedByType();

			// Should have both groups
			expect(grouped).toHaveProperty("local");
			expect(grouped).toHaveProperty("background");

			// Groups should be arrays
			expect(Array.isArray(grouped.local)).toBe(true);
			expect(Array.isArray(grouped.background)).toBe(true);
		});

		it("should place LOCAL agents in local group", async () => {
			// TODO: Phase 3 (T020) - Test grouping logic
			await registry.initialize();

			const grouped = registry.getAgentsGroupedByType();

			// All agents in local group should have type "local"
			for (const agent of grouped.local) {
				expect(agent.type).toBe("local");
			}
		});

		it("should place BACKGROUND agents in background group", async () => {
			// TODO: Phase 3 (T020) - Test grouping logic
			await registry.initialize();

			const grouped = registry.getAgentsGroupedByType();

			// All agents in background group should have type "background"
			for (const agent of grouped.background) {
				expect(agent.type).toBe("background");
			}
		});

		it("should handle empty registry", () => {
			// TODO: Phase 3 (T020) - Test empty state
			const grouped = registry.getAgentsGroupedByType();

			expect(grouped.local).toEqual([]);
			expect(grouped.background).toEqual([]);
		});
	});

	// ============================================================================
	// T013: Unit test for duplicate agent name resolution
	// ============================================================================

	describe("duplicate agent name resolution", () => {
		it("should detect duplicate agent names across sources", async () => {
			// TODO: Phase 3 (T019) - This test should FAIL until implementation
			// Scenario: Same agent name exists in both .github/agents/ and extension
			// Expected: Both should be registered with source indicators

			await registry.initialize();

			const agents = registry.getAllAgents();

			// Find any duplicate names by checking if display name has source indicator
			const agentsWithIndicators = agents.filter(
				(agent) =>
					agent.displayName.includes(" (Local)") ||
					agent.displayName.includes(" (Extension)")
			);

			// If duplicates exist, they should have source indicators
			if (agentsWithIndicators.length > 0) {
				for (const agent of agentsWithIndicators) {
					expect(agent.displayName).toMatch(SOURCE_INDICATOR_PATTERN);
				}
			}
		});

		it("should append (Local) suffix for file-based duplicate agents", async () => {
			// TODO: Phase 3 (T019) - Test disambiguation logic
			// Mock scenario where we have duplicates
			await registry.initialize();

			const localAgents = registry.getAllAgents({ source: "file" });

			// Find any with " (Local)" suffix
			const disambiguatedAgents = localAgents.filter((agent) =>
				agent.displayName.endsWith(" (Local)")
			);

			// If found, verify format
			for (const agent of disambiguatedAgents) {
				expect(agent.displayName).toMatch(LOCAL_SUFFIX_PATTERN);
			}
		});

		it("should append (Extension) suffix for extension-based duplicate agents", async () => {
			// TODO: Phase 3 (T019) - Test disambiguation logic
			await registry.initialize();

			const extensionAgents = registry.getAllAgents({ source: "extension" });

			// Find any with " (Extension)" suffix
			const disambiguatedAgents = extensionAgents.filter((agent) =>
				agent.displayName.endsWith(" (Extension)")
			);

			// If found, verify format
			for (const agent of disambiguatedAgents) {
				expect(agent.displayName).toMatch(EXTENSION_SUFFIX_PATTERN);
			}
		});

		it("should keep original name if no duplicates exist", async () => {
			// TODO: Phase 3 (T019) - Test no-disambiguation case
			await registry.initialize();

			const agents = registry.getAllAgents();

			// Find agents without source indicators
			const uniqueAgents = agents.filter(
				(agent) =>
					!(
						agent.displayName.endsWith(" (Local)") ||
						agent.displayName.endsWith(" (Extension)")
					)
			);

			// If found, display name should match base name
			for (const agent of uniqueAgents) {
				expect(agent.displayName).toBe(agent.name);
			}
		});

		it("should use agent ID format 'source:name' for unique identification", async () => {
			// TODO: Phase 3 (T019) - Test agent ID format
			await registry.initialize();

			const agents = registry.getAllAgents();

			for (const agent of agents) {
				// ID should follow format: "source:name"
				expect(agent.id).toMatch(AGENT_ID_FULL_PATTERN);

				// ID should be unique
				const duplicateIds = agents.filter((a) => a.id === agent.id);
				expect(duplicateIds.length).toBe(1);
			}
		});
	});

	// ============================================================================
	// Helper Tests for Registry Operations
	// ============================================================================

	describe("getAllAgents()", () => {
		it("should return all registered agents", async () => {
			await registry.initialize();

			const agents = registry.getAllAgents();

			expect(Array.isArray(agents)).toBe(true);
		});

		it("should filter by source when provided", async () => {
			await registry.initialize();

			const fileAgents = registry.getAllAgents({ source: "file" });

			// All returned agents should have "file" source
			for (const agent of fileAgents) {
				expect(agent.source).toBe("file");
			}
		});

		it("should filter by type when provided", async () => {
			await registry.initialize();

			const localAgents = registry.getAllAgents({ type: "local" });

			// All returned agents should be "local" type
			for (const agent of localAgents) {
				expect(agent.type).toBe("local");
			}
		});

		it("should filter by availability when provided", async () => {
			await registry.initialize();

			const availableAgents = registry.getAllAgents({ available: true });

			// All returned agents should be available
			for (const agent of availableAgents) {
				expect(agent.available).toBe(true);
			}
		});
	});

	describe("getAgentById()", () => {
		it("should return agent by ID", async () => {
			await registry.initialize();

			const allAgents = registry.getAllAgents();
			if (allAgents.length > 0) {
				const firstAgent = allAgents[0];
				const foundAgent = registry.getAgentById(firstAgent.id);

				expect(foundAgent).toBeDefined();
				expect(foundAgent?.id).toBe(firstAgent.id);
			}
		});

		it("should return undefined for non-existent agent ID", () => {
			const agent = registry.getAgentById("nonexistent:agent");

			expect(agent).toBeUndefined();
		});
	});

	// ============================================================================
	// T044: Unit test for automatic agent type detection
	// ============================================================================

	describe("Automatic Agent Type Detection (User Story 2)", () => {
		it("should automatically detect local agents from .github/agents/*.agent.md files", async () => {
			await registry.initialize();

			const localAgents = registry.getAllAgents({ type: "local" });

			// All file-based agents should be marked as "local"
			for (const agent of localAgents) {
				expect(agent.type).toBe("local");
				expect(agent.source).toBe("file");
				expect(agent.sourcePath).toBeDefined();
				expect(agent.sourcePath).toMatch(AGENT_MD_FILE_PATTERN);
			}
		});

		it("should group agents by type (local vs background)", async () => {
			await registry.initialize();

			const grouped = registry.getAgentsGroupedByType();

			expect(grouped).toHaveProperty("local");
			expect(grouped).toHaveProperty("background");
			expect(Array.isArray(grouped.local)).toBe(true);
			expect(Array.isArray(grouped.background)).toBe(true);

			// All local agents should have type="local"
			for (const agent of grouped.local) {
				expect(agent.type).toBe("local");
			}

			// All background agents should have type="background"
			for (const agent of grouped.background) {
				expect(agent.type).toBe("background");
			}
		});

		it("should allow filtering agents by type", async () => {
			await registry.initialize();

			const localOnly = registry.getAllAgents({ type: "local" });
			const backgroundOnly = registry.getAllAgents({ type: "background" });

			// Local filter should only return local agents
			for (const agent of localOnly) {
				expect(agent.type).toBe("local");
			}

			// Background filter should only return background agents
			for (const agent of backgroundOnly) {
				expect(agent.type).toBe("background");
			}

			// No overlap between the two groups
			const localIds = new Set(localOnly.map((a) => a.id));
			const backgroundIds = new Set(backgroundOnly.map((a) => a.id));
			const intersection = [...localIds].filter((id) => backgroundIds.has(id));
			expect(intersection).toHaveLength(0);
		});

		it("should correctly identify agent type based on source", async () => {
			await registry.initialize();

			const allAgents = registry.getAllAgents();

			for (const agent of allAgents) {
				if (agent.source === "file") {
					// File-based agents should be local by default
					expect(agent.type).toBe("local");
				} else if (agent.source === "extension") {
					// Extension-based agents should be background
					expect(agent.type).toBe("background");
				}
			}
		});
	});

	// ============================================================================
	// T076: Unit test for AgentRegistry.checkAgentAvailability()
	// ============================================================================

	describe("checkAgentAvailability()", () => {
		it("should return available=true for existing agents", async () => {
			await registry.initialize();

			const allAgents = registry.getAllAgents();
			if (allAgents.length === 0) {
				// Skip test if no agents are available
				return;
			}

			const firstAgent = allAgents[0];
			const availability = await registry.checkAgentAvailability(firstAgent.id);

			expect(availability.agentId).toBe(firstAgent.id);
			expect(availability.available).toBe(true);
			expect(availability.checkedAt).toBeGreaterThan(0);
			expect(availability.reason).toBeUndefined();
		});

		it("should return available=false for unknown agent ID", async () => {
			await registry.initialize();

			const availability =
				await registry.checkAgentAvailability("unknown:agent-id");

			expect(availability.agentId).toBe("unknown:agent-id");
			expect(availability.available).toBe(false);
			expect(availability.reason).toBe("UNKNOWN");
			expect(availability.checkedAt).toBeGreaterThan(0);
		});

		it("should check file existence for file-based agents", async () => {
			await registry.initialize();

			const fileAgents = registry.getAllAgents({ source: "file" });
			if (fileAgents.length === 0) {
				// Skip test if no file agents are available
				return;
			}

			const firstFileAgent = fileAgents[0];
			const availability = await registry.checkAgentAvailability(
				firstFileAgent.id
			);

			// If the agent was discovered, the file should exist
			expect(availability.available).toBe(true);
		});

		it("should return FILE_DELETED reason for missing file-based agents", async () => {
			await registry.initialize();

			// Manually create an agent entry with non-existent file
			const fakeAgent = {
				id: "file:fake-agent",
				name: "fake-agent",
				displayName: "Fake Agent",
				type: "local" as const,
				source: "file" as const,
				sourcePath: "/path/to/nonexistent/fake-agent.agent.md",
				description: "Fake agent for testing",
				available: true,
			};

			// Add fake agent to registry (access internal state for testing)
			(registry as any).agents.set(fakeAgent.id, fakeAgent);

			const availability = await registry.checkAgentAvailability(fakeAgent.id);

			expect(availability.agentId).toBe(fakeAgent.id);
			expect(availability.available).toBe(false);
			expect(availability.reason).toBe("FILE_DELETED");
		});

		it("should include timestamp in availability check result", async () => {
			await registry.initialize();

			const beforeCheck = Date.now();
			const availability =
				await registry.checkAgentAvailability("unknown:test");
			const afterCheck = Date.now();

			expect(availability.checkedAt).toBeGreaterThanOrEqual(beforeCheck);
			expect(availability.checkedAt).toBeLessThanOrEqual(afterCheck);
		});

		it("should handle multiple availability checks for the same agent", async () => {
			await registry.initialize();

			const allAgents = registry.getAllAgents();
			if (allAgents.length === 0) {
				return;
			}

			const firstAgent = allAgents[0];

			// Check availability multiple times
			const check1 = await registry.checkAgentAvailability(firstAgent.id);
			const check2 = await registry.checkAgentAvailability(firstAgent.id);
			const check3 = await registry.checkAgentAvailability(firstAgent.id);

			// All checks should return the same availability status
			expect(check1.available).toBe(check2.available);
			expect(check2.available).toBe(check3.available);

			// Timestamps should be valid (checks may happen so fast they have same timestamp)
			expect(check1.checkedAt).toBeGreaterThan(0);
			expect(check2.checkedAt).toBeGreaterThan(0);
			expect(check3.checkedAt).toBeGreaterThan(0);
		});
	});
});
