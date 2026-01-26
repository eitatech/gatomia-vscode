import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { OutputChannel } from "vscode";
import { HookExecutor } from "../../src/features/hooks/hook-executor";
import { HookManager } from "../../src/features/hooks/hook-manager";
import { TriggerRegistry } from "../../src/features/hooks/trigger-registry";
import type { AgentRegistry } from "../../src/features/hooks/agent-registry";
import type { IMCPDiscoveryService } from "../../src/features/hooks/services/mcp-contracts";

// Mock OutputChannel
const createMockOutputChannel = (): OutputChannel => ({
	name: "Test Output",
	append: vi.fn(),
	appendLine: vi.fn(),
	replace: vi.fn(),
	clear: vi.fn(),
	show: vi.fn(),
	hide: vi.fn(),
	dispose: vi.fn(),
});

// Mock MCPDiscoveryService
const createMockMCPDiscoveryService = (): IMCPDiscoveryService => ({
	discoverServers: vi.fn().mockReturnValue([]),
	getServer: vi.fn().mockReturnValue(undefined),
	getTool: vi.fn().mockReturnValue(undefined),
	clearCache: vi.fn().mockReturnValue(undefined),
	isCacheFresh: vi.fn().mockReturnValue(false),
});

// Mock ExtensionContext for HookManager
const createMockContext = (): any => {
	const storage = new Map<string, unknown>();
	return {
		workspaceState: {
			get: vi.fn(
				(key: string, defaultValue?: unknown) =>
					storage.get(key) ?? defaultValue
			),
			update: vi.fn((key: string, value: unknown) => {
				storage.set(key, value);
				return Promise.resolve();
			}),
			keys: vi.fn(() => Array.from(storage.keys())),
		},
		subscriptions: [],
	};
};

// Mock sendPromptToChat
vi.mock("../../src/utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn().mockResolvedValue(undefined),
}));

// Mock vscode extensions for Git
vi.mock("vscode", async () => {
	const actual = await vi.importActual("vscode");
	return {
		...actual,
		extensions: {
			getExtension: vi.fn(() => ({
				exports: {
					getAPI: vi.fn(() => ({
						repositories: [
							{
								state: {
									HEAD: {
										name: "123-test-feature",
									},
								},
								getConfig: vi.fn((key: string) => {
									if (key === "user.name") {
										return Promise.resolve("Test User");
									}
									return Promise.resolve(undefined);
								}),
							},
						],
					})),
				},
			})),
		},
	};
});

describe("Agent Execution Integration Tests (User Story 2)", () => {
	let executor: HookExecutor;
	let hookManager: HookManager;
	let triggerRegistry: TriggerRegistry;
	let agentRegistry: AgentRegistry;
	let mockOutputChannel: OutputChannel;
	let mockContext: any;

	beforeEach(async () => {
		mockOutputChannel = createMockOutputChannel();
		mockContext = createMockContext();
		const mockMCPDiscovery = createMockMCPDiscoveryService();

		// Create mock AgentRegistry with test agents
		agentRegistry = {
			initialize: vi.fn().mockResolvedValue(undefined),
			getAllAgents: vi.fn().mockReturnValue([
				{
					id: "local:test-agent",
					name: "test-agent",
					displayName: "Test Agent",
					description: "Test agent for integration tests",
					type: "local",
					source: "file",
					metadata: {},
				},
			]),
			getAgentById: vi.fn((id: string) => {
				if (id === "local:test-agent") {
					return {
						id: "local:test-agent",
						name: "test-agent",
						displayName: "Test Agent",
						description: "Test agent for integration tests",
						type: "local" as const,
						source: "file" as const,
						metadata: {},
					};
				}
				return;
			}),
			checkAgentAvailability: vi.fn().mockResolvedValue({
				agentId: "local:test-agent",
				available: true,
				checkedAt: Date.now(),
			}),
			getAgentsGroupedByType: vi
				.fn()
				.mockReturnValue({ local: [], background: [] }),
			clearCache: vi.fn(),
			dispose: vi.fn(),
		} as unknown as AgentRegistry;

		hookManager = new HookManager(
			mockContext,
			mockOutputChannel,
			mockMCPDiscovery,
			agentRegistry
		);
		triggerRegistry = new TriggerRegistry(mockOutputChannel);
		executor = new HookExecutor(
			hookManager,
			triggerRegistry,
			mockOutputChannel,
			mockMCPDiscovery,
			agentRegistry
		);

		await hookManager.initialize();
		triggerRegistry.initialize();
		executor.initialize();

		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should execute end-to-end: create hook → trigger → verify local agent execution", async () => {
		// Verify mock is working
		const testAgent = agentRegistry.getAgentById("local:test-agent");
		expect(testAgent).toBeDefined();
		expect(testAgent?.type).toBe("local");

		// Create a hook with local agent type
		const hook = await hookManager.createHook({
			name: "Local Agent Integration Test",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:test-agent",
					agentName: "test-agent",
					agentType: "local",
					prompt: "Review this code in {branch}",
				},
			},
		});

		// Execute the hook
		const result = await executor.executeHook(hook);

		// Verify execution succeeded
		expect(result.status).toBe("success");
		expect(result.hookId).toBe(hook.id);
		expect(result.hookName).toBe("Local Agent Integration Test");

		// Verify local agent execution was logged
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("Executing local agent")
		);
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("Local agent execution completed successfully")
		);
	});

	it("should execute end-to-end: create hook → trigger → verify background agent execution", async () => {
		// Create a hook with background agent type
		const hook = await hookManager.createHook({
			name: "Background Agent Integration Test",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:test-agent",
					agentName: "test-agent",
					agentType: "background",
					prompt: "Run analysis",
					arguments: "--verbose",
				},
			},
		});

		// Execute the hook
		const result = await executor.executeHook(hook);

		// Verify execution succeeded
		expect(result.status).toBe("success");
		expect(result.hookId).toBe(hook.id);

		// Verify background agent execution was logged
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("Executing background agent")
		);
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining(
				"Background agent execution completed successfully"
			)
		);
	});

	it("should execute end-to-end: verify template variable expansion in agent prompt", async () => {
		// Import sendPromptToChat to verify it was called with expanded template
		const { sendPromptToChat } = await import(
			"../../src/utils/chat-prompt-runner"
		);

		// Create a hook with template variables
		const hook = await hookManager.createHook({
			name: "Template Variable Test",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:test-agent",
					agentName: "test-agent",
					agentType: "local",
					prompt: "Review code in branch {branch} by {user}",
				},
			},
		});

		// Execute the hook
		const result = await executor.executeHook(hook);

		// Verify execution succeeded
		expect(result.status).toBe("success");

		// Verify sendPromptToChat was called with expanded template
		expect(sendPromptToChat).toHaveBeenCalledWith(
			expect.stringContaining("123-test-feature") // Branch name from mock
		);
		expect(sendPromptToChat).toHaveBeenCalledWith(
			expect.stringContaining("Test User") // User from mock
		);
	});

	it("should execute end-to-end: verify agent type auto-detection from registry", async () => {
		// Create a hook WITHOUT agentType override
		const hook = await hookManager.createHook({
			name: "Auto-detect Type Test",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:test-agent", // File-based agents default to "local"
					agentName: "test-agent",
					// No agentType specified - should auto-detect
					prompt: "Review code",
				},
			},
		});

		// Execute the hook
		const result = await executor.executeHook(hook);

		// Verify execution succeeded (auto-detected as local)
		expect(result.status).toBe("success");

		// Verify local execution was used (not background)
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("Executing local agent")
		);
	});

	it("should execute end-to-end: verify execution logs are recorded", async () => {
		// Create and execute a hook
		const hook = await hookManager.createHook({
			name: "Logging Test",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "custom",
				parameters: {
					agentId: "local:test-agent",
					agentName: "test-agent",
					agentType: "local",
					prompt: "Test",
				},
			},
		});

		// Execute the hook
		await executor.executeHook(hook);

		// Verify execution logs were recorded
		const logs = executor.getExecutionLogsForHook(hook.id);
		expect(logs.length).toBe(1);
		expect(logs[0]?.hookId).toBe(hook.id);
		expect(logs[0]?.status).toBe("success");
		expect(logs[0]?.duration).toBeGreaterThanOrEqual(0); // Duration may be 0 for instant execution
	});
});
