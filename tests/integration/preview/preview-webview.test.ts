import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, OutputChannel } from "vscode";
import { DocumentPreviewPanel } from "../../../src/panels/document-preview-panel";
import type { DocumentArtifact } from "../../../src/types/preview";

const mockWebview = {
	html: "",
	cspSource: "mock-csp",
	postMessage: vi.fn().mockResolvedValue(true),
	onDidReceiveMessage: vi.fn(),
	asWebviewUri: vi.fn((value) => value),
} as any;

const mockPanel = {
	reveal: vi.fn(),
	onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
	webview: mockWebview,
} as any;

vi.mock("vscode", () => {
	const createUri = (value: string) => ({
		fsPath: value,
		toString: () => value,
	});

	return {
		window: {
			createWebviewPanel: vi.fn(() => mockPanel),
			showWarningMessage: vi.fn(),
			showInformationMessage: vi.fn(),
			activeTextEditor: undefined,
		},
		ViewColumn: { Active: 1, Beside: 2 },
		Uri: {
			joinPath: (_base: any, ...segments: string[]) =>
				createUri(segments.join("/")),
			parse: (value: string) => createUri(value),
		},
		workspace: {},
	};
});

vi.mock("../../../src/utils/get-webview-content", () => ({
	getWebviewContent: vi.fn(() => "<html />"),
}));

describe("DocumentPreviewPanel", () => {
	let messageHandler: ((message: any) => Promise<void> | void) | undefined;
	let context: ExtensionContext;
	let outputChannel: OutputChannel;

	const artifact: DocumentArtifact = {
		documentId: "file:///spec.md",
		documentType: "spec",
		title: "Demo Spec",
		renderStandard: "markdown",
		sections: [],
		diagrams: [],
		forms: [],
		rawContent: "# Title",
		metadata: {},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockWebview.postMessage.mockClear();

		mockWebview.onDidReceiveMessage.mockImplementation((handler) => {
			messageHandler = handler;
			return { dispose: vi.fn() };
		});

		context = {
			extensionUri: { fsPath: "file:///mock" } as any,
			subscriptions: [],
		} as ExtensionContext;

		outputChannel = {
			appendLine: vi.fn(),
		} as OutputChannel;
	});

	it("posts document payload once the webview reports ready", async () => {
		const panel = new DocumentPreviewPanel(context, outputChannel);
		await panel.renderDocument(artifact);
		await messageHandler?.({ type: "preview/ready" });

		expect(mockWebview.postMessage).toHaveBeenCalledWith({
			type: "preview/load-document",
			payload: artifact,
		});
	});

	it("routes form submissions to the provided handler and sends results back", async () => {
		const onFormSubmit = vi
			.fn()
			.mockResolvedValue({ status: "success", message: "saved" });
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onFormSubmit,
		});

		await panel.renderDocument(artifact);
		await messageHandler?.({ type: "preview/ready" });

		const submission = {
			type: "preview/forms/submit",
			payload: {
				requestId: "req-1",
				documentId: "file:///spec.md",
				sessionId: "session-1",
				fields: [],
				submittedAt: new Date().toISOString(),
			},
		};

		await messageHandler?.(submission);

		expect(onFormSubmit).toHaveBeenCalledWith(submission.payload);
		expect(mockWebview.postMessage).toHaveBeenCalledWith({
			type: "preview/forms/result",
			payload: { requestId: "req-1", status: "success", message: "saved" },
		});
	});

	it("routes refinement submissions and emits bridge responses", async () => {
		const onRefineSubmit = vi
			.fn()
			.mockResolvedValue({ status: "success", message: "queued" });
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onRefineSubmit,
		});

		await panel.renderDocument(artifact);
		await messageHandler?.({ type: "preview/ready" });

		const submission = {
			type: "preview/refine/submit",
			payload: {
				requestId: "ref-1",
				documentId: "file:///spec.md",
				documentType: "spec",
				issueType: "missingDetail",
				description: "Something is missing here",
				submittedAt: new Date().toISOString(),
			},
		};

		await messageHandler?.(submission);

		expect(onRefineSubmit).toHaveBeenCalledWith(submission.payload);
		expect(mockWebview.postMessage).toHaveBeenCalledWith({
			type: "preview/refine/result",
			payload: { requestId: "ref-1", status: "success", message: "queued" },
		});
	});
});
