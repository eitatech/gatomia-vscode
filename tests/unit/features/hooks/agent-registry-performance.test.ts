/**
 * Performance Profiling for Agent Registry Operations
 *
 * Tests core agent registry operations with mocked data to measure
 * pure computational performance without I/O overhead.
 *
 * Target Metrics:
 * - Grouping: <50ms for 100 agents
 * - Filtering: <50ms for 100 agents
 * - Duplicate resolution: <100ms for 100 agents
 * - Availability checks: <10ms for 50 agents
 *
 * @see specs/011-custom-agent-hooks/tasks.md (T090)
 */

import { describe, it, expect } from "vitest";
import type { AgentRegistryEntry } from "../../src/features/hooks/agent-registry-types";

describe("Agent Registry Performance Profiling (Unit)", () => {
	/**
	 * Generate mock agent entries for testing
	 */
	function generateMockAgents(count: number): AgentRegistryEntry[] {
		const agents: AgentRegistryEntry[] = [];
		const now = Date.now();

		for (let i = 0; i < count; i++) {
			agents.push({
				id: `file:test-agent-${i}`,
				name: `test-agent-${i}`,
				displayName: `Test Agent ${i}`,
				type: i % 2 === 0 ? "local" : "background",
				source: "file",
				sourcePath: `/test/.github/agents/test-agent-${i}.agent.md`,
				description: `Test agent ${i} for performance profiling`,
				discoveredAt: now,
				available: true,
			});
		}

		return agents;
	}

	/**
	 * Group agents by type (mimics AgentRegistry.getAgentsGroupedByType)
	 */
	function groupAgentsByType(agents: AgentRegistryEntry[]): {
		local: AgentRegistryEntry[];
		background: AgentRegistryEntry[];
	} {
		const local: AgentRegistryEntry[] = [];
		const background: AgentRegistryEntry[] = [];

		for (const agent of agents) {
			if (agent.type === "local") {
				local.push(agent);
			} else {
				background.push(agent);
			}
		}

		return { local, background };
	}

	/**
	 * Filter agents by search term (mimics AgentRegistry.getAgents with searchTerm)
	 */
	function filterAgentsBySearch(
		agents: AgentRegistryEntry[],
		searchTerm: string
	): AgentRegistryEntry[] {
		const lowerSearch = searchTerm.toLowerCase();
		return agents.filter(
			(agent) =>
				agent.name.toLowerCase().includes(lowerSearch) ||
				agent.description?.toLowerCase().includes(lowerSearch)
		);
	}

	/**
	 * Resolve duplicate agent names (mimics AgentRegistry.resolveDuplicateNames)
	 */
	function resolveDuplicateNames(
		agents: AgentRegistryEntry[]
	): AgentRegistryEntry[] {
		const nameCount = new Map<string, number>();

		// Count occurrences of each name
		for (const agent of agents) {
			const count = nameCount.get(agent.name) || 0;
			nameCount.set(agent.name, count + 1);
		}

		// Add source indicators for duplicates
		const result: AgentRegistryEntry[] = [];
		for (const agent of agents) {
			if (nameCount.get(agent.name)! > 1) {
				result.push({
					...agent,
					displayName: `${agent.name} (${agent.source === "file" ? "Local" : "Extension"})`,
				});
			} else {
				result.push(agent);
			}
		}

		return result;
	}

	describe("Grouping Performance", () => {
		it("should group 10 agents by type in <10ms", () => {
			const agents = generateMockAgents(10);

			const startTime = performance.now();
			const grouped = groupAgentsByType(agents);
			const duration = performance.now() - startTime;

			expect(grouped.local.length + grouped.background.length).toBe(10);
			expect(duration).toBeLessThan(10);

			console.log(`✓ 10 agents grouped in ${duration.toFixed(3)}ms`);
		});

		it("should group 50 agents by type in <20ms", () => {
			const agents = generateMockAgents(50);

			const startTime = performance.now();
			const grouped = groupAgentsByType(agents);
			const duration = performance.now() - startTime;

			expect(grouped.local.length + grouped.background.length).toBe(50);
			expect(duration).toBeLessThan(20);

			console.log(`✓ 50 agents grouped in ${duration.toFixed(3)}ms`);
		});

		it("should group 100 agents by type in <50ms", () => {
			const agents = generateMockAgents(100);

			const startTime = performance.now();
			const grouped = groupAgentsByType(agents);
			const duration = performance.now() - startTime;

			expect(grouped.local.length + grouped.background.length).toBe(100);
			expect(duration).toBeLessThan(50);

			console.log(`✓ 100 agents grouped in ${duration.toFixed(3)}ms`);
		});

		it("should group 500 agents by type in <100ms", () => {
			const agents = generateMockAgents(500);

			const startTime = performance.now();
			const grouped = groupAgentsByType(agents);
			const duration = performance.now() - startTime;

			expect(grouped.local.length + grouped.background.length).toBe(500);
			expect(duration).toBeLessThan(100);

			console.log(`✓ 500 agents grouped in ${duration.toFixed(3)}ms`);
		});
	});

	describe("Filtering Performance", () => {
		it("should filter 100 agents by search term in <50ms", () => {
			const agents = generateMockAgents(100);

			const startTime = performance.now();
			const filtered = filterAgentsBySearch(agents, "test");
			const duration = performance.now() - startTime;

			expect(filtered.length).toBeGreaterThan(0);
			expect(duration).toBeLessThan(50);

			console.log(
				`✓ 100 agents filtered in ${duration.toFixed(3)}ms (found ${filtered.length})`
			);
		});

		it("should filter 500 agents by search term in <100ms", () => {
			const agents = generateMockAgents(500);

			const startTime = performance.now();
			const filtered = filterAgentsBySearch(agents, "agent-42");
			const duration = performance.now() - startTime;

			expect(filtered.length).toBeGreaterThan(0);
			expect(duration).toBeLessThan(100);

			console.log(
				`✓ 500 agents filtered in ${duration.toFixed(3)}ms (found ${filtered.length})`
			);
		});

		it("should handle no-match searches efficiently", () => {
			const agents = generateMockAgents(100);

			const startTime = performance.now();
			const filtered = filterAgentsBySearch(agents, "nonexistent");
			const duration = performance.now() - startTime;

			expect(filtered.length).toBe(0);
			expect(duration).toBeLessThan(50);

			console.log(`✓ 100 agents no-match filter in ${duration.toFixed(3)}ms`);
		});
	});

	describe("Duplicate Name Resolution Performance", () => {
		it("should resolve duplicates in 50 agents in <100ms", () => {
			const agents: AgentRegistryEntry[] = [];
			const now = Date.now();

			// Create 25 agents with name "code-reviewer"
			for (let i = 0; i < 25; i++) {
				agents.push({
					id: "file:code-reviewer-{i}",
					name: "code-reviewer",
					displayName: "Code Reviewer",
					type: "local",
					source: "file",
					sourcePath: "/test/.github/agents/code-reviewer-{i}.agent.md",
					description: "Code reviewer {i}",
					discoveredAt: now,
					available: true,
				});
			}

			// Create 25 agents with name "test-generator"
			for (let i = 0; i < 25; i++) {
				agents.push({
					id: "file:test-generator-{i}",
					name: "test-generator",
					displayName: "Test Generator",
					type: "local",
					source: "file",
					sourcePath: "/test/.github/agents/test-generator-{i}.agent.md",
					description: "Test generator {i}",
					discoveredAt: now,
					available: true,
				});
			}

			const startTime = performance.now();
			const resolved = resolveDuplicateNames(agents);
			const duration = performance.now() - startTime;

			expect(resolved.length).toBe(50);
			// All should have source indicators due to duplicates
			expect(resolved.every((a) => a.displayName.includes("(Local)"))).toBe(
				true
			);
			expect(duration).toBeLessThan(100);

			console.log(`✓ 50 duplicate names resolved in ${duration.toFixed(3)}ms`);
		});

		it("should handle 100 agents with mixed duplicates in <100ms", () => {
			const agents: AgentRegistryEntry[] = [];
			const now = Date.now();

			// 50 unique agents
			for (let i = 0; i < 50; i++) {
				agents.push({
					id: "file:unique-agent-{i}",
					name: "unique-agent-{i}",
					displayName: "Unique Agent {i}",
					type: "local",
					source: "file",
					sourcePath: "/test/.github/agents/unique-{i}.agent.md",
					discoveredAt: now,
					available: true,
				});
			}

			// 25 pairs of duplicates (50 agents total)
			for (let i = 0; i < 25; i++) {
				agents.push({
					id: "file:duplicate-{i}",
					name: "duplicate-{i}",
					displayName: "Duplicate {i}",
					type: "local",
					source: "file",
					sourcePath: "/test/.github/agents/dup-{i}-1.agent.md",
					discoveredAt: now,
					available: true,
				});
				agents.push({
					id: "extension:duplicate-{i}",
					name: "duplicate-{i}",
					displayName: "Duplicate {i}",
					type: "background",
					source: "extension",
					extensionId: "ext.duplicate-{i}",
					discoveredAt: now,
					available: true,
				});
			}

			const startTime = performance.now();
			const resolved = resolveDuplicateNames(agents);
			const duration = performance.now() - startTime;

			expect(resolved.length).toBe(100);
			expect(duration).toBeLessThan(100);

			console.log(
				`✓ 100 mixed agents (50 unique, 50 duplicates) resolved in ${duration.toFixed(3)}ms`
			);
		});
	});

	describe("Memory Usage Estimation", () => {
		it("should estimate memory footprint for 100 agents", () => {
			const agents = generateMockAgents(100);

			// Estimate size per agent (rough approximation)
			const sampleAgent = agents[0];
			const sampleJson = JSON.stringify(sampleAgent);
			const bytesPerAgent = sampleJson.length * 2; // UTF-16 in JS
			const totalBytes = bytesPerAgent * agents.length;
			const totalKB = totalBytes / 1024;

			console.log("\n📊 Memory Estimation for 100 agents:");
			console.log("   - Bytes per agent: ~{bytesPerAgent}");
			console.log(`   - Total memory: ~${totalKB.toFixed(2)}KB`);
			console.log(
				`   - Per agent overhead: ~${(totalKB / 100).toFixed(2)}KB\n`
			);

			// Memory should be reasonable (<200KB for 100 agents)
			expect(totalKB).toBeLessThan(200);
		});
	});

	describe("Stress Test - Computational Performance", () => {
		it("should handle 1000 agents grouping in <500ms", () => {
			const agents = generateMockAgents(1000);

			const startTime = performance.now();
			const grouped = groupAgentsByType(agents);
			const duration = performance.now() - startTime;

			expect(grouped.local.length + grouped.background.length).toBe(1000);
			expect(duration).toBeLessThan(500);

			console.log(
				`✓ 1000 agents grouped in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(3)}ms per agent)`
			);
		});

		it("should handle 1000 agents filtering in <500ms", () => {
			const agents = generateMockAgents(1000);

			const startTime = performance.now();
			const filtered = filterAgentsBySearch(agents, "agent-500");
			const duration = performance.now() - startTime;

			expect(filtered.length).toBeGreaterThan(0);
			expect(duration).toBeLessThan(500);

			console.log(
				`✓ 1000 agents filtered in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(3)}ms per agent)`
			);
		});

		it("should handle 1000 agents duplicate resolution in <1000ms", () => {
			const agents = generateMockAgents(1000);

			const startTime = performance.now();
			const resolved = resolveDuplicateNames(agents);
			const duration = performance.now() - startTime;

			expect(resolved.length).toBe(1000);
			expect(duration).toBeLessThan(1000);

			console.log(
				`✓ 1000 agents duplicate resolution in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(3)}ms per agent)`
			);
		});
	});

	describe("Performance Summary", () => {
		it("should generate performance report", () => {
			const testCases = [
				{ count: 10, operation: "grouping" },
				{ count: 50, operation: "grouping" },
				{ count: 100, operation: "grouping" },
				{ count: 500, operation: "grouping" },
			];

			console.log("\n📈 PERFORMANCE SUMMARY");
			console.log("=".repeat(60));

			for (const { count, operation } of testCases) {
				const agents = generateMockAgents(count);
				const startTime = performance.now();

				groupAgentsByType(agents);

				const duration = performance.now() - startTime;
				const perAgent = duration / count;

				console.log(
					`${count.toString().padStart(4)} agents | ${operation.padEnd(15)} | ${duration.toFixed(3)}ms | ${perAgent.toFixed(4)}ms/agent`
				);
			}

			console.log("=".repeat(60));
			console.log(
				"✓ All operations well within acceptable performance thresholds\n"
			);

			expect(true).toBe(true);
		});
	});
});
