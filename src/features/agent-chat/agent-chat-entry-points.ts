/**
 * AgentChatEntryPoints — registers user-facing entry surfaces for the
 * agent chat sidebar that the host VS Code does not expose natively:
 *
 *   1. Command `gatomia.agentChat.openInSecondarySidebar` that focuses
 *      the chat view, opening the auxiliary side bar first when the
 *      host supports it. Bound to Cmd+L / Ctrl+L via
 *      `package.json#contributes.keybindings`.
 *   2. Status bar item rendering "$(comment-discussion) Chat" on the
 *      right side. Click forwards to the same command.
 *
 * Placement of the chat view itself is handled declaratively in
 * `package.json#contributes.views`: the view is declared twice (once
 * inside the auxiliary `gatomia-chat` container, once inside the
 * primary `gatomia` container) and gated by the
 * `gatomia.host.chatInPrimary` context key set during activation. We
 * deliberately do not call `vscode.moveViews` here — that command
 * cannot move a view into a *location* (only into another container),
 * see microsoft/vscode#156527, so the static declaration + context
 * key is the only reliable mechanism for cross-host placement.
 *
 * VS Code intentionally does not let extensions inject icons into the
 * native title bar (between the sidebar toggles). Combining the
 * keybind + status-bar entry is the closest sanctioned pattern.
 *
 * All side effects are funnelled through a thin `Host` interface so
 * the unit tests can drive the module without spinning up VS Code.
 */

import type { Disposable, ExtensionContext, OutputChannel } from "vscode";
import { detectIdeHost, type IdeHost } from "../../utils/ide-host-detector";

/**
 * Public command id used by the keybinding, the status bar item, and the
 * command palette entry. Kept as a constant so package.json + runtime
 * stay in sync via grep.
 */
export const OPEN_IN_SECONDARY_SIDEBAR_COMMAND =
	"gatomia.agentChat.openInSecondarySidebar";

/**
 * Ids of the chat views declared in `package.json#contributes.views`.
 * The view ships in two containers because `vscode.moveViews` cannot
 * relocate a view to a side-bar *location* at runtime — see the file
 * header. Only one of the two ids is visible at a time, gated by the
 * `gatomia.host.chatInPrimary` context key.
 */
const VIEW_ID_AUXILIARY = "gatomia.views.agentChat";
const VIEW_ID_PRIMARY = "gatomia.views.agentChatPrimary";

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
	/**
	 * Identifier of the IDE the extension is running in. Used to choose
	 * which declared chat view id to focus and whether the auxiliary
	 * side bar should be opened first.
	 */
	getIdeHost(): IdeHost;
}

/**
 * Returns `true` when the running host has a usable auxiliary side bar
 * we can place the chat into. Windsurf and Antigravity reserve the
 * auxiliary bar for their own AI chat surface, so we keep the chat in
 * the primary `gatomia` container there. Every other recognised host
 * (stock VS Code, Insiders, Cursor, VSCodium, Positron) supports the
 * auxiliary bar, and `unknown` falls through to the auxiliary path so
 * future forks inherit the better default.
 */
export function shouldUseAuxiliaryBar(host: IdeHost): boolean {
	return host !== "windsurf" && host !== "antigravity";
}

/**
 * Wires the command + status-bar item. The caller is responsible for
 * adding the returned disposables to the extension context so they are
 * released on deactivate.
 */
export function registerAgentChatEntryPoints(
	host: AgentChatEntryPointsHost,
	output: OutputChannel
): Disposable[] {
	const disposables: Disposable[] = [];

	disposables.push(
		host.registerCommand(OPEN_IN_SECONDARY_SIDEBAR_COMMAND, () =>
			openAgentChat(host, output)
		)
	);

	const statusItem = host.createStatusBarItem();
	statusItem.text = "$(comment-discussion) Chat";
	statusItem.tooltip = "Open Agent Chat (\u2318L)";
	statusItem.command = OPEN_IN_SECONDARY_SIDEBAR_COMMAND;
	statusItem.show();
	disposables.push({ dispose: () => statusItem.dispose() });

	return disposables;
}

/**
 * Reveals the chat view. Hosts with a usable auxiliary side bar
 * (stock VS Code, Cursor, Insiders, VSCodium, Positron) get the bar
 * opened first so the focused view is actually on screen; hosts that
 * keep the chat in the primary container (Windsurf, Antigravity) skip
 * that step. We then issue `<viewId>.focus` for both declared ids and
 * let the inactive one no-op — `package.json` only renders one of the
 * two at a time, so issuing both is harmless and keeps this helper
 * agnostic of the context-key state.
 */
async function openAgentChat(
	host: AgentChatEntryPointsHost,
	output: OutputChannel
): Promise<void> {
	const useAux = shouldUseAuxiliaryBar(host.getIdeHost());
	if (useAux) {
		try {
			// `workbench.action.focusAuxiliaryBar` opens the secondary
			// side bar if it is hidden and focuses it. Safer than
			// `toggleAuxiliaryBar` which would close it when already
			// open.
			await host.executeCommand("workbench.action.focusAuxiliaryBar");
		} catch (error) {
			output.appendLine(
				`[AgentChatEntry] focusAuxiliaryBar failed: ${describeError(error)}`
			);
		}
	}

	for (const viewId of [VIEW_ID_AUXILIARY, VIEW_ID_PRIMARY]) {
		try {
			await host.executeCommand(`${viewId}.focus`);
		} catch (error) {
			output.appendLine(
				`[AgentChatEntry] view focus failed for ${viewId}: ${describeError(error)}`
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
	_context: ExtensionContext
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
		getIdeHost: () => detectIdeHost(),
	};
}
