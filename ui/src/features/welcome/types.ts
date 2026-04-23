/**
 * TypeScript types for Welcome Screen webview
 * Based on specs/006-welcome-screen/contracts/messages.md and data-model.md
 */

// ============================================================================
// Core State Types
// ============================================================================

export type IdeHost =
	| "windsurf"
	| "antigravity"
	| "cursor"
	| "vscode"
	| "vscode-insiders"
	| "vscodium"
	| "positron"
	| "unknown";

export type ViewSection =
	| "setup"
	| "features"
	| "configuration"
	| "status"
	| "learning";

export interface AcpCliStatus {
	installed: boolean;
	version: string | null;
	authenticated?: boolean;
	acpSupported?: boolean;
}

export type SystemPrerequisiteKey = "node" | "python" | "uv";

export interface SystemPrerequisiteStatus {
	installed: boolean;
	version: string | null;
}

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
	copilotCli: {
		installed: boolean;
		version: string | null;
	};
	gatomiaCli: {
		installed: boolean;
		version: string | null;
	};
	devinCli?: AcpCliStatus;
	geminiCli?: AcpCliStatus;
	/**
	 * System-level prerequisites (Node.js, Python, uv) required for most
	 * tool installs. Optional so older fixtures remain valid.
	 */
	prerequisites?: Record<SystemPrerequisiteKey, SystemPrerequisiteStatus>;
	lastChecked: number;
}

export type InstallableDependency =
	| "copilot-chat"
	| "speckit"
	| "openspec"
	| "copilot-cli"
	| "gatomia-cli"
	| "devin-cli"
	| "gemini-cli";

export type InstallStatus = "started" | "running" | "finished" | "error";

export interface InstallProgressData {
	stepId: string;
	status: InstallStatus;
	message?: string;
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
	ideHost: IdeHost;
	dependencies: DependencyStatus;
	configuration: ConfigurationState;
	diagnostics: SystemDiagnostic[];
	learningResources: LearningResource[];
	featureActions: FeatureAction[];
	extensionVersion?: string;
	vscodeVersion?: string;
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
	copilotCli: DependencyStatus["copilotCli"];
	gatomiaCli: DependencyStatus["gatomiaCli"];
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
	ideHost: IdeHost;
	isInstallingAll?: boolean;
	onInstallDependency: (dependency: InstallableDependency) => void;
	onInstallMissing: (dependencies: InstallableDependency[]) => void;
	onInstallPrerequisite: (prerequisite: SystemPrerequisiteKey) => void;
	onRefreshDependencies: () => void;
	onNavigateNext: () => void;
	isRefreshing?: boolean;
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
	ideHost: IdeHost;
	dependencies: DependencyStatus;
	diagnostics: SystemDiagnostic[];
	onInstallDependency: (dependency: InstallableDependency) => void;
	onInstallPrerequisite?: (prerequisite: SystemPrerequisiteKey) => void;
	onOpenExternal?: (url: string) => void;
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
