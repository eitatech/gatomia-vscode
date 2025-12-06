import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import {
	type ExtensionContext,
	type OutputChannel,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";
import type { CopilotProvider } from "../../providers/copilot-provider";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { getSpecSystemAdapter } from "../../utils/spec-kit-adapter";
import { SPEC_SYSTEM_MODE } from "../../constants";
import { ConstitutionManager } from "./constitution-manager";

export class SteeringManager {
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly copilotProvider: CopilotProvider;
	private readonly outputChannel: OutputChannel;

	constructor(
		context: ExtensionContext,
		copilotProvider: CopilotProvider,
		outputChannel: OutputChannel
	) {
		this.configManager = ConfigManager.getInstance();
		this.configManager.loadSettings();
		this.promptLoader = PromptLoader.getInstance();
		this.copilotProvider = copilotProvider;
		this.outputChannel = outputChannel;
	}

	/**
	 * Create global Copilot configuration file (~/.github/copilot-instructions.md)
	 */
	async createUserConfiguration() {
		const homeDir = homedir() || process.env.USERPROFILE || "";
		const githubDir = join(homeDir, ".github");
		const filePath = join(githubDir, "copilot-instructions.md");

		// Ensure directory exists
		try {
			await workspace.fs.createDirectory(Uri.file(githubDir));
		} catch (error) {
			// Directory might already exist
		}

		// Check if file already exists
		try {
			await workspace.fs.stat(Uri.file(filePath));
			const overwrite = await window.showWarningMessage(
				"Global configuration file (~/.github/copilot-instructions.md) already exists. Overwrite?",
				"Overwrite",
				"Cancel"
			);
			if (overwrite !== "Overwrite") {
				return;
			}
		} catch {
			// File doesn't exist, continue
		}

		// Create initial MD content
		const initialContent = `# Global Copilot Instructions

This file controls default behavior for GitHub Copilot across all projects.
`;

		await workspace.fs.writeFile(
			Uri.file(filePath),
			Buffer.from(initialContent)
		);

		const document = await workspace.openTextDocument(filePath);
		await window.showTextDocument(document, {
			preview: false,
			viewColumn: ViewColumn.Active,
		});
	}

	/**
	 * Create project-level documentation (AGENTS.md or constitution.md)
	 */
	async createProjectDocumentation() {
		if (!workspace.workspaceFolders) {
			window.showErrorMessage("No workspace folder open.");
			return;
		}
		const workspaceRoot = workspace.workspaceFolders[0].uri.fsPath;
		const adapter = getSpecSystemAdapter();
		let activeSystem = adapter.getActiveSystem();

		// Check if project is initialized with any system
		const hasOpenSpec = existsSync(join(workspaceRoot, "openspec"));
		const hasSpecKit =
			existsSync(join(workspaceRoot, ".specify")) ||
			existsSync(join(workspaceRoot, "specs"));

		// If no system is detected and we are about to create project rules,
		// we must ask the user which system they intend to use.
		if (!(hasOpenSpec || hasSpecKit)) {
			const choice = await window.showQuickPick(
				[
					{
						label: "SpecKit",
						description: "Use SpecKit system",
						value: SPEC_SYSTEM_MODE.SPECKIT,
					},
					{
						label: "OpenSpec",
						description: "Use OpenSpec system",
						value: SPEC_SYSTEM_MODE.OPENSPEC,
					},
				],
				{
					placeHolder:
						"No SDD system detected. Which agent do you want to initialize?",
					ignoreFocusOut: true,
				}
			);

			if (!choice) {
				return;
			}

			activeSystem = choice.value;

			// Save preference
			const settings = this.configManager.getSettings();
			await this.configManager.saveSettings({
				...settings,
				specSystem: activeSystem,
			});

			// Re-initialize adapter
			await adapter.initialize();
		}

		if (activeSystem === SPEC_SYSTEM_MODE.SPECKIT) {
			await this.createSpecKitConstitution(workspaceRoot);
		} else {
			await this.createOpenSpecAgents(workspaceRoot);
		}
	}

	private async createSpecKitConstitution(workspaceRoot: string) {
		const constitutionManager = new ConstitutionManager(workspaceRoot);
		const exists = await constitutionManager.ensureConstitutionExists();

		if (exists) {
			const overwrite = await window.showWarningMessage(
				"Project constitution (constitution.md) already exists. Running the agent might overwrite it. Continue?",
				"Continue",
				"Cancel"
			);
			if (overwrite !== "Continue") {
				return;
			}
		}

		// Prompt for directives
		const directives = await window.showInputBox({
			title: "Create Constitution",
			prompt:
				"Enter the constitution directives (e.g. 'Create principles focused on code quality...')",
			placeHolder: "Directives...",
			ignoreFocusOut: true,
		});

		if (!directives) {
			return;
		}

		// Send to chat
		await sendPromptToChat(`/speckit.constitution ${directives}`);
	}

	private async createOpenSpecAgents(workspaceRoot: string) {
		const openspecDir = join(workspaceRoot, "openspec");
		const filePath = join(openspecDir, "AGENTS.md");

		// Ensure directory exists
		try {
			await workspace.fs.createDirectory(Uri.file(openspecDir));
		} catch (error) {
			// Directory might already exist
		}

		// Check if file already exists
		try {
			await workspace.fs.stat(Uri.file(filePath));
			const overwrite = await window.showWarningMessage(
				"Project AGENTS.md (openspec/AGENTS.md) already exists. Overwrite?",
				"Overwrite",
				"Cancel"
			);
			if (overwrite !== "Overwrite") {
				return;
			}
		} catch {
			// File doesn't exist
		}

		// Create initial content
		const initialContent = `# Project Instructions

This file contains instructions for AI agents working on this project.
`;
		await workspace.fs.writeFile(
			Uri.file(filePath),
			Buffer.from(initialContent)
		);

		const document = await workspace.openTextDocument(filePath);
		await window.showTextDocument(document, {
			preview: false,
			viewColumn: ViewColumn.Active,
		});
	}
}
