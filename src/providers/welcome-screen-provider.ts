/**
 * WelcomeScreenProvider
 *
 * Aggregates state and handles business logic for the GatomIA welcome screen.
 * This provider acts as the central orchestration point between the VS Code extension
 * host and the webview UI, managing:
 *
 * - Dependency detection (GitHub Copilot Chat, SpecKit CLI, OpenSpec CLI)
 * - Configuration management (editable settings)
 * - System diagnostics (24-hour rolling window, 5-entry limit)
 * - Learning resources (documentation, examples, tutorials)
 * - Feature actions (quick access commands)
 *
 * @architecture Based on specs/006-welcome-screen/plan.md
 * @see {@link WelcomeScreenPanel} for webview panel management
 * @see {@link WelcomeScreenState} for state interface
 *
 * @example
 * ```typescript
 * const provider = new WelcomeScreenProvider(context, outputChannel);
 * const callbacks = provider.getCallbacks();
 * const panel = WelcomeScreenPanel.render(context, outputChannel, callbacks);
 * ```
 *
 * @public
 */

import {
	type ExtensionContext,
	type OutputChannel,
	version,
	workspace,
	ConfigurationTarget,
	commands,
	env,
	Uri,
	window,
} from "vscode";
import type {
	WelcomeScreenState,
	ConfigurationState,
	FeatureAction,
	LearningResource,
	WelcomeErrorCodeType,
	InstallableDependency,
} from "../types/welcome";
import { WelcomeErrorCode } from "../types/welcome";
import { DependencyChecker } from "../services/dependency-checker";
import { SystemDiagnostics } from "../services/system-diagnostics";
import { LearningResources } from "../services/learning-resources";
import {
	hasShownWelcomeBefore,
	getDontShowOnStartup,
} from "../utils/workspace-state";
import type { WelcomeScreenPanel } from "../panels/welcome-screen-panel";

/**
 * Editable configuration keys per FR-007 spec
 */
const EDITABLE_CONFIG_KEYS = [
	"gatomia.specSystem",
	"gatomia.speckit.specsPath",
	"gatomia.speckit.memoryPath",
	"gatomia.speckit.templatesPath",
	"gatomia.openspec.path",
	"gatomia.prompts.path",
] as const;

export class WelcomeScreenProvider {
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private readonly dependencyChecker: DependencyChecker;
	private readonly systemDiagnostics: SystemDiagnostics;
	private readonly learningResources: LearningResources;

	constructor(context: ExtensionContext, outputChannel: OutputChannel) {
		this.context = context;
		this.outputChannel = outputChannel;
		this.dependencyChecker = new DependencyChecker(outputChannel);
		this.systemDiagnostics = new SystemDiagnostics();
		this.learningResources = new LearningResources();
	}

	/**
	 * Get complete welcome screen state
	 *
	 * Aggregates all necessary data for rendering the welcome screen, including:
	 * - First-time activation status
	 * - User preference for showing on startup
	 * - Current view selection
	 * - Dependency status with version information
	 * - Editable configuration settings
	 * - Recent system diagnostics (last 5 from 24 hours)
	 * - Learning resources catalog
	 * - Available feature actions
	 * - Extension and VS Code version information
	 *
	 * @returns Complete state object for welcome screen rendering
	 * @throws Never throws - handles all errors internally with OutputChannel logging
	 *
	 * @performance Typically completes in <100ms. Uses parallel Promise.all for efficiency.
	 * @caching DependencyChecker caches results for 60 seconds
	 *
	 * @example
	 * ```typescript
	 * const state = await provider.getWelcomeState();
	 * panel.postMessage({ type: 'welcome/state', ...state });
	 * ```
	 */
	async getWelcomeState(): Promise<WelcomeScreenState> {
		const dependencies = await this.dependencyChecker.checkAll();
		const configuration = this.getConfiguration();

		// Lazily load learning resources
		this.learningResources.loadResources(this.context.extensionPath);

		// Get extension version from package.json
		const extensionVersion =
			this.context.extension?.packageJSON?.version || "0.25.6";

		return {
			hasShownBefore: hasShownWelcomeBefore(this.context),
			dontShowOnStartup: getDontShowOnStartup(this.context),
			currentView: "setup",
			extensionVersion,
			vscodeVersion: version,
			dependencies,
			configuration,
			diagnostics: this.systemDiagnostics.getRecentDiagnostics(),
			learningResources: this.learningResources.getAll(),
			featureActions: this.getFeatureActions(),
		};
	}

	/**
	 * Update configuration value
	 * Validates key is editable and persists to VS Code settings
	 */
	async updateConfiguration(
		key: string,
		value: string | boolean,
		panel: WelcomeScreenPanel
	): Promise<void> {
		try {
			// Validate key is editable
			if (!this.isEditableConfigKey(key)) {
				this.systemDiagnostics.recordError(
					"error",
					`Invalid configuration key: ${key}`,
					"config-updates",
					`Only spec system-related settings can be modified: ${EDITABLE_CONFIG_KEYS.join(", ")}`
				);
				await this.sendError(
					panel,
					WelcomeErrorCode.INVALID_CONFIG_KEY,
					`Configuration key '${key}' is not editable from welcome screen`,
					`Only spec system-related settings can be modified: ${EDITABLE_CONFIG_KEYS.join(", ")}`
				);
				return;
			}

			// Validate value type (path configurations must be strings)
			if (key.toLowerCase().includes("path") && typeof value !== "string") {
				this.systemDiagnostics.recordError(
					"error",
					`Invalid configuration value type for ${key}`,
					"config-updates",
					"Path configuration must be a string"
				);
				await this.sendError(
					panel,
					WelcomeErrorCode.INVALID_CONFIG_VALUE,
					`Path configuration '${key}' must be a string`
				);
				return;
			}

			// Get configuration and update
			const config = workspace.getConfiguration();
			await config.update(key, value, ConfigurationTarget.Workspace);

			this.outputChannel.appendLine(
				`[WelcomeScreenProvider] Updated configuration: ${key} = ${value}`
			);

			// Send confirmation to webview
			await panel.postMessage({
				type: "welcome/config-updated",
				key,
				newValue: value,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[WelcomeScreenProvider] Configuration update failed: ${errorMessage}`
			);
			this.systemDiagnostics.recordError(
				"error",
				`Failed to update configuration ${key}`,
				"config-updates",
				errorMessage
			);
			await this.sendError(
				panel,
				WelcomeErrorCode.CONFIG_UPDATE_FAILED,
				"Failed to update configuration",
				errorMessage
			);
		}
	}

	/**
	 * Execute VS Code command
	 */
	async executeCommand(
		commandId: string,
		args: unknown[],
		panel: WelcomeScreenPanel
	): Promise<void> {
		try {
			this.outputChannel.appendLine(
				`[WelcomeScreenProvider] Executing command: ${commandId}`
			);
			await commands.executeCommand(commandId, ...args);
		} catch (error) {
			this.outputChannel.appendLine(
				`[WelcomeScreenProvider] Command execution failed: ${error}`
			);
			await this.sendError(
				panel,
				WelcomeErrorCode.COMMAND_EXECUTION_FAILED,
				`Failed to execute command: ${commandId}`,
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	/**
	 * Handle dependency install action
	 */
	async installDependency(
		dependency: InstallableDependency,
		panel: WelcomeScreenPanel
	): Promise<void> {
		switch (dependency) {
			case "copilot-chat":
				// Open Extensions marketplace
				await commands.executeCommand(
					"workbench.extensions.search",
					"@id:github.copilot-chat"
				);
				break;

			case "speckit":
				// Copy install command to clipboard
				await env.clipboard.writeText(
					"uv tool install specify-cli --from git+https://github.com/github/spec-kit.git"
				);
				window
					.showInformationMessage(
						"SpecKit CLI install command copied to clipboard. Paste and run in your terminal.",
						"Open Terminal"
					)
					.then((selection) => {
						if (selection === "Open Terminal") {
							commands.executeCommand("workbench.action.terminal.new");
						}
					});
				break;

			case "openspec":
				// Copy install command to clipboard
				await env.clipboard.writeText(
					"npm install -g @fission-ai/openspec@latest"
				);
				window
					.showInformationMessage(
						"OpenSpec CLI install command copied to clipboard. Paste and run in your terminal.",
						"Open Terminal"
					)
					.then((selection) => {
						if (selection === "Open Terminal") {
							commands.executeCommand("workbench.action.terminal.new");
						}
					});
				break;

			case "copilot-cli":
				await env.clipboard.writeText("npm install -g @github/copilot");
				window
					.showInformationMessage(
						"GitHub Copilot CLI install command copied to clipboard. Paste and run in your terminal.",
						"Open Terminal"
					)
					.then((selection) => {
						if (selection === "Open Terminal") {
							commands.executeCommand("workbench.action.terminal.new");
						}
					});
				break;

			case "gatomia-cli": {
				const dependencies = await this.dependencyChecker.checkAll();
				const prerequisitesMet =
					dependencies.copilotChat.installed &&
					dependencies.copilotCli.installed &&
					(dependencies.speckit.installed || dependencies.openspec.installed);

				if (!prerequisitesMet) {
					window.showWarningMessage(
						"Install GitHub Copilot Chat, Copilot CLI, and at least one spec system (SpecKit or OpenSpec) before installing GatomIA CLI."
					);
					return;
				}

				await env.clipboard.writeText(
					"uv tool install gatomia --from git+https://github.com/eitatech/gatomia-cli.git"
				);
				window
					.showInformationMessage(
						"GatomIA CLI install command copied to clipboard. Paste and run in your terminal.",
						"Open Terminal"
					)
					.then((selection) => {
						if (selection === "Open Terminal") {
							commands.executeCommand("workbench.action.terminal.new");
						}
					});
				break;
			}
			default:
				// Should never reach here due to TypeScript type checking
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Unknown dependency: ${dependency}`
				);
		}
	}

	/**
	 * Refresh dependency status (invalidate cache and re-check)
	 */
	async refreshDependencies(panel: WelcomeScreenPanel): Promise<void> {
		this.dependencyChecker.invalidateCache();
		const dependencies = await this.dependencyChecker.checkAll(true);

		await panel.postMessage({
			type: "welcome/dependency-status",
			...dependencies,
		});
	}

	/**
	 * Open external URL with validation
	 */
	async openExternal(url: string): Promise<void> {
		try {
			// Validate HTTPS only
			if (!url.startsWith("https://")) {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Blocked non-HTTPS URL: ${url}`
				);
				window.showWarningMessage("Only HTTPS URLs can be opened for security");
				return;
			}

			await env.openExternal(Uri.parse(url));
			this.outputChannel.appendLine(
				`[WelcomeScreenProvider] Opened external URL: ${url}`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[WelcomeScreenProvider] Failed to open URL: ${error}`
			);
		}
	}

	/**
	 * Search learning resources by keyword
	 */
	searchResources(query: string): LearningResource[] {
		// Ensure resources are loaded before searching
		if (!this.learningResources.isLoaded()) {
			this.learningResources.loadResources(this.context.extensionPath);
		}
		return this.learningResources.searchByKeyword(query);
	}

	/**
	 * Record error for diagnostics
	 */
	recordError(
		severity: "error" | "warning",
		message: string,
		source: string,
		suggestedAction?: string
	): void {
		this.systemDiagnostics.recordError(
			severity,
			message,
			source,
			suggestedAction
		);
	}

	/**
	 * Get system diagnostics service (for external use)
	 */
	getSystemDiagnostics(): SystemDiagnostics {
		return this.systemDiagnostics;
	}

	/**
	 * Get configuration state for welcome screen
	 */
	private getConfiguration(): ConfigurationState {
		const config = workspace.getConfiguration("gatomia");

		return {
			specSystem: {
				key: "gatomia.specSystem",
				label: "Spec System",
				currentValue: (config.get<string>("specSystem") || "auto") as
					| "auto"
					| "speckit"
					| "openspec",
				options: ["auto", "speckit", "openspec"],
				editable: true,
			},
			speckitSpecsPath: {
				key: "gatomia.speckit.specsPath",
				label: "SpecKit Specs Path",
				currentValue: config.get<string>("speckit.specsPath") || "specs",
				editable: true,
			},
			speckitMemoryPath: {
				key: "gatomia.speckit.memoryPath",
				label: "SpecKit Memory Path",
				currentValue:
					config.get<string>("speckit.memoryPath") || ".specify/memory",
				editable: true,
			},
			speckitTemplatesPath: {
				key: "gatomia.speckit.templatesPath",
				label: "SpecKit Templates Path",
				currentValue:
					config.get<string>("speckit.templatesPath") || ".specify/templates",
				editable: true,
			},
			openspecPath: {
				key: "gatomia.openspec.path",
				label: "OpenSpec Path",
				currentValue: config.get<string>("openspec.path") || ".openspec",
				editable: true,
			},
			promptsPath: {
				key: "gatomia.prompts.path",
				label: "Prompts Path",
				currentValue: config.get<string>("prompts.path") || ".prompts",
				editable: true,
			},
			otherSettings: [],
		};
	}

	/**
	 * Get feature actions for welcome screen
	 */
	private getFeatureActions(): FeatureAction[] {
		return [
			// Specs (T046)
			{
				id: "create-spec",
				featureArea: "Specs",
				label: "Create New Spec",
				description: "Start a new specification document",
				commandId: "gatomia.spec.create",
				enabled: true,
				icon: "codicon-file-add",
			},
			{
				id: "view-specs",
				featureArea: "Specs",
				label: "Refresh Specs",
				description: "Reload specification list",
				commandId: "gatomia.spec.refresh",
				enabled: true,
				icon: "codicon-refresh",
			},
			// Actions (T047)
			{
				id: "create-prompt",
				featureArea: "Actions",
				label: "Create Prompt",
				description: "Create a new custom prompt file",
				commandId: "gatomia.actions.create",
				enabled: true,
				icon: "codicon-add",
			},
			{
				id: "create-agent",
				featureArea: "Actions",
				label: "Create Agent",
				description: "Create a new agent definition file",
				commandId: "gatomia.actions.createAgentFile",
				enabled: true,
				icon: "codicon-robot",
			},
			{
				id: "create-skill",
				featureArea: "Actions",
				label: "Create Skill",
				description: "Create a new reusable skill directory",
				commandId: "gatomia.actions.createSkill",
				enabled: true,
				icon: "codicon-tools",
			},
			{
				id: "refresh-actions",
				featureArea: "Actions",
				label: "Refresh Actions",
				description: "Reload actions from workspace",
				commandId: "gatomia.actions.refresh",
				enabled: true,
				icon: "codicon-refresh",
			},
			// Hooks (T048)
			{
				id: "add-hook",
				featureArea: "Hooks",
				label: "Add Hook",
				description: "Create a new automation hook",
				commandId: "gatomia.hooks.addHook",
				enabled: true,
				icon: "codicon-add",
			},
			{
				id: "view-hook-logs",
				featureArea: "Hooks",
				label: "View Hook Logs",
				description: "Check hook execution history",
				commandId: "gatomia.hooks.viewLogs",
				enabled: true,
				icon: "codicon-output",
			},
			// Steering (T049)
			{
				id: "create-project-rule",
				featureArea: "Steering",
				label: "Create Project Rule",
				description: "Define project-level steering rules",
				commandId: "gatomia.steering.createProjectRule",
				enabled: true,
				icon: "codicon-folder",
			},
			{
				id: "create-user-rule",
				featureArea: "Steering",
				label: "Create User Rule",
				description: "Define user-level steering rules",
				commandId: "gatomia.steering.createUserRule",
				enabled: true,
				icon: "codicon-person",
			},
		];
	}

	/**
	 * Get panel callbacks for WelcomeScreenPanel
	 * T028-T032: Implement callbacks with panel interaction using lazy evaluation
	 */
	getCallbacks(): import("../panels/welcome-screen-panel").WelcomeScreenPanelCallbacks {
		// Panel will be set by the caller via a closure
		let panelRef: WelcomeScreenPanel | null = null;

		// Helper to get panel (will be set after panel creation)
		const getPanel = () => {
			if (!panelRef) {
				throw new Error(
					"[WelcomeScreenProvider] Panel reference not set in callbacks"
				);
			}
			return panelRef;
		};

		const callbacks = {
			onReady: async () => {
				this.outputChannel.appendLine(
					"[WelcomeScreenProvider] Webview ready, sending initial state"
				);

				// Wait for panel reference to be set (race condition guard)
				if (!panelRef) {
					this.outputChannel.appendLine(
						"[WelcomeScreenProvider] Panel not yet set, waiting..."
					);
					// Poll for panel with timeout
					const maxAttempts = 50; // 5 seconds total
					for (let i = 0; i < maxAttempts; i++) {
						await new Promise((resolve) => setTimeout(resolve, 100));
						if (panelRef) {
							break;
						}
					}
					if (!panelRef) {
						this.outputChannel.appendLine(
							"[WelcomeScreenProvider] ERROR: Panel reference never set!"
						);
						return;
					}
				}

				// T032: Send welcome/state message with initial data
				const state = await this.getWelcomeState();
				await getPanel().postMessage({
					type: "welcome/state",
					...state,
				});
			},
			onExecuteCommand: async (commandId: string, args?: unknown[]) => {
				// T052: OutputChannel logging for command execution
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Execute command: ${commandId}`
				);
				try {
					// T050: Execute command via commands.executeCommand
					await commands.executeCommand(commandId, ...(args || []));
					this.outputChannel.appendLine(
						`[WelcomeScreenProvider] Command executed successfully: ${commandId}`
					);
				} catch (error) {
					// T051: Error handling for failed command execution
					const message =
						error instanceof Error ? error.message : String(error);
					this.outputChannel.appendLine(
						`[WelcomeScreenProvider] Command execution failed: ${commandId} - ${message}`
					);

					// Send user-facing error message
					await getPanel().postMessage({
						type: "welcome/error",
						code: WelcomeErrorCode.COMMAND_EXECUTION_FAILED,
						message: `Failed to execute command: ${commandId}`,
						context: message,
					});

					// Show notification to user
					window.showErrorMessage(
						`Failed to execute command "${commandId}": ${message}`
					);
				}
			},
			onUpdateConfig: async (key: string, value: string | boolean) => {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Update config: ${key} = ${value}`
				);
				await this.updateConfiguration(key, value, getPanel());
			},
			// T030: Handle welcome/install-dependency message
			onInstallDependency: async (dependency: InstallableDependency) => {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Install dependency: ${dependency}`
				);
				await this.installDependency(dependency, getPanel());
			},
			// T031: Handle welcome/refresh-dependencies message
			onRefreshDependencies: async () => {
				this.outputChannel.appendLine(
					"[WelcomeScreenProvider] Refresh dependencies (T028)"
				);
				await this.refreshDependencies(getPanel());
			},
			onOpenExternal: async (url: string) => {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Open external: ${url}`
				);
				await this.openExternal(url);
			},
			// T121: Handle welcome/update-preference message
			onUpdatePreference: async (
				preference: "dontShowOnStartup",
				value: boolean
			) => {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Update preference: ${preference} = ${value}`
				);
				// Store preference in workspace state
				await this.context.workspaceState.update(
					"gatomia.welcomeScreen.dontShowOnStartup",
					value
				);
			},
			// T129: Handle welcome/navigate-section message for telemetry
			onNavigateSection: (section: string) => {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Navigate to section: ${section}`
				);
				// T128: Telemetry logging if enabled
				// Placeholder for future telemetry implementation
			},
			// Handle welcome/search-resources message
			onSearchResources: (query: string) => {
				this.outputChannel.appendLine(
					`[WelcomeScreenProvider] Search resources: ${query}`
				);
				// Placeholder for future search implementation
			},
			// Setter for panel reference (called by extension.ts after panel creation)
			setPanel: (panel: WelcomeScreenPanel) => {
				panelRef = panel;
			},
		};

		return callbacks;
	}

	/**
	 * Check if configuration key is editable
	 */
	private isEditableConfigKey(key: string): boolean {
		return EDITABLE_CONFIG_KEYS.includes(key as any);
	}

	/**
	 * Send error message to webview
	 */
	private async sendError(
		panel: WelcomeScreenPanel,
		code: WelcomeErrorCodeType,
		message: string,
		context?: string
	): Promise<void> {
		await panel.postMessage({
			type: "welcome/error",
			code,
			message,
			context,
		});
	}
}
