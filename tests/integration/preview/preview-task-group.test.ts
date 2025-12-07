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
			showErrorMessage: vi.fn(),
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

describe("DocumentPreviewPanel - Task Group Execution", () => {
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
		sessionId: "test-session",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockWebview.postMessage.mockClear();

		mockWebview.onDidReceiveMessage.mockImplementation((handler: any) => {
			messageHandler = handler;
			return { dispose: vi.fn() };
		});

		context = {
			extensionUri: { fsPath: "file:///mock" } as any,
			subscriptions: [],
		} as unknown as ExtensionContext;

		outputChannel = {
			appendLine: vi.fn(),
		} as unknown as OutputChannel;
	});

	it("routes task group execution to the provided handler", async () => {
		const onExecuteTaskGroup = vi.fn().mockResolvedValue(undefined);
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onExecuteTaskGroup,
		});

		await panel.renderDocument(artifact);
		await messageHandler?.({
			type: "preview/execute-task-group",
			payload: { groupName: "Phase 1: Foundation" },
		});

		expect(onExecuteTaskGroup).toHaveBeenCalledWith("Phase 1: Foundation");
	});

	it("handles errors gracefully during task group execution", async () => {
		const error = new Error("Task parsing failed");
		const onExecuteTaskGroup = vi.fn().mockRejectedValue(error);
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onExecuteTaskGroup,
		});

		await panel.renderDocument(artifact);
		await messageHandler?.({
			type: "preview/execute-task-group",
			payload: { groupName: "Phase 1: Foundation" },
		});

		expect(onExecuteTaskGroup).toHaveBeenCalledWith("Phase 1: Foundation");
	});

	it("ignores empty group names", async () => {
		const onExecuteTaskGroup = vi.fn();
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onExecuteTaskGroup,
		});

		await panel.renderDocument(artifact);
		await messageHandler?.({
			type: "preview/execute-task-group",
			payload: { groupName: "" },
		});

		expect(onExecuteTaskGroup).not.toHaveBeenCalled();
	});

	it("ignores messages without payload", async () => {
		const onExecuteTaskGroup = vi.fn();
		const panel = new DocumentPreviewPanel(context, outputChannel, {
			onExecuteTaskGroup,
		});

		await panel.renderDocument(artifact);
		await messageHandler?.({
			type: "preview/execute-task-group",
			payload: undefined,
		});

		expect(onExecuteTaskGroup).not.toHaveBeenCalled();
	});
});
