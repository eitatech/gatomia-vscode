import type { Disposable, Webview, WebviewPanel } from "vscode";
import {
	ViewColumn,
	window,
	type ExtensionContext,
	type OutputChannel,
} from "vscode";
import { getWebviewContent } from "../utils/get-webview-content";
import type {
	DocumentArtifact,
	FormSubmissionPayload,
	PreviewPanelMessage,
	PreviewWebviewMessage,
	RefinementRequestPayload,
} from "../types/preview";

interface DocumentPreviewPanelOptions {
	onReloadRequested?: () => Promise<void> | void;
	onEditAttempt?: (reason?: string) => void;
	onOpenInEditor?: () => Promise<void> | void;
	onFormSubmit?: (payload: FormSubmissionPayload) => Promise<{
		status?: "success" | "error";
		message?: string;
	} | void> | void;
	onRefineSubmit?: (payload: RefinementRequestPayload) => Promise<{
		status?: "success" | "error";
		message?: string;
	} | void> | void;
	onExecuteTaskGroup?: (groupName: string) => Promise<void> | void;
	onOpenFile?: (filePath: string) => Promise<void> | void;
}

/**
 * Handles lifecycle and messaging for the document preview webview panel.
 * This scaffold ensures that later tasks can focus on data wiring instead of boilerplate.
 */
export class DocumentPreviewPanel {
	static readonly panelType = "gatomia.documentPreview";

	private panel: WebviewPanel | undefined;
	private isWebviewReady = false;
	private pendingMessages: PreviewPanelMessage[] = [];
	private disposables: Disposable[] = [];
	private lastArtifact?: DocumentArtifact;
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private readonly options: DocumentPreviewPanelOptions;

	constructor(
		context: ExtensionContext,
		outputChannel: OutputChannel,
		options: DocumentPreviewPanelOptions = {}
	) {
		this.context = context;
		this.outputChannel = outputChannel;
		this.options = options;
	}

	async renderDocument(artifact: DocumentArtifact): Promise<void> {
		this.lastArtifact = artifact;
		const panel = this.ensurePanel();
		panel.reveal(ViewColumn.Beside, true);
		await this.postMessage({
			type: "preview/load-document",
			payload: artifact,
		});
	}

	async markDocumentStale(reason?: string): Promise<void> {
		await this.postMessage({
			type: "preview/show-placeholder",
			payload: { reason },
		});
	}

	dispose(): void {
		this.disposePanel();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
	}

	private ensurePanel(): WebviewPanel {
		if (this.panel) {
			return this.panel;
		}

		const panel = window.createWebviewPanel(
			DocumentPreviewPanel.panelType,
			"Document Preview",
			{
				viewColumn: ViewColumn.Beside,
				preserveFocus: true,
			},
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.context.extensionUri],
			}
		);

		panel.webview.html = this.getHtml(panel.webview);
		panel.webview.onDidReceiveMessage(
			async (message: PreviewWebviewMessage) => {
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

	private disposePanel(): void {
		if (this.panel) {
			this.panel.dispose();
			this.panel = undefined;
		}
		this.isWebviewReady = false;
		this.pendingMessages = [];
	}

	private getHtml(webview: Webview): string {
		return getWebviewContent(
			webview,
			this.context.extensionUri,
			"document-preview"
		);
	}

	private async handleWebviewMessage(
		message: PreviewWebviewMessage
	): Promise<void> {
		this.outputChannel.appendLine(
			`[DocumentPreviewPanel] Received message: ${message?.type ?? "undefined"}`
		);
		switch (message?.type) {
			case "preview/ready":
				this.outputChannel.appendLine(
					`[DocumentPreviewPanel] Webview ready, lastArtifact: ${this.lastArtifact ? "present" : "null"}`
				);
				this.isWebviewReady = true;
				await this.flushPendingMessages();
				if (this.lastArtifact) {
					await this.postMessage({
						type: "preview/load-document",
						payload: this.lastArtifact,
					});
				}
				return;
			case "preview/request-reload":
				await this.options.onReloadRequested?.();
				return;
			case "preview/edit-attempt":
				this.options.onEditAttempt?.(message.payload?.reason);
				window.showWarningMessage(
					"Document preview is read-only. Use the editor to modify the source."
				);
				return;
			case "preview/open-in-editor":
				await this.options.onOpenInEditor?.();
				return;
			case "preview/forms/submit":
				await this.handleFormSubmission(message.payload);
				return;
			case "preview/refine/submit":
				await this.handleRefineSubmission(message.payload);
				return;
			case "preview/execute-task-group":
				await this.handleExecuteTaskGroup(message.payload);
				return;
			case "preview/open-file":
				await this.options.onOpenFile?.(message.payload?.filePath);
				return;
			default:
				this.outputChannel.appendLine(
					`[DocumentPreviewPanel] Unknown message received: ${message?.type ?? "undefined"}`
				);
		}
	}

	private async postMessage(message: PreviewPanelMessage): Promise<void> {
		this.outputChannel.appendLine(
			`[DocumentPreviewPanel] Posting message: ${message.type}, ready: ${this.isWebviewReady}, hasPanel: ${!!this.panel?.webview}`
		);
		if (!this.panel?.webview) {
			this.outputChannel.appendLine(
				"[DocumentPreviewPanel] No panel webview, queueing message"
			);
			this.pendingMessages.push(message);
			return;
		}

		if (!this.isWebviewReady) {
			this.outputChannel.appendLine(
				"[DocumentPreviewPanel] Webview not ready, queueing message"
			);
			this.pendingMessages.push(message);
			return;
		}

		try {
			await this.panel.webview.postMessage(message);
			this.outputChannel.appendLine(
				`[DocumentPreviewPanel] Message sent successfully: ${message.type}`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[DocumentPreviewPanel] Failed to post message ${message.type}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	private async flushPendingMessages(): Promise<void> {
		if (!(this.panel && this.isWebviewReady)) {
			return;
		}

		const queue = [...this.pendingMessages];
		this.pendingMessages = [];

		for (const message of queue) {
			await this.postMessage(message);
		}
	}

	private async handleFormSubmission(
		payload: FormSubmissionPayload | undefined
	): Promise<void> {
		if (!payload?.requestId) {
			return;
		}

		try {
			const result = await this.options.onFormSubmit?.(payload);
			await this.postMessage({
				type: "preview/forms/result",
				payload: {
					requestId: payload.requestId,
					status: result?.status ?? "success",
					message: result?.message,
				},
			});
		} catch (error) {
			await this.postMessage({
				type: "preview/forms/result",
				payload: {
					requestId: payload.requestId,
					status: "error",
					message:
						error instanceof Error
							? error.message
							: "Failed to save form changes",
				},
			});
		}
	}

	private async handleRefineSubmission(
		payload: RefinementRequestPayload | undefined
	): Promise<void> {
		if (!payload?.requestId) {
			return;
		}

		try {
			const result = await this.options.onRefineSubmit?.(payload);
			await this.postMessage({
				type: "preview/refine/result",
				payload: {
					requestId: payload.requestId,
					status: result?.status ?? "success",
					message: result?.message,
				},
			});
		} catch (error) {
			await this.postMessage({
				type: "preview/refine/result",
				payload: {
					requestId: payload.requestId,
					status: "error",
					message:
						error instanceof Error
							? error.message
							: "Failed to submit refinement request",
				},
			});
		}
	}

	private async handleExecuteTaskGroup(
		payload: { groupName: string } | undefined
	): Promise<void> {
		if (!payload?.groupName) {
			return;
		}

		try {
			await this.options.onExecuteTaskGroup?.(payload.groupName);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to execute task group";
			this.outputChannel.appendLine(
				`[DocumentPreviewPanel] Error executing task group: ${message}`
			);
			window.showErrorMessage(`Failed to execute task group: ${message}`);
		}
	}
}
