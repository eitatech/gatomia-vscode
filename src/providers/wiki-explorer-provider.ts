import {
	type Event,
	type ExtensionContext,
	type Progress,
	type TreeDataProvider,
	EventEmitter,
	ProgressLocation,
	ThemeColor,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	window,
	workspace,
} from "vscode";
import { basename, dirname, join, relative } from "node:path";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { extractDocumentTitle } from "../utils/yaml-frontmatter-parser";
import { toFriendlyName } from "../utils/document-title-utils";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MARKDOWN_EXTENSION = ".md";

export type WikiItemStatus =
	| "idle"
	| "updating"
	| "completed"
	| "failed"
	| "pending";

export interface WikiDocument {
	/** Absolute path to the file */
	path: string;
	/** Display title (from frontmatter, H1, or filename) */
	title: string;
	/** Relative path from docs directory */
	relativePath: string;
	/** Current update status */
	status: WikiItemStatus;
	/** Error message if status is 'failed' */
	error?: string;
}

export class WikiExplorerProvider implements TreeDataProvider<WikiItem> {
	static readonly viewId = "gatomia.views.wikiExplorer";
	static readonly openCommandId = "gatomia.wiki.open";
	static readonly refreshCommandId = "gatomia.wiki.refresh";
	static readonly updateCommandId = "gatomia.wiki.update";
	static readonly updateAllCommandId = "gatomia.wiki.updateAll";
	static readonly showTocCommandId = "gatomia.wiki.showToc";

	private readonly _onDidChangeTreeData: EventEmitter<
		WikiItem | undefined | null | void
	> = new EventEmitter<WikiItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<WikiItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private readonly context: ExtensionContext;
	private readonly documents: Map<string, WikiDocument> = new Map();
	private isUpdatingAll = false;
	private completedCount = 0;
	private failedCount = 0;

	constructor(context: ExtensionContext) {
		this.context = context;
	}

	refresh(): void {
		this.documents.clear();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: WikiItem): TreeItem {
		return element;
	}

	getChildren(element?: WikiItem): WikiItem[] | Promise<WikiItem[]> {
		if (!workspace.workspaceFolders) {
			return [];
		}

		const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
		const docsPath = join(workspaceRoot, "docs");

		if (!existsSync(docsPath)) {
			return [];
		}

		// Root level - show status header if updating all, then documents
		if (!element) {
			return this.getRootChildren(docsPath);
		}

		// Folder level - show documents in folder
		if (element.contextValue === "wiki-folder" && element.folderPath) {
			return this.getFolderChildren(element.folderPath);
		}

		return [];
	}

	private getRootChildren(docsPath: string): WikiItem[] {
		const items: WikiItem[] = [];

		// Add status item if updating
		if (this.isUpdatingAll) {
			items.push(this.createStatusItem());
		}

		// Add Synchronize button item at the top
		items.push(this.createSyncItem());

		// Load documents from docs directory
		const docs = this.loadDocuments(docsPath, docsPath);

		// Group by parent folder for hierarchical display
		const grouped = this.groupDocumentsByFolder(docs);

		// Add folders and standalone documents
		this.addGroupedItems(items, grouped);

		return items;
	}

	private createStatusItem(): WikiItem {
		const totalDocs = this.documents.size;
		const processed = this.completedCount + this.failedCount;
		const statusItem = new WikiItem({
			label: `Completed ${processed}/${totalDocs}, failed: ${this.failedCount}`,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: "wiki-status",
		});
		statusItem.iconPath = new ThemeIcon(
			processed === totalDocs ? "check" : "sync~spin"
		);
		return statusItem;
	}

	private createSyncItem(): WikiItem {
		const syncItem = new WikiItem({
			label: "Synchronize",
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: "wiki-sync-button",
		});
		syncItem.iconPath = new ThemeIcon("sync");
		syncItem.command = {
			command: WikiExplorerProvider.updateAllCommandId,
			title: "Synchronize All Documents",
		};
		return syncItem;
	}

	private addGroupedItems(
		items: WikiItem[],
		grouped: Map<string, WikiDocument[]>
	): void {
		for (const [folder, folderDocs] of grouped) {
			if (folder === "") {
				// Root-level documents
				for (const doc of folderDocs) {
					items.push(this.createDocumentItem(doc));
				}
			} else {
				// Folder with documents
				items.push(this.createFolderItem(folder));
			}
		}
	}

	private createFolderItem(folder: string): WikiItem {
		const folderItem = new WikiItem({
			label: this.formatFolderName(folder),
			collapsibleState: TreeItemCollapsibleState.Collapsed,
			contextValue: "wiki-folder",
			folderPath: folder,
		});
		folderItem.iconPath = new ThemeIcon("folder");
		return folderItem;
	}

	private getFolderChildren(folderPath: string): WikiItem[] {
		const docs = Array.from(this.documents.values()).filter((doc) =>
			doc.relativePath.startsWith(`${folderPath}/`)
		);
		return docs.map((doc) => this.createDocumentItem(doc));
	}

	private loadDocuments(dirPath: string, baseDocsPath: string): WikiDocument[] {
		const documents: WikiDocument[] = [];

		try {
			const entries = readdirSync(dirPath);

			for (const entry of entries) {
				const fullPath = join(dirPath, entry);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					// Recurse into subdirectories
					documents.push(...this.loadDocuments(fullPath, baseDocsPath));
				} else if (entry.endsWith(MARKDOWN_EXTENSION)) {
					const relativePath = relative(baseDocsPath, fullPath);
					const doc = this.getOrCreateDocument(fullPath, relativePath);
					documents.push(doc);
				}
			}
		} catch {
			// Silently handle errors when loading documents
		}

		return documents;
	}

	private getOrCreateDocument(
		absolutePath: string,
		relativePath: string
	): WikiDocument {
		const existing = this.documents.get(absolutePath);
		if (existing) {
			return existing;
		}

		// Read file and extract title
		let title: string;
		try {
			const content = readFileSync(absolutePath, "utf-8");
			title =
				extractDocumentTitle(content) ?? toFriendlyName(basename(absolutePath));
		} catch {
			title = toFriendlyName(basename(absolutePath));
		}

		const doc: WikiDocument = {
			path: absolutePath,
			title,
			relativePath,
			status: "idle",
		};
		this.documents.set(absolutePath, doc);
		return doc;
	}

	private groupDocumentsByFolder(
		docs: WikiDocument[]
	): Map<string, WikiDocument[]> {
		const grouped = new Map<string, WikiDocument[]>();

		for (const doc of docs) {
			const folder = dirname(doc.relativePath);
			const key = folder === "." ? "" : folder;

			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)!.push(doc);
		}

		// Sort folders and documents within each folder
		const sortedMap = new Map<string, WikiDocument[]>();
		const sortedKeys = Array.from(grouped.keys()).sort();

		for (const key of sortedKeys) {
			const folderDocs = grouped.get(key)!;
			folderDocs.sort((a, b) => a.title.localeCompare(b.title));
			sortedMap.set(key, folderDocs);
		}

		return sortedMap;
	}

	private formatFolderName(folder: string): string {
		const name = basename(folder);
		return name.charAt(0).toUpperCase() + name.slice(1).replaceAll("-", " ");
	}

	private createDocumentItem(doc: WikiDocument): WikiItem {
		const item = new WikiItem({
			label: doc.title,
			collapsibleState: TreeItemCollapsibleState.None,
			contextValue: "wiki-document",
			documentPath: doc.path,
		});

		item.command = {
			command: WikiExplorerProvider.openCommandId,
			title: "Open Document",
			arguments: [doc.path],
		};

		item.tooltip = doc.relativePath;

		// Status-based icons
		switch (doc.status) {
			case "updating":
				item.iconPath = new ThemeIcon("sync~spin");
				break;
			case "completed":
				item.iconPath = new ThemeIcon(
					"check",
					new ThemeColor("terminal.ansiGreen")
				);
				break;
			case "failed":
				item.iconPath = new ThemeIcon(
					"error",
					new ThemeColor("terminal.ansiRed")
				);
				item.tooltip = doc.error ?? "Update failed";
				break;
			case "pending":
				item.iconPath = new ThemeIcon("clock");
				break;
			default:
				item.iconPath = new ThemeIcon("markdown");
		}

		return item;
	}

	/**
	 * Updates a single document using `mia generate` command
	 */
	async updateDocument(documentPath: string): Promise<void> {
		const doc = this.documents.get(documentPath);
		if (!doc) {
			return;
		}

		doc.status = "updating";
		doc.error = undefined;
		this._onDidChangeTreeData.fire();

		try {
			const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (!workspaceRoot) {
				throw new Error("No workspace folder found");
			}

			await execAsync("mia generate", { cwd: workspaceRoot });
			doc.status = "completed";
		} catch (error) {
			doc.status = "failed";
			doc.error =
				error instanceof Error ? error.message : "Unknown error occurred";
		}

		this._onDidChangeTreeData.fire();
	}

	/**
	 * Updates all documents using `mia generate` command (Synchronize)
	 */
	async updateAllDocuments(): Promise<void> {
		const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) {
			window.showErrorMessage("No workspace folder found");
			return;
		}

		// Ensure documents are loaded
		const docsPath = join(workspaceRoot, "docs");
		if (!existsSync(docsPath)) {
			window.showWarningMessage("No docs/ directory found in workspace");
			return;
		}

		this.loadDocuments(docsPath, docsPath);

		this.isUpdatingAll = true;
		this.completedCount = 0;
		this.failedCount = 0;

		// Mark all as pending
		for (const doc of this.documents.values()) {
			doc.status = "pending";
		}
		this._onDidChangeTreeData.fire();

		// Run mia generate once for the entire project
		await window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: "Synchronizing Wiki Documents",
				cancellable: false,
			},
			async (progress: Progress<{ message?: string }>) => {
				progress.report({ message: "Running mia generate..." });

				try {
					await execAsync("mia generate", { cwd: workspaceRoot });

					// Mark all as completed
					for (const doc of this.documents.values()) {
						doc.status = "completed";
						this.completedCount += 1;
					}
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";

					// Mark all as failed
					for (const doc of this.documents.values()) {
						doc.status = "failed";
						doc.error = errorMessage;
						this.failedCount += 1;
					}

					window.showErrorMessage(`Failed to synchronize: ${errorMessage}`);
				}

				this._onDidChangeTreeData.fire();
			}
		);

		// Reset status after delay
		setTimeout(() => {
			this.isUpdatingAll = false;
			for (const doc of this.documents.values()) {
				if (doc.status === "completed" || doc.status === "failed") {
					doc.status = "idle";
				}
			}
			this._onDidChangeTreeData.fire();
		}, 5000);
	}

	/**
	 * Gets document info for Table of Contents generation
	 */
	getDocumentInfo(documentPath: string): WikiDocument | undefined {
		return this.documents.get(documentPath);
	}
}

export interface WikiItemOptions {
	label: string;
	collapsibleState: TreeItemCollapsibleState;
	contextValue: string;
	documentPath?: string;
	folderPath?: string;
}

export class WikiItem extends TreeItem {
	readonly contextValue: string;
	readonly documentPath?: string;
	readonly folderPath?: string;

	constructor(options: WikiItemOptions) {
		super(options.label, options.collapsibleState);
		this.contextValue = options.contextValue;
		this.documentPath = options.documentPath;
		this.folderPath = options.folderPath;
	}
}
