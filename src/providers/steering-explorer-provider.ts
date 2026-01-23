import { existsSync } from "fs";
import { basename, join } from "path";
import {
	type Command,
	type Event,
	type ExtensionContext,
	type TreeDataProvider,
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	workspace,
	FileType,
} from "vscode";
import type { SteeringManager } from "../features/steering/steering-manager";
import { getConstitutionPath } from "../utils/spec-kit-utilities";
import { ConfigManager } from "../utils/config-manager";
import { SPEC_SYSTEM_MODE } from "../constants";

import { homedir } from "os";
import { getVSCodeUserDataPath, isWindowsOrWsl } from "../utils/platform-utils";

const INSTRUCTION_RULE_SUFFIX = ".instructions.md";
const RULES_GROUP_EMPTY_LABEL = "No instruction rules found";
const RULES_GROUP_ERROR_LABEL = "Unable to read instruction rules";

const { joinPath } = Uri;

export class SteeringExplorerProvider
	implements TreeDataProvider<SteeringItem>
{
	static readonly viewId = "gatomia.views.steeringExplorer";
	static readonly createUserRuleCommandId = "gatomia.steering.createUserRule";
	static readonly createProjectRuleCommandId =
		"gatomia.steering.createProjectRule";
	private readonly _onDidChangeTreeData: EventEmitter<
		SteeringItem | undefined | null | void
	> = new EventEmitter<SteeringItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<SteeringItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private steeringManager!: SteeringManager;
	private readonly context: ExtensionContext;
	private readonly configManager: ConfigManager;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.configManager = ConfigManager.getInstance();
	}

	setSteeringManager(steeringManager: SteeringManager) {
		this.steeringManager = steeringManager;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	private readonly getGlobalPromptsRoot = async (): Promise<
		Uri | undefined
	> => {
		try {
			if (isWindowsOrWsl()) {
				const userDataPath = await getVSCodeUserDataPath();
				return joinPath(Uri.file(userDataPath), "prompts");
			}

			const homeUri = Uri.file(homedir());
			return joinPath(homeUri, ".github", "prompts");
		} catch {
			return;
		}
	};

	private readonly getGlobalPromptsLabel = async (): Promise<string> => {
		if (isWindowsOrWsl()) {
			const userDataPath = await getVSCodeUserDataPath();
			return join(userDataPath, "prompts");
		}

		const home = homedir();
		if (!home) {
			return ".github/prompts";
		}

		return `${home}/.github/prompts`;
	};

	private readonly readMarkdownFiles = async (
		dir: Uri,
		suffix: string
	): Promise<string[]> => {
		const results: string[] = [];
		try {
			const entries = await workspace.fs.readDirectory(dir);
			for (const [name, type] of entries) {
				const entryUri = joinPath(dir, name);
				if (type === FileType.File && name.endsWith(suffix)) {
					results.push(entryUri.fsPath);
					continue;
				}

				if (type === FileType.Directory) {
					const nested = await this.readMarkdownFiles(entryUri, suffix);
					results.push(...nested);
				}
			}
		} catch {
			// Directory may not exist yet
		}
		return results;
	};

	getTreeItem(element: SteeringItem): TreeItem {
		return element;
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
	async getChildren(element?: SteeringItem): Promise<SteeringItem[]> {
		if (!element) {
			const items: SteeringItem[] = [];

			// User Instructions Group
			const homeDir = homedir() || process.env.USERPROFILE || "";
			const globalConfigPath = join(
				homeDir,
				".github",
				"copilot-instructions.md"
			);

			items.push(
				new SteeringItem(
					"User Instructions",
					TreeItemCollapsibleState.Expanded,
					"user-instructions-group",
					"",
					this.context
				)
			);

			if (workspace.workspaceFolders) {
				const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
				const specSystem = this.configManager.getSettings().specSystem;

				items.push(
					new SteeringItem(
						"Project Instructions",
						TreeItemCollapsibleState.Expanded,
						"project-instruction-rules-group",
						"",
						this.context
					)
				);

				// Check if any project instruction files exist
				const projectCopilotMd = join(
					workspaceRoot,
					".github",
					"copilot-instructions.md"
				);
				// OpenSpec-specific: only show when OpenSpec is explicitly selected
				const agentsMd = join(workspaceRoot, "openspec", "AGENTS.md");
				const showOpenSpecAgents =
					specSystem === SPEC_SYSTEM_MODE.OPENSPEC && existsSync(agentsMd);

				const rootAgentsMd = join(workspaceRoot, "AGENTS.md");
				// SpecKit-specific: constitution only shown in SpecKit or Auto mode
				const constitutionMd = getConstitutionPath(workspaceRoot);
				const showConstitution =
					(specSystem === SPEC_SYSTEM_MODE.SPECKIT ||
						specSystem === SPEC_SYSTEM_MODE.AUTO) &&
					existsSync(constitutionMd);

				const hasProjectInstructions =
					existsSync(projectCopilotMd) ||
					showOpenSpecAgents ||
					existsSync(rootAgentsMd) ||
					showConstitution;

				if (hasProjectInstructions) {
					items.push(
						new SteeringItem(
							"Agents",
							TreeItemCollapsibleState.Expanded,
							"project-instructions-group",
							"",
							this.context
						)
					);
				} else {
					items.push(
						new SteeringItem(
							"Create Project Instructions",
							TreeItemCollapsibleState.None,
							"create-project-instructions",
							"",
							this.context,
							{
								command: SteeringExplorerProvider.createProjectRuleCommandId,
								title: "Create Project Instructions",
							}
						)
					);
				}

				// Project Spec Group - only show when OpenSpec is explicitly selected
				const projectSpecMd = join(workspaceRoot, "openspec", "project.md");
				const showProjectSpec =
					specSystem === SPEC_SYSTEM_MODE.OPENSPEC && existsSync(projectSpecMd);
				if (showProjectSpec) {
					items.push(
						new SteeringItem(
							"Project Spec",
							TreeItemCollapsibleState.Expanded,
							"project-spec-group",
							"",
							this.context
						)
					);
				}
			}

			return items;
		}

		if (element.contextValue === "user-instructions-group") {
			const items: SteeringItem[] = [];
			const homeDir = homedir() || process.env.USERPROFILE || "";

			// Add Global Instructions if exists
			const globalConfigPath = join(
				homeDir,
				".github",
				"copilot-instructions.md"
			);
			if (existsSync(globalConfigPath)) {
				items.push(
					new SteeringItem(
						"Global Instructions",
						TreeItemCollapsibleState.None,
						"global-copilot-instructions",
						globalConfigPath,
						this.context,
						{
							command: "vscode.open",
							title: "Open Global Instructions",
							arguments: [Uri.file(globalConfigPath)],
						}
					)
				);
			}

			// Add User Instruction Rules
			if (!homeDir) {
				items.push(
					new SteeringItem(
						RULES_GROUP_ERROR_LABEL,
						TreeItemCollapsibleState.None,
						"instruction-rules-error",
						"",
						this.context
					)
				);
				return items;
			}
			const rulesRoot = joinPath(Uri.file(homeDir), ".github", "instructions");
			const ruleUris = await this.readFilesInDirectoryWithSuffix(
				rulesRoot,
				INSTRUCTION_RULE_SUFFIX
			);

			if (ruleUris.kind === "error") {
				// If no rules and no global config, show empty message
				if (items.length === 0) {
					items.push(
						new SteeringItem(
							RULES_GROUP_EMPTY_LABEL,
							TreeItemCollapsibleState.None,
							"instruction-rules-empty",
							"",
							this.context
						)
					);
				}
				return items;
			}

			if (ruleUris.items.length === 0) {
				// If no rules but have global config, just return what we have
				return items;
			}

			// Add instruction rules to items
			items.push(...this.buildInstructionRuleItems(ruleUris.items));
			return items;
		}

		if (element.contextValue === "project-instructions-group") {
			const items: SteeringItem[] = [];
			if (workspace.workspaceFolders) {
				const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
				const specSystem = this.configManager.getSettings().specSystem;

				const projectCopilotMd = join(
					workspaceRoot,
					".github",
					"copilot-instructions.md"
				);
				if (existsSync(projectCopilotMd)) {
					items.push(
						new SteeringItem(
							"Copilot Instructions",
							TreeItemCollapsibleState.None,
							"project-copilot-instructions",
							projectCopilotMd,
							this.context,
							{
								command: "vscode.open",
								title: "Open Copilot Instructions",
								arguments: [Uri.file(projectCopilotMd)],
							}
						)
					);
				}

				// OpenSpec AGENTS.md - only show when OpenSpec is explicitly selected
				const agentsMd = join(workspaceRoot, "openspec", "AGENTS.md");
				const showOpenSpecAgents = specSystem === SPEC_SYSTEM_MODE.OPENSPEC;
				if (showOpenSpecAgents && existsSync(agentsMd)) {
					items.push(
						new SteeringItem(
							"Agent Instructions",
							TreeItemCollapsibleState.None,
							"project-agents-md",
							agentsMd,
							this.context,
							{
								command: "vscode.open",
								title: "Open Agent Instructions",
								arguments: [Uri.file(agentsMd)],
							}
						)
					);
				}

				const rootAgentsMd = join(workspaceRoot, "AGENTS.md");
				if (existsSync(rootAgentsMd)) {
					items.push(
						new SteeringItem(
							"Root Instructions",
							TreeItemCollapsibleState.None,
							"root-agents-md",
							rootAgentsMd,
							this.context,
							{
								command: "vscode.open",
								title: "Open Root Instructions",
								arguments: [Uri.file(rootAgentsMd)],
							}
						)
					);
				}

				// SpecKit constitution - only show in SpecKit or Auto mode
				const showConstitution =
					specSystem === SPEC_SYSTEM_MODE.SPECKIT ||
					specSystem === SPEC_SYSTEM_MODE.AUTO;
				const constitutionMd = getConstitutionPath(workspaceRoot);
				if (showConstitution && existsSync(constitutionMd)) {
					items.push(
						new SteeringItem(
							"Constitution",
							TreeItemCollapsibleState.None,
							"project-constitution-md",
							constitutionMd,
							this.context,
							{
								command: "vscode.open",
								title: "Open Constitution",
								arguments: [Uri.file(constitutionMd)],
							}
						)
					);
				}
			}
			return items;
		}

		if (element.contextValue === "project-instruction-rules-group") {
			if (!workspace.workspaceFolders) {
				return [];
			}

			const workspaceRoot = workspace.workspaceFolders[0].uri;
			const rulesRoot = joinPath(workspaceRoot, ".github", "instructions");
			const ruleUris = await this.readFilesInDirectoryWithSuffix(
				rulesRoot,
				INSTRUCTION_RULE_SUFFIX
			);

			if (ruleUris.kind === "error") {
				return [
					new SteeringItem(
						RULES_GROUP_ERROR_LABEL,
						TreeItemCollapsibleState.None,
						"instruction-rules-error",
						"",
						this.context
					),
				];
			}

			if (ruleUris.items.length === 0) {
				return [
					new SteeringItem(
						RULES_GROUP_EMPTY_LABEL,
						TreeItemCollapsibleState.None,
						"instruction-rules-empty",
						"",
						this.context
					),
				];
			}

			return this.buildInstructionRuleItems(ruleUris.items);
		}

		if (element.contextValue === "project-spec-group") {
			const items: SteeringItem[] = [];
			if (workspace.workspaceFolders) {
				const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
				const projectSpecMd = join(workspaceRoot, "openspec", "project.md");
				if (existsSync(projectSpecMd)) {
					items.push(
						new SteeringItem(
							"Project Definition",
							TreeItemCollapsibleState.None,
							"project-spec-md",
							projectSpecMd,
							this.context,
							{
								command: "vscode.open",
								title: "Open Project Definition",
								arguments: [Uri.file(projectSpecMd)],
							}
						)
					);
				}
			}
			return items;
		}

		return [];
	}

	private readonly readFilesInDirectoryWithSuffix = async (
		dir: Uri,
		suffix: string
	): Promise<{ kind: "ok"; items: Uri[] } | { kind: "error" }> => {
		try {
			const entries = await workspace.fs.readDirectory(dir);
			const results: Uri[] = [];
			for (const [name, type] of entries) {
				if (type !== FileType.File) {
					continue;
				}

				if (!name.endsWith(suffix)) {
					continue;
				}

				results.push(joinPath(dir, name));
			}
			results.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
			return { kind: "ok", items: results };
		} catch {
			return { kind: "error" };
		}
	};

	private readonly buildInstructionRuleItems = (
		ruleUris: Uri[]
	): SteeringItem[] =>
		ruleUris.map((uri) => {
			const fileName = basename(uri.fsPath);
			const label = fileName.endsWith(INSTRUCTION_RULE_SUFFIX)
				? fileName.slice(0, -INSTRUCTION_RULE_SUFFIX.length)
				: fileName;

			return new SteeringItem(
				label,
				TreeItemCollapsibleState.None,
				"instruction-rule",
				uri.fsPath,
				this.context,
				{
					command: "vscode.open",
					title: "Open Instruction Rule",
					arguments: [uri],
				},
				fileName
			);
		});
}

class SteeringItem extends TreeItem {
	readonly label: string;
	readonly collapsibleState: TreeItemCollapsibleState;
	readonly contextValue: string;
	readonly resourcePath: string;
	private readonly context: ExtensionContext;
	readonly command?: Command;
	private readonly filename?: string;
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
	// biome-ignore lint/nursery/useMaxParams: ignore
	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		resourcePath: string,
		context: ExtensionContext,
		command?: Command,
		filename?: string,
		description?: string
	) {
		super(label, collapsibleState);
		this.label = label;
		this.collapsibleState = collapsibleState;
		this.contextValue = contextValue;
		this.resourcePath = resourcePath;
		this.context = context;
		this.command = command;
		this.filename = filename;

		// Set appropriate icons based on type
		if (contextValue === "user-instructions-group") {
			this.iconPath = new ThemeIcon("account");
			this.tooltip = "User Instructions";
		} else if (contextValue === "global-copilot-instructions") {
			this.iconPath = new ThemeIcon("globe");
			this.tooltip = `Global Instructions: ${resourcePath}`;
			this.description = "~/.github/copilot-instructions.md";
		} else if (contextValue === "project-instructions-group") {
			this.iconPath = new ThemeIcon("folder");
			this.tooltip = "AGENTS";
		} else if (contextValue === "create-project-instructions") {
			this.iconPath = new ThemeIcon("folder-active");
			this.tooltip = "Click to create Project Instructions";
		} else if (contextValue === "project-copilot-instructions") {
			this.iconPath = new ThemeIcon("github");
			this.tooltip = `Copilot Instructions: ${resourcePath}`;
			this.description = ".github/copilot-instructions.md";
		} else if (contextValue === "project-agents-md") {
			this.iconPath = new ThemeIcon("robot");
			this.tooltip = `Agent Instructions: ${resourcePath}`;
			this.description = "openspec/AGENTS.md";
		} else if (contextValue === "root-agents-md") {
			this.iconPath = new ThemeIcon("file-text");
			this.tooltip = `Root Instructions: ${resourcePath}`;
			this.description = "AGENTS.md";
		} else if (contextValue === "project-constitution-md") {
			this.iconPath = new ThemeIcon("law");
			this.tooltip = `Constitution: ${resourcePath}`;
			this.description = "constitution.md";
		} else if (contextValue === "project-spec-group") {
			this.iconPath = new ThemeIcon("book");
			this.tooltip = "Project Specification";
		} else if (contextValue === "project-spec-md") {
			this.iconPath = new ThemeIcon("file-code");
			this.tooltip = `Project Definition: ${resourcePath}`;
			this.description = "openspec/project.md";
		} else if (contextValue === "separator") {
			this.iconPath = undefined;
			this.description = undefined;
		} else if (contextValue === "steering-header") {
			this.iconPath = new ThemeIcon("folder-library");
			this.description = undefined;
			// Make it visually distinct but not clickable
			this.tooltip = "Generated project steering documents";
		} else if (contextValue === "steering-document") {
			// Different icons for different steering documents
			if (label === "product") {
				this.iconPath = new ThemeIcon("lightbulb-empty");
			} else if (label === "tech") {
				this.iconPath = new ThemeIcon("circuit-board");
			} else if (label === "structure") {
				this.iconPath = new ThemeIcon("list-tree");
			} else {
				this.iconPath = new ThemeIcon("file");
			}
			this.tooltip = `Steering document: ${resourcePath}`;
			this.description = filename; // Show the relative path
		} else if (
			contextValue === "user-instruction-rules-group" ||
			contextValue === "project-instruction-rules-group"
		) {
			this.iconPath = new ThemeIcon("folder");
			this.tooltip = "Instruction Rules";
		} else if (contextValue === "instruction-rule") {
			this.iconPath = new ThemeIcon("file-text");
			this.tooltip = `Instruction Rule: ${resourcePath}`;
			this.description = filename;
		} else if (contextValue === "instruction-rules-empty") {
			this.iconPath = new ThemeIcon("info");
			this.tooltip = "No instruction rules found";
		} else if (contextValue === "instruction-rules-error") {
			this.iconPath = new ThemeIcon("warning");
			this.tooltip = "Unable to read instruction rules";
		}
	}
}
