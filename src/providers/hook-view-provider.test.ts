import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, OutputChannel, WebviewPanel } from "vscode";
import { Uri, window } from "vscode";
import { HookViewProvider } from "./hook-view-provider";
import type { HookManager } from "../features/hooks/hook-manager";
import type { HookExecutor } from "../features/hooks/hook-executor";
import type { Hook } from "../features/hooks/types";

const mockHook: Hook = {
	id: "hook-1",
	name: "Auto Clarify",
	enabled: true,
	trigger: { agent: "speckit", operation: "specify", timing: "after" },
	action: { type: "agent", parameters: { command: "/speckit.clarify" } },
	createdAt: Date.now(),
	modifiedAt: Date.now(),
	executionCount: 0,
};

vi.mock("../utils/get-webview-content", () => ({
	getWebviewContent: vi.fn(() => "<html>Mock Webview</html>"),
}));

describe("HookViewProvider (panel)", () => {
	let provider: HookViewProvider;
	let mockContext: ExtensionContext;
	let mockHookManager: HookManager;
	let mockHookExecutor: HookExecutor;
	let mockOutputChannel: OutputChannel;
	let mockPanel: WebviewPanel;
	let messageHandler: ((message: any) => void) | undefined;
	let panelDisposeHandler: (() => void) | undefined;
	let createPanelSpy: ReturnType<typeof vi.spyOn> | undefined;

	beforeEach(() => {
		vi.clearAllMocks();

		mockContext = {
			extensionUri: Uri.parse("file:///extension"),
			subscriptions: [],
		} as unknown as ExtensionContext;

		mockOutputChannel = {
			appendLine: vi.fn(),
		} as unknown as OutputChannel;

		mockHookManager = {
			getAllHooks: vi.fn(() => []),
			createHook: vi.fn(),
			updateHook: vi.fn(),
			deleteHook: vi.fn(),
			onHooksChanged: vi.fn((cb) => ({ dispose: vi.fn() })),
		} as unknown as HookManager;

		mockHookExecutor = {
			onExecutionStarted: vi.fn(() => ({ dispose: vi.fn() })),
			onExecutionCompleted: vi.fn(() => ({ dispose: vi.fn() })),
			onExecutionFailed: vi.fn(() => ({ dispose: vi.fn() })),
			getExecutionLogs: vi.fn(() => []),
			getExecutionLogsForHook: vi.fn(() => []),
		} as unknown as HookExecutor;

		mockPanel = {
			webview: {
				html: "",
				postMessage: vi.fn().mockResolvedValue(true),
				onDidReceiveMessage: vi.fn((handler) => {
					messageHandler = handler;
					return { dispose: vi.fn() };
				}),
				asWebviewUri: vi.fn((uri) => uri),
				cspSource: "mock-csp",
			},
			onDidDispose: vi.fn((handler) => {
				panelDisposeHandler = handler;
				return { dispose: vi.fn() };
			}),
			reveal: vi.fn(),
			dispose: vi.fn(),
		} as unknown as WebviewPanel;

		(window as any).createWebviewPanel = vi.fn().mockReturnValue(mockPanel);
		createPanelSpy = vi.spyOn(window as any, "createWebviewPanel");

		provider = new HookViewProvider(
			mockContext,
			mockHookManager,
			mockHookExecutor,
			mockOutputChannel
		);
		provider.initialize();
	});

	afterEach(() => {
		createPanelSpy?.mockRestore();
	});

	it("opens a panel when showing create hook form", async () => {
		await provider.showCreateHookForm();
		await messageHandler?.({ command: "hooks.ready" });

		expect(window.createWebviewPanel).toHaveBeenCalled();
		expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ command: "hooks.show-form" })
		);
	});

	it("sends edit payload when editing a hook", async () => {
		await provider.showEditHookForm(mockHook);
		await messageHandler?.({ command: "hooks.ready" });

		expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "hooks.show-form",
				data: expect.objectContaining({ hook: mockHook, mode: "edit" }),
			})
		);
	});

	it("queues messages until panel is created", async () => {
		const localPanel = {
			webview: {
				html: "",
				postMessage: vi.fn().mockResolvedValue(true),
				onDidReceiveMessage: vi.fn((handler) => {
					messageHandler = handler;
					return { dispose: vi.fn() };
				}),
				asWebviewUri: vi.fn((uri) => uri),
				cspSource: "mock-csp",
			},
			onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
			reveal: vi.fn(),
			dispose: vi.fn(),
		} as unknown as WebviewPanel;
		const localSpy = vi
			.spyOn(window as any, "createWebviewPanel")
			.mockReturnValue(localPanel as any);
		const localProvider = new HookViewProvider(
			mockContext,
			mockHookManager,
			mockHookExecutor,
			mockOutputChannel
		);
		await localProvider.showLogsPanel("hook-1");
		expect(localSpy).toHaveBeenCalled();
		localSpy.mockRestore();
	});

	it("routes webview create messages to hook manager", async () => {
		mockHookManager.createHook = vi.fn(async (data) => ({
			...mockHook,
			id: "new",
			name: data.name,
		}));
		await provider.showCreateHookForm();
		await messageHandler?.({ command: "hooks.ready" });

		await messageHandler?.({
			command: "hooks.create",
			data: {
				name: "Test",
				enabled: true,
				trigger: mockHook.trigger,
				action: mockHook.action,
			},
		});

		expect(mockHookManager.createHook).toHaveBeenCalled();
		expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ command: "hooks.created" })
		);
	});

	it("disposes panel resources", () => {
		provider.dispose();
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			"[HookViewProvider] Disposed"
		);
		panelDisposeHandler?.();
		expect(mockPanel.reveal).not.toHaveBeenCalled();
	});
});
