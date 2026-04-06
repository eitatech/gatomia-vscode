import { extensions } from "vscode";
import type { GitActionParams, TemplateContext } from "../types";
import { isValidGitParams } from "../types";

export interface GitActionExecutionResult {
	success: boolean;
	error?: Error;
	duration?: number;
}

interface GitExtension {
	getAPI(version: number): GitAPI;
}

interface GitAPI {
	repositories: GitRepository[];
}

interface CommitOptions {
	all?: boolean;
	amend?: boolean;
	stage?: string[];
}

interface GitRepository {
	commit(message: string, options?: CommitOptions): Promise<void>;
	push(remote?: string, branch?: string, setUpstream?: boolean): Promise<void>;
	createBranch(name: string, checkout: boolean): Promise<void>;
	checkout(treeish: string): Promise<void>;
	pull(): Promise<void>;
	merge(ref: string): Promise<void>;
	tag(name: string, message?: string): Promise<void>;
	createStash(message?: string, includeUntracked?: boolean): Promise<void>;
}

const TEMPLATE_VAR_PATTERN = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;

function logTelemetry(
	event: string,
	properties: Record<string, string | number | boolean>
): void {
	console.log(`[GitAction] Telemetry: ${event}`, properties);
}

export class GitExtensionNotFoundError extends Error {
	constructor() {
		super(
			"VS Code Git extension not found. Install/enable the Git extension to run Git actions."
		);
		this.name = "GitExtensionNotFoundError";
	}
}

export class GitRepositoryNotFoundError extends Error {
	constructor() {
		super("No Git repository found in the current workspace.");
		this.name = "GitRepositoryNotFoundError";
	}
}

export class GitActionValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitActionValidationError";
	}
}

export class GitActionExecutor {
	async execute(
		params: GitActionParams,
		templateContext: TemplateContext
	): Promise<GitActionExecutionResult> {
		const startTime = Date.now();

		try {
			if (!isValidGitParams(params)) {
				throw new Error("Invalid Git action parameters");
			}

			const git = this.getGitApi();
			if (!git) {
				throw new GitExtensionNotFoundError();
			}

			const repository = git.repositories[0];
			if (!repository) {
				throw new GitRepositoryNotFoundError();
			}

			await this.executeOperation(repository, params, templateContext);

			const duration = Date.now() - startTime;
			logTelemetry("git-action.execute.success", {
				operation: params.operation,
				duration,
			});
			return { success: true, duration };
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error as Error;
			logTelemetry("git-action.execute.failure", {
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

	private async executeOperation(
		repository: GitRepository,
		params: GitActionParams,
		templateContext: TemplateContext
	): Promise<void> {
		switch (params.operation) {
			case "commit": {
				await this.executeCommit(repository, params, templateContext);
				break;
			}
			case "push": {
				await repository.push();
				break;
			}
			case "create-branch": {
				const branchName = this.requireExpandedString(
					params.branchName,
					templateContext,
					"Branch name"
				);
				await repository.createBranch(branchName, false);
				break;
			}
			case "checkout-branch": {
				const branchName = this.requireExpandedString(
					params.branchName,
					templateContext,
					"Branch name"
				);
				await repository.checkout(branchName);
				break;
			}
			case "pull": {
				await repository.pull();
				break;
			}
			case "merge": {
				const branchName = this.requireExpandedString(
					params.branchName,
					templateContext,
					"Branch name"
				);
				await repository.merge(branchName);
				break;
			}
			case "tag": {
				const tagName = this.requireExpandedString(
					params.tagName,
					templateContext,
					"Tag name"
				);
				const tagMessage = params.tagMessage
					? this.expandTemplate(params.tagMessage, templateContext)
					: undefined;
				await repository.tag(tagName, tagMessage);
				break;
			}
			case "stash": {
				const stashMessage = params.stashMessage
					? this.expandTemplate(params.stashMessage, templateContext)
					: undefined;
				await repository.createStash(stashMessage);
				break;
			}
			default: {
				throw new GitActionValidationError(
					`Unsupported Git operation: ${String(params.operation)}`
				);
			}
		}
	}

	private requireExpandedString(
		value: string | undefined,
		context: TemplateContext,
		label: string
	): string {
		if (!value?.trim()) {
			throw new GitActionValidationError(
				`${label} is required for this operation.`
			);
		}
		const expanded = this.expandTemplate(value, context).trim();
		if (!expanded) {
			throw new GitActionValidationError(
				`${label} cannot be empty after template expansion.`
			);
		}
		return expanded;
	}

	private async executeCommit(
		repository: GitRepository,
		params: GitActionParams,
		templateContext: TemplateContext
	): Promise<void> {
		const message = this.expandTemplate(
			params.messageTemplate,
			templateContext
		).trim();

		if (!message) {
			throw new Error(
				"Commit message cannot be empty after template expansion."
			);
		}

		await repository.commit(message, { all: true });

		if (params.pushToRemote) {
			await repository.push();
		}
	}

	private expandTemplate(template: string, context: TemplateContext): string {
		if (!template) {
			return template;
		}

		return template.replace(TEMPLATE_VAR_PATTERN, (_match, key) => {
			const value = context[key as keyof TemplateContext];
			if (value === undefined || value === null) {
				return "";
			}
			return String(value);
		});
	}

	private getGitApi(): GitAPI | undefined {
		const gitExtension = extensions.getExtension<GitExtension>("vscode.git");
		return gitExtension?.exports?.getAPI?.(1);
	}
}
