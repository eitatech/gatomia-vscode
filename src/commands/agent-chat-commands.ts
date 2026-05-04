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
	AgentWorktreeService,
	WorktreeInspection,
} from "../features/agent-chat/agent-worktree-service";
import { WorktreeCleanupWarningRequired } from "../features/agent-chat/agent-worktree-service";
import type {
	CapWarningDecision,
	CapWarningPromptOptions,
} from "../features/agent-chat/cap-warning-prompt";
import {
	AGENT_CHAT_TELEMETRY_EVENTS,
	logTelemetry,
} from "../features/agent-chat/telemetry";
import type {
	AgentChatRunnerHandle,
	AgentChatSession,
	ExecutionTarget,
} from "../features/agent-chat/types";
import { ACP_NOT_SUPPORTED } from "../services/acp/types";

// ============================================================================
// Command IDs (keep package.json contribution points in sync)
// ============================================================================

export const AGENT_CHAT_COMMANDS = {
	START_NEW: "gatomia.agentChat.startNew",
	OPEN_FOR_SESSION: "gatomia.agentChat.openForSession",
	CANCEL: "gatomia.agentChat.cancel",
	// T066 — User Story 3 session-control commands.
	CLEANUP_WORKTREE: "gatomia.agentChat.cleanupWorktree",
	CHANGE_MODE: "gatomia.agentChat.changeMode",
	CHANGE_MODEL: "gatomia.agentChat.changeModel",
	CHANGE_EXECUTION_TARGET: "gatomia.agentChat.changeExecutionTarget",
	// T074 — User Story 4 orphan cleanup.
	CLEANUP_ORPHANED_WORKTREE: "gatomia.agentChat.cleanupOrphanedWorktree",
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
	> &
		Partial<Pick<AgentChatRegistry, "checkCapacity">>;
	readonly store: Pick<
		AgentChatSessionStore,
		"listNonTerminal" | "getSession" | "updateSession"
	> &
		Partial<
			Pick<
				AgentChatSessionStore,
				"listOrphanedWorktrees" | "removeOrphanedWorktree"
			>
		>;
	readonly createPanel: ChatPanelFactory;
	readonly startAcpSession: StartAcpSessionFn;
	/** Optional in v1 so existing test mocks keep working. Required for T066/T068. */
	readonly worktreeService?: Pick<AgentWorktreeService, "inspect" | "cleanup">;
	// ----- T073/T073a/T076: concurrent-cap enforcement -----
	/**
	 * Maximum concurrent ACP sessions. When undefined, cap enforcement is
	 * skipped (preserves legacy behaviour for existing call sites/tests).
	 */
	readonly concurrentCap?: number;
	/**
	 * QuickPick UX helper invoked when the cap would be exceeded. Receives the
	 * idle sessions discovered by `registry.checkCapacity` and returns the
	 * user's decision. Injected via extension bootstrap; tests substitute a
	 * fake that returns a pre-baked `CapWarningDecision`.
	 */
	readonly promptForCap?: (
		options: Omit<CapWarningPromptOptions, "window" | "now"> & {
			readonly window?: CapWarningPromptOptions["window"];
		}
	) => Promise<CapWarningDecision>;
	/**
	 * Telemetry sink for `agent-chat.concurrent-cap.hit` (T076). No-op in
	 * tests that do not care about the event.
	 */
	readonly emitTelemetry?: (
		event: string,
		payload: Record<string, unknown>
	) => void;
	/**
	 * Optional ACP manager hook used by {@link handleChangeModel} to call
	 * the experimental `session/set_model` RPC. Declared structurally so
	 * tests can stub it without spinning up the real
	 * `AcpSessionManager`. Sessions whose runner does not surface the
	 * method (older CLIs, non-ACP cloud) fall back to the legacy
	 * `recordModelChange` flow.
	 */
	readonly acpSessionManager?: {
		setSessionModel(
			providerId: string,
			cwd: string | undefined,
			sessionId: string,
			modelId: string
		): Promise<void>;
	};
}

// ============================================================================
// T066 payload shapes
// ============================================================================

export interface CleanupWorktreePayload {
	readonly sessionId: string;
	readonly confirmedDestructive: boolean;
}

export type CleanupWorktreeResult =
	| { readonly kind: "ok" }
	| { readonly kind: "warning"; readonly inspection: WorktreeInspection }
	| { readonly kind: "error"; readonly message: string };

export interface ChangeModePayload {
	readonly sessionId: string;
	readonly modeId: string;
}

export interface ChangeModelPayload {
	readonly sessionId: string;
	readonly modelId: string;
}

export interface ChangeExecutionTargetPayload {
	readonly sessionId: string;
	readonly target: ExecutionTarget;
}

// ============================================================================
// Handlers (pure — unit-testable without the VS Code command registry)
// ============================================================================

export async function handleStartNew(
	deps: AgentChatCommandsDeps,
	params: StartNewAcpSessionParams
): Promise<void> {
	// ----- T073/T073a/T076: concurrent-cap enforcement -----
	// When the extension wires in a cap + prompt helper, run the check before
	// spawning anything. Legacy callers/tests that don't pass these deps skip
	// this block entirely, keeping the existing behaviour intact.
	if (!(await enforceConcurrentCap(deps))) {
		return;
	}

	const { session, runner } = await deps.startAcpSession(params);

	deps.registry.registerSession(session);
	deps.registry.attachRunner(session.id, runner);

	const panel = await deps.createPanel(session);
	deps.registry.attachPanel(session.id, panel as never);
	panel.reveal();
}

/**
 * Run the concurrent-cap enforcement for `handleStartNew`. Returns `true`
 * when the caller may proceed to start a new session, `false` when the
 * operation was short-circuited (abort or cancel-only).
 */
async function enforceConcurrentCap(
	deps: AgentChatCommandsDeps
): Promise<boolean> {
	const { registry } = deps;
	if (
		typeof deps.concurrentCap !== "number" ||
		typeof registry.checkCapacity !== "function"
	) {
		return true;
	}
	const capacity = registry.checkCapacity("acp", deps.concurrentCap);
	if (capacity.ok) {
		return true;
	}
	const telemetryBase = {
		cap: capacity.cap,
		liveCount: capacity.idleSessions.length,
	};
	if (!deps.promptForCap) {
		// Without a prompt helper we have no UX path — fail closed.
		deps.emitTelemetry?.(AGENT_CHAT_TELEMETRY_EVENTS.CONCURRENT_CAP_HIT, {
			...telemetryBase,
			decision: "abort",
			reason: "no-prompt-helper",
		});
		return false;
	}
	const decision = await deps.promptForCap({
		idleSessions: capacity.idleSessions,
		cap: capacity.cap,
	});
	if (decision.kind === "abort") {
		deps.emitTelemetry?.(AGENT_CHAT_TELEMETRY_EVENTS.CONCURRENT_CAP_HIT, {
			...telemetryBase,
			decision: decision.kind,
		});
		return false;
	}
	const runnerToCancel = registry.getRunner(decision.sessionIdToCancel);
	if (runnerToCancel) {
		await runnerToCancel.cancel();
	}
	deps.emitTelemetry?.(AGENT_CHAT_TELEMETRY_EVENTS.CONCURRENT_CAP_HIT, {
		...telemetryBase,
		decision: decision.kind,
		sessionIdToCancel: decision.sessionIdToCancel,
	});
	return decision.kind === "cancel-and-start";
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
		// T078 — we reused an existing panel instead of creating a new one.
		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.PANEL_REOPENED, {
			sessionId,
			agentId: session.agentId,
		});
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

// ----------------------------------------------------------------------------
// T074 — User Story 4 orphaned-worktree cleanup
// ----------------------------------------------------------------------------

export interface CleanupOrphanedWorktreePayload {
	readonly sessionId: string;
	readonly absolutePath: string;
	readonly branchName: string;
	readonly confirmedDestructive: boolean;
}

export type CleanupOrphanedWorktreeResult =
	| { readonly kind: "ok" }
	| { readonly kind: "warning"; readonly inspection: WorktreeInspection }
	| { readonly kind: "error"; readonly message: string };

/**
 * Clean up an orphaned worktree discovered by retention eviction.
 *
 * Flow:
 *   1. Inspect the worktree on disk (if the service is available). If the
 *      worktree has uncommitted paths or unpushed commits and the caller did
 *      not confirm, return a `warning` so the UI can surface the two-step
 *      dialog.
 *   2. Remove the directory via `worktreeService.cleanup`.
 *   3. Drop the orphan entry from `workspaceState` so the tree refreshes.
 */
export async function handleCleanupOrphanedWorktree(
	deps: AgentChatCommandsDeps,
	payload: CleanupOrphanedWorktreePayload
): Promise<CleanupOrphanedWorktreeResult> {
	const { worktreeService, store } = deps;
	if (!store.removeOrphanedWorktree) {
		return {
			kind: "error",
			message: "Orphan store not configured in this environment.",
		};
	}
	if (worktreeService) {
		try {
			await worktreeService.cleanup(
				{
					id: payload.sessionId,
					absolutePath: payload.absolutePath,
					branchName: payload.branchName,
					baseCommitSha: "",
					createdAt: 0,
					status: "in-use",
				},
				{ confirmedDestructive: payload.confirmedDestructive }
			);
		} catch (error) {
			if (error instanceof WorktreeCleanupWarningRequired) {
				return { kind: "warning", inspection: error.inspection };
			}
			return {
				kind: "error",
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}
	await store.removeOrphanedWorktree(payload.sessionId);
	return { kind: "ok" };
}

// ----------------------------------------------------------------------------
// T066 — User Story 3 session-control handlers
// ----------------------------------------------------------------------------

/**
 * Two-step worktree cleanup driver. First call (`confirmedDestructive: false`)
 * inspects the worktree and returns a `warning` when there are uncommitted
 * paths or unpushed commits. Caller (webview or tree context) shows the
 * confirmation dialog and re-invokes with `confirmedDestructive: true`.
 *
 * @see contracts/worktree-lifecycle.md §6
 * @see contracts/agent-chat-panel-protocol.md §4.7
 */
export async function handleCleanupWorktree(
	deps: AgentChatCommandsDeps,
	payload: CleanupWorktreePayload
): Promise<CleanupWorktreeResult> {
	const { worktreeService, registry, store } = deps;
	if (!worktreeService) {
		return {
			kind: "error",
			message: "Worktree service not configured in this environment.",
		};
	}
	const session =
		registry.getSession(payload.sessionId) ??
		(await store.getSession(payload.sessionId));
	if (!session) {
		return {
			kind: "error",
			message: `Session ${payload.sessionId} not found.`,
		};
	}
	if (!session.worktree) {
		return {
			kind: "error",
			message: "This session does not have a worktree.",
		};
	}
	try {
		await worktreeService.cleanup(session.worktree, {
			confirmedDestructive: payload.confirmedDestructive,
		});
		await store.updateSession(session.id, {
			worktree: {
				...session.worktree,
				status: "cleaned",
				cleanedAt: Date.now(),
			},
		});
		return { kind: "ok" };
	} catch (error) {
		if (error instanceof WorktreeCleanupWarningRequired) {
			return { kind: "warning", inspection: error.inspection };
		}
		return {
			kind: "error",
			message: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Record the user's mode change. Takes effect on the next turn (data-model
 * invariant 6). Persisted via the store so reloads see the choice.
 */
export async function handleChangeMode(
	deps: AgentChatCommandsDeps,
	payload: ChangeModePayload
): Promise<void> {
	const session =
		deps.registry.getSession(payload.sessionId) ??
		(await deps.store.getSession(payload.sessionId));
	if (!session) {
		return;
	}
	if (session.selectedModeId === payload.modeId) {
		return;
	}
	// Record the change in the transcript FIRST (so the system message is
	// visible before the store update fans out via the registry event), then
	// persist the session patch.
	const runner = deps.registry.getRunner(payload.sessionId);
	if (runner && hasRecordModeChange(runner)) {
		await runner.recordModeChange(payload.modeId);
	}
	await deps.store.updateSession(session.id, {
		selectedModeId: payload.modeId,
	});
}

export async function handleChangeModel(
	deps: AgentChatCommandsDeps,
	payload: ChangeModelPayload
): Promise<void> {
	const session =
		deps.registry.getSession(payload.sessionId) ??
		(await deps.store.getSession(payload.sessionId));
	if (!session) {
		return;
	}
	if (session.selectedModelId === payload.modelId) {
		return;
	}

	if (await tryAcpSetModel(deps, session, payload.modelId)) {
		return;
	}

	const runner = deps.registry.getRunner(payload.sessionId);
	if (runner && hasRecordModelChange(runner)) {
		await runner.recordModelChange(payload.modelId);
	}
	await deps.store.updateSession(session.id, {
		selectedModelId: payload.modelId,
	});
}

/**
 * Attempt to hot-swap the agent-side model via the experimental
 * `session/set_model` RPC. Returns `true` when the RPC succeeded (the
 * manager will fire `session-models-changed` and the runner persists
 * the new state, so the caller does NOT need to update the store).
 *
 * Returns `false` to instruct the caller to fall back to the legacy
 * `recordModelChange` flow — happens for non-ACP sessions, when the
 * deps did not provide a manager, or when the provider's connection
 * does not implement the experimental RPC (`ACP_NOT_SUPPORTED`).
 *
 * Re-throws unexpected errors so the caller's error boundary surfaces
 * them to the user.
 */
async function tryAcpSetModel(
	deps: AgentChatCommandsDeps,
	session: AgentChatSession,
	modelId: string
): Promise<boolean> {
	const manager = deps.acpSessionManager;
	if (session.source !== "acp" || !manager) {
		return false;
	}
	try {
		await manager.setSessionModel(
			session.agentId,
			session.worktree?.absolutePath ?? undefined,
			session.id,
			modelId
		);
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes(ACP_NOT_SUPPORTED)) {
			return false;
		}
		throw error;
	}
}

// Structural checks so the commands stay agnostic of the concrete
// `AcpChatRunner` type (CloudChatAdapter doesn't implement these methods).
function hasRecordModeChange(
	runner: AgentChatRunnerHandle
): runner is AgentChatRunnerHandle & {
	recordModeChange: (modeId: string) => Promise<void>;
} {
	const maybe = runner as {
		recordModeChange?: unknown;
	};
	return typeof maybe.recordModeChange === "function";
}

function hasRecordModelChange(
	runner: AgentChatRunnerHandle
): runner is AgentChatRunnerHandle & {
	recordModelChange: (modelId: string) => Promise<void>;
} {
	const maybe = runner as {
		recordModelChange?: unknown;
	};
	return typeof maybe.recordModelChange === "function";
}

/**
 * Change the execution target of a pre-turn session. Sessions that have
 * already produced a turn have an immutable target (data-model §1.4): this
 * handler rejects such changes by returning silently, leaving the caller to
 * surface the failure via `agent-chat/error` if desired.
 */
export async function handleChangeExecutionTarget(
	deps: AgentChatCommandsDeps,
	payload: ChangeExecutionTargetPayload
): Promise<{ ok: boolean; reason?: string }> {
	const session =
		deps.registry.getSession(payload.sessionId) ??
		(await deps.store.getSession(payload.sessionId));
	if (!session) {
		return { ok: false, reason: "session-not-found" };
	}
	if (session.lifecycleState === "running") {
		return { ok: false, reason: "target-immutable-after-turn" };
	}
	await deps.store.updateSession(session.id, {
		executionTarget: payload.target,
	});
	return { ok: true };
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
			async (arg: string | SessionTreeItemLike | undefined) => {
				const sessionId = coerceSessionIdArg(arg);
				if (!sessionId) {
					return;
				}
				await handleCancel(deps, sessionId);
			}
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.CLEANUP_WORKTREE,
			(payload: CleanupWorktreePayload) => handleCleanupWorktree(deps, payload)
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.CHANGE_MODE,
			async (payload: ChangeModePayload) => {
				await handleChangeMode(deps, payload);
			}
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.CHANGE_MODEL,
			async (payload: ChangeModelPayload) => {
				await handleChangeModel(deps, payload);
			}
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.CHANGE_EXECUTION_TARGET,
			(payload: ChangeExecutionTargetPayload) =>
				handleChangeExecutionTarget(deps, payload)
		),
		commands.registerCommand(
			AGENT_CHAT_COMMANDS.CLEANUP_ORPHANED_WORKTREE,
			(arg: CleanupOrphanedWorktreePayload | OrphanTreeItemLike) => {
				const payload = isCleanupOrphanedWorktreePayload(arg)
					? arg
					: orphanTreeItemToPayload(arg);
				if (!payload) {
					return Promise.resolve({
						kind: "error" as const,
						message: "No orphan target provided.",
					});
				}
				return handleCleanupOrphanedWorktree(deps, payload);
			}
		),
	];
}

interface OrphanTreeItemLike {
	readonly orphanId?: string;
	readonly orphanAbsolutePath?: string;
	readonly orphanBranchName?: string;
}

/**
 * Tree-item shape for session leaves in the Running Agents view.
 *
 * VS Code dispatches inline view-context buttons (`view/item/context`) by
 * passing the *entire* tree item to the command — NOT the `arguments` array
 * defined on the leaf's primary `command`. Since the menu binding for
 * `gatomia.agentChat.cancel` does not specify arguments, we must accept the
 * tree-item shape and pull `sessionId` ourselves.
 *
 * Kept structurally minimal so unit tests can pass plain objects without
 * importing `RunningAgentsTreeItem` (which would drag in `vscode`).
 */
export interface SessionTreeItemLike {
	readonly sessionId?: string;
}

/**
 * Resolve a session id from either a raw string (command palette / programmatic
 * dispatch) or a Running Agents tree leaf (inline action button). Returns
 * `undefined` when no usable session id is present so the command handler can
 * no-op silently rather than throw.
 *
 * Exported for unit tests — see `agent-chat-commands.test.ts`.
 */
export function coerceSessionIdArg(
	arg: string | SessionTreeItemLike | undefined
): string | undefined {
	if (typeof arg === "string") {
		return arg.length > 0 ? arg : undefined;
	}
	if (arg && typeof arg.sessionId === "string" && arg.sessionId.length > 0) {
		return arg.sessionId;
	}
	return;
}

function isCleanupOrphanedWorktreePayload(
	value: unknown
): value is CleanupOrphanedWorktreePayload {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.sessionId === "string" &&
		typeof candidate.absolutePath === "string" &&
		typeof candidate.branchName === "string"
	);
}

function orphanTreeItemToPayload(
	item: OrphanTreeItemLike
): CleanupOrphanedWorktreePayload | null {
	const sessionId = item.orphanId ?? "";
	const absolutePath = item.orphanAbsolutePath ?? "";
	const branchName = item.orphanBranchName ?? "";
	if (sessionId === "" || absolutePath === "" || branchName === "") {
		return null;
	}
	return {
		sessionId,
		absolutePath,
		branchName,
		confirmedDestructive: false,
	};
}
