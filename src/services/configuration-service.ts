/**
 * ConfigurationService
 * Manages agent-specific configuration settings from VS Code workspace settings
 */

import { workspace } from "vscode";

export interface AgentConfiguration {
	readonly resourcesPath: string;
	readonly enableHotReload: boolean;
	readonly logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Service for managing agent configuration
 * Provides access to agent settings with type safety and defaults
 */
export class ConfigurationService {
	private config: AgentConfiguration;

	constructor() {
		this.config = Object.freeze(this.loadConfiguration());
	}

	/**
	 * Load configuration from workspace settings
	 */
	loadConfiguration(): AgentConfiguration {
		const agentConfig = workspace.getConfiguration("gatomia.agents");

		const resourcesPath =
			agentConfig.get<string>("resourcesPath", "") || "resources";
		const enableHotReload = agentConfig.get<boolean>("enableHotReload", true);
		const logLevel = agentConfig.get<"debug" | "info" | "warn" | "error">(
			"logLevel",
			"info"
		);

		return Object.freeze({
			resourcesPath,
			enableHotReload,
			logLevel,
		});
	}

	/**
	 * Reload configuration (for use when settings change)
	 */
	reloadConfiguration(): AgentConfiguration {
		this.config = Object.freeze(this.loadConfiguration());
		return this.config;
	}

	/**
	 * Get current configuration
	 */
	getConfiguration(): AgentConfiguration {
		return this.config;
	}

	/**
	 * Get resources path setting
	 */
	getResourcesPath(): string {
		return this.config.resourcesPath;
	}

	/**
	 * Check if hot-reload is enabled
	 */
	isHotReloadEnabled(): boolean {
		return this.config.enableHotReload;
	}

	/**
	 * Get log level setting
	 */
	getLogLevel(): "debug" | "info" | "warn" | "error" {
		return this.config.logLevel;
	}
}
