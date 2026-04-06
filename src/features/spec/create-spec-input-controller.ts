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

const MARKDOWN_SIZE_LIMIT_BYTES = 524_288; // 512 KB
const IMAGE_MAX_SIZE_BYTES = 10_485_760; // 10 MB
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|gif|webp|svg)$/i;
const IMAGE_MAX_COUNT = 5;

const isMessageItem = (value: unknown): value is MessageItem => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as { title?: unknown };
	return typeof candidate.title === "string";
};

const normalizeFormData = (
	data: Partial<CreateSpecFormData> | undefined
): CreateSpecFormData => ({
	description: typeof data?.description === "string" ? data.description : "",
});

interface LegacyFormData {
	productContext?: string;
	keyScenarios?: string;
	technicalConstraints?: string;
	relatedFiles?: string;
	openQuestions?: string;
}

const migrateDraftFormData = (
	raw: unknown
): CreateSpecDraftState | undefined => {
	if (!raw || typeof raw !== "object") {
		return;
	}

	const candidate = raw as { formData?: unknown; lastUpdated?: unknown };
	if (typeof candidate.lastUpdated !== "number" || !candidate.formData) {
		return;
	}

	const formData = candidate.formData as Record<string, unknown>;

	// New format: already has description
	if (typeof formData.description === "string") {
		return {
			formData: { description: formData.description },
			lastUpdated: candidate.lastUpdated,
		};
	}

	// Legacy format: concatenate non-empty fields into description
	const legacy = formData as LegacyFormData;
	const parts = [
		legacy.productContext,
		legacy.keyScenarios,
		legacy.technicalConstraints,
		legacy.relatedFiles,
		legacy.openQuestions,
	]
		.map((v) => (typeof v === "string" ? v.trim() : ""))
		.filter(Boolean);

	return {
		formData: { description: parts.join("\n\n") },
		lastUpdated: candidate.lastUpdated,
	};
};

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
					await this.handleSubmit({
						description: message.payload.description,
						imageUris: message.payload.imageUris,
					});
					return;
				}

				if (message.type === "create-spec/autosave") {
					await this.handleAutosave({
						description: message.payload.description,
					});
					return;
				}

				if (message.type === "create-spec/close-attempt") {
					await this.handleCloseAttempt(message.payload.hasDirtyChanges);
					return;
				}

				if (message.type === "create-spec/import-markdown:request") {
					await this.handleImportMarkdownRequest();
					return;
				}

				if (message.type === "create-spec/attach-images:request") {
					await this.handleAttachImagesRequest(message.payload.currentCount);
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

	private async handleSubmit({
		description,
		imageUris,
	}: {
		description: string;
		imageUris: string[];
	}): Promise<void> {
		if (!this.panel) {
			return;
		}

		const trimmedDescription = description?.trim();
		if (!trimmedDescription) {
			await this.panel.webview.postMessage({
				type: "create-spec/submit:error",
				payload: { message: "Description is required." },
			});
			return;
		}

		try {
			const strategy = SpecSubmissionStrategyFactory.create(this.activeSystem);
			await strategy.submit({
				description: trimmedDescription,
				imageUris: imageUris ?? [],
			});

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

	private async handleImportMarkdownRequest(): Promise<void> {
		if (!this.panel) {
			return;
		}

		const uris = await window.showOpenDialog({
			canSelectMany: false,
			filters: { Markdown: ["md"] },
		});

		if (!uris || uris.length === 0) {
			return;
		}

		try {
			const bytes = await workspace.fs.readFile(uris[0]);

			if (bytes.byteLength > MARKDOWN_SIZE_LIMIT_BYTES) {
				await this.panel.webview.postMessage({
					type: "create-spec/import-markdown:result",
					payload: { error: "File exceeds the 512 KB limit." },
				});
				return;
			}

			const content = new TextDecoder().decode(bytes);

			if (!content) {
				await this.panel.webview.postMessage({
					type: "create-spec/import-markdown:result",
					payload: { content: "", warning: "The selected file is empty." },
				});
				return;
			}

			await this.panel.webview.postMessage({
				type: "create-spec/import-markdown:result",
				payload: { content },
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[CreateSpecInputController] Failed to read markdown file: ${message}`
			);
			await this.panel.webview.postMessage({
				type: "create-spec/import-markdown:result",
				payload: { error: "Failed to read the selected file." },
			});
		}
	}

	private async readImageAsDataUrl(
		uri: Uri,
		fileName: string
	): Promise<{ dataUrl: string } | { error: string }> {
		try {
			const bytes = await workspace.fs.readFile(uri);
			if (bytes.byteLength > IMAGE_MAX_SIZE_BYTES) {
				return { error: "One or more files exceed the 10 MB size limit." };
			}
			const ext = fileName.split(".").pop()?.toLowerCase() ?? "png";
			const mimeType =
				ext === "svg"
					? "image/svg+xml"
					: `image/${ext === "jpg" ? "jpeg" : ext}`;
			const base64 = Buffer.from(bytes).toString("base64");
			return { dataUrl: `data:${mimeType};base64,${base64}` };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[CreateSpecInputController] Failed to read image file: ${message}`
			);
			return { error: "Failed to read one or more image files." };
		}
	}

	private async handleAttachImagesRequest(currentCount: number): Promise<void> {
		if (!this.panel) {
			return;
		}

		const uris = await window.showOpenDialog({
			canSelectMany: true,
			filters: { Images: IMAGE_EXTENSIONS },
		});

		if (!uris || uris.length === 0) {
			return;
		}

		const remaining = IMAGE_MAX_COUNT - currentCount;
		const toProcess = uris.slice(0, remaining);
		const capped = uris.length > remaining;

		const images: Array<{
			id: string;
			uri: string;
			name: string;
			dataUrl: string;
		}> = [];

		for (const uri of toProcess) {
			const fileName = uri.fsPath.split("/").pop() ?? uri.fsPath;

			if (!IMAGE_EXTENSION_PATTERN.test(fileName)) {
				await this.panel.webview.postMessage({
					type: "create-spec/attach-images:result",
					payload: { error: "One or more files are not valid image files." },
				});
				return;
			}

			const result = await this.readImageAsDataUrl(uri, fileName);
			if ("error" in result) {
				await this.panel.webview.postMessage({
					type: "create-spec/attach-images:result",
					payload: { error: result.error },
				});
				return;
			}

			images.push({
				id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
				uri: uri.toString(),
				name: fileName,
				dataUrl: result.dataUrl,
			});
		}

		await this.panel.webview.postMessage({
			type: "create-spec/attach-images:result",
			payload: { images, ...(capped ? { capped: true } : {}) },
		});
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
		const raw = this.context.workspaceState.get<unknown>(
			CREATE_SPEC_DRAFT_STATE_KEY
		);
		return migrateDraftFormData(raw);
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
