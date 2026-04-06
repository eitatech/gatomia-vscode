import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, OutputChannel } from "vscode";
import { Uri } from "vscode";
import { HookManager } from "../../src/features/hooks/hook-manager";
import { HookViewProvider } from "../../src/providers/hook-view-provider";
import type { Hook } from "../../src/features/hooks/types";
import { HookExecutor } from "../../src/features/hooks/hook-executor";
import { TriggerRegistry } from "../../src/features/hooks/trigger-registry";
import type { AgentActionExecutor } from "../../src/features/hooks/actions/agent-action";

vi.mock("../../src/utils/get-webview-content", () => ({
	getWebviewContent: vi.fn(() => "<html>Hooks View</html>"),
}));

vi.mock("../../src/features/hooks/actions/agent-action", () => {
	// biome-ignore lint/complexity/useArrowFunction: vi.fn() as constructor requires function keyword for vitest 4.x
	const AgentActionExecutorMock = vi.fn(function () {
		return { execute: vi.fn().mockResolvedValue(undefined) };
	});
	return {
		AgentActionExecutor: AgentActionExecutorMock,
	};
});

const createMockOutputChannel = (): OutputChannel =>
	({
		appendLine: vi.fn(),
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

const createMockWebviewView = () => {
	let messageHandler: (message: any) => Promise<void> | void = () => {
		/* noop */
	};
	const postMessage = vi.fn().mockResolvedValue(true);

	const webviewView = {
		webview: {
			options: {},
			html: "",
			postMessage,
			onDidReceiveMessage: vi.fn((handler) => {
				messageHandler = handler;
				return { dispose: vi.fn() };
			}),
			asWebviewUri: vi.fn((uri: Uri) => uri),
			cspSource: "mock-csp",
		},
	} as unknown as WebviewView;

	return {
		webviewView,
		getMessageHandler: () => messageHandler,
		postMessageMock: postMessage,
	};
};

describe("Hooks Workflow Integration", () => {
	let context: ExtensionContext;
	let outputChannel: OutputChannel;
	let triggerRegistry: TriggerRegistry;
	let hookExecutor: HookExecutor;
	let agentExecutor: AgentActionExecutor;
	let hookManager: HookManager;
	let provider: HookViewProvider;
	let webviewView: WebviewView;
	let postMessageMock: ReturnType<typeof vi.fn>;
	let handleMessage: (message: any) => Promise<void> | void;

	beforeEach(async () => {
		context = createMockContext();
		outputChannel = createMockOutputChannel();
		triggerRegistry = new TriggerRegistry(outputChannel);
		triggerRegistry.initialize();

		hookManager = new HookManager(context, outputChannel);
		await hookManager.initialize();

		const mockMCPDiscovery = {
			discoverServers: vi.fn().mockResolvedValue([]),
			getServer: vi.fn().mockResolvedValue(undefined),
			getTool: vi.fn().mockResolvedValue(undefined),
			clearCache: vi.fn(),
			isCacheFresh: vi.fn().mockReturnValue(true),
		};

		hookExecutor = new HookExecutor(
			hookManager,
			triggerRegistry,
			outputChannel,
			mockMCPDiscovery
		);
		hookExecutor.initialize();

		provider = new HookViewProvider({
			context,
			hookManager,
			hookExecutor,
			mcpDiscoveryService: mockMCPDiscovery,
			outputChannel,
		});

		agentExecutor = (hookExecutor as any).agentExecutor as AgentActionExecutor;
		vi.spyOn(agentExecutor, "execute").mockResolvedValue(undefined);
	});

	const createHookPayload = (): Omit<
		Hook,
		"id" | "createdAt" | "modifiedAt" | "executionCount"
	> => ({
		name: "Auto Clarify",
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
	});

	it("creates a hook via hookManager", async () => {
		const payload = createHookPayload();

		const created = await hookManager.createHook(payload);

		const hooks = await hookManager.getAllHooks();
		expect(hooks).toHaveLength(1);
		expect(hooks[0].name).toBe("Auto Clarify");
		expect(created.name).toBe("Auto Clarify");
	});

	it("edits an existing hook via hookManager", async () => {
		const created = await hookManager.createHook(createHookPayload());

		const updated = await hookManager.updateHook(created.id, {
			name: "Auto Analyze",
			action: {
				type: "agent",
				parameters: { command: "/speckit.analyze" },
			},
		});

		const hooks = await hookManager.getAllHooks();
		expect(hooks).toHaveLength(1);
		expect(hooks[0].name).toBe("Auto Analyze");
		expect((hooks[0].action.parameters as { command: string }).command).toBe(
			"/speckit.analyze"
		);
		expect(updated.name).toBe("Auto Analyze");
	});

	it("deletes an existing hook via hookManager", async () => {
		const created = await hookManager.createHook(createHookPayload());

		await hookManager.deleteHook(created.id);

		const hooks = await hookManager.getAllHooks();
		expect(hooks).toHaveLength(0);
	});

	describe("execution workflow", () => {
		it("executes hooks when triggers fire", async () => {
			const created = await hookManager.createHook(createHookPayload());
			await hookExecutor.executeHooksForTrigger("speckit", "specify");

			expect(agentExecutor.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					command: "/speckit.clarify",
				})
			);

			const logs = hookExecutor.getExecutionLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].hookId).toBe(created.id);
		});
	});
});
