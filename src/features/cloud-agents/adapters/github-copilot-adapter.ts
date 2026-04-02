/**
 * GitHub Copilot Coding Agent Adapter
 *
 * Implements the CloudAgentProvider interface for GitHub Copilot coding agent.
 * Creates GitHub Issues assigned to Copilot and tracks PRs via the GitHub GraphQL API.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-adapter.md
 * @see specs/016-multi-provider-agents/research.md (GitHub Copilot Coding Agent API)
 */

import { window } from "vscode";
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

// ============================================================================
// Constants
// ============================================================================

const GITHUB_SECRET_KEY = "gatomia.github-copilot.token";
const GITHUB_REPO_KEY = "gatomia.github-copilot.repo";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const ISSUE_REF_PATTERN = /^([^/]+)\/([^#]+)#(\d+)$/;

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
// GitHub GraphQL Response Types
// ============================================================================

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string }>;
}

interface CreateIssueData {
	createIssue: {
		issue: {
			id: string;
			number: number;
			url: string;
		};
	};
}

interface IssueQueryData {
	repository: {
		issue: {
			state: string;
			stateReason: string | null;
			timelineItems: {
				nodes: Array<{
					__typename: string;
					source?: {
						url: string;
						state: string;
						title: string;
						number: number;
					};
				}>;
			};
		};
	};
}

interface RepoIdData {
	repository: {
		id: string;
	};
}

// ============================================================================
// GitHubCopilotAdapter
// ============================================================================

/**
 * GitHub Copilot coding agent provider adapter.
 * Creates GitHub Issues assigned to Copilot and tracks resulting PRs.
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
			prompt: "Enter your GitHub Personal Access Token (needs repo scope)",
			placeHolder: "ghp_... or github_pat_...",
			password: true,
			ignoreFocusOut: true,
		});

		if (!token) {
			return false;
		}

		const repo = await window.showInputBox({
			prompt: "Enter the repository (owner/repo format)",
			placeHolder: "myorg/myrepo",
			ignoreFocusOut: true,
		});

		if (!repo) {
			return false;
		}

		await this.secrets.store(GITHUB_SECRET_KEY, token);
		await this.secrets.store(GITHUB_REPO_KEY, repo);
		logInfo("GitHub Copilot credentials and repository configured");
		return true;
	}

	// ========================================================================
	// Session Lifecycle
	// ========================================================================

	async createSession(
		task: SpecTask,
		context: SessionContext
	): Promise<AgentSession> {
		const token = await this.secrets.get(GITHUB_SECRET_KEY);
		const repo = await this.secrets.get(GITHUB_REPO_KEY);

		if (!token) {
			throw new ProviderError(
				"GitHub token not configured.",
				ErrorCode.CREDENTIALS_MISSING,
				GitHubCopilotAdapter.PROVIDER_ID,
				true
			);
		}
		if (!repo) {
			throw new ProviderError(
				"GitHub repository not configured.",
				ErrorCode.CREDENTIALS_MISSING,
				GitHubCopilotAdapter.PROVIDER_ID,
				true
			);
		}

		const [owner, repoName] = repo.split("/");
		if (!owner) {
			throw new ProviderError(
				"Invalid repository format. Expected owner/repo.",
				ErrorCode.SESSION_CREATION_FAILED,
				GitHubCopilotAdapter.PROVIDER_ID,
				true
			);
		}
		if (!repoName) {
			throw new ProviderError(
				"Invalid repository format. Expected owner/repo.",
				ErrorCode.SESSION_CREATION_FAILED,
				GitHubCopilotAdapter.PROVIDER_ID,
				true
			);
		}

		const repoId = await this.getRepositoryId(token, owner, repoName);
		const issueBody = this.buildIssueBody(task, context);
		const issue = await this.createCopilotIssue(token, {
			repoId,
			title: `${task.id}: ${task.title}`,
			body: issueBody,
			baseRef: context.branch,
		});

		const now = Date.now();
		const session: AgentSession = {
			localId: crypto.randomUUID(),
			providerId: GitHubCopilotAdapter.PROVIDER_ID,
			providerSessionId: `${owner}/${repoName}#${issue.number}`,
			status: SessionStatus.PENDING,
			branch: context.branch,
			specPath: context.specPath,
			tasks: [
				{
					id: `task-issue-${issue.number}`,
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
			externalUrl: issue.url,
		};

		logInfo(
			`GitHub Copilot session created: issue #${issue.number} for task ${task.id}`
		);
		return session;
	}

	cancelSession(sessionId: string): Promise<void> {
		logInfo(
			`GitHub Copilot session cancel requested: ${sessionId} (close the issue/PR manually)`
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

		const token = await this.secrets.get(GITHUB_SECRET_KEY);
		if (!token) {
			return [];
		}

		const updates: SessionUpdate[] = [];

		for (const session of sessions) {
			const parsed = this.parseIssueRef(session.providerSessionId);
			if (!parsed) {
				continue;
			}

			try {
				const result = await this.queryIssueStatus(
					token,
					parsed.owner,
					parsed.repo,
					parsed.number
				);
				const update = this.mapIssueToUpdate(session, result);
				if (update) {
					updates.push(update);
				}
			} catch (error) {
				logError(
					`Failed to poll GitHub issue ${session.providerSessionId}`,
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
		logInfo("GitHub Copilot session completed");
		return Promise.resolve();
	}

	// ========================================================================
	// Private Helpers
	// ========================================================================

	private buildIssueBody(task: SpecTask, context: SessionContext): string {
		const featurePath = context.featurePath ?? "";
		const taskIds = context.taskIds ?? [task.id];

		return [
			`## Task: ${task.title}`,
			"",
			task.description,
			"",
			`**Feature path**: ${featurePath}`,
			`**Branch**: ${context.branch}`,
			`**Priority**: ${task.priority}`,
			"",
			"## Spec Artifacts (read from repo)",
			`- ${featurePath}/spec.md`,
			`- ${featurePath}/plan.md`,
			`- ${featurePath}/tasks.md`,
			`- ${featurePath}/research.md (if exists)`,
			`- ${featurePath}/data-model.md (if exists)`,
			`- ${featurePath}/contracts/ (if exists)`,
			"",
			context.isFullFeature
				? "Implement the entire feature as defined in the artifacts above."
				: `Execute ONLY these tasks: ${taskIds.join(", ")}`,
		].join("\n");
	}

	private parseIssueRef(
		ref: string | undefined
	): { owner: string; repo: string; number: number } | undefined {
		if (!ref) {
			return;
		}
		const match = ISSUE_REF_PATTERN.exec(ref);
		if (!match) {
			return;
		}
		return {
			owner: match[1],
			repo: match[2],
			number: Number.parseInt(match[3], 10),
		};
	}

	private mapIssueToUpdate(
		session: AgentSession,
		issue: IssueQueryData["repository"]["issue"]
	): SessionUpdate | undefined {
		let newStatus: SessionStatus;

		if (issue.state === "CLOSED") {
			newStatus =
				issue.stateReason === "COMPLETED"
					? SessionStatus.COMPLETED
					: SessionStatus.CANCELLED;
		} else {
			const hasPr = issue.timelineItems.nodes.some(
				(n) => n.__typename === "CrossReferencedEvent" && n.source?.url
			);
			newStatus = hasPr ? SessionStatus.RUNNING : SessionStatus.PENDING;
		}

		const prs = issue.timelineItems.nodes
			.filter((n) => n.__typename === "CrossReferencedEvent" && n.source?.url)
			.map((n) => {
				const existing = session.pullRequests.find(
					(p) => p.url === n.source!.url
				);
				return {
					url: n.source!.url,
					state: n.source!.state?.toLowerCase(),
					branch: session.branch,
					createdAt: existing?.createdAt ?? Date.now(),
				};
			});

		if (newStatus === session.status && prs.length === 0) {
			return;
		}

		return {
			localId: session.localId,
			status: newStatus,
			timestamp: Date.now(),
			pullRequests: prs.length > 0 ? prs : undefined,
		};
	}

	private async graphql<T>(
		token: string,
		query: string,
		variables: Record<string, unknown> = {}
	): Promise<T> {
		const response = await fetch(GITHUB_GRAPHQL_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"GraphQL-Features":
					"issues_copilot_assignment_api_support,coding_agent_model_selection",
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			if (response.status === 401 || response.status === 403) {
				throw new ProviderError(
					"GitHub authentication failed. Token may be expired.",
					ErrorCode.CREDENTIALS_INVALID,
					GitHubCopilotAdapter.PROVIDER_ID,
					true
				);
			}
			throw new ProviderError(
				`GitHub API error: ${response.status} ${response.statusText}`,
				ErrorCode.API_ERROR,
				GitHubCopilotAdapter.PROVIDER_ID,
				true
			);
		}

		const json = (await response.json()) as GraphQLResponse<T>;
		if (json.errors && json.errors.length > 0) {
			throw new ProviderError(
				`GitHub GraphQL error: ${json.errors[0].message}`,
				ErrorCode.API_ERROR,
				GitHubCopilotAdapter.PROVIDER_ID,
				true
			);
		}

		return json.data as T;
	}

	private async getRepositoryId(
		token: string,
		owner: string,
		name: string
	): Promise<string> {
		const data = await this.graphql<RepoIdData>(
			token,
			`query($owner: String!, $name: String!) {
				repository(owner: $owner, name: $name) { id }
			}`,
			{ owner, name }
		);
		return data.repository.id;
	}

	private async createCopilotIssue(
		token: string,
		opts: { repoId: string; title: string; body: string; baseRef: string }
	): Promise<{ number: number; url: string }> {
		const data = await this.graphql<CreateIssueData>(
			token,
			`mutation($input: CreateIssueInput!) {
				createIssue(input: $input) {
					issue { id number url }
				}
			}`,
			{
				input: {
					repositoryId: opts.repoId,
					title: opts.title,
					body: opts.body,
					agentAssignment: {
						targetRepositoryId: opts.repoId,
						baseRef: opts.baseRef,
					},
				},
			}
		);
		return data.createIssue.issue;
	}

	private async queryIssueStatus(
		token: string,
		owner: string,
		repo: string,
		number: number
	): Promise<IssueQueryData["repository"]["issue"]> {
		const data = await this.graphql<IssueQueryData>(
			token,
			`query($owner: String!, $repo: String!, $number: Int!) {
				repository(owner: $owner, name: $repo) {
					issue(number: $number) {
						state
						stateReason
						timelineItems(first: 20, itemTypes: [CROSS_REFERENCED_EVENT]) {
							nodes {
								__typename
								... on CrossReferencedEvent {
									source {
										... on PullRequest { url state title number }
									}
								}
							}
						}
					}
				}
			}`,
			{ owner, repo, number }
		);
		return data.repository.issue;
	}
}
