import { join } from "path";
import { type WorkspaceFolder, workspace } from "vscode";
import {
	DEFAULT_CONFIG,
	DEFAULT_PATHS,
	DEFAULT_VIEW_VISIBILITY,
	SPECKIT_CONFIG,
	VSC_CONFIG_NAMESPACE,
} from "../constants";
export interface OpenSpecSettings {
	paths: {
		specs: string;
		prompts: string;
	};
	speckit: {
		paths: {
			specs: string;
			memory: string;
			templates: string;
			scripts: string;
			agents: string;
			skills: string;
		};
	};
	views: {
		specs: { visible: boolean };
		steering: { visible: boolean };
		prompts: { visible: boolean };
		quickAccess: { visible: boolean };
	};
	chatLanguage: string;
	customInstructions: {
		global: string;
		createSpec: string;
		startAllTask: string;
		runPrompt: string;
	};
	specSystem: string;
}

export class ConfigManager {
	private static instance: ConfigManager;
	private settings: OpenSpecSettings | null = null;
	private readonly workspaceFolder: WorkspaceFolder | undefined;

	// Internal constants
	private static readonly TERMINAL_VENV_ACTIVATION_DELAY = 800; // ms

	private constructor() {
		this.workspaceFolder = workspace.workspaceFolders?.[0];
	}

	static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	// biome-ignore lint/suspicious/useAwait: ignore
	async loadSettings(): Promise<OpenSpecSettings> {
		const settings = this.getDefaultSettings();
		this.settings = settings;
		return settings;
	}

	getSettings(): OpenSpecSettings {
		if (!this.settings) {
			this.settings = this.getDefaultSettings();
		}
		return this.settings;
	}

	getPath(type: keyof typeof DEFAULT_PATHS): string {
		const settings = this.getSettings();
		return settings.paths[type] ?? DEFAULT_PATHS[type];
	}

	getAbsolutePath(type: keyof typeof DEFAULT_PATHS): string {
		if (!this.workspaceFolder) {
			throw new Error("No workspace folder found");
		}
		return join(this.workspaceFolder.uri.fsPath, this.getPath(type));
	}

	getTerminalDelay(): number {
		return ConfigManager.TERMINAL_VENV_ACTIVATION_DELAY;
	}

	private getConfiguredPaths(): Partial<
		Record<keyof typeof DEFAULT_PATHS, string>
	> {
		const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
		const promptsPath = config.get<string>("copilot.promptsPath")?.trim();
		const specsPath = config.get<string>("copilot.specsPath")?.trim();

		const configuredPaths: Partial<Record<keyof typeof DEFAULT_PATHS, string>> =
			{};

		if (promptsPath) {
			configuredPaths.prompts = promptsPath;
		}

		if (specsPath) {
			configuredPaths.specs = specsPath;
		}

		return configuredPaths;
	}

	private getSpecKitPaths(): OpenSpecSettings["speckit"]["paths"] {
		const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
		return {
			specs:
				config.get<string>("speckit.specsPath") ?? SPECKIT_CONFIG.paths.specs,
			memory:
				config.get<string>("speckit.memoryPath") ?? SPECKIT_CONFIG.paths.memory,
			templates:
				config.get<string>("speckit.templatesPath") ??
				SPECKIT_CONFIG.paths.templates,
			scripts:
				config.get<string>("speckit.scriptsPath") ??
				SPECKIT_CONFIG.paths.scripts,
			agents:
				config.get<string>("speckit.agentsPath") ?? SPECKIT_CONFIG.paths.agents,
			skills:
				config.get<string>("speckit.skillsPath") ?? SPECKIT_CONFIG.paths.skills,
		};
	}

	private getChatLanguage(): string {
		const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
		return config.get<string>("chatLanguage") ?? DEFAULT_CONFIG.chatLanguage;
	}

	private getSpecSystem(): string {
		const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
		return config.get<string>("specSystem") ?? "auto";
	}

	private getCustomInstructions(): OpenSpecSettings["customInstructions"] {
		const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
		return {
			global: config.get<string>("customInstructions.global") ?? "",
			createSpec: config.get<string>("customInstructions.createSpec") ?? "",
			startAllTask: config.get<string>("customInstructions.startAllTask") ?? "",
			runPrompt: config.get<string>("customInstructions.runPrompt") ?? "",
		};
	}

	private mergeSettings(
		defaults: OpenSpecSettings,
		overrides: Partial<OpenSpecSettings> = {}
	): OpenSpecSettings {
		const mergedPaths = {
			...defaults.paths,
			...(overrides.paths ?? {}),
		};

		const mergedSpecKitPaths = {
			...defaults.speckit.paths,
			...(overrides.speckit?.paths ?? {}),
		};

		const mergedViews = {
			specs: {
				visible:
					overrides.views?.specs?.visible ?? defaults.views.specs.visible,
			},
			steering: {
				visible:
					overrides.views?.steering?.visible ?? defaults.views.steering.visible,
			},
			prompts: {
				visible:
					overrides.views?.prompts?.visible ?? defaults.views.prompts.visible,
			},
			quickAccess: {
				visible:
					overrides.views?.quickAccess?.visible ??
					defaults.views.quickAccess.visible,
			},
		};

		const mergedCustomInstructions = {
			global:
				overrides.customInstructions?.global ??
				defaults.customInstructions.global,
			createSpec:
				overrides.customInstructions?.createSpec ??
				defaults.customInstructions.createSpec,
			startAllTask:
				overrides.customInstructions?.startAllTask ??
				defaults.customInstructions.startAllTask,
			runPrompt:
				overrides.customInstructions?.runPrompt ??
				defaults.customInstructions.runPrompt,
		};

		return {
			paths: mergedPaths,
			speckit: {
				paths: mergedSpecKitPaths,
			},
			views: mergedViews,
			chatLanguage: overrides.chatLanguage ?? defaults.chatLanguage,
			customInstructions: mergedCustomInstructions,
			specSystem: overrides.specSystem ?? defaults.specSystem,
		};
	}

	private getDefaultSettings(): OpenSpecSettings {
		const configuredPaths = this.getConfiguredPaths();
		const specKitPaths = this.getSpecKitPaths();
		const chatLanguage = this.getChatLanguage();
		const customInstructions = this.getCustomInstructions();
		const specSystem = this.getSpecSystem();

		return {
			paths: { ...DEFAULT_PATHS, ...configuredPaths },
			speckit: {
				paths: specKitPaths,
			},
			views: {
				specs: { visible: DEFAULT_VIEW_VISIBILITY.specs },
				steering: { visible: DEFAULT_VIEW_VISIBILITY.steering },
				prompts: { visible: DEFAULT_VIEW_VISIBILITY.prompts },
				quickAccess: { visible: DEFAULT_VIEW_VISIBILITY.quickAccess },
			},
			chatLanguage,
			customInstructions,
			specSystem,
		};
	}
	// biome-ignore lint/suspicious/useAwait: ignore
	async saveSettings(settings: OpenSpecSettings): Promise<void> {
		this.settings = this.mergeSettings(this.getDefaultSettings(), settings);
	}
}
