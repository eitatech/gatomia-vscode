/**
 * Cloud Agent Progress Panel
 *
 * Provider-agnostic webview panel for rich session progress UI.
 * Replaces the Devin-specific progress panel.
 *
 * @see specs/016-multi-provider-agents/plan.md
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import {
	type ExtensionContext,
	ViewColumn,
	type WebviewPanel,
	window,
} from "vscode";
import { logInfo } from "../features/cloud-agents/logging";

// ============================================================================
// CloudAgentProgressPanel
// ============================================================================

/**
 * Webview panel for Cloud Agent session progress display.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */
export class CloudAgentProgressPanel {
	static readonly viewType = "gatomia.cloudAgentProgress";
	private panel: WebviewPanel | undefined;
	private readonly context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this.context = context;
	}

	/**
	 * Show or create the webview panel.
	 */
	show(): void {
		if (this.panel) {
			this.panel.reveal();
			return;
		}

		this.panel = window.createWebviewPanel(
			CloudAgentProgressPanel.viewType,
			"Cloud Agent Progress",
			ViewColumn.Beside,
			{ enableScripts: true, retainContextWhenHidden: true }
		);

		this.panel.onDidDispose(() => {
			this.panel = undefined;
		});

		logInfo("Cloud Agent progress panel opened");
	}

	/**
	 * Send a message to the webview.
	 */
	postMessage(message: unknown): void {
		this.panel?.webview.postMessage(message);
	}

	/**
	 * Register a handler for messages from the webview.
	 */
	onDidReceiveMessage(handler: (message: unknown) => void): void {
		this.panel?.webview.onDidReceiveMessage(handler);
	}

	/**
	 * Dispose the panel.
	 */
	dispose(): void {
		this.panel?.dispose();
		this.panel = undefined;
	}
}
