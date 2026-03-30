/**
 * Cloud Agent Progress Provider
 *
 * Provider-agnostic tree view data provider for the Cloud Agents sidebar.
 * Replaces the Devin-specific progress provider.
 *
 * @see specs/016-multi-provider-agents/plan.md
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import {
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	commands,
	type Event,
	type TreeDataProvider,
} from "vscode";
import type { AgentSessionStorage } from "../features/cloud-agents/agent-session-storage";
import type { ProviderRegistry } from "../features/cloud-agents/provider-registry";
import type { AgentSession } from "../features/cloud-agents/types";

// ============================================================================
// CloudAgentProgressProvider
// ============================================================================

/**
 * Tree view data provider for the Cloud Agents sidebar.
 * Shows active provider sessions and welcome state when unconfigured.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */
export class CloudAgentProgressProvider implements TreeDataProvider<TreeItem> {
	private readonly registry: ProviderRegistry;
	private readonly sessionStorage: AgentSessionStorage | undefined;
	private readonly _onDidChangeTreeData = new EventEmitter<
		TreeItem | undefined | null
	>();
	readonly onDidChangeTreeData: Event<TreeItem | undefined | null> =
		this._onDidChangeTreeData.event;

	constructor(
		registry: ProviderRegistry,
		sessionStorage?: AgentSessionStorage
	) {
		this.registry = registry;
		this.sessionStorage = sessionStorage;
	}

	/**
	 * Refresh the tree view.
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire(null);
	}

	/**
	 * Update the context key for welcome content visibility.
	 */
	async updateContextKeys(): Promise<void> {
		const active = this.registry.getActive();
		await commands.executeCommand(
			"setContext",
			"gatomia.cloudAgent.hasProvider",
			active !== undefined
		);
		if (active) {
			await commands.executeCommand(
				"setContext",
				"gatomia.cloudAgent.activeProvider",
				active.metadata.id
			);
		}
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	async getChildren(_element?: TreeItem): Promise<TreeItem[]> {
		const active = this.registry.getActive();
		if (!active) {
			return [];
		}

		if (!this.sessionStorage) {
			const item = new TreeItem(
				active.metadata.displayName,
				TreeItemCollapsibleState.None
			);
			item.description = "Active";
			item.tooltip = active.metadata.description;
			return [item];
		}

		const allSessions = await this.sessionStorage.getAll();
		if (allSessions.length === 0) {
			const item = new TreeItem("No sessions", TreeItemCollapsibleState.None);
			item.description = active.metadata.displayName;
			return [item];
		}

		return allSessions.map((session) =>
			this.createSessionTreeItem(session, active.metadata.id)
		);
	}

	private createSessionTreeItem(
		session: AgentSession,
		activeProviderId: string
	): TreeItem {
		const label = session.specPath.split("/").pop() ?? session.localId;
		const item = new TreeItem(label, TreeItemCollapsibleState.None);
		item.description = session.isReadOnly
			? `${session.status} (read-only)`
			: session.status;
		item.tooltip = `Branch: ${session.branch}\nProvider: ${session.providerId}\nStatus: ${session.status}`;
		item.iconPath = this.getStatusIcon(session.status);
		item.contextValue =
			session.providerId === activeProviderId && !session.isReadOnly
				? `session.${session.status}`
				: "session.readonly";
		return item;
	}

	private getStatusIcon(status: string): ThemeIcon {
		switch (status) {
			case "running":
				return new ThemeIcon("sync~spin");
			case "completed":
				return new ThemeIcon("check");
			case "failed":
				return new ThemeIcon("error");
			case "blocked":
				return new ThemeIcon("warning");
			case "cancelled":
				return new ThemeIcon("circle-slash");
			default:
				return new ThemeIcon("circle-outline");
		}
	}

	dispose(): void {
		this._onDidChangeTreeData.dispose();
	}
}
