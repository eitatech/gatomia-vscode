/**
 * Cloud Agent Progress Provider
 *
 * Provider-agnostic tree view data provider for the Cloud Agents sidebar.
 * Shows sessions with task details, external links, and status icons.
 *
 * @see specs/016-multi-provider-agents/plan.md
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import {
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	commands,
	type Event,
	type TreeDataProvider,
} from "vscode";
import type { AgentSessionStorage } from "../features/cloud-agents/agent-session-storage";
import type { ProviderRegistry } from "../features/cloud-agents/provider-registry";
import type { AgentSession, AgentTask } from "../features/cloud-agents/types";

// ============================================================================
// Tree Item IDs
// ============================================================================

/**
 * Wrapper that carries session/task data through the tree.
 */
class CloudAgentTreeItem extends TreeItem {
	readonly session: AgentSession | undefined;
	readonly agentTask: AgentTask | undefined;

	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		session?: AgentSession,
		agentTask?: AgentTask
	) {
		super(label, collapsibleState);
		this.session = session;
		this.agentTask = agentTask;
	}
}

// ============================================================================
// CloudAgentProgressProvider
// ============================================================================

/**
 * Tree view data provider for the Cloud Agents sidebar.
 * Shows active provider sessions with tasks, external links, and PR info.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */
export class CloudAgentProgressProvider
	implements TreeDataProvider<CloudAgentTreeItem>
{
	private readonly registry: ProviderRegistry;
	private readonly sessionStorage: AgentSessionStorage | undefined;
	private readonly _onDidChangeTreeData = new EventEmitter<
		CloudAgentTreeItem | undefined | null
	>();
	readonly onDidChangeTreeData: Event<CloudAgentTreeItem | undefined | null> =
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

	getTreeItem(element: CloudAgentTreeItem): CloudAgentTreeItem {
		return element;
	}

	async getChildren(
		element?: CloudAgentTreeItem
	): Promise<CloudAgentTreeItem[]> {
		if (element?.session && !element.agentTask) {
			return this.getSessionChildren(element.session);
		}

		const active = this.registry.getActive();
		if (!active) {
			return [];
		}

		if (!this.sessionStorage) {
			return [];
		}

		const allSessions = await this.sessionStorage.getAll();
		if (allSessions.length === 0) {
			const item = new CloudAgentTreeItem(
				"No sessions",
				TreeItemCollapsibleState.None
			);
			item.description = active.metadata.displayName;
			return [item];
		}

		return allSessions.map((s) =>
			this.createSessionItem(s, active.metadata.id)
		);
	}

	private createSessionItem(
		session: AgentSession,
		activeProviderId: string
	): CloudAgentTreeItem {
		const firstTask = session.tasks[0];
		const label = firstTask
			? `${firstTask.specTaskId}: ${firstTask.title}`
			: session.localId;

		const hasTasks =
			session.tasks.length > 0 || session.pullRequests.length > 0;
		const item = new CloudAgentTreeItem(
			label,
			hasTasks
				? TreeItemCollapsibleState.Collapsed
				: TreeItemCollapsibleState.None,
			session
		);

		item.description = session.isReadOnly
			? `${session.status} (read-only)`
			: session.status;

		const tooltipLines = [
			`Status: ${session.status}`,
			`Provider: ${session.providerId}`,
			`Branch: ${session.branch}`,
			`Spec: ${session.specPath}`,
		];
		if (session.externalUrl) {
			tooltipLines.push(`URL: ${session.externalUrl}`);
		}
		if (session.tasks.length > 1) {
			tooltipLines.push(`Tasks: ${session.tasks.length}`);
		}
		if (session.pullRequests.length > 0) {
			tooltipLines.push(`PRs: ${session.pullRequests.length}`);
		}
		item.tooltip = tooltipLines.join("\n");

		item.iconPath = this.getStatusIcon(session.status);
		item.contextValue =
			session.providerId === activeProviderId && !session.isReadOnly
				? `session.${session.status}`
				: "session.readonly";

		if (session.externalUrl) {
			item.command = {
				command: "vscode.open",
				title: "Open in Browser",
				arguments: [Uri.parse(session.externalUrl)],
			};
		}

		return item;
	}

	private getSessionChildren(session: AgentSession): CloudAgentTreeItem[] {
		const children: CloudAgentTreeItem[] = [];

		for (const task of session.tasks) {
			const taskItem = new CloudAgentTreeItem(
				`${task.specTaskId}: ${task.title}`,
				TreeItemCollapsibleState.None,
				session,
				task
			);
			taskItem.description = task.status;
			taskItem.iconPath = this.getTaskStatusIcon(task.status);
			taskItem.tooltip = [
				`Task: ${task.title}`,
				`Status: ${task.status}`,
				`Priority: ${task.priority}`,
			].join("\n");
			children.push(taskItem);
		}

		for (const pr of session.pullRequests) {
			const prItem = new CloudAgentTreeItem(
				`PR: ${pr.branch}`,
				TreeItemCollapsibleState.None,
				session
			);
			prItem.description = pr.state ?? "open";
			prItem.iconPath = new ThemeIcon("git-pull-request");
			prItem.tooltip = pr.url;
			prItem.command = {
				command: "vscode.open",
				title: "Open Pull Request",
				arguments: [Uri.parse(pr.url)],
			};
			children.push(prItem);
		}

		if (session.externalUrl) {
			const linkItem = new CloudAgentTreeItem(
				"Open in Provider",
				TreeItemCollapsibleState.None,
				session
			);
			linkItem.iconPath = new ThemeIcon("link-external");
			linkItem.tooltip = session.externalUrl;
			linkItem.command = {
				command: "vscode.open",
				title: "Open in Browser",
				arguments: [Uri.parse(session.externalUrl)],
			};
			children.push(linkItem);
		}

		return children;
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

	private getTaskStatusIcon(status: string): ThemeIcon {
		switch (status) {
			case "in_progress":
				return new ThemeIcon("sync~spin");
			case "completed":
				return new ThemeIcon("pass");
			case "failed":
				return new ThemeIcon("error");
			case "skipped":
				return new ThemeIcon("circle-slash");
			default:
				return new ThemeIcon("circle-outline");
		}
	}

	dispose(): void {
		this._onDidChangeTreeData.dispose();
	}
}
