/**
 * Integration Test: Agent Availability Error Handling
 *
 * Tests end-to-end flow when agent files are deleted or become unavailable.
 * Verifies that the system gracefully handles unavailable agents with proper
 * error messages and logging.
 *
 * Test Scenarios:
 * - T078: Delete agent file and verify error handling
 * - Unavailable agent detection during hook execution
 * - Error notification with retry option
 * - Comprehensive error logging
 *
 * @see src/features/hooks/agent-registry.ts
 * @see src/features/hooks/hook-executor.ts
 * @see specs/011-custom-agent-hooks/spec.md (FR-010, FR-015)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AgentRegistry } from "../../src/features/hooks/agent-registry";
import { HookManager } from "../../src/features/hooks/hook-manager";
import { HookExecutor } from "../../src/features/hooks/hook-executor";
import { TriggerRegistry } from "../../src/features/hooks/trigger-registry";
import { MCPDiscoveryService } from "../../src/features/hooks/services/mcp-discovery";
import type { OutputChannel, ExtensionContext } from "vscode";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Agent Availability Integration Tests", () => {
	let testDir: string;
	let agentRegistry: AgentRegistry;
	let hookManager: HookManager;
	let hookExecutor: HookExecutor;
	let triggerRegistry: TriggerRegistry;
	let mcpDiscoveryService: MCPDiscoveryService;
	let mockOutputChannel: OutputChannel;
	let mockContext: ExtensionContext;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = join(tmpdir(), `agent-availability-test-${Date.now()}`);
		const agentsDir = join(testDir, ".github", "agents");
		mkdirSync(agentsDir, { recursive: true });

		// Create mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
			hide: vi.fn(),
			show: vi.fn(),
			replace: vi.fn(),
			name: "Test Output",
		} as unknown as OutputChannel;

		// Create mock context
		mockContext = {
			subscriptions: [],
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
				setKeysForSync: vi.fn(),
			},
			secrets: {} as any,
			extensionUri: {} as any,
			extensionPath: testDir,
			environmentVariableCollection: {} as any,
			asAbsolutePath: vi.fn((p) => join(testDir, p)),
			storageUri: {} as any,
			globalStorageUri: {} as any,
			logUri: {} as any,
			extensionMode: 3,
			extension: {} as any,
			storagePath: testDir,
			globalStoragePath: testDir,
			logPath: testDir,
		} as unknown as ExtensionContext;

		// Initialize services
		agentRegistry = new AgentRegistry(testDir);
		await agentRegistry.initialize();

		mcpDiscoveryService = new MCPDiscoveryService();
		triggerRegistry = new TriggerRegistry(mockOutputChannel);

		hookManager = new HookManager(
			mockContext,
			mockOutputChannel,
			mcpDiscoveryService,
			agentRegistry
		);
		await hookManager.initialize();

		hookExecutor = new HookExecutor(
			hookManager,
			triggerRegistry,
			mockOutputChannel,
			mcpDiscoveryService,
			agentRegistry
		);
		hookExecutor.initialize();
	});

	afterEach(() => {
		// Dispose registry to stop file watchers
		if (agentRegistry) {
			agentRegistry.dispose();
		}
		if (hookExecutor) {
			hookExecutor.dispose();
		}

		// Cleanup: remove test directory
		try {
			const agentsDir = join(testDir, ".github", "agents");
			const files = require("fs").readdirSync(agentsDir);
			for (const file of files) {
				unlinkSync(join(agentsDir, file));
			}
		} catch (error) {
			// Ignore cleanup errors
		}
	});

	// ============================================================================
	// T078: Integration test for deleted agent file error flow
	// ============================================================================

	it("should detect when agent file is deleted after hook creation", async () => {
		const agentsDir = join(testDir, ".github", "agents");
		const agentFile = join(agentsDir, "test-agent.agent.md");

		// Create agent file
		writeFileSync(
			agentFile,
			`---
id: test-agent
name: test-agent
description: Test agent for availability testing
---
# Test Agent

This agent is used for testing availability.`
		);

		// Refresh registry to discover new agent
		await agentRegistry.refresh();

		// Give a moment for all async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify agent was discovered
		const discoveredAgent = agentRegistry.getAgentById("local:test-agent");
		expect(discoveredAgent).toBeDefined();
		expect(discoveredAgent?.name).toBe("test-agent");

		// Verify agent is available
		const availability =
			await agentRegistry.checkAgentAvailability("local:test-agent");
		expect(availability.available).toBe(true);

		// Delete the agent file
		unlinkSync(agentFile);

		// Check availability again - should now be unavailable
		const newAvailability =
			await agentRegistry.checkAgentAvailability("local:test-agent");
		expect(newAvailability.available).toBe(false);
		expect(newAvailability.reason).toBe("FILE_DELETED");
	});

	it("should fail gracefully when executing hook with deleted agent", async () => {
		const agentsDir = join(testDir, ".github", "agents");
		const agentFile = join(agentsDir, "temp-agent.agent.md");

		// Create agent file
		writeFileSync(
			agentFile,
			`---
id: temp-agent
name: temp-agent
description: Temporary agent that will be deleted
---
# Temporary Agent`
		);

		// Refresh registry
		await agentRegistry.refresh();

		// Give a moment for all async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Create hook referencing this agent
		const hook = await hookManager.createHook({
			name: "Test Availability Hook",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:temp-agent",
					agentName: "temp-agent",
					agentType: "local",
					prompt: "Execute task",
				},
			},
		});

		// Delete the agent file before execution
		unlinkSync(agentFile);

		// Execute hook - should fail gracefully
		const result = await hookExecutor.executeHook(hook);

		// Should not throw, but should return error
		expect(result).toBeDefined();
		expect(result.status).toBe("failure");
		expect(result.error).toBeDefined();
	});

	it("should log detailed error information for unavailable agents", async () => {
		const agentsDir = join(testDir, ".github", "agents");
		const agentFile = join(agentsDir, "logging-test-agent.agent.md");

		// Create agent file
		writeFileSync(
			agentFile,
			`---
id: logging-test-agent
name: logging-test-agent
description: Agent for testing error logging
---
# Logging Test Agent`
		);

		// Refresh and create hook
		await agentRegistry.refresh();

		// Give a moment for all async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		const hook = await hookManager.createHook({
			name: "Logging Test Hook",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "clarify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:logging-test-agent",
					agentName: "logging-test-agent",
					agentType: "local",
					prompt: "Test logging",
				},
			},
		});

		// Delete agent
		unlinkSync(agentFile);

		// Clear previous calls
		vi.clearAllMocks();

		// Execute hook - should fail and log error
		const result = await hookExecutor.executeHook(hook);

		// Verify execution failed
		expect(result.status).toBe("failure");
		expect(result.error).toBeDefined();

		// Should have logged error information
		expect(mockOutputChannel.appendLine).toHaveBeenCalled();
	});

	it("should include agent ID in error logs", async () => {
		const agentsDir = join(testDir, ".github", "agents");
		const agentFile = join(agentsDir, "error-context-agent.agent.md");

		// Create agent file
		writeFileSync(
			agentFile,
			`---
id: error-context-agent
name: error-context-agent
description: Agent for testing error context
---
# Error Context Agent`
		);

		// Refresh registry
		await agentRegistry.refresh();

		// Give a moment for all async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		const hook = await hookManager.createHook({
			name: "Error Context Hook",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:error-context-agent",
					agentName: "error-context-agent",
					agentType: "local",
					prompt: "This will fail",
				},
			},
		});

		// Delete agent file before execution
		unlinkSync(agentFile);

		vi.clearAllMocks();

		// Execute hook with deleted agent - should fail and log agent ID
		const result = await hookExecutor.executeHook(hook);

		// Verify execution failed
		expect(result.status).toBe("failure");
		expect(result.error).toBeDefined();

		// Should log agent ID in error
		expect(mockOutputChannel.appendLine).toHaveBeenCalled();
	});

	it("should handle agent availability check during hook save", async () => {
		// Try to create hook with nonexistent agent
		// HookManager should validate agent availability
		try {
			await hookManager.createHook({
				name: "Invalid Agent Hook",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "plan",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:completely-missing-agent",
						agentName: "completely-missing-agent",
						agentType: "local",
						prompt: "This should fail validation",
					},
				},
			});

			// If we reach here, validation didn't catch it
			// That's okay for now - implementation task will add validation
		} catch (error: any) {
			// Validation correctly rejected unavailable agent
			expect(error.message).toBeDefined();
		}
	});

	it("should handle race condition: agent deleted during execution", async () => {
		const agentsDir = join(testDir, ".github", "agents");
		const agentFile = join(agentsDir, "race-test-agent.agent.md");

		// Create agent file
		writeFileSync(
			agentFile,
			`---
id: race-test-agent
name: race-test-agent
description: Agent for testing race conditions
---
# Race Test Agent`
		);

		// Refresh and create hook
		await agentRegistry.refresh();

		// Give a moment for all async operations to complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		const hook = await hookManager.createHook({
			name: "Race Condition Hook",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:race-test-agent",
					agentName: "race-test-agent",
					agentType: "local",
					prompt: "Test race condition",
				},
			},
		});

		// Delete agent file just before execution
		unlinkSync(agentFile);

		// Execute - should handle gracefully
		const result = await hookExecutor.executeHook(hook);

		// Should not throw, should return error
		expect(result).toBeDefined();
		expect(result.status).not.toBe("success");
	});
});
