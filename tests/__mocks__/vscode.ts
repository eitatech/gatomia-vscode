/** biome-ignore-all lint/style/useNamingConvention: ignore */
import { vi } from "vitest";

export const workspace = {
	workspaceFolders: [
		{
			uri: {
				fsPath: "/fake/workspace",
				with: vi.fn(),
				toString: () => "file:///fake/workspace",
			},
		},
	],
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
		update: vi.fn().mockResolvedValue(undefined),
	})),
	fs: {
		createDirectory: vi.fn(),
		writeFile: vi.fn(),
		readDirectory: vi.fn(),
		stat: vi.fn(),
		delete: vi.fn(),
		rename: vi.fn(),
	},
	openTextDocument: vi.fn(),
	onDidChangeConfiguration: vi.fn(),
	createFileSystemWatcher: vi.fn(() => ({
		onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
		onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
		onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
		dispose: vi.fn(),
	})),
};

export const window = {
	activeTextEditor: undefined,
	visibleTextEditors: [],
	showTextDocument: vi.fn(),
	withProgress: vi.fn((options, task) => task()),
	showErrorMessage: vi.fn().mockResolvedValue(undefined),
	showWarningMessage: vi.fn().mockResolvedValue(undefined),
	showInformationMessage: vi.fn().mockResolvedValue(undefined),
	showInputBox: vi.fn(),
	showQuickPick: vi.fn(),
	createTerminal: vi.fn(),
	onDidEndTerminalShellExecution: vi.fn(),
	createWebviewPanel: vi.fn(() => ({
		webview: {
			html: "",
			onDidReceiveMessage: vi.fn(),
			postMessage: vi.fn(),
			asWebviewUri: vi.fn((uri) => uri),
		},
		onDidDispose: vi.fn(),
		onDidChangeViewState: vi.fn(),
		reveal: vi.fn(),
		dispose: vi.fn(),
	})),
};

export const commands = {
	executeCommand: vi.fn(),
	registerCommand: vi.fn(() => ({
		dispose: vi.fn(),
	})),
};

export const Uri = {
	file: vi.fn((path) => ({
		fsPath: path,
		with: vi.fn(),
		toString: () => `file://${path}`,
	})),
	joinPath: vi.fn((base, ...args) => {
		const path = [base.fsPath, ...args].join("/");
		return {
			fsPath: path,
			with: vi.fn(),
			toString: () => `file://${path}`,
		};
	}),
	parse: vi.fn((str) => ({
		toString: () => str,
		fsPath: str.replace("file://", ""),
	})),
};

export const ViewColumn = {
	Active: 1,
	Beside: 2,
	One: 1,
	Two: 2,
	Three: 3,
	Four: 4,
	Five: 5,
	Six: 6,
	Seven: 7,
	Eight: 8,
	Nine: 9,
};

export const Position = vi.fn();
export const Range = vi.fn();
export const Selection = vi.fn();

export const ProgressLocation = {
	Notification: 15,
};

export const FileType = {
	Unknown: 0,
	File: 1,
	Directory: 2,
	SymbolicLink: 64,
};

export const TextEditorRevealType = {
	Default: 0,
};

export const TreeItemCollapsibleState = {
	None: 0,
	Collapsed: 1,
	Expanded: 2,
} as const;
export type TreeItemCollapsibleState =
	(typeof TreeItemCollapsibleState)[keyof typeof TreeItemCollapsibleState];

export class ThemeIcon {
	readonly id: string;

	constructor(id: string) {
		this.id = id;
	}
}

export class TreeItem {
	label: string;
	collapsibleState: TreeItemCollapsibleState;
	iconPath: ThemeIcon | undefined;
	tooltip: string | undefined;
	description: string | undefined;
	command: unknown;
	resourceUri: { fsPath: string } | undefined;

	constructor(label: string, collapsibleState: TreeItemCollapsibleState) {
		this.label = label;
		this.collapsibleState = collapsibleState;
	}
}

export class EventEmitter<T> {
	private readonly listeners: Array<(event: T) => void> = [];

	readonly event = (listener: (event: T) => void) => {
		this.listeners.push(listener);
		return {
			dispose: vi.fn(() => {
				const index = this.listeners.indexOf(listener);
				if (index >= 0) {
					this.listeners.splice(index, 1);
				}
			}),
		};
	};

	fire = (event: T): void => {
		for (const listener of [...this.listeners]) {
			listener(event);
		}
	};

	dispose = vi.fn(() => {
		this.listeners.length = 0;
	});
}

export class RelativePattern {
	base: string;
	pattern: string;

	constructor(base: string | { uri: { fsPath: string } }, pattern: string) {
		this.base = typeof base === "string" ? base : base.uri.fsPath;
		this.pattern = pattern;
	}
}

export const env = {
	machineId: "test-machine",
	clipboard: {
		writeText: vi.fn().mockResolvedValue(undefined),
		readText: vi.fn().mockResolvedValue(""),
	},
	openExternal: vi.fn().mockResolvedValue(true),
};

export const extensions = {
	getExtension: vi.fn((extensionId: string) => {
		// Mock extensions can be configured in tests
		return;
	}),
	all: [] as unknown[],
	onDidChange: vi.fn((listener: () => void) => {
		// Store the handler for test simulation
		(extensions as any)._onDidChangeHandler = listener;
		return {
			dispose: vi.fn(() => {
				(extensions as any)._onDidChangeHandler = undefined;
			}),
		};
	}),
};

export const ConfigurationTarget = {
	Global: 1,
	Workspace: 2,
	WorkspaceFolder: 3,
};

// Mock for Chat API
export const chat = {
	createChatParticipant: vi.fn((id: string, handler: any) => ({
		iconPath: undefined,
		dispose: vi.fn(),
	})),
};

// Mock ChatResponseStream
export class ChatResponseStream {
	markdown = vi.fn();
	button = vi.fn();
	progress = vi.fn();
	reference = vi.fn();
	push = vi.fn();
}
