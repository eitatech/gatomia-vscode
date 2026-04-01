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
	type Disposable,
	type ExtensionContext,
	ViewColumn,
	type WebviewPanel,
	window,
} from "vscode";
import type { AgentSessionStorage } from "../features/cloud-agents/agent-session-storage";
import { logInfo } from "../features/cloud-agents/logging";
import type { ProviderRegistry } from "../features/cloud-agents/provider-registry";
import type { AgentSession } from "../features/cloud-agents/types";
import { getWebviewContent } from "../utils/get-webview-content";

// ============================================================================
// CloudAgentProgressPanel
// ============================================================================

/**
 * Webview panel for Cloud Agent session progress display.
 * Renders sessions via the shared webview React app and
 * communicates through the VS Code postMessage bridge.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */
export class CloudAgentProgressPanel {
	static readonly viewType = "gatomia.cloudAgentProgress";
	private panel: WebviewPanel | undefined;
	private disposables: Disposable[] = [];
	private readonly context: ExtensionContext;
	private readonly registry: ProviderRegistry;
	private readonly sessionStorage: AgentSessionStorage;

	constructor(
		context: ExtensionContext,
		registry: ProviderRegistry,
		sessionStorage: AgentSessionStorage
	) {
		this.context = context;
		this.registry = registry;
		this.sessionStorage = sessionStorage;
	}

	/**
	 * Show or create the webview panel.
	 */
	show(): void {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Beside);
			this.sendSessionData();
			return;
		}

		this.panel = window.createWebviewPanel(
			CloudAgentProgressPanel.viewType,
			"Cloud Agent Progress",
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
			"cloud-agent-progress"
		);

		this.panel.webview.onDidReceiveMessage(
			(message: { type: string; payload?: Record<string, unknown> }) => {
				this.handleMessage(message);
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
		logInfo("Cloud Agent progress panel opened");
	}

	/**
	 * Push fresh session data to the webview.
	 */
	async sendSessionData(): Promise<void> {
		if (!this.panel) {
			return;
		}

		const active = this.registry.getActive();
		const sessions = await this.sessionStorage.getAll();

		const sessionViews = sessions.map((s: AgentSession) => ({
			localId: s.localId,
			providerId: s.providerId,
			status: s.status,
			displayStatus: active ? active.getStatusDisplay(s) : s.status,
			branch: s.branch,
			specPath: s.specPath,
			externalUrl: s.externalUrl,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
			isReadOnly: s.isReadOnly,
			tasks: s.tasks.map((t) => ({
				taskId: t.id,
				specTaskId: t.specTaskId,
				title: t.title,
				priority: t.priority,
				status: t.status,
			})),
			pullRequests: s.pullRequests.map((pr) => ({
				url: pr.url,
				state: pr.state ?? "open",
				branch: pr.branch,
			})),
		}));

		this.panel.webview.postMessage({
			type: "session-update",
			payload: {
				sessions: sessionViews,
				activeProvider: active
					? { id: active.metadata.id, displayName: active.metadata.displayName }
					: null,
			},
		});
	}

	/**
	 * Dispose the panel.
	 */
	dispose(): void {
		this.panel?.dispose();
		this.panel = undefined;
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables = [];
	}

	private handleMessage(message: {
		type: string;
		payload?: Record<string, unknown>;
	}): void {
		switch (message.type) {
			case "refresh-status":
				this.sendSessionData();
				break;
			case "open-external": {
				const url = message.payload?.url;
				if (typeof url === "string") {
					import("vscode").then(({ env, Uri }) => {
						env.openExternal(Uri.parse(url));
					});
				}
				break;
			}
			default:
				break;
		}
	}
}
