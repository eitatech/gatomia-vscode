/**
 * WelcomeScreenPanel
 * Handles lifecycle and messaging for the welcome screen webview panel
 * Based on DocumentPreviewPanel pattern from src/panels/document-preview-panel.ts
 */

import type { Disposable, Webview, WebviewPanel } from "vscode";
import {
	Uri,
	ViewColumn,
	window,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import { getWebviewContent } from "../utils/get-webview-content";
import type {
	ExtensionToWebviewMessage,
	WebviewToExtensionMessage,
} from "../types/welcome";

export interface WelcomeScreenPanelCallbacks {
	onReady?: () => Promise<void> | void;
	onExecuteCommand?: (
		commandId: string,
		panel: WelcomeScreenPanel,
		args?: unknown[]
	) => Promise<void> | void;
	onUpdateConfig?: (
		key: string,
		value: string | boolean
	) => Promise<void> | void;
	onInstallDependency?: (
		dependency: "copilot-chat" | "speckit" | "openspec"
	) => Promise<void> | void;
	onRefreshDependencies?: () => Promise<void> | void;
	onUpdatePreference?: (
		preference: "dontShowOnStartup",
		value: boolean
	) => Promise<void> | void;
	onOpenExternal?: (url: string) => Promise<void> | void;
	onNavigateSection?: (section: string) => Promise<void> | void;
	onSearchResources?: (query: string) => Promise<void> | void;
	setPanel?: (panel: WelcomeScreenPanel) => void;
}

/**
 * Manages the welcome screen webview panel lifecycle and message passing
 */
export class WelcomeScreenPanel {
	static readonly panelType = "gatomia.welcomeScreen";
	private static currentPanel: WelcomeScreenPanel | undefined;

	private panel: WebviewPanel | undefined;
	private isWebviewReady = false;
	private pendingMessages: ExtensionToWebviewMessage[] = [];
	private disposables: Disposable[] = [];
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private readonly callbacks: WelcomeScreenPanelCallbacks;

	private constructor(
		context: ExtensionContext,
		outputChannel: OutputChannel,
		callbacks: WelcomeScreenPanelCallbacks = {}
	) {
		this.context = context;
		this.outputChannel = outputChannel;
		this.callbacks = callbacks;
	}

	/**
	 * Show or focus the welcome screen panel (singleton pattern)
	 * Implements FR-017: Prevent opening multiple instances
	 */
	static show(
		context: ExtensionContext,
		outputChannel: OutputChannel,
		callbacks: WelcomeScreenPanelCallbacks = {}
	): WelcomeScreenPanel {
		// If panel already exists, reveal it
		if (WelcomeScreenPanel.currentPanel) {
			WelcomeScreenPanel.currentPanel.panel?.reveal(ViewColumn.One);
			return WelcomeScreenPanel.currentPanel;
		}

		// Create new panel
		const panel = new WelcomeScreenPanel(context, outputChannel, callbacks);
		WelcomeScreenPanel.currentPanel = panel;
		panel.ensurePanel();
		return panel;
	}

	/**
	 * Post message to webview
	 */
	async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
		this.outputChannel.appendLine(
			`[WelcomeScreenPanel] Posting message: ${message.type}, ready: ${this.isWebviewReady}, hasPanel: ${!!this.panel?.webview}`
		);

		if (!this.panel?.webview) {
			this.outputChannel.appendLine(
				"[WelcomeScreenPanel] No panel webview, queueing message"
			);
			this.pendingMessages.push(message);
			return;
		}

		if (!this.isWebviewReady) {
			this.outputChannel.appendLine(
				"[WelcomeScreenPanel] Webview not ready, queueing message"
			);
			this.pendingMessages.push(message);
			return;
		}

		const success = await this.panel.webview.postMessage(message);
		if (!success) {
			this.outputChannel.appendLine(
				"[WelcomeScreenPanel] Failed to post message"
			);
		}
	}

	/**
	 * Dispose panel and cleanup resources
	 */
	dispose(): void {
		this.disposePanel();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
		WelcomeScreenPanel.currentPanel = undefined;
	}

	/**
	 * Check if panel is currently visible
	 */
	isVisible(): boolean {
		return this.panel?.visible ?? false;
	}

	/**
	 * Ensure panel exists and return it (singleton within instance)
	 */
	private ensurePanel(): WebviewPanel {
		if (this.panel) {
			return this.panel;
		}

		const panel = window.createWebviewPanel(
			WelcomeScreenPanel.panelType,
			"GatomIA Welcome",
			{
				viewColumn: ViewColumn.One,
				preserveFocus: false,
			},
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.context.extensionUri],
			}
		);

		panel.iconPath = {
			light: Uri.joinPath(
				this.context.extensionUri,
				"assets",
				"icons",
				"logo-light.svg"
			),
			dark: Uri.joinPath(
				this.context.extensionUri,
				"assets",
				"icons",
				"logo-dark.svg"
			),
		};

		panel.webview.html = this.getHtml(panel.webview);

		panel.webview.onDidReceiveMessage(
			async (message: WebviewToExtensionMessage) => {
				await this.handleWebviewMessage(message);
			},
			undefined,
			this.disposables
		);

		panel.onDidDispose(() => this.disposePanel(), undefined, this.disposables);

		this.panel = panel;
		this.isWebviewReady = false;

		return panel;
	}

	/**
	 * Dispose panel and reset state
	 */
	private disposePanel(): void {
		if (this.panel) {
			this.panel.dispose();
			this.panel = undefined;
		}
		this.isWebviewReady = false;
		this.pendingMessages = [];
		WelcomeScreenPanel.currentPanel = undefined;
	}

	/**
	 * Get HTML content for webview
	 * Uses getWebviewContent utility for consistent webview setup
	 */
	private getHtml(webview: Webview): string {
		return getWebviewContent(
			webview,
			this.context.extensionUri,
			"welcome-screen"
		);
	}

	/**
	 * Handle messages received from webview
	 */
	private async handleWebviewMessage(
		message: WebviewToExtensionMessage
	): Promise<void> {
		this.outputChannel.appendLine(
			`[WelcomeScreenPanel] Received message: ${message?.type ?? "undefined"}`
		);

		switch (message?.type) {
			case "welcome/ready":
				this.outputChannel.appendLine("[WelcomeScreenPanel] Webview ready");
				this.isWebviewReady = true;
				await this.flushPendingMessages();
				await this.callbacks.onReady?.();
				return;

			case "welcome/execute-command":
				await this.callbacks.onExecuteCommand?.(
					message.commandId,
					this,
					message.args
				);
				return;

			case "welcome/update-config":
				await this.callbacks.onUpdateConfig?.(message.key, message.value);
				return;

			case "welcome/install-dependency":
				await this.callbacks.onInstallDependency?.(message.dependency);
				return;

			case "welcome/refresh-dependencies":
				await this.callbacks.onRefreshDependencies?.();
				return;

			case "welcome/update-preference":
				await this.callbacks.onUpdatePreference?.(
					message.preference,
					message.value
				);
				return;

			case "welcome/open-external":
				await this.callbacks.onOpenExternal?.(message.url);
				return;

			case "welcome/navigate-section":
				await this.callbacks.onNavigateSection?.(message.section);
				return;

			case "welcome/search-resources":
				await this.callbacks.onSearchResources?.(message.query);
				return;

			default:
				this.outputChannel.appendLine(
					`[WelcomeScreenPanel] Unknown message type: ${(message as any)?.type ?? "undefined"}`
				);
		}
	}

	/**
	 * Flush pending messages after webview becomes ready
	 */
	private async flushPendingMessages(): Promise<void> {
		if (this.pendingMessages.length === 0) {
			return;
		}

		this.outputChannel.appendLine(
			`[WelcomeScreenPanel] Flushing ${this.pendingMessages.length} pending messages`
		);

		const messages = [...this.pendingMessages];
		this.pendingMessages = [];

		for (const message of messages) {
			if (this.panel?.webview) {
				await this.panel.webview.postMessage(message);
			}
		}
	}
}
