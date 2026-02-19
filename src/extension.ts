import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { FileSystemWatcher } from "vscode";
import {
	commands,
	ConfigurationTarget,
	type DocumentSelector,
	env,
	type ExtensionContext,
	languages,
	type OutputChannel,
	Position,
	Range,
	RelativePattern,
	Selection,
	Uri,
	window,
	workspace,
} from "vscode";
import { VSC_CONFIG_NAMESPACE } from "./constants";
import { SpecManager } from "./features/spec/spec-manager";
import { SteeringManager } from "./features/steering/steering-manager";
import { AgentService } from "./services/agent-service";
import { CopilotProvider } from "./providers/copilot-provider";
import { QuickAccessExplorerProvider } from "./providers/quick-access-explorer-provider";
import { ActionsExplorerProvider } from "./providers/actions-explorer-provider";
import { SpecExplorerProvider } from "./providers/spec-explorer-provider";
import { SpecTaskCodeLensProvider } from "./providers/spec-task-code-lens-provider";
import { SteeringExplorerProvider } from "./providers/steering-explorer-provider";
import { WikiExplorerProvider } from "./providers/wiki-explorer-provider";
import { PromptLoader } from "./services/prompt-loader";
import { sendPromptToChat } from "./utils/chat-prompt-runner";
import { ConfigManager } from "./utils/config-manager";
import { getMcpConfigPath } from "./utils/platform-utils";
import { getSpecSystemAdapter } from "./utils/spec-kit-adapter";
import { parseTasksFromFile, getTasksFilePath } from "./utils/task-parser";
import { getChecklistStatusFromFile } from "./utils/checklist-parser";
import { SpecKitMigration } from "./utils/spec-kit-migration";
import { TriggerRegistry } from "./features/hooks/trigger-registry";
import { HookManager } from "./features/hooks/hook-manager";
import { HookExecutor } from "./features/hooks/hook-executor";
import { AgentRegistry } from "./features/hooks/agent-registry";
import { CommandCompletionDetector } from "./features/hooks/services/command-completion-detector";
import { MCPDiscoveryService } from "./features/hooks/services/mcp-discovery";
import { ModelCacheService } from "./features/hooks/services/model-cache-service";
import { AcpAgentDiscoveryService } from "./features/hooks/services/acp-agent-discovery-service";
import { KnownAgentDetector } from "./features/hooks/services/known-agent-detector";
import { KnownAgentPreferencesService } from "./features/hooks/services/known-agent-preferences-service";
import { KNOWN_AGENTS } from "./features/hooks/services/known-agent-catalog";
import { HookViewProvider } from "./providers/hook-view-provider";
import { HooksExplorerProvider } from "./providers/hooks-explorer-provider";
import { DependenciesViewProvider } from "./providers/dependencies-view-provider";
import { DocumentPreviewPanel } from "./panels/document-preview-panel";
import { DocumentPreviewService } from "./services/document-preview-service";
import { RefinementGateway } from "./services/refinement-gateway";
import type { DocumentArtifact } from "./types/preview";
import {
	SEND_TO_REVIEW_COMMAND_ID,
	handleSendToReview,
} from "./features/spec/review-flow/commands/send-to-review-command";
import {
	REOPEN_SPEC_COMMAND_ID,
	handleReopenSpec,
} from "./features/spec/review-flow/commands/reopen-spec-command";
import {
	initializeAutoReviewTransitions,
	updatePendingSummary,
	upsertSpecState,
} from "./features/spec/review-flow/state";
import {
	SEND_TO_ARCHIVED_COMMAND_ID,
	UNARCHIVE_COMMAND_ID,
	handleSendToArchived,
	handleUnarchive,
} from "./features/spec/review-flow/commands/send-to-archived-command";
import { WelcomeScreenPanel } from "./panels/welcome-screen-panel";
import { WelcomeScreenProvider } from "./providers/welcome-screen-provider";
import {
	shouldShowWelcomeAutomatically,
	markWelcomeAsShown,
} from "./utils/workspace-state";
import {
	isGlobalResourceAccessAllowed,
	openGlobalResourceAccessSettings,
} from "./features/steering/global-resource-access-consent";

let copilotProvider: CopilotProvider;
let specManager: SpecManager;
let steeringManager: SteeringManager;
let agentService: AgentService;
let triggerRegistry: TriggerRegistry;
let hookManager: HookManager;
let hookExecutor: HookExecutor;
let commandCompletionDetector: CommandCompletionDetector;
let mcpDiscoveryService: MCPDiscoveryService;
let agentRegistry: AgentRegistry;
let hookViewProvider: HookViewProvider;
let dependenciesViewProvider: DependenciesViewProvider;
let documentPreviewPanel: DocumentPreviewPanel;
let documentPreviewService: DocumentPreviewService;
let refinementGateway: RefinementGateway;
let activePreviewUri: Uri | undefined;
type HookCommandTarget = { hookId?: string } | string;

/**
 * Pattern to match spec names in file paths (e.g., "001-document-preview")
 */
const SPEC_NAME_PATTERN = /^\d{3}-/;

export let outputChannel: OutputChannel;

export async function activate(context: ExtensionContext) {
	// Create output channel for debugging
	outputChannel = window.createOutputChannel("GatomIA - Debug");

	// Initialize PromptLoader
	try {
		const promptLoader = PromptLoader.getInstance();
		promptLoader.initialize();
		outputChannel.appendLine("PromptLoader initialized successfully");
	} catch (error) {
		outputChannel.appendLine(`Failed to initialize PromptLoader: ${error} `);
		window.showErrorMessage(`Failed to initialize prompt system: ${error} `);
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
			`Spec System Adapter initialized.Active system: ${adapter.getActiveSystem()} `
		);

		// Load prompts from active system
		const promptsPath = adapter.getPromptsBasePath();
		PromptLoader.getInstance().loadPromptsFromDirectory(promptsPath);
		outputChannel.appendLine(`Loaded prompts from: ${promptsPath} `);
	} catch (error) {
		outputChannel.appendLine(
			`Failed to initialize Spec System Adapter: ${error} `
		);
	}

	// Initialize feature managers with output channel
	specManager = new SpecManager(context, outputChannel);
	steeringManager = new SteeringManager(
		context,
		copilotProvider,
		outputChannel
	);

	// Initialize AgentService
	try {
		outputChannel.appendLine("[Extension] Initializing AgentService...");
		agentService = new AgentService(outputChannel);
		await agentService.initialize(context.extensionPath);
		context.subscriptions.push(agentService);
		outputChannel.appendLine(
			"[Extension] AgentService initialized successfully"
		);
	} catch (error) {
		outputChannel.appendLine(
			`[Extension] Failed to initialize AgentService: ${error}`
		);
		// Don't fail extension activation if agent service fails
	}

	// TODO: Initialize AgentService when implemented in Phase 2 (User Story 1)
	// agentService = new AgentService(context, outputChannel);
	// await agentService.initialize();

	// Initialize TriggerRegistry for hooks
	triggerRegistry = new TriggerRegistry(outputChannel);
	triggerRegistry.initialize();
	outputChannel.appendLine("TriggerRegistry initialized");

	// Connect TriggerRegistry to SpecManager
	specManager.setTriggerRegistry(triggerRegistry);

	// Initialize MCP Discovery Service (needed for HookManager and HookExecutor)
	mcpDiscoveryService = new MCPDiscoveryService();
	outputChannel.appendLine("MCPDiscoveryService initialized");

	// Initialize ModelCacheService for dynamic model selection (T018 / US1)
	const modelCacheService = new ModelCacheService();
	outputChannel.appendLine("ModelCacheService initialized");

	// Initialize AcpAgentDiscoveryService for ACP agent hooks (Phase 6)
	const knownAgentDetector = new KnownAgentDetector();
	const knownAgentPreferencesService = new KnownAgentPreferencesService(
		context
	);
	const acpAgentDiscoveryService = new AcpAgentDiscoveryService(
		workspaceFolders?.[0]?.uri.fsPath ?? "",
		knownAgentDetector,
		knownAgentPreferencesService
	);
	outputChannel.appendLine("AcpAgentDiscoveryService initialized");
	// Warm the agent detection cache eagerly in the background — results will be
	// ready by the time the user opens the Hooks panel. Fire-and-forget (non-blocking).
	knownAgentDetector
		.preloadAll(KNOWN_AGENTS)
		.then(() => {
			outputChannel.appendLine("KnownAgentDetector: preload complete");
		})
		.catch((err: unknown) => {
			outputChannel.appendLine(
				`KnownAgentDetector: preload error: ${(err as Error).message}`
			);
		});

	// Initialize AgentRegistry for custom agent hooks (Phase 2 - T010, T018)
	// Must be initialized before HookManager to enable agent validation
	const agentWorkspaceRoot = workspaceFolders?.[0]?.uri.fsPath || "";
	agentRegistry = new AgentRegistry(agentWorkspaceRoot);
	await agentRegistry.initialize();
	outputChannel.appendLine("AgentRegistry initialized");

	// Initialize Hook infrastructure with MCP support and AgentRegistry (T025)
	hookManager = new HookManager(
		context,
		outputChannel,
		mcpDiscoveryService,
		agentRegistry
	);
	await hookManager.initialize();

	hookExecutor = new HookExecutor(
		hookManager,
		triggerRegistry,
		outputChannel,
		mcpDiscoveryService,
		agentRegistry
	);
	hookExecutor.initialize();

	// Initialize CommandCompletionDetector to detect when SpecKit commands complete
	commandCompletionDetector = new CommandCompletionDetector(
		triggerRegistry,
		outputChannel
	);
	commandCompletionDetector.initialize();
	outputChannel.appendLine("CommandCompletionDetector initialized");

	hookViewProvider = new HookViewProvider({
		context,
		hookManager,
		hookExecutor,
		mcpDiscoveryService,
		modelCacheService,
		acpAgentDiscoveryService,
		outputChannel,
		knownAgentPreferencesService,
		knownAgentDetector,
	});
	hookViewProvider.initialize();

	// Initialize Dependencies View Provider
	dependenciesViewProvider = new DependenciesViewProvider(
		context,
		outputChannel
	);

	documentPreviewService = new DocumentPreviewService(outputChannel, context);
	refinementGateway = new RefinementGateway(outputChannel);
	documentPreviewPanel = new DocumentPreviewPanel(context, outputChannel, {
		onReloadRequested: async () => {
			if (activePreviewUri) {
				await renderPreviewForUri(activePreviewUri);
			}
		},
		onEditAttempt: () => {
			outputChannel.appendLine("[Preview] Prevented raw document edit request");
		},
		onOpenInEditor: () => openActivePreviewInEditor(),
		onFormSubmit: async (payload) => {
			if (!documentPreviewService) {
				return { status: "error", message: "Preview service not ready" };
			}

			try {
				await documentPreviewService.persistFormSubmission(payload);
				outputChannel.appendLine(
					`[Preview] Form submission received for ${payload.documentId}`
				);
				return { status: "success" as const };
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(
					`[Preview] Failed to persist form submission: ${message} `
				);
				return { status: "error" as const, message };
			}
		},
		onRefineSubmit: async (payload) => {
			if (!refinementGateway) {
				return {
					status: "error" as const,
					message: "Refinement gateway not ready",
				};
			}

			try {
				return await refinementGateway.submitRequest(payload);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(`[RefinementGateway] Failed: ${message} `);
				return { status: "error" as const, message };
			}
		},
		onExecuteTaskGroup: async (groupName: string) => {
			// Get the current active preview URI
			if (!activePreviewUri) {
				window.showErrorMessage(
					"No document is currently previewed. Open a spec document first."
				);
				return;
			}

			try {
				// Extract spec name from URI (e.g., "001-document-preview")
				const pathParts = activePreviewUri.fsPath.split("/");
				const specName = pathParts.find((part) =>
					part.match(SPEC_NAME_PATTERN)
				);
				if (!specName) {
					window.showErrorMessage(
						"Could not identify spec name from current document."
					);
					return;
				}

				// Get the tasks file path and parse tasks
				const tasksFilePath = getTasksFilePath(specName);
				if (!tasksFilePath) {
					window.showErrorMessage(
						`Could not find tasks.md for spec: ${specName} `
					);
					return;
				}

				const taskGroups = parseTasksFromFile(tasksFilePath);

				// Find matching group (e.g., "Phase 1: Foundation & Core Types")
				// The groupName from the button will be like "Phase 1: Foundation & Core Types"
				const matchingGroup = taskGroups.find(
					(group) =>
						group.name.includes(groupName) || groupName.includes(group.name)
				);

				if (!matchingGroup || matchingGroup.tasks.length === 0) {
					window.showErrorMessage(`No tasks found for group: ${groupName} `);
					return;
				}

				// Aggregate task IDs
				const taskDescriptions = matchingGroup.tasks
					.map((t) => `${t.id}: ${t.title} `)
					.join("\n- ");

				// Send to Copilot with all task IDs
				const prompt = `/ speckit.implement ${groupName} \n\nTasks: \n - ${taskDescriptions} `;
				await sendPromptToChat(prompt);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.showErrorMessage(`Failed to execute task group: ${message} `);
				outputChannel.appendLine(`[Execute Task Group]Failed: ${message} `);
			}
		},
		onOpenFile: async (filePath: string) => {
			if (!filePath) {
				return;
			}

			try {
				// Get workspace root
				const workspaceRoot = workspace.workspaceFolders?.[0].uri.fsPath;
				if (!workspaceRoot) {
					window.showErrorMessage("No workspace open.");
					return;
				}

				let absolutePath: Uri;

				outputChannel.appendLine(
					`[Open File]Processing: ${filePath}, activePreviewUri: ${activePreviewUri?.fsPath} `
				);

				// If the path is absolute, use it directly
				if (filePath.startsWith("/")) {
					absolutePath = Uri.file(filePath);
				} else if (activePreviewUri) {
					// Get the directory of the currently previewed file
					const currentFileDir = dirname(activePreviewUri.fsPath);

					// Resolve relative path from the current file's directory
					const resolvedPath = join(currentFileDir, filePath);
					absolutePath = Uri.file(resolvedPath);

					outputChannel.appendLine(
						`[Open File] Resolved relative path: ${filePath} -> ${resolvedPath} `
					);
				} else {
					// Fallback: try to resolve from workspace root
					absolutePath = Uri.file(join(workspaceRoot, filePath));
					outputChannel.appendLine(
						`[Open File] Using workspace root fallback: ${absolutePath.fsPath} `
					);
				}

				// Check if file exists
				try {
					await workspace.fs.stat(absolutePath);
				} catch {
					const suggestion = `Path: ${absolutePath.fsPath} `;
					outputChannel.appendLine(
						`[Open File] File not found: ${suggestion} `
					);
					window.showErrorMessage(
						`File not found: ${filePath} \n\nResolved to: ${absolutePath.fsPath} `
					);
					return;
				}

				// Render the file in the preview
				await renderPreviewForUri(absolutePath);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.showErrorMessage(`Failed to open file: ${message} `);
				outputChannel.appendLine(`[Open File]Failed: ${message} `);
			}
		},
	});
	setupDocumentPreviewWatchers(context);

	// Register tree data providers
	const quickAccessExplorer = new QuickAccessExplorerProvider();
	const specExplorer = new SpecExplorerProvider(context);
	const steeringExplorer = new SteeringExplorerProvider(context, outputChannel);
	const actionsExplorer = new ActionsExplorerProvider(context);
	const hooksExplorer = new HooksExplorerProvider(hookManager);
	hooksExplorer.initialize();

	// Initialize Wiki Explorer Provider
	const wikiExplorer = new WikiExplorerProvider(context);

	// Set managers
	specExplorer.setSpecManager(specManager);
	steeringExplorer.setSteeringManager(steeringManager);
	initializeAutoReviewTransitions();
	outputChannel.appendLine("[ReviewFlow] Auto review transitions initialized");

	// Register tree providers immediately so VS Code can render initial state
	context.subscriptions.push(
		window.registerTreeDataProvider(
			QuickAccessExplorerProvider.viewId,
			quickAccessExplorer
		),
		window.registerTreeDataProvider("gatomia.views.specExplorer", specExplorer),
		window.registerTreeDataProvider(
			"gatomia.views.steeringExplorer",
			steeringExplorer
		),
		window.registerTreeDataProvider(
			"gatomia.views.actionsExplorer",
			actionsExplorer
		),
		window.registerTreeDataProvider(
			HooksExplorerProvider.viewId,
			hooksExplorer
		),
		window.registerTreeDataProvider(WikiExplorerProvider.viewId, wikiExplorer)
	);

	// Deferred refresh: gives VS Code one tick to complete internal tree setup
	// before the first data push (guards against settled-state empty render)
	setImmediate(() => {
		specExplorer.refresh();
		steeringExplorer.refresh();
		hooksExplorer.refresh();
		actionsExplorer.refresh();
		outputChannel.appendLine(
			"[TreeView] Post-registration deferred refresh fired"
		);
	});

	// Run heavyweight sync non-blocking; refresh spec explorer when pending counts are ready
	syncAllSpecReviewFlowSummaries(specManager)
		.then(() => {
			specExplorer.refresh();
			outputChannel.appendLine(
				"[ReviewFlow] Initial sync complete, spec explorer refreshed"
			);
		})
		.catch((err: unknown) => {
			outputChannel.appendLine(
				`[ReviewFlow] Failed to sync initial pending summaries: ${err}`
			);
		});
	context.subscriptions.push(
		{ dispose: () => hookManager.dispose() },
		{ dispose: () => hookExecutor.dispose() },
		{ dispose: () => commandCompletionDetector.dispose() },
		{ dispose: () => modelCacheService.dispose() },
		{ dispose: () => hookViewProvider.dispose() },
		{ dispose: () => hooksExplorer.dispose() },
		{ dispose: () => quickAccessExplorer.dispose() },
		{ dispose: () => dependenciesViewProvider.dispose() }
	);

	// Register commands
	registerCommands({
		context,
		specExplorer,
		steeringExplorer,
		actionsExplorer,
		hooksExplorer,
		wikiExplorer,
	});

	// Register wiki commands
	context.subscriptions.push(
		commands.registerCommand(WikiExplorerProvider.refreshCommandId, () => {
			outputChannel.appendLine("[Wiki] Refreshing wiki explorer...");
			wikiExplorer.refresh();
		}),
		commands.registerCommand(
			WikiExplorerProvider.openCommandId,
			async (documentPath: string) => {
				if (documentPath) {
					const uri = Uri.file(documentPath);
					await renderPreviewForUri(uri);
				}
			}
		),
		commands.registerCommand(
			WikiExplorerProvider.updateCommandId,
			async (documentPath: string) => {
				if (documentPath) {
					await wikiExplorer.updateDocument(documentPath);
				}
			}
		),
		commands.registerCommand(
			WikiExplorerProvider.updateAllCommandId,
			async () => {
				await wikiExplorer.updateAllDocuments();
			}
		),
		commands.registerCommand(WikiExplorerProvider.showTocCommandId, () => {
			window.showInformationMessage("Table of Contents - Coming soon!");
		})
	);

	// Set up file watchers
	setupFileWatchers(context, specExplorer, steeringExplorer, actionsExplorer);

	// Register CodeLens provider for spec tasks
	const specTaskCodeLensProvider = new SpecTaskCodeLensProvider();
	const selector: DocumentSelector = [
		{
			language: "markdown",
			pattern: "**/*tasks.md",
			scheme: "file",
		},
	];
	const specTasksDisposable = languages.registerCodeLensProvider(
		selector,
		specTaskCodeLensProvider
	);
	context.subscriptions.push(specTasksDisposable);
	outputChannel.appendLine("CodeLens provider for spec tasks registered");

	// T019-T020: First-time welcome screen activation
	try {
		const shouldShow = shouldShowWelcomeAutomatically(context);
		outputChannel.appendLine(`[Welcome] First - time check: ${shouldShow} `);

		if (shouldShow) {
			outputChannel.appendLine(
				"[Welcome] Showing welcome screen for first time"
			);

			// Initialize welcome screen provider
			const welcomeProvider = new WelcomeScreenProvider(context, outputChannel);
			outputChannel.appendLine("[Welcome] Provider created");

			// Get callbacks with panel reference setter
			const callbacks = welcomeProvider.getCallbacks();
			outputChannel.appendLine("[Welcome] Callbacks retrieved");

			// Show welcome screen panel with provider callbacks
			const welcomePanel = WelcomeScreenPanel.show(
				context,
				outputChannel,
				callbacks
			);
			outputChannel.appendLine("[Welcome] Panel created");

			// Set panel reference in callbacks (T028-T032)
			if (callbacks.setPanel) {
				callbacks.setPanel(welcomePanel);
				outputChannel.appendLine("[Welcome] Panel reference set in callbacks");
			}

			// Mark as shown for next time
			await markWelcomeAsShown(context);
			outputChannel.appendLine("[Welcome] Marked as shown");
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(
			`[Welcome] Failed to show first - time screen: ${message} `
		);
		// Don't show error to user - welcome screen is optional
	}

	// No UI mode toggle commands required
}

async function syncAllSpecReviewFlowSummaries(
	specManagerInstance: SpecManager
): Promise<void> {
	try {
		const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) {
			return;
		}

		const unifiedSpecs = await specManagerInstance.getAllSpecsUnified();
		for (const spec of unifiedSpecs) {
			await syncSpecReviewFlowSummary({
				workspaceRoot,
				specId: spec.id,
				specTitle: spec.name,
			});
		}
	} catch (error) {
		outputChannel.appendLine(
			`[ReviewFlow] Failed to sync initial pending summaries: ${error} `
		);
	}
}

function extractSpecIdFromPath(filePath: string): string | null {
	const parts = filePath.split("/");
	return parts.find((part) => part.match(SPEC_NAME_PATTERN)) ?? null;
}

function resolveSpecLinks(options: { workspaceRoot: string; specId: string }): {
	specPath: string;
	docUrl?: string;
} {
	// We keep this lightweight: the specPath does not need to exist for state to function.
	return {
		specPath: join(options.workspaceRoot, "specs", options.specId, "spec.md"),
	};
}

async function computePendingSummary(options: {
	workspaceRoot: string;
	specId: string;
}): Promise<{ pendingTasks: number; pendingChecklistItems: number }> {
	const tasksFilePath = getTasksFilePath(options.specId);
	const pendingTasks = (() => {
		if (!tasksFilePath) {
			// Treat missing tasks file as a blocker to avoid false-positive auto transitions.
			return 1;
		}
		const groups = parseTasksFromFile(tasksFilePath);
		const allTasks = groups.flatMap((group) => group.tasks);
		return allTasks.filter((task) => task.status !== "completed").length;
	})();

	const checklistsFolderCandidates = [
		join(options.workspaceRoot, "specs", options.specId, "checklists"),
		join(
			options.workspaceRoot,
			"openspec",
			"specs",
			options.specId,
			"checklists"
		),
		join(options.workspaceRoot, "openspec", options.specId, "checklists"),
	];

	const { existsSync, readdirSync, statSync } = await import("node:fs");
	let pendingChecklistItems = 0;
	const folderPath = checklistsFolderCandidates.find((candidate) =>
		existsSync(candidate)
	);
	if (folderPath) {
		for (const entry of readdirSync(folderPath)) {
			if (!entry.endsWith(".md")) {
				continue;
			}
			const filePath = join(folderPath, entry);
			if (!statSync(filePath).isFile()) {
				continue;
			}
			const { total, completed } = getChecklistStatusFromFile(filePath);
			pendingChecklistItems += Math.max(0, total - completed);
		}
	}

	return { pendingTasks, pendingChecklistItems };
}

async function syncSpecReviewFlowSummary(options: {
	workspaceRoot: string;
	specId: string;
	specTitle: string;
}): Promise<void> {
	const links = resolveSpecLinks({
		workspaceRoot: options.workspaceRoot,
		specId: options.specId,
	});

	upsertSpecState({
		specId: options.specId,
		title: options.specTitle,
		owner: "unknown",
		links,
	});

	const { pendingTasks, pendingChecklistItems } = await computePendingSummary({
		workspaceRoot: options.workspaceRoot,
		specId: options.specId,
	});

	updatePendingSummary(options.specId, pendingTasks, pendingChecklistItems);
}

interface RegisterCommandsOptions {
	context: ExtensionContext;
	specExplorer: SpecExplorerProvider;
	steeringExplorer: SteeringExplorerProvider;
	actionsExplorer: ActionsExplorerProvider;
	hooksExplorer: HooksExplorerProvider;
	wikiExplorer: WikiExplorerProvider;
}

function registerCommands({
	context,
	specExplorer,
	steeringExplorer,
	actionsExplorer,
	hooksExplorer,
	wikiExplorer,
}: RegisterCommandsOptions) {
	const createSpecCommand = commands.registerCommand(
		"gatomia.spec.create",
		async () => {
			outputChannel.appendLine(
				`[Spec] create command triggered at ${new Date().toISOString()} `
			);

			try {
				await specManager.create();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(`[Spec] create command failed: ${message} `);
				window.showErrorMessage(`Failed to create spec prompt: ${message} `);
			}
		}
	);

	const resolveHookId = (target?: HookCommandTarget): string | undefined => {
		if (!target) {
			return;
		}
		if (typeof target === "string") {
			return target;
		}
		if (typeof target.hookId === "string") {
			return target.hookId;
		}
		return;
	};

	context.subscriptions.push(
		commands.registerCommand("gatomia.noop", () => {
			// noop
		}),
		createSpecCommand,
		commands.registerCommand(
			"gatomia.spec.navigate.requirements",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "requirements");
			}
		),

		commands.registerCommand(
			"gatomia.spec.navigate.design",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "design");
			}
		),

		commands.registerCommand(
			"gatomia.spec.navigate.tasks",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "tasks");
			}
		),

		commands.registerCommand(
			"gatomia.spec.implTask",
			async (documentUri: Uri) => {
				outputChannel.appendLine(
					`[Task Execute] Generating GatomIA apply prompt for: ${documentUri.fsPath} `
				);
				await specManager.runOpenSpecApply(documentUri);
			}
		),

		commands.registerCommand(
			"gatomia.spec.runTask",
			async (item?: { task?: { id: string; title: string } }) => {
				if (!item?.task) {
					window.showErrorMessage("Select a task to run.");
					return;
				}

				const { id, title } = item.task;
				const taskDescription = `${id}: ${title} `;
				outputChannel.appendLine(
					`[Run Task] Triggering speckit.implement for task: ${taskDescription} `
				);

				try {
					await sendPromptToChat(`/ speckit.implement ${taskDescription} `);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					window.showErrorMessage(`Failed to run task: ${message} `);
					outputChannel.appendLine(`[Run Task]Failed: ${message} `);
				}
			}
		),

		commands.registerCommand(
			"gatomia.spec.runTaskGroup",
			async (args?: { parentName?: string; filePath?: string }) => {
				if (!args?.parentName) {
					window.showErrorMessage("Select a task group to run.");
					return;
				}

				const groupName = args.parentName;
				outputChannel.appendLine(
					`[Run Task Group] Triggering speckit.implement for group: ${groupName} `
				);

				try {
					await sendPromptToChat(`/ speckit.implement ${groupName} `);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					window.showErrorMessage(`Failed to run task group: ${message} `);
					outputChannel.appendLine(`[Run Task Group]Failed: ${message} `);
				}
			}
		),

		commands.registerCommand(
			"gatomia.spec.open",
			async (relativePath: string, type: string, line?: number) => {
				const uri = resolveWorkspaceRelativeUri(relativePath);
				if (uri) {
					const artifact = await renderPreviewForUri(uri);
					if (artifact) {
						return;
					}
				}
				await specManager.openDocument(relativePath, type);
				if (uri && typeof line === "number") {
					await openDocumentInEditor(uri, line);
				}
			}
		),
		commands.registerCommand("gatomia.preview.openActiveDocument", async () => {
			const editor = window.activeTextEditor;
			if (!editor) {
				window.showErrorMessage("Open a document to preview.");
				return;
			}
			await renderPreviewForUri(editor.document.uri);
		}),
		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("gatomia.spec.refresh", async () => {
			outputChannel.appendLine("[Manual Refresh] Refreshing spec explorer...");
			specExplorer.refresh();
		}),
		commands.registerCommand(
			SEND_TO_REVIEW_COMMAND_ID,
			async (specArg: unknown) => {
				await handleSendToReview(specArg, () => specExplorer.refresh());
			}
		),
		commands.registerCommand(
			SEND_TO_ARCHIVED_COMMAND_ID,
			async (specArg: unknown) => {
				await handleSendToArchived(specArg, () => specExplorer.refresh());
			}
		),
		commands.registerCommand(UNARCHIVE_COMMAND_ID, async (specArg: unknown) => {
			await handleUnarchive(specArg, () => specExplorer.refresh());
		}),
		commands.registerCommand(
			REOPEN_SPEC_COMMAND_ID,
			async (specArg: unknown) => {
				await handleReopenSpec(specArg, () => specExplorer.refresh());
			}
		),
		commands.registerCommand("gatomia.hooks.export", async () => {
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

				const message = `Exported hooks to ${saveUri.fsPath} `;
				window.showInformationMessage(message);
				outputChannel.appendLine(`[Hooks] ${message} `);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				window.showErrorMessage(`Failed to export hooks: ${message} `);
				outputChannel.appendLine(`[Hooks] Failed to export hooks: ${message} `);
			}
		}),
		commands.registerCommand("gatomia.hooks.import", async () => {
			await handleHooksImport();
		}),
		commands.registerCommand("gatomia.hooks.addHook", async () => {
			if (!hookViewProvider) {
				return;
			}
			await hookViewProvider.showCreateHookForm();
		}),
		commands.registerCommand(
			"gatomia.hooks.viewLogs",
			async (target?: HookCommandTarget) => {
				if (!hookViewProvider) {
					return;
				}
				await hookViewProvider.showLogsPanel(resolveHookId(target));
			}
		),
		commands.registerCommand("gatomia.hooks.refresh", () => {
			outputChannel.appendLine("[Manual Refresh] Refreshing hooks explorer...");
			hooksExplorer.refresh();
		}),
		commands.registerCommand(
			"gatomia.hooks.edit",
			async (target?: HookCommandTarget) => {
				if (!(hookViewProvider && hookManager)) {
					return;
				}
				const hookId = resolveHookId(target);
				if (!hookId) {
					window.showErrorMessage("Select a hook to edit.");
					return;
				}
				const hook = hookManager.getHook(hookId);
				if (!hook) {
					window.showErrorMessage("Hook could not be found.");
					return;
				}
				await hookViewProvider.showEditHookForm(hook);
			}
		),
		commands.registerCommand(
			"gatomia.hooks.enable",
			async (target?: HookCommandTarget) => {
				if (!hookManager) {
					window.showErrorMessage("Hook manager is not ready yet.");
					return;
				}
				const hookId = resolveHookId(target);
				if (!hookId) {
					return;
				}
				try {
					await hookManager.updateHook(hookId, { enabled: true });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					window.showErrorMessage(`Failed to enable hook: ${message} `);
				}
			}
		),
		commands.registerCommand(
			"gatomia.hooks.disable",
			async (target?: HookCommandTarget) => {
				if (!hookManager) {
					window.showErrorMessage("Hook manager is not ready yet.");
					return;
				}
				const hookId = resolveHookId(target);
				if (!hookId) {
					return;
				}
				try {
					await hookManager.updateHook(hookId, { enabled: false });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					window.showErrorMessage(`Failed to pause hook: ${message} `);
				}
			}
		),
		commands.registerCommand(
			"gatomia.hooks.delete",
			async (target?: HookCommandTarget) => {
				if (!hookManager) {
					window.showErrorMessage("Hook manager is not ready yet.");
					return;
				}
				const hookId = resolveHookId(target);
				if (!hookId) {
					return;
				}
				const confirmation = await window.showWarningMessage(
					"Delete this hook? This action cannot be undone.",
					{ modal: true },
					"Delete"
				);
				if (confirmation !== "Delete") {
					return;
				}
				try {
					await hookManager.deleteHook(hookId);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					window.showErrorMessage(`Failed to delete hook: ${message} `);
				}
			}
		)
	);

	// No UI mode toggle commands required

	// Steering commands
	context.subscriptions.push(
		// Configuration commands
		commands.registerCommand("gatomia.steering.createUserRule", async () => {
			const created = await steeringManager.createUserInstructionRule();
			if (created) {
				steeringExplorer.refresh();
			}
		}),
		commands.registerCommand("gatomia.steering.createProjectRule", async () => {
			const created = await steeringManager.createProjectInstructionRule();
			if (created) {
				steeringExplorer.refresh();
			}
		}),
		commands.registerCommand(
			"gatomia.steering.createConstitution",
			async () => {
				await steeringManager.createConstitutionRequest();
			}
		),
		commands.registerCommand("gatomia.steering.refresh", () => {
			outputChannel.appendLine(
				"[Manual Refresh] Refreshing steering explorer..."
			);
			steeringExplorer.refresh();
		}),
		commands.registerCommand(
			"gatomia.steering.openGlobalResourceAccessSettings",
			async () => {
				await openGlobalResourceAccessSettings();
			}
		)
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

	// Context menu for folders
	context.subscriptions.push(
		commands.registerCommand("gatomia.newSpec", async (uri: Uri) => {
			await createNewFile(uri, ".spec.md");
		})
	);

	context.subscriptions.push(
		commands.registerCommand("gatomia.newChecklist", async (uri: Uri) => {
			await createNewFile(uri, ".checklist.md");
		})
	);

	// Spec delete command
	context.subscriptions.push(
		commands.registerCommand("gatomia.spec.delete", async (item: unknown) => {
			const resolvedSpecId = (() => {
				if (typeof item === "string") {
					return item;
				}
				if (!item || typeof item !== "object") {
					return null;
				}
				const record = item as { specName?: unknown; label?: unknown };
				if (typeof record.specName === "string" && record.specName.length > 0) {
					return record.specName;
				}
				if (typeof record.label === "string" && record.label.length > 0) {
					return record.label;
				}
				return null;
			})();

			if (!resolvedSpecId) {
				await window.showErrorMessage(
					"Could not determine which spec to delete. Please refresh and try again."
				);
				return;
			}

			const system =
				item && typeof item === "object"
					? (item as { system?: unknown }).system
					: undefined;

			await specManager.delete(
				resolvedSpecId,
				system as Parameters<typeof specManager.delete>[1]
			);
			specExplorer.refresh();
		}),
		commands.registerCommand(
			"gatomia.spec.archiveChange",
			async (item: any) => {
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
					const fullPrompt = `${promptString} \n\nid: ${changeId} `;

					outputChannel.appendLine(
						`[Archive Change] Archiving change: ${changeId} `
					);
					await sendPromptToChat(fullPrompt);
				} catch (error) {
					window.showErrorMessage(
						`Failed to read archive prompt: ${error instanceof Error ? error.message : String(error)} `
					);
				}
			}
		)
	);

	// Copilot integration commands
	// Copilot CLI integration commands

	// Actions commands
	context.subscriptions.push(
		commands.registerCommand("gatomia.actions.refresh", () => {
			outputChannel.appendLine(
				"[Manual Refresh] Refreshing actions explorer..."
			);
			actionsExplorer.refresh();
		}),
		commands.registerCommand("gatomia.actions.createSkill", async () => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}

			const name = await window.showInputBox({
				title: "Create Skill",
				placeHolder: "skill-name (kebab-case)",
				prompt: "A SKILL.md file will be created under .github/skills/<name>/",
				validateInput: (v) => (v ? undefined : "Name is required"),
			});

			if (!name) {
				return;
			}

			const skillDir = Uri.joinPath(ws.uri, ".github", "skills", name);
			const skillFile = Uri.joinPath(skillDir, "SKILL.md");

			try {
				await workspace.fs.createDirectory(skillDir);
				const content = Buffer.from(
					`# ${name}\n\n## Description\nDescribe the purpose of this skill.\n\n## Instructions\nProvide specific instructions for Copilot on how to use this skill.\n`
				);
				await workspace.fs.writeFile(skillFile, content);
				const doc = await workspace.openTextDocument(skillFile);
				await window.showTextDocument(doc);
				actionsExplorer.refresh();
			} catch (e) {
				window.showErrorMessage(`Failed to create skill: ${e}`);
			}
		}),
		commands.registerCommand(
			"gatomia.actions.createCopilotPrompt",
			async () => {
				await commands.executeCommand("workbench.command.new.prompt");
			}
		),
		commands.registerCommand("gatomia.actions.create", async (item?: any) => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const configManager = ConfigManager.getInstance();

			let targetDir: Uri;
			const actionsPathLabel = configManager.getPath("prompts");
			targetDir = Uri.joinPath(ws.uri, ".copilot", "prompts");
			try {
				targetDir = Uri.file(configManager.getAbsolutePath("prompts"));
			} catch {
				// fall back to default under workspace
			}

			const name = await window.showInputBox({
				title: "Create Prompt",
				placeHolder: "prompt-name (kebab-case)",
				prompt: `A markdown file will be created under ${actionsPathLabel} `,
				validateInput: (v) => (v ? undefined : "Name is required"),
			});
			if (!name) {
				return;
			}

			const file = Uri.joinPath(targetDir, `${name}.prompt.md`);
			try {
				await workspace.fs.createDirectory(targetDir);
				const content = Buffer.from(
					`# ${name} \n\nDescribe your action here.This file will be sent to Copilot when executed.\n`
				);
				await workspace.fs.writeFile(file, content);
				const doc = await workspace.openTextDocument(file);
				await window.showTextDocument(doc);
				actionsExplorer.refresh();
			} catch (e) {
				window.showErrorMessage(`Failed to create action: ${e} `);
			}
		}),
		commands.registerCommand(
			"gatomia.actions.run",
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
						window.showErrorMessage("No action selection found");
						return;
					}

					const fileData = await workspace.fs.readFile(targetUri);
					const promptContent = new TextDecoder().decode(fileData);
					await sendPromptToChat(promptContent, {
						instructionType: "runPrompt",
					});
				} catch (e) {
					window.showErrorMessage(`Failed to run action: ${e} `);
				}
			}
		),
		commands.registerCommand("gatomia.actions.rename", async (item?: any) => {
			await actionsExplorer.renamePrompt(item);
		}),
		commands.registerCommand("gatomia.actions.delete", async (item: any) => {
			if (!item?.resourceUri) {
				return;
			}
			const uri = item.resourceUri as Uri;
			const confirm = await window.showWarningMessage(
				`Are you sure you want to delete '${basename(uri.fsPath)}' ? `,
				{ modal: true },
				"Delete"
			);
			if (confirm !== "Delete") {
				return;
			}
			try {
				await workspace.fs.delete(uri);
				actionsExplorer.refresh();
			} catch (e) {
				window.showErrorMessage(`Failed to delete action: ${e} `);
			}
		}),
		commands.registerCommand("gatomia.actions.createAgentFile", async () => {
			await commands.executeCommand("workbench.command.new.agent");
		}),

		// SpecKit commands
		commands.registerCommand("gatomia.speckit.constitution", async () => {
			await specManager.executeSpecKitCommand("constitution");
		}),
		commands.registerCommand("gatomia.speckit.specify", async () => {
			await specManager.executeSpecKitCommand("specify");
		}),
		commands.registerCommand("gatomia.speckit.plan", async () => {
			await specManager.executeSpecKitCommand("plan");
		}),
		commands.registerCommand("gatomia.speckit.unit-test", async () => {
			await specManager.executeSpecKitCommand("unit-test");
		}),
		commands.registerCommand("gatomia.speckit.integration-test", async () => {
			await specManager.executeSpecKitCommand("integration-test");
		}),
		commands.registerCommand("gatomia.speckit.implementation", async () => {
			await specManager.executeSpecKitCommand("implementation");
		}),
		commands.registerCommand("gatomia.speckit.clarify", async () => {
			await specManager.executeSpecKitCommand("clarify");
		}),
		commands.registerCommand("gatomia.speckit.analyze", async () => {
			await specManager.executeSpecKitCommand("analyze");
		}),
		commands.registerCommand("gatomia.speckit.checklist", async () => {
			await specManager.executeSpecKitCommand("checklist");
		}),
		commands.registerCommand("gatomia.speckit.tasks", async () => {
			await specManager.executeSpecKitCommand("tasks");
		}),
		commands.registerCommand("gatomia.speckit.taskstoissues", async () => {
			await specManager.executeSpecKitCommand("taskstoissues");
		}),
		commands.registerCommand("gatomia.speckit.research", async () => {
			await specManager.executeSpecKitCommand("research");
		}),
		commands.registerCommand("gatomia.speckit.datamodel", async () => {
			await specManager.executeSpecKitCommand("datamodel");
		}),
		commands.registerCommand("gatomia.speckit.design", async () => {
			await specManager.executeSpecKitCommand("design");
		})
	);

	// Update checker command

	// Group the following commands in a single subscriptions push
	context.subscriptions.push(
		// Overview and settings commands
		commands.registerCommand("gatomia.settings.open", async () => {
			outputChannel.appendLine("Opening GatomIA settings...");
			await commands.executeCommand(
				"workbench.action.openSettings",
				VSC_CONFIG_NAMESPACE
			);
		}),
		commands.registerCommand("gatomia.settings.selectSpecSystem", async () => {
			const adapter = getSpecSystemAdapter();
			await adapter.selectSpecSystem();
		}),
		commands.registerCommand("gatomia.settings.openGlobalConfig", async () => {
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
				window.showErrorMessage(`Failed to open MCP config: ${message} `);
			}
		}),

		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("gatomia.help.open", async () => {
			outputChannel.appendLine("Opening GatomIA help...");
			const helpUrl = "https://github.com/eitatech/gatomia-vscode#readme";
			env.openExternal(Uri.parse(helpUrl));
		}),

		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("gatomia.help.install", async () => {
			outputChannel.appendLine("Opening SpecKit installation guide...");
			const installUrl = "https://github.com/github/spec-kit#readme";
			env.openExternal(Uri.parse(installUrl));
		}),

		commands.registerCommand("gatomia.dependencies.check", async () => {
			outputChannel.appendLine("Opening dependencies checker...");
			await dependenciesViewProvider.show();
		}),

		commands.registerCommand("gatomia.showWelcome", () => {
			outputChannel.appendLine("Showing welcome screen (on-demand)...");
			try {
				const welcomeProvider = new WelcomeScreenProvider(
					context,
					outputChannel
				);
				const callbacks = welcomeProvider.getCallbacks();
				const panel = WelcomeScreenPanel.show(
					context,
					outputChannel,
					callbacks
				);

				// Set panel reference in callbacks (T028-T032)
				if (callbacks.setPanel) {
					callbacks.setPanel(panel);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(`[Welcome] Failed to show: ${message} `);
				window.showErrorMessage(`Failed to show welcome screen: ${message} `);
			}
		}),

		commands.registerCommand("gatomia.menu.open", async () => {
			outputChannel.appendLine("Opening GatomIA menu...");
			await toggleViews();
		}),

		commands.registerCommand("gatomia.migration.start", async () => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const migration = new SpecKitMigration(ws.uri.fsPath);
			await migration.migrateAllSpecs();
		}),

		commands.registerCommand(
			"gatomia.migration.generateConstitution",
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

		commands.registerCommand("gatomia.migration.createBackup", () => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const migration = new SpecKitMigration(ws.uri.fsPath);
			const backupPath = migration.createBackup();
			if (backupPath) {
				window.showInformationMessage(`Backup created at: ${backupPath} `);
			} else {
				window.showWarningMessage(
					"No OpenSpec directory found to backup, or backup failed."
				);
			}
		})
	);
}

async function toggleViews() {
	const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
	const currentVisibility = {
		specs: config.get("views.specs.visible", true),
		hooks: config.get("views.hooks.visible", false),
		steering: config.get("views.steering.visible", true),
		actions: config.get("views.actions.visible", true),
		mcp: config.get("views.mcp.visible", false),
	};

	const items: Array<{ label: string; picked: boolean; id: string }> = [
		{
			label: `$(${currentVisibility.specs ? "check" : "blank"}) Specs`,
			picked: currentVisibility.specs,
			id: "specs",
		},
		{
			label: `$(${currentVisibility.actions ? "check" : "blank"}) Actions`,
			picked: currentVisibility.actions,
			id: "actions",
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
			actions: selected.some((item) => item.id === "actions"),
			mcp: selected.some((item) => item.id === "mcp"),
		};

		await config.update(
			"views.specs.visible",
			newVisibility.specs,
			ConfigurationTarget.Workspace
		);
		await config.update(
			"views.actions.visible",
			newVisibility.actions,
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

function setupFileWatchers(
	context: ExtensionContext,
	specExplorer: SpecExplorerProvider,
	steeringExplorer: SteeringExplorerProvider,
	actionsExplorer: ActionsExplorerProvider
) {
	// Watch for changes in .copilot directories with debouncing
	const copilotWatcher = workspace.createFileSystemWatcher("**/.copilot/**/*");

	let refreshTimeout: NodeJS.Timeout | undefined;
	const pendingReviewFlowSpecIds = new Set<string>();
	const debouncedRefresh = (event: string, uri: Uri) => {
		outputChannel.appendLine(`[FileWatcher] ${event}: ${uri.fsPath} `);
		const specId = extractSpecIdFromPath(uri.fsPath);
		if (specId) {
			const isTasksFile = uri.fsPath.endsWith("/tasks.md");
			const isChecklistFile =
				uri.fsPath.includes("/checklists/") && uri.fsPath.endsWith(".md");
			if (isTasksFile || isChecklistFile) {
				pendingReviewFlowSpecIds.add(specId);
			}
		}

		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}
		refreshTimeout = setTimeout(() => {
			specExplorer.refresh();
			steeringExplorer.refresh();
			actionsExplorer.refresh();

			const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
			if (workspaceRoot && pendingReviewFlowSpecIds.size > 0) {
				const specIds = Array.from(pendingReviewFlowSpecIds);
				pendingReviewFlowSpecIds.clear();
				processReviewFlowSync(workspaceRoot, specIds).catch((error) => {
					outputChannel.appendLine(
						`[ReviewFlow] Failed to process pending summary sync: ${error} `
					);
				});
			}
		}, 1000); // Increase debounce time to 1 second
	};

	const processReviewFlowSync = async (
		workspaceRoot: string,
		specIds: string[]
	): Promise<void> => {
		for (const id of specIds) {
			try {
				await syncSpecReviewFlowSummary({
					workspaceRoot,
					specId: id,
					specTitle: id,
				});
			} catch (error) {
				outputChannel.appendLine(
					`[ReviewFlow] Failed to sync pending summary for ${id}: ${error} `
				);
			}
		}
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
			extraPatterns.add(`${normalized}/**/* `);
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
	const projectCopilotMdWatcher = workspace.createFileSystemWatcher(
		"**/copilot-instructions.md"
	);

	setupGlobalCopilotWatcher(context, steeringExplorer);

	projectCopilotMdWatcher.onDidCreate(() => steeringExplorer.refresh());
	projectCopilotMdWatcher.onDidDelete(() => steeringExplorer.refresh());

	context.subscriptions.push(projectCopilotMdWatcher);
}

function setupGlobalCopilotWatcher(
	context: ExtensionContext,
	steeringExplorer: SteeringExplorerProvider
): void {
	if (!isGlobalResourceAccessAllowed()) {
		outputChannel.appendLine(
			"[Steering Consent] Global watcher disabled (access not allowed)"
		);
		return;
	}

	const globalHome = homedir() || process.env.USERPROFILE || "";
	const globalCopilotMdWatcher = workspace.createFileSystemWatcher(
		new RelativePattern(globalHome, ".github/copilot-instructions.md")
	);
	globalCopilotMdWatcher.onDidCreate(() => steeringExplorer.refresh());
	globalCopilotMdWatcher.onDidDelete(() => steeringExplorer.refresh());
	context.subscriptions.push(globalCopilotMdWatcher);
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
	return `gatomia - hooks - ${timestamp}.json`;
}

async function handleHooksImport(): Promise<void> {
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
				: `Imported ${importedCount} hook${importedCount === 1 ? "" : "s"} `;

		window.showInformationMessage(`${summary} from ${hooksFile.fsPath} `);
		outputChannel.appendLine(`[Hooks] ${summary} from ${hooksFile.fsPath} `);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		window.showErrorMessage(`Failed to import hooks: ${message} `);
		outputChannel.appendLine(`[Hooks] Failed to import hooks: ${message} `);
	}
}

// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
export function deactivate() {}

function setupDocumentPreviewWatchers(context: ExtensionContext) {
	const watcher = workspace.createFileSystemWatcher("**/*.md");

	const SPEC_FILES = new Set([
		"spec.md",
		"plan.md",
		"research.md",
		"data-model.md",
		"datamodel.md",
		"quickstart.md",
		"tasks.md",
	]);

	const isSpecOrChecklistFile = (uri: Uri): boolean => {
		const fileName = basename(uri.fsPath).toLowerCase();
		const isSpecFile = SPEC_FILES.has(fileName);
		const isChecklistFile =
			uri.fsPath.includes("/checklists/") && fileName.endsWith(".md");

		// Ensure it's within a spec folder (matching 001-...)
		const hasSpecId = extractSpecIdFromPath(uri.fsPath) !== null;

		return hasSpecId && (isSpecFile || isChecklistFile);
	};

	const handleChangeOrDelete = async (uri: Uri) => {
		if (activePreviewUri && uri.fsPath === activePreviewUri.fsPath) {
			outputChannel.appendLine(
				`[Preview] Auto - reloading active document: ${uri.fsPath} `
			);
			await renderPreviewForUri(uri);
		}
	};

	const handleCreate = (uri: Uri) => {
		if (isSpecOrChecklistFile(uri)) {
			const fileName = basename(uri.fsPath);
			window
				.showInformationMessage(
					`New document created: ${fileName}. Do you want to open it ? `,
					"Open"
				)
				.then((selection) => {
					if (selection === "Open") {
						renderPreviewForUri(uri);
					}
				});
		}
	};

	watcher.onDidChange(handleChangeOrDelete);
	watcher.onDidDelete(handleChangeOrDelete);
	watcher.onDidCreate(handleCreate);

	context.subscriptions.push(watcher);
}

async function renderPreviewForUri(
	uri: Uri
): Promise<DocumentArtifact | undefined> {
	if (!(documentPreviewService && documentPreviewPanel)) {
		window.showErrorMessage(
			"Document preview infrastructure is not ready yet."
		);
		return;
	}

	try {
		const artifact = await documentPreviewService.loadDocument(uri);
		activePreviewUri = uri;
		await documentPreviewPanel.renderDocument(artifact);
		return artifact;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		window.showErrorMessage(`Failed to open document preview: ${message} `);
		outputChannel.appendLine(`[Preview] Failed to open document: ${message} `);
	}
}

async function createNewFile(uri: Uri, suffix: string): Promise<void> {
	const folder = uri || workspace.workspaceFolders?.[0]?.uri;
	if (!folder) {
		return;
	}

	const name = await window.showInputBox({
		prompt: `Enter name for new file (without ${suffix})`,
		placeHolder: "example",
	});

	if (!name) {
		return;
	}

	const fileName = name.endsWith(suffix) ? name : `${name}${suffix}`;
	const targetUri = Uri.joinPath(folder, fileName);

	try {
		await workspace.fs.writeFile(targetUri, new Uint8Array());
		await window.showTextDocument(targetUri);
	} catch (error) {
		window.showErrorMessage(`Failed to create file: ${error}`);
	}
}

function resolveWorkspaceRelativeUri(relativePath: string): Uri | undefined {
	const workspaceFolder = workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		return;
	}

	return Uri.joinPath(workspaceFolder.uri, relativePath);
}

async function openDocumentInEditor(uri: Uri, line?: number): Promise<void> {
	const doc = await workspace.openTextDocument(uri);
	const editor = await window.showTextDocument(doc, { preview: false });
	if (typeof line === "number" && line >= 0) {
		const position = new Position(line, 0);
		editor.selection = new Selection(position, position);
		editor.revealRange(new Range(position, position));
	}
}

async function openActivePreviewInEditor(): Promise<void> {
	if (!activePreviewUri) {
		window.showInformationMessage("No preview is currently active.");
		return;
	}

	await openDocumentInEditor(activePreviewUri);
}
