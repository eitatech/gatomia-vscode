// VSCode configuration namespace for this extension
export const VSC_CONFIG_NAMESPACE = "spec-ui-for-copilot";

// Default configuration for OpenSpec (legacy support)
export const DEFAULT_CONFIG = {
	paths: {
		prompts: ".github/prompts",
		specs: "openspec",
	},
	views: {
		specs: true,
		steering: true,
		prompts: true,
		settings: false,
	},
	chatLanguage: "English",
} as const;

// Spec-Kit configuration
export const SPECKIT_CONFIG = {
	paths: {
		specs: "specs",
		memory: ".specify/memory",
		templates: ".specify/templates",
		scripts: ".specify/scripts",
		commands: ".specify/commands",
	},
	views: {
		specs: true,
		steering: true,
		prompts: true,
		settings: false,
	},
	chatLanguage: "English",
} as const;

// System modes for spec management
export const SPEC_SYSTEM_MODE = {
	AUTO: "auto",
	OPENSPEC: "openspec",
	SPECKIT: "speckit",
} as const;

export type SpecSystemMode =
	(typeof SPEC_SYSTEM_MODE)[keyof typeof SPEC_SYSTEM_MODE];

// Legacy exports for backward compatibility (can be removed after updating all references)
export const DEFAULT_PATHS = DEFAULT_CONFIG.paths;
export const DEFAULT_VIEW_VISIBILITY = DEFAULT_CONFIG.views;
