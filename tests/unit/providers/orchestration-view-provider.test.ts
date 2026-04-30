import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, env, EventEmitter, Uri } from "vscode";
import { OrchestrationViewProvider } from "../../../src/providers/orchestration-view-provider";
import type {
	OrchestrationReadModel,
	OrchestrationSnapshot,
} from "../../../src/features/orchestration/orchestration-read-model";

vi.mock("../../../src/utils/get-webview-content", () => ({
	getWebviewContent: vi.fn(() => "<html></html>"),
}));

function makeSnapshot(
	overrides: Partial<OrchestrationSnapshot> = {}
): OrchestrationSnapshot {
	return {
		sessions: [],
		cloudProviderRegistryAvailable: true,
		cloudProviderCount: 1,
		activeProvider: {
			id: "devin",
			displayName: "Devin",
		},
		generatedAt: 1_710_000_000_000,
		degradedReasons: [],
		...overrides,
	};
}

interface FakeWebview {
	html: string;
	options: unknown;
	postMessage: ReturnType<typeof vi.fn>;
	onDidReceiveMessage: ReturnType<typeof vi.fn>;
	_inject(message: unknown): Promise<void>;
}

interface FakeWebviewView {
	webview: FakeWebview;
	show: ReturnType<typeof vi.fn>;
}

function createFakeView(): FakeWebviewView {
	const listeners: Array<(message: unknown) => void | Promise<void>> = [];
	const webview: FakeWebview = {
		html: "",
		options: {},
		postMessage: vi.fn(() => Promise.resolve(true)),
		onDidReceiveMessage: vi.fn((listener: (message: unknown) => void) => {
			listeners.push(listener);
			return { dispose: vi.fn() };
		}),
		_inject: async (message) => {
			for (const listener of listeners) {
				await listener(message);
			}
		},
	};

	return {
		webview,
		show: vi.fn(),
	};
}

async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe("OrchestrationViewProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(commands.executeCommand).mockResolvedValue(undefined as never);
		vi.mocked(env.openExternal).mockResolvedValue(true);
	});

	it("pushes the current snapshot on resolve and when the read model changes", async () => {
		const changeEmitter = new EventEmitter<void>();
		const snapshot = makeSnapshot({
			sessions: [
				{
					id: "agent-chat:session-1",
					source: "agent-chat",
					sourceSessionId: "session-1",
					title: "Investigate orchestration refresh race",
					agentName: "OpenCode",
					state: "running",
					bucket: "active",
					createdAt: 1,
					updatedAt: 2,
					lastVisibleActivityAt: 3,
					isBlocked: false,
					openSessionCommand: { kind: "agent-chat", sessionId: "session-1" },
				},
			],
		});
		const readModel = {
			snapshot: vi.fn().mockResolvedValue(snapshot),
			onDidChange: (listener: () => void) => changeEmitter.event(listener),
		} as unknown as OrchestrationReadModel;
		const provider = new OrchestrationViewProvider({
			context: { extensionUri: Uri.file("/fake/extension") } as never,
			readModel,
		});
		const view = createFakeView();

		provider.resolveWebviewView(view as never, {} as never, {} as never);
		await flushMicrotasks();

		expect(view.webview.postMessage).toHaveBeenCalledWith({
			type: "orchestration/snapshot",
			payload: snapshot,
		});

		view.webview.postMessage.mockClear();
		changeEmitter.fire();
		await flushMicrotasks();

		expect(view.webview.postMessage).toHaveBeenCalledWith({
			type: "orchestration/snapshot",
			payload: snapshot,
		});
	});

	it("dispatches refresh, open-session, and external navigation commands", async () => {
		const snapshot = makeSnapshot({
			sessions: [
				{
					id: "agent-chat:session-1",
					source: "agent-chat",
					sourceSessionId: "session-1",
					title: "Resume local chat",
					agentName: "OpenCode",
					state: "running",
					bucket: "active",
					createdAt: 1,
					updatedAt: 2,
					lastVisibleActivityAt: 3,
					isBlocked: false,
					openSessionCommand: { kind: "agent-chat", sessionId: "session-1" },
				},
				{
					id: "cloud-agent:session-2",
					source: "cloud-agent",
					sourceSessionId: "session-2",
					title: "Open remote run",
					agentName: "Devin",
					state: "failed",
					bucket: "failed",
					createdAt: 4,
					updatedAt: 5,
					lastVisibleActivityAt: 6,
					isBlocked: false,
					externalUrl: "https://example.test/session-2",
					openSessionCommand: {
						kind: "cloud-agent",
						localId: "session-2",
						externalUrl: "https://example.test/session-2",
					},
				},
			],
		});
		const readModel = {
			snapshot: vi.fn().mockResolvedValue(snapshot),
			onDidChange: () => ({ dispose: vi.fn() }),
		} as unknown as OrchestrationReadModel;
		const provider = new OrchestrationViewProvider({
			context: { extensionUri: Uri.file("/fake/extension") } as never,
			readModel,
		});
		const view = createFakeView();

		provider.resolveWebviewView(view as never, {} as never, {} as never);
		await flushMicrotasks();
		vi.mocked(commands.executeCommand).mockClear();

		await view.webview._inject({ type: "orchestration/refresh" });
		await flushMicrotasks();
		expect(commands.executeCommand).toHaveBeenNthCalledWith(
			1,
			"gatomia.views.cloudAgents.focus"
		);
		expect(commands.executeCommand).toHaveBeenNthCalledWith(
			2,
			"gatomia.refreshCloudAgents"
		);

		vi.mocked(commands.executeCommand).mockClear();
		await view.webview._inject({
			type: "orchestration/open-session",
			payload: { sessionId: "agent-chat:session-1" },
		});
		await flushMicrotasks();
		expect(commands.executeCommand).toHaveBeenCalledWith(
			"gatomia.agentChat.openForSession",
			"session-1"
		);

		await view.webview._inject({
			type: "orchestration/open-session",
			payload: { sessionId: "cloud-agent:session-2" },
		});
		await flushMicrotasks();
		expect(vi.mocked(env.openExternal).mock.calls.at(-1)?.[0]?.toString()).toBe(
			"https://example.test/session-2"
		);

		await view.webview._inject({
			type: "orchestration/open-existing-surface",
			payload: { source: "cloud-agent" },
		});
		await flushMicrotasks();
		expect(commands.executeCommand).toHaveBeenCalledWith(
			"gatomia.refreshCloudAgents"
		);

		await view.webview._inject({
			type: "orchestration/open-external",
			payload: { url: "https://example.test/direct" },
		});
		await flushMicrotasks();
		expect(vi.mocked(env.openExternal).mock.calls.at(-1)?.[0]?.toString()).toBe(
			"https://example.test/direct"
		);
	});

	it("posts a degraded fallback snapshot when snapshot reads fail", async () => {
		const readModel = {
			snapshot: vi.fn().mockRejectedValue(new Error("boom")),
			onDidChange: () => ({ dispose: vi.fn() }),
		} as unknown as OrchestrationReadModel;
		const outputChannel = { appendLine: vi.fn() };
		const provider = new OrchestrationViewProvider({
			context: { extensionUri: Uri.file("/fake/extension") } as never,
			readModel,
			outputChannel,
		});
		const view = createFakeView();

		provider.resolveWebviewView(view as never, {} as never, {} as never);
		await flushMicrotasks();

		expect(view.webview.postMessage).toHaveBeenCalledWith({
			type: "orchestration/snapshot",
			payload: expect.objectContaining({
				sessions: [],
				cloudProviderRegistryAvailable: false,
				cloudProviderCount: 0,
				degradedReasons: [
					"Failed to read orchestration status. Refresh the view or check the output channel.",
				],
			}),
		});
		expect(outputChannel.appendLine).toHaveBeenCalledWith(
			"[Orchestration] snapshot read failed: boom"
		);
	});
});
