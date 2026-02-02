import {
	type Command,
	type Event,
	type ExtensionContext,
	type TreeDataProvider,
	EventEmitter,
	ThemeColor,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	workspace,
} from "vscode";
import type { Specification } from "../features/spec/review-flow/types";
import type { SpecManager } from "../features/spec/spec-manager";
import { SPEC_SYSTEM_MODE, type SpecSystemMode } from "../constants";
import {
	getSpecState,
	onReviewFlowStateChange,
} from "../features/spec/review-flow/state";
import { getSpecSystemAdapter } from "../utils/spec-kit-adapter";
import { basename, join } from "node:path";
import type { IDocumentVersionService } from "../features/documents/version-tracking/types";
import {
	parseTasksFromFile,
	getTaskStatusIcon,
	getTaskStatusTooltip,
	getGroupStatusIcon,
	calculateGroupStatus,
	calculateOverallStatus,
	type ParsedTask,
	type TaskStatus,
} from "../utils/task-parser";
import { getChecklistStatusFromFile } from "../utils/checklist-parser";

const MARKDOWN_EXTENSION_PATTERN = /\.md$/;

export class SpecExplorerProvider implements TreeDataProvider<SpecItem> {
	static readonly viewId = "gatomia.views.specExplorer";
	static readonly navigateRequirementsCommandId =
		"gatomia.spec.navigate.requirements";
	static readonly navigateDesignCommandId = "gatomia.spec.navigate.design";
	static readonly navigateTasksCommandId = "gatomia.spec.navigate.tasks";
	static readonly openSpecCommandId = "gatomia.spec.open";

	private readonly _onDidChangeTreeData: EventEmitter<
		SpecItem | undefined | null | void
	> = new EventEmitter<SpecItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<SpecItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private specManager!: SpecManager;
	private readonly context: ExtensionContext;
	private readonly versionService?: IDocumentVersionService;

	constructor(
		context: ExtensionContext,
		versionService?: IDocumentVersionService
	) {
		this.context = context;
		this.versionService = versionService;
		// Listen for review flow state changes (e.g. status updates, change requests)
		// and refresh the tree view to reflect the new state.
		context.subscriptions.push(
			onReviewFlowStateChange(() => {
				this.refresh();
			})
		);
		// Listen for version updates and refresh tree view to show new version numbers
		if (versionService) {
			context.subscriptions.push(
				versionService.onDidUpdateVersion(() => {
					this.refresh();
				})
			);
		}
	}

	private async createSpecItem(
		label: string,
		specId: string,
		system?: SpecSystemMode
	): Promise<SpecItem> {
		const item = new SpecItem(
			label,
			TreeItemCollapsibleState.Collapsed,
			"spec-current",
			this.context,
			specId,
			undefined,
			undefined,
			undefined,
			undefined,
			system
		);
		const state = getSpecState(specId);
		if (state) {
			const reviewExitTooltip = this.getReviewExitTooltip(state);
			if (reviewExitTooltip) {
				item.tooltip = reviewExitTooltip;
			}
		}
		// Add version information if available
		await this.addVersionInfo(item, specId);
		return item;
	}

	private async createReviewSpecItem(
		label: string,
		specId: string,
		system?: SpecSystemMode
	): Promise<SpecItem> {
		const item = new SpecItem(
			label,
			TreeItemCollapsibleState.Collapsed,
			"spec-review",
			this.context,
			specId,
			undefined,
			undefined,
			undefined,
			undefined,
			system
		);
		const state = getSpecState(specId);
		if (state) {
			item.description = this.describeReviewSpec(state);
		} else {
			item.description = "Awaiting review metadata";
		}
		// Add version information if available
		await this.addVersionInfo(item, specId);
		return item;
	}

	/**
	 * Add version information to a spec item.
	 * Fetches version metadata and history from DocumentVersionService and updates the item's description and tooltip.
	 *
	 * @param item - The SpecItem to update with version information
	 * @param specId - The spec ID (e.g., "001-feature-name")
	 */
	private async addVersionInfo(item: SpecItem, specId: string): Promise<void> {
		if (!this.versionService) {
			return; // Version service not available
		}

		try {
			const metadata = await this.findVersionMetadata(specId);
			if (!metadata) {
				return;
			}

			// Add version to description
			this.addVersionToDescription(item, metadata.version);

			// Fetch and add version history to tooltip
			const specPath = this.getSpecPath(specId, metadata.specPath);
			await this.addVersionHistoryToTooltip(item, specPath, metadata);
		} catch (error) {
			// Silently fail - version info is optional enhancement
			console.debug("Failed to fetch version info for spec:", specId, error);
		}
	}

	/**
	 * Find version metadata for a spec ID by checking multiple paths.
	 * @returns Metadata and the path where it was found, or null
	 */
	private async findVersionMetadata(specId: string): Promise<{
		version: string;
		lastModified?: string;
		owner: string;
		specPath: string;
	} | null> {
		const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) {
			return null;
		}

		// Try both specs/ and .specify/ directory structures
		const specPaths = [
			join(workspaceRoot, "specs", specId, "spec.md"),
			join(workspaceRoot, ".specify", "specs", specId, "spec.md"),
		];

		for (const specPath of specPaths) {
			const metadata = await this.versionService?.getDocumentMetadata(specPath);
			if (metadata) {
				return {
					version: metadata.version,
					lastModified: metadata.lastModified,
					owner: metadata.owner,
					specPath,
				};
			}
		}

		return null;
	}

	/**
	 * Add version suffix to item description.
	 */
	private addVersionToDescription(item: SpecItem, version: string): void {
		const versionSuffix = ` (v${version})`;
		item.description = item.description
			? `${item.description}${versionSuffix}`
			: `v${version}`;
	}

	/**
	 * Get spec path from metadata or reconstruct from specId.
	 */
	private getSpecPath(
		specId: string,
		metadataPath: string | undefined
	): string {
		if (metadataPath) {
			return metadataPath;
		}
		const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
		return join(workspaceRoot || "", "specs", specId, "spec.md");
	}

	/**
	 * Add version history to item tooltip.
	 */
	private async addVersionHistoryToTooltip(
		item: SpecItem,
		specPath: string,
		metadata: { version: string; lastModified?: string; owner: string }
	): Promise<void> {
		const history = await this.versionService?.getVersionHistory(specPath);
		if (!history) {
			return;
		}

		const recentHistory = history.slice(-5).reverse();

		// Build tooltip
		const originalTooltip =
			typeof item.tooltip === "string" ? item.tooltip : item.label;
		let versionInfo = `\n\nVersion: ${metadata.version}\nLast modified: ${metadata.lastModified || "Unknown"}\nOwner: ${metadata.owner}`;

		if (recentHistory.length > 0) {
			versionInfo += "\n\nRecent Changes:";
			for (const entry of recentHistory) {
				versionInfo += this.formatHistoryEntry(entry);
			}
		}

		item.tooltip = `${originalTooltip}${versionInfo}`;
	}

	/**
	 * Format a single version history entry.
	 */
	private formatHistoryEntry(entry: {
		timestamp: string;
		previousVersion: string;
		newVersion: string;
		author: string;
	}): string {
		const timestamp = new Date(entry.timestamp).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
		const change =
			entry.previousVersion === ""
				? `v${entry.newVersion} (created)`
				: `v${entry.previousVersion} → v${entry.newVersion}`;
		return `\n  ${timestamp}: ${change} by ${entry.author}`;
	}

	private async createArchivedSpecItem(
		label: string,
		specId: string,
		system?: SpecSystemMode
	): Promise<SpecItem> {
		const item = new SpecItem(
			label,
			TreeItemCollapsibleState.Collapsed,
			"spec-archived",
			this.context,
			specId,
			undefined,
			undefined,
			undefined,
			undefined,
			system
		);
		const state = getSpecState(specId);
		if (state?.archivedAt) {
			item.description = `Archived ${state.archivedAt.toLocaleDateString()}`;
		} else {
			item.description = "Archived";
		}
		//Add version information if available
		await this.addVersionInfo(item, specId);
		return item;
	}

	private describeReviewSpec(state: Specification): string {
		const pendingTasks = state.pendingTasks ?? 0;
		const pendingChecklistItems = state.pendingChecklistItems ?? 0;
		const openChangeRequests =
			state.changeRequests?.filter((cr) => cr.status !== "addressed").length ??
			0;
		const parts: string[] = [];
		if (pendingTasks > 0) {
			parts.push(`${pendingTasks} task${pendingTasks === 1 ? "" : "s"}`);
		}
		if (pendingChecklistItems > 0) {
			parts.push(
				`${pendingChecklistItems} checklist item${pendingChecklistItems === 1 ? "" : "s"}`
			);
		}
		if (openChangeRequests > 0) {
			parts.push(
				`${openChangeRequests} change request${openChangeRequests === 1 ? "" : "s"}`
			);
		}
		return parts.length > 0 ? parts.join(" | ") : "Ready for reviewers";
	}

	private getReviewExitTooltip(state: Specification): string | null {
		if (!(state.status === "current" || state.status === "reopened")) {
			return null;
		}
		if (!state.reviewEnteredAt) {
			return null;
		}
		const pendingTasks = state.pendingTasks ?? 0;
		const pendingChecklistItems = state.pendingChecklistItems ?? 0;
		if (pendingTasks === 0 && pendingChecklistItems === 0) {
			return null;
		}
		const parts: string[] = [];
		if (pendingTasks > 0) {
			parts.push(`${pendingTasks} task${pendingTasks === 1 ? "" : "s"}`);
		}
		if (pendingChecklistItems > 0) {
			parts.push(
				`${pendingChecklistItems} checklist item${pendingChecklistItems === 1 ? "" : "s"}`
			);
		}
		return `Returned from Review: ${parts.join(" | ")}`;
	}

	setSpecManager(specManager: SpecManager) {
		this.specManager = specManager;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SpecItem): TreeItem {
		return element;
	}

	/**
	 * Calculate aggregate status for all checklists in a folder
	 */
	private async calculateChecklistsFolderStatus(
		folderPath: string
	): Promise<TaskStatus> {
		try {
			const { readdirSync, statSync } = await import("node:fs");
			const entries = readdirSync(folderPath);

			let totalItems = 0;
			let completedItems = 0;

			for (const entry of entries) {
				if (entry.endsWith(".md")) {
					const filePath = join(folderPath, entry);
					const stat = statSync(filePath);

					if (stat.isFile()) {
						const status = getChecklistStatusFromFile(filePath);
						totalItems += status.total;
						completedItems += status.completed;
					}
				}
			}

			if (totalItems === 0) {
				return "not-started";
			}

			if (completedItems === totalItems) {
				return "completed";
			}

			if (completedItems > 0) {
				return "in-progress";
			}

			return "not-started";
		} catch {
			return "not-started";
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Tree provider maps multiple node types without a simpler branching model.
	async getChildren(element?: SpecItem): Promise<SpecItem[]> {
		if (!(workspace.workspaceFolders && this.specManager)) {
			return [];
		}

		if (!element) {
			return [
				new SpecItem(
					"Current Specs",
					TreeItemCollapsibleState.Expanded,
					"group-current-specs",
					this.context
				),
				new SpecItem(
					"Review",
					TreeItemCollapsibleState.Expanded,
					"group-review-specs",
					this.context
				),
				new SpecItem(
					"Archived",
					TreeItemCollapsibleState.Expanded,
					"group-archived-specs",
					this.context
				),
				new SpecItem(
					"Changes",
					TreeItemCollapsibleState.Expanded,
					"group-changes",
					this.context
				),
			];
		}

		const unifiedSpecs = await this.specManager.getAllSpecsUnified();

		if (element.contextValue === "group-current-specs") {
			const filtered = unifiedSpecs.filter((spec) => {
				const state = getSpecState(spec.id);
				return (
					!state || state.status === "current" || state.status === "reopened"
				);
			});
			return Promise.all(
				filtered.map((spec) =>
					this.createSpecItem(spec.name, spec.id, spec.system)
				)
			);
		}

		if (element.contextValue === "group-review-specs") {
			const filtered = unifiedSpecs.filter(
				(spec) => getSpecState(spec.id)?.status === "review"
			);
			return Promise.all(
				filtered.map((spec) =>
					this.createReviewSpecItem(spec.name, spec.id, spec.system)
				)
			);
		}

		if (element.contextValue === "group-archived-specs") {
			const filtered = unifiedSpecs.filter(
				(spec) => getSpecState(spec.id)?.status === "archived"
			);
			return Promise.all(
				filtered.map((spec) =>
					this.createArchivedSpecItem(spec.name, spec.id, spec.system)
				)
			);
		}

		if (element.contextValue === "group-changes") {
			const activeChangeRequests =
				await this.specManager.getActiveChangeRequests();
			return activeChangeRequests.map(
				({ specId, specTitle, changeRequest }) => {
					const item = new SpecItem(
						changeRequest.title,
						TreeItemCollapsibleState.None,
						"change-request",
						this.context,
						specId,
						undefined,
						undefined,
						undefined,
						changeRequest.id
					);
					// Pass the change request and spec title for enhanced display
					item.changeRequest = changeRequest;
					item.specTitle = specTitle;
					return item;
				}
			);
		}

		if (
			element.contextValue === "spec" ||
			element.contextValue === "spec-current" ||
			element.contextValue === "spec-review" ||
			element.contextValue === "spec-archived"
		) {
			// Handle SpecKit System
			if (element.system === SPEC_SYSTEM_MODE.SPECKIT) {
				const adapter = getSpecSystemAdapter();
				// Get files for this spec (returns absolute paths)
				const files = adapter.getSpecFiles(element.specName!);

				const items: SpecItem[] = [];

				// Map of filenames to display labels and types
				const fileMap: Record<string, { label: string; type: string }> = {
					"spec.md": { label: "Spec", type: "spec" },
					"plan.md": { label: "Plan", type: "plan" },
					"design.md": { label: "Design", type: "design" },
					"requirements.md": { label: "Requirements", type: "requirements" },
					"research.md": { label: "Research", type: "research" },
					"data-model.md": { label: "Data Model", type: "data-model" },
					"quickstart.md": { label: "Quickstart", type: "quickstart" },
				};

				for (const [docType, absolutePath] of Object.entries(files)) {
					const fileName = basename(absolutePath);

					// Handle tasks.md as a folder with task items
					if (fileName === "tasks.md") {
						const relativePath = workspace.asRelativePath(absolutePath);
						// Calculate overall status for tasks folder
						const taskGroups = parseTasksFromFile(absolutePath);
						const overallStatus = calculateOverallStatus(taskGroups);
						items.push(
							new SpecItem(
								"Tasks",
								TreeItemCollapsibleState.Collapsed,
								"tasks-folder",
								this.context,
								element.specName,
								"tasks",
								undefined,
								relativePath,
								undefined,
								element.system,
								undefined,
								overallStatus
							)
						);
						continue;
					}

					// Handle checklists folder
					if (docType === "checklists") {
						const relativePath = workspace.asRelativePath(absolutePath);
						// Calculate overall status for checklists folder
						const checklistsStatus =
							await this.calculateChecklistsFolderStatus(absolutePath);
						items.push(
							new SpecItem(
								"Checklists",
								TreeItemCollapsibleState.Collapsed,
								"checklists-folder",
								this.context,
								element.specName,
								"checklists",
								undefined,
								relativePath,
								undefined,
								element.system,
								undefined,
								checklistsStatus
							)
						);
						continue;
					}

					const fileInfo = fileMap[fileName] || {
						label: fileName,
						type: "file",
					};

					// Convert absolute path to relative path for the command
					const relativePath = workspace.asRelativePath(absolutePath);

					items.push(
						new SpecItem(
							fileInfo.label,
							TreeItemCollapsibleState.None,
							"spec-document",
							this.context,
							element.specName,
							fileInfo.type,
							{
								command: SpecExplorerProvider.openSpecCommandId,
								title: `Open ${fileInfo.label}`,
								arguments: [relativePath, fileInfo.type],
							},
							relativePath
						)
					);
				}

				return items;
			}

			// Handle OpenSpec System
			const specPath = `openspec/specs/${element.specName}/spec.md`;
			return [
				new SpecItem(
					"Spec",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName,
					"spec",
					{
						command: SpecExplorerProvider.openSpecCommandId,
						title: "Open Spec",
						arguments: [specPath, "spec"],
					},
					specPath
				),
			];
		}

		// Handle tasks folder - show task groups and tasks
		if (element.contextValue === "tasks-folder") {
			const tasksFilePath = element.filePath;
			if (!tasksFilePath) {
				return [];
			}

			// Get absolute path
			const workspaceRoot = workspace.workspaceFolders?.[0].uri.fsPath;
			if (!workspaceRoot) {
				return [];
			}

			const absolutePath = join(workspaceRoot, tasksFilePath);
			const taskGroups = parseTasksFromFile(absolutePath);

			if (taskGroups.length === 0) {
				return [];
			}

			// Return task groups as collapsible items
			return taskGroups.map((group) => {
				const groupStatus = calculateGroupStatus(group.tasks);
				return new SpecItem(
					group.name,
					TreeItemCollapsibleState.Collapsed,
					"task-group",
					this.context,
					element.specName,
					"task-group",
					undefined, // No command - clicking only expands/collapses
					tasksFilePath,
					group.name,
					element.system,
					undefined,
					groupStatus
				);
			});
		}

		// Handle task group - show individual tasks
		if (element.contextValue === "task-group") {
			const tasksFilePath = element.filePath;
			const groupName = element.parentName;
			if (!(tasksFilePath && groupName)) {
				return [];
			}

			// Get absolute path
			const workspaceRoot = workspace.workspaceFolders?.[0].uri.fsPath;
			if (!workspaceRoot) {
				return [];
			}

			const absolutePath = join(workspaceRoot, tasksFilePath);
			const taskGroups = parseTasksFromFile(absolutePath);

			// Find the matching group
			const group = taskGroups.find((g) => g.name === groupName);
			if (!group) {
				return [];
			}

			// Return individual tasks
			return group.tasks.map(
				(task) =>
					new SpecItem(
						`${task.id}: ${task.title}`,
						TreeItemCollapsibleState.None,
						"task-item",
						this.context,
						element.specName,
						"task",
						{
							command: SpecExplorerProvider.openSpecCommandId,
							title: "Open Tasks",
							arguments: [tasksFilePath, "tasks", task.line],
						},
						tasksFilePath,
						undefined,
						element.system,
						task
					)
			);
		}

		// Handle checklists folder - show individual checklist files
		if (element.contextValue === "checklists-folder") {
			const checklistsFolderPath = element.filePath;
			if (!checklistsFolderPath) {
				return [];
			}

			// Get absolute path
			const workspaceRoot = workspace.workspaceFolders?.[0].uri.fsPath;
			if (!workspaceRoot) {
				return [];
			}

			const absolutePath = join(workspaceRoot, checklistsFolderPath);

			try {
				const { readdirSync, statSync } = await import("node:fs");
				const entries = readdirSync(absolutePath);
				const checklistItems: SpecItem[] = [];

				for (const entry of entries) {
					if (entry.endsWith(".md")) {
						const filePath = join(absolutePath, entry);
						const stat = statSync(filePath);

						if (stat.isFile()) {
							const relativePath = workspace.asRelativePath(filePath);
							const displayName = entry.replace(MARKDOWN_EXTENSION_PATTERN, "");
							const formattedName =
								displayName.charAt(0).toUpperCase() +
								displayName.slice(1).replace(/-/g, " ");

							// Calculate checklist status for icon
							const checklistStatus = getChecklistStatusFromFile(filePath);

							checklistItems.push(
								new SpecItem(
									formattedName,
									TreeItemCollapsibleState.None,
									"checklist-item",
									this.context,
									element.specName,
									"checklist",
									{
										command: SpecExplorerProvider.openSpecCommandId,
										title: `Open ${formattedName}`,
										arguments: [relativePath, "checklist"],
									},
									relativePath,
									undefined,
									element.system,
									undefined,
									checklistStatus.status
								)
							);
						}
					}
				}

				return checklistItems;
			} catch (error) {
				console.error("Error reading checklists folder:", error);
				return [];
			}
		}

		if (element.contextValue === "change") {
			const basePath = `openspec/changes/${element.specName}`;
			return [
				new SpecItem(
					"Proposal",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName,
					"proposal",
					{
						command: SpecExplorerProvider.openSpecCommandId,
						title: "Open Proposal",
						arguments: [`${basePath}/proposal.md`, "proposal"],
					},
					`${basePath}/proposal.md`
				),
				new SpecItem(
					"Tasks",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName,
					"tasks",
					{
						command: SpecExplorerProvider.openSpecCommandId,
						title: "Open Tasks",
						arguments: [`${basePath}/tasks.md`, "tasks"],
					},
					`${basePath}/tasks.md`
				),
				new SpecItem(
					"Design",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName,
					"design",
					{
						command: SpecExplorerProvider.openSpecCommandId,
						title: "Open Design",
						arguments: [`${basePath}/design.md`, "design"],
					},
					`${basePath}/design.md`
				),
				new SpecItem(
					"Specs",
					TreeItemCollapsibleState.Collapsed,
					"change-specs-group",
					this.context,
					element.specName
				),
			];
		}

		if (element.contextValue === "change-specs-group") {
			const specs = await this.specManager.getChangeSpecs(element.specName!);
			return specs.map(
				(name) =>
					new SpecItem(
						name,
						TreeItemCollapsibleState.Collapsed,
						"change-spec",
						this.context,
						name,
						undefined,
						undefined,
						undefined,
						element.specName
					)
			);
		}

		if (element.contextValue === "change-spec") {
			const changeName = element.parentName!;
			const specName = element.specName!;
			const specPath = `openspec/changes/${changeName}/specs/${specName}/spec.md`;

			return [
				new SpecItem(
					"Spec",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					specName,
					"spec",
					{
						command: SpecExplorerProvider.openSpecCommandId,
						title: "Open Spec",
						arguments: [specPath, "spec"],
					},
					specPath
				),
			];
		}

		return [];
	}
}

class SpecItem extends TreeItem {
	readonly label: string;
	readonly collapsibleState: TreeItemCollapsibleState;
	readonly contextValue: string;
	private readonly context: ExtensionContext;
	readonly specName?: string;
	readonly documentType?: string;
	readonly command?: Command;
	readonly filePath?: string;
	readonly parentName?: string;
	readonly system?: SpecSystemMode;
	readonly task?: ParsedTask;
	readonly groupStatus?: TaskStatus;
	changeRequest?: import("../features/spec/review-flow/types").ChangeRequest;
	specTitle?: string;

	// biome-ignore lint/nursery/useMaxParams: ignore
	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		context: ExtensionContext,
		specName?: string,
		documentType?: string,
		command?: Command,
		filePath?: string,
		parentName?: string,
		system?: SpecSystemMode,
		task?: ParsedTask,
		groupStatus?: TaskStatus
	) {
		super(label, collapsibleState);
		this.label = label;
		this.collapsibleState = collapsibleState;
		this.contextValue = contextValue;
		this.context = context;
		this.specName = specName;
		this.documentType = documentType;
		this.command = command;
		this.filePath = filePath;
		this.parentName = parentName;
		this.system = system;
		this.task = task;
		this.groupStatus = groupStatus;

		this.updateIconAndTooltip();
	}

	private updateIconAndTooltip() {
		const handler = this.getContextHandler();
		if (handler) {
			handler();
			return;
		}

		if (
			this.contextValue.startsWith("group-") ||
			this.contextValue === "change-specs-group"
		) {
			this.iconPath = new ThemeIcon("folder");
		}
	}

	private getContextHandler(): (() => void) | undefined {
		const handlers: Record<string, () => void> = {
			spec: () => this.handleSpecIcon(),
			"spec-current": () => this.handleSpecIcon(),
			"spec-review": () => this.handleSpecIcon(),
			"spec-archived": () => this.handleSpecIcon(),
			change: () => this.handleSpecIcon(),
			"change-spec": () => this.handleSpecIcon(),
			"spec-document": () => this.updateDocumentIcon(),
			"tasks-folder": () => this.handleTasksFolderIcon(),
			"task-group": () => this.handleTaskGroupIcon(),
			"task-item": () => this.handleTaskItemIcon(),
			"checklists-folder": () => this.handleChecklistsFolderIcon(),
			"checklist-item": () => this.handleChecklistItemIcon(),
			"change-request": () => this.handleChangeRequestIcon(),
		};

		return handlers[this.contextValue];
	}

	private handleSpecIcon(): void {
		this.iconPath = new ThemeIcon("package");
		const systemLabel = this.system ? ` (${this.system})` : "";
		this.tooltip = `${this.contextValue}${systemLabel}: ${this.label}`;
	}

	private handleTasksFolderIcon(): void {
		const status = this.groupStatus ?? "not-started";
		const statusIcon = getGroupStatusIcon(status);
		const statusColor = this.getTaskStatusColor(status);
		this.iconPath = new ThemeIcon(statusIcon, statusColor);
		this.tooltip = "Tasks - Click to expand";
	}

	private handleTaskGroupIcon(): void {
		const status = this.groupStatus ?? "not-started";
		const statusIcon = getGroupStatusIcon(status);
		const statusColor = this.getTaskStatusColor(status);
		this.iconPath = new ThemeIcon(statusIcon, statusColor);
		this.tooltip = `${this.label} - Click to expand or run /speckit.implement`;
	}

	private handleTaskItemIcon(): void {
		if (!this.task) {
			return;
		}
		const statusIcon = getTaskStatusIcon(this.task.status);
		const statusColor = this.getTaskStatusColor(this.task.status);
		this.iconPath = new ThemeIcon(statusIcon, statusColor);

		const statusText = getTaskStatusTooltip(this.task.status);
		const priorityText = this.task.priority
			? ` | Priority: ${this.task.priority}`
			: "";
		const complexityText = this.task.complexity
			? ` | Complexity: ${this.task.complexity}`
			: "";
		this.tooltip = `${statusText}${priorityText}${complexityText}\n\nClick to open at line ${this.task.line}`;
		this.description = statusText;
	}

	private handleChecklistsFolderIcon(): void {
		const status = this.groupStatus ?? "not-started";
		const statusIcon = getGroupStatusIcon(status);
		const statusColor = this.getTaskStatusColor(status);
		this.iconPath = new ThemeIcon(statusIcon, statusColor);
		const statusText = getTaskStatusTooltip(status);
		this.tooltip = `Checklists - ${statusText}`;
	}

	private handleChecklistItemIcon(): void {
		const status = this.groupStatus ?? "not-started";
		const statusIcon = getGroupStatusIcon(status);
		const statusColor = this.getTaskStatusColor(status);
		this.iconPath = new ThemeIcon(statusIcon, statusColor);

		const statusText = getTaskStatusTooltip(status);
		this.tooltip = `Checklist: ${this.label} - ${statusText}`;
		this.description = statusText;
	}

	private handleChangeRequestIcon(): void {
		if (!this.changeRequest) {
			return;
		}

		// Icon based on severity
		const severityIcons = {
			critical: "error",
			high: "warning",
			medium: "info",
			low: "circle-outline",
		};
		const icon = severityIcons[this.changeRequest.severity];

		// Color based on severity
		const severityColors = {
			critical: new ThemeColor("errorForeground"),
			high: new ThemeColor("editorWarning.foreground"),
			medium: new ThemeColor("editorInfo.foreground"),
			low: new ThemeColor("descriptionForeground"),
		};
		const color = severityColors[this.changeRequest.severity];

		this.iconPath = new ThemeIcon(icon, color);

		// Build tooltip with details
		const statusEmoji = {
			open: "🔴",
			inProgress: "🟡",
			addressed: "✅",
		};
		const emoji = statusEmoji[this.changeRequest.status];

		const blockerText = this.changeRequest.archivalBlocker
			? " [BLOCKS ARCHIVAL]"
			: "";

		this.tooltip = `${emoji} ${this.changeRequest.title}\n\nSpec: ${this.specTitle}\nSeverity: ${this.changeRequest.severity}\nStatus: ${this.changeRequest.status}${blockerText}\nSubmitted: ${this.changeRequest.createdAt.toLocaleString()}\nSubmitter: ${this.changeRequest.submitter}`;

		// Set description to show spec name and severity
		this.description = `${this.specTitle} | ${this.changeRequest.severity}`;
	}

	private getTaskStatusColor(status?: TaskStatus): ThemeColor | undefined {
		switch (status) {
			case "completed":
				return new ThemeColor("terminal.ansiGreen");
			case "in-progress":
				return new ThemeColor("terminal.ansiYellow");
			case "not-started":
				return new ThemeColor("descriptionForeground");
			default:
				return;
		}
	}

	private updateDocumentIcon() {
		// Different icons for different document types
		if (this.documentType === "requirements" || this.documentType === "spec") {
			this.iconPath = new ThemeIcon("chip");
		} else if (this.documentType === "design") {
			this.iconPath = new ThemeIcon("layers");
		} else if (this.documentType === "tasks") {
			this.iconPath = new ThemeIcon("tasklist");
		} else if (this.documentType === "proposal") {
			this.iconPath = new ThemeIcon("lightbulb");
		} else if (this.documentType === "plan") {
			this.iconPath = new ThemeIcon("calendar");
		} else if (this.documentType === "research") {
			this.iconPath = new ThemeIcon("search");
		} else if (this.documentType === "data-model") {
			this.iconPath = new ThemeIcon("database");
		} else if (this.documentType === "quickstart") {
			this.iconPath = new ThemeIcon("rocket");
		} else {
			this.iconPath = new ThemeIcon("file");
		}

		this.tooltip = `${this.documentType}: ${this.label}`;

		// Set description to file path
		if (this.filePath) {
			this.description = this.filePath;
		}
	}
}
