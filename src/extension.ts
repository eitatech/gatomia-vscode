import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { FileSystemWatcher } from "vscode";
import {
	commands,
	ConfigurationTarget,
	type DocumentSelector,
	env,
	type ExtensionContext,
	languages,
	type OutputChannel,
	RelativePattern,
	Uri,
	window,
	workspace,
} from "vscode";
import { VSC_CONFIG_NAMESPACE } from "./constants";
import { SpecManager } from "./features/spec/spec-manager";
import { SteeringManager } from "./features/steering/steering-manager";
import { CopilotProvider } from "./providers/copilot-provider";
import { OverviewProvider } from "./providers/overview-provider";
import { PromptsExplorerProvider } from "./providers/prompts-explorer-provider";
import { SpecExplorerProvider } from "./providers/spec-explorer-provider";
import { SpecTaskCodeLensProvider } from "./providers/spec-task-code-lens-provider";
import { SteeringExplorerProvider } from "./providers/steering-explorer-provider";
import { PromptLoader } from "./services/prompt-loader";
import { sendPromptToChat } from "./utils/chat-prompt-runner";
import { ConfigManager } from "./utils/config-manager";
import { getVSCodeUserDataPath } from "./utils/platform-utils";
import { getSpecSystemAdapter } from "./utils/spec-kit-adapter";
import { SpecKitMigration } from "./utils/spec-kit-migration";
import { TriggerRegistry } from "./features/hooks/trigger-registry";
import { HookManager } from "./features/hooks/hook-manager";
import { HookExecutor } from "./features/hooks/hook-executor";
import { HookViewProvider } from "./providers/hook-view-provider";

let copilotProvider: CopilotProvider;
let specManager: SpecManager;
let steeringManager: SteeringManager;
let triggerRegistry: TriggerRegistry;
let hookManager: HookManager;
let hookExecutor: HookExecutor;
let hookViewProvider: HookViewProvider;
export let outputChannel: OutputChannel;

export async function activate(context: ExtensionContext) {
	// Create output channel for debugging
	outputChannel = window.createOutputChannel("ALMA - Debug");

	// Initialize PromptLoader
	try {
		const promptLoader = PromptLoader.getInstance();
		promptLoader.initialize();
		outputChannel.appendLine("PromptLoader initialized successfully");
	} catch (error) {
		outputChannel.appendLine(`Failed to initialize PromptLoader: ${error}`);
		window.showErrorMessage(`Failed to initialize prompt system: ${error}`);
	}

	// Check workspace status
	const workspaceFolders = workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		outputChannel.appendLine("WARNING: No workspace folder found!");
	}

	// Initialize Copilot provider
	copilotProvider = new CopilotProvider(context, outputChannel);

	const configManager = ConfigManager.getInstance();
	await configManager.loadSettings();

	// Initialize Spec System Adapter
	try {
		const adapter = getSpecSystemAdapter();
		await adapter.initialize();
		outputChannel.appendLine(
			`Spec System Adapter initialized. Active system: ${adapter.getActiveSystem()}`
		);

		// Load prompts from active system
		const promptsPath = adapter.getPromptsBasePath();
		PromptLoader.getInstance().loadPromptsFromDirectory(promptsPath);
		outputChannel.appendLine(`Loaded prompts from: ${promptsPath}`);
	} catch (error) {
		outputChannel.appendLine(
			`Failed to initialize Spec System Adapter: ${error}`
		);
	}

	// Initialize feature managers with output channel
	specManager = new SpecManager(context, outputChannel);
	steeringManager = new SteeringManager(
		context,
		copilotProvider,
		outputChannel
	);

	// Initialize TriggerRegistry for hooks
	triggerRegistry = new TriggerRegistry(outputChannel);
	triggerRegistry.initialize();
	outputChannel.appendLine("TriggerRegistry initialized");

	// Connect TriggerRegistry to SpecManager
	specManager.setTriggerRegistry(triggerRegistry);

	// Initialize Hook infrastructure
	hookManager = new HookManager(context, outputChannel);
	await hookManager.initialize();

	hookExecutor = new HookExecutor(hookManager, triggerRegistry, outputChannel);
	hookExecutor.initialize();

	hookViewProvider = new HookViewProvider(
		context,
		hookManager,
		hookExecutor,
		outputChannel
	);
	hookViewProvider.initialize();

	// Register tree data providers
	const overviewProvider = new OverviewProvider(context);
	const specExplorer = new SpecExplorerProvider(context);
	const steeringExplorer = new SteeringExplorerProvider(context);
	const promptsExplorer = new PromptsExplorerProvider(context);

	// Set managers
	specExplorer.setSpecManager(specManager);
	steeringExplorer.setSteeringManager(steeringManager);

	context.subscriptions.push(
		window.registerTreeDataProvider("alma.views.overview", overviewProvider),
		window.registerTreeDataProvider("alma.views.specExplorer", specExplorer),
		window.registerTreeDataProvider(
			"alma.views.steeringExplorer",
			steeringExplorer
		)
	);
	context.subscriptions.push(
		window.registerTreeDataProvider(
			"alma.views.promptsExplorer",
			promptsExplorer
		)
	);
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			HookViewProvider.viewId,
			hookViewProvider
		),
		{ dispose: () => hookManager.dispose() },
		{ dispose: () => hookExecutor.dispose() },
		{ dispose: () => hookViewProvider.dispose() }
	);

	// Register commands
	registerCommands(context, specExplorer, steeringExplorer, promptsExplorer);

	// Set up file watchers
	setupFileWatchers(context, specExplorer, steeringExplorer, promptsExplorer);

	// Register CodeLens provider for spec tasks
	const specTaskCodeLensProvider = new SpecTaskCodeLensProvider();

	// Use document selector for spec task files (dynamic paths handled inside provider)
	const selector: DocumentSelector = [
		{
			language: "markdown",
			pattern: "**/*tasks.md",
			scheme: "file",
		},
	];

	const disposable = languages.registerCodeLensProvider(
		selector,
		specTaskCodeLensProvider
	);

	context.subscriptions.push(disposable);

	outputChannel.appendLine("CodeLens provider for spec tasks registered");
}

async function toggleViews() {
	const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
	const currentVisibility = {
		specs: config.get("views.specs.visible", true),
		hooks: config.get("views.hooks.visible", false),
		steering: config.get("views.steering.visible", true),
		mcp: config.get("views.mcp.visible", false),
	};

	const items: Array<{ label: string; picked: boolean; id: string }> = [
		{
			label: `$(${currentVisibility.specs ? "check" : "blank"}) Specs`,
			picked: currentVisibility.specs,
			id: "specs",
		},
		{
			label: `$(${currentVisibility.hooks ? "check" : "blank"}) Hooks`,
			picked: currentVisibility.hooks,
			id: "hooks",
		},

		{
			label: `$(${currentVisibility.steering ? "check" : "blank"}) Agent Steering`,
			picked: currentVisibility.steering,
			id: "steering",
		},
	];
	const selected = await window.showQuickPick(items, {
		canPickMany: true,
		placeHolder: "Select views to show",
	});

	if (selected) {
		const newVisibility = {
			specs: selected.some((item) => item.id === "specs"),
			hooks: selected.some((item) => item.id === "hooks"),
			steering: selected.some((item) => item.id === "steering"),
			mcp: selected.some((item) => item.id === "mcp"),
		};

		await config.update(
			"views.specs.visible",
			newVisibility.specs,
			ConfigurationTarget.Workspace
		);
		await config.update(
			"views.hooks.visible",
			newVisibility.hooks,
			ConfigurationTarget.Workspace
		);
		await config.update(
			"views.steering.visible",
			newVisibility.steering,
			ConfigurationTarget.Workspace
		);

		window.showInformationMessage("View visibility updated!");
	}
}

function registerCommands(
	context: ExtensionContext,
	specExplorer: SpecExplorerProvider,
	steeringExplorer: SteeringExplorerProvider,
	promptsExplorer: PromptsExplorerProvider
) {
	const createSpecCommand = commands.registerCommand(
		"alma.spec.create",
		async () => {
			outputChannel.appendLine(
				`[Spec] create command triggered at ${new Date().toISOString()}`
			);

			try {
				await specManager.create();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(`[Spec] create command failed: ${message}`);
				window.showErrorMessage(`Failed to create spec prompt: ${message}`);
			}
		}
	);

	context.subscriptions.push(
		commands.registerCommand("alma.noop", () => {
			// noop
		}),
		createSpecCommand,
		commands.registerCommand(
			"alma.spec.navigate.requirements",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "requirements");
			}
		),

		commands.registerCommand(
			"alma.spec.navigate.design",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "design");
			}
		),

		commands.registerCommand(
			"alma.spec.navigate.tasks",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "tasks");
			}
		),

		commands.registerCommand("alma.spec.implTask", async (documentUri: Uri) => {
			outputChannel.appendLine(
				`[Task Execute] Generating ALMA apply prompt for: ${documentUri.fsPath}`
			);
			await specManager.runOpenSpecApply(documentUri);
		}),

		commands.registerCommand(
			"alma.spec.open",
			async (relativePath: string, type: string) => {
				await specManager.openDocument(relativePath, type);
			}
		),
		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("alma.spec.refresh", async () => {
			outputChannel.appendLine("[Manual Refresh] Refreshing spec explorer...");
			specExplorer.refresh();
		}),
		commands.registerCommand("alma.hooks.export", async () => {
			if (!hookManager) {
				window.showErrorMessage("Hook manager is not ready yet.");
				return;
			}

			const defaultUri = getDefaultWorkspaceFileUri(getHooksExportFileName());
			const saveUri = await window.showSaveDialog({
				title: "Export Hooks",
				saveLabel: "Export",
				defaultUri: defaultUri ?? undefined,
				filters: { JSON: ["json"] },
			});

			if (!saveUri) {
				return;
			}

			try {
				const json = hookManager.exportHooks();
				await workspace.fs.writeFile(saveUri, Buffer.from(json, "utf8"));

				const message = `Exported hooks to ${saveUri.fsPath}`;
				window.showInformationMessage(message);
				outputChannel.appendLine(`[Hooks] ${message}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.showErrorMessage(`Failed to export hooks: ${message}`);
				outputChannel.appendLine(`[Hooks] Failed to export hooks: ${message}`);
			}
		}),
		commands.registerCommand("alma.hooks.import", async () => {
			if (!hookManager) {
				window.showErrorMessage("Hook manager is not ready yet.");
				return;
			}

			const defaultUri = workspace.workspaceFolders?.[0]?.uri;
			const openUris = await window.showOpenDialog({
				title: "Import Hooks",
				openLabel: "Import",
				defaultUri: defaultUri ?? undefined,
				canSelectMany: false,
				filters: { JSON: ["json"] },
			});

			if (!openUris || openUris.length === 0) {
				return;
			}

			const hooksFile = openUris[0];

			try {
				const bytes = await workspace.fs.readFile(hooksFile);
				const json = Buffer.from(bytes).toString("utf8");
				const importedCount = await hookManager.importHooks(json);

				const summary =
					importedCount === 0
						? "No new hooks imported"
						: `Imported ${importedCount} hook${importedCount === 1 ? "" : "s"}`;

				window.showInformationMessage(`${summary} from ${hooksFile.fsPath}`);
				outputChannel.appendLine(`[Hooks] ${summary} from ${hooksFile.fsPath}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.showErrorMessage(`Failed to import hooks: ${message}`);
				outputChannel.appendLine(`[Hooks] Failed to import hooks: ${message}`);
			}
		}),
		commands.registerCommand("alma.hooks.addHook", async () => {
			if (!hookViewProvider) {
				return;
			}
			await hookViewProvider.showCreateHookForm();
		}),
		commands.registerCommand("alma.hooks.viewLogs", async () => {
			if (!hookViewProvider) {
				return;
			}
			await hookViewProvider.showLogsPanel();
		})
	);

	// No UI mode toggle commands required

	// Steering commands
	context.subscriptions.push(
		// Configuration commands
		commands.registerCommand("alma.steering.createUserRule", async () => {
			await steeringManager.createUserConfiguration();
		}),

		commands.registerCommand("alma.steering.createProjectRule", async () => {
			await steeringManager.createProjectDocumentation();
		}),

		commands.registerCommand("alma.steering.refresh", () => {
			outputChannel.appendLine(
				"[Manual Refresh] Refreshing steering explorer..."
			);
			steeringExplorer.refresh();
		})
	);

	// Add file save confirmation for agent files
	context.subscriptions.push(
		workspace.onWillSaveTextDocument(async (event) => {
			const document = event.document;
			const filePath = document.fileName;

			// Check if this is an agent file in .copilot directories
			if (filePath.includes(".copilot/agents/") && filePath.endsWith(".md")) {
				// Show confirmation dialog
				const result = await window.showWarningMessage(
					"Are you sure you want to save changes to this agent file?",
					{ modal: true },
					"Save",
					"Cancel"
				);

				if (result !== "Save") {
					// Cancel the save operation by waiting forever
					// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
					event.waitUntil(new Promise(() => {}));
				}
			}
		})
	);

	// Spec delete command
	context.subscriptions.push(
		commands.registerCommand("alma.spec.delete", async (item: any) => {
			await specManager.delete(item.label);
		}),
		commands.registerCommand("alma.spec.archiveChange", async (item: any) => {
			// item is SpecItem, item.specName is the ID
			const changeId = item.specName;
			if (!changeId) {
				window.showErrorMessage("Could not determine change ID.");
				return;
			}

			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}

			const promptPath = Uri.joinPath(
				ws.uri,
				".github/prompts/openspec-archive.prompt.md"
			);

			try {
				const promptContent = await workspace.fs.readFile(promptPath);
				const promptString = new TextDecoder().decode(promptContent);
				const fullPrompt = `${promptString}\n\nid: ${changeId}`;

				outputChannel.appendLine(
					`[Archive Change] Archiving change: ${changeId}`
				);
				await sendPromptToChat(fullPrompt);
			} catch (error) {
				window.showErrorMessage(
					`Failed to read archive prompt: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		})
	);

	// Copilot integration commands
	// Copilot CLI integration commands

	// Prompts commands
	context.subscriptions.push(
		commands.registerCommand("alma.prompts.refresh", () => {
			outputChannel.appendLine(
				"[Manual Refresh] Refreshing prompts explorer..."
			);
			promptsExplorer.refresh();
		}),
		commands.registerCommand("alma.prompts.createInstructions", async () => {
			await commands.executeCommand("workbench.command.new.instructions");
		}),
		commands.registerCommand("alma.prompts.createCopilotPrompt", async () => {
			await commands.executeCommand("workbench.command.new.prompt");
		}),
		commands.registerCommand("alma.prompts.create", async (item?: any) => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const configManager = ConfigManager.getInstance();

			let targetDir: Uri;
			let promptsPathLabel: string;

			// Determine target directory based on the item source
			if (item?.source === "global") {
				const home = homedir();
				const globalPath = join(home, ".github", "prompts");
				targetDir = Uri.file(globalPath);
				promptsPathLabel = globalPath;
			} else {
				// Default to project scope
				promptsPathLabel = configManager.getPath("prompts");
				targetDir = Uri.joinPath(ws.uri, ".copilot", "prompts");
				try {
					targetDir = Uri.file(configManager.getAbsolutePath("prompts"));
				} catch {
					// fall back to default under workspace
				}
			}

			const name = await window.showInputBox({
				title: "Create Prompt",
				placeHolder: "prompt name (kebab-case)",
				prompt: `A markdown file will be created under ${promptsPathLabel}`,
				validateInput: (v) => (v ? undefined : "Name is required"),
			});
			if (!name) {
				return;
			}

			const file = Uri.joinPath(targetDir, `${name}.prompt.md`);
			try {
				await workspace.fs.createDirectory(targetDir);
				const content = Buffer.from(
					`# ${name}\n\nDescribe your prompt here. This file will be sent to Copilot when executed.\n`
				);
				await workspace.fs.writeFile(file, content);
				const doc = await workspace.openTextDocument(file);
				await window.showTextDocument(doc);
				promptsExplorer.refresh();
			} catch (e) {
				window.showErrorMessage(`Failed to create prompt: ${e}`);
			}
		}),
		commands.registerCommand(
			"alma.prompts.run",
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
			async (filePathOrItem?: any) => {
				try {
					let targetUri: Uri | undefined;

					if (typeof filePathOrItem === "string") {
						targetUri = Uri.file(filePathOrItem);
					} else if (filePathOrItem && typeof filePathOrItem === "object") {
						const candidateUri: Uri | undefined =
							filePathOrItem.resourceUri ??
							(typeof filePathOrItem.resourcePath === "string"
								? Uri.file(filePathOrItem.resourcePath)
								: undefined);

						if (candidateUri) {
							targetUri = candidateUri;
						}
					}

					if (!targetUri) {
						targetUri = window.activeTextEditor?.document.uri;
					}

					if (!targetUri) {
						window.showErrorMessage("No prompt file selected");
						return;
					}

					const fileData = await workspace.fs.readFile(targetUri);
					const promptContent = new TextDecoder().decode(fileData);
					await sendPromptToChat(promptContent, {
						instructionType: "runPrompt",
					});
				} catch (e) {
					window.showErrorMessage(`Failed to run prompt: ${e}`);
				}
			}
		),
		commands.registerCommand("alma.prompts.rename", async (item?: any) => {
			await promptsExplorer.renamePrompt(item);
		}),
		commands.registerCommand("alma.prompts.delete", async (item: any) => {
			if (!item?.resourceUri) {
				return;
			}
			const uri = item.resourceUri as Uri;
			const confirm = await window.showWarningMessage(
				`Are you sure you want to delete '${basename(uri.fsPath)}'?`,
				{ modal: true },
				"Delete"
			);
			if (confirm !== "Delete") {
				return;
			}
			try {
				await workspace.fs.delete(uri);
				promptsExplorer.refresh();
			} catch (e) {
				window.showErrorMessage(`Failed to delete prompt: ${e}`);
			}
		}),
		commands.registerCommand("alma.prompts.createAgentFile", async () => {
			await commands.executeCommand("workbench.command.new.agent");
		}),

		// SpecKit commands
		commands.registerCommand("alma.speckit.constitution", async () => {
			await specManager.executeSpecKitCommand("constitution");
		}),
		commands.registerCommand("alma.speckit.specify", async () => {
			await specManager.executeSpecKitCommand("specify");
		}),
		commands.registerCommand("alma.speckit.plan", async () => {
			await specManager.executeSpecKitCommand("plan");
		}),
		commands.registerCommand("alma.speckit.unit-test", async () => {
			await specManager.executeSpecKitCommand("unit-test");
		}),
		commands.registerCommand("alma.speckit.integration-test", async () => {
			await specManager.executeSpecKitCommand("integration-test");
		}),
		commands.registerCommand("alma.speckit.implementation", async () => {
			await specManager.executeSpecKitCommand("implementation");
		}),
		commands.registerCommand("alma.speckit.clarify", async () => {
			await specManager.executeSpecKitCommand("clarify");
		}),
		commands.registerCommand("alma.speckit.analyze", async () => {
			await specManager.executeSpecKitCommand("analyze");
		}),
		commands.registerCommand("alma.speckit.checklist", async () => {
			await specManager.executeSpecKitCommand("checklist");
		}),
		commands.registerCommand("alma.speckit.tasks", async () => {
			await specManager.executeSpecKitCommand("tasks");
		}),
		commands.registerCommand("alma.speckit.taskstoissues", async () => {
			await specManager.executeSpecKitCommand("taskstoissues");
		}),
		commands.registerCommand("alma.speckit.research", async () => {
			await specManager.executeSpecKitCommand("research");
		}),
		commands.registerCommand("alma.speckit.datamodel", async () => {
			await specManager.executeSpecKitCommand("datamodel");
		}),
		commands.registerCommand("alma.speckit.design", async () => {
			await specManager.executeSpecKitCommand("design");
		})
	);

	// Update checker command

	// Group the following commands in a single subscriptions push
	context.subscriptions.push(
		// Overview and settings commands
		commands.registerCommand("alma.settings.open", async () => {
			outputChannel.appendLine("Opening ALMA settings...");
			await commands.executeCommand(
				"workbench.action.openSettings",
				VSC_CONFIG_NAMESPACE
			);
		}),
		commands.registerCommand("alma.settings.selectSpecSystem", async () => {
			const adapter = getSpecSystemAdapter();
			await adapter.selectSpecSystem();
		}),
		commands.registerCommand("alma.settings.openGlobalConfig", async () => {
			outputChannel.appendLine("Opening MCP config...");

			const configPath = await getMcpConfigPath();
			const configUri = Uri.file(configPath);

			try {
				await workspace.fs.stat(configUri);
			} catch {
				window.showWarningMessage(
					`MCP config not found at ${configUri.fsPath}.`
				);
				return;
			}

			try {
				const document = await workspace.openTextDocument(configUri);
				await window.showTextDocument(document, { preview: false });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.showErrorMessage(`Failed to open MCP config: ${message}`);
			}
		}),

		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("alma.help.open", async () => {
			outputChannel.appendLine("Opening ALMA help...");
			const helpUrl = "https://github.com/eita/alma-vscode#readme";
			env.openExternal(Uri.parse(helpUrl));
		}),

		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("alma.help.install", async () => {
			outputChannel.appendLine("Opening Spec Kit installation guide...");
			const installUrl = "https://github.com/github/spec-kit#readme";
			env.openExternal(Uri.parse(installUrl));
		}),

		commands.registerCommand("alma.menu.open", async () => {
			outputChannel.appendLine("Opening ALMA menu...");
			await toggleViews();
		}),

		commands.registerCommand("alma.migration.start", async () => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const migration = new SpecKitMigration(ws.uri.fsPath);
			await migration.migrateAllSpecs();
		}),

		commands.registerCommand(
			"alma.migration.generateConstitution",
			async () => {
				const ws = workspace.workspaceFolders?.[0];
				if (!ws) {
					window.showErrorMessage("No workspace folder found");
					return;
				}
				const migration = new SpecKitMigration(ws.uri.fsPath);
				await migration.generateConstitution();
			}
		),

		commands.registerCommand("alma.migration.createBackup", () => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const migration = new SpecKitMigration(ws.uri.fsPath);
			const backupPath = migration.createBackup();
			if (backupPath) {
				window.showInformationMessage(`Backup created at: ${backupPath}`);
			} else {
				window.showWarningMessage(
					"No OpenSpec directory found to backup, or backup failed."
				);
			}
		})
	);
}

async function getMcpConfigPath(): Promise<string> {
	const userDataPath = await getVSCodeUserDataPath();
	return join(userDataPath, "mcp.json");
}

function setupFileWatchers(
	context: ExtensionContext,
	specExplorer: SpecExplorerProvider,
	steeringExplorer: SteeringExplorerProvider,
	promptsExplorer: PromptsExplorerProvider
) {
	// Watch for changes in .copilot directories with debouncing
	const copilotWatcher = workspace.createFileSystemWatcher("**/.copilot/**/*");

	let refreshTimeout: NodeJS.Timeout | undefined;
	const debouncedRefresh = (event: string, uri: Uri) => {
		outputChannel.appendLine(`[FileWatcher] ${event}: ${uri.fsPath}`);

		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}
		refreshTimeout = setTimeout(() => {
			specExplorer.refresh();
			steeringExplorer.refresh();
			promptsExplorer.refresh();
		}, 1000); // Increase debounce time to 1 second
	};

	const attachWatcherHandlers = (watcher: FileSystemWatcher) => {
		watcher.onDidCreate((uri) => debouncedRefresh("Create", uri));
		watcher.onDidDelete((uri) => debouncedRefresh("Delete", uri));
		watcher.onDidChange((uri) => debouncedRefresh("Change", uri));
	};

	attachWatcherHandlers(copilotWatcher);

	const watchers: FileSystemWatcher[] = [copilotWatcher];

	const wsFolder = workspace.workspaceFolders?.[0];
	if (wsFolder) {
		const normalizeRelativePath = (value: string) =>
			value
				.replace(/\\/g, "/")
				// biome-ignore lint/performance/useTopLevelRegex: ignore
				.replace(/^\.\//, "")
				// biome-ignore lint/performance/useTopLevelRegex: ignore
				.replace(/\/+$/, "");

		const configManager = ConfigManager.getInstance();
		const settings = configManager.getSettings();
		const configuredPaths = [
			settings.paths.prompts,
			settings.paths.specs,
			settings.speckit.paths.specs,
			settings.speckit.paths.templates,
			settings.speckit.paths.memory,
		];

		const extraPatterns = new Set<string>();
		for (const rawPath of configuredPaths) {
			const normalized = normalizeRelativePath(rawPath);
			if (!normalized || normalized.startsWith("..")) {
				continue;
			}
			if (normalized === ".copilot" || normalized.startsWith(".copilot/")) {
				continue;
			}
			extraPatterns.add(`${normalized}/**/*`);
		}

		for (const pattern of extraPatterns) {
			const watcher = workspace.createFileSystemWatcher(
				new RelativePattern(wsFolder, pattern)
			);
			attachWatcherHandlers(watcher);
			watchers.push(watcher);
		}
	}

	context.subscriptions.push(...watchers);

	// Watch for changes in copilot-instructions.md files
	const globalHome = homedir() || process.env.USERPROFILE || "";
	const globalCopilotMdWatcher = workspace.createFileSystemWatcher(
		new RelativePattern(globalHome, ".github/copilot-instructions.md")
	);
	const projectCopilotMdWatcher = workspace.createFileSystemWatcher(
		"**/copilot-instructions.md"
	);

	globalCopilotMdWatcher.onDidCreate(() => steeringExplorer.refresh());
	globalCopilotMdWatcher.onDidDelete(() => steeringExplorer.refresh());
	projectCopilotMdWatcher.onDidCreate(() => steeringExplorer.refresh());
	projectCopilotMdWatcher.onDidDelete(() => steeringExplorer.refresh());

	context.subscriptions.push(globalCopilotMdWatcher, projectCopilotMdWatcher);
}

function getDefaultWorkspaceFileUri(fileName: string): Uri | undefined {
	const workspaceFolder = workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		return;
	}

	return Uri.joinPath(workspaceFolder.uri, fileName);
}

function getHooksExportFileName(): string {
	const timestamp = new Date().toISOString().replace(/[:]/g, "-");
	return `alma-hooks-${timestamp}.json`;
}

// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
export function deactivate() {}
