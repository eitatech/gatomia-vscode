import {
	type Disposable,
	type ExtensionContext,
	type OutputChannel,
	type Terminal,
	type Webview,
	type WebviewPanel,
	ViewColumn,
	env,
	window,
} from "vscode";
import { getWebviewContent } from "../utils/get-webview-content";
import { checkCLI } from "../utils/cli-detector";

/**
 * Dependency check result
 */
export interface DependencyStatus {
	name: string;
	installed: boolean;
	version?: string;
	error?: string;
	command: string;
}

/**
 * Installation step
 */
export interface InstallationStep {
	id: string;
	title: string;
	description: string;
	command: string;
	platform?: "darwin" | "linux" | "win32" | "all";
}

const GATOMIA_CLI_STEP_ID = "gatomia-cli";
const GATOMIA_CLI_PREREQUISITE_NAMES = [
	"Node.js",
	"Python",
	"UV",
	"SpecKit",
	"OpenSpec",
	"Copilot CLI",
] as const;

/**
 * Message types from webview to extension
 */
type WebviewMessage =
	| DependenciesReadyMessage
	| DependenciesCheckMessage
	| DependenciesCheckOneMessage
	| DependenciesCopyMessage
	| DependenciesPasteMessage
	| DependenciesExecuteMessage;

interface DependenciesReadyMessage {
	type: "dependencies/ready";
}

interface DependenciesCheckMessage {
	type: "dependencies/check";
}

interface DependenciesCheckOneMessage {
	type: "dependencies/check-one";
	payload: { name: string };
}

interface DependenciesCopyMessage {
	type: "dependencies/copy";
	payload: { command: string };
}

interface DependenciesPasteMessage {
	type: "dependencies/paste";
	payload: { command: string };
}

interface DependenciesExecuteMessage {
	type: "dependencies/execute";
	payload: { command: string };
}

/**
 * Message types from extension to webview
 */
interface DependenciesStatusMessage {
	type: "dependencies/status";
	payload: {
		dependencies: DependencyStatus[];
		steps: InstallationStep[];
	};
}

interface DependencyUpdatedMessage {
	type: "dependencies/updated";
	payload: DependencyStatus;
}

interface DependenciesCheckingMessage {
	type: "dependencies/checking";
	payload: { name?: string };
}

interface DependenciesErrorMessage {
	type: "dependencies/error";
	payload: { message: string };
}

interface DependenciesActionResultMessage {
	type: "dependencies/action-result";
	payload: { action: string; success: boolean; message?: string };
}

type ExtensionMessage =
	| DependenciesStatusMessage
	| DependencyUpdatedMessage
	| DependenciesCheckingMessage
	| DependenciesErrorMessage
	| DependenciesActionResultMessage;

/**
 * Dependencies to check
 */
const DEPENDENCIES_TO_CHECK = [
	{ name: "Node.js", command: "node --version", minVersion: "20.19.0" },
	{ name: "Python", command: "python3 --version", minVersion: "3.11.0" },
	{ name: "UV", command: "uv --version", minVersion: undefined },
	{ name: "SpecKit", command: "specify version", minVersion: undefined },
	{ name: "OpenSpec", command: "openspec --version", minVersion: undefined },
	{
		name: "Copilot CLI",
		command: "copilot --version",
		fallbackCommand: "github-copilot --version",
		minVersion: undefined,
	},
	{
		name: "GatomIA CLI",
		command: "gatomia --version",
		fallbackCommand: "mia --version",
		minVersion: undefined,
	},
] as const;

/**
 * Installation steps
 */
const INSTALLATION_STEPS: InstallationStep[] = [
	{
		id: "node",
		title: "Install Node.js 20.19+",
		description:
			"Required runtime for OpenSpec CLI. SpecKit requires Node.js indirectly via UV.",
		command: "brew install node@22",
		platform: "darwin",
	},
	{
		id: "node-linux",
		title: "Install Node.js 20.19+",
		description:
			"Required runtime for OpenSpec CLI. SpecKit requires Node.js indirectly via UV.",
		command:
			"curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs",
		platform: "linux",
	},
	{
		id: "python",
		title: "Install Python 3.11+",
		description: "Required for SpecKit (via UV package manager).",
		command: "brew install python@3.11",
		platform: "darwin",
	},
	{
		id: "python-linux",
		title: "Install Python 3.11+",
		description: "Required for SpecKit (via UV package manager).",
		command: "sudo apt-get install -y python3.11 python3.11-venv",
		platform: "linux",
	},
	{
		id: "uv",
		title: "Install UV",
		description:
			"Fast Python package installer and resolver. Required for installing SpecKit.",
		command: "curl -LsSf https://astral.sh/uv/install.sh | sh",
		platform: "all",
	},
	{
		id: "copilot-cli",
		title: "Install GitHub Copilot CLI",
		description:
			"Required to use GitHub Copilot as the default provider for GatomIA CLI.",
		command: "npm install -g @github/copilot",
		platform: "all",
	},
	{
		id: "speckit",
		title: "Install SpecKit (Specify CLI)",
		description:
			"Specification-driven development toolkit from GitHub. Installs the 'specify' command.",
		command:
			"uv tool install specify-cli --from git+https://github.com/github/spec-kit.git",
		platform: "all",
	},
	{
		id: "openspec",
		title: "Install OpenSpec",
		description:
			"Spec-driven development for AI coding assistants. Installs the 'openspec' command.",
		command: "npm install -g @fission-ai/openspec@latest",
		platform: "all",
	},
	{
		id: GATOMIA_CLI_STEP_ID,
		title: "Install GatomIA CLI",
		description:
			"Installs the GatomIA CLI plugin. Available after all other prerequisites are installed.",
		command:
			"uv tool install gatomia --from git+https://github.com/eitatech/gatomia-cli.git",
		platform: "all",
	},
];

export const areGatomiaCliPrerequisitesMet = (
	dependencies: DependencyStatus[]
): boolean =>
	GATOMIA_CLI_PREREQUISITE_NAMES.every((name) =>
		dependencies.some(
			(dependency) => dependency.name === name && dependency.installed
		)
	);

export const getInstallationStepsForPlatform = (
	platform: "darwin" | "linux" | "win32",
	dependencies: DependencyStatus[]
): InstallationStep[] => {
	const platformSteps = INSTALLATION_STEPS.filter(
		(step) => step.platform === "all" || step.platform === platform
	);

	if (areGatomiaCliPrerequisitesMet(dependencies)) {
		return platformSteps;
	}

	return platformSteps.filter((step) => step.id !== GATOMIA_CLI_STEP_ID);
};

/**
 * DependenciesViewProvider - Manages the Dependencies checker webview panel
 */
export class DependenciesViewProvider {
	static readonly panelType = "gatomia.dependenciesPanel";

	private panel?: WebviewPanel;
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private readonly disposables: Disposable[] = [];
	private isWebviewReady = false;
	private readonly pendingMessages: ExtensionMessage[] = [];
	private terminal?: Terminal;

	constructor(context: ExtensionContext, outputChannel: OutputChannel) {
		this.context = context;
		this.outputChannel = outputChannel;
	}

	dispose(): void {
		this.panel?.dispose();
		this.panel = undefined;
		this.isWebviewReady = false;
		while (this.disposables.length > 0) {
			this.disposables.pop()?.dispose();
		}
		this.outputChannel.appendLine("[DependenciesViewProvider] Disposed");
	}

	private get webview(): Webview | undefined {
		return this.panel?.webview;
	}

	async show(): Promise<void> {
		await this.ensurePanel();
	}

	private ensurePanel(): void {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Active, false);
			return;
		}

		const panel = window.createWebviewPanel(
			DependenciesViewProvider.panelType,
			"Install Dependencies",
			{
				viewColumn: ViewColumn.Active,
				preserveFocus: false,
			},
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.context.extensionUri],
			}
		);

		this.isWebviewReady = false;
		panel.webview.html = this.getHtmlForWebview(panel.webview);
		panel.webview.onDidReceiveMessage(
			(message) => this.handleWebviewMessage(message),
			undefined,
			this.disposables
		);
		panel.onDidDispose(
			() => {
				this.panel = undefined;
				this.isWebviewReady = false;
				this.outputChannel.appendLine(
					"[DependenciesViewProvider] Panel disposed"
				);
			},
			undefined,
			this.disposables
		);

		this.panel = panel;
		this.outputChannel.appendLine("[DependenciesViewProvider] Panel created");
	}

	private getHtmlForWebview(webview: Webview): string {
		return getWebviewContent(
			webview,
			this.context.extensionUri,
			"dependencies"
		);
	}

	private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
		try {
			switch (message.type) {
				case "dependencies/ready":
					this.isWebviewReady = true;
					this.flushPendingMessages();
					await this.checkAllDependencies();
					break;
				case "dependencies/check":
					await this.checkAllDependencies();
					break;
				case "dependencies/check-one":
					await this.checkSingleDependency(message.payload.name);
					break;
				case "dependencies/copy":
					await this.copyCommand(message.payload.command);
					break;
				case "dependencies/paste":
					await this.pasteToTerminal(message.payload.command);
					break;
				case "dependencies/execute":
					await this.executeInTerminal(message.payload.command);
					break;
				default:
					this.outputChannel.appendLine(
						`[DependenciesViewProvider] Unknown message type: ${(message as any).type}`
					);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			await this.sendMessageToWebview({
				type: "dependencies/error",
				payload: { message: errorMessage },
			});
		}
	}

	private async checkAllDependencies(): Promise<void> {
		await this.sendMessageToWebview({
			type: "dependencies/checking",
			payload: {},
		});

		const dependencies: DependencyStatus[] = [];

		for (const dep of DEPENDENCIES_TO_CHECK) {
			const status = await this.checkDependency(
				dep.name,
				dep.command,
				dep.fallbackCommand
			);
			dependencies.push(status);
		}

		const platform = process.platform as "darwin" | "linux" | "win32";
		const steps = getInstallationStepsForPlatform(platform, dependencies);

		await this.sendMessageToWebview({
			type: "dependencies/status",
			payload: { dependencies, steps },
		});
	}

	private async checkSingleDependency(name: string): Promise<void> {
		const dep = DEPENDENCIES_TO_CHECK.find((d) => d.name === name);
		if (!dep) {
			return;
		}

		await this.sendMessageToWebview({
			type: "dependencies/checking",
			payload: { name },
		});

		const status = await this.checkDependency(
			dep.name,
			dep.command,
			dep.fallbackCommand
		);

		await this.sendMessageToWebview({
			type: "dependencies/updated",
			payload: status,
		});
	}

	private async checkDependency(
		name: string,
		command: string,
		fallbackCommand?: string
	): Promise<DependencyStatus> {
		const primaryAttempt = await this.checkDependencyCommand(command);

		if (primaryAttempt.installed) {
			this.outputChannel.appendLine(
				`[DependenciesViewProvider] ${name}: ${primaryAttempt.version || "unknown"}`
			);
			return {
				name,
				installed: true,
				version: primaryAttempt.version,
				command,
			};
		}

		if (fallbackCommand) {
			const fallbackAttempt =
				await this.checkDependencyCommand(fallbackCommand);
			if (fallbackAttempt.installed) {
				this.outputChannel.appendLine(
					`[DependenciesViewProvider] ${name}: ${fallbackAttempt.version || "unknown"} (fallback command)`
				);
				return {
					name,
					installed: true,
					version: fallbackAttempt.version,
					command,
				};
			}
		}

		const errorMessage = primaryAttempt.error || "Not installed";
		this.outputChannel.appendLine(
			`[DependenciesViewProvider] ${name}: not found - ${errorMessage}`
		);

		return {
			name,
			installed: false,
			error: "Not installed",
			command,
		};
	}

	private async checkDependencyCommand(command: string): Promise<{
		installed: boolean;
		version?: string;
		error?: string;
	}> {
		const result = await checkCLI(command, 10_000);
		return {
			installed: result.installed,
			version: result.version || undefined,
			error: result.error,
		};
	}

	private async copyCommand(command: string): Promise<void> {
		await env.clipboard.writeText(command);
		await this.sendMessageToWebview({
			type: "dependencies/action-result",
			payload: {
				action: "copy",
				success: true,
				message: "Command copied to clipboard",
			},
		});
		this.outputChannel.appendLine(
			`[DependenciesViewProvider] Copied command: ${command}`
		);
	}

	private async pasteToTerminal(command: string): Promise<void> {
		const terminal = this.getOrCreateTerminal();
		terminal.show(true);
		terminal.sendText(command, false);

		await this.sendMessageToWebview({
			type: "dependencies/action-result",
			payload: {
				action: "paste",
				success: true,
				message: "Command pasted to terminal",
			},
		});
		this.outputChannel.appendLine(
			`[DependenciesViewProvider] Pasted to terminal: ${command}`
		);
	}

	private async executeInTerminal(command: string): Promise<void> {
		const terminal = this.getOrCreateTerminal();
		terminal.show(true);
		terminal.sendText(command, true);

		await this.sendMessageToWebview({
			type: "dependencies/action-result",
			payload: {
				action: "execute",
				success: true,
				message: "Command executed in terminal",
			},
		});
		this.outputChannel.appendLine(
			`[DependenciesViewProvider] Executed in terminal: ${command}`
		);
	}

	private getOrCreateTerminal(): Terminal {
		if (this.terminal && !this.terminal.exitStatus) {
			return this.terminal;
		}

		this.terminal = window.createTerminal({
			name: "GatomIA - Dependencies",
		});

		return this.terminal;
	}

	private flushPendingMessages(): void {
		if (!(this.webview && this.isWebviewReady)) {
			return;
		}

		while (this.pendingMessages.length > 0) {
			const message = this.pendingMessages.shift();
			if (message) {
				this.webview.postMessage(message);
			}
		}
	}

	private async sendMessageToWebview(message: ExtensionMessage): Promise<void> {
		if (!(this.webview && this.isWebviewReady)) {
			this.pendingMessages.push(message);
			return;
		}

		await this.webview.postMessage(message);
	}
}
