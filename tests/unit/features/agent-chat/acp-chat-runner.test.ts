/**
 * AcpChatRunner unit tests.
 *
 * TDD (Constitution III): red before T027a + T027b.
 *
 * Coverage matrix (tasks.md T019):
 *   - Session lifecycle: initializing -> running -> waiting-for-input -> completed
 *     and error paths to failed
 *   - Stream events map to AgentChatEvent correctly
 *   - submit(userMessage) forwards to AcpClient.sendPrompt with the correct cwd
 *   - Follow-up queueing when a turn is in flight
 *   - Retry creates a new session id
 *   - Cancel routes to AcpClient.cancel
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Disposable } from "vscode";
import {
	AcpChatRunner,
	type AcpChatRunnerOptions,
} from "../../../../src/features/agent-chat/acp-chat-runner";
import { AgentChatRegistry } from "../../../../src/features/agent-chat/agent-chat-registry";
import { AgentChatSessionStore } from "../../../../src/features/agent-chat/agent-chat-session-store";
import type {
	AgentChatArchiveWriter,
	AgentChatMemento,
} from "../../../../src/features/agent-chat/agent-chat-session-store";
import type {
	AgentChatSession,
	ChatMessage,
} from "../../../../src/features/agent-chat/types";
import type {
	AcpSessionEvent,
	AcpSessionEventListener,
} from "../../../../src/services/acp/acp-client";

// Top-level regex (biome lint/performance/useTopLevelRegex).
const ALREADY_QUEUED_REGEX = /queued|already/i;

// ============================================================================
// Test fakes
// ============================================================================

type MockMemento = AgentChatMemento & {
	_store: Map<string, unknown>;
};

function createMockMemento(): MockMemento {
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
			.mockImplementation(() => Promise.resolve("archive.jsonl")) as (
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
 * Fake subscription-capable ACP session manager. Tests drive events via
 * `emit()`. `sendPrompt` resolves deterministically unless `failNext` is set.
 */
interface FakeSessionManager {
	sendPrompt: ReturnType<typeof vi.fn>;
	cancel: ReturnType<typeof vi.fn>;
	subscribe: ReturnType<typeof vi.fn>;
	/** Drive an event to every active listener for the given ACP session id. */
	emit(sessionId: string, event: AcpSessionEvent): void;
	/** Throw on the next sendPrompt call (to test error paths). */
	failNext(error: Error): void;
	/** Resolve a pending sendPrompt call (simulates turn completion). */
	resolvePendingSend(): void;
	/** Inspect how many sendPrompt calls are still pending. */
	pendingSendCount(): number;
}

function createFakeSessionManager(): FakeSessionManager {
	const listenersBySessionId = new Map<string, Set<AcpSessionEventListener>>();
	let nextSendError: Error | undefined;
	const pending: Array<(value: void) => void> = [];

	return {
		sendPrompt: vi.fn(
			(
				_providerId: string,
				_cwd: string | undefined,
				_sessionId: string,
				_prompt: string
			): Promise<void> => {
				if (nextSendError) {
					const err = nextSendError;
					nextSendError = undefined;
					return Promise.reject(err);
				}
				return new Promise<void>((resolve) => {
					pending.push(resolve);
				});
			}
		),
		cancel: vi.fn(
			(
				_providerId: string,
				_cwd: string | undefined,
				_sessionId: string
			): Promise<void> => Promise.resolve()
		),
		subscribe: vi.fn(
			(
				_providerId: string,
				_cwd: string | undefined,
				sessionId: string,
				listener: AcpSessionEventListener
			): Disposable => {
				let bucket = listenersBySessionId.get(sessionId);
				if (!bucket) {
					bucket = new Set();
					listenersBySessionId.set(sessionId, bucket);
				}
				bucket.add(listener);
				return {
					dispose: () => {
						bucket?.delete(listener);
					},
				};
			}
		),
		emit(sessionId: string, event: AcpSessionEvent): void {
			const bucket = listenersBySessionId.get(sessionId);
			if (!bucket) {
				return;
			}
			for (const listener of [...bucket]) {
				listener(event);
			}
		},
		failNext(error: Error): void {
			nextSendError = error;
		},
		resolvePendingSend(): void {
			const resolver = pending.shift();
			resolver?.(undefined);
		},
		pendingSendCount(): number {
			return pending.length;
		},
	};
}

function baseSession(
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id: "runner-session-1",
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "opencode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		lifecycleState: "initializing",
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

describe("AcpChatRunner (T019)", () => {
	let memento: MockMemento;
	let archive: AgentChatArchiveWriter;
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	let manager: FakeSessionManager;

	beforeEach(() => {
		memento = createMockMemento();
		archive = createMockArchive();
		store = new AgentChatSessionStore({ workspaceState: memento, archive });
		registry = new AgentChatRegistry();
		manager = createFakeSessionManager();
	});

	async function seedSession(): Promise<AgentChatSession> {
		const session = await store.createSession({
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
		registry.registerSession(session);
		return session;
	}

	function makeRunner(
		session: AgentChatSession,
		overrides: Partial<AcpChatRunnerOptions> = {}
	): AcpChatRunner {
		return new AcpChatRunner({
			session,
			store,
			registry,
			manager: manager as unknown as AcpChatRunnerOptions["manager"],
			acpSessionId: "acp-session-1",
			...overrides,
		});
	}

	describe("lifecycle transitions", () => {
		it("starts in initializing, transitions to running on start()", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);

			runner.start("initial prompt");
			// Allow microtasks to flush
			await Promise.resolve();

			const current = await store.getSession(session.id);
			expect(current?.lifecycleState).toBe("running");
		});

		it("transitions to waiting-for-input after turn-finished with end_turn", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			const startPromise = runner.start("hello");
			await new Promise((resolve) => setTimeout(resolve, 0));

			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "end_turn",
				at: 100,
			});
			manager.resolvePendingSend();
			await startPromise;

			const current = await store.getSession(session.id);
			expect(current?.lifecycleState).toBe("waiting-for-input");
		});

		it("transitions to failed when the manager rejects sendPrompt", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			manager.failNext(new Error("acp handshake failed"));

			await runner.start("hello");

			const current = await store.getSession(session.id);
			expect(current?.lifecycleState).toBe("failed");
		});

		it("dispose is idempotent", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			const startPromise = runner.start("hello");
			await new Promise((resolve) => setTimeout(resolve, 0));
			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "end_turn",
				at: 100,
			});
			manager.resolvePendingSend();
			await startPromise;
			runner.dispose();
			runner.dispose();
			expect(() => runner.dispose()).not.toThrow();
		});
	});

	describe("event stream mapping", () => {
		it("maps agent-message-chunk to an AgentChatMessage appended to the transcript", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			manager.emit("acp-session-1", {
				kind: "agent-message-chunk",
				text: "assistant reply",
				at: 100,
			});
			// Event fanout is synchronous but the store's writes are async.
			await new Promise((resolve) => setTimeout(resolve, 0));

			const file = memento._store.get(
				`gatomia.agentChat.sessions.transcript.${session.id}`
			) as { messages: ChatMessage[] };
			const agentMsg = file.messages.find((m) => m.role === "agent");
			expect(agentMsg).toBeDefined();
			expect((agentMsg as { content: string }).content).toContain(
				"assistant reply"
			);
		});

		it("maps tool-call / tool-call-update to a ToolCallChatMessage", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			manager.emit("acp-session-1", {
				kind: "tool-call",
				toolCallId: "tc-1",
				title: "Run tests",
				status: "pending",
				at: 100,
			});
			manager.emit("acp-session-1", {
				kind: "tool-call-update",
				toolCallId: "tc-1",
				status: "succeeded",
				at: 200,
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			const file = memento._store.get(
				`gatomia.agentChat.sessions.transcript.${session.id}`
			) as { messages: ChatMessage[] };
			const toolMsg = file.messages.find((m) => m.role === "tool") as
				| { status: string }
				| undefined;
			expect(toolMsg).toBeDefined();
			expect(toolMsg?.status).toBe("succeeded");
		});

		it("maps agent-thought-chunk events into a coalesced ThoughtChatMessage", async () => {
			// The runner appends one thought entry on the first chunk and
			// then patches the same message in place as more chunks arrive,
			// so the transcript stays at exactly one thought per turn.
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			manager.emit("acp-session-1", {
				kind: "agent-thought-chunk",
				text: "Considering ",
				at: 50,
			});
			manager.emit("acp-session-1", {
				kind: "agent-thought-chunk",
				text: "options.",
				at: 60,
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			const file = memento._store.get(
				`gatomia.agentChat.sessions.transcript.${session.id}`
			) as { messages: ChatMessage[] };
			const thoughts = file.messages.filter(
				(m) => m.role === "thought"
			) as Array<{ content: string; isTurnComplete: boolean }>;
			expect(thoughts).toHaveLength(1);
			expect(thoughts[0]?.content).toBe("Considering options.");
			expect(thoughts[0]?.isTurnComplete).toBe(false);
		});

		it("flips ThoughtChatMessage.isTurnComplete to true on turn-finished", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			manager.emit("acp-session-1", {
				kind: "agent-thought-chunk",
				text: "All clear.",
				at: 50,
			});
			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "end_turn",
				at: 100,
			});
			manager.resolvePendingSend();
			await new Promise((resolve) => setTimeout(resolve, 0));

			const file = memento._store.get(
				`gatomia.agentChat.sessions.transcript.${session.id}`
			) as { messages: ChatMessage[] };
			const thought = file.messages.find((m) => m.role === "thought") as
				| { isTurnComplete: boolean }
				| undefined;
			expect(thought?.isTurnComplete).toBe(true);
		});

		it("maps plan-update events into a PlanChatMessage and patches it in place", async () => {
			// Plans are idempotent — every `plan-update` REPLACES the
			// entries list. The runner must keep a single plan message
			// per turn rather than appending duplicates.
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			manager.emit("acp-session-1", {
				kind: "plan-update",
				entries: [
					{ content: "Read repo", status: "pending" },
					{ content: "Write code", status: "pending" },
				],
				at: 50,
			});
			manager.emit("acp-session-1", {
				kind: "plan-update",
				entries: [
					{ content: "Read repo", status: "completed" },
					{ content: "Write code", status: "in_progress", priority: "high" },
				],
				at: 60,
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			const file = memento._store.get(
				`gatomia.agentChat.sessions.transcript.${session.id}`
			) as { messages: ChatMessage[] };
			const plans = file.messages.filter((m) => m.role === "plan") as Array<{
				entries: ReadonlyArray<{ status: string }>;
			}>;
			expect(plans).toHaveLength(1);
			expect(plans[0]?.entries).toHaveLength(2);
			expect(plans[0]?.entries[0]?.status).toBe("completed");
			expect(plans[0]?.entries[1]?.status).toBe("in_progress");
		});

		it("maps error events to an ErrorChatMessage marked retryable", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			manager.emit("acp-session-1", {
				kind: "error",
				message: "network dropped",
				at: 100,
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			const file = memento._store.get(
				`gatomia.agentChat.sessions.transcript.${session.id}`
			) as { messages: ChatMessage[] };
			const errMsg = file.messages.find((m) => m.role === "error") as
				| { retryable: boolean }
				| undefined;
			expect(errMsg).toBeDefined();
			expect(errMsg?.retryable).toBe(true);
		});
	});

	describe("submit / follow-up queue", () => {
		it("submit forwards to sendPrompt when session is waiting-for-input", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			const firstStart = runner.start("first prompt");
			await new Promise((resolve) => setTimeout(resolve, 0));
			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "end_turn",
				at: 100,
			});
			manager.resolvePendingSend();
			await firstStart;

			const submitPromise = runner.submit("follow-up");
			await new Promise((resolve) => setTimeout(resolve, 0));
			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "end_turn",
				at: 200,
			});
			manager.resolvePendingSend();
			await submitPromise;

			// First call = initial prompt, second = follow-up.
			expect(manager.sendPrompt).toHaveBeenCalledTimes(2);
			expect(manager.sendPrompt.mock.calls[1][3]).toBe("follow-up");
		});

		it("queues a follow-up while a turn is in flight and delivers it on turn completion", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			const startPromise = runner.start("first prompt");
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Session is running, turn still in flight. Submit a follow-up.
			await runner.submit("second prompt");

			// Should be queued — not yet forwarded.
			expect(manager.sendPrompt).toHaveBeenCalledTimes(1);

			// Turn 1 finishes — should dispatch the queued follow-up.
			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "end_turn",
				at: 100,
			});
			manager.resolvePendingSend();
			await startPromise;
			// Let the queued follow-up's microtask chain flush.
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(manager.sendPrompt).toHaveBeenCalledTimes(2);
			expect(manager.sendPrompt.mock.calls[1][3]).toBe("second prompt");
		});

		it("rejects a second queued follow-up while another is already queued", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("first").catch(() => {
				// Left hanging intentionally — test focuses on the submit path.
			});
			await new Promise((resolve) => setTimeout(resolve, 0));
			// Turn in flight; queue one follow-up.
			await runner.submit("queued-1");
			// Try to queue another. Contract §4.2: at most one queued follow-up.
			await expect(runner.submit("queued-2")).rejects.toThrowError(
				ALREADY_QUEUED_REGEX
			);
		});
	});

	describe("retry and cancel", () => {
		it("retry() creates a new session id while preserving mode/model/target", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			const startPromise = runner.start("hello");
			await new Promise((resolve) => setTimeout(resolve, 0));
			manager.emit("acp-session-1", {
				kind: "turn-finished",
				stopReason: "refusal",
				at: 100,
			});
			manager.resolvePendingSend();
			await startPromise;

			const freshSessionId = await runner.retry();
			expect(freshSessionId).not.toBe(session.id);

			const fresh = await store.getSession(freshSessionId);
			expect(fresh?.executionTarget.kind).toBe(session.executionTarget.kind);
			expect(fresh?.agentId).toBe(session.agentId);
		});

		it("cancel() routes to manager.cancel with the current ACP session id", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello").catch(() => {
				// Test only inspects the cancel side-effect.
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			await runner.cancel();

			// Local executionTarget -> cwd is undefined (defers to manager's ctor cwd).
			expect(manager.cancel).toHaveBeenCalledWith(
				session.agentId,
				undefined,
				"acp-session-1"
			);
		});

		it("cancel() transitions lifecycle to cancelled", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello").catch(() => {
				// Test only inspects the cancel side-effect.
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			await runner.cancel();

			const current = await store.getSession(session.id);
			expect(current?.lifecycleState).toBe("cancelled");
		});
	});

	describe("subscribe wiring", () => {
		it("subscribes to the manager with (providerId, cwd, acpSessionId)", async () => {
			const session = await seedSession();
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			expect(manager.subscribe).toHaveBeenCalledTimes(1);
			const [providerId, cwd, acpSessionId] = manager.subscribe.mock.calls[0];
			expect(providerId).toBe(session.agentId);
			expect(acpSessionId).toBe("acp-session-1");
			// cwd is undefined for local executionTarget (manager defaults).
			expect(cwd).toBeUndefined();
		});

		it("passes worktree cwd when executionTarget.kind === 'worktree'", async () => {
			const session = await seedSession();
			session.executionTarget = { kind: "worktree", worktreeId: "wt-1" };
			session.worktree = {
				id: "wt-1",
				absolutePath: "/fake/workspace/.gatomia/worktrees/wt-1",
				branchName: "gatomia/agent-chat/wt-1",
				baseCommitSha: "abc",
				status: "created",
				createdAt: 1000,
			};
			const runner = makeRunner(session);
			runner.start("hello");
			await Promise.resolve();

			const [, cwd] = manager.subscribe.mock.calls[0];
			expect(cwd).toBe("/fake/workspace/.gatomia/worktrees/wt-1");
		});
	});
});
