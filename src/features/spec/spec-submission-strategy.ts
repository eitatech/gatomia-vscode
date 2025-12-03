import { Uri, workspace, window } from "vscode";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { SPEC_SYSTEM_MODE, type SpecSystemMode } from "../../constants";
import { SpecKitManager } from "./spec-kit-manager";

export interface SpecSubmissionContext {
	productContext: string;
	keyScenarios: string;
	technicalConstraints: string;
	relatedFiles: string;
	openQuestions: string;
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

		const payload = this.formatDescription(context);

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
		} catch (error) {
			throw new Error(
				"Required prompt file not found: .github/prompts/openspec-proposal.prompt.md"
			);
		}

		const prompt = `${promptTemplate}\n\nThe following sections describe the specification and context for this change request.\n\n${payload}\n\nIMPORTANT:\nAfter generating the proposal documents, you MUST STOP and ask the user for confirmation.\nDo NOT proceed with any implementation steps until the user has explicitly approved the proposal.`;

		await sendPromptToChat(prompt, { instructionType: "createSpec" });
	}

	private formatDescription(data: SpecSubmissionContext): string {
		const sections = [
			data.productContext.trim()
				? `Product Context / Goal:\n${data.productContext.trim()}`
				: undefined,
			data.keyScenarios.trim()
				? `Key Scenarios / Acceptance Criteria:\n${data.keyScenarios.trim()}`
				: undefined,
			data.technicalConstraints.trim()
				? `Technical Constraints:\n${data.technicalConstraints.trim()}`
				: undefined,
			data.relatedFiles.trim()
				? `Related Files / Impact:\n${data.relatedFiles.trim()}`
				: undefined,
			data.openQuestions.trim()
				? `Open Questions:\n${data.openQuestions.trim()}`
				: undefined,
		].filter(Boolean);

		return sections.join("\n\n");
	}
}

export class SpecKitSubmissionStrategy implements SpecSubmissionStrategy {
	async submit(context: SpecSubmissionContext): Promise<void> {
		// 1. Ask for feature name since it's required for Spec-Kit directory structure
		const name = await window.showInputBox({
			prompt: "Enter a name for the new feature (e.g., user-auth)",
			placeHolder: "feature-name",
			validateInput: (value) => (value ? null : "Name is required"),
		});

		if (!name) {
			return;
		}

		// 2. Create feature scaffolding
		const manager = SpecKitManager.getInstance();
		const featurePath = await manager.createFeature(name, context);

		// 3. Open the spec.md file
		const specUri = Uri.file(`${featurePath}/spec.md`);
		try {
			const doc = await workspace.openTextDocument(specUri);
			await window.showTextDocument(doc);
		} catch (error) {
			console.error("Failed to open spec file:", error);
		}

		// 4. Send prompt to Copilot to fill in the details
		const payload = this.formatDescription(context);
		const prompt = `/speckit.specify ${payload}`;

		await sendPromptToChat(prompt, { instructionType: "createSpec" });
	}

	private formatDescription(data: SpecSubmissionContext): string {
		// Simplified format for SpecKit command argument
		// We just concatenate the important parts
		return [data.productContext, data.keyScenarios, data.technicalConstraints]
			.filter(Boolean)
			.join("\n\n");
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
