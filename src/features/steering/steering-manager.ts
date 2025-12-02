import { homedir } from "os";
import { dirname, join } from "path";
import {
	type ExtensionContext,
	type OutputChannel,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";
import type { CopilotProvider } from "../../providers/copilot-provider";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import {
	detectActiveSpecSystem,
	getConstitutionPath,
} from "../../utils/spec-kit-utilities";
import { SPEC_SYSTEM_MODE } from "../../constants";

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
		const activeSystem = detectActiveSpecSystem(workspaceRoot);

		if (activeSystem === SPEC_SYSTEM_MODE.SPECKIT) {
			await this.createSpecKitConstitution(workspaceRoot);
		} else {
			await this.createOpenSpecAgents(workspaceRoot);
		}
	}

	private async createSpecKitConstitution(workspaceRoot: string) {
		const filePath = getConstitutionPath(workspaceRoot);
		const dirPath = dirname(filePath);

		// Ensure directory exists
		try {
			await workspace.fs.createDirectory(Uri.file(dirPath));
		} catch (error) {
			// Directory might already exist
		}

		// Check if file already exists
		try {
			await workspace.fs.stat(Uri.file(filePath));
			const overwrite = await window.showWarningMessage(
				"Project constitution (constitution.md) already exists. Overwrite?",
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
		const initialContent = `# Project Constitution

This file contains the core principles and rules for this project.
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
