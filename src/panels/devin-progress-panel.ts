/**
 * Devin Progress Panel Webview
 *
 * Manages the webview panel that displays Devin session progress.
 * Communicates with the React-based UI via postMessage.
 *
 * @see specs/001-devin-integration/plan.md:L74
 */

import type { Disposable, WebviewPanel } from "vscode";
import { ViewColumn, window, type ExtensionContext } from "vscode";
import { getWebviewContent } from "../utils/get-webview-content";
import type { DevinSessionManager } from "../features/devin/devin-session-manager";
import type { DevinPollingService } from "../features/devin/devin-polling-service";
import type { DevinSessionStorage } from "../features/devin/devin-session-storage";
import {
	handleDevinWebviewMessage,
	type DevinWebviewMessage,
} from "./devin-message-handler";

// ============================================================================
// Panel
// ============================================================================

/**
 * Manages the Devin progress webview panel lifecycle.
 */
export class DevinProgressPanel {
	static readonly panelType = "gatomia.devinProgress";

	private panel: WebviewPanel | undefined;
	private disposables: Disposable[] = [];
	private readonly context: ExtensionContext;
	private readonly storage: DevinSessionStorage;
	private readonly sessionManager: DevinSessionManager;
	private readonly pollingService: DevinPollingService;

	constructor(
		context: ExtensionContext,
		storage: DevinSessionStorage,
		sessionManager: DevinSessionManager,
		pollingService: DevinPollingService
	) {
		this.context = context;
		this.storage = storage;
		this.sessionManager = sessionManager;
		this.pollingService = pollingService;
	}

	/**
	 * Show the progress panel (creates it if not already open).
	 */
	show(): void {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Beside);
			this.sendSessionData();
			return;
		}

		this.panel = window.createWebviewPanel(
			DevinProgressPanel.panelType,
			"Devin Progress",
			ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.context.extensionUri],
			}
		);

		this.panel.webview.html = getWebviewContent(
			this.panel.webview,
			this.context.extensionUri,
			"devin-progress"
		);

		this.panel.webview.onDidReceiveMessage(
			(message: DevinWebviewMessage) => {
				handleDevinWebviewMessage(
					message,
					this.sessionManager,
					this.pollingService
				).catch(() => {
					// Swallow message handling errors
				});
			},
			undefined,
			this.disposables
		);

		this.panel.onDidDispose(
			() => {
				this.panel = undefined;
				for (const d of this.disposables) {
					d.dispose();
				}
				this.disposables = [];
			},
			undefined,
			this.disposables
		);

		this.sendSessionData();
	}

	/**
	 * Send current session data to the webview.
	 */
	sendSessionData(): void {
		if (!this.panel) {
			return;
		}

		const sessions = this.storage.getAll();
		this.panel.webview.postMessage({
			type: "session-update",
			payload: { sessions },
		});
	}

	/**
	 * Dispose the panel and clean up resources.
	 */
	dispose(): void {
		this.panel?.dispose();
	}
}
