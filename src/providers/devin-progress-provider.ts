/**
 * Devin Progress Tree View Provider
 *
 * Provides a VS Code tree view showing active and recent Devin sessions
 * with their current status, tasks, and pull requests.
 *
 * @see specs/001-devin-integration/plan.md:L72-L73
 */

import {
	type Event,
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	type TreeDataProvider,
	Uri,
} from "vscode";
import type { DevinSessionStorage } from "../features/devin/devin-session-storage";
import type { DevinSession, DevinTask } from "../features/devin/entities";
import { SessionStatus, TaskStatus } from "../features/devin/types";

// ============================================================================
// Tree Item Types
// ============================================================================

type DevinTreeItem = SessionTreeItem | TaskTreeItem | InfoTreeItem;

const PR_NUMBER_PATTERN = /\/(?:pull|merge_requests|pull-requests)\/([0-9]+)/i;

export class SessionTreeItem extends TreeItem {
	readonly session: DevinSession;

	constructor(session: DevinSession) {
		super(
			session.tasks[0]?.title ?? `Session ${session.localId.slice(0, 8)}`,
			TreeItemCollapsibleState.Collapsed
		);
		this.description = session.status;
		this.iconPath = getSessionIcon(session.status);
		this.tooltip = `Branch: ${session.branch}\nStatus: ${session.status}\nCreated: ${new Date(session.createdAt).toLocaleString()}`;
		this.session = session;
		this.contextValue = `devinSession.${session.status}`;
	}
}

class TaskTreeItem extends TreeItem {
	readonly task: DevinTask;

	constructor(task: DevinTask) {
		super(task.title, TreeItemCollapsibleState.None);
		this.task = task;
		this.description = task.status;
		this.iconPath = getTaskIcon(task.status);
		this.tooltip = `${task.specTaskId}: ${task.title}\nPriority: ${task.priority}\nStatus: ${task.status}`;
	}
}

class InfoTreeItem extends TreeItem {
	constructor(label: string, description?: string) {
		super(label, TreeItemCollapsibleState.None);
		this.description = description;
	}
}

// ============================================================================
// Provider
// ============================================================================

/**
 * Tree data provider for the Devin progress sidebar view.
 */
export class DevinProgressProvider implements TreeDataProvider<DevinTreeItem> {
	static readonly viewId = "gatomia.views.devinProgress";

	private readonly _onDidChangeTreeData = new EventEmitter<
		DevinTreeItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: Event<DevinTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private readonly storage: DevinSessionStorage;

	constructor(storage: DevinSessionStorage) {
		this.storage = storage;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: DevinTreeItem): TreeItem {
		return element;
	}

	getChildren(element?: DevinTreeItem): DevinTreeItem[] {
		if (!element) {
			return this.getRootItems();
		}
		if (element instanceof SessionTreeItem) {
			return this.getSessionChildren(element.session);
		}
		return [];
	}

	private getRootItems(): DevinTreeItem[] {
		const sessions = this.storage.getAll();

		if (sessions.length === 0) {
			return [
				new InfoTreeItem(
					"No Devin sessions",
					"Start one from the Spec Explorer"
				),
			];
		}

		const active = sessions.filter(
			(s) =>
				s.status !== SessionStatus.COMPLETED &&
				s.status !== SessionStatus.FAILED &&
				s.status !== SessionStatus.CANCELLED
		);
		const completed = sessions.filter(
			(s) =>
				s.status === SessionStatus.COMPLETED ||
				s.status === SessionStatus.FAILED ||
				s.status === SessionStatus.CANCELLED
		);

		const items: DevinTreeItem[] = [];

		if (active.length > 0) {
			items.push(new InfoTreeItem(`Active (${active.length})`));
			for (const session of active) {
				items.push(new SessionTreeItem(session));
			}
		}

		if (completed.length > 0) {
			items.push(new InfoTreeItem(`Recent (${completed.length})`));
			for (const session of completed.slice(0, 10)) {
				items.push(new SessionTreeItem(session));
			}
		}

		return items;
	}

	private getSessionChildren(session: DevinSession): DevinTreeItem[] {
		const items: DevinTreeItem[] = [];

		for (const task of session.tasks) {
			items.push(new TaskTreeItem(task));
		}

		if (session.devinUrl) {
			const urlItem = new InfoTreeItem("Devin URL", session.devinUrl);
			urlItem.iconPath = new ThemeIcon("link-external");
			urlItem.command = {
				command: "vscode.open",
				title: "Open Devin Session",
				arguments: [Uri.parse(session.devinUrl)],
			};
			items.push(urlItem);
		}

		if (session.pullRequests.length > 0) {
			for (const pr of session.pullRequests) {
				const prNumber = extractPrNumber(pr.prUrl);
				const label = prNumber ? `Pull Request #${prNumber}` : "Pull Request";
				const description = pr.prUrl || "No URL available";
				const prItem = new InfoTreeItem(label, description);
				prItem.iconPath = new ThemeIcon("git-pull-request");
				if (pr.prUrl) {
					prItem.command = {
						command: "vscode.open",
						title: "Open Pull Request",
						arguments: [Uri.parse(pr.prUrl)],
					};
					prItem.tooltip = pr.prUrl;
				} else {
					prItem.tooltip = "Pull request URL not available yet";
				}
				items.push(prItem);
			}
		}

		return items;
	}
}

// ============================================================================
// Icon Helpers
// ============================================================================

function getSessionIcon(status: SessionStatus): ThemeIcon {
	switch (status) {
		case SessionStatus.QUEUED:
			return new ThemeIcon("clock");
		case SessionStatus.INITIALIZING:
			return new ThemeIcon("loading~spin");
		case SessionStatus.RUNNING:
			return new ThemeIcon("sync~spin");
		case SessionStatus.BLOCKED:
			return new ThemeIcon("warning");
		case SessionStatus.COMPLETED:
			return new ThemeIcon("check");
		case SessionStatus.FAILED:
			return new ThemeIcon("error");
		case SessionStatus.CANCELLED:
			return new ThemeIcon("circle-slash");
		default:
			return new ThemeIcon("question");
	}
}

/**
 * Extract pull request number from a PR URL.
 * Supports GitHub, GitLab, Bitbucket, and Azure DevOps patterns.
 */
function extractPrNumber(prUrl: string): string | undefined {
	if (!prUrl) {
		return;
	}
	const match = prUrl.match(PR_NUMBER_PATTERN);
	return match?.[1];
}

function getTaskIcon(status: TaskStatus): ThemeIcon {
	switch (status) {
		case TaskStatus.PENDING:
			return new ThemeIcon("circle-outline");
		case TaskStatus.QUEUED:
			return new ThemeIcon("clock");
		case TaskStatus.IN_PROGRESS:
			return new ThemeIcon("sync~spin");
		case TaskStatus.COMPLETED:
			return new ThemeIcon("check");
		case TaskStatus.FAILED:
			return new ThemeIcon("error");
		case TaskStatus.CANCELLED:
			return new ThemeIcon("circle-slash");
		default:
			return new ThemeIcon("question");
	}
}
