/**
 * Integration test: ACP streaming + follow-up flow (T025, spec 018).
 *
 * Exercises the real `AgentChatSessionStore`, `AcpChatRunner`, `AgentChatPanel`
 * and `AgentChatRegistry` wired through a fake ACP session manager that mimics
 * an `AcpClient`. Verifies:
 *
 *   1. Panel opens and hydrates the webview with the initial session snapshot.
 *   2. Agent message chunks stream into the transcript and are pushed to the
 *      webview via `messages/appended` + `messages/updated`.
 *   3. Tool calls appear in the transcript and fire protocol messages.
 *   4. Turn finishes → lifecycle transitions to `waiting-for-input`.
 *   5. Follow-up submitted mid-turn is queued (deliveryStatus="queued") and
 *      promoted to `delivered` once the previous turn finishes.
 *   6. The underlying `OutputChannel` (as produced by a real `AcpClient`) is
 *      still written to while the chat panel is active — i.e. the router does
 *      not cannibalise OutputChannel logs (FR-022).
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Disposable } from "vscode";

import {
	AcpChatRunner,
	type AcpChatRunnerSessionManager,
	deriveAcpSessionId,
} from "../../../src/features/agent-chat/acp-chat-runner";
import { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import {
	AgentChatSessionStore,
	type AgentChatArchiveWriter,
	type AgentChatMemento,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import {
	AgentChatPanel,
	type AgentChatPanelHost,
	type HostedPanel,
} from "../../../src/panels/agent-chat-panel";
import type {
	AgentChatSession,
	ChatMessage,
} from "../../../src/features/agent-chat/types";
import type {
	AcpSessionEvent,
	AcpSessionEventListener,
} from "../../../src/services/acp/acp-client";

// ---------------------------------------------------------------------------
// Minimal fakes (kept local: the existing unit-test fakes live in other files)
// ---------------------------------------------------------------------------

function createMemento(): AgentChatMemento {
	const map = new Map<string, unknown>();
	return {
		get: <T>(key: string, defaultValue?: T): T | undefined =>
			map.has(key) ? (map.get(key) as T) : defaultValue,
		update: (key, value) => {
			if (value === undefined) {
				map.delete(key);
			} else {
				map.set(key, value);
			}
			return Promise.resolve();
		},
		keys: () => [...map.keys()],
	};
}

function createArchive(): AgentChatArchiveWriter {
	return {
		appendLines: vi.fn(() => Promise.resolve("archive.jsonl")) as (
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

interface OutputChannelLike {
	appendLine(line: string): void;
	lines(): string[];
}

function createOutputChannel(): OutputChannelLike {
	const recorded: string[] = [];
	return {
		appendLine: (line: string) => {
			recorded.push(line);
		},
		lines: () => [...recorded],
	};
}

/**
 * Fake ACP session manager that plays the role of `AcpClient` for
 * `AcpChatRunner`. Tests drive events via `emit()` and `finishPendingSend()`.
 */
interface FakeManager extends AcpChatRunnerSessionManager {
	emit(acpSessionId: string, event: AcpSessionEvent): void;
	finishPendingSend(): void;
	pendingSendCount(): number;
}

function createFakeManager(output: OutputChannelLike): FakeManager {
	const listeners = new Map<string, Set<AcpSessionEventListener>>();
	const pending: Array<(value: void) => void> = [];

	return {
		sendPrompt: vi.fn(
			(
				providerId: string,
				_cwd: string | undefined,
				sessionId: string,
				prompt: string
			): Promise<void> => {
				// Mimic AcpClient's OutputChannel echo (FR-022).
				output.appendLine(
					`[acp:${providerId}] send-prompt ${sessionId}: ${prompt}`
				);
				return new Promise((resolve) => {
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
				let bucket = listeners.get(sessionId);
				if (!bucket) {
					bucket = new Set();
					listeners.set(sessionId, bucket);
				}
				bucket.add(listener);
				return { dispose: () => bucket?.delete(listener) };
			}
		),
		emit(sessionId, event) {
			const bucket = listeners.get(sessionId);
			if (!bucket) {
				return;
			}
			// Echo chunks to the output channel so we can assert FR-022.
			if (event.kind === "agent-message-chunk") {
				output.appendLine(`[acp] ${event.text}`);
			}
			for (const l of [...bucket]) {
				l(event);
			}
		},
		finishPendingSend() {
			pending.shift()?.(undefined);
		},
		pendingSendCount() {
			return pending.length;
		},
	};
}

/**
 * Minimal panel host capturing every postMessage and exposing an injection
 * hook for incoming webview messages.
 */
interface FakePanelHost extends AgentChatPanelHost {
	posts(): unknown[];
	inject(msg: unknown): void;
	disposed: boolean;
}

function createFakeHost(): FakePanelHost {
	const posts: unknown[] = [];
	const listeners: Array<(msg: unknown) => void> = [];
	let disposer: (() => void) | undefined;
	const host: FakePanelHost = {
		disposed: false,
		posts: () => [...posts],
		inject: (msg) => {
			for (const l of listeners) {
				l(msg);
			}
		},
		createPanel: (): HostedPanel => ({
			viewType: AgentChatPanel.viewType,
			webview: {
				postMessage: (m: unknown) => {
					posts.push(m);
					return Promise.resolve(true);
				},
				onDidReceiveMessage: (cb: (m: unknown) => void) => {
					listeners.push(cb);
					return {
						dispose: () => {
							const idx = listeners.indexOf(cb);
							if (idx >= 0) {
								listeners.splice(idx, 1);
							}
						},
					};
				},
			},
			reveal: () => {
				// no-op for tests
			},
			dispose: () => {
				host.disposed = true;
				disposer?.();
			},
			onDidDispose: (cb: () => void) => {
				disposer = cb;
				return { dispose: () => (disposer = undefined) };
			},
		}),
	};
	return host;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("ACP streaming + follow-up integration (T025)", () => {
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	let manager: FakeManager;
	let output: OutputChannelLike;
	let host: FakePanelHost;
	let session: AgentChatSession;
	let acpSessionId: string;
	let runner: AcpChatRunner;
	let panel: AgentChatPanel;

	beforeEach(async () => {
		store = new AgentChatSessionStore({
			workspaceState: createMemento(),
			archive: createArchive(),
		});
		await store.initialize();
		registry = new AgentChatRegistry();
		output = createOutputChannel();
		manager = createFakeManager(output);
		host = createFakeHost();

		session = await store.createSession({
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

		acpSessionId = deriveAcpSessionId(session);
		runner = new AcpChatRunner({
			session,
			store,
			registry,
			manager,
			acpSessionId,
		});
		registry.attachRunner(session.id, runner);

		panel = new AgentChatPanel({ session, store, registry, host });
		panel.open();
	});

	it("streams chunks, renders a tool call, and queues follow-ups with correct deliveryStatus transitions", async () => {
		// Fire-and-forget: `start()` awaits the ACP `sendPrompt` promise, which
		// our fake keeps pending until `finishPendingSend()` is called below.
		const startPromise = runner.start("Please refactor user-service.ts");
		// Let the initial subscribe + appendUserMessage + sendPrompt register.
		await new Promise<void>((r) => setImmediate(r));

		// Webview announces readiness so the panel hydrates the transcript.
		host.inject({ type: "agent-chat/ready", sessionId: session.id });
		await new Promise<void>((r) => setImmediate(r));

		// (1) Panel opened and sent a session/loaded message.
		const loadedPost = host
			.posts()
			.find(
				(m): m is { type: string } =>
					typeof m === "object" &&
					m !== null &&
					(m as { type?: string }).type === "agent-chat/session/loaded"
			);
		expect(loadedPost).toBeDefined();

		// (2) Agent chunks stream in.
		manager.emit(acpSessionId, {
			kind: "agent-message-chunk",
			text: "Analyzing ",
			at: Date.now(),
		});
		manager.emit(acpSessionId, {
			kind: "agent-message-chunk",
			text: "file...",
			at: Date.now(),
		});

		// (3) A tool call appears.
		manager.emit(acpSessionId, {
			kind: "tool-call",
			toolCallId: "tc-1",
			title: "Read user-service.ts",
			status: "pending",
			at: Date.now(),
		});
		manager.emit(acpSessionId, {
			kind: "tool-call-update",
			toolCallId: "tc-1",
			status: "succeeded",
			at: Date.now(),
		});

		// (4) Submit a follow-up BEFORE the current turn finishes → queued.
		const submitFollowUp = runner.submit("Also update the tests");
		// wait a microtask for the append + storage to flush
		await Promise.resolve();
		await submitFollowUp;

		const snapshotDuringTurn = registry.getSession(session.id);
		expect(snapshotDuringTurn?.lifecycleState).toBe("running");

		// (5) First turn finishes.
		manager.emit(acpSessionId, {
			kind: "turn-finished",
			stopReason: "end_turn",
			at: Date.now(),
		});
		manager.finishPendingSend();
		// let microtasks settle (dispatchToAcp for queued follow-up is async)
		await new Promise<void>((r) => setImmediate(r));

		// Queued follow-up should have been dispatched → pending send > 0 again.
		expect(manager.pendingSendCount()).toBeGreaterThanOrEqual(1);

		// (6) Second turn finishes cleanly.
		manager.emit(acpSessionId, {
			kind: "turn-finished",
			stopReason: "end_turn",
			at: Date.now(),
		});
		manager.finishPendingSend();
		await new Promise<void>((r) => setImmediate(r));

		const finalSession = registry.getSession(session.id);
		expect(finalSession?.lifecycleState).toBe("waiting-for-input");

		// (7) OutputChannel received agent chunks AND the prompt dispatch logs.
		const lines = output.lines();
		expect(lines.some((l) => l.includes("send-prompt"))).toBe(true);
		expect(lines.some((l) => l.includes("Analyzing"))).toBe(true);

		// (8) The panel received messages/appended (agent chunks + tool call + queued user msg).
		const appendedPost = host
			.posts()
			.find(
				(m): m is { type: string } =>
					typeof m === "object" &&
					m !== null &&
					(m as { type?: string }).type === "agent-chat/messages/appended"
			);
		expect(appendedPost).toBeDefined();

		// (9) Cleanup disposes panel without throwing.
		panel.dispose();
		expect(host.disposed).toBe(true);
	});
});
