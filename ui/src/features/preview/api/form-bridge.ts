import { vscode } from "@/bridge/vscode";

export interface FormFieldDelta {
	fieldId: string;
	value: string | string[];
	dirty: boolean;
}

export interface FormSubmissionPayload {
	documentId: string;
	sessionId: string;
	fields: FormFieldDelta[];
	submittedAt: string;
	requestId?: string;
}

export interface FormSubmissionResult {
	requestId: string;
	status: "success" | "error";
	message?: string;
}

interface PendingRequest {
	resolve: (result: FormSubmissionResult) => void;
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

		if (payload.type !== "preview/forms/result") {
			return;
		}

		const data = payload.payload as FormSubmissionResult | undefined;
		if (!data?.requestId) {
			return;
		}

		const pendingRequest = pending.get(data.requestId);
		if (!pendingRequest) {
			return;
		}

		window.clearTimeout(pendingRequest.timer);
		pending.delete(data.requestId);
		pendingRequest.resolve(data);
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
	return `form-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function submitForm(
	payload: FormSubmissionPayload
): Promise<FormSubmissionResult> {
	if (payload.fields.length === 0) {
		return Promise.reject(new Error("No fields changed"));
	}

	ensureListener();

	const requestId = payload.requestId ?? generateRequestId();

	return new Promise<FormSubmissionResult>((resolve, reject) => {
		const timer = window.setTimeout(() => {
			pending.delete(requestId);
			reject(new Error("Form submission timed out"));
		}, DEFAULT_TIMEOUT_MS);

		pending.set(requestId, { resolve, reject, timer });

		vscode.postMessage({
			type: "preview/forms/submit",
			payload: {
				...payload,
				requestId,
			},
		});
	});
}
