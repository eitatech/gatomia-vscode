import { basename, dirname } from "node:path";
import {
	type Command,
	type Event,
	EventEmitter,
	type ExtensionContext,
	FileType,
	ThemeIcon,
	type TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	window,
	workspace,
} from "vscode";
import { ConfigManager } from "../utils/config-manager";

const { joinPath } = Uri;

type ActionCategory =
	| "prompts"
	| "agents"
	| "skills"
	| "scripts"
	| "templates"
	| "instructions"
	| "speckit"
	| "speckit-prompts"
	| "speckit-agents"
	| "speckit-skills"
	| "speckit-scripts"
	| "speckit-templates"
	| "speckit-instructions";

interface ActionItemOptions {
	resourceUri?: Uri;
	command?: Command;
	tooltip?: string;
	description?: string;
	category?: ActionCategory;
	isAgent?: boolean;
	isSkill?: boolean;
}

class ActionItem extends TreeItem {
	readonly category: ActionCategory | undefined;
	readonly contextValue: string;

	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		options?: ActionItemOptions
	) {
		super(label, collapsibleState);
		this.contextValue = contextValue;
		this.category = options?.category;
		this.resourceUri = options?.resourceUri;
		this.command = options?.command;
		this.tooltip = options?.tooltip;
		this.description = options?.description;

		if (contextValue.startsWith("group-speckit")) {
			if (contextValue === "group-speckit-prompts") {
				this.iconPath = new ThemeIcon("comment-discussion");
			} else if (contextValue === "group-speckit-agents") {
				this.iconPath = new ThemeIcon("robot");
			} else if (contextValue === "group-speckit-instructions") {
				this.iconPath = new ThemeIcon("book");
			} else if (contextValue === "group-speckit-scripts") {
				this.iconPath = new ThemeIcon("terminal");
			} else if (contextValue === "group-speckit-templates") {
				this.iconPath = new ThemeIcon("file-code");
			} else {
				this.iconPath = new ThemeIcon("package"); // Main SpecKit group
			}
		} else if (contextValue.startsWith("group-")) {
			if (contextValue === "group-prompts") {
				this.iconPath = new ThemeIcon("comment-discussion");
			} else if (contextValue === "group-agents") {
				this.iconPath = new ThemeIcon("robot");
			} else if (contextValue === "group-skills") {
				this.iconPath = new ThemeIcon("tools");
			} else if (contextValue === "group-scripts") {
				this.iconPath = new ThemeIcon("terminal");
			} else if (contextValue === "group-templates") {
				this.iconPath = new ThemeIcon("file-code");
			} else {
				this.iconPath = new ThemeIcon("folder");
			}
		} else if (contextValue === "action-runnable") {
			this.iconPath = new ThemeIcon(options?.isAgent ? "robot" : "zap");
		} else if (contextValue === "action-skill") {
			this.iconPath = new ThemeIcon("tools");
		} else if (contextValue === "action-script") {
			this.iconPath = new ThemeIcon("terminal");
		} else if (contextValue === "action-template") {
			this.iconPath = new ThemeIcon("file-code");
		} else if (contextValue === "action-file") {
			this.iconPath = new ThemeIcon("file");
		}
	}
}

export class ActionsExplorerProvider implements TreeDataProvider<ActionItem> {
	static readonly viewId = "gatomia.views.actionsExplorer";

	private readonly changeEmitter = new EventEmitter<
		ActionItem | undefined | null | void
	>();
	readonly onDidChangeTreeData: Event<ActionItem | undefined | null | void> =
		this.changeEmitter.event;

	private readonly configManager: ConfigManager;
	private readonly context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.configManager = ConfigManager.getInstance();
	}

	refresh(): void {
		this.changeEmitter.fire();
	}

	getTreeItem(element: ActionItem): TreeItem {
		return element;
	}

	async getChildren(element?: ActionItem): Promise<ActionItem[]> {
		if (!element) {
			return [
				new ActionItem(
					"SpecKit",
					TreeItemCollapsibleState.Collapsed,
					"group-speckit",
					{ category: "speckit" }
				),
				new ActionItem(
					"Prompts",
					TreeItemCollapsibleState.Collapsed,
					"group-prompts",
					{ category: "prompts" }
				),
				new ActionItem(
					"Agents",
					TreeItemCollapsibleState.Collapsed,
					"group-agents",
					{ category: "agents" }
				),
				new ActionItem(
					"Skills",
					TreeItemCollapsibleState.Collapsed,
					"group-skills",
					{ category: "skills" }
				),
				new ActionItem(
					"Scripts",
					TreeItemCollapsibleState.Collapsed,
					"group-scripts",
					{ category: "scripts" }
				),
				new ActionItem(
					"Templates",
					TreeItemCollapsibleState.Collapsed,
					"group-templates",
					{ category: "templates" }
				),
			];
		}

		const ws = workspace.workspaceFolders?.[0];
		if (!ws) {
			return [];
		}

		if (element.category === "speckit") {
			return [
				new ActionItem(
					"Prompts",
					TreeItemCollapsibleState.Collapsed,
					"group-speckit-prompts",
					{ category: "speckit-prompts" }
				),
				new ActionItem(
					"Agents",
					TreeItemCollapsibleState.Collapsed,
					"group-speckit-agents",
					{ category: "speckit-agents" }
				),
				new ActionItem(
					"Instructions",
					TreeItemCollapsibleState.Collapsed,
					"group-speckit-instructions",
					{ category: "speckit-instructions" }
				),
				new ActionItem(
					"Scripts",
					TreeItemCollapsibleState.Collapsed,
					"group-speckit-scripts",
					{ category: "speckit-scripts" }
				),
				new ActionItem(
					"Templates",
					TreeItemCollapsibleState.Collapsed,
					"group-speckit-templates",
					{ category: "speckit-templates" }
				),
			];
		}

		// SpecKit Children
		switch (element.category) {
			case "speckit-prompts":
				return await this.getFiles({
					root: joinPath(ws.uri, ".github", "prompts"),
					patterns: ["*.prompt.md"],
					contextValue: "action-runnable",
					category: "prompts",
					isAgent: false,
					isSpecKit: true,
				});
			case "speckit-agents":
				return await this.getFiles({
					root: joinPath(ws.uri, ".github", "agents"),
					patterns: ["*.agent.md"],
					contextValue: "action-runnable",
					category: "agents",
					isAgent: true,
					isSpecKit: true,
				});
			case "speckit-instructions":
				return await this.getFiles({
					root: joinPath(ws.uri, ".github", "instructions"),
					patterns: ["*.instructions.md"],
					contextValue: "action-runnable",
					category: "instructions",
					isAgent: false,
					isSpecKit: true,
				});
			case "speckit-scripts":
				return await this.getScripts(ws.uri, true);
			case "speckit-templates":
				return await this.getTemplates(ws.uri, true);
			default:
				break;
		}

		// Regular Children
		switch (element.category) {
			case "prompts":
				return await this.getFiles({
					root: joinPath(ws.uri, ".github", "prompts"),
					patterns: ["*.prompt.md"],
					contextValue: "action-runnable",
					category: "prompts",
					isAgent: false,
					isSpecKit: false,
				});
			case "agents":
				return await this.getFiles({
					root: joinPath(ws.uri, ".github", "agents"),
					patterns: ["*.agent.md"],
					contextValue: "action-runnable",
					category: "agents",
					isAgent: true,
					isSpecKit: false,
				});
			case "skills":
				return await this.getSkills(joinPath(ws.uri, ".github", "skills"));
			case "scripts":
				return await this.getScripts(ws.uri, false);
			case "templates":
				return await this.getTemplates(ws.uri, false);
			default:
				return [];
		}
	}

	private async readDisplayName(uri: Uri, filename: string): Promise<string> {
		try {
			// Read first 1KB to find frontmatter or H1
			const fileData = await workspace.fs.readFile(uri);
			const content = new TextDecoder().decode(fileData.slice(0, 1024));

			// 1. Try Frontmatter name: ...
			// Regex: ^name:\s*['"]?(.*?)['"]?$ (multiline)
			const frontmatterRegExp = /^name:\s*['"]?(.+?)['"]?$/m;
			const frontmatterMatch = frontmatterRegExp.exec(content);
			if (frontmatterMatch?.[1]) {
				return frontmatterMatch[1].trim();
			}

			// 2. Try H1: # Title
			const h1RegExp = /^#\s+(.+)$/m;
			const h1Match = h1RegExp.exec(content);
			if (h1Match?.[1]) {
				return h1Match[1].trim();
			}

			// 3. Fallback: Normalize filename
			return this.normalizeName(filename);
		} catch {
			return this.normalizeName(filename);
		}
	}

	private normalizeName(name: string): string {
		// Remove extensions
		let normalized = name.replace(
			/\.(prompt|agent|instructions|sh|py|ts|js|ps1|md|yaml|json|handlebars|hbs)$/,
			""
		);
		// Remove speckit prefix if present
		normalized = normalized.replace(/^speckit\./, "");
		return normalized
			.split(/[-_.]/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
	}

	private async getFiles(options: {
		root: Uri;
		patterns: string[];
		contextValue: string;
		category: ActionCategory;
		isAgent?: boolean;
		isSpecKit?: boolean;
	}): Promise<ActionItem[]> {
		const files: ActionItem[] = [];
		try {
			const entries = await workspace.fs.readDirectory(options.root);
			for (const [name, type] of entries) {
				if (type === FileType.File) {
					const isMatch = options.patterns.some((p) => {
						if (p.startsWith("*")) {
							return name.endsWith(p.slice(1));
						}
						return name === p;
					});

					// Filter for SpecKit
					const isSpecKitFile = name.startsWith("speckit.");
					if (options.isSpecKit && !isSpecKitFile) {
						continue;
					}
					if (!options.isSpecKit && isSpecKitFile) {
						continue;
					}

					if (isMatch) {
						const displayName = await this.readDisplayName(
							joinPath(options.root, name),
							name
						);
						files.push(
							new ActionItem(
								displayName,
								TreeItemCollapsibleState.None,
								options.contextValue,
								{
									resourceUri: joinPath(options.root, name),
									command: {
										command: "vscode.open",
										title: "Open File",
										arguments: [joinPath(options.root, name)],
									},
									category: options.category,
									isAgent: options.isAgent,
									description: name, // Show original filename as description
								}
							)
						);
					}
				}
			}
		} catch {
			/* ignore */
		}
		return files;
	}

	private async getSkills(root: Uri): Promise<ActionItem[]> {
		// Skills are generic, so no SpecKit filtering for now, but keeping normalization if needed
		const skills: ActionItem[] = [];
		try {
			const entries = await workspace.fs.readDirectory(root);
			for (const [name, type] of entries) {
				if (type === FileType.Directory) {
					const skillMd = joinPath(root, name, "SKILL.md");
					try {
						await workspace.fs.stat(skillMd);
						const displayName = await this.readDisplayName(skillMd, name);
						skills.push(
							new ActionItem(
								displayName,
								TreeItemCollapsibleState.None,
								"action-skill",
								{
									resourceUri: skillMd,
									command: {
										command: "vscode.open",
										title: "Open Skill",
										arguments: [skillMd],
									},
									category: "skills",
									isSkill: true,
									description: name,
								}
							)
						);
					} catch {
						/* not a skill */
					}
				}
			}
		} catch {
			/* ignore */
		}
		return skills;
	}

	private async getScripts(
		wsUri: Uri,
		isSpecKit: boolean
	): Promise<ActionItem[]> {
		const items: ActionItem[] = [];
		const scriptExtensions = [".sh", ".ps1", ".py", ".js", ".ts"];

		if (isSpecKit) {
			// SpecKit Scripts: .specify/scripts/**/*
			const root = joinPath(wsUri, ".specify", "scripts");
			await this.collectFilesRecursive({
				root,
				extensions: scriptExtensions,
				contextValue: "action-script",
				category: "scripts",
				items,
			});
		} else {
			// Regular Scripts: .github/scripts
			const root = joinPath(wsUri, ".github", "scripts");
			await this.collectFilesRecursive({
				root,
				extensions: scriptExtensions,
				contextValue: "action-script",
				category: "scripts",
				items,
			});

			// Also look into skills for regular scripts
			const skillsRoot = joinPath(wsUri, ".github", "skills");
			try {
				const skillDirs = await workspace.fs.readDirectory(skillsRoot);
				for (const [name, ftype] of skillDirs) {
					if (ftype === FileType.Directory) {
						await this.collectFilesRecursive({
							root: joinPath(skillsRoot, name, "scripts"),
							extensions: scriptExtensions,
							contextValue: "action-script",
							category: "scripts",
							items,
						});
					}
				}
			} catch {
				/* ignore */
			}
		}
		return items;
	}

	private async getTemplates(
		wsUri: Uri,
		isSpecKit: boolean
	): Promise<ActionItem[]> {
		const items: ActionItem[] = [];
		const templateExtensions = [".md", ".yaml", ".json", ".handlebars", ".hbs"];

		if (isSpecKit) {
			// SpecKit Templates: .specify/templates
			const root = joinPath(wsUri, ".specify", "templates");
			await this.collectFilesRecursive({
				root,
				extensions: templateExtensions,
				contextValue: "action-template",
				category: "templates",
				items,
			});
		} else {
			// Regular Templates: .github/templates
			const root = joinPath(wsUri, ".github", "templates");
			await this.collectFilesRecursive({
				root,
				extensions: templateExtensions,
				contextValue: "action-template",
				category: "templates",
				items,
			});

			// Also look into skills for regular templates
			const skillsRoot = joinPath(wsUri, ".github", "skills");
			try {
				const skillDirs = await workspace.fs.readDirectory(skillsRoot);
				for (const [name, ftype] of skillDirs) {
					if (ftype === FileType.Directory) {
						await this.collectFilesRecursive({
							root: joinPath(skillsRoot, name, "templates"),
							extensions: templateExtensions,
							contextValue: "action-template",
							category: "templates",
							items,
						});
					}
				}
			} catch {
				/* ignore */
			}
		}
		return items;
	}

	private async collectFilesRecursive(options: {
		root: Uri;
		extensions: string[];
		contextValue: string;
		category: ActionCategory;
		items: ActionItem[];
	}): Promise<void> {
		try {
			const entries = await workspace.fs.readDirectory(options.root);
			for (const [name, type] of entries) {
				if (type === FileType.Directory) {
					await this.collectFilesRecursive({
						root: joinPath(options.root, name),
						extensions: options.extensions,
						contextValue: options.contextValue,
						category: options.category,
						items: options.items,
					});
				} else if (
					type === FileType.File &&
					options.extensions.some((ext) => name.endsWith(ext))
				) {
					// Note: scripts inside .specify/scripts don't necessarily start with speckit., they are defined by location
					// However, if we were in .github, we would check prefix.
					// The instruction says: "para scripts e templates, basta verificar o diretório .specify"
					// So location based for SpecKit scripts/templates.

					const displayName = await this.readDisplayName(
						joinPath(options.root, name),
						name
					);
					options.items.push(
						new ActionItem(
							displayName,
							TreeItemCollapsibleState.None,
							options.contextValue,
							{
								resourceUri: joinPath(options.root, name),
								command: {
									command: "vscode.open",
									title: "Open File",
									arguments: [joinPath(options.root, name)],
								},
								category: options.category,
								description: workspace.asRelativePath(
									joinPath(options.root, name)
								),
							}
						)
					);
				}
			}
		} catch {
			/* ignore */
		}
	}

	async renamePrompt(item?: ActionItem): Promise<void> {
		if (!item?.resourceUri) {
			return;
		}
		const newName = await window.showInputBox({
			prompt: "New name",
			value: basename(item.resourceUri.fsPath),
		});
		if (newName) {
			const target = joinPath(
				Uri.file(dirname(item.resourceUri.fsPath)),
				newName
			);
			await workspace.fs.rename(item.resourceUri, target);
			this.refresh();
		}
	}
}
