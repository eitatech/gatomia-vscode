import {
	commands,
	env,
	type CancellationToken,
	type Disposable,
	type ExtensionContext,
	type WebviewView,
	type WebviewViewProvider,
	type WebviewViewResolveContext,
	Uri,
} from "vscode";
import {
	AGENT_CHAT_TELEMETRY_EVENTS,
	logTelemetry,
} from "../features/agent-chat/telemetry";
import type {
	OrchestrationReadModel,
	OrchestrationSessionProjection,
} from "../features/orchestration/orchestration-read-model";
import { getWebviewContent } from "../utils/get-webview-content";

interface OrchestrationViewProviderOptions {
	readonly context: ExtensionContext;
	readonly readModel: OrchestrationReadModel;
	readonly outputChannel?: { appendLine(value: string): void };
}

export class OrchestrationViewProvider implements WebviewViewProvider {
	static readonly viewType = "gatomia.views.orchestration";

	private readonly context: ExtensionContext;
	private readonly readModel: OrchestrationReadModel;
	private readonly outputChannel?: { appendLine(value: string): void };
	private readonly disposables: Disposable[] = [];
	private view: WebviewView | undefined;

	constructor(options: OrchestrationViewProviderOptions) {
		this.context = options.context;
		this.readModel = options.readModel;
		this.outputChannel = options.outputChannel;

		this.disposables.push(
			this.readModel.onDidChange(() => {
				this.pushSnapshot().catch((error) => {
					this.outputChannel?.appendLine(
						`[Orchestration] snapshot push failed: ${formatError(error)}`
					);
				});
			})
		);
	}

	resolveWebviewView(
		webviewView: WebviewView,
		_context: WebviewViewResolveContext,
		_token: CancellationToken
	): void {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		webviewView.webview.html = getWebviewContent(
			webviewView.webview,
			this.context.extensionUri,
			"orchestration"
		);

		this.disposables.push(
			webviewView.webview.onDidReceiveMessage((message) => {
				this.handleWebviewMessage(message).catch((error) => {
					this.outputChannel?.appendLine(
						`[Orchestration] message handling failed: ${formatError(error)}`
					);
				});
			})
		);

		this.pushSnapshot().catch((error) => {
			this.outputChannel?.appendLine(
				`[Orchestration] initial snapshot failed: ${formatError(error)}`
			);
		});
	}

	async reveal(): Promise<void> {
		await commands.executeCommand(
			`${OrchestrationViewProvider.viewType}.focus`
		);
		this.view?.show?.(true);
	}

	refresh(): void {
		this.pushSnapshot().catch((error) => {
			this.outputChannel?.appendLine(
				`[Orchestration] refresh failed: ${formatError(error)}`
			);
		});
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			try {
				disposable.dispose();
			} catch {
				// best-effort
			}
		}
		this.disposables.length = 0;
	}

	private async handleWebviewMessage(raw: unknown): Promise<void> {
		const message = raw as { type?: string; payload?: unknown };
		if (!message?.type) {
			return;
		}

		switch (message.type) {
			case "orchestration/ready":
				await this.pushSnapshot();
				return;
			case "orchestration/refresh":
				await this.focusTreeView("gatomia.views.cloudAgents").catch(() => {
					// best-effort
				});
				await commands
					.executeCommand("gatomia.refreshCloudAgents")
					.catch(() => {
						// best-effort
					});
				await this.pushSnapshot();
				return;
			case "orchestration/open-session": {
				const sessionId = (
					message.payload as { sessionId?: string } | undefined
				)?.sessionId;
				if (!sessionId) {
					return;
				}
				const snapshot = await this.readModel.snapshot();
				const session = snapshot.sessions.find(
					(entry) => entry.id === sessionId
				);
				if (session) {
					await this.openSession(session);
				}
				return;
			}
			case "orchestration/open-existing-surface": {
				const source = (message.payload as { source?: string } | undefined)
					?.source;
				if (source === "cloud-agent") {
					await this.focusTreeView("gatomia.views.cloudAgents").catch(() => {
						// best-effort
					});
					await commands.executeCommand("gatomia.refreshCloudAgents");
					return;
				}
				await this.focusTreeView("gatomia.views.runningAgents").catch(() => {
					// best-effort
				});
				await commands.executeCommand("gatomia.agentChat.openPanel");
				return;
			}
			case "orchestration/open-external": {
				const url = (message.payload as { url?: string } | undefined)?.url;
				if (url) {
					await env.openExternal(Uri.parse(url));
				}
				return;
			}
			default:
				return;
		}
	}

	private async pushSnapshot(): Promise<void> {
		if (!this.view) {
			return;
		}
		const snapshot = await this.readModel.snapshot();
		await this.view.webview.postMessage({
			type: "orchestration/snapshot",
			payload: snapshot,
		});
	}

	private async openSession(
		session: OrchestrationSessionProjection
	): Promise<void> {
		logTelemetry(AGENT_CHAT_TELEMETRY_EVENTS.PANEL_OPENED, {
			sessionId: session.sourceSessionId,
			source: session.source,
			surface: "orchestration",
		});

		if (session.openSessionCommand.kind === "agent-chat") {
			await commands.executeCommand(
				"gatomia.agentChat.openForSession",
				session.openSessionCommand.sessionId
			);
			return;
		}

		if (session.externalUrl) {
			await env.openExternal(Uri.parse(session.externalUrl));
			return;
		}

		await commands.executeCommand("gatomia.refreshCloudAgents");
	}

	private async focusTreeView(viewId: string): Promise<void> {
		await commands.executeCommand(`${viewId}.focus`);
	}
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
