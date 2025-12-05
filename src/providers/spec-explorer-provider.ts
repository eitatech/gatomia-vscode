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
import type { SpecManager } from "../features/spec/spec-manager";
import { SPEC_SYSTEM_MODE, type SpecSystemMode } from "../constants";
import { getSpecSystemAdapter } from "../utils/spec-kit-adapter";
import { basename, join } from "node:path";
import {
	parseTasksFromFile,
	getTaskStatusIcon,
	getTaskStatusTooltip,
	type ParsedTask,
	type TaskStatus,
} from "../utils/task-parser";

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

	constructor(context: ExtensionContext) {
		this.context = context;
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

	async getChildren(element?: SpecItem): Promise<SpecItem[]> {
		if (!(workspace.workspaceFolders && this.specManager)) {
			return [];
		}

		if (!element) {
			return [
				new SpecItem(
					"Changes",
					TreeItemCollapsibleState.Expanded,
					"group-changes",
					this.context
				),
				new SpecItem(
					"Current Specs",
					TreeItemCollapsibleState.Expanded,
					"group-specs",
					this.context
				),
			];
		}

		if (element.contextValue === "group-specs") {
			const unifiedSpecs = await this.specManager.getAllSpecsUnified();
			return unifiedSpecs.map(
				(spec) =>
					new SpecItem(
						spec.name,
						TreeItemCollapsibleState.Collapsed,
						"spec",
						this.context,
						spec.id,
						undefined,
						undefined,
						spec.path,
						undefined,
						spec.system
					)
			);
		}

		if (element.contextValue === "group-changes") {
			const changes = await this.specManager.getChanges();
			return changes.map(
				(name) =>
					new SpecItem(
						name,
						TreeItemCollapsibleState.Collapsed,
						"change",
						this.context,
						name
					)
			);
		}

		if (element.contextValue === "spec") {
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
								element.system
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
			return taskGroups.map(
				(group) =>
					new SpecItem(
						group.name,
						TreeItemCollapsibleState.Collapsed,
						"task-group",
						this.context,
						element.specName,
						"task-group",
						undefined,
						tasksFilePath,
						group.name,
						element.system
					)
			);
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
		task?: ParsedTask
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

		this.updateIconAndTooltip();
	}

	private updateIconAndTooltip() {
		if (
			this.contextValue === "spec" ||
			this.contextValue === "change" ||
			this.contextValue === "change-spec"
		) {
			this.iconPath = new ThemeIcon("package");
			const systemLabel = this.system ? ` (${this.system})` : "";
			this.tooltip = `${this.contextValue}${systemLabel}: ${this.label}`;
			return;
		}

		if (this.contextValue === "spec-document") {
			this.updateDocumentIcon();
			return;
		}

		// Handle tasks folder
		if (this.contextValue === "tasks-folder") {
			this.iconPath = new ThemeIcon("tasklist");
			this.tooltip = "Tasks - Click to expand";
			return;
		}

		// Handle task group (phase)
		if (this.contextValue === "task-group") {
			this.iconPath = new ThemeIcon("folder");
			this.tooltip = `Phase: ${this.label}`;
			return;
		}

		// Handle individual task item with status icon
		if (this.contextValue === "task-item" && this.task) {
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
			return;
		}

		if (
			this.contextValue.startsWith("group-") ||
			this.contextValue === "change-specs-group"
		) {
			this.iconPath = new ThemeIcon("folder");
		}
	}

	private getTaskStatusColor(status: TaskStatus): ThemeColor | undefined {
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
