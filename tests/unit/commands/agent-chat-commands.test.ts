/**
 * Unit tests for `src/commands/agent-chat-commands.ts` (T038, spec 018).
 *
 * TDD red: these tests exercise the pure handler functions that the
 * command registrations call into, so they do not require a running
 * VS Code host.
 */

import { describe, expect, it, vi } from "vitest";
import {
	AGENT_CHAT_COMMANDS,
	type AgentChatCommandsDeps,
	handleCancel,
	handleOpenForSession,
	handleStartNew,
} from "../../../src/commands/agent-chat-commands";
import type { AgentChatSession } from "../../../src/features/agent-chat/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id: "sess-1",
		source: "acp",
		agentId: "claude-code",
		agentDisplayName: "Claude Code",
		capabilities: {
			source: "agent",
			modes: [],
			models: [],
			acceptsFollowUp: true,
		},
		executionTarget: { kind: "local" },
		lifecycleState: "running",
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		createdAt: 1,
		updatedAt: 1,
		workspaceUri: "file:///tmp/ws",
		...overrides,
	};
}

function makeDeps(overrides: Partial<AgentChatCommandsDeps> = {}) {
	const runner = {
		sessionId: "sess-1",
		cancel: vi.fn(() => Promise.resolve()),
		dispose: vi.fn(),
		submit: vi.fn(() => Promise.resolve()),
		retry: vi.fn(() => Promise.resolve("sess-2")),
	};
	const panel = {
		sessionId: "sess-1",
		reveal: vi.fn(),
		dispose: vi.fn(),
	};
	const registry = {
		getSession: vi.fn(() => makeSession()),
		getRunner: vi.fn(() => runner),
		getPanel: vi.fn(() => undefined as typeof panel | undefined),
		focusPanel: vi.fn(() => false),
		registerSession: vi.fn(),
		attachRunner: vi.fn(),
		attachPanel: vi.fn(),
	};
	const store = {
		listNonTerminal: vi.fn(() => []),
		getSession: vi.fn((_id: string) => makeSession()),
	};
	const panelFactory = vi.fn(() => panel);
	const startAcpSession = vi.fn((_input) =>
		Promise.resolve({
			session: makeSession({ id: "sess-new" }),
			runner: { ...runner, sessionId: "sess-new" },
		})
	);

	const deps: AgentChatCommandsDeps = {
		registry: registry as unknown as AgentChatCommandsDeps["registry"],
		store: store as unknown as AgentChatCommandsDeps["store"],
		createPanel:
			panelFactory as unknown as AgentChatCommandsDeps["createPanel"],
		startAcpSession:
			startAcpSession as unknown as AgentChatCommandsDeps["startAcpSession"],
		...overrides,
	};

	return {
		deps,
		registry,
		store,
		runner,
		panel,
		panelFactory,
		startAcpSession,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("agent-chat-commands (T038)", () => {
	describe("AGENT_CHAT_COMMANDS constants", () => {
		it("declares the three US1 command ids", () => {
			expect(AGENT_CHAT_COMMANDS.START_NEW).toBe("gatomia.agentChat.startNew");
			expect(AGENT_CHAT_COMMANDS.OPEN_FOR_SESSION).toBe(
				"gatomia.agentChat.openForSession"
			);
			expect(AGENT_CHAT_COMMANDS.CANCEL).toBe("gatomia.agentChat.cancel");
		});
	});

	describe("handleStartNew", () => {
		it("creates an ACP session, registers it, attaches a panel, and reveals it", async () => {
			const { deps, registry, startAcpSession, panelFactory, panel } =
				makeDeps();

			await handleStartNew(deps, {
				agentId: "claude-code",
				agentDisplayName: "Claude Code",
				agentCommand: "claude --acp",
				mode: "chat",
				taskInstruction: "hello",
			});

			expect(startAcpSession).toHaveBeenCalledTimes(1);
			expect(registry.registerSession).toHaveBeenCalledTimes(1);
			expect(registry.attachRunner).toHaveBeenCalledTimes(1);
			expect(panelFactory).toHaveBeenCalledTimes(1);
			expect(registry.attachPanel).toHaveBeenCalledTimes(1);
			expect(panel.reveal).toHaveBeenCalledTimes(1);
		});
	});

	describe("handleOpenForSession", () => {
		it("focuses an existing panel if one is attached to the session", async () => {
			const { deps, registry, panelFactory } = makeDeps();
			registry.focusPanel.mockReturnValue(true);

			await handleOpenForSession(deps, "sess-1");

			expect(registry.focusPanel).toHaveBeenCalledWith("sess-1");
			expect(panelFactory).not.toHaveBeenCalled();
		});

		it("creates and attaches a new panel when the session has no panel", async () => {
			const { deps, registry, panelFactory, panel } = makeDeps();
			registry.focusPanel.mockReturnValue(false);

			await handleOpenForSession(deps, "sess-1");

			expect(panelFactory).toHaveBeenCalledTimes(1);
			expect(registry.attachPanel).toHaveBeenCalledTimes(1);
			expect(panel.reveal).toHaveBeenCalledTimes(1);
		});

		it("does nothing if the session id is unknown to both the registry and the store", async () => {
			const { deps, registry, store, panelFactory } = makeDeps();
			registry.getSession.mockReturnValueOnce(undefined as never);
			store.getSession.mockReturnValueOnce(undefined as never);

			await handleOpenForSession(deps, "missing");

			expect(panelFactory).not.toHaveBeenCalled();
			expect(registry.focusPanel).not.toHaveBeenCalled();
		});

		it("falls back to the store when the registry has no session (restart-restore case, T047)", async () => {
			const { deps, registry, store, panelFactory } = makeDeps();
			registry.getSession.mockReturnValueOnce(undefined as never);
			registry.focusPanel.mockReturnValue(false);

			await handleOpenForSession(deps, "restored-session");

			expect(store.getSession).toHaveBeenCalledWith("restored-session");
			expect(registry.registerSession).toHaveBeenCalledTimes(1);
			expect(panelFactory).toHaveBeenCalledTimes(1);
		});
	});

	describe("handleCancel", () => {
		it("cancels the runner associated with the session id", async () => {
			const { deps, runner } = makeDeps();

			await handleCancel(deps, "sess-1");

			expect(runner.cancel).toHaveBeenCalledTimes(1);
		});

		it("is a no-op when the session has no active runner", async () => {
			const { deps, registry, runner } = makeDeps();
			registry.getRunner.mockReturnValueOnce(undefined as never);

			await handleCancel(deps, "sess-1");

			expect(runner.cancel).not.toHaveBeenCalled();
		});
	});
});
