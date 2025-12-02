import {
	type ExtensionContext,
	type MessageItem,
	type OutputChannel,
	Uri,
	ViewColumn,
	type WebviewPanel,
	window,
	workspace,
} from "vscode";
import type { PromptLoader } from "../../services/prompt-loader";
import type { ConfigManager } from "../../utils/config-manager";
import { getWebviewContent } from "../../utils/get-webview-content";
import type {
	CreateSpecDraftState,
	CreateSpecFormData,
	CreateSpecWebviewMessage,
	CreateSpecExtensionMessage,
} from "./types";
import { SpecSubmissionStrategyFactory } from "./spec-submission-strategy";
import type { SpecSystemMode } from "../../constants";

interface CreateSpecInputControllerDependencies {
	context: ExtensionContext;
	configManager: ConfigManager;
	promptLoader: PromptLoader;
	outputChannel: OutputChannel;
	activeSystem: SpecSystemMode;
}

const CREATE_SPEC_DRAFT_STATE_KEY = "createSpecDraftState";

const isMessageItem = (value: unknown): value is MessageItem => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as { title?: unknown };
	return typeof candidate.title === "string";
};

const normalizeFormData = (data: CreateSpecFormData): CreateSpecFormData => ({
	productContext: data.productContext ?? "",
	keyScenarios: data.keyScenarios ?? "",
	technicalConstraints: data.technicalConstraints ?? "",
	relatedFiles: data.relatedFiles ?? "",
	openQuestions: data.openQuestions ?? "",
});

export class CreateSpecInputController {
	private readonly context: ExtensionContext;
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly outputChannel: OutputChannel;
	private readonly activeSystem: SpecSystemMode;
	private draft: CreateSpecDraftState | undefined;
	private panel: WebviewPanel | undefined;

	constructor({
		context,
		configManager,
		promptLoader,
		outputChannel,
		activeSystem,
	}: CreateSpecInputControllerDependencies) {
		this.context = context;
		this.configManager = configManager;
		this.promptLoader = promptLoader;
		this.outputChannel = outputChannel;
		this.activeSystem = activeSystem;
	}

	async open(): Promise<void> {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Active, false);
			await this.postFocusMessage();
			return;
		}

		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		this.draft = this.getDraftState();

		this.panel = this.createPanel();
		if (!this.panel) {
			window.showErrorMessage("Unable to open Create Spec dialog");
			return;
		}

		this.registerPanelListeners(this.panel);
		this.panel.webview.html = getWebviewContent(
			this.panel.webview,
			this.context.extensionUri,
			"create-spec"
		);
		await this.postInitMessage();
	}

	private createPanel(): WebviewPanel | undefined {
		const resourceRoots = [
			Uri.joinPath(this.context.extensionUri, "dist", "webview"),
			Uri.joinPath(this.context.extensionUri, "dist", "webview", "app"),
		];

		try {
			return window.createWebviewPanel(
				"openspec.createSpecDialog",
				"Create New Spec",
				{
					viewColumn: ViewColumn.Active,
					preserveFocus: false,
				},
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: resourceRoots,
				}
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[CreateSpecInputController] Failed to open modal panel: ${error}`
			);
			try {
				return window.createWebviewPanel(
					"openspec.createSpecPanel",
					"Create New Spec",
					ViewColumn.Active,
					{
						enableScripts: true,
						retainContextWhenHidden: true,
						localResourceRoots: resourceRoots,
					}
				);
			} catch (fallbackError) {
				this.outputChannel.appendLine(
					`[CreateSpecInputController] Fallback panel creation failed: ${fallbackError}`
				);
				return;
			}
		}
	}

	private registerPanelListeners(panel: WebviewPanel): void {
		panel.onDidDispose(() => {
			this.panel = undefined;
		});

		panel.webview.onDidReceiveMessage(
			async (message: CreateSpecWebviewMessage) => {
				if (message.type === "create-spec/submit") {
					await this.handleSubmit(message.payload);
					return;
				}

				if (message.type === "create-spec/autosave") {
					await this.handleAutosave(message.payload);
					return;
				}

				if (message.type === "create-spec/close-attempt") {
					await this.handleCloseAttempt(message.payload.hasDirtyChanges);
					return;
				}

				if (message.type === "create-spec/cancel") {
					panel.dispose();
				}
			}
		);
	}

	private async postInitMessage(): Promise<void> {
		if (!this.panel) {
			return;
		}

		const message: CreateSpecExtensionMessage = {
			type: "create-spec/init",
			payload: {
				draft: this.draft,
				shouldFocusPrimaryField: true,
			},
		};

		await this.panel.webview.postMessage(message);
	}

	private async postFocusMessage(): Promise<void> {
		if (!this.panel) {
			return;
		}

		const message: CreateSpecExtensionMessage = {
			type: "create-spec/focus",
		};

		await this.panel.webview.postMessage(message);
	}

	private async handleSubmit(data: CreateSpecFormData): Promise<void> {
		if (!this.panel) {
			return;
		}

		const sanitizedContext = data.productContext?.trim();
		if (!sanitizedContext) {
			await this.panel.webview.postMessage({
				type: "create-spec/submit:error",
				payload: { message: "Product Context is required." },
			});
			return;
		}

		const normalized = normalizeFormData({
			...data,
			productContext: sanitizedContext,
		});

		try {
			const strategy = SpecSubmissionStrategyFactory.create(this.activeSystem);
			await strategy.submit(normalized);

			await this.clearDraftState();

			await this.panel.webview.postMessage({
				type: "create-spec/submit:success",
			});
			this.panel.dispose();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[CreateSpecInputController] Failed to submit spec request: ${message}`
			);

			await this.panel.webview.postMessage({
				type: "create-spec/submit:error",
				payload: { message },
			});
			window.showErrorMessage(`Failed to create spec prompt: ${message}`);
		}
	}

	private async handleAutosave(data: CreateSpecFormData): Promise<void> {
		this.draft = {
			formData: normalizeFormData(data),
			lastUpdated: Date.now(),
		};
		await this.saveDraftState(this.draft);
	}

	private async handleCloseAttempt(hasDirtyChanges: boolean): Promise<void> {
		if (!this.panel) {
			return;
		}

		if (!hasDirtyChanges) {
			await this.clearDraftState();
			this.panel.dispose();
			return;
		}

		const result = await window.showWarningMessage(
			"You have unsaved spec input. Close the dialog and discard your changes?",
			{
				modal: true,
				detail: "Choose Cancel to resume editing and keep your current input.",
			},
			"Discard"
		);

		const selection = isMessageItem(result) ? result.title : result;
		const shouldClose = selection === "Discard";

		if (shouldClose) {
			await this.clearDraftState();
			this.panel.dispose();
			return;
		}

		await this.panel.webview.postMessage({
			type: "create-spec/confirm-close",
			payload: { shouldClose: false },
		});
	}

	private getDraftState(): CreateSpecDraftState | undefined {
		return this.context.workspaceState.get<CreateSpecDraftState>(
			CREATE_SPEC_DRAFT_STATE_KEY
		);
	}

	private async saveDraftState(state: CreateSpecDraftState): Promise<void> {
		await this.context.workspaceState.update(
			CREATE_SPEC_DRAFT_STATE_KEY,
			state
		);
	}

	private async clearDraftState(): Promise<void> {
		this.draft = undefined;
		await this.context.workspaceState.update(
			CREATE_SPEC_DRAFT_STATE_KEY,
			undefined
		);
	}
}
