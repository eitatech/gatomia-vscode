/**
 * Integration Test: Extension Agent Discovery
 *
 * Tests end-to-end flow of discovering agents from VS Code extensions and
 * displaying them in the agent dropdown.
 *
 * Test Flow:
 * 1. Initialize AgentRegistry with ExtensionAgentDiscovery
 * 2. Trigger agent discovery (scans extensions)
 * 3. Verify extension agents appear in registry
 * 4. Verify extension agents grouped correctly (background agents)
 * 5. Verify hook can be created with extension agent
 *
 * @see src/features/hooks/extension-agent-discovery.ts
 * @see src/features/hooks/agent-registry.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Extension } from "vscode";

// ============================================================================
// Mock vscode module at top level
// ============================================================================

// Create a mutable mock state
const mockState = {
	extensions: [] as readonly Extension<any>[],
};

// Mock vscode module
vi.mock("vscode", async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		extensions: {
			get all() {
				return mockState.extensions;
			},
			getExtension: (id: string) =>
				mockState.extensions.find((ext: any) => ext.id === id),
		},
		workspace: {
			...actual.workspace,
			createFileSystemWatcher: vi.fn().mockReturnValue({
				onDidCreate: vi.fn(),
				onDidChange: vi.fn(),
				onDidDelete: vi.fn(),
				dispose: vi.fn(),
			}),
			getWorkspaceFolder: vi.fn(),
		},
	};
});

// Import after mocking
const { AgentRegistry } = await import(
	"../../src/features/hooks/agent-registry"
);
const { HookManager } = await import("../../src/features/hooks/hook-manager");

// ============================================================================
// Test Setup
// ============================================================================

// Test constants
const EXTENSION_ID_REGEX = /^[a-z0-9.-]+$/i;

describe("Extension Agent Discovery Integration", () => {
	let agentRegistry: InstanceType<typeof AgentRegistry>;
	let hookManager: InstanceType<typeof HookManager>;
	let mockOutputChannel: any;
	let mockContext: any;
	let mockMCPDiscovery: any;

	beforeEach(async () => {
		// Reset mock state with default test extensions
		mockState.extensions = [
			{
				id: "github.copilot",
				packageJSON: {
					contributes: {
						chatParticipants: [
							{
								id: "copilot",
								name: "copilot",
								description: "GitHub Copilot chat participant",
							},
						],
					},
				},
				isActive: true,
			},
			{
				id: "ms-vscode.vscode-copilot-nightly",
				packageJSON: {
					contributes: {
						chatParticipants: [
							{
								id: "copilot-nightly",
								name: "copilot-nightly",
								description: "GitHub Copilot Nightly",
							},
						],
					},
				},
				isActive: true,
			},
			{
				id: "other.extension",
				packageJSON: {
					contributes: {
						// No chatParticipants
					},
				},
				isActive: false,
			},
		] as unknown as readonly Extension<any>[];

		// Create mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			name: "Test",
			replace: vi.fn(),
		};

		// Create mock context
		mockContext = {
			subscriptions: [],
			workspaceState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
			},
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn(),
			},
			extensionPath: "/test/path",
			extensionUri: { fsPath: "/test/path" } as any,
			storagePath: "/test/storage",
			globalStoragePath: "/test/global-storage",
			logPath: "/test/logs",
		};

		// Create mock MCP discovery
		mockMCPDiscovery = {
			discoverServers: vi.fn().mockResolvedValue([]),
			getServer: vi.fn().mockReturnValue(undefined),
			getTool: vi.fn().mockReturnValue(undefined),
			clearCache: vi.fn(),
		};

		// Initialize AgentRegistry with temporary directory
		agentRegistry = new AgentRegistry("/tmp/test-workspace");
		await agentRegistry.initialize();

		// Initialize HookManager
		hookManager = new HookManager(
			mockContext,
			mockOutputChannel,
			mockMCPDiscovery,
			agentRegistry
		);
		await hookManager.initialize();
	});

	// ========================================================================
	// T070: Extension agents appear in dropdown
	// ========================================================================

	it("should discover extension agents and make them available in registry", () => {
		// Get all agents from registry
		const allAgents = agentRegistry.getAllAgents();

		// Should include extension agents
		const extensionAgents = allAgents.filter(
			(agent) => agent.source === "extension"
		);

		expect(extensionAgents.length).toBeGreaterThan(0);

		// Verify GitHub Copilot agent
		const copilotAgent = extensionAgents.find((agent) =>
			agent.id.includes("copilot")
		);
		expect(copilotAgent).toBeDefined();
		expect(copilotAgent?.type).toBe("background");
		expect(copilotAgent?.source).toBe("extension");
		expect(copilotAgent?.available).toBe(true);
	});

	it("should group extension agents under background agents", () => {
		// Get agents grouped by type
		const grouped = agentRegistry.getAgentsGroupedByType();

		// Extension agents should be in background group
		const backgroundExtensionAgents = grouped.background.filter(
			(agent) => agent.source === "extension"
		);

		expect(backgroundExtensionAgents.length).toBeGreaterThan(0);

		// No extension agents should be in local group
		const localExtensionAgents = grouped.local.filter(
			(agent) => agent.source === "extension"
		);

		expect(localExtensionAgents).toHaveLength(0);
	});

	it("should allow creating hook with extension agent", async () => {
		// Get an extension agent
		const allAgents = agentRegistry.getAllAgents({ source: "extension" });
		expect(allAgents.length).toBeGreaterThan(0);

		const extensionAgent = allAgents[0];
		expect(extensionAgent).toBeDefined();

		// Create hook with extension agent
		const hook = await hookManager.createHook({
			name: "Test Hook with Extension Agent",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: extensionAgent?.id || "",
					agentName: extensionAgent?.name || "",
					prompt: "Test prompt",
				},
			},
		});

		expect(hook).toBeDefined();
		expect(hook.action.type).toBe("custom");
		if (hook.action.type === "custom") {
			expect(hook.action.parameters.agentId).toBe(extensionAgent?.id);
		}
	});

	it("should validate extension agent exists before creating hook", async () => {
		// Try to create hook with non-existent extension agent
		await expect(
			hookManager.createHook({
				name: "Test Hook with Invalid Agent",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "extension:non.existent:agent",
						agentName: "non-existent-agent",
						prompt: "Test prompt",
					},
				},
			})
		).rejects.toThrow();
	});

	it("should discover multiple extension agents from single extension", async () => {
		// Update mock state with multi-participant extension
		mockState.extensions = [
			{
				id: "multi.participant",
				packageJSON: {
					contributes: {
						chatParticipants: [
							{
								id: "agent1",
								name: "agent1",
								description: "First Agent",
							},
							{
								id: "agent2",
								name: "agent2",
								description: "Second Agent",
							},
						],
					},
				},
				isActive: true,
			},
		] as unknown as readonly Extension<any>[];

		// Re-initialize registry to pick up new mock
		const newRegistry = new AgentRegistry("/tmp/test-workspace-2");
		await newRegistry.initialize();

		const agents = newRegistry.getAllAgents({ source: "extension" });

		// Should have both agents from the extension
		const multiAgents = agents.filter((agent) =>
			agent.id.includes("multi.participant")
		);
		expect(multiAgents).toHaveLength(2);
		expect(multiAgents[0]?.id).toContain("agent1");
		expect(multiAgents[1]?.id).toContain("agent2");
	});

	it("should include extension metadata in agent entry", () => {
		const agents = agentRegistry.getAllAgents({ source: "extension" });
		expect(agents.length).toBeGreaterThan(0);

		const agent = agents[0];
		expect(agent?.extensionId).toBeDefined();
		expect(agent?.extensionId).toMatch(EXTENSION_ID_REGEX);
	});

	it("should refresh agent list when extension installed/uninstalled", async () => {
		// Get initial agent count
		const initialAgents = agentRegistry.getAllAgents({ source: "extension" });
		const initialCount = initialAgents.length;

		// Update mock state with new extension
		mockState.extensions = [
			...mockState.extensions,
			{
				id: "new.extension",
				packageJSON: {
					contributes: {
						chatParticipants: [
							{
								id: "new-agent",
								name: "new-agent",
								description: "Newly installed agent",
							},
						],
					},
				},
				isActive: true,
			},
		] as unknown as readonly Extension<any>[];

		// Refresh agent registry
		await agentRegistry.refresh();

		// Verify new agent appears
		const updatedAgents = agentRegistry.getAllAgents({ source: "extension" });
		expect(updatedAgents.length).toBeGreaterThanOrEqual(initialCount);

		const newAgent = updatedAgents.find((agent) =>
			agent.id.includes("new.extension")
		);
		expect(newAgent).toBeDefined();
	});

	it("should handle extension agents with missing optional fields gracefully", async () => {
		// Update mock state with minimal extension
		mockState.extensions = [
			{
				id: "minimal.extension",
				packageJSON: {
					contributes: {
						chatParticipants: [
							{
								id: "minimal-agent",
								name: "minimal-agent",
								// Missing description
							},
						],
					},
				},
				isActive: true,
			},
		] as unknown as readonly Extension<any>[];

		const newRegistry = new AgentRegistry("/tmp/test-workspace-3");
		await newRegistry.initialize();

		const agents = newRegistry.getAllAgents({ source: "extension" });
		const minimalAgent = agents.find((agent) =>
			agent.id.includes("minimal.extension")
		);

		expect(minimalAgent).toBeDefined();
		expect(minimalAgent?.description).toBeDefined(); // Should have fallback description
	});
});
