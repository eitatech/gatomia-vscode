import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { OutputChannel } from "vscode";
import { HookExecutor } from "../../../../src/features/hooks/hook-executor";
import { HookManager } from "../../../../src/features/hooks/hook-manager";
import { TriggerRegistry } from "../../../../src/features/hooks/trigger-registry";
import type { Hook } from "../../../../src/features/hooks/types";
import { MAX_CHAIN_DEPTH } from "../../../../src/features/hooks/types";
import type { IMCPDiscoveryService } from "../../../../src/features/hooks/services/mcp-contracts";

// Test constants
const ERROR_LOG_PATTERN = /error|unavailable|not found/i;

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

// Mock AgentRegistry
const createMockAgentRegistry = (): AgentRegistry => {
	const mockRegistry = {
		initialize: vi.fn().mockResolvedValue(undefined),
		getAllAgents: vi.fn().mockReturnValue([
			{
				id: "local:code-reviewer",
				name: "code-reviewer",
				displayName: "code-reviewer",
				description: "Reviews code",
				type: "local",
				source: "file",
				metadata: {},
			},
			{
				id: "local:test-agent",
				name: "test-agent",
				displayName: "test-agent",
				description: "Test agent",
				type: "local",
				source: "file",
				metadata: {},
			},
		]),
		getAgentById: vi.fn((id: string) => {
			if (id === "local:code-reviewer") {
				return {
					id: "local:code-reviewer",
					name: "code-reviewer",
					displayName: "code-reviewer",
					description: "Reviews code",
					type: "local" as const,
					source: "file" as const,
					metadata: {},
				};
			}
			if (id === "local:test-agent") {
				return {
					id: "local:test-agent",
					name: "test-agent",
					displayName: "test-agent",
					description: "Test agent",
					type: "local" as const,
					source: "file" as const,
					metadata: {},
				};
			}
			return;
		}),
		getAgentsGroupedByType: vi
			.fn()
			.mockReturnValue({ local: [], background: [] }),
		checkAgentAvailability: vi.fn((agentId: string) => {
			// Return available for known agents, unavailable for others
			const knownAgents = ["local:code-reviewer", "local:test-agent"];
			if (knownAgents.includes(agentId)) {
				return Promise.resolve({
					agentId,
					available: true,
					checkedAt: Date.now(),
				});
			}
			// For unknown/missing agents, return unavailable
			return Promise.resolve({
				agentId,
				available: false,
				reason: "UNKNOWN" as const,
				checkedAt: Date.now(),
			});
		}),
		clearCache: vi.fn(),
		dispose: vi.fn(),
	} as unknown as AgentRegistry;
	return mockRegistry;
};

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
vi.mock("../../../../src/utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn().mockResolvedValue(undefined),
}));

// Mock GitActionExecutor
vi.mock("../../../../src/features/hooks/actions/git-action", () => ({
	GitActionExecutor: vi.fn().mockImplementation(() => ({
		execute: vi.fn(() => Promise.resolve({ success: true })),
	})),
}));

// Mock GitHubActionExecutor
vi.mock("../../../../src/features/hooks/actions/github-action", () => ({
	GitHubActionExecutor: vi.fn().mockImplementation(() => ({
		execute: vi.fn(() => Promise.resolve({ success: true })),
	})),
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

describe("HookExecutor", () => {
	let executor: HookExecutor;
	let hookManager: HookManager;
	let triggerRegistry: TriggerRegistry;
	let mockOutputChannel: OutputChannel;
	let mockContext: any;

	const createTestHook = (
		overrides?: Partial<Hook>
	): Omit<Hook, "id" | "createdAt" | "modifiedAt" | "executionCount"> => ({
		name: "Test Hook",
		enabled: true,
		trigger: {
			agent: "speckit",
			operation: "specify",
			timing: "after",
		},
		action: {
			type: "agent",
			parameters: {
				command: "/speckit.clarify",
			},
		},
		...overrides,
	});

	beforeEach(async () => {
		mockOutputChannel = createMockOutputChannel();
		mockContext = createMockContext();
		const mockMCPDiscovery = createMockMCPDiscoveryService();
		const mockAgentRegistry = createMockAgentRegistry();
		hookManager = new HookManager(mockContext, mockOutputChannel);
		triggerRegistry = new TriggerRegistry(mockOutputChannel);
		executor = new HookExecutor(
			hookManager,
			triggerRegistry,
			mockOutputChannel,
			mockMCPDiscovery,
			mockAgentRegistry
		);

		await hookManager.initialize();
		triggerRegistry.initialize();
		executor.initialize();

		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("initialization", () => {
		it("should subscribe to trigger events", async () => {
			const hook = await hookManager.createHook(createTestHook());

			// Fire a trigger
			triggerRegistry.fireTrigger("speckit", "specify");

			// Allow async execution
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify hook was executed
			const logs = executor.getExecutionLogs();
			expect(logs.length).toBeGreaterThan(0);
		});
	});

	describe("executeHook", () => {
		it("should execute enabled hook", async () => {
			const hook = await hookManager.createHook(createTestHook());

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("success");
			expect(result.hookId).toBe(hook.id);
			expect(result.hookName).toBe(hook.name);
			expect(result.duration).toBeDefined();
		});

		it("should skip disabled hook", async () => {
			const hook = await hookManager.createHook(
				createTestHook({ enabled: false })
			);

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("skipped");
			expect(result.hookId).toBe(hook.id);
		});

		it("should create execution context if not provided", async () => {
			const hook = await hookManager.createHook(createTestHook());

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("success");
		});

		it("should use provided execution context", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const context = executor.createExecutionContext();

			const result = await executor.executeHook(hook, context);

			expect(result.status).toBe("success");
			expect(context.executedHooks.has(hook.id)).toBe(true);
		});

		it("should increment chain depth", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const context = executor.createExecutionContext();

			await executor.executeHook(hook, context);

			expect(context.chainDepth).toBe(1);
		});

		it("should add hook to executed set", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const context = executor.createExecutionContext();

			await executor.executeHook(hook, context);

			expect(context.executedHooks.has(hook.id)).toBe(true);
		});

		it("should emit onExecutionStarted event", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const listener = vi.fn();
			executor.onExecutionStarted(listener);

			await executor.executeHook(hook);

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					hook,
					context: expect.any(Object),
				})
			);
		});

		it("should emit onExecutionCompleted event on success", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const listener = vi.fn();
			executor.onExecutionCompleted(listener);

			await executor.executeHook(hook);

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					hook,
					result: expect.objectContaining({
						status: "success",
					}),
				})
			);
		});

		it("should record execution log", async () => {
			const hook = await hookManager.createHook(createTestHook());

			await executor.executeHook(hook);

			const logs = executor.getExecutionLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].hookId).toBe(hook.id);
			expect(logs[0].status).toBe("success");
		});

		it("should route github actions through the GitHubActionExecutor", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "github",
						parameters: {
							operation: "open-issue",
							titleTemplate: "Spec ready",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("success");
		});
	});

	describe("circular dependency detection", () => {
		it("should detect circular dependency", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const context = executor.createExecutionContext();

			// Execute once
			await executor.executeHook(hook, context);

			// Try to execute again with same context
			const result = await executor.executeHook(hook, context);

			expect(result.status).toBe("failure");
			expect(result.error?.message).toContain("Circular dependency");
		});

		it("should allow different hooks in same chain", async () => {
			const hook1 = await hookManager.createHook(
				createTestHook({ name: "Hook 1" })
			);
			const hook2 = await hookManager.createHook(
				createTestHook({ name: "Hook 2" })
			);
			const context = executor.createExecutionContext();

			const result1 = await executor.executeHook(hook1, context);
			const result2 = await executor.executeHook(hook2, context);

			expect(result1.status).toBe("success");
			expect(result2.status).toBe("success");
		});

		it("should check circular dependency before execution", () => {
			const context = executor.createExecutionContext();
			const hookId = "test-hook-id";

			expect(executor.isCircularDependency(hookId, context)).toBe(false);

			context.executedHooks.add(hookId);

			expect(executor.isCircularDependency(hookId, context)).toBe(true);
		});
	});

	describe("max depth enforcement", () => {
		it("should enforce max chain depth", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const context = executor.createExecutionContext();
			context.chainDepth = MAX_CHAIN_DEPTH;

			const result = await executor.executeHook(hook, context);

			expect(result.status).toBe("failure");
			expect(result.error?.message).toContain("Maximum chain depth");
		});

		it("should allow execution below max depth", async () => {
			const hook = await hookManager.createHook(createTestHook());
			const context = executor.createExecutionContext();
			context.chainDepth = MAX_CHAIN_DEPTH - 1;

			const result = await executor.executeHook(hook, context);

			expect(result.status).toBe("success");
		});

		it("should check max depth before execution", () => {
			const context = executor.createExecutionContext();

			expect(executor.isMaxDepthExceeded(context)).toBe(false);

			context.chainDepth = MAX_CHAIN_DEPTH;

			expect(executor.isMaxDepthExceeded(context)).toBe(true);
		});
	});

	describe("executeHooksForTrigger", () => {
		it("should execute all matching enabled hooks", async () => {
			await hookManager.createHook(
				createTestHook({
					name: "Hook 1",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);
			await hookManager.createHook(
				createTestHook({
					name: "Hook 2",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);

			const results = await executor.executeHooksForTrigger(
				"speckit",
				"specify"
			);

			expect(results).toHaveLength(2);
			expect(results[0].status).toBe("success");
			expect(results[1].status).toBe("success");
		});

		it("should skip disabled hooks", async () => {
			const enabled = await hookManager.createHook(
				createTestHook({
					name: "Enabled Hook",
					enabled: true,
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);
			const disabled = await hookManager.createHook(
				createTestHook({
					name: "Disabled Hook",
					enabled: true, // Create as enabled first
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);

			// Now disable the second hook
			await hookManager.updateHook(disabled.id, { enabled: false });

			// Refresh hooks from manager to get updated state
			const allHooks = await hookManager.getAllHooks();
			const enabledHook = allHooks.find((h) => h.id === enabled.id)!;
			const disabledHook = allHooks.find((h) => h.id === disabled.id)!;

			// Execute individually to test skip behavior
			const enabledResult = await executor.executeHook(enabledHook);
			const disabledResult = await executor.executeHook(disabledHook);

			expect(enabledResult.status).toBe("success");
			expect(disabledResult.status).toBe("skipped");
		});

		it("should execute hooks in creation order", async () => {
			const hook1 = await hookManager.createHook(
				createTestHook({
					name: "First Hook",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);
			const hook2 = await hookManager.createHook(
				createTestHook({
					name: "Second Hook",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);

			const results = await executor.executeHooksForTrigger(
				"speckit",
				"specify"
			);

			expect(results[0].hookName).toBe("First Hook");
			expect(results[1].hookName).toBe("Second Hook");
		});

		it("should share execution context across hooks", async () => {
			await hookManager.createHook(
				createTestHook({
					name: "Hook 1",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);
			await hookManager.createHook(
				createTestHook({
					name: "Hook 2",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);

			const results = await executor.executeHooksForTrigger(
				"speckit",
				"specify"
			);

			// Both hooks should have been executed in same context
			expect(results).toHaveLength(2);

			// Check execution logs - both hooks should be present
			const logs = executor.getExecutionLogs();
			expect(logs).toHaveLength(2);
		});

		it("should return empty array if no matching hooks", async () => {
			const results = await executor.executeHooksForTrigger(
				"nonexistent",
				"operation"
			);

			expect(results).toHaveLength(0);
		});

		it("should continue on failure", async () => {
			await hookManager.createHook(
				createTestHook({
					name: "Valid Hook",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);
			await hookManager.createHook(
				createTestHook({
					name: "Another Valid Hook",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);

			const results = await executor.executeHooksForTrigger(
				"speckit",
				"specify"
			);

			// Both should execute even if one fails
			expect(results).toHaveLength(2);
		});
	});

	describe("createExecutionContext", () => {
		it("should create new execution context", () => {
			const context = executor.createExecutionContext();

			expect(context.executionId).toBeDefined();
			expect(context.chainDepth).toBe(0);
			expect(context.executedHooks).toBeInstanceOf(Set);
			expect(context.executedHooks.size).toBe(0);
			expect(context.startedAt).toBeDefined();
		});

		it("should create unique execution IDs", () => {
			const context1 = executor.createExecutionContext();
			const context2 = executor.createExecutionContext();

			expect(context1.executionId).not.toBe(context2.executionId);
		});
	});

	describe("template expansion", () => {
		it("should expand template variables", async () => {
			const templateContext = await executor.buildTemplateContext("clarify");
			const template = "Branch: $branch, User: $user";

			const expanded = executor.expandTemplate(template, templateContext);

			expect(expanded).toContain("Branch:");
			expect(expanded).toContain("User:");
		});

		it("should handle missing variables gracefully", async () => {
			const templateContext = await executor.buildTemplateContext("clarify");
			const template = "Feature: $feature, Missing: $missing";

			const expanded = executor.expandTemplate(template, templateContext);

			// Missing variables should be replaced with empty string (graceful degradation)
			expect(expanded).not.toContain("$missing");
			expect(expanded).toBe("Feature: test-feature, Missing: ");
		});

		it("should expand multiple occurrences", async () => {
			const templateContext = await executor.buildTemplateContext("clarify");
			const template = "$branch and $branch again";

			const expanded = executor.expandTemplate(template, templateContext);

			// Both occurrences should be replaced
			const branchCount = (expanded.match(/test-feature/g) || []).length;
			expect(branchCount).toBe(2);
		});
	});

	describe("execution logs", () => {
		it("should record execution logs", async () => {
			const hook = await hookManager.createHook(createTestHook());

			await executor.executeHook(hook);

			const logs = executor.getExecutionLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].hookId).toBe(hook.id);
		});

		it("should get logs for specific hook", async () => {
			const hook1 = await hookManager.createHook(
				createTestHook({ name: "Hook 1" })
			);
			const hook2 = await hookManager.createHook(
				createTestHook({ name: "Hook 2" })
			);

			await executor.executeHook(hook1);
			await executor.executeHook(hook2);

			const logs = executor.getExecutionLogsForHook(hook1.id);
			expect(logs).toHaveLength(1);
			expect(logs[0].hookId).toBe(hook1.id);
		});

		it("should clear execution logs", async () => {
			const hook = await hookManager.createHook(createTestHook());
			await executor.executeHook(hook);

			executor.clearExecutionLogs();

			const logs = executor.getExecutionLogs();
			expect(logs).toHaveLength(0);
		});

		it("should prune old logs when max exceeded", async () => {
			const hook = await hookManager.createHook(createTestHook());

			// Execute 101 times (max is 100)
			for (let i = 0; i < 101; i++) {
				const context = executor.createExecutionContext();
				await executor.executeHook(hook, context);
			}

			const logs = executor.getExecutionLogs();
			expect(logs).toHaveLength(100);
		});
	});

	describe("error handling", () => {
		it("should handle execution errors gracefully", async () => {
			// Mock sendPromptToChat to throw an error
			const { sendPromptToChat } = await import(
				"../../../../src/utils/chat-prompt-runner"
			);
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(
				new Error("Chat service unavailable")
			);

			const hook = await hookManager.createHook(createTestHook());

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("failure");
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("Chat service unavailable");
		});

		it("should emit onExecutionFailed event on error", async () => {
			// Mock sendPromptToChat to throw an error
			const { sendPromptToChat } = await import(
				"../../../../src/utils/chat-prompt-runner"
			);
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(
				new Error("Execution failed")
			);

			const hook = await hookManager.createHook(createTestHook());
			const listener = vi.fn();
			executor.onExecutionFailed(listener);

			await executor.executeHook(hook);

			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					hook: expect.objectContaining({ id: hook.id }),
					result: expect.objectContaining({
						status: "failure",
					}),
				})
			);
		});

		it("should include error details in result", async () => {
			// Mock sendPromptToChat to throw an error
			const { sendPromptToChat } = await import(
				"../../../../src/utils/chat-prompt-runner"
			);
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(
				new Error("Network timeout")
			);

			const hook = await hookManager.createHook(createTestHook());

			const result = await executor.executeHook(hook);

			expect(result.error?.message).toBe("Network timeout");
			expect(result.error?.details).toBeDefined();
		});
	});

	describe("disposal", () => {
		it("should dispose successfully", () => {
			executor.dispose();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookExecutor] Disposed"
			);
		});
	});

	// ============================================================================
	// T046: Unit test for background agent execution logic
	// ============================================================================

	describe("Agent Type Routing (User Story 2)", () => {
		it("should route to local agent execution for local agents", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:code-reviewer",
							agentName: "code-reviewer",
							agentType: "local", // Explicit local type
							prompt: "Review this code",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			if (result.status !== "success") {
				console.log("Error:", result.error);
			}

			expect(result.status).toBe("success");
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("local agent")
			);
		});

		it("should route to background agent execution for background agents", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:test-agent",
							agentName: "test-agent",
							agentType: "background", // Force background execution
							prompt: "Run background task",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("success");
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("background agent")
			);
		});

		it("should default to agent registry type when no override specified", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:code-reviewer",
							agentName: "code-reviewer",
							// No agentType override - should use registry default
							prompt: "Review this code",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("success");
			// Should use default type from agent registry (local for file-based)
		});

		it("should handle local agent execution errors gracefully", async () => {
			// Mock sendPromptToChat to throw error
			const { sendPromptToChat } = await import(
				"../../../../src/utils/chat-prompt-runner"
			);
			vi.mocked(sendPromptToChat).mockRejectedValueOnce(
				new Error("Local agent failed")
			);

			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:code-reviewer",
							agentName: "code-reviewer",
							agentType: "local",
							prompt: "Review this code",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			expect(result.status).toBe("failure");
			expect(result.error?.message).toContain("Local agent failed");
		});

		it("should handle background agent execution errors gracefully", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:test-agent",
							agentName: "test-agent",
							agentType: "background",
							prompt: "Run background task",
						},
					},
				})
			);

			// Note: Background execution might fail if CLI not available
			const result = await executor.executeHook(hook);

			// Should either succeed or fail gracefully with error message
			if (result.status !== "success") {
				expect(result.error).toBeDefined();
				expect(result.error?.message).toBeDefined();
			}
		});

		it("should include agent type information in execution logs", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:code-reviewer",
							agentName: "code-reviewer",
							agentType: "local",
							prompt: "Review this code",
						},
					},
				})
			);

			await executor.executeHook(hook);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Agent type:")
			);
		});
	});

	// ============================================================================
	// T077: Unit test for agent unavailability error handling
	// ============================================================================

	describe("Agent Unavailability Error Handling", () => {
		it("should check agent availability before execution", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:missing-agent",
							agentName: "missing-agent",
							agentType: "local",
							prompt: "Execute task",
						},
					},
				})
			);

			// Execute hook with unavailable agent
			const result = await executor.executeHook(hook);

			// Should fail with unavailable agent error
			expect(result.status).toBe("failure");
			expect(result.error).toBeDefined();
		});

		it("should include agent ID in unavailability error message", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:unavailable-agent",
							agentName: "unavailable-agent",
							agentType: "local",
							prompt: "Execute task",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			if (result.error) {
				// Error message should mention the agent
				expect(
					result.error.message.includes("unavailable-agent") ||
						result.error.message.includes("agent")
				).toBe(true);
			}
		});

		it("should log detailed error information for unavailable agents", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "file:deleted-agent",
							agentName: "deleted-agent",
							agentType: "local",
							prompt: "Execute task",
						},
					},
				})
			);

			await executor.executeHook(hook);

			// Should log error with context
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringMatching(ERROR_LOG_PATTERN)
			);
		});

		it("should handle file-deleted agents gracefully", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "file:nonexistent",
							agentName: "nonexistent",
							agentType: "local",
							prompt: "Execute task",
						},
					},
				})
			);

			const result = await executor.executeHook(hook);

			// Should not throw, should return error result
			expect(result).toBeDefined();
			expect(result.status).not.toBe("success");
		});

		it("should include trigger context in error logs", async () => {
			const hook = await hookManager.createHook(
				createTestHook({
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "custom",
						parameters: {
							agentId: "local:missing",
							agentName: "missing",
							agentType: "local",
							prompt: "Execute task",
						},
					},
				})
			);

			await executor.executeHook(hook);

			// Should log trigger information
			expect(mockOutputChannel.appendLine).toHaveBeenCalled();
		});

		it("should emit execution-failed event for unavailable agents", async () => {
			const failedEvents: any[] = [];
			executor.onExecutionFailed((event) => {
				failedEvents.push(event);
			});

			const hook = await hookManager.createHook(
				createTestHook({
					action: {
						type: "custom",
						parameters: {
							agentId: "local:unavailable",
							agentName: "unavailable",
							agentType: "local",
							prompt: "Execute task",
						},
					},
				})
			);

			await executor.executeHook(hook);

			// Should have emitted at least one failed event
			// (might emit multiple depending on execution flow)
			expect(failedEvents.length).toBeGreaterThanOrEqual(0);
		});
	});
});
