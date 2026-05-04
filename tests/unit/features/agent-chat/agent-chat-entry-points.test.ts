/**
 * AgentChatEntryPoints — unit coverage.
 *
 * The entry-points module wires two host-level surfaces (command +
 * status bar) together. The tests exercise the registration shape and
 * the side effects of running the open command via a fake
 * `AgentChatEntryPointsHost` so we don't have to boot a real VS Code
 * instance.
 *
 * Placement of the chat view itself is declarative
 * (`package.json#contributes.views` + the
 * `gatomia.host.chatInPrimary` context key set in `extension.ts`), so
 * it is not tested here — see the integration tests.
 */

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import {
	OPEN_IN_SECONDARY_SIDEBAR_COMMAND,
	registerAgentChatEntryPoints,
	shouldUseAuxiliaryBar,
	type AgentChatEntryPointsHost,
} from "../../../../src/features/agent-chat/agent-chat-entry-points";
import type { IdeHost } from "../../../../src/utils/ide-host-detector";

const OPEN_TOOLTIP_RE = /Open Agent Chat/i;

interface FakeStatusBarItem {
	text: string;
	tooltip: string;
	command: string | undefined;
	show: () => void;
	hide: () => void;
	dispose: () => void;
}

interface FakeHost extends AgentChatEntryPointsHost {
	registeredCommands: Map<string, (...args: unknown[]) => unknown>;
	executedCommands: Array<{ id: string; args: unknown[] }>;
	statusItem: FakeStatusBarItem;
}

function makeHost(ideHost: IdeHost = "vscode"): FakeHost {
	const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
	const executedCommands: Array<{ id: string; args: unknown[] }> = [];
	const statusItem: FakeStatusBarItem = {
		text: "",
		tooltip: "",
		command: undefined,
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
	};

	const host: FakeHost = {
		registeredCommands,
		executedCommands,
		statusItem,
		registerCommand: (commandId, handler) => {
			registeredCommands.set(commandId, handler);
			return { dispose: vi.fn() };
		},
		executeCommand: vi.fn((commandId: string, ...args: unknown[]) => {
			executedCommands.push({ id: commandId, args });
			return Promise.resolve(undefined);
		}),
		createStatusBarItem: () => statusItem,
		getIdeHost: () => ideHost,
	};
	return host;
}

const outputChannel = {
	name: "test",
	append: vi.fn(),
	appendLine: vi.fn(),
	clear: vi.fn(),
	show: vi.fn(),
	hide: vi.fn(),
	dispose: vi.fn(),
	replace: vi.fn(),
	logLevel: 0,
	onDidChangeLogLevel: vi.fn(),
	trace: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
} as never;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("registerAgentChatEntryPoints", () => {
	it("registers the open-in-secondary-sidebar command", () => {
		const host = makeHost();
		registerAgentChatEntryPoints(host, outputChannel);
		expect(host.registeredCommands.has(OPEN_IN_SECONDARY_SIDEBAR_COMMAND)).toBe(
			true
		);
	});

	it("creates a status bar item bound to the command with a Cmd+L tooltip", () => {
		const host = makeHost();
		registerAgentChatEntryPoints(host, outputChannel);
		expect(host.statusItem.text).toContain("Chat");
		expect(host.statusItem.command).toBe(OPEN_IN_SECONDARY_SIDEBAR_COMMAND);
		expect(host.statusItem.tooltip).toMatch(OPEN_TOOLTIP_RE);
		expect(host.statusItem.tooltip).toContain("\u2318L");
		expect(host.statusItem.show).toHaveBeenCalledTimes(1);
	});

	it("returns disposables that include the command + status bar wrappers", () => {
		const host = makeHost();
		const disposables = registerAgentChatEntryPoints(host, outputChannel);
		// 2 entries: open command + status bar wrapper. Add new entries
		// here when registering more.
		expect(disposables).toHaveLength(2);
		for (const disposable of disposables) {
			disposable.dispose();
		}
		expect(host.statusItem.dispose).toHaveBeenCalledTimes(1);
	});

	it("does not register a separate manual move command (removed)", () => {
		const host = makeHost();
		registerAgentChatEntryPoints(host, outputChannel);
		expect(
			host.registeredCommands.has(
				"gatomia.agentChat.moveChatToSecondarySidebar"
			)
		).toBe(false);
	});

	it("does not call vscode.moveViews on activation (removed: that command cannot move into a location)", async () => {
		// Regression for microsoft/vscode#156527: the previous
		// implementation called `vscode.moveViews` with
		// `destinationId: "workbench.view.auxiliary"`, but VS Code only
		// allows moving views into another *container*, not a
		// location. Placement is now declarative + context-key based.
		const host = makeHost();
		registerAgentChatEntryPoints(host, outputChannel);
		await new Promise((resolve) => setImmediate(resolve));
		const moveCalls = host.executedCommands.filter(
			(entry) => entry.id === "vscode.moveViews"
		);
		expect(moveCalls).toHaveLength(0);
	});
});

describe("openInSecondarySidebar command handler", () => {
	it("on hosts with an auxiliary bar: focuses the auxiliary bar before focusing the chat view", async () => {
		const host = makeHost("vscode");
		registerAgentChatEntryPoints(host, outputChannel);
		const handler = host.registeredCommands.get(
			OPEN_IN_SECONDARY_SIDEBAR_COMMAND
		);
		expect(handler).toBeDefined();
		await handler?.();

		const ids = host.executedCommands.map((entry) => entry.id);
		// Auxiliary bar opened first, then both candidate view ids are
		// asked to focus (only one will be active given the host's
		// context-key state).
		expect(ids[0]).toBe("workbench.action.focusAuxiliaryBar");
		expect(ids).toContain("gatomia.views.agentChat.focus");
		expect(ids).toContain("gatomia.views.agentChatPrimary.focus");
	});

	it("on Windsurf: skips focusAuxiliaryBar and focuses the view ids directly", async () => {
		const host = makeHost("windsurf");
		registerAgentChatEntryPoints(host, outputChannel);
		const handler = host.registeredCommands.get(
			OPEN_IN_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();

		const ids = host.executedCommands.map((entry) => entry.id);
		expect(ids).not.toContain("workbench.action.focusAuxiliaryBar");
		expect(ids).toContain("gatomia.views.agentChat.focus");
		expect(ids).toContain("gatomia.views.agentChatPrimary.focus");
	});

	it("on Antigravity: skips focusAuxiliaryBar and focuses the view ids directly", async () => {
		const host = makeHost("antigravity");
		registerAgentChatEntryPoints(host, outputChannel);
		const handler = host.registeredCommands.get(
			OPEN_IN_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();

		const ids = host.executedCommands.map((entry) => entry.id);
		expect(ids).not.toContain("workbench.action.focusAuxiliaryBar");
		expect(ids).toContain("gatomia.views.agentChat.focus");
	});

	it("still attempts to focus the views if focusAuxiliaryBar throws", async () => {
		const host = makeHost("vscode");
		(host.executeCommand as Mock).mockImplementation(
			(id: string, ...args: unknown[]) => {
				host.executedCommands.push({ id, args });
				if (id === "workbench.action.focusAuxiliaryBar") {
					return Promise.reject(new Error("not supported on this host"));
				}
				return Promise.resolve(undefined);
			}
		);
		registerAgentChatEntryPoints(host, outputChannel);
		const handler = host.registeredCommands.get(
			OPEN_IN_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();
		const ids = host.executedCommands.map((entry) => entry.id);
		expect(ids).toContain("gatomia.views.agentChat.focus");
		expect(ids).toContain("gatomia.views.agentChatPrimary.focus");
	});

	it("survives a single view focus rejection and tries the other id", async () => {
		// `<viewId>.focus` throws when the view's `when` clause is false
		// — the inactive view id should not block the active one.
		const host = makeHost("vscode");
		(host.executeCommand as Mock).mockImplementation(
			(id: string, ...args: unknown[]) => {
				host.executedCommands.push({ id, args });
				if (id === "gatomia.views.agentChatPrimary.focus") {
					return Promise.reject(new Error("view not visible"));
				}
				return Promise.resolve(undefined);
			}
		);
		registerAgentChatEntryPoints(host, outputChannel);
		const handler = host.registeredCommands.get(
			OPEN_IN_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();

		const ids = host.executedCommands.map((entry) => entry.id);
		expect(ids).toContain("gatomia.views.agentChat.focus");
		expect(ids).toContain("gatomia.views.agentChatPrimary.focus");
	});
});

describe("shouldUseAuxiliaryBar", () => {
	it("returns false for Windsurf and Antigravity", () => {
		expect(shouldUseAuxiliaryBar("windsurf")).toBe(false);
		expect(shouldUseAuxiliaryBar("antigravity")).toBe(false);
	});

	it("returns true for the VS Code family and unknown hosts", () => {
		expect(shouldUseAuxiliaryBar("vscode")).toBe(true);
		expect(shouldUseAuxiliaryBar("vscode-insiders")).toBe(true);
		expect(shouldUseAuxiliaryBar("vscodium")).toBe(true);
		expect(shouldUseAuxiliaryBar("cursor")).toBe(true);
		expect(shouldUseAuxiliaryBar("positron")).toBe(true);
		expect(shouldUseAuxiliaryBar("unknown")).toBe(true);
	});
});
