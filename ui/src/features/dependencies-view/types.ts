/**
 * Types for Dependencies View messages
 */

export interface DependencyStatus {
	name: string;
	installed: boolean;
	version?: string;
	error?: string;
	command: string;
}

export interface InstallationStep {
	id: string;
	title: string;
	description: string;
	command: string;
	platform?: "darwin" | "linux" | "win32" | "all";
}

/**
 * Messages from webview to extension
 */
export type DependenciesWebviewMessage =
	| { type: "dependencies/ready" }
	| { type: "dependencies/check" }
	| { type: "dependencies/check-one"; payload: { name: string } }
	| { type: "dependencies/copy"; payload: { command: string } }
	| { type: "dependencies/paste"; payload: { command: string } }
	| { type: "dependencies/execute"; payload: { command: string } };

/**
 * Messages from extension to webview
 */
export type DependenciesExtensionMessage =
	| {
			type: "dependencies/status";
			payload: {
				dependencies: DependencyStatus[];
				steps: InstallationStep[];
			};
	  }
	| { type: "dependencies/updated"; payload: DependencyStatus }
	| { type: "dependencies/checking"; payload: { name?: string } }
	| { type: "dependencies/error"; payload: { message: string } }
	| {
			type: "dependencies/action-result";
			payload: { action: string; success: boolean; message?: string };
	  };
