/**
 * TypeScript types for Welcome Screen webview
 * Based on specs/006-welcome-screen/contracts/messages.md and data-model.md
 */

// ============================================================================
// Core State Types
// ============================================================================

export type ViewSection =
	| "setup"
	| "features"
	| "configuration"
	| "status"
	| "learning";

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
	description?: string;
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

export type ResourceCategory =
	| "Getting Started"
	| "Advanced Features"
	| "Troubleshooting";

export interface LearningResource {
	id: string;
	title: string;
	description: string;
	url: string;
	category: ResourceCategory;
	keywords: string[];
	estimatedMinutes: number | null;
}

export type FeatureArea = "Specs" | "Prompts" | "Hooks" | "Steering";

export interface FeatureAction {
	id: string;
	featureArea: FeatureArea;
	label: string;
	description: string;
	commandId: string;
	enabled: boolean;
	icon?: string;
}

export interface WelcomeScreenState {
	hasShownBefore: boolean;
	dontShowOnStartup: boolean;
	currentView: ViewSection;
	dependencies: DependencyStatus;
	configuration: ConfigurationState;
	diagnostics: SystemDiagnostic[];
	learningResources: LearningResource[];
	featureActions: FeatureAction[];
}

// ============================================================================
// Message Types (for webview usage)
// ============================================================================

export interface WelcomeInitData {
	extensionVersion: string;
	vscodeVersion: string;
}

export interface WelcomeStateData extends WelcomeScreenState {}

export interface WelcomeConfigUpdateData {
	key: string;
	newValue: string | boolean;
}

export interface WelcomeDependencyStatusData {
	copilotChat: DependencyStatus["copilotChat"];
	speckit: DependencyStatus["speckit"];
	openspec: DependencyStatus["openspec"];
	lastChecked: number;
}

export interface WelcomeErrorData {
	code: string;
	message: string;
	context?: string;
}

// ============================================================================
// UI Component Props
// ============================================================================

export interface SetupSectionProps {
	dependencies: DependencyStatus;
	onInstallDependency: (
		dependency: "copilot-chat" | "speckit" | "openspec"
	) => void;
	onRefreshDependencies: () => void;
	onNavigateNext: () => void;
}

export interface FeaturesSectionProps {
	featureActions: FeatureAction[];
	onExecuteCommand: (commandId: string, args?: unknown[]) => void;
}

export interface ConfigSectionProps {
	configuration: ConfigurationState;
	onUpdateConfig: (key: string, value: string | boolean) => void;
	onOpenSettings: () => void;
}

export interface StatusSectionProps {
	extensionVersion: string;
	vscodeVersion: string;
	dependencies: DependencyStatus;
	diagnostics: SystemDiagnostic[];
	onInstallDependency: (
		dependency: "copilot-chat" | "speckit" | "openspec"
	) => void;
}

export interface LearningSectionProps {
	resources: LearningResource[];
	onOpenExternal: (url: string) => void;
	onSearch: (query: string) => void;
}

// ============================================================================
// Store Types
// ============================================================================

export interface WelcomeStore {
	// State
	state: WelcomeScreenState | null;
	loading: boolean;
	error: WelcomeErrorData | null;
	extensionVersion: string;
	vscodeVersion: string;

	// Actions
	setState: (state: WelcomeScreenState) => void;
	updateConfig: (key: string, value: string | boolean) => void;
	updateDependencies: (dependencies: DependencyStatus) => void;
	addDiagnostic: (diagnostic: SystemDiagnostic) => void;
	setCurrentView: (view: ViewSection) => void;
	setDontShowOnStartup: (value: boolean) => void;
	setError: (error: WelcomeErrorData | null) => void;
	setLoading: (loading: boolean) => void;
	initialize: (init: WelcomeInitData) => void;
	reset: () => void;
}
