/**
 * RunningAgentsTreeProvider — "Running Agents" tree view (spec 018, T044).
 *
 * Renders three groups at the root level:
 *
 *   1. **Active**             — sessions with a non-terminal lifecycle state.
 *   2. **Recent**              — sessions in a terminal lifecycle state.
 *   3. **Orphaned worktrees**  — worktree handles whose owner session has
 *                                been evicted by retention (§2.4 of the
 *                                storage contract). Populated by T075.
 *
 * Each session leaf carries a click command targeting
 * `gatomia.agentChat.openForSession` (wired by T038) and a context value
 * that enables right-click menu entries (e.g. "Clean up worktree" for
 * worktree-backed sessions, T048).
 *
 * The provider refreshes whenever either the session store's manifest or
 * the in-memory registry emits a change event — so tree updates are
 * driven from whichever authority mutated first.
 *
 * @see specs/018-agent-chat-panel/tasks.md §T042 / §T044
 */

import {
	type Event,
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	type TreeDataProvider,
} from "vscode";
import type { AgentChatRegistry } from "../features/agent-chat/agent-chat-registry";
import type { AgentChatSessionStore } from "../features/agent-chat/agent-chat-session-store";
import type {
	AgentChatSession,
	OrphanedWorktreeEntry,
	SessionManifest,
} from "../features/agent-chat/types";

// ---------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------

export type RunningAgentsTreeItem = TreeItem & {
	/** Present on session leaf nodes; absent on group and orphan nodes. */
	sessionId?: string;
	/** Present on orphan leaves; absent otherwise. */
	orphanId?: string;
	/** Discriminator for getChildren dispatch. */
	nodeKind:
		| "group-active"
		| "group-recent"
		| "group-orphans"
		| "session"
		| "orphan";
};

export interface RunningAgentsTreeProviderOptions {
	readonly store: AgentChatSessionStore;
	readonly registry: AgentChatRegistry;
	/**
	 * Event fired whenever the store's manifest changes. Injected so tests
	 * can drive refreshes without reaching into `store.onDidChangeManifest`
	 * private implementation details.
	 */
	readonly storeChangeEvent: Event<SessionManifest>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPEN_FOR_SESSION_COMMAND_ID = "gatomia.agentChat.openForSession";

const GROUP_LABELS = {
	active: "Active",
	recent: "Recent",
	orphans: "Orphaned worktrees",
} as const;

const GROUP_CONTEXT_VALUES = {
	active: "agent-chat-group-active",
	recent: "agent-chat-group-recent",
	orphans: "agent-chat-group-orphans",
} as const;

const SESSION_CONTEXT_VALUE = "agent-chat-session";
const SESSION_WORKTREE_CONTEXT_VALUE = "agent-chat-session-worktree";
const ORPHAN_CONTEXT_VALUE = "agent-chat-orphan-worktree";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class RunningAgentsTreeProvider
	implements TreeDataProvider<RunningAgentsTreeItem>
{
	static readonly viewId = "gatomia.views.runningAgents";

	private readonly _onDidChangeTreeData = new EventEmitter<
		RunningAgentsTreeItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: Event<
		RunningAgentsTreeItem | undefined | null | void
	> = this._onDidChangeTreeData.event;

	private readonly disposables: Array<{ dispose(): void }> = [];
	private readonly store: AgentChatSessionStore;
	private readonly registry: AgentChatRegistry;

	constructor(options: RunningAgentsTreeProviderOptions) {
		this.store = options.store;
		this.registry = options.registry;

		this.disposables.push(
			options.storeChangeEvent(() => {
				this._onDidChangeTreeData.fire();
			})
		);
		this.disposables.push(
			this.registry.onDidChange(() => {
				this._onDidChangeTreeData.fire();
			})
		);
	}

	dispose(): void {
		for (const d of this.disposables) {
			try {
				d.dispose();
			} catch {
				// best-effort
			}
		}
		this.disposables.length = 0;
		this._onDidChangeTreeData.dispose();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: RunningAgentsTreeItem): TreeItem {
		return element;
	}

	getChildren(
		element?: RunningAgentsTreeItem
	): Promise<RunningAgentsTreeItem[]> {
		if (!element) {
			return Promise.resolve([
				this.groupItem("active"),
				this.groupItem("recent"),
				this.groupItem("orphans"),
			]);
		}

		switch (element.nodeKind) {
			case "group-active":
				return this.renderActiveLeaves();
			case "group-recent":
				return this.renderRecentLeaves();
			case "group-orphans":
				return this.renderOrphanLeaves();
			default:
				return Promise.resolve([]);
		}
	}

	// ------------------------------------------------------------------
	// Group + leaf factories
	// ------------------------------------------------------------------

	private groupItem(
		kind: "active" | "recent" | "orphans"
	): RunningAgentsTreeItem {
		const item = new TreeItem(
			GROUP_LABELS[kind],
			TreeItemCollapsibleState.Expanded
		) as RunningAgentsTreeItem;
		item.contextValue = GROUP_CONTEXT_VALUES[kind];
		item.nodeKind = `group-${kind}` as RunningAgentsTreeItem["nodeKind"];
		item.iconPath = new ThemeIcon(groupIcon(kind));
		return item;
	}

	private async renderActiveLeaves(): Promise<RunningAgentsTreeItem[]> {
		const sessions = await this.store.listActive();
		return sessions
			.slice()
			.sort(sortByUpdatedAtDesc)
			.map((s) => this.sessionLeaf(s));
	}

	private async renderRecentLeaves(): Promise<RunningAgentsTreeItem[]> {
		const sessions = await this.store.listRecent();
		return sessions
			.slice()
			.sort(sortByUpdatedAtDesc)
			.map((s) => this.sessionLeaf(s));
	}

	private async renderOrphanLeaves(): Promise<RunningAgentsTreeItem[]> {
		const orphans = await this.store.listOrphanedWorktrees();
		return orphans
			.slice()
			.sort((a, b) => b.recordedAt - a.recordedAt)
			.map((o) => this.orphanLeaf(o));
	}

	private sessionLeaf(session: AgentChatSession): RunningAgentsTreeItem {
		const item = new TreeItem(
			session.agentDisplayName,
			TreeItemCollapsibleState.None
		) as RunningAgentsTreeItem;
		item.sessionId = session.id;
		item.nodeKind = "session";
		item.description = describeSession(session);
		item.tooltip = `${session.agentDisplayName}${
			session.selectedModeId ? ` · ${session.selectedModeId}` : ""
		} · ${session.executionTarget.kind} · ${session.lifecycleState}`;
		item.contextValue = isWorktreeBacked(session)
			? SESSION_WORKTREE_CONTEXT_VALUE
			: SESSION_CONTEXT_VALUE;
		item.iconPath = new ThemeIcon(lifecycleIcon(session.lifecycleState));
		item.command = {
			command: OPEN_FOR_SESSION_COMMAND_ID,
			title: "Open Agent Chat",
			arguments: [session.id],
		};
		return item;
	}

	private orphanLeaf(entry: OrphanedWorktreeEntry): RunningAgentsTreeItem {
		const item = new TreeItem(
			entry.branchName,
			TreeItemCollapsibleState.None
		) as RunningAgentsTreeItem;
		item.orphanId = entry.sessionId;
		item.nodeKind = "orphan";
		item.description = entry.absolutePath;
		item.tooltip = `Orphaned worktree at ${entry.absolutePath} (branch ${entry.branchName})`;
		item.contextValue = ORPHAN_CONTEXT_VALUE;
		item.iconPath = new ThemeIcon("git-commit");
		return item;
	}
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function sortByUpdatedAtDesc(a: AgentChatSession, b: AgentChatSession): number {
	return b.updatedAt - a.updatedAt;
}

function isWorktreeBacked(session: AgentChatSession): boolean {
	return session.executionTarget.kind === "worktree";
}

function describeSession(session: AgentChatSession): string {
	const parts: string[] = [];
	if (session.selectedModeId) {
		parts.push(session.selectedModeId);
	}
	parts.push(session.executionTarget.kind);
	parts.push(session.lifecycleState);
	return parts.join(" · ");
}

function groupIcon(kind: "active" | "recent" | "orphans"): string {
	if (kind === "active") {
		return "play-circle";
	}
	if (kind === "recent") {
		return "history";
	}
	return "warning";
}

function lifecycleIcon(state: AgentChatSession["lifecycleState"]): string {
	switch (state) {
		case "initializing":
			return "loading~spin";
		case "running":
			return "play";
		case "waiting-for-input":
			return "bell";
		case "completed":
			return "check";
		case "failed":
			return "error";
		case "cancelled":
			return "stop-circle";
		case "ended-by-shutdown":
			return "debug-disconnect";
		default:
			return "circle-outline";
	}
}
