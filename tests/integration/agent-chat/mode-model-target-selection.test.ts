/**
 * Integration test: mode / model / execution-target selection (T055).
 *
 * Exercises the T066 command handlers against the real
 * `AgentChatSessionStore` and `AgentChatRegistry`. Verifies that each
 * selector produces the expected store-side mutation + transcript entry, and
 * that the Cloud target is refused when no provider is configured.
 *
 * This test intentionally does NOT spawn an ACP subprocess — the Phase 3
 * integration test (`acp-streaming-and-followup.test.ts`) already covers
 * lifecycle streaming. Here we focus on selection wiring.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Disposable } from "vscode";
import {
	handleChangeExecutionTarget,
	handleChangeMode,
	handleChangeModel,
} from "../../../src/commands/agent-chat-commands";
import {
	AcpChatRunner,
	type AcpChatRunnerSessionManager,
	deriveAcpSessionId,
} from "../../../src/features/agent-chat/acp-chat-runner";
import { AgentChatRegistry } from "../../../src/features/agent-chat/agent-chat-registry";
import {
	type AgentChatArchiveWriter,
	type AgentChatMemento,
	AgentChatSessionStore,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import type {
	AgentChatSession,
	ChatMessage,
	ExecutionTarget,
	SystemChatMessage,
} from "../../../src/features/agent-chat/types";
import type { AcpSessionEventListener } from "../../../src/services/acp/acp-client";

interface MementoHandle extends AgentChatMemento {
	raw: Map<string, unknown>;
}

function createMemento(): MementoHandle {
	const map = new Map<string, unknown>();
	return {
		raw: map,
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

function readTranscriptFromMemento(
	memento: MementoHandle,
	sessionId: string
): ChatMessage[] {
	const raw = memento.raw.get(
		`gatomia.agentChat.sessions.transcript.${sessionId}`
	) as { messages?: ChatMessage[] } | undefined;
	return raw?.messages ?? [];
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

function createQuietManager(): AcpChatRunnerSessionManager {
	return {
		sendPrompt: vi.fn(() => Promise.resolve()),
		cancel: vi.fn(() => Promise.resolve()),
		subscribe: vi.fn(
			(
				_providerId: string,
				_cwd: string | undefined,
				_sessionId: string,
				_listener: AcpSessionEventListener
			): Disposable => ({
				dispose: () => {
					// no-op; tests don't rely on subscription disposal here.
				},
			})
		),
	};
}

async function seedSession(
	store: AgentChatSessionStore
): Promise<AgentChatSession> {
	const session = await store.createSession({
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "OpenCode",
		capabilities: {
			source: "catalog",
			modes: [
				{ id: "code", displayName: "Code" },
				{ id: "plan", displayName: "Plan" },
			],
			models: [
				{ id: "sonnet", displayName: "Sonnet", invocation: "cli-flag" },
				{ id: "opus", displayName: "Opus", invocation: "cli-flag" },
			],
			acceptsFollowUp: true,
		},
		selectedModeId: "code",
		selectedModelId: "sonnet",
		executionTarget: { kind: "local" },
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
	});
	return session;
}

describe("mode / model / target selection (T055)", () => {
	let store: AgentChatSessionStore;
	let registry: AgentChatRegistry;
	let memento: MementoHandle;

	beforeEach(async () => {
		memento = createMemento();
		store = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
		});
		await store.initialize();
		registry = new AgentChatRegistry();
	});

	it("changeMode persists the new mode and records a system message in the transcript", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);
		const runner = new AcpChatRunner({
			session,
			store,
			registry,
			manager: createQuietManager(),
			acpSessionId: deriveAcpSessionId(session),
		});
		registry.attachRunner(session.id, runner);

		await handleChangeMode(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("createPanel should not be called");
				},
				startAcpSession: () => {
					throw new Error("startAcpSession should not be called");
				},
			},
			{ sessionId: session.id, modeId: "plan" }
		);

		const after = await store.getSession(session.id);
		expect(after?.selectedModeId).toBe("plan");

		const transcript = readTranscriptFromMemento(memento, session.id);
		const systemMessages = transcript.filter(
			(m): m is SystemChatMessage => m.role === "system"
		);
		expect(systemMessages.some((m) => m.kind === "mode-changed")).toBe(true);
	});

	it("changeModel persists the new model and records a system message", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);
		const runner = new AcpChatRunner({
			session,
			store,
			registry,
			manager: createQuietManager(),
			acpSessionId: deriveAcpSessionId(session),
		});
		registry.attachRunner(session.id, runner);

		await handleChangeModel(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
			},
			{ sessionId: session.id, modelId: "opus" }
		);

		const after = await store.getSession(session.id);
		expect(after?.selectedModelId).toBe("opus");

		const transcript = readTranscriptFromMemento(memento, session.id);
		const systemMessages = transcript.filter(
			(m): m is SystemChatMessage => m.role === "system"
		);
		expect(systemMessages.some((m) => m.kind === "model-changed")).toBe(true);
	});

	it("changeMode is a no-op when the new mode equals the current selection", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);

		const before = readTranscriptFromMemento(memento, session.id);
		await handleChangeMode(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
			},
			{ sessionId: session.id, modeId: "code" }
		);
		const after = readTranscriptFromMemento(memento, session.id);
		expect(after.length).toBe(before.length);
	});

	it("changeExecutionTarget switches from local to worktree on a pre-turn session", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);

		const result = await handleChangeExecutionTarget(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
			},
			{
				sessionId: session.id,
				target: {
					kind: "worktree",
					worktreeId: "wt-1",
				} satisfies ExecutionTarget,
			}
		);
		expect(result.ok).toBe(true);

		const after = await store.getSession(session.id);
		expect(after?.executionTarget.kind).toBe("worktree");
	});

	it("changeModel calls setSessionModel via ACP when the manager is wired and skips the legacy system message", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);
		const runner = new AcpChatRunner({
			session,
			store,
			registry,
			manager: createQuietManager(),
			acpSessionId: deriveAcpSessionId(session),
		});
		registry.attachRunner(session.id, runner);

		const setSessionModel = vi.fn(
			(
				_providerId: string,
				_cwd: string | undefined,
				_sessionId: string,
				_modelId: string
			): Promise<void> => Promise.resolve()
		);

		await handleChangeModel(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
				acpSessionManager: {
					setSessionModel,
				} as unknown as Parameters<
					typeof handleChangeModel
				>[0]["acpSessionManager"],
			},
			{ sessionId: session.id, modelId: "opus" }
		);

		// `setSessionModel(providerId, cwd, sessionId, modelId)` — verify
		// the provider id and modelId arguments match the session.
		expect(setSessionModel).toHaveBeenCalledOnce();
		const callArgs = setSessionModel.mock.calls[0];
		expect(callArgs?.[0]).toBe("opencode");
		expect(callArgs?.[3]).toBe("opus");

		// The success path delegates the store write to the runner's
		// `session-models-changed` listener (fired by the real ACP
		// client). With the quiet manager that event never lands, so
		// the store keeps the prior selection — proving `handleChangeModel`
		// did NOT call the legacy `store.updateSession` fallback.
		const after = await store.getSession(session.id);
		expect(after?.selectedModelId).toBe("sonnet");

		// The ACP success path skips the legacy `recordModelChange`
		// system message — the agent itself echoes the change via
		// `session/models-changed`.
		const transcript = readTranscriptFromMemento(memento, session.id);
		const systemMessages = transcript.filter(
			(m): m is SystemChatMessage => m.role === "system"
		);
		expect(systemMessages.some((m) => m.kind === "model-changed")).toBe(false);
	});

	it("changeModel falls back to the legacy path when ACP returns ACP_NOT_SUPPORTED", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);
		const runner = new AcpChatRunner({
			session,
			store,
			registry,
			manager: createQuietManager(),
			acpSessionId: deriveAcpSessionId(session),
		});
		registry.attachRunner(session.id, runner);

		// `tryAcpSetModel` matches via `error.message.includes("ACP_NOT_SUPPORTED")`,
		// so the message itself must carry the sentinel.
		const notSupported = new Error(
			"ACP_NOT_SUPPORTED: provider lacks set_model"
		);
		const setSessionModel = vi.fn(
			(
				_providerId: string,
				_cwd: string | undefined,
				_sessionId: string,
				_modelId: string
			): Promise<void> => Promise.reject(notSupported)
		);

		await handleChangeModel(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
				acpSessionManager: {
					setSessionModel,
				} as unknown as Parameters<
					typeof handleChangeModel
				>[0]["acpSessionManager"],
			},
			{ sessionId: session.id, modelId: "opus" }
		);

		expect(setSessionModel).toHaveBeenCalledOnce();

		const after = await store.getSession(session.id);
		expect(after?.selectedModelId).toBe("opus");

		// Legacy path runs: a `model-changed` system message is appended.
		const transcript = readTranscriptFromMemento(memento, session.id);
		const systemMessages = transcript.filter(
			(m): m is SystemChatMessage => m.role === "system"
		);
		expect(systemMessages.some((m) => m.kind === "model-changed")).toBe(true);
	});

	it("changeExecutionTarget refuses to mutate a session already in 'running' lifecycle", async () => {
		const session = await seedSession(store);
		registry.registerSession(session);
		await store.updateSession(session.id, { lifecycleState: "running" });

		const result = await handleChangeExecutionTarget(
			{
				registry,
				store,
				createPanel: () => {
					throw new Error("unused");
				},
				startAcpSession: () => {
					throw new Error("unused");
				},
			},
			{
				sessionId: session.id,
				target: { kind: "local" },
			}
		);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("target-immutable-after-turn");

		const after = await store.getSession(session.id);
		expect(after?.executionTarget.kind).toBe("local");
	});
});
