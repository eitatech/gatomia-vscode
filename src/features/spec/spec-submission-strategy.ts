import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { SPEC_SYSTEM_MODE, type SpecSystemMode } from "../../constants";
import { workspace, Uri } from "vscode";

export interface SpecSubmissionContext {
	description: string;
	imageUris: string[];
}

export interface SpecSubmissionStrategy {
	submit(context: SpecSubmissionContext): Promise<void>;
}

export class OpenSpecSubmissionStrategy implements SpecSubmissionStrategy {
	async submit(context: SpecSubmissionContext): Promise<void> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error("No workspace folder open");
		}

		const promptUri = Uri.joinPath(
			workspaceFolder.uri,
			".github",
			"prompts",
			"openspec-proposal.prompt.md"
		);
		let promptTemplate = "";
		try {
			const fileData = await workspace.fs.readFile(promptUri);
			promptTemplate = new TextDecoder().decode(fileData);
		} catch {
			throw new Error(
				"Required prompt file not found: .github/prompts/openspec-proposal.prompt.md"
			);
		}

		const payload = context.description.trim();
		const prompt = `${promptTemplate}\n\nThe following describes the specification and context for this change request.\n\n${payload}\n\nIMPORTANT:\nAfter generating the proposal documents, you MUST STOP and ask the user for confirmation.\nDo NOT proceed with any implementation steps until the user has explicitly approved the proposal.`;

		const files =
			context.imageUris.length > 0
				? context.imageUris.map((uri) => Uri.parse(uri))
				: undefined;

		await sendPromptToChat(prompt, { instructionType: "createSpec" }, files);
	}
}

export class SpecKitSubmissionStrategy implements SpecSubmissionStrategy {
	async submit(context: SpecSubmissionContext): Promise<void> {
		const prompt = `/speckit.specify ${context.description.trim()}`;

		const files =
			context.imageUris.length > 0
				? context.imageUris.map((uri) => Uri.parse(uri))
				: undefined;

		await sendPromptToChat(prompt, { instructionType: "createSpec" }, files);
	}
}

export class SpecSubmissionStrategyFactory {
	static create(mode: SpecSystemMode): SpecSubmissionStrategy {
		switch (mode) {
			case SPEC_SYSTEM_MODE.SPECKIT:
				return new SpecKitSubmissionStrategy();
			default:
				return new OpenSpecSubmissionStrategy();
		}
	}
}
