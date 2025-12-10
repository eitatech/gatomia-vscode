import { vscode } from "@/bridge/vscode";
import type { PreviewRefinementIssueType } from "@/features/preview/types";

export interface SubmitRefinementInput {
	documentId: string;
	documentType: string;
	documentVersion?: string;
	sectionRef?: string;
	issueType: PreviewRefinementIssueType;
	description: string;
}

export interface SubmitRefinementResult {
	requestId: string;
	status: "success" | "error";
	message?: string;
}

interface PendingRequest {
	resolve: (value: SubmitRefinementResult) => void;
	reject: (error: Error) => void;
	timer: number;
}

const pending = new Map<string, PendingRequest>();
let listenerRegistered = false;
const DEFAULT_TIMEOUT_MS = 10_000;

function ensureListener() {
	if (listenerRegistered || typeof window === "undefined") {
		return;
	}

	window.addEventListener("message", (event) => {
		const payload = event.data;
		if (!payload || typeof payload !== "object") {
			return;
		}

		if (payload.type !== "preview/refine/result" || !payload.payload) {
			return;
		}

		const { requestId, status, message } =
			payload.payload as SubmitRefinementResult;
		const pendingRequest = requestId ? pending.get(requestId) : undefined;
		if (!pendingRequest) {
			return;
		}

		window.clearTimeout(pendingRequest.timer);
		pending.delete(requestId);

		if (status === "error") {
			pendingRequest.reject(
				new Error(message ?? "Failed to submit refinement")
			);
			return;
		}

		pendingRequest.resolve({ requestId, status, message });
	});

	listenerRegistered = true;
}

function generateRequestId() {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `refine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function submitRefinement(
	input: SubmitRefinementInput
): Promise<SubmitRefinementResult> {
	ensureListener();

	const requestId = generateRequestId();

	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			pending.delete(requestId);
			reject(new Error("Refinement request timed out"));
		}, DEFAULT_TIMEOUT_MS);

		pending.set(requestId, { resolve, reject, timer });

		vscode.postMessage({
			type: "preview/refine/submit",
			payload: {
				requestId,
				...input,
				submittedAt: new Date().toISOString(),
			},
		});
	});
}
