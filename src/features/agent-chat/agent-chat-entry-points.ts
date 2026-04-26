/**
 * AgentChatEntryPoints — registers user-facing entry surfaces for the
 * agent chat sidebar that the host VS Code does not expose natively:
 *
 *   1. Command `gatomia.agentChat.openInSecondarySidebar` that focuses
 *      the chat view container regardless of which sidebar (primary or
 *      secondary) it currently lives in. Bound to Cmd+L / Ctrl+L via
 *      `package.json#contributes.keybindings`.
 *   2. Status bar item rendering "$(comment-discussion) Chat" on the
 *      right side. Click forwards to the same command.
 *   3. One-time migration helper that moves the `gatomia-chat` view
 *      container to the secondary side bar on first activation, so the
 *      user does not have to drag it. Subsequent activations are no-ops
 *      (gated by a `globalState` flag) so the user's later position
 *      preference is respected.
 *
 * VS Code intentionally does not let extensions inject icons into the
 * native title bar (between the sidebar toggles). Combining the keybind
 * + status-bar entry + auto-migration is the closest sanctioned pattern.
 *
 * All side effects are funnelled through a thin `Host` interface so the
 * unit tests can drive the module without spinning up VS Code.
 */

import type { Disposable, ExtensionContext, OutputChannel } from "vscode";

/**
 * Public command id used by the keybinding, the status bar item, and the
 * command palette entry. Kept as a constant so package.json + runtime
 * stay in sync via grep.
 */
export const OPEN_IN_SECONDARY_SIDEBAR_COMMAND =
	"gatomia.agentChat.openInSecondarySidebar";

/**
 * View container id matching `package.json#contributes.viewsContainers`.
 * VS Code prefixes it with `workbench.view.extension.` when generating
 * the focus / move command ids.
 */
const VIEW_CONTAINER_ID = "gatomia-chat";
const VIEW_ID = "gatomia.views.agentChat";
const MIGRATION_FLAG_KEY = "gatomia.agentChat.movedToAuxiliary";

/**
 * Subset of the `vscode` API the entry points actually touch. Using a
 * narrowed type keeps the unit tests deterministic — the test doubles
 * don't need to mock the whole module.
 */
export interface AgentChatEntryPointsHost {
	registerCommand(
		commandId: string,
		handler: (...args: unknown[]) => unknown
	): Disposable;
	executeCommand(commandId: string, ...args: unknown[]): Promise<unknown>;
	createStatusBarItem(): {
		text: string;
		tooltip: string;
		command: string | undefined;
		show(): void;
		hide(): void;
		dispose(): void;
	};
	getGlobalStateFlag(key: string): boolean;
	setGlobalStateFlag(key: string, value: boolean): Promise<void>;
}

/**
 * Wires the command + status-bar item + first-run migration. The caller
 * is responsible for adding the returned disposables to the extension
 * context so they are released on deactivate.
 */
export function registerAgentChatEntryPoints(
	host: AgentChatEntryPointsHost,
	output: OutputChannel
): Disposable[] {
	const disposables: Disposable[] = [];

	disposables.push(
		host.registerCommand(OPEN_IN_SECONDARY_SIDEBAR_COMMAND, () =>
			openInSecondarySidebar(host, output)
		)
	);

	const statusItem = host.createStatusBarItem();
	statusItem.text = "$(comment-discussion) Chat";
	statusItem.tooltip = "Open Agent Chat (\u2318L)";
	statusItem.command = OPEN_IN_SECONDARY_SIDEBAR_COMMAND;
	statusItem.show();
	disposables.push({ dispose: () => statusItem.dispose() });

	// Fire-and-forget. Migration failures are non-fatal — the user can
	// always drag the view themselves, and we only attempt this once.
	runFirstActivationMigration(host, output).catch(() => {
		// errors are already logged inside the helper
	});

	return disposables;
}

/**
 * Reveals the chat view, opening the auxiliary (secondary) side bar
 * first if it is currently collapsed. Falls back to the primary sidebar
 * if VS Code rejects the auxiliary command (very old hosts).
 */
async function openInSecondarySidebar(
	host: AgentChatEntryPointsHost,
	output: OutputChannel
): Promise<void> {
	try {
		// `workbench.action.focusAuxiliaryBar` opens the secondary side
		// bar if it is hidden and focuses it. Safer than
		// `toggleAuxiliaryBar` which would close it when already open.
		await host.executeCommand("workbench.action.focusAuxiliaryBar");
	} catch (error) {
		output.appendLine(
			`[AgentChatEntry] focusAuxiliaryBar failed: ${describeError(error)}`
		);
	}

	try {
		await host.executeCommand(`${VIEW_ID}.focus`);
	} catch (error) {
		output.appendLine(
			`[AgentChatEntry] view focus failed: ${describeError(error)}`
		);
	}
}

/**
 * One-shot move of the `gatomia-chat` view container into the secondary
 * side bar so the chat appears on the right out of the box. After the
 * first run we set a flag in `globalState` and never try again — once
 * the user moves the view themselves we must not undo their preference.
 */
async function runFirstActivationMigration(
	host: AgentChatEntryPointsHost,
	output: OutputChannel
): Promise<void> {
	if (host.getGlobalStateFlag(MIGRATION_FLAG_KEY)) {
		return;
	}
	try {
		await host.executeCommand("vscode.moveViews", {
			viewIds: [VIEW_ID],
			destinationId: "workbench.view.auxiliary",
		});
		output.appendLine(
			`[AgentChatEntry] Moved ${VIEW_CONTAINER_ID} to the secondary side bar (first activation)`
		);
	} catch (error) {
		output.appendLine(
			`[AgentChatEntry] First-run migration skipped: ${describeError(error)}`
		);
	} finally {
		// Always record that we attempted the migration; we don't want
		// to retry on every activation even if VS Code rejected the
		// command above.
		try {
			await host.setGlobalStateFlag(MIGRATION_FLAG_KEY, true);
		} catch (error) {
			output.appendLine(
				`[AgentChatEntry] Failed to persist migration flag: ${describeError(error)}`
			);
		}
	}
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Adapter over the live `vscode` module so callers in `extension.ts`
 * don't have to know about the `AgentChatEntryPointsHost` shape.
 */
export function createDefaultEntryPointsHost(
	context: ExtensionContext
): AgentChatEntryPointsHost {
	// Imports are lazy so unit tests that import this module without a
	// running VS Code host don't crash on activation.
	const { commands, window, StatusBarAlignment } = require("vscode") as {
		commands: {
			registerCommand(
				id: string,
				handler: (...args: unknown[]) => unknown
			): Disposable;
			executeCommand(id: string, ...args: unknown[]): Thenable<unknown>;
		};
		window: {
			createStatusBarItem(
				alignment: number,
				priority?: number
			): {
				text: string;
				tooltip: string;
				command: string | undefined;
				show(): void;
				hide(): void;
				dispose(): void;
			};
		};
		StatusBarAlignment: { Left: number; Right: number };
	};

	return {
		registerCommand: (id, handler) => commands.registerCommand(id, handler),
		executeCommand: (id, ...args) =>
			Promise.resolve(commands.executeCommand(id, ...args)),
		createStatusBarItem: () =>
			window.createStatusBarItem(StatusBarAlignment.Right, 49),
		getGlobalStateFlag: (key) =>
			context.globalState.get<boolean>(key, false) === true,
		setGlobalStateFlag: async (key, value) => {
			await context.globalState.update(key, value);
		},
	};
}
