/**
 * AgentChatViewProvider tests.
 *
 * Validates the canonical sidebar webview surface:
 *   - resolveWebviewView pushes catalog + session list eagerly
 *   - `agent-chat/control/switch-session` rebinds without leaking
 *     subscriptions
 *   - `agent-chat/control/request-new-chat` clears the binding and emits
 *     `session/cleared`
 *   - `agent-chat/control/new-session` dispatches the start-new command
 *     with the picked provider/model/agent-file
 *   - registry/store change events trigger session-list rebroadcast
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, EventEmitter } from "vscode";
import { AgentChatViewProvider } from "../../../src/providers/agent-chat-view-provider";
import { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import {
	AgentChatSessionStore,
	type AgentChatArchiveWriter,
	type AgentChatMemento,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import type {
	AgentChatSession,
	ChatMessage,
} from "../../../src/features/agent-chat/types";

// ============================================================================
// Fakes
// ============================================================================

const NOOP = (): void => {
	// Intentionally empty.
};

function createMockMemento(): AgentChatMemento & {
	_store: Map<string, unknown>;
} {
	const store = new Map<string, unknown>();
	return {
		_store: store,
		get: <T>(key: string, defaultValue?: T): T | undefined =>
			(store.has(key) ? store.get(key) : defaultValue) as T | undefined,
		update: (key: string, value: unknown): Thenable<void> => {
			if (value === undefined) {
				store.delete(key);
			} else {
				store.set(key, value);
			}
			return Promise.resolve();
		},
		keys: (): readonly string[] => [...store.keys()],
	};
}

function createMockArchive(): AgentChatArchiveWriter {
	return {
		appendLines: vi.fn(() => Promise.resolve("a.jsonl")) as (
			sessionId: string,
			messages: ChatMessage[]
		) => Promise<string>,
		readLines: vi.fn(() => Promise.resolve([])) as (
			sessionId: string,
			offset: number,
			limit: number
		) => Promise<ChatMessage[]>,
	};
}

interface FakeWebview {
	html: string;
	options: unknown;
	postMessage: ReturnType<typeof vi.fn>;
	onDidReceiveMessage: ReturnType<typeof vi.fn>;
	asWebviewUri: ReturnType<typeof vi.fn>;
	cspSource: string;
	_inject(message: unknown): void;
	_listeners: Array<(msg: unknown) => void>;
}

interface FakeWebviewView {
	webview: FakeWebview;
	onDidDispose: (cb: () => void) => { dispose: () => void };
	show: ReturnType<typeof vi.fn>;
	_fireDispose(): void;
}

function createFakeView(): FakeWebviewView {
	const listeners: Array<(msg: unknown) => void> = [];
	const webview: FakeWebview = {
		html: "",
		options: {},
		postMessage: vi.fn(() => Promise.resolve(true)),
		onDidReceiveMessage: vi.fn((cb: (msg: unknown) => void) => {
			listeners.push(cb);
			return { dispose: NOOP };
		}),
		asWebviewUri: vi.fn((uri) => uri),
		cspSource: "vscode-webview://test",
		_inject: (m) => {
			for (const cb of listeners) {
				cb(m);
			}
		},
		_listeners: listeners,
	};
	let disposeHandler: (() => void) | undefined;
	return {
		webview,
		onDidDispose: (cb) => {
			disposeHandler = cb;
			return { dispose: NOOP };
		},
		show: vi.fn(),
		_fireDispose: () => disposeHandler?.(),
	};
}

function makeContext(): {
	extensionUri: { fsPath: string };
	workspaceState: AgentChatMemento;
} {
	return {
		extensionUri: { fsPath: "/fake/extension" } as never,
		workspaceState: createMockMemento(),
	};
}

async function seedSession(
	store: AgentChatSessionStore,
	overrides: Partial<AgentChatSession> = {}
): Promise<AgentChatSession> {
	const seeded = await store.createSession({
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "opencode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		workspaceUri: "file:///fake/workspace",
		...overrides,
	});
	return (await store.getSession(seeded.id)) as AgentChatSession;
}

// ============================================================================
// Suite
// ============================================================================

describe("AgentChatViewProvider", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let archive: AgentChatArchiveWriter;
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	beforeEach(() => {
		vi.mocked(commands.executeCommand).mockReset();
		vi.mocked(commands.executeCommand).mockResolvedValue(undefined as never);
		memento = createMockMemento();
		archive = createMockArchive();
		store = new AgentChatSessionStore({ workspaceState: memento, archive });
		registry = new AgentChatRegistry();
	});

	function makeProvider(catalogOverrides?: {
		providers?: ReturnType<typeof vi.fn>;
		agents?: ReturnType<typeof vi.fn>;
	}): AgentChatViewProvider {
		const catalogChangedEmitter = new EventEmitter<void>();
		return new AgentChatViewProvider({
			context: makeContext() as never,
			store,
			registry,
			catalogSources: {
				acpProviderRegistry: catalogOverrides?.providers
					? ({ list: catalogOverrides.providers } as never)
					: ({ list: () => [] } as never),
				agentRegistry: catalogOverrides?.agents
					? ({ getAllAgents: catalogOverrides.agents } as never)
					: ({ getAllAgents: () => [] } as never),
			},
			onCatalogChanged: (cb) => {
				const sub = catalogChangedEmitter.event(() => cb());
				return { dispose: () => sub.dispose() };
			},
		});
	}

	it("eagerly pushes catalog + session list when the view resolves", () => {
		const viewProvider = makeProvider({
			providers: vi.fn(() => [
				{
					id: "claude",
					displayName: "Claude",
					source: "built-in",
					spawnCommand: "claude",
					spawnArgs: [],
				},
			]),
			agents: vi.fn(() => []),
		});
		const view = createFakeView();
		viewProvider.resolveWebviewView(view as never, {} as never, {} as never);

		const types = view.webview.postMessage.mock.calls.map(
			([m]) => (m as { type: string }).type
		);
		expect(types).toContain("agent-chat/catalog/loaded");
		expect(types).toContain("agent-chat/sessions/list-changed");

		const catalogCall = view.webview.postMessage.mock.calls.find(
			([m]) => (m as { type: string }).type === "agent-chat/catalog/loaded"
		);
		const catalog = (catalogCall?.[0] as { payload: { catalog: unknown } })
			.payload.catalog as { providers: { id: string }[] };
		expect(catalog.providers[0].id).toBe("claude");
	});

	it("binds to the requested session on switch-session and emits session/loaded", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);

		const viewProvider = makeProvider();
		const view = createFakeView();
		viewProvider.resolveWebviewView(view as never, {} as never, {} as never);
		view.webview.postMessage.mockClear();

		view.webview._inject({
			type: "agent-chat/control/switch-session",
			payload: { sessionId: session.id },
		});
		await Promise.resolve();
		await Promise.resolve();

		const types = view.webview.postMessage.mock.calls.map(
			([m]) => (m as { type: string }).type
		);
		expect(types).toContain("agent-chat/session/loaded");
	});

	it("clears the binding on request-new-chat", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);

		const viewProvider = makeProvider();
		const view = createFakeView();
		viewProvider.resolveWebviewView(view as never, {} as never, {} as never);

		view.webview._inject({
			type: "agent-chat/control/switch-session",
			payload: { sessionId: session.id },
		});
		await Promise.resolve();
		await Promise.resolve();
		view.webview.postMessage.mockClear();

		view.webview._inject({
			type: "agent-chat/control/request-new-chat",
			payload: {},
		});
		await Promise.resolve();
		await Promise.resolve();

		const cleared = view.webview.postMessage.mock.calls.find(
			([m]) => (m as { type: string }).type === "agent-chat/session/cleared"
		);
		expect(cleared).toBeDefined();
	});

	it("dispatches gatomia.agentChat.startNew when the empty composer submits", async () => {
		const viewProvider = makeProvider({
			providers: vi.fn(() => [
				{
					id: "claude",
					displayName: "Claude",
					source: "built-in",
					spawnCommand: "claude",
					spawnArgs: [],
				},
			]),
		});
		const view = createFakeView();
		viewProvider.resolveWebviewView(view as never, {} as never, {} as never);

		view.webview._inject({
			type: "agent-chat/control/new-session",
			payload: {
				providerId: "claude",
				modelId: "claude-3-opus",
				taskInstruction: "do the thing",
			},
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(commands.executeCommand).toHaveBeenCalled();
		const startCall = vi
			.mocked(commands.executeCommand)
			.mock.calls.find(([cmd]) => cmd === "gatomia.agentChat.startNew");
		expect(startCall).toBeDefined();
		const params = startCall?.[1] as {
			agentId: string;
			mode: string;
			taskInstruction: string;
		};
		expect(params.agentId).toBe("claude");
		expect(params.mode).toBe("claude-3-opus");
		expect(params.taskInstruction).toContain("do the thing");
	});

	it("rebroadcasts the session list when the registry mutates", async () => {
		const viewProvider = makeProvider();
		const view = createFakeView();
		viewProvider.resolveWebviewView(view as never, {} as never, {} as never);
		view.webview.postMessage.mockClear();

		const session = await seedSession(store);
		registry.registerSession(session);

		// Both `store.onDidChangeManifest` (fired during createSession) and
		// `registry.onDidChange` (fired during registerSession) trigger a
		// list rebroadcast — the second is the one that includes the live
		// registry entry, so we assert against the most recent payload.
		const listChanges = view.webview.postMessage.mock.calls.filter(
			([m]) =>
				(m as { type: string }).type === "agent-chat/sessions/list-changed"
		);
		expect(listChanges.length).toBeGreaterThan(0);
		const latest = listChanges.at(-1);
		const payload = (
			latest?.[0] as {
				payload: { sessions: { id: string }[] };
			}
		).payload;
		expect(payload.sessions.map((s) => s.id)).toContain(session.id);
	});

	it("focusSession reveals the workbench container and binds the session", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);

		const viewProvider = makeProvider();
		const view = createFakeView();
		viewProvider.resolveWebviewView(view as never, {} as never, {} as never);
		view.webview.postMessage.mockClear();

		await viewProvider.focusSession(session.id);
		await Promise.resolve();

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.view.extension.gatomia-chat"
		);
		const types = view.webview.postMessage.mock.calls.map(
			([m]) => (m as { type: string }).type
		);
		expect(types).toContain("agent-chat/session/loaded");
	});
});
