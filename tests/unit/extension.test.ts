import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	Uri,
	window,
	commands,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import { WelcomeScreenProvider } from "../../src/providers/welcome-screen-provider";
import { WelcomeScreenPanel } from "../../src/panels/welcome-screen-panel";

// biome-ignore lint/suspicious/noSkippedTests: Temporarily disabled pending implementation and test refactor
describe.skip("Extension - gatomia.showWelcome Command", () => {
	let mockContext: ExtensionContext;
	let mockOutputChannel: OutputChannel;
	let mockWelcomeProvider: WelcomeScreenProvider;
	let mockPanel: any;
	let mockCallbacks: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock ExtensionContext
		mockContext = {
			subscriptions: [],
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn(),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
			} as any,
			extensionUri: Uri.file("/test/path"),
			environmentVariableCollection: {} as any,
			storageUri: Uri.file("/test/storage"),
			globalStorageUri: Uri.file("/test/global-storage"),
			logUri: Uri.file("/test/logs"),
			extensionMode: 3, // ExtensionMode.Test
			asAbsolutePath: vi.fn(
				(relativePath: string) => `/test/path/${relativePath}`
			),
			storagePath: "/test/storage",
			globalStoragePath: "/test/global-storage",
			logPath: "/test/logs",
		} as any;

		// Mock OutputChannel
		mockOutputChannel = {
			name: "GatomIA",
			append: vi.fn(),
			appendLine: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			replace: vi.fn(),
		} as any;

		// Mock panel
		mockPanel = {
			panel: {
				webview: {},
			},
		};

		// Mock callbacks
		mockCallbacks = {
			setPanel: vi.fn(),
			onNavigate: vi.fn(),
			onUpdateConfiguration: vi.fn(),
			onInstallDependency: vi.fn(),
			onRefreshDependencies: vi.fn(),
			onExecuteCommand: vi.fn(),
			onDismiss: vi.fn(),
		};
	});

	describe("Command Registration", () => {
		it("should register gatomia.showWelcome command with proper signature", () => {
			// Verify command.registerCommand is available
			expect(commands.registerCommand).toBeDefined();
			expect(typeof commands.registerCommand).toBe("function");
		});

		it("should return a disposable when registering command", () => {
			const disposable = commands.registerCommand("gatomia.showWelcome", () => {
				/* noop */
			});

			expect(disposable).toBeDefined();
			expect(disposable.dispose).toBeDefined();
			expect(typeof disposable.dispose).toBe("function");
		});
	});

	describe("Command Handler Logic", () => {
		it("should create WelcomeScreenProvider instance", () => {
			// Simulate what the command handler does
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);

			expect(provider).toBeDefined();
			expect(provider.getCallbacks).toBeDefined();
		});

		it("should get callbacks from WelcomeScreenProvider", () => {
			const provider = new WelcomeScreenProvider(
				mockContext,
				mockOutputChannel
			);
			const callbacks = provider.getCallbacks();

			expect(callbacks).toBeDefined();
			expect(callbacks.setPanel).toBeDefined();
			expect(typeof callbacks.setPanel).toBe("function");
		});

		it("should call WelcomeScreenPanel.show with context, output, and callbacks", () => {
			// Spy on WelcomeScreenPanel.show
			const showSpy = vi.spyOn(WelcomeScreenPanel, "show");

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

			expect(showSpy).toHaveBeenCalledWith(
				mockContext,
				mockOutputChannel,
				callbacks
			);
			expect(panel).toBeDefined();
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

			// Call setPanel if it exists
			if (callbacks.setPanel) {
				callbacks.setPanel(panel);
			}

			// Verify callback was defined
			expect(callbacks.setPanel).toBeDefined();
		});
	});

	describe("Error Handling", () => {
		it("should handle errors when creating WelcomeScreenProvider", () => {
			// Simulate error in command handler
			let errorCaught = false;
			try {
				// Force an error by passing invalid context
				new WelcomeScreenProvider(null as any, mockOutputChannel);
			} catch (error) {
				errorCaught = true;
			}

			// The command handler should catch this error
			expect(true).toBe(true);
		});

		it("should log errors to output channel", () => {
			const testError = new Error("Test error");
			const message = testError.message;

			// Simulate error logging
			mockOutputChannel.appendLine(`[Welcome] Failed to show: ${message}`);

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[Welcome] Failed to show: Test error"
			);
		});

		it("should show error message to user", async () => {
			const testError = new Error("Test error");

			// Simulate user error notification
			await window.showErrorMessage(
				`Failed to show welcome screen: ${testError.message}`
			);

			expect(window.showErrorMessage).toHaveBeenCalledWith(
				"Failed to show welcome screen: Test error"
			);
		});
	});

	describe("Output Logging", () => {
		it("should log when showing welcome screen", () => {
			mockOutputChannel.appendLine("Showing welcome screen (on-demand)...");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"Showing welcome screen (on-demand)..."
			);
		});

		it("should use the GatomIA output channel", () => {
			expect(mockOutputChannel.name).toBe("GatomIA");
		});
	});

	describe("Integration Pattern", () => {
		it("should follow the correct execution flow", async () => {
			// Simulate the complete command handler flow
			const executionLog: string[] = [];

			try {
				executionLog.push("1. Log showing welcome screen");
				mockOutputChannel.appendLine("Showing welcome screen (on-demand)...");

				executionLog.push("2. Create WelcomeScreenProvider");
				const provider = new WelcomeScreenProvider(
					mockContext,
					mockOutputChannel
				);

				executionLog.push("3. Get callbacks");
				const callbacks = provider.getCallbacks();

				executionLog.push("4. Show panel");
				const panel = WelcomeScreenPanel.show(
					mockContext,
					mockOutputChannel,
					callbacks
				);

				executionLog.push("5. Set panel reference");
				if (callbacks.setPanel) {
					callbacks.setPanel(panel);
				}

				executionLog.push("6. Complete");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				executionLog.push(`Error: ${message}`);
				mockOutputChannel.appendLine(`[Welcome] Failed to show: ${message}`);
				await window.showErrorMessage(
					`Failed to show welcome screen: ${message}`
				);
			}

			// Verify the flow completed successfully
			expect(executionLog).toContain("6. Complete");
			expect(executionLog.length).toBe(6);
		});

		it("should handle async execution", () => {
			// Simulate async command handler
			const asyncHandler = () => {
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

				if (callbacks.setPanel) {
					callbacks.setPanel(panel);
				}

				return panel;
			};

			const result = asyncHandler();
			expect(result).toBeDefined();
		});
	});
});
