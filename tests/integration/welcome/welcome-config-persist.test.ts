/**
 * Integration tests for welcome screen configuration persistence
 * Tests that configuration changes persist to VS Code workspace settings
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import {
	workspace,
	ConfigurationTarget,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";

describe("Welcome Screen Configuration Persistence Integration (T056)", () => {
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;
	let provider: WelcomeScreenProvider;
	let workspaceStateMap: Map<string, any>;
	let mockUpdate: any;

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

		// Create mock update function that tracks calls
		mockUpdate = vi.fn().mockResolvedValue(undefined);

		vi.mocked(workspace.getConfiguration).mockReturnValue({
			get: vi.fn(),
			update: mockUpdate,
		} as any);

		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);
	});

	describe("workspace configuration persistence", () => {
		it("should persist specSystem changes to workspace settings", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			expect(mockUpdate).toHaveBeenCalledWith(
				"gatomia.specSystem",
				"speckit",
				ConfigurationTarget.Workspace
			);
		});

		it("should persist path changes to workspace settings", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.(
				"gatomia.speckit.specsPath",
				"./new-specs"
			);

			expect(mockUpdate).toHaveBeenCalledWith(
				"gatomia.speckit.specsPath",
				"./new-specs",
				ConfigurationTarget.Workspace
			);
		});

		it("should use workspace configuration target (not global)", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "openspec");

			// Should use Workspace target, not Global
			expect(mockUpdate).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(String),
				ConfigurationTarget.Workspace
			);
		});
	});

	describe("configuration reload after persistence", () => {
		it("should send updated configuration back to UI", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should send welcome/config-updated message
			expect(mockPanel.postMessage).toHaveBeenCalledWith({
				type: "welcome/config-updated",
				key: "gatomia.specSystem",
				newValue: "speckit",
			});
		});

		it("should reflect changes in subsequent getWelcomeState calls", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Mock configuration to return new value after update
			const mockGet = vi.fn((key: string) => {
				if (key === "specSystem") {
					return "speckit";
				}
				return;
			});

			vi.mocked(workspace.getConfiguration).mockReturnValue({
				get: mockGet,
				update: mockUpdate,
			} as any);

			// Update configuration
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Get state again - should reflect new value
			const state = await provider.getWelcomeState();

			// Configuration should be loaded from workspace
			expect(workspace.getConfiguration).toHaveBeenCalledWith("gatomia");
		});
	});

	describe("persistence error handling", () => {
		it("should handle permission errors when persisting", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Mock update to fail
			mockUpdate.mockRejectedValue(new Error("Permission denied"));

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should send error message to UI
			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
				})
			);
		});

		it("should handle workspace not available errors", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Mock update to fail with workspace error
			mockUpdate.mockRejectedValue(new Error("Workspace not available"));

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
				})
			);
		});

		it("should not send config-updated if persistence fails", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Mock update to fail
			mockUpdate.mockRejectedValue(new Error("Save failed"));

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should not have sent config-updated
			const successCalls = vi
				.mocked(mockPanel.postMessage)
				.mock.calls.filter(
					(call) => call[0]?.type === "welcome/config-updated"
				);
			expect(successCalls.length).toBe(0);
		});
	});

	describe("multiple configuration changes", () => {
		it("should persist multiple changes independently", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Make multiple changes
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");
			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", "./specs");
			await callbacks.onUpdateConfig?.("gatomia.prompts.path", "./prompts");

			// Each should be persisted separately
			expect(mockUpdate).toHaveBeenNthCalledWith(
				1,
				"gatomia.specSystem",
				"speckit",
				ConfigurationTarget.Workspace
			);
			expect(mockUpdate).toHaveBeenNthCalledWith(
				2,
				"gatomia.speckit.specsPath",
				"./specs",
				ConfigurationTarget.Workspace
			);
			expect(mockUpdate).toHaveBeenNthCalledWith(
				3,
				"gatomia.prompts.path",
				"./prompts",
				ConfigurationTarget.Workspace
			);
		});

		it("should send UI updates for each successful change", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Make multiple changes
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");
			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", "./specs");

			// Should send two config-updated messages
			const updateCalls = vi
				.mocked(mockPanel.postMessage)
				.mock.calls.filter(
					(call) => call[0]?.type === "welcome/config-updated"
				);
			expect(updateCalls.length).toBe(2);
		});

		it("should continue persisting if one change fails", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Mock first call to fail, others succeed
			mockUpdate
				.mockRejectedValueOnce(new Error("First failed"))
				.mockResolvedValueOnce(undefined);

			// First should fail
			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Second should succeed
			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", "./specs");

			// Both should have been attempted
			expect(mockUpdate).toHaveBeenCalledTimes(2);
		});
	});

	describe("configuration key validation before persistence", () => {
		it("should not persist invalid configuration keys", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Try to update non-editable key
			await callbacks.onUpdateConfig?.("gatomia.nonEditable", "value");

			// Should not call workspace.update
			expect(mockUpdate).not.toHaveBeenCalled();
		});

		it("should not persist invalid value types", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			// Try to update path with non-string value
			await callbacks.onUpdateConfig?.("gatomia.speckit.specsPath", 123 as any);

			// Should not call workspace.update
			expect(mockUpdate).not.toHaveBeenCalled();
		});
	});

	describe("logging configuration changes", () => {
		it("should log successful configuration updates", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should log the update
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Updated configuration")
			);
		});

		it("should log configuration update failures", async () => {
			const callbacks = provider.getCallbacks();
			const mockPanel = {
				postMessage: vi.fn(),
			} as any;
			callbacks.setPanel?.(mockPanel);

			mockUpdate.mockRejectedValue(new Error("Update failed"));

			await callbacks.onUpdateConfig?.("gatomia.specSystem", "speckit");

			// Should log the error (via postMessage error handling)
			expect(mockPanel.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "welcome/error",
				})
			);
		});
	});
});
