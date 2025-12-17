import { randomUUID } from "node:crypto";
import type { OutputChannel } from "vscode";
import { env } from "vscode";
import type {
	RefinementRequestPayload,
	PreviewDocumentType,
} from "../types/preview";
import { sendPromptToChat } from "../utils/chat-prompt-runner";

export interface RefinementResult {
	requestId: string;
	status: "success" | "error";
	message?: string;
}

export class RefinementGateway {
	private readonly outputChannel: OutputChannel;

	constructor(outputChannel: OutputChannel) {
		this.outputChannel = outputChannel;
	}

	/**
	 * Maps document types to their appropriate SpecKit/OpenSpec commands
	 */
	private getAgentCommandForDocumentType(docType: PreviewDocumentType): string {
		const commandMap: Record<PreviewDocumentType, string> = {
			spec: "/speckit.specify",
			plan: "/speckit.plan",
			task: "/speckit.tasks",
			research: "/speckit.research",
			dataModel: "/speckit.specify",
			api: "/speckit.specify",
			quickstart: "/speckit.specify",
			checklist: "/speckit.checklist",
		};

		return commandMap[docType] || "/speckit.clarify";
	}

	/**
	 * Formats the refinement request into a proper prompt for the agent
	 */
	private formatRefinementPrompt(payload: RefinementRequestPayload): string {
		const {
			documentId,
			documentType,
			sectionRef,
			issueType,
			description,
			actionType,
			changedDependencies,
		} = payload;

		const command = this.getAgentCommandForDocumentType(documentType);
		const section = sectionRef ? ` (Section: ${sectionRef})` : "";

		// Handle "update" action type differently
		if (
			actionType === "update" &&
			changedDependencies &&
			changedDependencies.length > 0
		) {
			const depList = changedDependencies
				.map((dep) => `- ${dep.documentId} (${dep.documentType})`)
				.join("\n");

			return `${command}

Update the current document "${documentId}"${section} according to the updates in the following dependent documents:

${depList}

${description ? `**Additional Context**:\n${description}\n\n` : ""}Please ensure that all necessary changes have been made, maintaining consistency and adherence to the specifications. The document should be complete and properly synchronized with its dependencies.`;
		}

		// Handle standard "refine" action
		const issueTypeLabel = this.getIssueTypeLabel(issueType);

		return `${command}

According to our review, the document "${documentId}"${section} must be refined with the following information:

**Issue Type**: ${issueTypeLabel}

**Refinement Request**:
${description}

Please update the document accordingly.`;
	}

	/**
	 * Converts issue type to human-readable label
	 */
	private getIssueTypeLabel(issueType: string): string {
		const labels: Record<string, string> = {
			missingDetail: "Missing Detail",
			incorrectInfo: "Incorrect Information",
			missingAsset: "Missing Asset",
			other: "Other",
		};
		return labels[issueType] || issueType;
	}

	async submitRequest(
		payload: RefinementRequestPayload
	): Promise<RefinementResult> {
		const requestId = payload.requestId || randomUUID();
		const reporterId = env.machineId;

		this.outputChannel.appendLine(
			`[RefinementGateway] Processing ${payload.issueType} request ${requestId} for ${payload.documentId} (reporter: ${reporterId})`
		);

		try {
			// Format and send refinement request to appropriate agent
			const prompt = this.formatRefinementPrompt(payload);

			this.outputChannel.appendLine(
				`[RefinementGateway] Sending refinement to ${payload.documentType} agent`
			);
			this.outputChannel.appendLine(
				`[RefinementGateway] Prompt: ${prompt.substring(0, 200)}...`
			);

			await sendPromptToChat(prompt);

			this.outputChannel.appendLine(
				`[RefinementGateway] Successfully sent refinement request ${requestId} to chat`
			);

			return {
				requestId,
				status: "success",
				message: "Refinement request sent to agent",
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[RefinementGateway] Failed to send refinement request ${requestId}: ${message}`
			);

			return {
				requestId,
				status: "error",
				message: `Failed to send refinement: ${message}`,
			};
		}
	}
}
