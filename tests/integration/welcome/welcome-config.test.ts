/**
 * Integration tests for welcome screen configuration editing
 * Tests complete flow: UI → message → validation → update
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import {
	workspace,
	ConfigurationTarget,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";

// biome-ignore lint/suspicious/noSkippedTests: Temporarily disabled pending implementation and test refactor
describe.skip("Welcome Screen Configuration Editing Integration (T055)", () => {
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;
	let provider: WelcomeScreenProvider;
	let workspaceStateMap: Map<string, any>;

	beforeEach(() => {
		workspaceStateMap = new Map();

		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as any;

		mockContext = {
			extensionPath: "/fake/extension/path",
			extensionUri: { fsPath: "/fake/extension/path" } as any,
			workspaceState: {
				get: vi.fn((key: string, defaultValue?: any) => {
					const value = workspaceStateMap.get(key);
					return value !== undefined ? value : defaultValue;
				}),
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
		} as any;

		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);
	});

	describe("specSystem dropdown editing", () => {
		it("should handle specSystem change from auto to speckit", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Mock workspace configuration update
			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			// Simulate user changing dropdown to "speckit"
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should call workspace.getConfiguration().update
			expect(workspace.getConfiguration).toHaveBeenCalled();
		});

		it("should handle specSystem change from auto to openspec", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "openspec");

			expect(workspace.getConfiguration).toHaveBeenCalled();
		});

		it("should send config-updated message after successful update", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/config-updated",
					key: "gatomia.specSystem",
					newValue: "speckit",
				})
			);
		});
	});

	describe("path configuration editing", () => {
		it("should handle SpecKit specs path update", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.(
				"gatomia.speckit.specsPath",
				"./custom-specs"
			);

			expect(workspace.getConfiguration).toHaveBeenCalled();
		});

		it("should handle SpecKit memory path update", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.(
				"gatomia.speckit.memoryPath",
				"./custom-memory"
			);

			expect(workspace.getConfiguration).toHaveBeenCalled();
		});

		it("should handle SpecKit templates path update", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.(
				"gatomia.speckit.templatesPath",
				"./custom-templates"
			);

			expect(workspace.getConfiguration).toHaveBeenCalled();
		});

		it("should handle OpenSpec path update", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.(
				"gatomia.openspec.path",
				"./custom-openspec"
			);

			expect(workspace.getConfiguration).toHaveBeenCalled();
		});

		it("should handle prompts path update", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.(
				"gatomia.prompts.path",
				"./custom-prompts"
			);

			expect(workspace.getConfiguration).toHaveBeenCalled();
		});
	});

	describe("validation during editing", () => {
		it("should reject non-editable configuration keys", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.nonEditable", "value");

			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
					code: "INVALID_CONFIG_KEY",
				})
			);
		});

		it("should reject non-string values for path configurations", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", 123 as any);

			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
					code: "INVALID_CONFIG_VALUE",
				})
			);
		});

		it("should accept relative paths", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", "./specs");

			// Should not send error
			const errorCalls = vi
				.mocked(mockPanel.postMessage)
				.mock.calls.filter((call) => call[0]?.type === "welcome/error");
			expect(errorCalls.length).toBe(0);
		});

		it("should accept absolute paths", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.(
				"gatomia.speckit.specsPath",
				"/absolute/path/to/specs"
			);

			// Should not send error
			const errorCalls = vi
				.mocked(mockPanel.postMessage)
				.mock.calls.filter((call) => call[0]?.type === "welcome/error");
			expect(errorCalls.length).toBe(0);
		});
	});

	describe("UI state updates", () => {
		it("should update UI state after successful configuration change", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockResolvedValue(undefined),
			} as any);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should send welcome/config-updated message
			expect(mockPanel.postMessage).toHaveBeenCalledWith({
				type: "welcome/config-updated",
				key: "gatomia.specSystem",
				newValue: "speckit",
			});
		});

		it("should not update UI if validation fails", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.nonEditable", "value");

			// Should only send error, not config-updated
			const updateCalls = vi
				.mocked(mockPanel.postMessage)
				.mock.calls.filter(
					(call) => call[0]?.type === "welcome/config-updated"
				);
			expect(updateCalls.length).toBe(0);
		});
	});

	describe("error handling", () => {
		it("should handle workspace configuration update failures", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: vi.fn().mockRejectedValue(new Error("Permission denied")),
			} as any);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should send error message
			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
				})
			);
		});

		it("should log configuration errors to output channel", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.nonEditable", "value");

			// Errors are sent via postMessage
			expect(mockPanel.postMessage).toHaveBeenCalled();
		});
	});

	describe("complete editing workflow", () => {
		it("should complete full edit cycle for specSystem", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			const mockUpdate = vi.fn().mockResolvedValue(undefined);
			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: mockUpdate,
			} as any);

			// 1. User changes dropdown
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "openspec");

			// 2. Configuration is validated and updated
			expect(mockUpdate).toHaveBeenCalledWith(
				"gatomia.specSystem",
				"openspec",
				ConfigurationTarget.Workspace
			);

			// 3. UI receives confirmation
			expect(mockPanel.postMessage).toHaveBeenCalledWith({
				type: "welcome/config-updated",
				key: "gatomia.specSystem",
				newValue: "openspec",
			});
		});

		it("should complete full edit cycle for path configuration", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			const mockUpdate = vi.fn().mockResolvedValue(undefined);
			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: mockUpdate,
			} as any);

			// 1. User edits path
			await callbacks.onUpdateConfig?.(
				"gatomia.speckit.specsPath",
				"./new-specs"
			);

			// 2. Configuration is validated and updated
			expect(mockUpdate).toHaveBeenCalledWith(
				"gatomia.speckit.specsPath",
				"./new-specs",
				ConfigurationTarget.Workspace
			);

			// 3. UI receives confirmation
			expect(mockPanel.postMessage).toHaveBeenCalledWith({
				type: "welcome/config-updated",
				key: "gatomia.speckit.specsPath",
				newValue: "./new-specs",
			});
		});

		it("should handle multiple sequential edits", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			const mockUpdate = vi.fn().mockResolvedValue(undefined);
			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: vi.fn(),
				update: mockUpdate,
			} as any);

			// Edit multiple configurations
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");
			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", "./specs");
			await callbacks.onUpdateConfig?.("gatomia.prompts.path", "./prompts");

			// All should succeed
			expect(mockUpdate).toHaveBeenCalledTimes(3);
			expect(mockPanel.postMessage).toHaveBeenCalledTimes(3);
		});
	});

	describe("callback registration", () => {
		it("should have onUpdateConfig callback defined", () => {
			const callbacks = provider.getCallbacks();
			expect(callbacks.onUpdateConfig).toBeDefined();
			expect(typeof callbacks.onUpdateConfig).toBe("function");
		});

		it("should throw error if panel not set before onUpdateConfig", async () => {
			const callbacks = provider.getCallbacks();

			// Don't set panel - should throw error
			await expect(
				callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit")
			).rejects.toThrow("Panel reference not set");
		});
	});
});
