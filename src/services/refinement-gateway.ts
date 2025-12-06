import { randomUUID } from "node:crypto";
import type { OutputChannel } from "vscode";
import { env } from "vscode";
import type { RefinementRequestPayload } from "../types/preview";

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

	submitRequest(payload: RefinementRequestPayload): Promise<RefinementResult> {
		const requestId = payload.requestId || randomUUID();
		const reporterId = env.machineId;

		this.outputChannel.appendLine(
			`[RefinementGateway] Received ${payload.issueType} request ${requestId} for ${payload.documentId} (reporter: ${reporterId})`
		);

		// Placeholder for future API integration. At this stage we optimistically
		// acknowledge the request so the UI can show confirmation.
		return Promise.resolve({
			requestId,
			status: "success",
			message: "Refinement request queued",
		});
	}
}
