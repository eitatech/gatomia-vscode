import { commands, type Uri, version as vscodeVersion } from "vscode";
import type { ChatDispatcher } from "../services/chat-dispatcher";
import { ConfigManager } from "./config-manager";

export interface ChatContext {
	instructionType?: "createSpec" | "startAllTask" | "runPrompt";
	/**
	 * Optional spec identifier. When provided and ACP session mode is
	 * `per-spec`, prompts belonging to the same spec share an ACP session.
	 */
	specId?: string;
}

const MINIMUM_FILES_SUPPORT_VERSION = "1.95.0";

let injectedDispatcher: ChatDispatcher | null = null;

/**
 * Wires an ACP-aware dispatcher into `sendPromptToChat`. Called from
 * `extension.activate()`. When no dispatcher is injected (for example in
 * older test setups), prompts fall through to the legacy direct chat path.
 */
export const setChatDispatcher = (dispatcher: ChatDispatcher | null): void => {
	injectedDispatcher = dispatcher;
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

/**
 * Applies GatomIA's prompt decorations (language + custom instructions) to the
 * user-provided prompt. Exposed for tests and for callers that need the final
 * string prior to dispatch.
 */
export const buildFinalPrompt = (
	prompt: string,
	context?: ChatContext
): string => {
	const configManager = ConfigManager.getInstance();
	const settings = configManager.getSettings();
	const language = settings.chatLanguage;
	const customInstructions = settings.customInstructions;

	let finalPrompt = prompt;

	if (customInstructions.global) {
		finalPrompt += `\n\n${customInstructions.global}`;
	}

	if (context?.instructionType) {
		const specificInstruction = customInstructions[context.instructionType];
		if (specificInstruction) {
			finalPrompt += `\n\n${specificInstruction}`;
		}
	}

	if (language !== "English") {
		finalPrompt += `\n\n(Please respond in ${language}.)`;
	}

	return finalPrompt;
};

export const sendPromptToChat = async (
	prompt: string,
	context?: ChatContext,
	files?: Uri[]
): Promise<void> => {
	const finalPrompt = buildFinalPrompt(prompt, context);

	if (injectedDispatcher) {
		await injectedDispatcher.dispatch(
			finalPrompt,
			{ specId: context?.specId },
			files
		);
		return;
	}

	const hasFiles = files && files.length > 0;
	if (hasFiles && supportsFilesParam()) {
		await commands.executeCommand("workbench.action.chat.open", {
			query: finalPrompt,
			files,
		});
	} else {
		await commands.executeCommand("workbench.action.chat.open", {
			query: finalPrompt,
		});
	}
};
