/**
 * GitHub Copilot Coding Agent Adapter
 *
 * Implements the CloudAgentProvider interface for GitHub Copilot coding agent.
 * Uses GitHub GraphQL API for issue assignment and session tracking.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 * @see specs/016-multi-provider-agents/research.md (GitHub Copilot Coding Agent API)
 */

import { window } from "vscode";
import type { CloudAgentProvider } from "../cloud-agent-provider";
import { logInfo } from "../logging";
import {
	ProviderError,
	ErrorCode,
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

const GITHUB_SECRET_KEY = "gatomia.github-copilot.token";

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
// GitHubCopilotAdapter
// ============================================================================

/**
 * GitHub Copilot coding agent provider adapter.
 * Assigns issues to Copilot and tracks PRs via GitHub API.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 */
export class GitHubCopilotAdapter implements CloudAgentProvider {
	static readonly PROVIDER_ID = "github-copilot" satisfies string;

	readonly metadata: ProviderMetadata = {
		id: GitHubCopilotAdapter.PROVIDER_ID,
		displayName: "GitHub Copilot",
		description: "GitHub Copilot coding agent (issue-to-PR)",
		icon: "github",
	};

	private readonly secrets: SecretStorage;

	constructor(secrets: SecretStorage) {
		this.secrets = secrets;
	}

	// ========================================================================
	// Configuration
	// ========================================================================

	async hasCredentials(): Promise<boolean> {
		const token = await this.secrets.get(GITHUB_SECRET_KEY);
		return token !== undefined;
	}

	async configureCredentials(): Promise<boolean> {
		const token = await window.showInputBox({
			prompt: "Enter your GitHub Personal Access Token",
			placeHolder: "ghp_... or github_pat_...",
			password: true,
			ignoreFocusOut: true,
		});

		if (!token) {
			return false;
		}

		await this.secrets.store(GITHUB_SECRET_KEY, token);
		logInfo("GitHub Copilot credentials configured");
		return true;
	}

	// ========================================================================
	// Session Lifecycle
	// ========================================================================

	createSession(
		_task: SpecTask,
		_context: SessionContext
	): Promise<AgentSession> {
		throw new ProviderError(
			"GitHub Copilot coding agent integration is not yet implemented. Please use a different provider.",
			ErrorCode.SESSION_CREATION_FAILED,
			GitHubCopilotAdapter.PROVIDER_ID,
			false
		);
	}

	cancelSession(sessionId: string): Promise<void> {
		logInfo(`GitHub Copilot session cancel requested: ${sessionId}`);
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
	// Event Handlers (stub - implemented in Phase 6, T057)
	// ========================================================================

	handleBlockedSession(session: AgentSession): ProviderAction | null {
		if (session.externalUrl) {
			return { type: "openUrl", url: session.externalUrl };
		}
		return null;
	}

	handleSessionComplete(_session: AgentSession): Promise<void> {
		logInfo("GitHub Copilot session completed");
		return Promise.resolve();
	}
}
