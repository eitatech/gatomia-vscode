import { basename, dirname, join } from "path";
import {
	FileType,
	type ExtensionContext,
	type OutputChannel,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { NotificationUtils } from "../../utils/notification-utils";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import {
	getSpecSystemAdapter,
	type SpecSystemAdapter,
} from "../../utils/spec-kit-adapter";
import { SPEC_SYSTEM_MODE, type SpecSystemMode } from "../../constants";
import { CreateSpecInputController } from "./create-spec-input-controller";
import { SpecKitManager } from "./spec-kit-manager";
import type { TriggerRegistry } from "../hooks/trigger-registry";

export type SpecDocumentType = "requirements" | "design" | "tasks";

export class SpecManager {
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly outputChannel: OutputChannel;
	private createSpecInputController: CreateSpecInputController;
	private specAdapter: SpecSystemAdapter | null = null;
	private activeSystem: SpecSystemMode = SPEC_SYSTEM_MODE.AUTO;
	private triggerRegistry: TriggerRegistry | null = null;

	constructor(context: ExtensionContext, outputChannel: OutputChannel) {
		this.configManager = ConfigManager.getInstance();
		this.configManager.loadSettings();
		this.promptLoader = PromptLoader.getInstance();
		this.outputChannel = outputChannel;
		// Initialize with default, will be updated after adapter init
		this.createSpecInputController = new CreateSpecInputController({
			context,
			configManager: this.configManager,
			promptLoader: this.promptLoader,
			outputChannel: this.outputChannel,
			activeSystem: this.activeSystem,
		});
		this.initializeAdapter(context);
	}

	private initializeAdapter(context: ExtensionContext): void {
		try {
			// Adapter is already initialized in extension.ts
			this.specAdapter = getSpecSystemAdapter();
			this.activeSystem = this.specAdapter.getActiveSystem();

			this.outputChannel.appendLine(
				`[SpecManager] Initialized with active spec system: ${this.activeSystem}`
			);

			// Re-initialize controller with correct system
			this.createSpecInputController = new CreateSpecInputController({
				context,
				configManager: this.configManager,
				promptLoader: this.promptLoader,
				outputChannel: this.outputChannel,
				activeSystem: this.activeSystem,
			});
		} catch (error) {
			this.outputChannel.appendLine(
				`[SpecManager] Warning: Failed to get spec-kit adapter: ${error}`
			);
			// Fall back to OpenSpec mode
			this.activeSystem = SPEC_SYSTEM_MODE.OPENSPEC;

			// Re-initialize controller with fallback system
			this.createSpecInputController = new CreateSpecInputController({
				context,
				configManager: this.configManager,
				promptLoader: this.promptLoader,
				outputChannel: this.outputChannel,
				activeSystem: this.activeSystem,
			});
		}
	}

	/**
	 * Sets the TriggerRegistry for hook integration
	 */
	setTriggerRegistry(registry: TriggerRegistry): void {
		this.triggerRegistry = registry;
		this.outputChannel.appendLine("[SpecManager] TriggerRegistry connected");
	}

	/**
	 * Executes a SpecKit command and fires the appropriate trigger
	 */
	async executeSpecKitCommand(operation: string): Promise<void> {
		try {
			// Send command to Copilot Chat
			await sendPromptToChat(`/speckit.${operation}`);

			// Fire trigger after command is sent
			// NOTE: We fire immediately after sending, as we don't have a way
			// to know when the Copilot agent completes the operation.
			// This is a best-effort approach for MVP.
			if (this.triggerRegistry) {
				this.triggerRegistry.fireTrigger("speckit", operation);
				this.outputChannel.appendLine(
					`[SpecManager] Fired trigger: speckit.${operation}`
				);
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: `Failed to execute speckit.${operation}`;
			this.outputChannel.appendLine(
				`[SpecManager] Error executing ${operation}: ${message}`
			);
			// Don't fire trigger on error
			throw error;
		}
	}

	/**
	 * Gets the active spec system (OpenSpec, SpecKit, or Auto)
	 */
	getActiveSystem(): SpecSystemMode {
		return this.activeSystem;
	}

	getSpecBasePath(): string {
		return this.configManager.getPath("specs");
	}

	async create() {
		try {
			await this.createSpecInputController.open();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unable to open spec dialog";
			this.outputChannel.appendLine(
				`[SpecManager] Failed to open Create Spec dialog: ${message}`
			);
			window.showErrorMessage(`Failed to open Create Spec dialog: ${message}`);
		}
	}

	async openDocument(relativePath: string, type: string) {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		const docPath = join(workspaceFolder.uri.fsPath, relativePath);

		try {
			const doc = await workspace.openTextDocument(docPath);
			await window.showTextDocument(doc);
		} catch (error) {
			// File doesn't exist, look for already open virtual documents
			// Create unique identifier for this spec document
			const uniqueMarker = `<!-- openspec-spec: ${relativePath} -->`;

			for (const doc of workspace.textDocuments) {
				// Check if this is an untitled document with our unique marker
				if (doc.isUntitled && doc.getText().includes(uniqueMarker)) {
					// Found our specific virtual document, show it
					await window.showTextDocument(doc, {
						preview: false,
						viewColumn: ViewColumn.Active,
					});
					return;
				}
			}

			// No existing virtual document found, create a new one
			let placeholderContent = `${uniqueMarker}
# ${type.charAt(0).toUpperCase() + type.slice(1)} Document

This document has not been created yet.`;

			if (type === "design") {
				placeholderContent +=
					"\n\nPlease approve the requirements document first.";
			} else if (type === "tasks") {
				placeholderContent += "\n\nPlease approve the design document first.";
			} else if (type === "requirements") {
				placeholderContent +=
					'\n\nRun "Create New Spec" to generate this document.';
			}

			// Create a new untitled document
			const doc = await workspace.openTextDocument({
				content: placeholderContent,
				language: "markdown",
			});

			// Show it
			await window.showTextDocument(doc, {
				preview: false,
				viewColumn: ViewColumn.Active,
			});
		}
	}

	async navigateToDocument(specName: string, type: SpecDocumentType) {
		// Legacy support or redirect to openDocument
		// Assuming specName is a current spec in openspec/specs
		const path = join(this.getSpecBasePath(), "specs", specName, `${type}.md`);
		await this.openDocument(path, type);
	}

	async delete(specName: string): Promise<void> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		const specPath = join(
			workspaceFolder.uri.fsPath,
			this.getSpecBasePath(),
			specName
		);

		try {
			await workspace.fs.delete(Uri.file(specPath), {
				recursive: true,
			});
			await NotificationUtils.showAutoDismissNotification(
				`Spec "${specName}" deleted successfully`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[SpecManager] Failed to delete spec: ${error}`
			);
			window.showErrorMessage(`Failed to delete spec: ${error}`);
		}
	}

	private async getDirectories(subPath: string): Promise<string[]> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return [];
		}

		const fullPath = join(
			workspaceFolder.uri.fsPath,
			this.getSpecBasePath(),
			subPath
		);

		try {
			const entries = await workspace.fs.readDirectory(Uri.file(fullPath));
			return entries
				.filter(([, type]) => type === FileType.Directory)
				.map(([name]) => name);
		} catch (error) {
			this.outputChannel.appendLine(
				`[SpecManager] Failed to read directory ${fullPath}: ${error}`
			);
			return [];
		}
	}

	async getSpecs(): Promise<string[]> {
		return await this.getDirectories("specs");
	}

	async getChanges(): Promise<string[]> {
		const changes = await this.getDirectories("changes");
		return changes.filter((name) => name !== "archive");
	}

	async getSpecList(): Promise<string[]> {
		// For backward compatibility, return specs
		return await this.getSpecs();
	}

	async runOpenSpecApply(documentUri: Uri) {
		if (this.activeSystem === SPEC_SYSTEM_MODE.SPECKIT) {
			await sendPromptToChat("/speckit.implementation");
			return;
		}

		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		// Extract change ID from path: .../openspec/changes/<change-id>/tasks.md
		const changeId = basename(dirname(documentUri.fsPath));

		// Read prompt template from .github/prompts/openspec-apply.prompt.md
		const promptPath = join(
			workspaceFolder.uri.fsPath,
			".github",
			"prompts",
			"openspec-apply.prompt.md"
		);

		let promptContent = "";
		try {
			const promptUri = Uri.file(promptPath);
			const promptData = await workspace.fs.readFile(promptUri);
			promptContent = Buffer.from(promptData).toString("utf-8");
		} catch (error) {
			const message = `Failed to read prompt file at ${promptPath}`;
			this.outputChannel.appendLine(`[SpecManager] ${message}: ${error}`);
			window.showErrorMessage(message);
			return;
		}

		// Append change ID
		const finalPrompt = `${promptContent}\n\nid: ${changeId}`;

		await sendPromptToChat(finalPrompt, { instructionType: "startAllTask" });
	}

	async getChangeSpecs(changeName: string): Promise<string[]> {
		return await this.getDirectories(`changes/${changeName}/specs`);
	}

	/**
	 * Gets all available specs from both OpenSpec and SpecKit systems
	 * This method unifies spec discovery across both systems
	 */
	async getAllSpecsUnified(): Promise<
		Array<{ id: string; name: string; system: SpecSystemMode }>
	> {
		if (!this.specAdapter) {
			// Fallback to OpenSpec-only if adapter failed
			const specs = await this.getSpecs();
			return specs.map((spec) => ({
				id: spec,
				name: spec,
				system: SPEC_SYSTEM_MODE.OPENSPEC,
			}));
		}

		try {
			const unifiedSpecs = await this.specAdapter.listSpecs();
			return unifiedSpecs.map((spec) => ({
				id: spec.id,
				name: spec.name,
				system: spec.system,
			}));
		} catch (error) {
			this.outputChannel.appendLine(
				`[SpecManager] Warning: Failed to list unified specs: ${error}`
			);
			// Fallback to OpenSpec
			const specs = await this.getSpecs();
			return specs.map((spec) => ({
				id: spec,
				name: spec,
				system: SPEC_SYSTEM_MODE.OPENSPEC,
			}));
		}
	}

	/**
	 * Creates a new spec using the appropriate system (OpenSpec or SpecKit)
	 */
	async createUnified(specName: string): Promise<boolean> {
		try {
			if (this.specAdapter && this.activeSystem === SPEC_SYSTEM_MODE.SPECKIT) {
				// Use SpecKitManager to create feature with files
				const manager = SpecKitManager.getInstance();
				await manager.createFeature(specName);

				this.outputChannel.appendLine(
					`[SpecManager] Created SpecKit feature: ${specName}`
				);
				return true;
			}
			// Use existing OpenSpec creation (via dialog)
			await this.create();
			return true;
		} catch (error) {
			this.outputChannel.appendLine(
				`[SpecManager] Failed to create spec: ${error}`
			);
			window.showErrorMessage(`Failed to create spec: ${error}`);
			return false;
		}
	}

	/**
	 * Gets the adapter instance (for testing/debugging purposes)
	 */
	getAdapter(): SpecSystemAdapter | null {
		return this.specAdapter;
	}
}
