import {
	type OutputChannel,
	type Uri,
	commands,
	version as vscodeVersion,
	workspace,
} from "vscode";
import type { AcpSessionManager } from "./acp/acp-session-manager";
import type { SessionMode } from "./acp/types";
import type { ChatRouter } from "./chat-router";

export interface DispatchContext {
	/** Spec being operated on (enables per-spec session isolation). */
	specId?: string;
}

export interface ChatDispatcherOptions {
	router: ChatRouter;
	sessionManager: AcpSessionManager;
	output: OutputChannel;
}

const MINIMUM_FILES_SUPPORT_VERSION = "1.95.0";
const LEADING_SLASH_WS_REGEX = /^\/\s+/;
const SLASH_COMMAND_FIRST_LINE_REGEX =
	/^\/\s*([A-Za-z][\w.:-]*)(?:[ \t]+([^\n]*?))?\s*$/;

/**
 * Rewrites VS Code Copilot Chat slash-command prompts (e.g. `/speckit.implement foo`)
 * into a natural-language description that ACP-connected agents (Devin, Gemini CLI)
 * can understand. Without this, agents interpret the leading `/` as one of their
 * own built-in slash commands (`/help`, `/logout`, ...) and answer
 * `Unknown command: /`.
 *
 * The rewrite only touches the first line when it looks like a slash command.
 * Subsequent lines (task list, payload, etc.) are preserved verbatim.
 */
export const rewritePromptForAcp = (prompt: string): string => {
	const normalised = prompt.replace(LEADING_SLASH_WS_REGEX, "/");
	if (!normalised.startsWith("/")) {
		return prompt;
	}

	const newlineIdx = normalised.indexOf("\n");
	const firstLine =
		newlineIdx === -1 ? normalised : normalised.slice(0, newlineIdx);
	const rest = newlineIdx === -1 ? "" : normalised.slice(newlineIdx + 1);

	const match = firstLine.match(SLASH_COMMAND_FIRST_LINE_REGEX);
	if (!match) {
		// Starts with `/` but does not look like a command — drop just the slash.
		return `${firstLine.slice(1).trimStart()}${rest ? `\n${rest}` : ""}`;
	}

	const [, commandName, args = ""] = match;
	const trimmedArgs = args.trim();
	const header = trimmedArgs
		? `Run the "${commandName}" workflow with the following input: ${trimmedArgs}`
		: `Run the "${commandName}" workflow.`;
	return rest ? `${header}\n\n${rest}` : header;
};

/**
 * Orchestrates how GatomIA delivers a prompt:
 *
 * 1. Ask the {@link ChatRouter} where the prompt should go.
 * 2. If the decision is an ACP provider, hand off to the
 *    {@link AcpSessionManager}. Any error triggers a graceful fallback
 *    to the native chat command.
 * 3. Otherwise, dispatch via `workbench.action.chat.open` as before.
 */
export class ChatDispatcher {
	private readonly router: ChatRouter;
	private readonly sessionManager: AcpSessionManager;
	private readonly output: OutputChannel;

	constructor(options: ChatDispatcherOptions) {
		this.router = options.router;
		this.sessionManager = options.sessionManager;
		this.output = options.output;
	}

	async dispatch(
		prompt: string,
		context: DispatchContext,
		files?: Uri[]
	): Promise<void> {
		const decision = await this.router.resolve();

		if (decision.target.kind === "acp") {
			const providerId = decision.target.providerId;
			const mode = getSessionMode();
			const acpPrompt = rewritePromptForAcp(prompt);
			if (acpPrompt !== prompt) {
				this.output.appendLine(
					`[ChatDispatcher] rewrote slash-command prompt for ACP (${providerId})`
				);
			}
			try {
				await this.sessionManager.send(providerId, acpPrompt, {
					mode,
					specId: context.specId,
				});
				return;
			} catch (error) {
				this.output.appendLine(
					`[ChatDispatcher] ACP provider ${providerId} failed; falling back to Copilot Chat (${toMessage(error)})`
				);
				this.router.invalidateCache();
			}
		}

		await sendToCopilotChat(prompt, files);
	}
}

const getSessionMode = (): SessionMode => {
	const config = workspace.getConfiguration("gatomia");
	const raw = config.get<string>("acp.sessionMode", "workspace");
	if (raw === "per-spec" || raw === "per-prompt") {
		return raw;
	}
	return "workspace";
};

const supportsFilesParam = (): boolean => {
	const parts = vscodeVersion.split(".").map(Number);
	const minParts = MINIMUM_FILES_SUPPORT_VERSION.split(".").map(Number);
	for (let i = 0; i < minParts.length; i++) {
		if ((parts[i] ?? 0) > (minParts[i] ?? 0)) {
			return true;
		}
		if ((parts[i] ?? 0) < (minParts[i] ?? 0)) {
			return false;
		}
	}
	return true;
};

const sendToCopilotChat = async (
	prompt: string,
	files?: Uri[]
): Promise<void> => {
	const hasFiles = files && files.length > 0;
	if (hasFiles && supportsFilesParam()) {
		await commands.executeCommand("workbench.action.chat.open", {
			query: prompt,
			files,
		});
		return;
	}
	await commands.executeCommand("workbench.action.chat.open", {
		query: prompt,
	});
};

const toMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
