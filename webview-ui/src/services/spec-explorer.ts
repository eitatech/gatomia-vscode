/**
 * Spec Explorer messaging service for webview.
 * Handles communication between webview UI and extension host for review flow operations.
 */

// Local type aliases to avoid importing from extension context
export type SpecStatus = "current" | "readyToReview" | "reopened";
export type ChangeRequestStatus =
	| "open"
	| "blocked"
	| "inProgress"
	| "addressed";
export type ChangeRequestSeverity = "low" | "medium" | "high" | "critical";

export interface Specification {
	id: string;
	title: string;
	owner: string;
	status: SpecStatus;
	completedAt: Date | null;
	updatedAt: Date;
	links: { specPath: string; docUrl?: string };
	changeRequests?: ChangeRequest[];
}

export interface ChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: ChangeRequestSeverity;
	status: ChangeRequestStatus;
	tasks: any[];
	submitter: string;
	createdAt: Date;
	updatedAt: Date;
	sentToTasksAt: Date | null;
	notes?: string;
}

/**
 * Message types for spec explorer communication
 */
export type SpecExplorerMessage =
	| {
			type: "ready-to-review:fetch";
	  }
	| {
			type: "ready-to-review:specs-updated";
			payload: { specs: Specification[] };
	  }
	| {
			type: "changes:fetch";
	  }
	| {
			type: "changes:updated";
			payload: {
				items: Array<{
					spec: Specification;
					changeRequest: ChangeRequest;
				}>;
			};
	  }
	| {
			type: "change-request:file";
			payload: { specId: string };
	  }
	| {
			type: "change-request:submit";
			payload: {
				specId: string;
				title: string;
				description: string;
				severity: "low" | "medium" | "high" | "critical";
				submitter: string;
			};
	  }
	| {
			type: "change-request:submitted";
			payload: {
				success: boolean;
				error?: string;
			};
	  }
	| {
			type: "spec:navigate";
			payload: { specId: string; target: "spec" | "plan" | "design" };
	  };

/**
 * Spec Explorer service for webview
 */
export class SpecExplorerService {
	private readonly listeners: Map<string, Set<(data: any) => void>> = new Map();

	/**
	 * Initialize message listener from extension host
	 */
	initializeMessageListener(): void {
		if (typeof window !== "undefined" && "acquireVsCodeApi" in window) {
			const vscode = (window as any).acquireVsCodeApi();
			(window as any).specExplorerVscode = vscode;

			// Listen for messages from extension
			window.addEventListener("message", (event) => {
				const message = event.data as SpecExplorerMessage;
				this.handleMessage(message);
			});
		}
	}

	/**
	 * Handle incoming message from extension
	 */
	private handleMessage(message: SpecExplorerMessage): void {
		const listeners = this.listeners.get(message.type);
		if (listeners) {
			for (const listener of listeners) {
				listener((message as any).payload);
			}
		}
	}

	/**
	 * Send message to extension host
	 */
	sendMessage(message: SpecExplorerMessage): void {
		if (typeof window !== "undefined" && (window as any).specExplorerVscode) {
			(window as any).specExplorerVscode.postMessage(message);
		}
	}

	/**
	 * Subscribe to message type
	 */
	on<T extends SpecExplorerMessage["type"]>(
		type: T,
		listener: (data: any) => void
	): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)!.add(listener);

		// Return unsubscribe function
		return () => {
			this.listeners.get(type)?.delete(listener);
		};
	}

	/**
	 * Fetch ready-to-review specs from extension
	 */
	fetchReadyToReviewSpecs(): Promise<Specification[]> {
		return new Promise((resolve) => {
			const unsubscribe = this.on(
				"ready-to-review:specs-updated",
				(payload) => {
					unsubscribe();
					resolve(payload.specs);
				}
			);

			this.sendMessage({ type: "ready-to-review:fetch" });

			// Timeout after 5 seconds
			setTimeout(() => {
				unsubscribe();
				resolve([]);
			}, 5000);
		});
	}

	/**
	 * Fetch active change requests from extension
	 */
	fetchChangeRequests(): Promise<
		Array<{ spec: Specification; changeRequest: ChangeRequest }>
	> {
		return new Promise((resolve) => {
			const unsubscribe = this.on("changes:updated", (payload) => {
				unsubscribe();
				resolve(payload.items);
			});

			this.sendMessage({ type: "changes:fetch" });

			// Timeout after 5 seconds
			setTimeout(() => {
				unsubscribe();
				resolve([]);
			}, 5000);
		});
	}

	/**
	 * Request to file a change request for a spec
	 */
	fileChangeRequest(specId: string): void {
		this.sendMessage({ type: "change-request:file", payload: { specId } });
	}

	/**
	 * Submit a change request to the extension
	 */
	submitChangeRequest(options: {
		specId: string;
		title: string;
		description: string;
		severity: "low" | "medium" | "high" | "critical";
		submitter: string;
	}): void {
		this.sendMessage({
			type: "change-request:submit",
			payload: options,
		});
	}

	/**
	 * Navigate to a spec document
	 */
	navigateToSpec(
		specId: string,
		target: "spec" | "plan" | "design" = "spec"
	): void {
		this.sendMessage({ type: "spec:navigate", payload: { specId, target } });
	}
}

/**
 * Singleton instance
 */
export const specExplorerService = new SpecExplorerService();
