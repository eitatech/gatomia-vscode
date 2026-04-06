import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	GitHubActionParams,
	TemplateContext,
} from "../../../../../src/features/hooks/types";

vi.mock("../../../../../src/features/hooks/git-utils", () => ({
	getPrimaryRepository: vi.fn(),
	extractGitHubSlugFromRemote: vi.fn(),
}));

import {
	GitHubActionExecutor,
	GitHubIntegrationUnavailableError,
	GitHubRepositoryResolutionError,
} from "../../../../../src/features/hooks/actions/github-action";
import {
	getPrimaryRepository,
	extractGitHubSlugFromRemote,
} from "../../../../../src/features/hooks/git-utils";

const mockGetPrimaryRepository = getPrimaryRepository as unknown as ReturnType<
	typeof vi.fn
>;
const mockExtractGitHubSlugFromRemote =
	extractGitHubSlugFromRemote as unknown as ReturnType<typeof vi.fn>;

const templateContext: TemplateContext = {
	feature: "hooks-module",
	branch: "001-hooks-module",
	timestamp: "2025-12-03T10:00:00.000Z",
	user: "Test User",
};

const createClient = () => ({
	openIssue: vi.fn().mockResolvedValue(undefined),
	closeIssue: vi.fn().mockResolvedValue(undefined),
	createPullRequest: vi.fn().mockResolvedValue(undefined),
	addComment: vi.fn().mockResolvedValue(undefined),
	mergePullRequest: vi.fn().mockResolvedValue(undefined),
	closePullRequest: vi.fn().mockResolvedValue(undefined),
	addLabel: vi.fn().mockResolvedValue(undefined),
	removeLabel: vi.fn().mockResolvedValue(undefined),
	requestReview: vi.fn().mockResolvedValue(undefined),
	assignIssue: vi.fn().mockResolvedValue(undefined),
	createRelease: vi.fn().mockResolvedValue(undefined),
});

const noopLogger = {
	warn: vi.fn(),
};

describe("GitHubActionExecutor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetPrimaryRepository.mockReset();
		mockExtractGitHubSlugFromRemote.mockReset();
	});

	it("opens an issue with expanded templates", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "open-issue",
			repository: undefined,
			titleTemplate: "Spec ready for $feature",
			bodyTemplate: "Generated from $branch at $timestamp",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.openIssue).toHaveBeenCalledWith({
			repository: "owner/repo",
			title: "Spec ready for hooks-module",
			body: "Generated from 001-hooks-module at 2025-12-03T10:00:00.000Z",
		});
	});

	it("creates a pull request with body template expansion", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "create-pr",
			repository: undefined,
			titleTemplate: "PR for $branch",
			bodyTemplate: "Automated by $user",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.createPullRequest).toHaveBeenCalledWith({
			repository: "owner/repo",
			title: "PR for 001-hooks-module",
			body: "Automated by Test User",
		});
	});

	it("requires an issue number for close-issue operations", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "close-issue",
			repository: "owner/repo",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("Issue number is required");
		expect(client.closeIssue).not.toHaveBeenCalled();
	});

	it("requires a comment body for add-comment operations", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "add-comment",
			repository: "owner/repo",
			issueNumber: 42,
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("Comment body");
		expect(client.addComment).not.toHaveBeenCalled();
	});

	it("resolves repository from git remotes when not provided", async () => {
		const client = createClient();
		mockGetPrimaryRepository.mockReturnValue({
			state: {
				remotes: [
					{ name: "upstream", fetchUrl: "git@github.com:org/upstream.git" },
					{ name: "origin", fetchUrl: "git@github.com:org/project.git" },
				],
			},
		});
		mockExtractGitHubSlugFromRemote.mockReturnValue("org/project");

		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "open-issue",
			titleTemplate: "Auto issue",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.openIssue).toHaveBeenCalledWith({
			repository: "org/project",
			title: "Auto issue",
			body: undefined,
		});
		expect(mockExtractGitHubSlugFromRemote).toHaveBeenCalled();
	});

	it("returns a graceful error when MCP client is unavailable", async () => {
		const executor = new GitHubActionExecutor({
			clientProvider: () => Promise.resolve(undefined),
			repositoryResolver: () => Promise.resolve("owner/repo"),
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "open-issue",
			repository: undefined,
			titleTemplate: "Test",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(GitHubIntegrationUnavailableError);
	});

	it("surfaces repository resolution errors", async () => {
		mockGetPrimaryRepository.mockImplementation(() => {
			throw new Error("git missing");
		});

		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "open-issue",
			titleTemplate: "Issue",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(GitHubRepositoryResolutionError);
		expect(client.openIssue).not.toHaveBeenCalled();
	});

	it("merges a pull request with the given prNumber and mergeMethod", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "merge-pr",
			prNumber: 42,
			mergeMethod: "squash",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.mergePullRequest).toHaveBeenCalledWith({
			repository: "owner/repo",
			prNumber: 42,
			mergeMethod: "squash",
		});
	});

	it("requires prNumber for merge-pr", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "merge-pr",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("PR number");
		expect(client.mergePullRequest).not.toHaveBeenCalled();
	});

	it("closes a pull request by prNumber", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "close-pr",
			prNumber: 7,
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.closePullRequest).toHaveBeenCalledWith({
			repository: "owner/repo",
			prNumber: 7,
		});
	});

	it("adds labels to an issue", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "add-label",
			issueNumber: 10,
			labels: ["bug", "priority:high"],
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.addLabel).toHaveBeenCalledWith({
			repository: "owner/repo",
			issueNumber: 10,
			labels: ["bug", "priority:high"],
		});
	});

	it("removes a label from an issue", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "remove-label",
			issueNumber: 10,
			labelName: "wip",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.removeLabel).toHaveBeenCalledWith({
			repository: "owner/repo",
			issueNumber: 10,
			labelName: "wip",
		});
	});

	it("requests a review on a pull request", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "request-review",
			prNumber: 5,
			reviewers: ["alice", "bob"],
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.requestReview).toHaveBeenCalledWith({
			repository: "owner/repo",
			prNumber: 5,
			reviewers: ["alice", "bob"],
		});
	});

	it("assigns an issue to users", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "assign-issue",
			issueNumber: 20,
			assignees: ["carol"],
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.assignIssue).toHaveBeenCalledWith({
			repository: "owner/repo",
			issueNumber: 20,
			assignees: ["carol"],
		});
	});

	it("creates a release with template-expanded fields", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "create-release",
			tagName: "v1.0.0",
			releaseName: "Release $feature",
			releaseBody: "Branch: $branch",
			draft: false,
			prerelease: false,
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(true);
		expect(client.createRelease).toHaveBeenCalledWith({
			repository: "owner/repo",
			tagName: "v1.0.0",
			releaseName: "Release hooks-module",
			releaseBody: "Branch: 001-hooks-module",
			draft: false,
			prerelease: false,
		});
	});

	it("requires tagName for create-release", async () => {
		const client = createClient();
		const executor = new GitHubActionExecutor({
			clientProvider: async () => client,
			repositoryResolver: async () => "owner/repo",
			logger: noopLogger,
		});

		const params: GitHubActionParams = {
			operation: "create-release",
		};

		const result = await executor.execute(params, templateContext);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("Tag name");
		expect(client.createRelease).not.toHaveBeenCalled();
	});
});
