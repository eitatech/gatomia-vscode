import {
	extractGitHubSlugFromRemote,
	getPrimaryRepository,
} from "../git-utils";
import { expandTemplate } from "../template-utils";
import type { GitHubActionParams, TemplateContext } from "../types";
import { isValidGitHubParams } from "../types";

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
			"GitHub MCP integration is not available. Configure the MCP server to enable GitHub actions."
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

			return {
				success: true,
				duration: Date.now() - startTime,
			};
		} catch (error) {
			const err = error as Error;
			this.logger.warn?.(`[GitHubActionExecutor] ${err.message}`);

			return {
				success: false,
				error: err,
				duration: Date.now() - startTime,
			};
		}
	}

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
				await client.openIssue({
					repository,
					title,
					body,
				});
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
				await client.createPullRequest({
					repository,
					title,
					body,
				});
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
			default:
				throw new GitHubActionValidationError(
					`Unsupported GitHub operation: ${params.operation}`
				);
		}
	}

	private validateOperationRequirements(params: GitHubActionParams): void {
		if (
			(params.operation === "close-issue" ||
				params.operation === "add-comment") &&
			(typeof params.issueNumber !== "number" || params.issueNumber <= 0)
		) {
			throw new GitHubActionValidationError(
				"Issue number is required for this GitHub operation."
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
	}
}

const defaultClientProvider: GitHubClientProvider = () =>
	Promise.resolve(undefined);

const defaultRepositoryResolver: RepositoryResolver = (repository) => {
	if (repository && repository.trim().length > 0) {
		return repository.trim();
	}

	try {
		const gitRepository = getPrimaryRepository();
		const remotes = gitRepository.state.remotes ?? [];
		const preferredRemote =
			remotes.find((remote) => remote.name === "origin") ?? remotes[0];

		const remoteUrl = preferredRemote?.pushUrl ?? preferredRemote?.fetchUrl;
		const slug = remoteUrl ? extractGitHubSlugFromRemote(remoteUrl) : undefined;

		if (slug) {
			return slug;
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
