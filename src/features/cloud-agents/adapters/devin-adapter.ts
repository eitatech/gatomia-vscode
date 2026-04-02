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
import type * as vscode from "vscode";
import type { CloudAgentProvider } from "../cloud-agent-provider";
import { logInfo, logError } from "../logging";
import {
	SessionStatus,
	TaskStatus,
	ProviderError,
	ErrorCode,
	type AgentSession,
	type ProviderAction,
	type ProviderMetadata,
	type SessionContext,
	type SessionUpdate,
	type SpecTask,
} from "../types";
import { DevinCredentialsManager } from "../../devin/devin-credentials-manager";
import type { DevinApiClientInterface } from "../../devin/devin-api-client";
import { resolveSessionStatus } from "../../devin/status-mapper";

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
// Constants
// ============================================================================

const DEVIN_PLAYBOOK_KEY = "gatomia.devin.playbookId";

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Build a short referential Devin prompt.
 * Points the agent to read artifacts from the repository instead of pasting content.
 */
function buildDevinPrompt(task: SpecTask, context: SessionContext): string {
	const featurePath = context.featurePath ?? "";

	if (context.isFullFeature) {
		return buildFullFeaturePrompt(featurePath, context.branch);
	}

	const taskIds = context.taskIds ?? [task.id];
	return buildTaskBatchPrompt(featurePath, taskIds, context.branch);
}

function buildFullFeaturePrompt(featurePath: string, branch: string): string {
	return [
		"You are working in this repository and must execute a spec-driven implementation.",
		"",
		`Feature path: ${featurePath}`,
		"",
		"Read these files as source of truth (MANDATORY):",
		`- ${featurePath}/spec.md`,
		`- ${featurePath}/plan.md`,
		`- ${featurePath}/tasks.md`,
		"",
		"Also read if they exist:",
		`- ${featurePath}/research.md`,
		`- ${featurePath}/data-model.md`,
		`- ${featurePath}/contracts/ (all files)`,
		`- ${featurePath}/quickstart.md`,
		"",
		"Instructions:",
		"1. Read ALL artifacts before modifying any code.",
		"2. Summarize the objective and approach before implementing.",
		"3. Execute tasks in order defined in tasks.md.",
		"4. Do NOT expand scope beyond what is defined in the artifacts.",
		"5. Preserve existing patterns, conventions, and architecture.",
		"6. Run tests, lint, and validations.",
		"7. Fix failures before concluding.",
		"8. Mark completed tasks as [X] in tasks.md.",
		"9. Deliver: summary of changes, files altered, tests run, risks, PR title/description.",
		"",
		"Restrictions:",
		"- No broad refactors outside scope.",
		"- No changes to unrelated files without clear necessity.",
		"- If ambiguous, follow the most conservative interpretation and document the decision.",
		"- If essential context is missing, stop and state exactly what is needed.",
		"",
		buildBranchInstructions(branch),
	].join("\n");
}

function buildTaskBatchPrompt(
	featurePath: string,
	taskIds: string[],
	branch: string
): string {
	return [
		"You are working in this repository and must execute specific tasks from a spec-driven plan.",
		"",
		`Feature path: ${featurePath}`,
		"",
		"Read these files (MANDATORY):",
		`- ${featurePath}/spec.md`,
		`- ${featurePath}/plan.md`,
		`- ${featurePath}/tasks.md`,
		"",
		"Also read if they exist:",
		`- ${featurePath}/research.md`,
		`- ${featurePath}/data-model.md`,
		`- ${featurePath}/contracts/ (all files)`,
		`- ${featurePath}/quickstart.md`,
		"",
		`Execute ONLY these tasks: ${taskIds.join(", ")}`,
		"",
		"Rules:",
		"- Follow strictly the scope of the listed tasks.",
		"- Preserve repository patterns and conventions.",
		"- Run tests and lint for affected code.",
		"- Mark completed tasks as [X] in tasks.md.",
		"- Report files altered, validations executed, and any remaining risks.",
		"- Do NOT implement tasks outside the list above, even if they seem related.",
		"",
		buildBranchInstructions(branch),
	].join("\n");
}

function buildBranchInstructions(branch: string): string {
	if (!branch) {
		return "";
	}
	return [
		"Branch Instructions:",
		`You MUST create a new branch from \`${branch}\` and open the Pull Request targeting \`${branch}\`.`,
		"Do NOT target any other branch (e.g. main, master, develop, development).",
	].join("\n");
}

// ============================================================================
// Devin Status -> Cloud Agent Status Mapping
// ============================================================================

function mapDevinToCloudStatus(devinStatus: string): SessionStatus {
	switch (devinStatus) {
		case "queued":
		case "initializing":
			return SessionStatus.PENDING;
		case "running":
			return SessionStatus.RUNNING;
		case "blocked":
			return SessionStatus.BLOCKED;
		case "completed":
			return SessionStatus.COMPLETED;
		case "failed":
			return SessionStatus.FAILED;
		case "cancelled":
			return SessionStatus.CANCELLED;
		default:
			return SessionStatus.RUNNING;
	}
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

	private readonly credentialsManager: DevinCredentialsManager;
	private readonly secrets: SecretStorage;
	private apiClient: DevinApiClientInterface | undefined;

	constructor(secrets: SecretStorage, apiClient?: DevinApiClientInterface) {
		this.secrets = secrets;
		this.credentialsManager = new DevinCredentialsManager(
			secrets as unknown as vscode.SecretStorage
		);
		this.apiClient = apiClient;
	}

	// ========================================================================
	// Configuration
	// ========================================================================

	hasCredentials(): Promise<boolean> {
		return this.credentialsManager.hasCredentials();
	}

	async configureCredentials(): Promise<boolean> {
		const apiKey = await window.showInputBox({
			prompt: "Enter your Devin API token",
			placeHolder: "cog_... or apk_...",
			password: true,
			ignoreFocusOut: true,
		});

		if (!apiKey) {
			return false;
		}

		let orgId: string | undefined;
		if (apiKey.startsWith("cog_")) {
			orgId = await window.showInputBox({
				prompt: "Enter your Devin Organization ID (required for v3 API)",
				placeHolder: "org-...",
				ignoreFocusOut: true,
			});
			if (!orgId) {
				return false;
			}
		}

		const playbookId = await window.showInputBox({
			prompt: "Enter your Devin Playbook ID (optional, press Enter to skip)",
			placeHolder: "playbook-...",
			ignoreFocusOut: true,
		});

		try {
			await this.credentialsManager.store(apiKey, orgId);
			if (playbookId) {
				await this.secrets.store(DEVIN_PLAYBOOK_KEY, playbookId);
			}
			this.apiClient = undefined;
			logInfo("Devin credentials configured via Cloud Agents");
			return true;
		} catch (error) {
			logError("Failed to store Devin credentials", error);
			return false;
		}
	}

	// ========================================================================
	// Session Lifecycle
	// ========================================================================

	private async resolveApiClient(): Promise<DevinApiClientInterface> {
		if (this.apiClient) {
			return this.apiClient;
		}
		const creds = await this.credentialsManager.getOrThrow();
		const { createDevinApiClient } = await import(
			"../../devin/devin-api-client-factory"
		);
		this.apiClient = createDevinApiClient({
			token: creds.apiKey,
			orgId: creds.orgId,
		});
		return this.apiClient;
	}

	async createSession(
		task: SpecTask,
		context: SessionContext
	): Promise<AgentSession> {
		let client: DevinApiClientInterface;
		try {
			client = await this.resolveApiClient();
		} catch {
			throw new ProviderError(
				"Devin credentials not configured. Please configure credentials first.",
				ErrorCode.CREDENTIALS_MISSING,
				DevinAdapter.PROVIDER_ID,
				true
			);
		}

		const prompt = buildDevinPrompt(task, context);
		const repos = context.repoUrl
			? [{ url: context.repoUrl, branch: context.branch }]
			: [];
		const playbookId = await this.secrets.get(DEVIN_PLAYBOOK_KEY);
		const response = await client.createSession({
			prompt,
			title: `${task.id}: ${task.title}`,
			tags: ["gatomia", `task-${task.id}`],
			...(repos.length > 0 ? { repos } : {}),
			...(playbookId ? { playbookId } : {}),
		});

		const now = Date.now();
		const session: AgentSession = {
			localId: crypto.randomUUID(),
			providerId: DevinAdapter.PROVIDER_ID,
			providerSessionId: response.sessionId,
			status: SessionStatus.PENDING,
			branch: context.branch,
			specPath: context.specPath,
			tasks: [
				{
					id: `task-${response.sessionId}`,
					specTaskId: task.id,
					title: task.title,
					description: task.description,
					priority: task.priority,
					status: TaskStatus.PENDING,
					startedAt: now,
				},
			],
			pullRequests: [],
			createdAt: now,
			updatedAt: now,
			completedAt: undefined,
			isReadOnly: false,
			externalUrl: response.url || undefined,
		};

		await this.credentialsManager.markUsed();
		logInfo(
			`Devin session created: ${session.localId} (API: ${response.sessionId}) for task ${task.id}`
		);
		return session;
	}

	cancelSession(sessionId: string): Promise<void> {
		logInfo(
			`Devin session cancel requested: ${sessionId} (Devin API does not support cancellation)`
		);
		return Promise.resolve();
	}

	// ========================================================================
	// Status & Polling
	// ========================================================================

	async pollSessions(sessions: AgentSession[]): Promise<SessionUpdate[]> {
		if (sessions.length === 0) {
			return [];
		}

		let client: DevinApiClientInterface;
		try {
			client = await this.resolveApiClient();
		} catch {
			return [];
		}

		const updates: SessionUpdate[] = [];

		for (const session of sessions) {
			if (!session.providerSessionId) {
				continue;
			}

			try {
				const response = await client.getSession(session.providerSessionId);
				const devinStatus = resolveSessionStatus(
					response.status,
					response.statusDetail
				);
				const mappedStatus = mapDevinToCloudStatus(devinStatus);

				if (
					mappedStatus === session.status &&
					response.pullRequests.length === 0
				) {
					continue;
				}

				const updateEntry: SessionUpdate = {
					localId: session.localId,
					status: mappedStatus,
					timestamp: Date.now(),
					externalUrl: response.url || session.externalUrl,
				};
				if (response.pullRequests.length > 0) {
					updateEntry.pullRequests = response.pullRequests.map((pr) => {
						const existing = session.pullRequests.find(
							(p) => p.url === pr.prUrl
						);
						return {
							url: pr.prUrl,
							state: pr.prState,
							branch: session.branch,
							createdAt: existing?.createdAt ?? Date.now(),
						};
					});
				}
				updates.push(updateEntry);
			} catch (error) {
				logError(
					`Failed to poll Devin session ${session.providerSessionId}`,
					error
				);
			}
		}

		return updates;
	}

	getExternalUrl(session: AgentSession): string | undefined {
		return session.externalUrl;
	}

	getStatusDisplay(session: AgentSession): string {
		return session.status;
	}

	// ========================================================================
	// Event Handlers
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
