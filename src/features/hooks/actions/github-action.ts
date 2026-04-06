import {
	extractGitHubSlugFromRemote,
	getPrimaryRepository,
} from "../git-utils";
import { expandTemplate } from "../template-utils";
import type { GitHubActionParams, TemplateContext } from "../types";
import { isValidGitHubParams } from "../types";

function logTelemetry(
	event: string,
	properties: Record<string, string | number | boolean>
): void {
	console.log(`[GitHubAction] Telemetry: ${event}`, properties);
}

export interface GitHubActionExecutionResult {
	success: boolean;
	error?: Error;
	duration?: number;
}

export interface GitHubMcpClient {
	openIssue(args: {
		repository: string;
		title: string;
		body?: string;
	}): Promise<void>;
	closeIssue(args: { repository: string; issueNumber: number }): Promise<void>;
	createPullRequest(args: {
		repository: string;
		title: string;
		body?: string;
	}): Promise<void>;
	addComment(args: {
		repository: string;
		issueNumber: number;
		body: string;
	}): Promise<void>;
	mergePullRequest(args: {
		repository: string;
		prNumber: number;
		mergeMethod?: "merge" | "squash" | "rebase";
	}): Promise<void>;
	closePullRequest(args: {
		repository: string;
		prNumber: number;
	}): Promise<void>;
	addLabel(args: {
		repository: string;
		issueNumber: number;
		labels: string[];
	}): Promise<void>;
	removeLabel(args: {
		repository: string;
		issueNumber: number;
		labelName: string;
	}): Promise<void>;
	requestReview(args: {
		repository: string;
		prNumber: number;
		reviewers: string[];
	}): Promise<void>;
	assignIssue(args: {
		repository: string;
		issueNumber: number;
		assignees: string[];
	}): Promise<void>;
	createRelease(args: {
		repository: string;
		tagName: string;
		releaseName?: string;
		releaseBody?: string;
		draft?: boolean;
		prerelease?: boolean;
	}): Promise<void>;
}

export type GitHubClientProvider = () => Promise<GitHubMcpClient | undefined>;
export type RepositoryResolver = (repository?: string) => Promise<string>;

export interface GitHubActionExecutorOptions {
	clientProvider?: GitHubClientProvider;
	repositoryResolver?: RepositoryResolver;
	logger?: Pick<typeof console, "warn">;
}

/**
 * Error emitted when the MCP-based GitHub integration is unavailable.
 */
export class GitHubIntegrationUnavailableError extends Error {
	constructor() {
		super(
			"GitHub Tools integration is not available. Configure the MCP server to enable GitHub actions."
		);
		this.name = "GitHubIntegrationUnavailableError";
	}
}

export class GitHubRepositoryResolutionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubRepositoryResolutionError";
	}
}

export class GitHubActionValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitHubActionValidationError";
	}
}

export class GitHubActionExecutor {
	private readonly clientProvider: GitHubClientProvider;
	private readonly repositoryResolver: RepositoryResolver;
	private readonly logger: Pick<typeof console, "warn">;

	constructor(options?: GitHubActionExecutorOptions) {
		this.clientProvider = options?.clientProvider ?? defaultClientProvider;
		this.repositoryResolver =
			options?.repositoryResolver ?? defaultRepositoryResolver;
		this.logger = options?.logger ?? console;
	}

	async execute(
		params: GitHubActionParams,
		templateContext: TemplateContext
	): Promise<GitHubActionExecutionResult> {
		const startTime = Date.now();

		try {
			this.validateOperationRequirements(params);
			if (!isValidGitHubParams(params)) {
				throw new GitHubActionValidationError(
					"Invalid GitHub action parameters"
				);
			}

			const repository = await this.repositoryResolver(params.repository);
			const client = await this.clientProvider();

			if (!client) {
				throw new GitHubIntegrationUnavailableError();
			}

			await this.executeOperation(client, params, repository, templateContext);

			const duration = Date.now() - startTime;
			logTelemetry("github-action.execute.success", {
				operation: params.operation,
				duration,
			});
			return {
				success: true,
				duration,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.warn?.(`[GitHubActionExecutor] ${err.message}`);
			const duration = Date.now() - startTime;
			logTelemetry("github-action.execute.failure", {
				operation: params.operation,
				errorName: err.name,
				duration,
			});
			return {
				success: false,
				error: err,
				duration,
			};
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: switch covers all 11 GitHub operations
	private async executeOperation(
		client: GitHubMcpClient,
		params: GitHubActionParams,
		repository: string,
		templateContext: TemplateContext
	): Promise<void> {
		switch (params.operation) {
			case "open-issue": {
				const title = expandRequiredTemplate(
					params.titleTemplate,
					templateContext,
					"Title"
				);
				const body = expandOptionalTemplate(
					params.bodyTemplate,
					templateContext
				);
				await client.openIssue({ repository, title, body });
				break;
			}
			case "close-issue": {
				if (!params.issueNumber) {
					throw new GitHubActionValidationError(
						"Issue number is required to close an issue."
					);
				}
				await client.closeIssue({
					repository,
					issueNumber: params.issueNumber,
				});
				break;
			}
			case "create-pr": {
				const title = expandRequiredTemplate(
					params.titleTemplate,
					templateContext,
					"Title"
				);
				const body = expandOptionalTemplate(
					params.bodyTemplate,
					templateContext
				);
				await client.createPullRequest({ repository, title, body });
				break;
			}
			case "add-comment": {
				if (!params.issueNumber) {
					throw new GitHubActionValidationError(
						"Issue number is required to add a comment."
					);
				}
				const body = expandRequiredTemplate(
					params.bodyTemplate,
					templateContext,
					"Comment body"
				);
				await client.addComment({
					repository,
					issueNumber: params.issueNumber,
					body,
				});
				break;
			}
			case "merge-pr": {
				if (!params.prNumber) {
					throw new GitHubActionValidationError(
						"PR number is required to merge a pull request."
					);
				}
				await client.mergePullRequest({
					repository,
					prNumber: params.prNumber,
					mergeMethod: params.mergeMethod,
				});
				break;
			}
			case "close-pr": {
				if (!params.prNumber) {
					throw new GitHubActionValidationError(
						"PR number is required to close a pull request."
					);
				}
				await client.closePullRequest({
					repository,
					prNumber: params.prNumber,
				});
				break;
			}
			case "add-label": {
				if (!params.issueNumber) {
					throw new GitHubActionValidationError(
						"Issue number is required to add a label."
					);
				}
				await client.addLabel({
					repository,
					issueNumber: params.issueNumber,
					labels: params.labels ?? [],
				});
				break;
			}
			case "remove-label": {
				if (!params.issueNumber) {
					throw new GitHubActionValidationError(
						"Issue number is required to remove a label."
					);
				}
				await client.removeLabel({
					repository,
					issueNumber: params.issueNumber,
					labelName: params.labelName ?? "",
				});
				break;
			}
			case "request-review": {
				if (!params.prNumber) {
					throw new GitHubActionValidationError(
						"PR number is required to request a review."
					);
				}
				await client.requestReview({
					repository,
					prNumber: params.prNumber,
					reviewers: params.reviewers ?? [],
				});
				break;
			}
			case "assign-issue": {
				if (!params.issueNumber) {
					throw new GitHubActionValidationError(
						"Issue number is required to assign an issue."
					);
				}
				await client.assignIssue({
					repository,
					issueNumber: params.issueNumber,
					assignees: params.assignees ?? [],
				});
				break;
			}
			case "create-release": {
				if (!params.tagName?.trim()) {
					throw new GitHubActionValidationError(
						"Tag name is required to create a release."
					);
				}
				const releaseName = params.releaseName
					? expandOptionalTemplate(params.releaseName, templateContext)
					: undefined;
				const releaseBody = params.releaseBody
					? expandOptionalTemplate(params.releaseBody, templateContext)
					: undefined;
				await client.createRelease({
					repository,
					tagName: params.tagName,
					releaseName,
					releaseBody,
					draft: params.draft,
					prerelease: params.prerelease,
				});
				break;
			}
			default:
				throw new GitHubActionValidationError(
					`Unsupported GitHub operation: ${String((params as GitHubActionParams).operation)}`
				);
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validation must cover all operation types
	private validateOperationRequirements(params: GitHubActionParams): void {
		if (
			(params.operation === "close-issue" ||
				params.operation === "add-comment" ||
				params.operation === "add-label" ||
				params.operation === "remove-label" ||
				params.operation === "assign-issue") &&
			(typeof params.issueNumber !== "number" || params.issueNumber <= 0)
		) {
			throw new GitHubActionValidationError(
				"Issue number is required for this GitHub operation."
			);
		}

		if (
			(params.operation === "merge-pr" ||
				params.operation === "close-pr" ||
				params.operation === "request-review") &&
			(typeof params.prNumber !== "number" || params.prNumber <= 0)
		) {
			throw new GitHubActionValidationError(
				"PR number is required for this GitHub operation."
			);
		}

		if (
			(params.operation === "open-issue" || params.operation === "create-pr") &&
			(!params.titleTemplate || params.titleTemplate.trim().length === 0)
		) {
			throw new GitHubActionValidationError(
				"Title template is required for this GitHub operation."
			);
		}

		if (
			params.operation === "add-comment" &&
			(!params.bodyTemplate || params.bodyTemplate.trim().length === 0)
		) {
			throw new GitHubActionValidationError(
				"Comment body template is required."
			);
		}

		if (
			params.operation === "create-release" &&
			(!params.tagName || params.tagName.trim().length === 0)
		) {
			throw new GitHubActionValidationError(
				"Tag name is required to create a release."
			);
		}
	}
}

const defaultClientProvider: GitHubClientProvider = () =>
	Promise.resolve(undefined);

const defaultRepositoryResolver: RepositoryResolver = (repository) => {
	if (repository && repository.trim().length > 0) {
		return Promise.resolve(repository.trim());
	}

	try {
		const gitRepository = getPrimaryRepository();
		const remotes = gitRepository.state.remotes ?? [];
		const preferredRemote =
			remotes.find((remote) => remote.name === "origin") ?? remotes[0];

		const remoteUrl = preferredRemote?.pushUrl ?? preferredRemote?.fetchUrl;
		const slug = remoteUrl ? extractGitHubSlugFromRemote(remoteUrl) : undefined;

		if (slug) {
			return Promise.resolve(slug);
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error ?? "");
		throw new GitHubRepositoryResolutionError(
			`Unable to resolve GitHub repository: ${message}`
		);
	}

	throw new GitHubRepositoryResolutionError(
		"Unable to determine GitHub repository. Configure the repository in the hook or add a GitHub remote."
	);
};

function expandRequiredTemplate(
	template: string | undefined,
	context: TemplateContext,
	label: string
): string {
	const expanded = expandOptionalTemplate(template, context);
	if (!expanded) {
		throw new GitHubActionValidationError(`${label} cannot be empty.`);
	}
	return expanded;
}

function expandOptionalTemplate(
	template: string | undefined,
	context: TemplateContext
): string | undefined {
	if (!template) {
		return;
	}

	const expanded = expandTemplate(template, context).trim();
	return expanded.length > 0 ? expanded : undefined;
}
