/**
 * Integration test for feature action button execution
 * Tests clicking feature action cards and command execution flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WelcomeScreenPanel } from "../../../src/panels/welcome-screen-panel";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import {
	Uri,
	commands as vscodeCommands,
	window as vscodeWindow,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";

describe("Welcome Screen - Feature Action Execution (Integration)", () => {
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;
	let workspaceStateMap: Map<string, any>;
	let provider: WelcomeScreenProvider;
	let panel: WelcomeScreenPanel;

	beforeEach(() => {
		workspaceStateMap = new Map();
		vi.clearAllMocks();

		mockOutputChannel = {
			name: "GatomIA",
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			replace: vi.fn(),
		} as any;

		mockContext = {
			extensionPath: "/fake/extension/path",
			extensionUri: { fsPath: "/fake/extension/path" } as any,
			workspaceState: {
				get: vi.fn((key: string) => workspaceStateMap.get(key)),
				update: vi.fn((key: string, value: any) => {
					if (value === undefined) {
						workspaceStateMap.delete(key);
					} else {
						workspaceStateMap.set(key, value);
					}
				}),
				keys: vi.fn(() => Array.from(workspaceStateMap.keys())),
			},
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
			subscriptions: [],
			storageUri: Uri.file("/fake/storage"),
			globalStorageUri: Uri.file("/fake/global-storage"),
			logUri: Uri.file("/fake/logs"),
			extensionMode: 3, // ExtensionMode.Test
			asAbsolutePath: vi.fn(
				(relativePath: string) => `/fake/extension/path/${relativePath}`
			),
		} as any;

		// Create provider and panel for tests
		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);
		const callbacks = provider.getCallbacks();
		panel = WelcomeScreenPanel.show(mockContext, mockOutputChannel, callbacks);
		callbacks.setPanel?.(panel);

		// Reset singleton
		// @ts-expect-error - accessing private static for testing
		WelcomeScreenPanel.currentPanel = panel;
	});

	afterEach(() => {
		// Clean up singleton
		// @ts-expect-error - accessing private static for testing
		WelcomeScreenPanel.currentPanel = undefined;
	});

	describe("Feature Actions - Specs", () => {
		it("should execute gatomia.spec.create when Create New Spec button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.spec.create"
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Execute command: gatomia.spec.create"
			);
		});

		it("should execute gatomia.spec.refresh when Refresh Specs button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.refresh", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.spec.refresh"
			);
		});

		it("should log success after spec command execution", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command executed successfully: gatomia.spec.create"
			);
		});
	});

	describe("Feature Actions - Actions", () => {
		it("should execute gatomia.actions.create when Create Prompt button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.actions.create", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.actions.create"
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Execute command: gatomia.actions.create"
			);
		});

		it("should execute gatomia.actions.createAgentFile when Create Agent button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.actions.createAgentFile", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.actions.createAgentFile"
			);
		});

		it("should execute gatomia.actions.createSkill when Create Skill button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.actions.createSkill", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.actions.createSkill"
			);
		});

		it("should execute gatomia.actions.refresh when Refresh Actions button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.actions.refresh", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.actions.refresh"
			);
		});

		it("should log success after action command execution", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.actions.create", []);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command executed successfully: gatomia.actions.create"
			);
		});
	});

	describe("Feature Actions - Hooks", () => {
		it("should execute gatomia.hooks.addHook when Add Hook button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.hooks.addHook", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.hooks.addHook"
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Execute command: gatomia.hooks.addHook"
			);
		});

		it("should execute gatomia.hooks.viewLogs when View Logs button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.hooks.viewLogs", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.hooks.viewLogs"
			);
		});

		it("should log success after hook command execution", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.hooks.addHook", []);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command executed successfully: gatomia.hooks.addHook"
			);
		});
	});

	describe("Feature Actions - Steering", () => {
		it("should execute gatomia.steering.createProjectRule when Create Project Rule button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand(
				"gatomia.steering.createProjectRule",
				[]
			);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.steering.createProjectRule"
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Execute command: gatomia.steering.createProjectRule"
			);
		});

		it("should execute gatomia.steering.createUserRule when Create User Rule button is clicked", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.steering.createUserRule", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.steering.createUserRule"
			);
		});

		it("should log success after steering command execution", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand(
				"gatomia.steering.createProjectRule",
				[]
			);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command executed successfully: gatomia.steering.createProjectRule"
			);
		});
	});

	describe("All Feature Actions", () => {
		it("should execute all 8 feature action commands successfully", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			const featureCommands = [
				"gatomia.spec.create",
				"gatomia.spec.refresh",
				"gatomia.actions.create",
				"gatomia.actions.createAgentFile",
				"gatomia.actions.createSkill",
				"gatomia.actions.refresh",
				"gatomia.hooks.addHook",
				"gatomia.hooks.viewLogs",
				"gatomia.steering.createProjectRule",
				"gatomia.steering.createUserRule",
			];

			for (const commandId of featureCommands) {
				await callbacks.onExecuteCommand(commandId, []);
			}

			expect(vscodeCommands.executeCommand).toHaveBeenCalledTimes(
				featureCommands.length
			);

			// Verify each command was called
			for (const cmd of featureCommands) {
				expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(cmd);
			}
		});

		it("should log execution for all feature actions", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			const featureCommands = [
				"gatomia.spec.create",
				"gatomia.actions.create",
				"gatomia.hooks.addHook",
				"gatomia.steering.createProjectRule",
			];

			for (const commandId of featureCommands) {
				await callbacks.onExecuteCommand(commandId, []);
			}

			// Each command should have 2 log entries (before + after)
			for (const cmd of featureCommands) {
				expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
					`[WelcomeScreenProvider] Execute command: ${cmd}`
				);
				expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
					`[WelcomeScreenProvider] Command executed successfully: ${cmd}`
				);
			}
		});
	});

	describe("Error Handling for Feature Actions", () => {
		it("should handle command execution failure gracefully", async () => {
			const testError = new Error("Command not available");
			vi.mocked(vscodeCommands.executeCommand).mockRejectedValue(testError);

			const callbacks = provider.getCallbacks();
			callbacks.setPanel?.(panel); // Ensure panel is set
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			// Should not throw
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command execution failed: gatomia.spec.create - Command not available"
			);
		});

		it("should send error message to webview when feature action fails", async () => {
			const testError = new Error("Extension not activated");
			vi.mocked(vscodeCommands.executeCommand).mockRejectedValue(testError);

			const postMessageSpy = vi.spyOn(panel, "postMessage");

			const callbacks = provider.getCallbacks();
			callbacks.setPanel?.(panel); // Ensure panel is set
			await callbacks.onExecuteCommand("gatomia.actions.create", []);

			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
					code: "COMMAND_EXECUTION_FAILED",
					message: "Failed to execute command: gatomia.actions.create",
					context: "Extension not activated",
				})
			);
		});

		it("should show error notification to user when feature action fails", async () => {
			const testError = new Error("Workspace not found");
			vi.mocked(vscodeCommands.executeCommand).mockRejectedValue(testError);
			vi.mocked(vscodeWindow.showErrorMessage).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			callbacks.setPanel?.(panel); // Ensure panel is set
			await callbacks.onExecuteCommand("gatomia.hooks.addHook", []);

			expect(vscodeWindow.showErrorMessage).toHaveBeenCalledWith(
				'Failed to execute command "gatomia.hooks.addHook": Workspace not found'
			);
		});

		it("should continue to work after a feature action fails", async () => {
			// First command fails
			vi.mocked(vscodeCommands.executeCommand).mockRejectedValueOnce(
				new Error("First failed")
			);

			const callbacks = provider.getCallbacks();
			callbacks.setPanel?.(panel); // Ensure panel is set
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			// Second command succeeds
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValueOnce(undefined);
			await callbacks.onExecuteCommand("gatomia.spec.refresh", []);

			// Both commands were attempted
			expect(vscodeCommands.executeCommand).toHaveBeenCalledTimes(2);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command executed successfully: gatomia.spec.refresh"
			);
		});

		it("should handle multiple consecutive failures", async () => {
			const testError = new Error("Persistent error");
			vi.mocked(vscodeCommands.executeCommand).mockRejectedValue(testError);

			const callbacks = provider.getCallbacks();
			callbacks.setPanel?.(panel); // Ensure panel is set
			const commandsList = ["gatomia.spec.create", "gatomia.actions.create"];

			for (const cmd of commandsList) {
				await callbacks.onExecuteCommand(cmd, []);
			}

			// Both should have error logs
			for (const cmd of commandsList) {
				expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
					`[WelcomeScreenProvider] Command execution failed: ${cmd} - Persistent error`
				);
			}
		});
	});

	describe("Feature Action State", () => {
		it("should retrieve feature actions mirroring extension commands", async () => {
			const state = await provider.getWelcomeState();

			expect(state.featureActions).toBeDefined();
			expect(Array.isArray(state.featureActions)).toBe(true);
			// The provider emits a comprehensive catalogue; assert the breadth
			// without hard-coding an exact count so new commands don't break this
			// contract every time the extension grows.
			expect(state.featureActions.length).toBeGreaterThanOrEqual(30);
		});

		it("should have all feature actions enabled by default", async () => {
			const state = await provider.getWelcomeState();

			for (const action of state.featureActions) {
				expect(action.enabled).toBe(true);
			}
		});

		it("should group feature actions across every supported area (non-ACP host)", async () => {
			const state = await provider.getWelcomeState();

			const areas = new Set(state.featureActions.map((a) => a.featureArea));
			expect(areas).toContain("Specs");
			expect(areas).toContain("SpecKit Workflow");
			expect(areas).toContain("Actions");
			expect(areas).toContain("Hooks");
			expect(areas).toContain("Steering");
			expect(areas).toContain("Cloud Agents");
			expect(areas).toContain("Documentation");
			expect(areas).toContain("Configuration");
			// Chat Provider is ACP-only; the mocked host is "vscode" so it must
			// NOT appear here — see the IDE-host awareness suite below.
			expect(areas).not.toContain("Chat Provider");
		});

		it("should have at least the core entrypoints per area", async () => {
			const state = await provider.getWelcomeState();

			const actionsByArea = state.featureActions.reduce(
				(acc, action) => {
					acc[action.featureArea] = (acc[action.featureArea] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			expect(actionsByArea.Specs).toBeGreaterThanOrEqual(2);
			expect(actionsByArea["SpecKit Workflow"]).toBeGreaterThanOrEqual(5);
			expect(actionsByArea.Actions).toBeGreaterThanOrEqual(4);
			expect(actionsByArea.Hooks).toBeGreaterThanOrEqual(2);
			expect(actionsByArea.Steering).toBeGreaterThanOrEqual(2);
			expect(actionsByArea["Cloud Agents"]).toBeGreaterThanOrEqual(2);
			expect(actionsByArea.Documentation).toBeGreaterThanOrEqual(2);
			expect(actionsByArea.Configuration).toBeGreaterThanOrEqual(2);
		});

		it("should surface the headline quick actions by commandId", async () => {
			const state = await provider.getWelcomeState();
			const commandIds = new Set(state.featureActions.map((a) => a.commandId));

			// Spec lifecycle
			expect(commandIds).toContain("gatomia.spec.create");
			// SpecKit workflow steps
			expect(commandIds).toContain("gatomia.speckit.specify");
			expect(commandIds).toContain("gatomia.speckit.plan");
			expect(commandIds).toContain("gatomia.speckit.tasks");
			expect(commandIds).toContain("gatomia.speckit.implementation");
			// Configuration / bootstrap
			expect(commandIds).toContain("gatomia.settings.open");
			expect(commandIds).toContain("gatomia.dependencies.check");
			// Cloud agents
			expect(commandIds).toContain("gatomia.selectProvider");
			// Documentation
			expect(commandIds).toContain("gatomia.help.open");
		});

		it("should include action metadata (id, label, description, icon)", async () => {
			const state = await provider.getWelcomeState();

			for (const action of state.featureActions) {
				expect(action.id).toBeDefined();
				expect(action.label).toBeDefined();
				expect(action.description).toBeDefined();
				expect(action.commandId).toBeDefined();
				expect(action.icon).toBeDefined();
			}
		});

		it("should emit Chat Provider actions only on ACP hosts", async () => {
			const vscodeModule = await import("vscode");
			const originalAppName = vscodeModule.env.appName;

			try {
				// Simulate running inside Windsurf (ACP host).
				(vscodeModule.env as { appName: string }).appName = "Windsurf";
				const windsurfState = await provider.getWelcomeState();
				const windsurfAreas = new Set(
					windsurfState.featureActions.map((a) => a.featureArea)
				);
				expect(windsurfAreas).toContain("Chat Provider");

				const chatCommands = new Set(
					windsurfState.featureActions
						.filter((a) => a.featureArea === "Chat Provider")
						.map((a) => a.commandId)
				);
				expect(chatCommands).toContain("gatomia.acp.switchProvider");
				expect(chatCommands).toContain("gatomia.acp.reprobeAll");
				expect(chatCommands).toContain("gatomia.acp.showOutput");
				expect(chatCommands).toContain("gatomia.acp.cancelActive");

				// Back to non-ACP host — Chat Provider must disappear.
				(vscodeModule.env as { appName: string }).appName =
					"Visual Studio Code";
				const vscodeState = await provider.getWelcomeState();
				const vscodeAreas = new Set(
					vscodeState.featureActions.map((a) => a.featureArea)
				);
				expect(vscodeAreas).not.toContain("Chat Provider");
			} finally {
				(vscodeModule.env as { appName: string }).appName = originalAppName;
			}
		});
	});

	describe("Command Arguments", () => {
		it("should pass arguments when feature action requires them", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			const args = ["test-spec-name"];
			await callbacks.onExecuteCommand("gatomia.spec.create", args);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.spec.create",
				"test-spec-name"
			);
		});

		it("should handle empty arguments array", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.refresh", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.spec.refresh"
			);
		});

		it("should handle undefined arguments", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.prompts.refresh");

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.prompts.refresh"
			);
		});

		it("should pass multiple arguments correctly", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			const args = ["arg1", { key: "value" }, 123];
			await callbacks.onExecuteCommand("gatomia.test.command", args);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(
				"gatomia.test.command",
				"arg1",
				{ key: "value" },
				123
			);
		});
	});

	describe("Complete Action Flow", () => {
		it("should execute complete feature action click flow", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const flowLog: string[] = [];

			// 1. User clicks "Create New Spec" button in webview
			flowLog.push("1. User clicks button");

			// 2. Webview sends message to extension
			flowLog.push("2. Message sent to extension");

			// 3. Extension calls onExecuteCommand callback
			flowLog.push("3. Callback invoked");
			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			// 4. Command is executed
			flowLog.push("4. Command executed");

			// 5. Success logged
			flowLog.push("5. Success logged");

			expect(flowLog.length).toBe(5);
			expect(vscodeCommands.executeCommand).toHaveBeenCalled();
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[WelcomeScreenProvider] Command executed successfully: gatomia.spec.create"
			);
		});

		it("should maintain correct execution order", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const executionOrder: string[] = [];

			// Mock to track order
			vi.mocked(mockOutputChannel.appendLine).mockImplementation((msg) => {
				executionOrder.push(msg as string);
			});

			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			// Should log in order: before, after
			expect(executionOrder[0]).toContain("Execute command:");
			expect(executionOrder[1]).toContain("Command executed successfully:");
		});

		it("should handle rapid successive button clicks", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			const callbacks = provider.getCallbacks();
			const commandsList2 = [
				"gatomia.spec.create",
				"gatomia.spec.refresh",
				"gatomia.actions.create",
			];

			// Simulate rapid clicks
			await Promise.all(
				commandsList2.map((cmd) => callbacks.onExecuteCommand(cmd, []))
			);

			expect(vscodeCommands.executeCommand).toHaveBeenCalledTimes(3);
			for (const cmd of commandsList2) {
				expect(vscodeCommands.executeCommand).toHaveBeenCalledWith(cmd);
			}
		});

		it("should work when panel is not visible", async () => {
			vi.mocked(vscodeCommands.executeCommand).mockResolvedValue(undefined);

			// Panel might not be visible but callbacks should still work
			const callbacks = provider.getCallbacks();
			await callbacks.onExecuteCommand("gatomia.spec.create", []);

			expect(vscodeCommands.executeCommand).toHaveBeenCalled();
		});
	});

	describe("Integration with Webview", () => {
		it("should post initial state with feature actions to webview", async () => {
			const postMessageSpy = vi.spyOn(panel, "postMessage");

			const callbacks = provider.getCallbacks();
			callbacks.setPanel?.(panel); // Ensure panel is set
			await callbacks.onReady();

			expect(postMessageSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/state",
					featureActions: expect.any(Array),
				})
			);
		});

		it("should include feature actions in welcome state", async () => {
			const state = await provider.getWelcomeState();

			expect(state).toHaveProperty("featureActions");
			// Exact count intentionally loose so adding new commands does not
			// break the contract; see "Feature Action State" suite for the
			// per-area breadth assertions.
			expect(state.featureActions.length).toBeGreaterThanOrEqual(30);
		});

		it("should provide feature actions with all required properties", async () => {
			const state = await provider.getWelcomeState();

			for (const action of state.featureActions) {
				expect(action).toHaveProperty("id");
				expect(action).toHaveProperty("featureArea");
				expect(action).toHaveProperty("label");
				expect(action).toHaveProperty("description");
				expect(action).toHaveProperty("commandId");
				expect(action).toHaveProperty("enabled");
				expect(action).toHaveProperty("icon");
			}
		});
	});
});
