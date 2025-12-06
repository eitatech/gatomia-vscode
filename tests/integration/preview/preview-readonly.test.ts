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

let vscodeWindow: any;
let showWarningMessage: ReturnType<typeof vi.fn>;

vi.mock("vscode", () => {
	const createUri = (value: string) => ({
		fsPath: value,
		toString: () => value,
	});

	showWarningMessage = vi.fn();

	vscodeWindow = {
		createWebviewPanel: vi.fn(() => mockPanel),
		showWarningMessage,
		showInformationMessage: vi.fn(),
		activeTextEditor: undefined,
	};

	return {
		window: vscodeWindow,
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

describe("DocumentPreviewPanel read-only guard", () => {
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
		showWarningMessage.mockClear();

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

	it("notifies user when edit attempts happen", async () => {
		const onEditAttempt = vi.fn();
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onEditAttempt,
		});
		await panel.renderDocument(artifact);
		await messageHandler?.({
			type: "preview/edit-attempt",
			payload: { reason: "test" },
		});

		expect(onEditAttempt).toHaveBeenCalledWith("test");
		expect(showWarningMessage).toHaveBeenCalledWith(
			"Document preview is read-only. Use the editor to modify the source."
		);
	});
});
