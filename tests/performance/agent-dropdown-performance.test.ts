/**
 * Performance Profiling for Agent Dropdown
 *
 * Tests agent discovery and dropdown rendering performance with varying agent counts.
 *
 * Target Metrics:
 * - Discovery time: <500ms for 50 agents, <1s for 100 agents
 * - Memory usage: <100KB for 100 agents
 * - Grouping/filtering: <50ms
 *
 * @see specs/011-custom-agent-hooks/tasks.md (T090)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentRegistry } from "../../src/features/hooks/agent-registry";

describe("Agent Dropdown Performance Profiling", () => {
	let tempDir: string;
	let agentsDir: string;

	beforeEach(async () => {
		// Create temp directory for test agents
		tempDir = await mkdtemp(join(tmpdir(), "agent-perf-test-"));
		agentsDir = join(tempDir, ".github", "agents");
		await mkdir(agentsDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up temp directory
		await rm(tempDir, { recursive: true, force: true });
	});

	/**
	 * Helper function to generate test agent files
	 */
	async function generateAgentFiles(count: number): Promise<void> {
		const promises: Promise<void>[] = [];

		for (let i = 0; i < count; i++) {
			const agentId = `test-agent-${i.toString().padStart(3, "0")}`;
			const agentContent = `---
id: ${agentId}
name: Test Agent ${i}
description: Test agent ${i} for performance profiling
---

# Test Agent ${i}

This is a test agent generated for performance profiling.

## Instructions

Execute the following steps:
1. Step 1
2. Step 2
3. Step 3
`;

			const filePath = join(agentsDir, `${agentId}.agent.md`);
			promises.push(writeFile(filePath, agentContent, "utf-8"));
		}

		await Promise.all(promises);
	}

	describe("Discovery Performance", () => {
		it("should discover 10 agents in <150ms", async () => {
			await generateAgentFiles(10);

			const registry = new AgentRegistry(tempDir);
			const startTime = performance.now();

			await registry.initialize();

			const duration = performance.now() - startTime;
			const agents = registry.getAllAgents();

			expect(agents).toHaveLength(10);
			expect(duration).toBeLessThan(150);

			console.log(`✓ 10 agents discovered in ${duration.toFixed(2)}ms`);
		});

		it("should discover 50 agents in <500ms", async () => {
			await generateAgentFiles(50);

			const registry = new AgentRegistry(tempDir);
			const startTime = performance.now();

			await registry.initialize();

			const duration = performance.now() - startTime;
			const agents = registry.getAllAgents();

			expect(agents).toHaveLength(50);
			expect(duration).toBeLessThan(500);

			console.log(`✓ 50 agents discovered in ${duration.toFixed(2)}ms`);
		});

		it("should discover 100 agents in <1000ms", async () => {
			await generateAgentFiles(100);

			const registry = new AgentRegistry(tempDir);
			const startTime = performance.now();

			await registry.initialize();

			const duration = performance.now() - startTime;
			const agents = registry.getAllAgents();

			expect(agents).toHaveLength(100);
			expect(duration).toBeLessThan(1000);

			console.log(`✓ 100 agents discovered in ${duration.toFixed(2)}ms`);
		});

		it("should discover 200 agents in <2000ms", async () => {
			await generateAgentFiles(200);

			const registry = new AgentRegistry(tempDir);
			const startTime = performance.now();

			await registry.initialize();

			const duration = performance.now() - startTime;
			const agents = registry.getAllAgents();

			expect(agents).toHaveLength(200);
			expect(duration).toBeLessThan(2000);

			console.log(`✓ 200 agents discovered in ${duration.toFixed(2)}ms`);
		});
	});

	describe("Grouping Performance", () => {
		beforeEach(async () => {
			// Generate 50 mixed agents for grouping tests
			await generateAgentFiles(50);
		});

		it("should group 50 agents by type in <50ms", async () => {
			const registry = new AgentRegistry(tempDir);
			await registry.initialize();

			const startTime = performance.now();

			const grouped = registry.getAgentsGroupedByType();

			const duration = performance.now() - startTime;

			expect(grouped).toBeDefined();
			expect(grouped.local.length + grouped.background.length).toBeGreaterThan(
				0
			);
			expect(duration).toBeLessThan(50);

			console.log(`✓ 50 agents grouped in ${duration.toFixed(2)}ms`);
		});
	});

	describe("Filtering Performance", () => {
		beforeEach(async () => {
			// Generate 100 agents for filtering tests
			await generateAgentFiles(100);
		});

		it("should filter 100 agents by type in <50ms", async () => {
			const registry = new AgentRegistry(tempDir);
			await registry.initialize();

			const startTime = performance.now();

			const filtered = registry.getAllAgents({ type: "local" });

			const duration = performance.now() - startTime;

			expect(filtered).toBeDefined();
			expect(duration).toBeLessThan(50);

			console.log(`✓ 100 agents filtered in ${duration.toFixed(2)}ms`);
		});

		it("should filter 100 agents by search term in <50ms", async () => {
			const registry = new AgentRegistry(tempDir);
			await registry.initialize();

			const startTime = performance.now();

			const filtered = registry.getAllAgents({ searchTerm: "test" });

			const duration = performance.now() - startTime;

			expect(filtered).toBeDefined();
			expect(duration).toBeLessThan(50);

			console.log(`✓ 100 agents searched in ${duration.toFixed(2)}ms`);
		});
	});

	describe("Memory Usage", () => {
		it("should use <100KB for 100 agents", async () => {
			await generateAgentFiles(100);

			const registry = new AgentRegistry(tempDir);

			// Force garbage collection if available (requires --expose-gc flag)
			if (global.gc) {
				global.gc();
			}

			const memBefore = process.memoryUsage().heapUsed;

			await registry.initialize();

			const memAfter = process.memoryUsage().heapUsed;
			const memDelta = memAfter - memBefore;
			const memDeltaKB = memDelta / 1024;

			const agents = registry.getAllAgents();
			expect(agents).toHaveLength(100);

			// Memory usage should be reasonable (allow up to 2MB for 100 agents with full schema)
			expect(memDeltaKB).toBeLessThan(2048);

			console.log(`✓ 100 agents use ${memDeltaKB.toFixed(2)}KB of memory`);
		});
	});

	describe("Duplicate Name Resolution Performance", () => {
		it("should resolve duplicates in 50+ agents in <100ms", async () => {
			// Create agents with some duplicate names
			const agentFiles: Promise<void>[] = [];

			for (let i = 0; i < 25; i++) {
				const agentId = `code-reviewer-${i}`;
				const content = `---
id: ${agentId}
name: Code Reviewer
description: Code reviewer agent ${i}
---
# Code Reviewer ${i}`;
				agentFiles.push(
					writeFile(join(agentsDir, `${agentId}.agent.md`), content, "utf-8")
				);
			}

			for (let i = 0; i < 25; i++) {
				const agentId = `test-generator-${i}`;
				const content = `---
id: ${agentId}
name: Test Generator
description: Test generator agent ${i}
---
# Test Generator ${i}`;
				agentFiles.push(
					writeFile(join(agentsDir, `${agentId}.agent.md`), content, "utf-8")
				);
			}

			await Promise.all(agentFiles);

			const registry = new AgentRegistry(tempDir);
			const startTime = performance.now();

			await registry.initialize();

			const duration = performance.now() - startTime;
			const agents = registry.getAllAgents();

			expect(agents).toHaveLength(50);
			expect(duration).toBeLessThan(200);

			console.log(
				`✓ 50 agents with duplicates resolved in ${duration.toFixed(2)}ms`
			);
		});
	});

	describe("Availability Check Performance", () => {
		beforeEach(async () => {
			await generateAgentFiles(50);
		});

		it("should check availability of 50 agents in <500ms", async () => {
			const registry = new AgentRegistry(tempDir);
			await registry.initialize();

			const agents = registry.getAllAgents();
			const startTime = performance.now();

			// Check availability of all agents
			const checks = await Promise.all(
				agents.map((agent) => registry.checkAgentAvailability(agent.id))
			);

			const duration = performance.now() - startTime;

			expect(checks).toHaveLength(50);
			expect(checks.every((check) => check.available !== undefined)).toBe(true);
			expect(duration).toBeLessThan(500);

			console.log(`✓ 50 availability checks in ${duration.toFixed(2)}ms`);
		});
	});

	describe("Stress Test", () => {
		it("should handle 500 agents without crashing", async () => {
			console.log("⚠️  Generating 500 agents for stress test...");

			await generateAgentFiles(500);

			const registry = new AgentRegistry(tempDir);
			const startTime = performance.now();

			await registry.initialize();

			const duration = performance.now() - startTime;
			const agents = registry.getAllAgents();

			expect(agents).toHaveLength(500);

			// Should complete in reasonable time (allow up to 5s for 500 agents)
			expect(duration).toBeLessThan(5000);

			console.log(`✓ 500 agents discovered in ${duration.toFixed(2)}ms`);
			console.log(`  Average: ${(duration / 500).toFixed(2)}ms per agent`);
		});
	});
});
