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
	coerceSessionIdArg,
	handleCancel,
	handleOpenForSession,
	handleStartNew,
} from "../../../src/commands/agent-chat-commands";
import type { CapWarningDecision } from "../../../src/features/agent-chat/cap-warning-prompt";
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

		// ----- T073/T073a/T076: concurrent-cap enforcement -----

		it("short-circuits without starting when the user aborts at the cap prompt", async () => {
			const { deps, startAcpSession, registry, panelFactory } = makeDeps();
			const idle = makeSession({
				id: "idle-1",
				lifecycleState: "waiting-for-input",
			});
			const checkCapacity = vi.fn(() => ({
				ok: false as const,
				idleSessions: [idle],
				cap: 5,
			}));
			const promptForCap = vi.fn(() =>
				Promise.resolve<CapWarningDecision>({ kind: "abort" })
			);
			const emitTelemetry = vi.fn();

			await handleStartNew(
				{
					...deps,
					registry: {
						...deps.registry,
						checkCapacity,
					} as unknown as AgentChatCommandsDeps["registry"],
					concurrentCap: 5,
					promptForCap,
					emitTelemetry,
				},
				{
					agentId: "claude-code",
					agentDisplayName: "Claude Code",
					agentCommand: "claude --acp",
				}
			);

			expect(checkCapacity).toHaveBeenCalledWith("acp", 5);
			expect(promptForCap).toHaveBeenCalledTimes(1);
			expect(startAcpSession).not.toHaveBeenCalled();
			expect(registry.registerSession).not.toHaveBeenCalled();
			expect(panelFactory).not.toHaveBeenCalled();
			expect(emitTelemetry).toHaveBeenCalledWith(
				"agent-chat.concurrent-cap.hit",
				expect.objectContaining({
					decision: "abort",
					cap: 5,
					liveCount: 1,
				})
			);
		});

		it("cancels the chosen session and starts a new one when the user picks cancel-and-start", async () => {
			const { deps, startAcpSession, runner, registry } = makeDeps();
			const idle = makeSession({
				id: "idle-1",
				lifecycleState: "waiting-for-input",
			});
			const checkCapacity = vi
				.fn()
				// First call: cap reached.
				.mockReturnValueOnce({
					ok: false as const,
					idleSessions: [idle],
					cap: 5,
				})
				// Second call after cancel: cap available.
				.mockReturnValueOnce({ ok: true as const });
			const getRunner = vi.fn((id: string) =>
				id === "idle-1" ? runner : undefined
			);
			const promptForCap = vi.fn(() =>
				Promise.resolve<CapWarningDecision>({
					kind: "cancel-and-start",
					sessionIdToCancel: "idle-1",
				})
			);
			const emitTelemetry = vi.fn();

			await handleStartNew(
				{
					...deps,
					registry: {
						...deps.registry,
						checkCapacity,
						getRunner,
					} as unknown as AgentChatCommandsDeps["registry"],
					concurrentCap: 5,
					promptForCap,
					emitTelemetry,
				},
				{
					agentId: "claude-code",
					agentDisplayName: "Claude Code",
					agentCommand: "claude --acp",
				}
			);

			expect(runner.cancel).toHaveBeenCalledTimes(1);
			expect(startAcpSession).toHaveBeenCalledTimes(1);
			expect(registry.registerSession).toHaveBeenCalledTimes(1);
			expect(emitTelemetry).toHaveBeenCalledWith(
				"agent-chat.concurrent-cap.hit",
				expect.objectContaining({
					decision: "cancel-and-start",
					sessionIdToCancel: "idle-1",
				})
			);
		});

		it("cancels the chosen session and does NOT start a new one when the user picks cancel-only", async () => {
			const { deps, startAcpSession, runner } = makeDeps();
			const idle = makeSession({
				id: "idle-1",
				lifecycleState: "waiting-for-input",
			});
			const checkCapacity = vi.fn(() => ({
				ok: false as const,
				idleSessions: [idle],
				cap: 5,
			}));
			const getRunner = vi.fn((id: string) =>
				id === "idle-1" ? runner : undefined
			);
			const promptForCap = vi.fn(() =>
				Promise.resolve<CapWarningDecision>({
					kind: "cancel-only",
					sessionIdToCancel: "idle-1",
				})
			);
			const emitTelemetry = vi.fn();

			await handleStartNew(
				{
					...deps,
					registry: {
						...deps.registry,
						checkCapacity,
						getRunner,
					} as unknown as AgentChatCommandsDeps["registry"],
					concurrentCap: 5,
					promptForCap,
					emitTelemetry,
				},
				{
					agentId: "claude-code",
					agentDisplayName: "Claude Code",
					agentCommand: "claude --acp",
				}
			);

			expect(runner.cancel).toHaveBeenCalledTimes(1);
			expect(startAcpSession).not.toHaveBeenCalled();
			expect(emitTelemetry).toHaveBeenCalledWith(
				"agent-chat.concurrent-cap.hit",
				expect.objectContaining({
					decision: "cancel-only",
					sessionIdToCancel: "idle-1",
				})
			);
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

	// Regression: VS Code dispatches inline view-context buttons by passing the
	// entire tree item to the command, not the leaf's `command.arguments`.
	// `gatomia.agentChat.cancel` is bound as a `view/item/context` action on
	// the Running Agents tree, so the registration wrapper must coerce a
	// `RunningAgentsTreeItem`-shaped argument into a string `sessionId`
	// before delegating to `handleCancel`. Previously the wrapper accepted
	// `(sessionId: string)` directly and the cancel button silently no-op'd
	// because `registry.getRunner(treeItem)` returned `undefined`.
	describe("coerceSessionIdArg", () => {
		it("returns a non-empty string argument unchanged", () => {
			expect(coerceSessionIdArg("sess-42")).toBe("sess-42");
		});

		it("extracts `sessionId` from a tree-item-shaped argument", () => {
			expect(coerceSessionIdArg({ sessionId: "sess-7" })).toBe("sess-7");
		});

		it("returns undefined for empty strings", () => {
			expect(coerceSessionIdArg("")).toBeUndefined();
		});

		it("returns undefined for objects without a usable sessionId", () => {
			expect(coerceSessionIdArg({})).toBeUndefined();
			expect(coerceSessionIdArg({ sessionId: "" })).toBeUndefined();
		});

		it("returns undefined for `undefined`", () => {
			expect(coerceSessionIdArg(undefined)).toBeUndefined();
		});
	});
});
