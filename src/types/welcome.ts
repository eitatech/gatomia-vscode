/**
 * Message contracts for Welcome Screen extension ↔ webview communication
 * Based on specs/006-welcome-screen/contracts/messages.md
 */

// ============================================================================
// Extension → Webview Messages
// ============================================================================

export interface WelcomeInitMessage {
	type: "welcome/init";
	extensionVersion: string;
	vscodeVersion: string;
}

export interface WelcomeStateMessage {
	type: "welcome/state";
	hasShownBefore: boolean;
	dontShowOnStartup: boolean;
	currentView: "setup" | "features" | "configuration" | "status" | "learning";
	dependencies: DependencyStatus;
	configuration: ConfigurationState;
	diagnostics: SystemDiagnostic[];
	learningResources: LearningResource[];
	featureActions: FeatureAction[];
}

export interface WelcomeConfigUpdatedMessage {
	type: "welcome/config-updated";
	key: string;
	newValue: string | boolean;
}

export interface WelcomeDependencyStatusMessage {
	type: "welcome/dependency-status";
	copilotChat: {
		installed: boolean;
		active: boolean;
		version: string | null;
	};
	speckit: {
		installed: boolean;
		version: string | null;
	};
	openspec: {
		installed: boolean;
		version: string | null;
	};
	lastChecked: number;
}

export interface WelcomeDiagnosticAddedMessage {
	type: "welcome/diagnostic-added";
	diagnostic: SystemDiagnostic;
}

export interface WelcomeErrorMessage {
	type: "welcome/error";
	code: string;
	message: string;
	context?: string;
}

export type ExtensionToWebviewMessage =
	| WelcomeInitMessage
	| WelcomeStateMessage
	| WelcomeConfigUpdatedMessage
	| WelcomeDependencyStatusMessage
	| WelcomeDiagnosticAddedMessage
	| WelcomeErrorMessage;

// ============================================================================
// Webview → Extension Messages
// ============================================================================

export interface WelcomeReadyMessage {
	type: "welcome/ready";
}

export interface WelcomeExecuteCommandMessage {
	type: "welcome/execute-command";
	commandId: string;
	args?: unknown[];
}

export interface WelcomeUpdateConfigMessage {
	type: "welcome/update-config";
	key: string;
	value: string | boolean;
}

export interface WelcomeInstallDependencyMessage {
	type: "welcome/install-dependency";
	dependency: "copilot-chat" | "speckit" | "openspec";
}

export interface WelcomeRefreshDependenciesMessage {
	type: "welcome/refresh-dependencies";
}

export interface WelcomeUpdatePreferenceMessage {
	type: "welcome/update-preference";
	preference: "dontShowOnStartup";
	value: boolean;
}

export interface WelcomeOpenExternalMessage {
	type: "welcome/open-external";
	url: string;
}

export interface WelcomeNavigateSectionMessage {
	type: "welcome/navigate-section";
	section: "setup" | "features" | "configuration" | "status" | "learning";
}

export interface WelcomeSearchResourcesMessage {
	type: "welcome/search-resources";
	query: string;
}

export type WebviewToExtensionMessage =
	| WelcomeReadyMessage
	| WelcomeExecuteCommandMessage
	| WelcomeUpdateConfigMessage
	| WelcomeInstallDependencyMessage
	| WelcomeRefreshDependenciesMessage
	| WelcomeUpdatePreferenceMessage
	| WelcomeOpenExternalMessage
	| WelcomeNavigateSectionMessage
	| WelcomeSearchResourcesMessage;

// ============================================================================
// Data Model Types
// ============================================================================

export interface DependencyStatus {
	copilotChat: {
		installed: boolean;
		active: boolean;
		version: string | null;
	};
	speckit: {
		installed: boolean;
		version: string | null;
	};
	openspec: {
		installed: boolean;
		version: string | null;
	};
	lastChecked: number;
}

export interface ConfigurationItem {
	key: string;
	label: string;
	currentValue: string | boolean;
	editable: boolean;
	options?: string[];
}

export interface ConfigurationState {
	specSystem: ConfigurationItem & {
		currentValue: "auto" | "speckit" | "openspec";
		options: string[];
	};
	speckitSpecsPath: ConfigurationItem & { currentValue: string };
	speckitMemoryPath: ConfigurationItem & { currentValue: string };
	speckitTemplatesPath: ConfigurationItem & { currentValue: string };
	openspecPath: ConfigurationItem & { currentValue: string };
	promptsPath: ConfigurationItem & { currentValue: string };
	otherSettings: Array<ConfigurationItem & { editable: false }>;
}

export interface SystemDiagnostic {
	id: string;
	timestamp: number;
	severity: "error" | "warning";
	message: string;
	source: string;
	suggestedAction: string | null;
}

export interface LearningResource {
	id: string;
	title: string;
	description: string;
	url: string;
	category: "Getting Started" | "Advanced Features" | "Troubleshooting";
	keywords: string[];
	estimatedMinutes: number | null;
}

export interface FeatureAction {
	id: string;
	featureArea: "Specs" | "Prompts" | "Hooks" | "Steering";
	label: string;
	description: string;
	commandId: string;
	enabled: boolean;
}

// ============================================================================
// Welcome Screen State
// ============================================================================

export interface WelcomeScreenState {
	hasShownBefore: boolean;
	dontShowOnStartup: boolean;
	currentView: "setup" | "features" | "configuration" | "status" | "learning";
	dependencies: DependencyStatus;
	configuration: ConfigurationState;
	diagnostics: SystemDiagnostic[];
	learningResources: LearningResource[];
	featureActions: FeatureAction[];
}

// ============================================================================
// Error Codes
// ============================================================================

export const WelcomeErrorCode = {
	CONFIG_UPDATE_FAILED: "CONFIG_UPDATE_FAILED",
	INVALID_CONFIG_KEY: "INVALID_CONFIG_KEY",
	INVALID_CONFIG_VALUE: "INVALID_CONFIG_VALUE",
	COMMAND_EXECUTION_FAILED: "COMMAND_EXECUTION_FAILED",
	DEPENDENCY_CHECK_FAILED: "DEPENDENCY_CHECK_FAILED",
} as const;

export type WelcomeErrorCodeType =
	(typeof WelcomeErrorCode)[keyof typeof WelcomeErrorCode];
