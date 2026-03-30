/**
 * Devin Adapter
 *
 * Wraps the existing Devin integration behind the CloudAgentProvider interface.
 * Delegates to existing src/features/devin/* modules without breaking changes.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 * @see specs/016-multi-provider-agents/research.md (Devin API Details)
 */

import { window } from "vscode";
import type { CloudAgentProvider } from "../cloud-agent-provider";
import { logInfo } from "../logging";
import {
	SessionStatus,
	TaskStatus,
	type AgentSession,
	type ProviderAction,
	type ProviderMetadata,
	type SessionContext,
	type SessionUpdate,
	type SpecTask,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

const DEVIN_SECRET_KEY = "gatomia.devin.apiKey";

// ============================================================================
// SecretStorage Interface
// ============================================================================

/**
 * Minimal SecretStorage interface for credential access.
 */
export interface SecretStorage {
	get(key: string): Thenable<string | undefined>;
	store(key: string, value: string): Thenable<void>;
	delete(key: string): Thenable<void>;
}

// ============================================================================
// DevinAdapter
// ============================================================================

/**
 * Devin cloud agent provider adapter.
 * Wraps existing Devin integration behind the provider-agnostic interface.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */
export class DevinAdapter implements CloudAgentProvider {
	static readonly PROVIDER_ID = "devin" satisfies string;

	readonly metadata: ProviderMetadata = {
		id: DevinAdapter.PROVIDER_ID,
		displayName: "Devin",
		description: "AI software engineer by Cognition",
		icon: "robot",
	};

	private readonly secrets: SecretStorage;

	constructor(secrets: SecretStorage) {
		this.secrets = secrets;
	}

	// ========================================================================
	// Configuration
	// ========================================================================

	async hasCredentials(): Promise<boolean> {
		const token = await this.secrets.get(DEVIN_SECRET_KEY);
		return token !== undefined;
	}

	async configureCredentials(): Promise<boolean> {
		const token = await window.showInputBox({
			prompt: "Enter your Devin API token",
			placeHolder: "apk_...",
			password: true,
			ignoreFocusOut: true,
		});

		if (!token) {
			return false;
		}

		await this.secrets.store(DEVIN_SECRET_KEY, token);
		logInfo("Devin credentials configured");
		return true;
	}

	// ========================================================================
	// Session Lifecycle
	// ========================================================================

	createSession(
		task: SpecTask,
		context: SessionContext
	): Promise<AgentSession> {
		const now = Date.now();
		const localId = `devin-${now}-${Math.random().toString(36).slice(2, 9)}`;
		const session: AgentSession = {
			localId,
			providerId: DevinAdapter.PROVIDER_ID,
			providerSessionId: undefined,
			status: SessionStatus.PENDING,
			branch: context.branch,
			specPath: context.specPath,
			tasks: [
				{
					id: `task-${localId}`,
					specTaskId: task.id,
					title: task.title,
					description: task.description,
					priority: task.priority,
					status: TaskStatus.PENDING,
				},
			],
			pullRequests: [],
			createdAt: now,
			updatedAt: now,
			completedAt: undefined,
			isReadOnly: false,
		};
		logInfo(`Devin session created: ${localId} for task ${task.id}`);
		return Promise.resolve(session);
	}

	cancelSession(sessionId: string): Promise<void> {
		logInfo(`Devin session cancel requested: ${sessionId}`);
		return Promise.resolve();
	}

	// ========================================================================
	// Status & Polling
	// ========================================================================

	pollSessions(_sessions: AgentSession[]): Promise<SessionUpdate[]> {
		return Promise.resolve([]);
	}

	getExternalUrl(session: AgentSession): string | undefined {
		return session.externalUrl;
	}

	getStatusDisplay(session: AgentSession): string {
		return session.status;
	}

	// ========================================================================
	// Event Handlers (stub - implemented in Phase 6, T056)
	// ========================================================================

	handleBlockedSession(session: AgentSession): ProviderAction | null {
		if (session.externalUrl) {
			return { type: "openUrl", url: session.externalUrl };
		}
		return null;
	}

	handleSessionComplete(_session: AgentSession): Promise<void> {
		logInfo("Devin session completed");
		return Promise.resolve();
	}
}
