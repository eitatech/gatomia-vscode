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

			if (params.operation === "commit") {
				await this.executeCommit(repository, params, templateContext);
			} else {
				await repository.push();
			}

			return { success: true, duration: Date.now() - startTime };
		} catch (error) {
			return {
				success: false,
				error: error as Error,
				duration: Date.now() - startTime,
			};
		}
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

		return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_match, key) => {
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
