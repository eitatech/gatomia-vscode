import { extensions } from "vscode";

// Top-level regex for GitHub slug extraction (performance optimization)
const GITHUB_SLUG_REGEX = /github\.com[:/](.+?)(?:\.git)?$/i;

export interface GitRemote {
	name?: string;
	fetchUrl?: string;
	pushUrl?: string;
}

export interface GitRepositoryState {
	remotes: GitRemote[];
}

export interface GitRepository {
	state: GitRepositoryState;
	commit(message: string, options?: CommitOptions): Promise<void>;
	push(remote?: string, branch?: string, setUpstream?: boolean): Promise<void>;
}

export interface CommitOptions {
	all?: boolean;
	amend?: boolean;
	stage?: string[];
}

export interface GitAPI {
	repositories: GitRepository[];
}

interface GitExtension {
	getAPI(version: number): GitAPI;
}

export class GitExtensionNotFoundError extends Error {
	constructor() {
		super(
			"VS Code Git extension not found. Install/enable the Git extension to run Git operations."
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

export function getGitApi(): GitAPI | undefined {
	const gitExtension = extensions.getExtension<GitExtension>("vscode.git");
	return gitExtension?.exports?.getAPI?.(1);
}

export function getPrimaryRepository(): GitRepository {
	const git = getGitApi();
	if (!git) {
		throw new GitExtensionNotFoundError();
	}

	const repository = git.repositories[0];
	if (!repository) {
		throw new GitRepositoryNotFoundError();
	}

	return repository;
}

export function extractGitHubSlugFromRemote(
	remoteUrl: string
): string | undefined {
	if (!remoteUrl) {
		return;
	}

	// Support SSH and HTTPS formats
	const match = remoteUrl.match(GITHUB_SLUG_REGEX);
	return match?.[1];
}
