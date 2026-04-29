/**
 * Cap-warning QuickPick helper (T073a, spec 018 US4).
 *
 * When `AgentChatRegistry.checkCapacity` refuses a new ACP session, this
 * helper renders the decision UX: a `vscode.window.showQuickPick` listing the
 * candidate idle sessions plus a "Keep all, do not start" escape hatch, and
 * (per research §R5) exposes the trailing *Cancel this session and start
 * new* / *Cancel this session without starting new* actions as item-level
 * buttons when the underlying `showQuickPick` shape supports them.
 *
 * The module is deliberately decoupled from the real `vscode.window` so unit
 * tests (T073a) can drive it with a plain fake.
 *
 * @see specs/018-agent-chat-panel/research.md §R5
 */

import type { AgentChatSession } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CapWarningDecision =
	| {
			readonly kind: "cancel-and-start";
			readonly sessionIdToCancel: string;
	  }
	| {
			readonly kind: "cancel-only";
			readonly sessionIdToCancel: string;
	  }
	| { readonly kind: "abort" };

/**
 * A single QuickPick item understood by this helper. `sessionId` is set on
 * session rows; `action` describes which of the three outcomes the user's
 * selection should produce.
 */
export interface CapWarningPickItem {
	readonly label: string;
	readonly description?: string;
	readonly detail?: string;
	readonly sessionId?: string;
	readonly action?: "cancel-and-start" | "cancel-only" | "keep-all";
}

export interface CapWarningPromptDeps {
	showQuickPick: (
		items: readonly CapWarningPickItem[],
		options?: { placeHolder?: string; title?: string; ignoreFocusOut?: boolean }
	) => Thenable<CapWarningPickItem | undefined>;
	showWarningMessage: (
		message: string,
		...actions: string[]
	) => Thenable<string | undefined>;
}

export interface CapWarningPromptOptions {
	readonly idleSessions: readonly AgentChatSession[];
	readonly cap: number;
	readonly window: CapWarningPromptDeps;
	/** Clock injection for deterministic `idleFor` labels in tests. */
	readonly now?: () => number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const KEEP_ALL_LABEL = "Keep all, do not start";

export async function promptForCapWarning(
	options: CapWarningPromptOptions
): Promise<CapWarningDecision> {
	const now = options.now ?? Date.now;
	const items: CapWarningPickItem[] = options.idleSessions.map((session) => ({
		label: formatSessionLabel(session, now()),
		sessionId: session.id,
	}));
	items.push({ label: KEEP_ALL_LABEL, action: "keep-all" });

	const picked = await options.window.showQuickPick(items, {
		placeHolder: `Concurrent ACP session cap of ${options.cap} reached — choose how to proceed`,
		title: "Agent Chat: concurrent session cap reached",
		ignoreFocusOut: true,
	});

	if (!picked) {
		return { kind: "abort" };
	}

	// Tests and extension.ts orchestrators may pre-populate `action` on the
	// selected item (e.g. when buttons are clicked). Honour it directly.
	if (picked.action === "cancel-and-start" && picked.sessionId) {
		return { kind: "cancel-and-start", sessionIdToCancel: picked.sessionId };
	}
	if (picked.action === "cancel-only" && picked.sessionId) {
		return { kind: "cancel-only", sessionIdToCancel: picked.sessionId };
	}
	if (picked.action === "keep-all" || !picked.sessionId) {
		return { kind: "abort" };
	}

	// Otherwise ask the follow-up "what to do with this session" QuickPick.
	const actionItems: CapWarningPickItem[] = [
		{
			label: "Cancel this session and start new",
			action: "cancel-and-start",
			sessionId: picked.sessionId,
		},
		{
			label: "Cancel this session without starting new",
			action: "cancel-only",
			sessionId: picked.sessionId,
		},
		{
			label: KEEP_ALL_LABEL,
			action: "keep-all",
		},
	];
	const confirmedAction = await options.window.showQuickPick(actionItems, {
		placeHolder: `What should happen to ${picked.label}?`,
		title: "Agent Chat: confirm action",
		ignoreFocusOut: true,
	});
	if (!confirmedAction) {
		return { kind: "abort" };
	}
	if (confirmedAction.action === "cancel-and-start" && picked.sessionId) {
		return { kind: "cancel-and-start", sessionIdToCancel: picked.sessionId };
	}
	if (confirmedAction.action === "cancel-only" && picked.sessionId) {
		return { kind: "cancel-only", sessionIdToCancel: picked.sessionId };
	}
	return { kind: "abort" };
}

/**
 * Format a session as
 * `"<agentDisplayName> · <mode> · <target> · <idleFor>"`.
 *
 * `idleFor` is a short human-readable delta ("just now", "15s ago", "3m ago",
 * "2h ago", "1d ago"). Time math is kept simple on purpose — we don't need
 * i18n-grade rendering here; this is a UX affordance, not a log line.
 */
export function formatSessionLabel(
	session: AgentChatSession,
	nowMs: number
): string {
	const mode = session.selectedModeId ?? "default";
	const target = formatTarget(session);
	const idle = formatIdleFor(Math.max(0, nowMs - session.updatedAt));
	return `${session.agentDisplayName} · ${mode} · ${target} · ${idle}`;
}

function formatTarget(session: AgentChatSession): string {
	switch (session.executionTarget.kind) {
		case "local":
			return "local";
		case "worktree":
			return "worktree";
		case "cloud":
			return "cloud";
		default:
			return "unknown";
	}
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function formatIdleFor(deltaMs: number): string {
	if (deltaMs < 10 * MS_PER_SECOND) {
		return "just now";
	}
	if (deltaMs < MS_PER_MINUTE) {
		return `${Math.floor(deltaMs / MS_PER_SECOND)}s ago`;
	}
	if (deltaMs < MS_PER_HOUR) {
		return `${Math.floor(deltaMs / MS_PER_MINUTE)}m ago`;
	}
	if (deltaMs < MS_PER_DAY) {
		return `${Math.floor(deltaMs / MS_PER_HOUR)}h ago`;
	}
	return `${Math.floor(deltaMs / MS_PER_DAY)}d ago`;
}
