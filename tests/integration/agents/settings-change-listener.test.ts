import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace } from "vscode";
import { ConfigurationService } from "../../../src/services/configuration-service";

// Mock workspace with getConfiguration that returns our test values
vi.mock("vscode", () => {
	const configValues: Record<string, any> = {
		"gatomia.agents.resourcesPath": "resources",
		"gatomia.agents.enableHotReload": true,
		"gatomia.agents.logLevel": "info",
	};

	return {
		workspace: {
			getConfiguration: vi.fn((section: string) => ({
				get: vi.fn((key: string, defaultValue?: any) => {
					const fullKey = `${section}.${key}`;
					return configValues[fullKey] !== undefined
						? configValues[fullKey]
						: defaultValue;
				}),
				update: vi.fn((key: string, value: any) => {
					const fullKey = `${section}.${key}`;
					configValues[fullKey] = value;
					return Promise.resolve();
				}),
			})),
			// Export configValues so tests can modify them
			__testConfigValues: configValues,
		},
	};
});

describe("T074: Settings Changes Trigger Reload", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset config values
		const mockWorkspace = workspace as any;
		mockWorkspace.__testConfigValues["gatomia.agents.resourcesPath"] =
			"resources";
		mockWorkspace.__testConfigValues["gatomia.agents.enableHotReload"] = true;
		mockWorkspace.__testConfigValues["gatomia.agents.logLevel"] = "info";
	});

	it("should detect and handle configuration reload on settings change", () => {
		const configService = new ConfigurationService();
		expect(configService.getResourcesPath()).toBe("resources");
		expect(configService.isHotReloadEnabled()).toBe(true);
		expect(configService.getLogLevel()).toBe("info");

		// Simulate settings change by modifying mock values
		const mockWorkspace = workspace as any;
		mockWorkspace.__testConfigValues["gatomia.agents.resourcesPath"] =
			"custom-resources";
		mockWorkspace.__testConfigValues["gatomia.agents.enableHotReload"] = false;
		mockWorkspace.__testConfigValues["gatomia.agents.logLevel"] = "debug";

		// Reload configuration
		const newConfig = configService.reloadConfiguration();

		expect(newConfig.resourcesPath).toBe("custom-resources");
		expect(newConfig.enableHotReload).toBe(false);
		expect(newConfig.logLevel).toBe("debug");
	});

	it("should properly update path when resourcesPath changes", () => {
		const configService = new ConfigurationService();
		const initialPath = configService.getResourcesPath();

		// Change resources path
		const mockWorkspace = workspace as any;
		mockWorkspace.__testConfigValues["gatomia.agents.resourcesPath"] =
			"src/agents/resources";

		const updatedConfig = configService.reloadConfiguration();
		const updatedPath = configService.getResourcesPath();

		expect(initialPath).toBe("resources");
		expect(updatedPath).toBe("src/agents/resources");
		expect(updatedConfig.resourcesPath).toBe("src/agents/resources");
	});

	it("should return default when path becomes empty after reload", () => {
		// Start with custom path
		const mockWorkspace = workspace as any;
		mockWorkspace.__testConfigValues["gatomia.agents.resourcesPath"] =
			"custom-resources";

		const configService = new ConfigurationService();
		expect(configService.getResourcesPath()).toBe("custom-resources");

		// Set to empty string
		mockWorkspace.__testConfigValues["gatomia.agents.resourcesPath"] = "";

		const updated = configService.reloadConfiguration();

		// Empty string is falsy, so should use default
		expect(updated.resourcesPath).toBe("resources");
		expect(configService.getResourcesPath()).toBe("resources");
	});
});
