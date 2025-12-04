import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	CancellationToken,
	ExtensionContext,
	OutputChannel,
	WebviewView,
	WebviewViewResolveContext,
} from "vscode";
import { Uri, commands } from "vscode";
import { HookViewProvider } from "./hook-view-provider";
import type { HookManager } from "../features/hooks/hook-manager";
import type { HookExecutor } from "../features/hooks/hook-executor";
import type { Hook } from "../features/hooks/types";

// Mock dependencies
vi.mock("../utils/get-webview-content", () => ({
	getWebviewContent: vi.fn(() => "<html>Mock Webview</html>"),
}));

describe("HookViewProvider", () => {
	let provider: HookViewProvider;
	let mockContext: ExtensionContext;
	let mockHookManager: HookManager;
	let mockHookExecutor: HookExecutor;
	let mockOutputChannel: OutputChannel;
	let mockWebviewView: WebviewView;
	let messageHandler: (message: any) => void;
	let executionHandlers: {
		started: Array<(event: any) => void>;
		completed: Array<(event: any) => void>;
		failed: Array<(event: any) => void>;
	};
	let executeCommandSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		executeCommandSpy = vi
			.spyOn(commands, "executeCommand")
			.mockResolvedValue(undefined as any);

		// Mock context
		mockContext = {
			extensionUri: Uri.parse("file:///extension"),
			subscriptions: [],
		} as unknown as ExtensionContext;

		// Mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
		} as unknown as OutputChannel;

		// Mock hook manager
		mockHookManager = {
			getAllHooks: vi.fn().mockResolvedValue([]),
			createHook: vi.fn(),
			updateHook: vi.fn(),
			deleteHook: vi.fn(),
			onHooksChanged: vi.fn((callback) => ({ dispose: vi.fn() })),
		} as unknown as HookManager;

		// Mock hook executor
		executionHandlers = {
			started: [],
			completed: [],
			failed: [],
		};
		mockHookExecutor = {
			onExecutionStarted: vi.fn((callback) => {
				executionHandlers.started.push(callback);
				return { dispose: vi.fn() };
			}),
			onExecutionCompleted: vi.fn((callback) => {
				executionHandlers.completed.push(callback);
				return { dispose: vi.fn() };
			}),
			onExecutionFailed: vi.fn((callback) => {
				executionHandlers.failed.push(callback);
				return { dispose: vi.fn() };
			}),
			getExecutionLogs: vi.fn(() => []),
			getExecutionLogsForHook: vi.fn(() => []),
		} as unknown as HookExecutor;

		// Mock webview view
		mockWebviewView = {
			webview: {
				options: {},
				html: "",
				postMessage: vi.fn(),
				onDidReceiveMessage: vi.fn((handler) => {
					messageHandler = handler;
					return { dispose: vi.fn() };
				}),
				asWebviewUri: vi.fn((uri) => uri),
				cspSource: "test-csp",
			},
			onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
		} as unknown as WebviewView;

		provider = new HookViewProvider(
			mockContext,
			mockHookManager,
			mockHookExecutor,
			mockOutputChannel
		);
	});

	afterEach(() => {
		executeCommandSpy?.mockRestore();
	});

	describe("view helper commands", () => {
		it("should show create hook form when requested", async () => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			await provider.showCreateHookForm();

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ command: "hooks.show-form" })
			);
		});

		it("should focus view and queue logs message when webview not ready", async () => {
			await provider.showLogsPanel("hook-123");

			expect(executeCommandSpy).toHaveBeenCalledWith("alma.hooksView.focus");

			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					command: "hooks.show-logs",
				})
			);
		});
	});

	describe("initialization", () => {
		it("should initialize and subscribe to hook changes", () => {
			provider.initialize();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookViewProvider] Initialized"
			);
			expect(mockHookManager.onHooksChanged).toHaveBeenCalled();
		});

		it("should dispose of resources", () => {
			provider.initialize();
			provider.dispose();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookViewProvider] Disposed"
			);
		});
	});

	describe("resolveWebviewView", () => {
		it("should configure webview correctly", () => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			expect(mockWebviewView.webview.options).toEqual({
				enableScripts: true,
				localResourceRoots: [mockContext.extensionUri],
			});
			expect(mockWebviewView.webview.html).toBe("<html>Mock Webview</html>");
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookViewProvider] Webview resolved"
			);
		});

		it("should setup message handler", () => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
		});

		it("should sync hooks on initialization", async () => {
			const mockHooks: Hook[] = [
				{
					id: "hook-1",
					name: "Test Hook",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "agent",
						parameters: { command: "/speckit.clarify" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 0,
				},
			];
			vi.mocked(mockHookManager.getAllHooks).mockResolvedValue(mockHooks);

			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			// Wait for async sync
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.sync",
				type: "hooks/sync",
				data: { hooks: mockHooks },
			});
		});
	});

	describe("syncHooksToWebview", () => {
		beforeEach(() => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);
		});

		it("should sync all hooks to webview", async () => {
			const mockHooks: Hook[] = [
				{
					id: "hook-1",
					name: "Hook 1",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "plan",
						timing: "after",
					},
					action: {
						type: "agent",
						parameters: { command: "/speckit.analyze" },
					},
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					executionCount: 5,
				},
			];
			vi.mocked(mockHookManager.getAllHooks).mockResolvedValue(mockHooks);

			await provider.syncHooksToWebview();

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.sync",
				type: "hooks/sync",
				data: { hooks: mockHooks },
			});
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookViewProvider] Synced 1 hooks to webview"
			);
		});

		it("should handle sync errors gracefully", async () => {
			const error = new Error("Sync failed");
			vi.mocked(mockHookManager.getAllHooks).mockRejectedValue(error);

			await provider.syncHooksToWebview();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookViewProvider] Error syncing hooks: Sync failed"
			);
		});

		it("should not sync if webview is not initialized", async () => {
			const uninitializedProvider = new HookViewProvider(
				mockContext,
				mockHookManager,
				mockHookExecutor,
				mockOutputChannel
			);

			// Clear any calls from initialization
			vi.clearAllMocks();

			await uninitializedProvider.syncHooksToWebview();

			// Should not call getAllHooks when webview is not resolved
			expect(mockHookManager.getAllHooks).not.toHaveBeenCalled();
		});
	});

	describe("message handling", () => {
		beforeEach(() => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);
		});

		it("should handle hooks.create message", async () => {
			const mockHook: Hook = {
				id: "new-hook",
				name: "New Hook",
				enabled: true,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "agent",
					parameters: { command: "/speckit.clarify" },
				},
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				executionCount: 0,
			};
			vi.mocked(mockHookManager.createHook).mockResolvedValue(mockHook);

			await messageHandler({
				command: "hooks.create",
				data: {
					name: "New Hook",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "agent",
						parameters: { command: "/speckit.clarify" },
					},
				},
			});

			expect(mockHookManager.createHook).toHaveBeenCalled();
			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.created",
				type: "hooks/created",
				data: { hook: mockHook },
			});
		});

		it("should handle hooks.update message", async () => {
			const updatedHook: Hook = {
				id: "hook-1",
				name: "Updated Hook",
				enabled: false,
				trigger: {
					agent: "speckit",
					operation: "plan",
					timing: "after",
				},
				action: {
					type: "agent",
					parameters: { command: "/speckit.analyze" },
				},
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				executionCount: 0,
			};
			vi.mocked(mockHookManager.updateHook).mockResolvedValue(updatedHook);

			await messageHandler({
				command: "hooks.update",
				data: {
					id: "hook-1",
					updates: { name: "Updated Hook", enabled: false },
				},
			});

			expect(mockHookManager.updateHook).toHaveBeenCalledWith("hook-1", {
				name: "Updated Hook",
				enabled: false,
			});
			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.updated",
				type: "hooks/updated",
				data: { hook: updatedHook },
			});
		});

		it("should handle hooks.delete message", async () => {
			vi.mocked(mockHookManager.deleteHook).mockResolvedValue(true);

			await messageHandler({
				command: "hooks.delete",
				data: { id: "hook-1" },
			});

			expect(mockHookManager.deleteHook).toHaveBeenCalledWith("hook-1");
			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.deleted",
				type: "hooks/deleted",
				data: { id: "hook-1" },
			});
		});

		it("should handle hooks.toggle message", async () => {
			const toggledHook: Hook = {
				id: "hook-1",
				name: "Hook 1",
				enabled: false,
				trigger: {
					agent: "speckit",
					operation: "specify",
					timing: "after",
				},
				action: {
					type: "agent",
					parameters: { command: "/speckit.clarify" },
				},
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				executionCount: 0,
			};
			vi.mocked(mockHookManager.updateHook).mockResolvedValue(toggledHook);

			await messageHandler({
				command: "hooks.toggle",
				data: { id: "hook-1", enabled: false },
			});

			expect(mockHookManager.updateHook).toHaveBeenCalledWith("hook-1", {
				enabled: false,
			});
		});

		it("should handle hooks.list message", async () => {
			await messageHandler({
				command: "hooks.list",
			});

			expect(mockHookManager.getAllHooks).toHaveBeenCalled();
		});

		it("should handle hooks.logs message for all hooks", async () => {
			const logs = [
				{
					id: "log-1",
					hookId: "hook-1",
					executionId: "exec-1",
					chainDepth: 0,
					triggeredAt: Date.now(),
					completedAt: Date.now(),
					duration: 10,
					status: "success",
					contextSnapshot: {},
				},
			];
			vi.mocked(mockHookExecutor.getExecutionLogs).mockReturnValue(logs);

			await messageHandler({
				command: "hooks.logs",
			});

			expect(mockHookExecutor.getExecutionLogs).toHaveBeenCalled();
			expect(mockHookExecutor.getExecutionLogsForHook).not.toHaveBeenCalled();
			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.logs",
				type: "hooks/logs",
				data: { logs },
			});
		});

		it("should handle hooks.logs message for a specific hook", async () => {
			const logs = [
				{
					id: "log-2",
					hookId: "hook-1",
					executionId: "exec-2",
					chainDepth: 1,
					triggeredAt: Date.now(),
					completedAt: Date.now(),
					duration: 25,
					status: "failure",
					error: { message: "boom", code: "ERR" },
					contextSnapshot: {},
				},
			];
			vi.mocked(mockHookExecutor.getExecutionLogsForHook).mockReturnValue(logs);

			await messageHandler({
				command: "hooks.logs",
				data: { hookId: "hook-1" },
			});

			expect(mockHookExecutor.getExecutionLogsForHook).toHaveBeenCalledWith(
				"hook-1"
			);
			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.logs",
				type: "hooks/logs",
				data: { logs },
			});
		});

		it("should handle unknown commands gracefully", async () => {
			await messageHandler({
				command: "unknown.command",
			});

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[HookViewProvider] Unknown command: unknown.command"
			);
		});

		it("should send error message on operation failure", async () => {
			const error = new Error("Operation failed");
			vi.mocked(mockHookManager.createHook).mockRejectedValue(error);

			await messageHandler({
				command: "hooks.create",
				data: {
					name: "New Hook",
					enabled: true,
					trigger: {
						agent: "speckit",
						operation: "specify",
						timing: "after",
					},
					action: {
						type: "agent",
						parameters: { command: "/speckit.clarify" },
					},
				},
			});

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.error",
				type: "hooks/error",
				data: {
					message: "Operation failed",
					code: undefined,
				},
			});
		});
	});

	describe("execution status updates", () => {
		const baseHook: Hook = {
			id: "hook-status",
			name: "Status Hook",
			enabled: true,
			trigger: {
				agent: "speckit",
				operation: "specify",
				timing: "after",
			},
			action: {
				type: "agent",
				parameters: { command: "/speckit.clarify" },
			},
			createdAt: Date.now(),
			modifiedAt: Date.now(),
			executionCount: 0,
		};

		beforeEach(() => {
			provider.initialize();
		});

		it("sends execution status events to the webview when ready", () => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			for (const handler of executionHandlers.started) {
				handler({ hook: baseHook, context: {} });
			}

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.execution-status",
				type: "hooks/execution-status",
				data: { hookId: "hook-status", status: "executing" },
			});
		});

		it("queues status updates until the webview is resolved", async () => {
			for (const handler of executionHandlers.completed) {
				handler({ hook: baseHook, context: {} });
			}

			expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();

			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.execution-status",
				type: "hooks/execution-status",
				data: { hookId: "hook-status", status: "completed" },
			});
		});

		it("includes error message on failed executions", () => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			for (const handler of executionHandlers.failed) {
				handler({
					hook: baseHook,
					context: {} as any,
					result: { error: { message: "boom" } },
				});
			}

			expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
				command: "hooks.execution-status",
				type: "hooks/execution-status",
				data: { hookId: "hook-status", status: "failed", errorMessage: "boom" },
			});
		});
	});

	describe("refreshWebview", () => {
		it("should trigger sync when refreshed", async () => {
			provider.resolveWebviewView(
				mockWebviewView,
				{} as WebviewViewResolveContext,
				{} as CancellationToken
			);

			const mockHooks: Hook[] = [];
			vi.mocked(mockHookManager.getAllHooks).mockResolvedValue(mockHooks);

			await provider.refreshWebview();

			expect(mockHookManager.getAllHooks).toHaveBeenCalled();
		});
	});
});
