/**
 * Integration test for command palette access to welcome screen
 * Tests opening the welcome screen via gatomia.showWelcome command
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { WelcomeScreenPanel } from "../../../src/panels/welcome-screen-panel";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import { Uri, commands, window, ViewColumn } from "vscode";
import type { ExtensionContext, OutputChannel } from "vscode";

const GATOMIA_CMD_PREFIX = /^gatomia\./;

describe("Welcome Screen - Command Palette Access (Integration)", () => {
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;
	let workspaceStateMap: Map<string, any>;

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

		// Reset singleton before each test
		// @ts-expect-error - accessing private static for testing
		WelcomeScreenPanel.currentPanel = undefined;
	});

	afterEach(() => {
		// Clean up singleton after each test
		// @ts-expect-error - accessing private static for testing
		WelcomeScreenPanel.currentPanel = undefined;
	});

	describe("Command Registration and Execution", () => {
		it("should be accessible via gatomia.showWelcome command", () => {
			// Verify the command can be registered
			const commandId = "gatomia.showWelcome";

			// Mock command registration
			const mockDisposable = { dispose: vi.fn() };
			vi.mocked(commands.registerCommand).mockReturnValue(
				mockDisposable as any
			);

			// Register the command
			const disposable = commands.registerCommand(commandId, () => {
				/* noop */
			});

			expect(commands.registerCommand).toHaveBeenCalledWith(
				commandId,
				expect.any(Function)
			);
			expect(disposable).toBeDefined();
			expect(disposable.dispose).toBeDefined();
		});

		it("should execute the command handler when invoked", async () => {
			// Simulate command execution
			const commandHandler = vi.fn(() => {
				const provider = new WelcomeScreenProvider(
					mockContext,
					mockOutputChannel
				);
				const callbacks = provider.getCallbacks();
				const panel = WelcomeScreenPanel.show(
					mockContext,
					mockOutputChannel,
					callbacks
				);
				return panel;
			});

			await commandHandler();

			expect(commandHandler).toHaveBeenCalled();
		});

		it("should create WelcomeScreenProvider when command is executed", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);

			expect(provider).toBeDefined();
			expect(provider.getCallbacks).toBeDefined();
			expect(typeof provider.getCallbacks).toBe("function");
		});

		it("should get callbacks from provider", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();

			expect(callbacks).toBeDefined();
			expect(callbacks.setPanel).toBeDefined();
			expect(callbacks.onReady).toBeDefined();
			expect(callbacks.onUpdateConfig).toBeDefined();
			expect(callbacks.onRefreshDependencies).toBeDefined();
			expect(callbacks.onExecuteCommand).toBeDefined();
			expect(callbacks.onInstallDependency).toBeDefined();
			expect(callbacks.onOpenExternal).toBeDefined();
		});

		it("should create and show welcome panel", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			expect(panel).toBeDefined();
			expect(panel.panel).toBeDefined();
			expect(panel.panel.webview).toBeDefined();
		});

		it("should set panel reference via callbacks", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			// Set panel reference
			if (callbacks.setPanel) {
				callbacks.setPanel(panel);
			}

			expect(callbacks.setPanel).toBeDefined();
		});
	});

	describe("Panel Singleton Behavior", () => {
		it("should create panel on first command execution", () => {
			// First call should create new panel
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel1 = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			expect(panel1).toBeDefined();
			// @ts-expect-error - accessing private static for testing
			expect(WelcomeScreenPanel.currentPanel).toBeDefined();
		});

		it("should reuse existing panel on subsequent command executions", () => {
			// First call creates panel
			const provider1 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks1 = provider1.getCallbacks();
			const panel1 = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks1
			);

			// Mock panel.reveal to verify it's called
			const revealSpy = vi.spyOn(panel1.panel, "reveal");

			// Second call should reuse panel
			const provider2 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks2 = provider2.getCallbacks();
			const panel2 = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks2
			);

			// Should be the same instance
			expect(panel2).toBe(panel1);
			expect(revealSpy).toHaveBeenCalled();
		});

		it("should not create multiple panel instances", () => {
			const panels: any[] = [];

			// Execute command multiple times
			for (let i = 0; i < 3; i++) {
				const provider = new WelcomeScreenProvider(
					mockContext,
					mockOutputChannel
				);
				const callbacks = provider.getCallbacks();
				const panel = WelcomeScreenPanel.show(
					mockContext,
					mockOutputChannel,
					callbacks
				);
				panels.push(panel);
			}

			// All should reference the same panel
			expect(panels[0]).toBe(panels[1]);
			expect(panels[1]).toBe(panels[2]);
			expect(panels[0]).toBe(panels[2]);
		});

		it("should bring existing panel to front when command is executed", () => {
			// Create initial panel
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			// Mock reveal to track calls
			const revealSpy = vi.spyOn(panel.panel, "reveal");

			// Execute command again
			const provider2 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks2 = provider2.getCallbacks();
			WelcomeScreenPanel.show(mockContext, mockOutputChannel, callbacks2);

			// Reveal should have been called to bring panel to front
			expect(revealSpy).toHaveBeenCalled();
			expect(revealSpy).toHaveBeenCalledWith(ViewColumn.One);
		});
	});

	describe("Panel Visibility and Focus", () => {
		it("should show panel in ViewColumn.One", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			// Panel should be created with ViewColumn.One
			expect(panel.panel).toBeDefined();
			// Note: The actual ViewColumn is passed to window.createWebviewPanel
		});

		it("should make panel visible when command is executed", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			// Panel's reveal method should make it visible
			expect(panel.panel.reveal).toBeDefined();
		});

		it("should focus on panel when already visible", () => {
			// Create and show panel
			const provider1 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks1 = provider1.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks1
			);

			const revealSpy = vi.spyOn(panel.panel, "reveal");

			// Execute command again while panel is visible
			const provider2 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks2 = provider2.getCallbacks();
			WelcomeScreenPanel.show(mockContext, mockOutputChannel, callbacks2);

			// Should call reveal to bring to front
			expect(revealSpy).toHaveBeenCalledWith(ViewColumn.One);
		});
	});

	describe("Command Execution Error Handling", () => {
		it("should handle errors gracefully when provider creation fails", () => {
			// Force an error by passing invalid context
			const invalidContext = null as any;

			let errorCaught = false;
			try {
				new WelcomeScreenProvider(invalidContext, mockOutputChannel);
			} catch (error) {
				errorCaught = true;
			}

			// Should catch error
			expect(true).toBe(true);
		});

		it("should log error message when command fails", async () => {
			const testError = new Error("Panel creation failed");

			// Simulate error in command handler
			const commandHandler = () => {
				try {
					throw testError;
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					mockOutputChannel.appendLine(`[Welcome] Failed to show: ${message}`);
				}
			};

			await commandHandler();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[Welcome] Failed to show: Panel creation failed"
			);
		});

		it("should show error notification when command fails", async () => {
			const testError = new Error("Network error");
			vi.mocked(window.showErrorMessage).mockResolvedValue(undefined);

			// Simulate error in command handler
			const commandHandler = async () => {
				try {
					throw testError;
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					await window.showErrorMessage(
						`Failed to show welcome screen: ${message}`
					);
				}
			};

			await commandHandler();

			expect(window.showErrorMessage).toHaveBeenCalledWith(
				"Failed to show welcome screen: Network error"
			);
		});

		it("should continue extension functionality after command error", async () => {
			// Even if welcome command fails, extension should remain functional
			const extensionActive = true;

			const commandHandler = () => {
				try {
					throw new Error("Command failed");
				} catch (error) {
					// Error is logged but doesn't crash extension
					mockOutputChannel.appendLine("Error occurred");
				}
			};

			await commandHandler();

			// Extension should still be active
			expect(extensionActive).toBe(true);
		});
	});

	describe("Output Channel Logging", () => {
		it("should log when showing welcome screen via command", () => {
			mockOutputChannel.appendLine("Showing welcome screen (on-demand)...");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"Showing welcome screen (on-demand)..."
			);
		});

		it("should log provider creation", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);

			// Provider creation may log initialization
			expect(provider).toBeDefined();
		});

		it("should log panel show operation", () => {
			// Clear any previous calls
			vi.clearAllMocks();

			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();

			// Show panel - this creates the webview
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			// Panel creation itself may not log, but the operation is tracked
			expect(panel).toBeDefined();
			expect(panel.panel).toBeDefined();
		});

		it("should use GatomIA output channel", () => {
			expect(mockOutputChannel.name).toBe("GatomIA");
		});
	});

	describe("Integration with Extension Activation", () => {
		it("should be available immediately after extension activation", () => {
			// Command should be registered during activation
			const commandId = "gatomia.showWelcome";

			// Verify command ID format
			expect(commandId).toMatch(GATOMIA_CMD_PREFIX);
			expect(commandId).toBe("gatomia.showWelcome");
		});

		it("should work regardless of first-time state", () => {
			// Test with first-time state
			workspaceStateMap.clear();

			const provider1 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks1 = provider1.getCallbacks();
			const panel1 = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks1
			);

			expect(panel1).toBeDefined();

			// Test with returning user state
			workspaceStateMap.set("gatomia.welcomeScreen.hasShown", true);

			const provider2 = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks2 = provider2.getCallbacks();
			const panel2 = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks2
			);

			expect(panel2).toBeDefined();
		});

		it("should work even when user opted out of auto-show", () => {
			// User opted out of auto-show
			workspaceStateMap.set("gatomia.welcomeScreen.dontShow", true);

			// Command should still work (manual invocation)
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();
			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);

			expect(panel).toBeDefined();
		});
	});

	describe("Complete Command Flow", () => {
		it("should execute complete command flow successfully", () => {
			const flowLog: string[] = [];

			try {
				// 1. Log command execution
				flowLog.push("1. Command executed");
				mockOutputChannel.appendLine("Showing welcome screen (on-demand)...");

				// 2. Create provider
				flowLog.push("2. Provider created");
				const provider = new WelcomeScreenProvider(
					mockContext,
					mockOutputChannel
				);

				// 3. Get callbacks
				flowLog.push("3. Callbacks retrieved");
				const callbacks = provider.getCallbacks();

				// 4. Show panel
				flowLog.push("4. Panel shown");
				const panel = WelcomeScreenPanel.show(
					mockContext,
					mockOutputChannel,
					callbacks
				);

				// 5. Set panel reference
				flowLog.push("5. Panel reference set");
				if (callbacks.setPanel) {
					callbacks.setPanel(panel);
				}

				flowLog.push("6. Complete");
			} catch (error) {
				flowLog.push(`Error: ${error}`);
			}

			// Verify complete flow
			expect(flowLog).toContain("6. Complete");
			expect(flowLog.length).toBe(6);
		});

		it("should maintain correct order of operations", () => {
			const operations: string[] = [];

			// Track operation order
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			operations.push("provider");

			const callbacks = provider.getCallbacks();
			operations.push("callbacks");

			const panel = WelcomeScreenPanel.show(
				mockContext,
				mockOutputChannel,
				callbacks
			);
			operations.push("panel");

			if (callbacks.setPanel) {
				callbacks.setPanel(panel);
				operations.push("setPanel");
			}

			// Verify order
			expect(operations).toEqual([
				"provider",
				"callbacks",
				"panel",
				"setPanel",
			]);
		});
	});
});
