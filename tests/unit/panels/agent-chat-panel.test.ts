/**
 * AgentChatPanel contract tests (US1 subset).
 *
 * TDD (Constitution III): red before T026.
 *
 * Covers the webview↔extension protocol messages relevant to User Story 1:
 *   - agent-chat/ready -> agent-chat/session/loaded hydration
 *   - agent-chat/input/submit -> deliveryStatus lifecycle (pending → delivered)
 *   - input while mid-turn -> pending → queued → delivered
 *   - second queued submission -> rejected
 *   - messages/appended + messages/updated forwarding
 *   - error routing
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md §4
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AgentChatPanel,
	type AgentChatPanelHost,
} from "../../../src/panels/agent-chat-panel";
import {
	AgentChatRegistry,
	type AgentChatPanelLike,
} from "../../../src/features/agent-chat/agent-chat-registry";
import {
	AgentChatSessionStore,
	type AgentChatArchiveWriter,
	type AgentChatMemento,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import type {
	AgentChatRunnerHandle,
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
		get: <T>(key: string, defaultValue?: T): T | undefined => {
			if (!store.has(key)) {
				return defaultValue;
			}
			return store.get(key) as T;
		},
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
		appendLines: vi
			.fn()
			.mockImplementation(() => Promise.resolve("a.jsonl")) as (
			sessionId: string,
			messages: ChatMessage[]
		) => Promise<string>,
		readLines: vi.fn().mockImplementation(() => Promise.resolve([])) as (
			sessionId: string,
			offset: number,
			limit: number
		) => Promise<ChatMessage[]>,
	};
}

/**
 * Fake webview panel capturing every postMessage and exposing a method to
 * inject incoming messages.
 */
interface FakePanelWebview {
	postMessage: ReturnType<typeof vi.fn>;
	onDidReceiveMessage: ReturnType<typeof vi.fn>;
	_injectMessage: (msg: unknown) => void;
	_listeners: Array<(msg: unknown) => void>;
}

type FakePanel = AgentChatPanelLike & {
	webview: FakePanelWebview;
	dispose: ReturnType<typeof vi.fn>;
	reveal: ReturnType<typeof vi.fn>;
	_fireDispose: () => void;
};

function createFakePanel(): FakePanel {
	const listeners: Array<(msg: unknown) => void> = [];
	const webview: FakePanelWebview = {
		postMessage: vi.fn().mockResolvedValue(true),
		onDidReceiveMessage: vi.fn((cb: (msg: unknown) => void) => {
			listeners.push(cb);
			return { dispose: NOOP };
		}),
		_injectMessage: (msg: unknown) => {
			for (const cb of listeners) {
				cb(msg);
			}
		},
		_listeners: listeners,
	};
	let disposer: (() => void) | undefined;
	const dispose = vi.fn(() => {
		disposer?.();
	});
	const reveal = vi.fn();
	const fakePanel: FakePanel = {
		viewType: "gatomia.agentChatPanel",
		webview,
		dispose: dispose as FakePanel["dispose"],
		reveal: reveal as FakePanel["reveal"],
		onDidDispose: (cb: () => void) => {
			disposer = cb;
			return { dispose: NOOP };
		},
		_fireDispose: () => disposer?.(),
	};
	return fakePanel;
}

/**
 * Fake runner used to assert that AgentChatPanel correctly routes protocol
 * messages. Behaviour:
 *   - submit(content): caller supplies a controlled resolution via
 *     `resolveNextSubmit()` or `rejectNextSubmit(err)`.
 */
type FakeRunner = AgentChatRunnerHandle & {
	submit: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
	retry: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
	resolveNextSubmit(): void;
	rejectNextSubmit(err: Error): void;
};

function createFakeRunner(sessionId: string): FakeRunner {
	const resolvers: Array<(value: void) => void> = [];
	const rejecters: Array<(err: unknown) => void> = [];
	const submit = vi.fn(
		(): Promise<void> =>
			new Promise<void>((resolve, reject) => {
				resolvers.push(resolve);
				rejecters.push(reject);
			})
	);
	const cancel = vi.fn((): Promise<void> => Promise.resolve());
	const retry = vi.fn((): Promise<string> => Promise.resolve("new-id"));
	const dispose = vi.fn();
	const runner: FakeRunner = {
		sessionId,
		submit: submit as FakeRunner["submit"],
		cancel: cancel as FakeRunner["cancel"],
		retry: retry as FakeRunner["retry"],
		dispose: dispose as FakeRunner["dispose"],
		resolveNextSubmit: () => {
			const next = resolvers.shift();
			rejecters.shift();
			next?.(undefined);
		},
		rejectNextSubmit: (err: Error) => {
			resolvers.shift();
			const next = rejecters.shift();
			next?.(err);
		},
	};
	return runner;
}

function testSession(
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id: "panel-session-1",
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "opencode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		lifecycleState: "waiting-for-input",
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		createdAt: 1000,
		updatedAt: 1000,
		workspaceUri: "file:///fake/workspace",
		...overrides,
	};
}

// ============================================================================
// Suite
// ============================================================================

describe("AgentChatPanel (T018 contract)", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let archive: AgentChatArchiveWriter;
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	let fakePanel: FakePanel;
	let runner: FakeRunner;
	let host: AgentChatPanelHost;

	beforeEach(() => {
		memento = createMockMemento();
		archive = createMockArchive();
		store = new AgentChatSessionStore({ workspaceState: memento, archive });
		registry = new AgentChatRegistry();
		fakePanel = createFakePanel();
		runner = createFakeRunner("panel-session-1");
		host = {
			createPanel: vi.fn().mockReturnValue(fakePanel),
		};
	});

	async function createPanelForSession(
		overrides: Partial<AgentChatSession> = {}
	): Promise<{ panel: AgentChatPanel; session: AgentChatSession }> {
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
		});
		await store.updateSession(seeded.id, overrides);
		const latest = (await store.getSession(seeded.id)) as AgentChatSession;
		registry.registerSession(latest);
		registry.attachRunner(latest.id, runner);
		const panel = new AgentChatPanel({
			session: latest,
			store,
			registry,
			host,
		});
		return { panel, session: latest };
	}

	function injectMessage(message: unknown): void {
		fakePanel.webview._injectMessage(message);
	}

	function postedMessages(): Array<{ type: string; payload: unknown }> {
		return fakePanel.webview.postMessage.mock.calls.map(
			(c) => c[0] as { type: string; payload: unknown }
		);
	}

	// ------------------------------------------------------------------
	// Hydration
	// ------------------------------------------------------------------

	describe("agent-chat/ready -> agent-chat/session/loaded", () => {
		it("sends session/loaded with the read-only projection on ready", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			injectMessage({
				type: "agent-chat/ready",
				payload: { sessionId: session.id },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			const loaded = postedMessages().find(
				(m) => m.type === "agent-chat/session/loaded"
			);
			expect(loaded).toBeDefined();
			const payload = loaded?.payload as {
				session: { id: string; isReadOnly: boolean };
				messages: unknown[];
			};
			expect(payload.session.id).toBe(session.id);
			expect(payload.session.isReadOnly).toBe(false);
			expect(Array.isArray(payload.messages)).toBe(true);
		});

		it("marks session as isReadOnly when source is cloud", async () => {
			const { panel } = await createPanelForSession({ source: "cloud" });
			panel.open();
			injectMessage({
				type: "agent-chat/ready",
				payload: { sessionId: "panel-session-1" },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			const loaded = postedMessages().find(
				(m) => m.type === "agent-chat/session/loaded"
			);
			const payload = loaded?.payload as { session: { isReadOnly: boolean } };
			expect(payload.session.isReadOnly).toBe(true);
		});
	});

	// ------------------------------------------------------------------
	// Input submission lifecycle
	// ------------------------------------------------------------------

	describe("agent-chat/input/submit", () => {
		it("routes the content to runner.submit and emits messages/appended (pending -> delivered)", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			injectMessage({
				type: "agent-chat/input/submit",
				payload: {
					sessionId: session.id,
					content: "hello",
					clientMessageId: "c-1",
				},
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(runner.submit).toHaveBeenCalledWith("hello");

			// Resolve submit successfully.
			runner.resolveNextSubmit();
			await new Promise((resolve) => setTimeout(resolve, 0));
			// We should have seen at least one messages/appended (the user
			// message with deliveryStatus=pending) and one messages/updated
			// (status → delivered).
			const messagesAppended = postedMessages().filter(
				(m) => m.type === "agent-chat/messages/appended"
			);
			const messagesUpdated = postedMessages().filter(
				(m) => m.type === "agent-chat/messages/updated"
			);
			expect(messagesAppended.length).toBeGreaterThanOrEqual(1);
			expect(messagesUpdated.length).toBeGreaterThanOrEqual(1);
		});

		it("rejects the submit with rejectionReason when runner throws 'queued|already'", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			injectMessage({
				type: "agent-chat/input/submit",
				payload: { sessionId: session.id, content: "x" },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			runner.rejectNextSubmit(
				new Error("a follow-up is already queued; wait for the current turn")
			);
			await new Promise((resolve) => setTimeout(resolve, 0));

			const updated = postedMessages()
				.filter((m) => m.type === "agent-chat/messages/updated")
				.map(
					(m) =>
						m.payload as {
							updates: Array<{
								patch: { deliveryStatus?: string; rejectionReason?: string };
							}>;
						}
				);
			const rejection = updated.find((u) =>
				u.updates.some((up) => up.patch.deliveryStatus === "rejected")
			);
			expect(rejection).toBeDefined();
		});

		it("rejects with a read-only reason on cloud sessions", async () => {
			const { panel, session } = await createPanelForSession({
				source: "cloud",
			});
			panel.open();
			injectMessage({
				type: "agent-chat/input/submit",
				payload: { sessionId: session.id, content: "can't do this" },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Runner.submit MUST NOT be invoked on a read-only session.
			expect(runner.submit).not.toHaveBeenCalled();

			const updated = postedMessages()
				.filter((m) => m.type === "agent-chat/messages/updated")
				.map(
					(m) =>
						m.payload as {
							updates: Array<{
								patch: {
									deliveryStatus?: string;
									rejectionReason?: string;
								};
							}>;
						}
				);
			const rejection = updated.find((u) =>
				u.updates.some((up) => up.patch.deliveryStatus === "rejected")
			);
			expect(rejection).toBeDefined();
		});
	});

	// ------------------------------------------------------------------
	// Cancel + retry routing
	// ------------------------------------------------------------------

	describe("control routing", () => {
		it("agent-chat/control/cancel forwards to runner.cancel", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			injectMessage({
				type: "agent-chat/control/cancel",
				payload: { sessionId: session.id },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(runner.cancel).toHaveBeenCalledTimes(1);
		});

		it("agent-chat/control/retry forwards to runner.retry", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			injectMessage({
				type: "agent-chat/control/retry",
				payload: { sessionId: session.id },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(runner.retry).toHaveBeenCalledTimes(1);
		});
	});

	// ------------------------------------------------------------------
	// Transcript change forwarding
	// ------------------------------------------------------------------

	describe("store -> webview forwarding", () => {
		it("forwards appendMessages mutations as agent-chat/messages/appended", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			// Allow onDidReceiveMessage/open side effects to flush.
			await new Promise((resolve) => setTimeout(resolve, 0));
			fakePanel.webview.postMessage.mockClear();

			await store.appendMessages(session.id, [
				{
					id: "m-agent-1",
					sessionId: session.id,
					timestamp: 2000,
					sequence: 0,
					role: "agent",
					content: "hi",
					turnId: "t-1",
					isTurnComplete: true,
				},
			]);
			await new Promise((resolve) => setTimeout(resolve, 0));

			const appended = postedMessages().find(
				(m) => m.type === "agent-chat/messages/appended"
			);
			expect(appended).toBeDefined();
		});
	});

	// ------------------------------------------------------------------
	// Lifecycle events
	// ------------------------------------------------------------------

	describe("lifecycle", () => {
		it("emits agent-chat/session/lifecycle-changed when the session transitions", async () => {
			const { panel, session } = await createPanelForSession();
			panel.open();
			await new Promise((resolve) => setTimeout(resolve, 0));
			fakePanel.webview.postMessage.mockClear();

			await store.updateSession(session.id, { lifecycleState: "completed" });
			await new Promise((resolve) => setTimeout(resolve, 0));

			const lifecycle = postedMessages().find(
				(m) => m.type === "agent-chat/session/lifecycle-changed"
			);
			expect(lifecycle).toBeDefined();
		});

		it("disposes cleanly on panel close", async () => {
			const { panel } = await createPanelForSession();
			panel.open();
			panel.dispose();
			expect(fakePanel.dispose).toHaveBeenCalled();
		});

		// Regression: spec 018 shipped a double-attach where
		// `AgentChatPanel.open()` registered the inner WebviewPanel with
		// the registry *and* the command handler attached its wrapper.
		// The second attach threw "session ... already has a panel" and
		// silently aborted new-session initialization. The panel must
		// NOT touch the registry's panel map directly — the command
		// handler is the sole owner of that mapping.
		it("does not call registry.attachPanel on open (handler owns attachment)", async () => {
			const attachSpy = vi.spyOn(registry, "attachPanel");
			const { panel } = await createPanelForSession();
			panel.open();
			expect(attachSpy).not.toHaveBeenCalled();
		});

		// Regression: the host wrapper exposed to the registry needs an
		// `onDidDispose` event so the registry can drop the
		// `panelsBySessionId` entry when the user closes the webview.
		// `AgentChatPanel.dispose()` must fire that event exactly once.
		it("fires onDidDispose when dispose() is called", async () => {
			const { panel } = await createPanelForSession();
			panel.open();
			let fired = 0;
			panel.onDidDispose(() => {
				fired += 1;
			});
			panel.dispose();
			expect(fired).toBe(1);
		});
	});
});
