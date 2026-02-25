/**
 * Devin Session Manager
 *
 * Orchestrates the creation and management of Devin sessions.
 * Handles mapping spec tasks to Devin prompts, creating API sessions,
 * and persisting session state locally.
 *
 * @see specs/001-devin-integration/data-model.md:L8-L37
 */

import type {
	CreateSessionRequest,
	DevinApiClientInterface,
} from "./devin-api-client";
import type { DevinCredentialsManager } from "./devin-credentials-manager";
import type { DevinSessionStorage } from "./devin-session-storage";
import type { DevinSession, DevinTask } from "./entities";
import { DevinInvalidSessionStateError } from "./errors";
import type { TaskPriority } from "./types";
import { SessionStatus, TaskStatus } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for starting a single task with Devin.
 */
export interface StartTaskParams {
	/** Path to the spec file */
	readonly specPath: string;
	/** Spec task ID */
	readonly taskId: string;
	/** Task title */
	readonly title: string;
	/** Task description */
	readonly description: string;
	/** Task priority */
	readonly priority: TaskPriority;
	/** Git branch to work on */
	readonly branch: string;
	/** Repository URL */
	readonly repoUrl: string;
	/** Acceptance criteria */
	readonly acceptanceCriteria?: string[];
}

/**
 * Parameters for generating a Devin prompt from task details.
 */
export interface PromptParams {
	readonly title: string;
	readonly description: string;
	readonly acceptanceCriteria?: string[];
}

// ============================================================================
// Session Manager
// ============================================================================

/**
 * Manages Devin session lifecycle: creation, storage, and cancellation.
 */
export class DevinSessionManager {
	private apiClient: DevinApiClientInterface | undefined;
	private readonly storage: DevinSessionStorage;
	private readonly credentials: DevinCredentialsManager;

	constructor(
		storage: DevinSessionStorage,
		credentials: DevinCredentialsManager,
		apiClient?: DevinApiClientInterface
	) {
		this.storage = storage;
		this.credentials = credentials;
		this.apiClient = apiClient;
	}

	/**
	 * Resolve an API client, creating one from stored credentials if needed.
	 */
	private async resolveApiClient(): Promise<DevinApiClientInterface> {
		if (this.apiClient) {
			return this.apiClient;
		}
		const creds = await this.credentials.getOrThrow();
		const { createDevinApiClient } = await import("./devin-api-client-factory");
		this.apiClient = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});
		return this.apiClient;
	}

	/**
	 * Get the underlying session storage instance.
	 */
	getStorage(): DevinSessionStorage {
		return this.storage;
	}

	/**
	 * Start a single task implementation with Devin.
	 *
	 * Creates a Devin session via the API, builds a local session record,
	 * and persists it to workspace state.
	 *
	 * @param params - Task details and context
	 * @returns The created local session
	 */
	async startTask(params: StartTaskParams): Promise<DevinSession> {
		const prompt = mapSpecTaskToDevinPrompt({
			title: params.title,
			description: params.description,
			acceptanceCriteria: params.acceptanceCriteria,
		});

		const request: CreateSessionRequest = {
			prompt,
			title: `Task ${params.taskId}: ${params.title}`,
			repos: [{ url: params.repoUrl, branch: params.branch }],
			tags: ["gatomia", `task-${params.taskId}`],
		};

		const client = await this.resolveApiClient();
		const response = await client.createSession(request);

		const task: DevinTask = {
			taskId: crypto.randomUUID(),
			specTaskId: params.taskId,
			title: params.title,
			description: params.description,
			acceptanceCriteria: params.acceptanceCriteria,
			priority: params.priority,
			status: TaskStatus.QUEUED,
			devinSessionId: response.sessionId,
			startedAt: Date.now(),
		};

		const session: DevinSession = {
			sessionId: response.sessionId,
			localId: crypto.randomUUID(),
			status: SessionStatus.INITIALIZING,
			branch: params.branch,
			specPath: params.specPath,
			tasks: [task],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			devinUrl: response.url,
			pullRequests: [],
			apiVersion: client.apiVersion,
			retryCount: 0,
		};

		await this.storage.save(session);
		await this.credentials.markUsed();

		return session;
	}

	/**
	 * Cancel an active session.
	 *
	 * Marks the local session and its tasks as cancelled.
	 * Note: Devin API does not expose a cancel endpoint; this only updates local state.
	 *
	 * @param localId - The local session ID
	 * @returns The updated session
	 * @throws {DevinSessionNotFoundError} If the session is not found
	 * @throws {DevinInvalidSessionStateError} If session is already in a terminal state
	 */
	async cancelSession(localId: string): Promise<DevinSession> {
		const session = this.storage.getByLocalId(localId);

		const terminalStates: string[] = [
			SessionStatus.COMPLETED,
			SessionStatus.FAILED,
			SessionStatus.CANCELLED,
		];

		if (terminalStates.includes(session.status)) {
			throw new DevinInvalidSessionStateError(localId, session.status, [
				SessionStatus.QUEUED,
				SessionStatus.INITIALIZING,
				SessionStatus.RUNNING,
			]);
		}

		const cancelledTasks = session.tasks.map((t) => ({
			...t,
			status: terminalStates.includes(t.status)
				? t.status
				: TaskStatus.CANCELLED,
			completedAt: terminalStates.includes(t.status)
				? t.completedAt
				: Date.now(),
		}));

		return await this.storage.update(localId, {
			status: SessionStatus.CANCELLED,
			tasks: cancelledTasks as DevinTask[],
			completedAt: Date.now(),
		});
	}
}

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Map spec task details to a Devin-compatible prompt string.
 *
 * Formats task title, description, and acceptance criteria into a
 * structured prompt that Devin can act on.
 */
export function mapSpecTaskToDevinPrompt(params: PromptParams): string {
	const parts: string[] = [];

	parts.push(`# Task: ${params.title}`);
	parts.push("");
	parts.push(params.description);

	if (params.acceptanceCriteria && params.acceptanceCriteria.length > 0) {
		parts.push("");
		parts.push("## Acceptance Criteria");
		for (const criterion of params.acceptanceCriteria) {
			parts.push(`- ${criterion}`);
		}
	}

	return parts.join("\n");
}
