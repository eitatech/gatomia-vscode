/**
 * Agent Chat Panel commands (T038, spec 018).
 *
 * Registers the three User Story 1 commands:
 *   - `gatomia.agentChat.startNew`        — launch a new ACP chat session + panel
 *   - `gatomia.agentChat.openForSession`  — open (or focus) the panel for a session id
 *   - `gatomia.agentChat.cancel`          — cancel the active runner for a session id
 *
 * The command handlers are exported as pure functions so they are unit-testable
 * without spinning up the full VS Code command infrastructure.
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md §2
 */

import { type Disposable, commands } from "vscode";
import type { AgentChatRegistry } from "../features/agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../features/agent-chat/agent-chat-session-store";
import type {
	AgentChatRunnerHandle,
	AgentChatSession,
} from "../features/agent-chat/types";

// ============================================================================
// Command IDs (keep package.json contribution points in sync)
// ============================================================================

export const AGENT_CHAT_COMMANDS = {
	START_NEW: "gatomia.agentChat.startNew",
	OPEN_FOR_SESSION: "gatomia.agentChat.openForSession",
	CANCEL: "gatomia.agentChat.cancel",
} as const;

export type AgentChatCommandId =
	(typeof AGENT_CHAT_COMMANDS)[keyof typeof AGENT_CHAT_COMMANDS];

// ============================================================================
// Inputs
// ============================================================================

/**
 * Parameters for launching a new ACP chat session.
 *
 * Kept intentionally minimal for T038 — spec 018 later phases extend this with
 * mode/model/executionTarget selection driven by `ResolvedCapabilities`.
 */
export interface StartNewAcpSessionParams {
	readonly agentId: string;
	readonly agentDisplayName: string;
	readonly agentCommand: string;
	readonly mode?: string;
	readonly taskInstruction?: string;
	readonly cwd?: string;
}

/** Structural subtype of the panel used by the commands — matches `AgentChatPanel`. */
export interface ChatPanelLike {
	readonly sessionId: string;
	reveal(): void;
	dispose(): void;
}

/**
 * Factory responsible for creating a chat session + runner pair.
 *
 * The extension's activation path supplies a concrete implementation that
 * resolves capabilities, persists the session via the store, constructs the
 * `AcpChatRunner`, and returns both so the command handler can attach them to
 * the registry. Tests inject a minimal fake.
 */
export type StartAcpSessionFn = (params: StartNewAcpSessionParams) => Promise<{
	session: AgentChatSession;
	runner: AgentChatRunnerHandle;
}>;

export type ChatPanelFactory = (
	session: AgentChatSession
) => Promise<ChatPanelLike> | ChatPanelLike;

// ============================================================================
// Dependencies (explicit for DI + tests)
// ============================================================================

export interface AgentChatCommandsDeps {
	readonly registry: Pick<
		AgentChatRegistry,
		| "getSession"
		| "getRunner"
		| "getPanel"
		| "focusPanel"
		| "registerSession"
		| "attachRunner"
		| "attachPanel"
	>;
	readonly store: Pick<AgentChatSessionStore, "listNonTerminal" | "getSession">;
	readonly createPanel: ChatPanelFactory;
	readonly startAcpSession: StartAcpSessionFn;
}

// ============================================================================
// Handlers (pure — unit-testable without the VS Code command registry)
// ============================================================================

export async function handleStartNew(
	deps: AgentChatCommandsDeps,
	params: StartNewAcpSessionParams
): Promise<void> {
	const { registry, createPanel, startAcpSession } = deps;

	const { session, runner } = await startAcpSession(params);

	registry.registerSession(session);
	registry.attachRunner(session.id, runner);

	const panel = await createPanel(session);
	registry.attachPanel(session.id, panel as never);
	panel.reveal();
}

export async function handleOpenForSession(
	deps: AgentChatCommandsDeps,
	sessionId: string
): Promise<void> {
	const { registry, store, createPanel } = deps;

	// Happy path: session already tracked in the in-memory registry.
	let session = registry.getSession(sessionId);

	// Restart fallback (T047): after VS Code reloads, the store has the
	// persisted session but the registry is empty until the first tree
	// interaction. Hydrate the registry lazily so tree clicks on Recent
	// entries still open a panel.
	if (!session) {
		session = await store.getSession(sessionId);
		if (!session) {
			return;
		}
		registry.registerSession(session);
	}

	// Honour the one-panel-per-session invariant (FR-008) via focusPanel.
	if (registry.focusPanel(sessionId)) {
		return;
	}

	const panel = await createPanel(session);
	registry.attachPanel(sessionId, panel as never);
	panel.reveal();
}

export async function handleCancel(
	deps: AgentChatCommandsDeps,
	sessionId: string
): Promise<void> {
	const runner = deps.registry.getRunner(sessionId);
	if (!runner) {
		return;
	}
	await runner.cancel();
}

// ============================================================================
// VS Code registration glue
// ============================================================================

/**
 * Register the three Agent Chat Panel commands in the VS Code command palette.
 *
 * Returns the disposables so the caller (extension activation) can push them
 * into its subscription list.
 */
export function registerAgentChatCommands(
	deps: AgentChatCommandsDeps
): Disposable[] {
	return [
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.START_NEW,
			async (params: StartNewAcpSessionParams) => {
				await handleStartNew(deps, params);
			}
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.OPEN_FOR_SESSION,
			async (sessionId: string) => {
				await handleOpenForSession(deps, sessionId);
			}
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.CANCEL,
			async (sessionId: string) => {
				await handleCancel(deps, sessionId);
			}
		),
	];
}
