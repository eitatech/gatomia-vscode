import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { ExtensionContext, OutputChannel } from "vscode";
import { Uri } from "vscode";
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	existsSync,
	rmSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HookManager } from "../../src/features/hooks/hook-manager";
import { AgentRegistry } from "../../src/features/hooks/agent-registry";
import type { Hook } from "../../src/features/hooks/types";
import { HookExecutor } from "../../src/features/hooks/hook-executor";
import { TriggerRegistry } from "../../src/features/hooks/trigger-registry";

// Regex constants for test assertions
const HOOK_VALIDATION_FAILED_REGEX = /Hook validation failed/;

const createMockOutputChannel = (): OutputChannel =>
	({
		appendLine: vi.fn(),
		append: vi.fn(),
		clear: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
		name: "Test Output",
		replace: vi.fn(),
	}) as unknown as OutputChannel;

const createMockContext = (): ExtensionContext => {
	const storage = new Map<string, unknown>();

	return {
		extensionUri: Uri.parse("file:///mock-extension"),
		subscriptions: [],
		workspaceState: {
			get: vi.fn((key: string, defaultValue?: unknown) =>
				storage.has(key) ? storage.get(key) : defaultValue
			),
			update: vi.fn((key: string, value: unknown) => {
				storage.set(key, value);
				return Promise.resolve();
			}),
			keys: vi.fn(() => Array.from(storage.keys())),
		},
		globalState: {} as any,
		secrets: {} as any,
		asAbsolutePath: vi.fn(),
		extensionPath: "",
		environmentVariableCollection: {} as any,
		extensionMode: 2,
		globalStoragePath: "",
		globalStorageUri: Uri.parse("file:///global"),
		logPath: "",
		logUri: Uri.parse("file:///log"),
		storagePath: "",
		storageUri: Uri.parse("file:///storage"),
	} as unknown as ExtensionContext;
};

/**
 * T015: Integration test for agent dropdown flow end-to-end
 *
 * Tests the complete workflow:
 * 1. Agent discovery from .github/agents/*.agent.md files
 * 2. AgentRegistry grouping and filtering
 * 3. Hook creation with custom agent selection
 * 4. Agent validation before saving hooks
 * 5. Handling unavailable agents gracefully
 */
describe("Agent Dropdown Flow Integration (T015)", () => {
	let tempDir: string;
	let agentsDir: string;
	let context: ExtensionContext;
	let outputChannel: OutputChannel;
	let agentRegistry: AgentRegistry;
	let hookManager: HookManager;
	let hookExecutor: HookExecutor;
	let triggerRegistry: TriggerRegistry;

	beforeEach(async () => {
		// Create temporary workspace with .github/agents directory
		tempDir = mkdtempSync(join(tmpdir(), "agent-dropdown-test-"));
		agentsDir = join(tempDir, ".github", "agents");
		mkdirSync(agentsDir, { recursive: true });

		// Create test agent files
		const codeReviewerAgent = `---
id: code-reviewer
name: Code Reviewer
description: Reviews code for quality and best practices
---
# Code Reviewer Agent

Reviews pull requests and suggests improvements.
`;

		const docWriterAgent = `---
id: doc-writer
name: Doc Writer
description: Writes documentation for code
---
# Doc Writer Agent

Generates comprehensive documentation.
`;

		writeFileSync(join(agentsDir, "code-reviewer.agent.md"), codeReviewerAgent);
		writeFileSync(join(agentsDir, "doc-writer.agent.md"), docWriterAgent);

		// Initialize test infrastructure
		context = createMockContext();
		outputChannel = createMockOutputChannel();
		triggerRegistry = new TriggerRegistry(outputChannel);
		triggerRegistry.initialize();

		// Initialize AgentRegistry with temp workspace
		agentRegistry = new AgentRegistry(tempDir);
		await agentRegistry.initialize();

		// Initialize HookManager with AgentRegistry
		const mockMCPDiscovery = {
			discoverServers: vi.fn().mockResolvedValue([]),
			getServer: vi.fn().mockResolvedValue(undefined),
			getTool: vi.fn().mockResolvedValue(undefined),
			clearCache: vi.fn(),
			isCacheFresh: vi.fn().mockReturnValue(true),
		};

		hookManager = new HookManager(
			context,
			outputChannel,
			mockMCPDiscovery,
			agentRegistry
		);
		await hookManager.initialize();

		hookExecutor = new HookExecutor(
			hookManager,
			triggerRegistry,
			outputChannel,
			mockMCPDiscovery
		);
		hookExecutor.initialize();
	});

	afterEach(() => {
		// Clean up temporary directory
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe("Agent Discovery", () => {
		it("should discover agents from .github/agents/*.agent.md files", () => {
			const agents = agentRegistry.getAllAgents();

			expect(agents).toHaveLength(2);

			const codeReviewer = agents.find((a) => a.id === "local:code-reviewer");
			expect(codeReviewer).toBeDefined();
			expect(codeReviewer?.name).toBe("Code Reviewer");
			expect(codeReviewer?.description).toBe(
				"Reviews code for quality and best practices"
			);
			expect(codeReviewer?.type).toBe("local");
			expect(codeReviewer?.source).toBe("file");

			const docWriter = agents.find((a) => a.id === "local:doc-writer");
			expect(docWriter).toBeDefined();
			expect(docWriter?.name).toBe("Doc Writer");
			expect(docWriter?.description).toBe("Writes documentation for code");
		});

		it("should group agents by type for UI display", () => {
			const grouped = agentRegistry.getAgentsGroupedByType();

			expect(grouped.local).toHaveLength(2);
			expect(grouped.background).toHaveLength(0);

			const localAgentNames = grouped.local.map((a) => a.name);
			expect(localAgentNames).toContain("Code Reviewer");
			expect(localAgentNames).toContain("Doc Writer");
		});

		it("should handle empty .github/agents/ directory gracefully", async () => {
			// Create new registry with empty directory
			const emptyDir = mkdtempSync(join(tmpdir(), "agent-empty-test-"));
			mkdirSync(join(emptyDir, ".github", "agents"), {
				recursive: true,
			});

			const emptyRegistry = new AgentRegistry(emptyDir);
			await emptyRegistry.initialize();

			const agents = emptyRegistry.getAllAgents();
			expect(agents).toHaveLength(0);

			const grouped = emptyRegistry.getAgentsGroupedByType();
			expect(grouped.local).toHaveLength(0);
			expect(grouped.background).toHaveLength(0);

			rmSync(emptyDir, { recursive: true, force: true });
		});

		it("should handle missing .github directory gracefully", async () => {
			const noGithubDir = mkdtempSync(join(tmpdir(), "agent-no-github-test-"));

			const registryNoGithub = new AgentRegistry(noGithubDir);
			await registryNoGithub.initialize();

			const agents = registryNoGithub.getAllAgents();
			expect(agents).toHaveLength(0);

			rmSync(noGithubDir, { recursive: true, force: true });
		});
	});

	describe("Agent Registry Grouping and Filtering", () => {
		it("should filter agents by type", () => {
			const localAgents = agentRegistry.getAllAgents({ type: "local" });
			expect(localAgents).toHaveLength(2);
			expect(localAgents.every((a) => a.type === "local")).toBe(true);

			const backgroundAgents = agentRegistry.getAllAgents({
				type: "background",
			});
			expect(backgroundAgents).toHaveLength(0);
		});

		it("should filter agents by source", () => {
			const fileAgents = agentRegistry.getAllAgents({ source: "file" });
			expect(fileAgents).toHaveLength(2);
			expect(fileAgents.every((a) => a.source === "file")).toBe(true);

			const extensionAgents = agentRegistry.getAllAgents({
				source: "extension",
			});
			expect(extensionAgents).toHaveLength(0);
		});

		it("should filter agents by search term", () => {
			const reviewAgents = agentRegistry.getAllAgents({
				searchTerm: "review",
			});
			expect(reviewAgents).toHaveLength(1);
			expect(reviewAgents[0].name).toBe("Code Reviewer");

			const docAgents = agentRegistry.getAllAgents({ searchTerm: "doc" });
			expect(docAgents).toHaveLength(1);
			expect(docAgents[0].name).toBe("Doc Writer");
		});

		it("should retrieve agent by ID", () => {
			const agent = agentRegistry.getAgentById("local:code-reviewer");
			expect(agent).toBeDefined();
			expect(agent?.name).toBe("Code Reviewer");
			expect(agent?.id).toBe("local:code-reviewer");
		});

		it("should return undefined for non-existent agent ID", () => {
			const agent = agentRegistry.getAgentById("local:non-existent");
			expect(agent).toBeUndefined();
		});
	});

	describe("Hook Creation with Custom Agent", () => {
		it("should create hook with valid custom agent", async () => {
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Code Review",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer", // Must match pattern /^[a-zA-Z0-9-]+$/
						prompt: "Review the code changes for quality issues",
					},
				},
			};

			const created = await hookManager.createHook(hookPayload);

			expect(created.id).toBeDefined();
			expect(created.name).toBe("Auto Code Review");
			expect(created.action.type).toBe("custom");
			expect(created.action.parameters).toMatchObject({
				agentId: "local:code-reviewer",
				agentName: "code-reviewer",
			});

			const hooks = await hookManager.getAllHooks();
			expect(hooks).toHaveLength(1);
		});

		it("should validate agent exists before saving hook", async () => {
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Invalid Agent Hook",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:non-existent-agent",
						agentName: "non-existent-agent",
						prompt: "Do something",
					},
				},
			};

			// Should throw validation error
			await expect(hookManager.createHook(hookPayload)).rejects.toThrow(
				HOOK_VALIDATION_FAILED_REGEX
			);
		});

		it("should allow updating hook with different agent", async () => {
			// Create hook with code-reviewer
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Review",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						prompt: "Review the code",
					},
				},
			};

			const created = await hookManager.createHook(hookPayload);

			// Update to doc-writer agent
			const updated = await hookManager.updateHook(created.id, {
				action: {
					type: "custom",
					parameters: {
						agentId: "local:doc-writer",
						agentName: "doc-writer",
						prompt: "Write documentation",
					},
				},
			});

			expect(updated.action.parameters).toMatchObject({
				agentId: "local:doc-writer",
				agentName: "doc-writer",
			});

			const hooks = await hookManager.getAllHooks();
			expect(hooks).toHaveLength(1);
			expect(hooks[0].action.parameters).toMatchObject({
				agentId: "local:doc-writer",
			});
		});

		it("should reject updating hook with non-existent agent", async () => {
			// Create hook with valid agent
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Review",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						prompt: "Review code",
					},
				},
			};

			const created = await hookManager.createHook(hookPayload);

			// Try to update with invalid agent
			await expect(
				hookManager.updateHook(created.id, {
					action: {
						type: "custom",
						parameters: {
							agentId: "local:invalid-agent",
							agentName: "invalid-agent",
							prompt: "Do something",
						},
					},
				})
			).rejects.toThrow();
		});

		it("should validate agent on hook creation even with legacy agentName field", async () => {
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Legacy Hook",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						// Only agentName, no agentId (legacy format)
						agentName: "code-reviewer",
						prompt: "Review code",
					},
				},
			};

			// Should fail validation (agent not found by name alone)
			await expect(hookManager.createHook(hookPayload)).rejects.toThrow(
				HOOK_VALIDATION_FAILED_REGEX
			);
		});
	});

	describe("Agent Availability Handling", () => {
		it("should check agent availability", async () => {
			const availability = await agentRegistry.checkAgentAvailability(
				"local:code-reviewer"
			);

			expect(availability.available).toBe(true);
			expect(availability.agentId).toBe("local:code-reviewer");
		});

		it("should return unavailable for non-existent agent", async () => {
			const availability =
				await agentRegistry.checkAgentAvailability("local:non-existent");

			expect(availability.available).toBe(false);
			expect(availability.reason).toBe("UNKNOWN");
		});

		it("should detect when agent file is deleted", async () => {
			// Initially available
			let availability = await agentRegistry.checkAgentAvailability(
				"local:code-reviewer"
			);
			expect(availability.available).toBe(true);

			// Delete agent file
			unlinkSync(join(agentsDir, "code-reviewer.agent.md"));

			// Check availability again (without refresh - should detect file missing)
			availability = await agentRegistry.checkAgentAvailability(
				"local:code-reviewer"
			);
			expect(availability.available).toBe(false);
			expect(availability.reason).toBe("FILE_DELETED");
		});

		it("should warn but allow saving hook if agent becomes unavailable after creation", async () => {
			// Create hook with valid agent
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Review",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						prompt: "Review code",
					},
				},
			};

			const created = await hookManager.createHook(hookPayload);
			expect(created.id).toBeDefined();

			// Delete agent file to make it unavailable
			unlinkSync(join(agentsDir, "code-reviewer.agent.md"));

			// Refresh registry to detect missing agent
			await agentRegistry.refresh();

			// Agent should be marked unavailable
			const availability = await agentRegistry.checkAgentAvailability(
				"local:code-reviewer"
			);
			expect(availability.available).toBe(false);

			// Hook should still exist (we don't auto-delete hooks with unavailable agents)
			const hooks = await hookManager.getAllHooks();
			expect(hooks).toHaveLength(1);
			expect(hooks[0].action.parameters).toMatchObject({
				agentId: "local:code-reviewer",
			});
		});
	});

	describe("End-to-End Agent Dropdown Workflow", () => {
		it("should complete full workflow: discover -> group -> select -> create hook", async () => {
			// 1. Verify agents discovered
			const agents = agentRegistry.getAllAgents();
			expect(agents).toHaveLength(2);

			// 2. Verify agents grouped by type (for UI dropdown)
			const grouped = agentRegistry.getAgentsGroupedByType();
			expect(grouped.local).toHaveLength(2);
			expect(grouped.background).toHaveLength(0);

			// 3. Simulate user selecting "Code Reviewer" from dropdown
			const selectedAgent = agentRegistry.getAgentById("local:code-reviewer");
			expect(selectedAgent).toBeDefined();
			expect(selectedAgent?.name).toBe("Code Reviewer");

			// 4. Create hook with selected agent
			const hookPayload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Code Review",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: selectedAgent!.id,
						agentName: "code-reviewer", // Use kebab-case for validation
						prompt: "Review the code changes",
					},
				},
			};

			const created = await hookManager.createHook(hookPayload);

			// 5. Verify hook created successfully with validation passing
			expect(created.id).toBeDefined();
			expect(created.action.type).toBe("custom");
			expect(created.action.parameters).toMatchObject({
				agentId: "local:code-reviewer",
				agentName: "code-reviewer",
			});

			// 6. Verify hook can be retrieved
			const hooks = await hookManager.getAllHooks();
			expect(hooks).toHaveLength(1);
			expect(hooks[0].name).toBe("Auto Code Review");

			// 7. Verify agent still retrievable by ID from hook
			const hookParams = hooks[0].action.parameters as { agentId?: string };
			const agent = agentRegistry.getAgentById(hookParams.agentId as string);
			expect(agent).toBeDefined();
			expect(agent?.name).toBe("Code Reviewer");

			// 8. Verify agent is available
			const availability = await agentRegistry.checkAgentAvailability(
				hookParams.agentId as string
			);
			expect(availability.available).toBe(true);
		});

		it("should support creating multiple hooks with different agents", async () => {
			// Create first hook with code-reviewer
			const hook1Payload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Review",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						prompt: "Review code",
					},
				},
			};

			const hook1 = await hookManager.createHook(hook1Payload);

			// Create second hook with doc-writer
			const hook2Payload: Omit<
				Hook,
				"id" | "createdAt" | "modifiedAt" | "executionCount"
			> = {
				name: "Auto Documentation",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify", // Use valid operation type
					timing: "after",
				},
				action: {
					type: "custom",
					parameters: {
						agentId: "local:doc-writer",
						agentName: "doc-writer",
						prompt: "Write documentation",
					},
				},
			};

			const hook2 = await hookManager.createHook(hook2Payload);

			// Verify both hooks exist with correct agents
			const hooks = await hookManager.getAllHooks();
			expect(hooks).toHaveLength(2);

			const reviewHook = hooks.find((h) => h.name === "Auto Review");
			const reviewParams = reviewHook?.action.parameters as {
				agentId?: string;
			};
			expect(reviewParams?.agentId).toBe("local:code-reviewer");

			const docHook = hooks.find((h) => h.name === "Auto Documentation");
			const docParams = docHook?.action.parameters as { agentId?: string };
			expect(docParams?.agentId).toBe("local:doc-writer");
		});
	});
});
