import { commands, type Uri, version as vscodeVersion } from "vscode";
import { ConfigManager } from "./config-manager";

export interface ChatContext {
	instructionType?: "createSpec" | "startAllTask" | "runPrompt";
}

const MINIMUM_FILES_SUPPORT_VERSION = "1.95.0";

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

export const sendPromptToChat = async (
	prompt: string,
	context?: ChatContext,
	files?: Uri[]
): Promise<void> => {
	const configManager = ConfigManager.getInstance();
	const settings = configManager.getSettings();
	const language = settings.chatLanguage;
	const customInstructions = settings.customInstructions;

	let finalPrompt = prompt;

	// Append global custom instruction
	if (customInstructions.global) {
		finalPrompt += `\n\n${customInstructions.global}`;
	}

	// Append specific custom instruction
	if (context?.instructionType) {
		const specificInstruction = customInstructions[context.instructionType];
		if (specificInstruction) {
			finalPrompt += `\n\n${specificInstruction}`;
		}
	}

	// Append language instruction
	if (language !== "English") {
		finalPrompt += `\n\n(Please respond in ${language}.)`;
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
