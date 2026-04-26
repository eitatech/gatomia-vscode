/**
 * AgentChatEntryPoints — unit coverage.
 *
 * The entry-points module wires three host-level surfaces (command,
 * status bar, first-run migration) together. The tests exercise the
 * registration shape + the side effects of running the command and the
 * migration via a fake `AgentChatEntryPointsHost` so we don't have to
 * boot a real VS Code instance.
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
	MOVE_CHAT_TO_SECONDARY_SIDEBAR_COMMAND,
	OPEN_IN_SECONDARY_SIDEBAR_COMMAND,
	registerAgentChatEntryPoints,
	type AgentChatEntryPointsHost,
} from "../../../../src/features/agent-chat/agent-chat-entry-points";

const OPEN_TOOLTIP_RE = /Open Agent Chat/i;
const MIGRATION_FLAG_KEY = "gatomia.agentChat.movedToAuxiliary.v2";

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
	globalState: Map<string, boolean>;
}

function makeHost(initialFlag = false): FakeHost {
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
	const globalState = new Map<string, boolean>();
	if (initialFlag) {
		globalState.set(MIGRATION_FLAG_KEY, true);
	}

	const host: FakeHost = {
		registeredCommands,
		executedCommands,
		statusItem,
		globalState,
		registerCommand: (commandId, handler) => {
			registeredCommands.set(commandId, handler);
			return { dispose: vi.fn() };
		},
		executeCommand: vi.fn((commandId: string, ...args: unknown[]) => {
			executedCommands.push({ id: commandId, args });
			return Promise.resolve(undefined);
		}),
		createStatusBarItem: () => statusItem,
		getGlobalStateFlag: (key) => globalState.get(key) === true,
		setGlobalStateFlag: (key, value) => {
			globalState.set(key, value);
			return Promise.resolve();
		},
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

	it("returns disposables that include the status bar dispose", () => {
		const host = makeHost();
		const disposables = registerAgentChatEntryPoints(host, outputChannel);
		// 3 entries: open command + manual move command + status bar
		// wrapper. Add new entries here when registering more.
		expect(disposables).toHaveLength(3);
		for (const disposable of disposables) {
			disposable.dispose();
		}
		expect(host.statusItem.dispose).toHaveBeenCalledTimes(1);
	});
});

describe("openInSecondarySidebar command handler", () => {
	it("focuses the auxiliary side bar before focusing the chat view", async () => {
		const host = makeHost(true); // skip migration so we can assert order cleanly
		registerAgentChatEntryPoints(host, outputChannel);
		const handler = host.registeredCommands.get(
			OPEN_IN_SECONDARY_SIDEBAR_COMMAND
		);
		expect(handler).toBeDefined();
		await handler?.();

		const ids = host.executedCommands.map((entry) => entry.id);
		expect(ids).toEqual([
			"workbench.action.focusAuxiliaryBar",
			"gatomia.views.agentChat.focus",
		]);
	});

	it("still attempts to focus the view if focusAuxiliaryBar throws", async () => {
		const host = makeHost(true);
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
	});
});

describe("first-activation migration", () => {
	it("stops at the first successful vscode.moveViews and persists the flag", async () => {
		const host = makeHost(false);
		registerAgentChatEntryPoints(host, outputChannel);
		// The migration is fire-and-forget — flush microtasks so the
		// async helper completes before we assert.
		await new Promise((resolve) => setImmediate(resolve));

		const moveCalls = host.executedCommands.filter(
			(entry) => entry.id === "vscode.moveViews"
		);
		// Default fake host returns success on the first attempt, so we
		// must not fall through to the rest of the chain.
		expect(moveCalls).toHaveLength(1);
		expect(moveCalls[0]?.args[0]).toMatchObject({
			viewIds: ["gatomia.views.agentChat"],
			destinationId: "workbench.view.auxiliary",
		});
		expect(host.globalState.get(MIGRATION_FLAG_KEY)).toBe(true);
	});

	it("skips moveViews when the migration flag is already set", async () => {
		const host = makeHost(true);
		registerAgentChatEntryPoints(host, outputChannel);
		await new Promise((resolve) => setImmediate(resolve));
		const moveCalls = host.executedCommands.filter(
			(entry) => entry.id === "vscode.moveViews"
		);
		expect(moveCalls).toHaveLength(0);
	});

	it("walks the fallback chain when the first attempt rejects", async () => {
		const host = makeHost(false);
		let attempt = 0;
		(host.executeCommand as Mock).mockImplementation(
			(id: string, ...args: unknown[]) => {
				host.executedCommands.push({ id, args });
				if (id === "vscode.moveViews") {
					attempt += 1;
					if (attempt === 1) {
						return Promise.reject(new Error("first id rejected"));
					}
					return Promise.resolve(undefined);
				}
				return Promise.resolve(undefined);
			}
		);
		registerAgentChatEntryPoints(host, outputChannel);
		await new Promise((resolve) => setImmediate(resolve));

		const moveCalls = host.executedCommands.filter(
			(entry) => entry.id === "vscode.moveViews"
		);
		// First call rejected, second call accepted, no third call.
		expect(moveCalls).toHaveLength(2);
		expect(moveCalls[1]?.args[0]).toMatchObject({
			viewIds: ["gatomia-chat"],
			destinationId: "workbench.view.auxiliary",
		});
		expect(host.globalState.get(MIGRATION_FLAG_KEY)).toBe(true);
	});

	it("still records the migration flag even when every fallback rejects", async () => {
		const host = makeHost(false);
		(host.executeCommand as Mock).mockImplementation(
			(id: string, ...args: unknown[]) => {
				host.executedCommands.push({ id, args });
				if (id === "vscode.moveViews") {
					return Promise.reject(
						new Error("legacy host does not know vscode.moveViews")
					);
				}
				return Promise.resolve(undefined);
			}
		);
		registerAgentChatEntryPoints(host, outputChannel);
		await new Promise((resolve) => setImmediate(resolve));

		// Every fallback in MOVE_ATTEMPTS should have been tried.
		const moveCalls = host.executedCommands.filter(
			(entry) => entry.id === "vscode.moveViews"
		);
		expect(moveCalls.length).toBeGreaterThanOrEqual(3);
		expect(host.globalState.get(MIGRATION_FLAG_KEY)).toBe(true);
	});
});

describe("moveChatToSecondarySidebar command (manual escape hatch)", () => {
	it("registers the manual move command", () => {
		const host = makeHost(true);
		registerAgentChatEntryPoints(host, outputChannel);
		expect(
			host.registeredCommands.has(MOVE_CHAT_TO_SECONDARY_SIDEBAR_COMMAND)
		).toBe(true);
	});

	it("re-runs the move chain even when the migration flag is already set", async () => {
		const host = makeHost(true);
		registerAgentChatEntryPoints(host, outputChannel);
		// First-run migration must NOT fire because the flag is set.
		await new Promise((resolve) => setImmediate(resolve));
		expect(
			host.executedCommands.filter((e) => e.id === "vscode.moveViews")
		).toHaveLength(0);

		// Manually invoking the command should attempt the move chain.
		const handler = host.registeredCommands.get(
			MOVE_CHAT_TO_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();

		const moveCalls = host.executedCommands.filter(
			(e) => e.id === "vscode.moveViews"
		);
		expect(moveCalls.length).toBeGreaterThanOrEqual(1);
	});

	it("focuses the auxiliary bar and the view after a successful manual move", async () => {
		const host = makeHost(true);
		registerAgentChatEntryPoints(host, outputChannel);
		await new Promise((resolve) => setImmediate(resolve));

		const handler = host.registeredCommands.get(
			MOVE_CHAT_TO_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();

		const ids = host.executedCommands.map((e) => e.id);
		expect(ids).toContain("workbench.action.focusAuxiliaryBar");
		expect(ids).toContain("gatomia.views.agentChat.focus");
	});

	it("does not focus when every move attempt rejects", async () => {
		const host = makeHost(true);
		(host.executeCommand as Mock).mockImplementation(
			(id: string, ...args: unknown[]) => {
				host.executedCommands.push({ id, args });
				if (id === "vscode.moveViews") {
					return Promise.reject(new Error("rejected by host"));
				}
				return Promise.resolve(undefined);
			}
		);
		registerAgentChatEntryPoints(host, outputChannel);
		await new Promise((resolve) => setImmediate(resolve));

		const handler = host.registeredCommands.get(
			MOVE_CHAT_TO_SECONDARY_SIDEBAR_COMMAND
		);
		await handler?.();

		const ids = host.executedCommands.map((e) => e.id);
		expect(ids).not.toContain("workbench.action.focusAuxiliaryBar");
		expect(ids).not.toContain("gatomia.views.agentChat.focus");
	});
});
