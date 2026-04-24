/**
 * AgentChatRegistry — in-memory index of live chat sessions, panels, and
 * runners for the Agent Chat Panel feature.
 *
 * Responsibilities:
 *   - Track one `WebviewPanel` per session (FR-008 invariant).
 *   - Track the active runner (`AcpChatRunner` or `CloudChatAdapter`) for each
 *     session via the forward-compatible `AgentChatRunnerHandle` interface.
 *   - Partition sessions into active vs. recent buckets for the tree view.
 *   - Drive the shutdown flush handed to `AgentChatSessionStore`.
 *
 * Persistence is out of scope for this module — the store owns disk state.
 * The registry is the authority on "what is live in this process right now".
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md §2
 * @see specs/018-agent-chat-panel/data-model.md §5 (Invariants)
 */

import { EventEmitter } from "vscode";
import {
	type AgentChatRunnerHandle,
	type AgentChatSession,
	TERMINAL_STATES,
} from "./types";

// ============================================================================
// Panel abstraction
// ============================================================================

/**
 * Subset of `vscode.WebviewPanel` used by the registry. Declaring a structural
 * subtype here keeps the registry testable without importing the full VS Code
 * API surface into unit tests.
 *
 * `AgentChatPanel` (T026) will satisfy this shape.
 */
export interface AgentChatPanelLike {
	readonly viewType: string;
	reveal(...args: unknown[]): void;
	dispose(): void;
	onDidDispose(cb: () => void): { dispose: () => void };
}

// ============================================================================
// Registry
// ============================================================================

export class AgentChatRegistry {
	private readonly sessionsById = new Map<string, AgentChatSession>();
	private readonly panelsBySessionId = new Map<string, AgentChatPanelLike>();
	private readonly runnersBySessionId = new Map<
		string,
		AgentChatRunnerHandle
	>();

	private readonly _onDidChange = new EventEmitter<void>();
	readonly onDidChange = this._onDidChange.event;

	/** Register a session. Overwrites any existing entry for the same id. */
	registerSession(session: AgentChatSession): void {
		this.sessionsById.set(session.id, session);
		this._onDidChange.fire();
	}

	/** Update an existing session's lifecycle state or other fields in place. */
	updateSession(sessionId: string, patch: Partial<AgentChatSession>): void {
		const existing = this.sessionsById.get(sessionId);
		if (!existing) {
			return;
		}
		Object.assign(existing, patch);
		this._onDidChange.fire();
	}

	/** Remove a session and dispose any attached panel or runner. */
	removeSession(sessionId: string): void {
		const panel = this.panelsBySessionId.get(sessionId);
		if (panel) {
			panel.dispose();
			this.panelsBySessionId.delete(sessionId);
		}
		const runner = this.runnersBySessionId.get(sessionId);
		if (runner) {
			runner.dispose();
			this.runnersBySessionId.delete(sessionId);
		}
		this.sessionsById.delete(sessionId);
		this._onDidChange.fire();
	}

	getSession(sessionId: string): AgentChatSession | undefined {
		return this.sessionsById.get(sessionId);
	}

	listActive(): AgentChatSession[] {
		const out: AgentChatSession[] = [];
		for (const session of this.sessionsById.values()) {
			if (!TERMINAL_STATES.has(session.lifecycleState)) {
				out.push(session);
			}
		}
		return out;
	}

	listRecent(): AgentChatSession[] {
		const out: AgentChatSession[] = [];
		for (const session of this.sessionsById.values()) {
			if (TERMINAL_STATES.has(session.lifecycleState)) {
				out.push(session);
			}
		}
		return out;
	}

	// ------------------------------------------------------------------
	// Panels (FR-008: one panel per session)
	// ------------------------------------------------------------------

	/**
	 * Attach a panel to a session. Throws if the session already has a panel
	 * (the caller should use {@link focusPanel} or {@link openPanelFor} instead).
	 */
	attachPanel(sessionId: string, panel: AgentChatPanelLike): void {
		if (this.panelsBySessionId.has(sessionId)) {
			throw new Error(
				`[agent-chat-registry] session ${sessionId} already has a panel — focus the existing panel instead of attaching a new one`
			);
		}
		this.panelsBySessionId.set(sessionId, panel);
		panel.onDidDispose(() => {
			this.panelsBySessionId.delete(sessionId);
			this._onDidChange.fire();
		});
	}

	getPanel(sessionId: string): AgentChatPanelLike | undefined {
		return this.panelsBySessionId.get(sessionId);
	}

	/** Focus an existing panel if present; returns whether a panel was focused. */
	focusPanel(sessionId: string): boolean {
		const panel = this.panelsBySessionId.get(sessionId);
		if (!panel) {
			return false;
		}
		panel.reveal();
		return true;
	}

	// ------------------------------------------------------------------
	// Runners
	// ------------------------------------------------------------------

	/** Attach a runner to a session. Throws if one is already attached. */
	attachRunner(sessionId: string, runner: AgentChatRunnerHandle): void {
		if (this.runnersBySessionId.has(sessionId)) {
			throw new Error(
				`[agent-chat-registry] session ${sessionId} already has a runner`
			);
		}
		this.runnersBySessionId.set(sessionId, runner);
	}

	getRunner(sessionId: string): AgentChatRunnerHandle | undefined {
		return this.runnersBySessionId.get(sessionId);
	}

	// ------------------------------------------------------------------
	// Shutdown flush
	// ------------------------------------------------------------------

	/**
	 * Stamp non-terminal ACP sessions as `ended-by-shutdown`, hand the snapshot
	 * to `flushSink` (exactly once), then dispose every attached runner.
	 *
	 * The sink is responsible for persisting the snapshot (typically
	 * `AgentChatSessionStore.flushForDeactivation()` wrapping it). The registry
	 * does not persist directly — it only coordinates in-memory state.
	 */
	async shutdown(
		flushSink: (sessions: AgentChatSession[]) => Promise<void>
	): Promise<void> {
		const snapshot: AgentChatSession[] = [];
		for (const session of this.sessionsById.values()) {
			if (
				session.source === "acp" &&
				!TERMINAL_STATES.has(session.lifecycleState)
			) {
				session.lifecycleState = "ended-by-shutdown";
				session.endedAt = session.endedAt ?? Date.now();
				session.updatedAt = Date.now();
			}
			snapshot.push(session);
		}

		await flushSink(snapshot);

		for (const runner of this.runnersBySessionId.values()) {
			try {
				runner.dispose();
			} catch {
				// Best-effort — a failing dispose on one runner should not block
				// the others.
			}
		}
		this.runnersBySessionId.clear();
		this._onDidChange.fire();
	}

	dispose(): void {
		for (const runner of this.runnersBySessionId.values()) {
			try {
				runner.dispose();
			} catch {
				// Intentionally ignored.
			}
		}
		for (const panel of this.panelsBySessionId.values()) {
			try {
				panel.dispose();
			} catch {
				// Intentionally ignored.
			}
		}
		this.runnersBySessionId.clear();
		this.panelsBySessionId.clear();
		this.sessionsById.clear();
		this._onDidChange.dispose();
	}
}
