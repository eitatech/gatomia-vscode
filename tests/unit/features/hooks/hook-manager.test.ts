import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionContext, OutputChannel } from "vscode";
import {
	HookManager,
	HookValidationError,
	DuplicateHookNameError,
	HookNotFoundError,
} from "../../../../src/features/hooks/hook-manager";
import type { Hook } from "../../../../src/features/hooks/types";

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

// Mock ExtensionContext with workspace state
const createMockContext = (): ExtensionContext => {
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
		globalState: {} as any,
		subscriptions: [],
		extensionPath: "/test/path",
		extensionUri: {} as any,
		environmentVariableCollection: {} as any,
		asAbsolutePath: vi.fn(),
		storageUri: {} as any,
		storagePath: "/test/storage",
		globalStorageUri: {} as any,
		globalStoragePath: "/test/global-storage",
		logUri: {} as any,
		logPath: "/test/logs",
		extensionMode: 3,
		extension: {} as any,
		secrets: {} as any,
		languageModelAccessInformation: {} as any,
	};
};

describe("HookManager", () => {
	let manager: HookManager;
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;

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
		mockContext = createMockContext();
		mockOutputChannel = createMockOutputChannel();
		manager = new HookManager(mockContext, mockOutputChannel);
		await manager.initialize();
	});

	describe("initialization", () => {
		it("should initialize with empty hooks", async () => {
			const hooks = await manager.getAllHooks();
			expect(hooks).toHaveLength(0);
		});

		it("should load existing hooks from workspace state", async () => {
			const { randomUUID } = await import("node:crypto");
			const existingHook: Hook = {
				id: randomUUID(),
				name: "Existing Hook",
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
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				executionCount: 0,
			};

			await mockContext.workspaceState.update("gatomia.hooks.configurations", [
				existingHook,
			]);

			const newManager = new HookManager(mockContext, mockOutputChannel);
			await newManager.initialize();

			const hooks = await newManager.getAllHooks();
			expect(hooks).toHaveLength(1);
			expect(hooks[0].name).toBe("Existing Hook");
		});

		it("should migrate old hooks without timing field to default 'after'", async () => {
			const { randomUUID } = await import("node:crypto");
			// Old hook without timing field (created before timing feature)
			const oldHook = {
				id: randomUUID(),
				name: "Old Hook",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					// No timing field - simulates old hook
				},
				action: {
					type: "agent",
					parameters: {
						command: "/speckit.clarify",
					},
				},
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				executionCount: 0,
			};

			await mockContext.workspaceState.update("gatomia.hooks.configurations", [
				oldHook,
			]);

			const newManager = new HookManager(mockContext, mockOutputChannel);
			await newManager.initialize();

			const hooks = await newManager.getAllHooks();
			expect(hooks).toHaveLength(1);
			expect(hooks[0].trigger.timing).toBe("after");
		});
	});

	describe("createHook", () => {
		it("should create a new hook", async () => {
			const hookData = createTestHook();
			const created = await manager.createHook(hookData);

			expect(created.id).toBeDefined();
			expect(created.name).toBe("Test Hook");
			expect(created.enabled).toBe(true);
			expect(created.createdAt).toBeDefined();
			expect(created.modifiedAt).toBeDefined();
			expect(created.executionCount).toBe(0);
		});

		it("should generate unique UUID for new hook", async () => {
			const hook1 = await manager.createHook(
				createTestHook({ name: "Hook 1" })
			);
			const hook2 = await manager.createHook(
				createTestHook({ name: "Hook 2" })
			);

			expect(hook1.id).not.toBe(hook2.id);
		});

		it("should validate hook before creating", async () => {
			const invalidHook = {
				name: "", // Empty name
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
			} as any;

			await expect(manager.createHook(invalidHook)).rejects.toThrow(
				HookValidationError
			);
		});

		it("should reject duplicate hook names", async () => {
			await manager.createHook(createTestHook({ name: "Unique Hook" }));

			await expect(
				manager.createHook(createTestHook({ name: "Unique Hook" }))
			).rejects.toThrow(DuplicateHookNameError);
		});

		it("should persist hook to workspace state", async () => {
			await manager.createHook(createTestHook());

			expect(mockContext.workspaceState.update).toHaveBeenCalled();
		});

		it("should emit onHookCreated event", async () => {
			const listener = vi.fn();
			manager.onHookCreated(listener);

			const created = await manager.createHook(createTestHook());

			expect(listener).toHaveBeenCalledWith(created);
		});

		it("should emit onHooksChanged event", async () => {
			const listener = vi.fn();
			manager.onHooksChanged(listener);

			await manager.createHook(createTestHook());

			expect(listener).toHaveBeenCalled();
		});
	});

	describe("getHook", () => {
		it("should retrieve hook by ID", async () => {
			const created = await manager.createHook(createTestHook());
			const retrieved = await manager.getHook(created.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.id).toBe(created.id);
		});

		it("should return undefined if hook not found", async () => {
			const retrieved = await manager.getHook("non-existent-id");
			expect(retrieved).toBeUndefined();
		});
	});

	describe("getAllHooks", () => {
		it("should return all hooks", async () => {
			await manager.createHook(createTestHook({ name: "Hook 1" }));
			await manager.createHook(createTestHook({ name: "Hook 2" }));
			await manager.createHook(createTestHook({ name: "Hook 3" }));

			const all = await manager.getAllHooks();
			expect(all).toHaveLength(3);
		});

		it("should return copy of hooks array", async () => {
			await manager.createHook(createTestHook());

			const hooks1 = await manager.getAllHooks();
			hooks1.push({
				id: "fake",
				name: "Fake",
				enabled: true,
				trigger: { agent: "speckit", operation: "specify", timing: "after" },
				action: { type: "agent", parameters: { command: "/test" } },
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				executionCount: 0,
			});

			const hooks2 = await manager.getAllHooks();
			expect(hooks2).toHaveLength(1); // Not affected by mutation
		});
	});

	describe("updateHook", () => {
		it("should update hook fields", async () => {
			const created = await manager.createHook(createTestHook());

			const updated = await manager.updateHook(created.id, {
				name: "Updated Name",
				enabled: false,
			});

			expect(updated.name).toBe("Updated Name");
			expect(updated.enabled).toBe(false);
		});

		it("should update modifiedAt timestamp", async () => {
			const created = await manager.createHook(createTestHook());
			const originalModifiedAt = created.modifiedAt;

			// Wait a bit to ensure timestamp changes
			await new Promise((resolve) => setTimeout(resolve, 10));

			const updated = await manager.updateHook(created.id, {
				name: "New Name",
			});

			expect(updated.modifiedAt).toBeGreaterThan(originalModifiedAt);
		});

		it("should not allow updating immutable fields", async () => {
			const created = await manager.createHook(createTestHook());

			const updated = await manager.updateHook(created.id, {
				id: "new-id",
				createdAt: 999,
				executionCount: 100,
			} as any);

			// Immutable fields should not change
			expect(updated.id).toBe(created.id);
			expect(updated.createdAt).toBe(created.createdAt);
			expect(updated.executionCount).toBe(0);
		});

		it("should throw if hook not found", async () => {
			await expect(
				manager.updateHook("non-existent", { name: "Test" })
			).rejects.toThrow(HookNotFoundError);
		});

		it("should validate updated hook", async () => {
			const created = await manager.createHook(createTestHook());

			await expect(
				manager.updateHook(created.id, {
					action: {
						type: "agent",
						parameters: {
							command: "invalid-command", // Missing /speckit. prefix
						},
					},
				})
			).rejects.toThrow(HookValidationError);
		});

		it("should check name uniqueness when name changes", async () => {
			await manager.createHook(createTestHook({ name: "Hook 1" }));
			const hook2 = await manager.createHook(
				createTestHook({ name: "Hook 2" })
			);

			await expect(
				manager.updateHook(hook2.id, { name: "Hook 1" })
			).rejects.toThrow(DuplicateHookNameError);
		});

		it("should emit onHookUpdated event", async () => {
			const listener = vi.fn();
			manager.onHookUpdated(listener);

			const created = await manager.createHook(createTestHook());
			const updated = await manager.updateHook(created.id, {
				name: "Updated",
			});

			expect(listener).toHaveBeenCalledWith(updated);
		});

		it("should emit onHooksChanged event", async () => {
			const listener = vi.fn();
			manager.onHooksChanged(listener);

			const created = await manager.createHook(createTestHook());
			await manager.updateHook(created.id, { name: "Updated" });

			expect(listener).toHaveBeenCalledTimes(2); // Once for create, once for update
		});
	});

	describe("deleteHook", () => {
		it("should delete existing hook", async () => {
			const created = await manager.createHook(createTestHook());

			const deleted = await manager.deleteHook(created.id);
			expect(deleted).toBe(true);

			const hooks = await manager.getAllHooks();
			expect(hooks).toHaveLength(0);
		});

		it("should return false if hook not found", async () => {
			const deleted = await manager.deleteHook("non-existent");
			expect(deleted).toBe(false);
		});

		it("should emit onHookDeleted event with hook ID", async () => {
			const listener = vi.fn();
			manager.onHookDeleted(listener);

			const created = await manager.createHook(createTestHook());
			await manager.deleteHook(created.id);

			expect(listener).toHaveBeenCalledWith(created.id);
		});

		it("should emit onHooksChanged event", async () => {
			const listener = vi.fn();
			manager.onHooksChanged(listener);

			const created = await manager.createHook(createTestHook());
			await manager.deleteHook(created.id);

			expect(listener).toHaveBeenCalledTimes(2); // Once for create, once for delete
		});
	});

	describe("getEnabledHooks", () => {
		it("should return only enabled hooks", async () => {
			await manager.createHook(
				createTestHook({ name: "Enabled 1", enabled: true })
			);
			await manager.createHook(
				createTestHook({ name: "Disabled", enabled: false })
			);
			await manager.createHook(
				createTestHook({ name: "Enabled 2", enabled: true })
			);

			const enabled = await manager.getEnabledHooks();
			expect(enabled).toHaveLength(2);
			expect(enabled.every((h) => h.enabled)).toBe(true);
		});
	});

	describe("getHooksByTrigger", () => {
		it("should return hooks matching trigger", async () => {
			await manager.createHook(
				createTestHook({
					name: "Specify Hook",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);
			await manager.createHook(
				createTestHook({
					name: "Clarify Hook",
					trigger: { agent: "speckit", operation: "clarify", timing: "after" },
				})
			);
			await manager.createHook(
				createTestHook({
					name: "Another Specify",
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
				})
			);

			const specifyHooks = await manager.getHooksByTrigger(
				"speckit",
				"specify"
			);
			expect(specifyHooks).toHaveLength(2);
		});
	});

	describe("bulk operations", () => {
		it("should disable all hooks", async () => {
			await manager.createHook(
				createTestHook({ name: "Hook 1", enabled: true })
			);
			await manager.createHook(
				createTestHook({ name: "Hook 2", enabled: true })
			);

			await manager.disableAllHooks();

			const hooks = await manager.getAllHooks();
			expect(hooks.every((h) => !h.enabled)).toBe(true);
		});

		it("should enable all hooks", async () => {
			await manager.createHook(
				createTestHook({ name: "Hook 1", enabled: false })
			);
			await manager.createHook(
				createTestHook({ name: "Hook 2", enabled: false })
			);

			await manager.enableAllHooks();

			const hooks = await manager.getAllHooks();
			expect(hooks.every((h) => h.enabled)).toBe(true);
		});
	});

	describe("exportHooks", () => {
		it("should export hooks as JSON", async () => {
			await manager.createHook(createTestHook({ name: "Hook 1" }));
			await manager.createHook(createTestHook({ name: "Hook 2" }));

			const json = await manager.exportHooks();
			const parsed = JSON.parse(json);

			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed).toHaveLength(2);
		});
	});

	describe("importHooks", () => {
		it("should import hooks from JSON", async () => {
			const { randomUUID } = await import("node:crypto");
			const hooks: Hook[] = [
				{
					id: randomUUID(),
					name: "Imported Hook 1",
					enabled: true,
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
					action: {
						type: "agent",
						parameters: { command: "/speckit.clarify" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 0,
				},
				{
					id: randomUUID(),
					name: "Imported Hook 2",
					enabled: true,
					trigger: { agent: "speckit", operation: "plan", timing: "after" },
					action: {
						type: "agent",
						parameters: { command: "/speckit.analyze" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 0,
				},
			];

			const json = JSON.stringify(hooks);
			const count = await manager.importHooks(json);

			expect(count).toBe(2);

			const imported = await manager.getAllHooks();
			expect(imported).toHaveLength(2);
		});

		it("should skip duplicate names during import", async () => {
			const { randomUUID } = await import("node:crypto");
			await manager.createHook(createTestHook({ name: "Existing Hook" }));

			const hooks: Hook[] = [
				{
					id: randomUUID(),
					name: "Existing Hook", // Duplicate
					enabled: true,
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
					action: {
						type: "agent",
						parameters: { command: "/speckit.clarify" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 0,
				},
				{
					id: randomUUID(),
					name: "New Hook",
					enabled: true,
					trigger: { agent: "speckit", operation: "plan", timing: "after" },
					action: {
						type: "agent",
						parameters: { command: "/speckit.analyze" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 0,
				},
			];

			const json = JSON.stringify(hooks);
			const count = await manager.importHooks(json);

			expect(count).toBe(1); // Only imported non-duplicate

			const all = await manager.getAllHooks();
			expect(all).toHaveLength(2); // Original + 1 imported
		});

		it("should regenerate IDs for imported hooks", async () => {
			const { randomUUID } = await import("node:crypto");
			const originalId = randomUUID();
			const hooks: Hook[] = [
				{
					id: originalId,
					name: "Imported Hook",
					enabled: true,
					trigger: { agent: "speckit", operation: "specify", timing: "after" },
					action: {
						type: "agent",
						parameters: { command: "/speckit.clarify" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 0,
				},
			];

			const json = JSON.stringify(hooks);
			await manager.importHooks(json);

			const imported = await manager.getAllHooks();
			expect(imported).toHaveLength(1);
			expect(imported[0].id).not.toBe(originalId);
		});

		it("should throw an error when JSON payload is invalid", async () => {
			await expect(manager.importHooks("not-json")).rejects.toThrow(
				"Failed to import hooks"
			);
		});
	});

	describe("validateHook", () => {
		it("should validate valid hook", async () => {
			// Create a real hook to get proper UUID
			const created = await manager.createHook(
				createTestHook({ name: "Valid Hook" })
			);

			const result = await manager.validateHook(created);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should reject hook with empty name", async () => {
			// Create a hook first, then modify it to have invalid name
			const created = await manager.createHook(
				createTestHook({ name: "Valid" })
			);
			const invalidHook = { ...created, name: "" };

			const result = await manager.validateHook(invalidHook);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === "name")).toBe(true);
		});

		it("should reject hook with name exceeding max length", async () => {
			const created = await manager.createHook(
				createTestHook({ name: "Valid" })
			);
			const invalidHook = { ...created, name: "x".repeat(101) }; // Exceeds MAX_HOOK_NAME_LENGTH (100)

			const result = await manager.validateHook(invalidHook);
			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.field === "name")).toBe(true);
		});
	});

	describe("isHookNameUnique", () => {
		it("should return true for unique name", async () => {
			await manager.createHook(createTestHook({ name: "Existing Hook" }));

			const unique = await manager.isHookNameUnique("New Hook");
			expect(unique).toBe(true);
		});

		it("should return false for duplicate name", async () => {
			await manager.createHook(createTestHook({ name: "Existing Hook" }));

			const unique = await manager.isHookNameUnique("Existing Hook");
			expect(unique).toBe(false);
		});

		it("should exclude specified ID from uniqueness check", async () => {
			const created = await manager.createHook(
				createTestHook({ name: "Hook Name" })
			);

			// Should be unique when excluding the hook's own ID
			const unique = await manager.isHookNameUnique("Hook Name", created.id);
			expect(unique).toBe(true);
		});
	});

	// ============================================================================
	// T045: Unit test for agent type override in hook configuration
	// ============================================================================

	describe("Agent Type Override (User Story 2)", () => {
		it("should accept hook with custom agent type override", async () => {
			const hook = createTestHook({
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						agentType: "background", // Override: force background execution
						prompt: "Review this code",
					},
				},
			});

			const created = await manager.createHook(hook);

			expect(created).toBeDefined();
			expect(created.action.type).toBe("custom");
			const params = created.action.parameters as {
				agentType?: string;
				agentId?: string;
			};
			expect(params.agentType).toBe("background");
			expect(params.agentId).toBe("local:code-reviewer");
		});

		it("should validate agent type override value", async () => {
			const hook = createTestHook({
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						agentType: "invalid-type" as any, // Invalid type (bypassing TypeScript for runtime test)
						prompt: "Review this code",
					},
				},
			});

			const result = await manager.validateHook(hook);

			expect(result.valid).toBe(false);
			expect(result.errors.some((e) => e.message.includes("agent type"))).toBe(
				true
			);
		});

		it("should allow local agent type override", async () => {
			const hook = createTestHook({
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						agentType: "local", // Explicit local type
						prompt: "Review this code",
					},
				},
			});

			const created = await manager.createHook(hook);

			expect(created).toBeDefined();
			const params = created.action.parameters as { agentType?: string };
			expect(params.agentType).toBe("local");
		});

		it("should allow background agent type override", async () => {
			const hook = createTestHook({
				action: {
					type: "custom",
					parameters: {
						agentId: "local:test-agent",
						agentName: "test-agent",
						agentType: "background", // Force background execution
						prompt: "Run background task",
					},
				},
			});

			const created = await manager.createHook(hook);

			expect(created).toBeDefined();
			const params = created.action.parameters as { agentType?: string };
			expect(params.agentType).toBe("background");
		});

		it("should work without agent type override (use default)", async () => {
			const hook = createTestHook({
				action: {
					type: "custom",
					parameters: {
						agentId: "local:code-reviewer",
						agentName: "code-reviewer",
						// No agentType specified - should use agent's default type
						prompt: "Review this code",
					},
				},
			});

			const created = await manager.createHook(hook);

			expect(created).toBeDefined();
			const params = created.action.parameters as { agentType?: string };
			expect(params.agentType).toBeUndefined();
		});
	});
});
