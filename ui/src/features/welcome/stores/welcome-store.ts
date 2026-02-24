/**
 * Welcome Screen State Management
 * Zustand store for webview state with VS Code message bridge integration
 */

import { create } from "zustand";
import type {
	WelcomeStore,
	WelcomeScreenState,
	ConfigurationState,
	DependencyStatus,
	SystemDiagnostic,
	ViewSection,
	WelcomeErrorData,
	WelcomeInitData,
} from "../types";

const initialState: WelcomeScreenState = {
	hasShownBefore: false,
	dontShowOnStartup: false,
	currentView: "setup",
	dependencies: {
		copilotChat: { installed: false, active: false, version: null },
		speckit: { installed: false, version: null },
		openspec: { installed: false, version: null },
		copilotCli: { installed: false, version: null },
		gatomiaCli: { installed: false, version: null },
		lastChecked: Date.now(),
	},
	configuration: {
		specSystem: {
			key: "gatomia.specSystem",
			label: "Spec System",
			currentValue: "auto",
			options: ["auto", "speckit", "openspec"],
			editable: true,
		},
		speckitSpecsPath: {
			key: "gatomia.speckit.specsPath",
			label: "SpecKit Specs Path",
			currentValue: "specs",
			editable: true,
		},
		speckitMemoryPath: {
			key: "gatomia.speckit.memoryPath",
			label: "SpecKit Memory Path",
			currentValue: ".specify/memory",
			editable: true,
		},
		speckitTemplatesPath: {
			key: "gatomia.speckit.templatesPath",
			label: "SpecKit Templates Path",
			currentValue: ".specify/templates",
			editable: true,
		},
		openspecPath: {
			key: "gatomia.openspec.path",
			label: "OpenSpec Path",
			currentValue: ".openspec",
			editable: true,
		},
		promptsPath: {
			key: "gatomia.prompts.path",
			label: "Prompts Path",
			currentValue: ".prompts",
			editable: true,
		},
		otherSettings: [],
	},
	diagnostics: [],
	learningResources: [],
	featureActions: [],
};

export const useWelcomeStore = create<WelcomeStore>((set, get) => ({
	state: initialState,
	loading: false,
	error: null,
	extensionVersion: "0.0.0",
	vscodeVersion: "0.0.0",

	// State management
	setState: (newState: WelcomeScreenState) => {
		set({ state: newState, loading: false });
	},

	updateConfig: (key: string, value: string | boolean) => {
		set((store) => {
			if (!store.state) {
				return {};
			}

			const config = { ...store.state.configuration };

			// Find and update the specific configuration item
			for (const k of Object.keys(config) as Array<keyof ConfigurationState>) {
				const item = config[k];
				if (
					item &&
					typeof item === "object" &&
					"key" in item &&
					item.key === key
				) {
					// @ts-expect-error - Complex type narrowing
					config[k] = { ...item, currentValue: value };
					break;
				}
			}

			return {
				state: {
					...store.state,
					configuration: config,
				},
			};
		});
	},

	updateDependencies: (dependencies: DependencyStatus) => {
		set((store) => ({
			state: store.state
				? {
						...store.state,
						dependencies,
					}
				: null,
		}));
	},

	addDiagnostic: (diagnostic: SystemDiagnostic) => {
		set((store) => ({
			state: store.state
				? {
						...store.state,
						diagnostics: [diagnostic, ...store.state.diagnostics].slice(0, 5), // Keep last 5
					}
				: null,
		}));
	},

	setCurrentView: (view: ViewSection) => {
		set((store) => ({
			state: store.state ? { ...store.state, currentView: view } : null,
		}));
	},

	setDontShowOnStartup: (value: boolean) => {
		set((store) => ({
			state: store.state ? { ...store.state, dontShowOnStartup: value } : null,
		}));
	},

	setError: (error: WelcomeErrorData | null) => {
		set({ error, loading: false });
	},

	setLoading: (loading: boolean) => {
		set({ loading });
	},

	initialize: (initData: WelcomeInitData) => {
		set({
			loading: true,
			error: null,
			extensionVersion: initData.extensionVersion,
			vscodeVersion: initData.vscodeVersion,
		});
		// Loading state will be set to false when welcome/state message arrives
	},

	reset: () => {
		set({ state: initialState, loading: false, error: null });
	},
}));
