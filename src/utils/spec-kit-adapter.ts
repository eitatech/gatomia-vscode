import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { workspace, window } from "vscode";
import {
	DEFAULT_CONFIG,
	SPECKIT_CONFIG,
	SPEC_SYSTEM_MODE,
	type SpecSystemMode,
} from "../constants";
import {
	detectActiveSpecSystem,
	discoverSpecKitFeatures,
	generateNextFeatureNumber,
	createFeatureDirectoryName,
	detectAvailableSpecSystems,
} from "./spec-kit-utilities";
import { ConfigManager } from "./config-manager";

/**
 * Spec System Adapter
 * Provides a unified interface for working with both OpenSpec and SpecKit
 * Automatically detects which system is active and adapts accordingly
 */

export interface SpecAdapterConfig {
	system: SpecSystemMode;
	workspacePath: string;
	specsPath: string;
	promptsPath: string;
}

/**
 * Unified spec information structure
 */
export interface UnifiedSpec {
	id: string;
	name: string;
	path: string;
	system: SpecSystemMode;
	files: Record<string, string>;
	isNumbered?: boolean;
	number?: number;
}

/**
 * Main adapter class for unified spec management
 */
export class SpecSystemAdapter {
	private config: SpecAdapterConfig | null = null;
	private static instance: SpecSystemAdapter;

	private constructor() {}

	static getInstance(): SpecSystemAdapter {
		if (!SpecSystemAdapter.instance) {
			SpecSystemAdapter.instance = new SpecSystemAdapter();
		}
		return SpecSystemAdapter.instance;
	}

	/**
	 * Initializes the adapter with workspace configuration
	 */
	async initialize(): Promise<void> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error("No workspace folder found");
		}

		const workspacePath = workspaceFolder.uri.fsPath;
		const configManager = ConfigManager.getInstance();
		const settings = await configManager.loadSettings();

		let system: SpecSystemMode;

		// 1. Check user preference
		if (
			settings.specSystem &&
			settings.specSystem !== "auto" &&
			Object.values(SPEC_SYSTEM_MODE).includes(
				settings.specSystem as SpecSystemMode
			)
		) {
			system = settings.specSystem as SpecSystemMode;
		} else {
			// 2. Auto-detect
			const available = detectAvailableSpecSystems(workspacePath);

			if (available.length > 1) {
				// Multiple systems detected and no preference set
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
							"Multiple Spec Systems detected. Which one do you want to use?",
						ignoreFocusOut: true,
					}
				);

				if (choice) {
					system = choice.value;
					// Save preference
					await configManager.saveSettings({
						...settings,
						specSystem: system,
					});
				} else {
					// Default to SpecKit if user cancels, but don't save
					system = SPEC_SYSTEM_MODE.SPECKIT;
				}
			} else {
				system = detectActiveSpecSystem(workspacePath);
			}
		}

		// Determine paths based on active system
		let specsPath: string;
		let promptsPath: string;

		if (system === SPEC_SYSTEM_MODE.SPECKIT) {
			specsPath = join(workspacePath, SPECKIT_CONFIG.paths.specs);
			promptsPath = join(workspacePath, SPECKIT_CONFIG.paths.templates);
		} else {
			specsPath = join(workspacePath, DEFAULT_CONFIG.paths.specs);
			promptsPath = join(workspacePath, DEFAULT_CONFIG.paths.prompts);
		}

		this.config = {
			system,
			workspacePath,
			specsPath,
			promptsPath,
		};
	}

	/**
	 * Allows user to manually select the spec system
	 */
	async selectSpecSystem(): Promise<void> {
		const choice = await window.showQuickPick(
			[
				{
					label: "Auto",
					description: "Automatically detect based on files",
					value: "auto",
				},
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
				placeHolder: "Select Spec System",
			}
		);

		if (choice) {
			const configManager = ConfigManager.getInstance();
			const settings = configManager.getSettings();
			await configManager.saveSettings({
				...settings,
				specSystem: choice.value,
			});

			// Re-initialize to apply changes
			await this.initialize();
			window.showInformationMessage(`Spec System set to: ${choice.label}`);
		}
	}

	/**
	 * Gets the current configuration
	 */
	getConfig(): SpecAdapterConfig {
		if (!this.config) {
			throw new Error("Adapter not initialized. Call initialize() first.");
		}
		return this.config;
	}

	/**
	 * Gets the active spec system
	 */
	getActiveSystem(): SpecSystemMode {
		return this.getConfig().system;
	}

	/**
	 * Gets the workspace path
	 */
	getWorkspacePath(): string {
		return this.getConfig().workspacePath;
	}

	/**
	 * Gets the specs base path
	 */
	getSpecsBasePath(): string {
		return this.getConfig().specsPath;
	}

	/**
	 * Gets the prompts base path
	 */
	getPromptsBasePath(): string {
		return this.getConfig().promptsPath;
	}

	/**
	 * Lists all available specs in the workspace
	 */
	listSpecs(): Promise<UnifiedSpec[]> {
		const config = this.getConfig();

		if (config.system === SPEC_SYSTEM_MODE.SPECKIT) {
			return this.listSpecKitSpecs();
		}
		return this.listOpenSpecSpecs();
	}

	/**
	 * Lists SpecKit features (numbered directories)
	 */
	private listSpecKitSpecs(): Promise<UnifiedSpec[]> {
		const config = this.getConfig();
		const features = discoverSpecKitFeatures(config.specsPath);

		return Promise.resolve(
			features.map((feature) => ({
				id: feature.slug,
				name: feature.name,
				path: feature.path,
				system: SPEC_SYSTEM_MODE.SPECKIT,
				files: this.getSpecKitFeatureFiles(feature.path),
				isNumbered: true,
				number: feature.number,
			}))
		);
	}

	/**
	 * Lists OpenSpec specs
	 */
	private listOpenSpecSpecs(): Promise<UnifiedSpec[]> {
		const config = this.getConfig();
		const specsPath = join(config.specsPath, "specs");

		if (!existsSync(specsPath)) {
			return Promise.resolve([]);
		}

		const specs: UnifiedSpec[] = [];

		try {
			const entries = readdirSync(specsPath);

			for (const entry of entries) {
				const fullPath = join(specsPath, entry);
				const stat = statSync(fullPath);

				if (stat.isDirectory()) {
					specs.push({
						id: entry,
						name: entry,
						path: fullPath,
						system: SPEC_SYSTEM_MODE.OPENSPEC,
						files: this.getOpenSpecFiles(fullPath),
					});
				}
			}
		} catch (error) {
			console.error(`Error listing OpenSpec specs: ${error}`);
		}

		return Promise.resolve(specs);
	}

	/**
	 * Gets file paths for a SpecKit feature
	 */
	private getSpecKitFeatureFiles(featurePath: string): Record<string, string> {
		const files: Record<string, string> = {};

		const documentTypes = [
			"spec",
			"plan",
			"tasks",
			"research",
			"data-model",
			"quickstart",
		];

		for (const docType of documentTypes) {
			const filePath = join(featurePath, `${docType}.md`);
			if (existsSync(filePath)) {
				files[docType] = filePath;
			}
		}

		// Check for checklists folder
		const checklistsPath = join(featurePath, "checklists");
		if (existsSync(checklistsPath) && statSync(checklistsPath).isDirectory()) {
			files.checklists = checklistsPath;
		}

		return files;
	}

	/**
	 * Gets file paths for an OpenSpec spec
	 */
	private getOpenSpecFiles(specPath: string): Record<string, string> {
		const files: Record<string, string> = {};

		const documentTypes = ["spec", "requirements", "design", "tasks"];

		for (const docType of documentTypes) {
			const filePath = join(specPath, `${docType}.md`);
			if (existsSync(filePath)) {
				files[docType] = filePath;
			}
		}

		return files;
	}

	/**
	 * Creates a new spec in the appropriate system
	 */
	createSpec(name: string): Promise<UnifiedSpec> {
		const config = this.getConfig();

		if (config.system === SPEC_SYSTEM_MODE.SPECKIT) {
			return this.createSpecKitFeature(name);
		}
		return this.createOpenSpecSpec(name);
	}

	/**
	 * Creates a new SpecKit feature
	 */
	private createSpecKitFeature(name: string): Promise<UnifiedSpec> {
		const config = this.getConfig();

		try {
			mkdirSync(config.specsPath, { recursive: true });

			const nextNumber = generateNextFeatureNumber(config.specsPath);
			const dirName = createFeatureDirectoryName(nextNumber, name);
			const featurePath = join(config.specsPath, dirName);

			mkdirSync(featurePath, { recursive: true });

			return Promise.resolve({
				id: dirName,
				name,
				path: featurePath,
				system: SPEC_SYSTEM_MODE.SPECKIT,
				files: {},
				isNumbered: true,
				number: nextNumber,
			});
		} catch (error) {
			return Promise.reject(
				new Error(`Failed to create SpecKit feature: ${error}`)
			);
		}
	}

	/**
	 * Creates a new OpenSpec spec
	 */
	private createOpenSpecSpec(name: string): Promise<UnifiedSpec> {
		const config = this.getConfig();
		const specsPath = join(config.specsPath, "specs");

		try {
			mkdirSync(specsPath, { recursive: true });

			const specPath = join(specsPath, name);
			mkdirSync(specPath, { recursive: true });

			return Promise.resolve({
				id: name,
				name,
				path: specPath,
				system: SPEC_SYSTEM_MODE.OPENSPEC,
				files: {},
			});
		} catch (error) {
			return Promise.reject(
				new Error(`Failed to create OpenSpec spec: ${error}`)
			);
		}
	}

	/**
	 * Opens a spec document in the editor
	 */
	async openSpecDocument(spec: UnifiedSpec, docType: string): Promise<void> {
		const filePath = spec.files[docType];

		if (!filePath) {
			throw new Error(
				`Document type "${docType}" not found for spec "${spec.name}"`
			);
		}

		const textDocument = await workspace.openTextDocument(filePath);
		await require("vscode").window.showTextDocument(textDocument);
	}

	/**
	 * Gets a spec by ID
	 */
	async getSpec(specId: string): Promise<UnifiedSpec | undefined> {
		const specs = await this.listSpecs();
		return specs.find((s) => s.id === specId);
	}

	/**
	 * Gets file paths for a specific spec by name
	 */
	getSpecFiles(specName: string): Record<string, string> {
		const config = this.getConfig();

		if (config.system === SPEC_SYSTEM_MODE.SPECKIT) {
			// Find the feature directory that matches the spec name
			const features = discoverSpecKitFeatures(config.specsPath);
			const feature = features.find(
				(f) => f.slug === specName || f.name === specName
			);

			if (!feature) {
				return {};
			}

			return this.getSpecKitFeatureFiles(feature.path);
		}

		// OpenSpec format
		const specsPath = join(config.specsPath, "specs", specName);
		if (!existsSync(specsPath)) {
			return {};
		}

		return this.getOpenSpecFiles(specsPath);
	}

	/**
	 * Gets the system-appropriate prompt path
	 */
	getPromptPath(promptName: string): string {
		const config = this.getConfig();

		if (config.system === SPEC_SYSTEM_MODE.SPECKIT) {
			return join(config.promptsPath, `${promptName}.md`);
		}
		return join(config.promptsPath, `${promptName}.prompt.md`);
	}

	/**
	 * Converts OpenSpec spec to SpecKit format (future migration support)
	 */
	migrateSpecToSpecKit(openSpecId: string): Promise<UnifiedSpec | null> {
		const config = this.getConfig();

		if (config.system !== SPEC_SYSTEM_MODE.OPENSPEC) {
			console.warn("Migration only works from OpenSpec to SpecKit");
			return Promise.resolve(null);
		}

		// This is a placeholder for migration logic
		// In a full implementation, this would:
		// 1. Read files from OpenSpec directory
		// 2. Convert format/metadata if needed
		// 3. Create SpecKit feature directory
		// 4. Write converted files
		// 5. Return the new unified spec

		return Promise.resolve(null);
	}

	/**
	 * Resets the adapter (useful for testing or reinitialization)
	 */
	reset(): void {
		this.config = null;
	}
}

/**
 * Helper function to get the singleton adapter instance
 */
export function getSpecSystemAdapter(): SpecSystemAdapter {
	return SpecSystemAdapter.getInstance();
}

/**
 * Helper function to initialize the adapter
 */
export async function initializeSpecSystemAdapter(): Promise<SpecSystemAdapter> {
	const adapter = getSpecSystemAdapter();
	await adapter.initialize();
	return adapter;
}
