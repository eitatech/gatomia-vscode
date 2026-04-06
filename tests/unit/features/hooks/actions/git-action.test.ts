import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	GitActionExecutor,
	GitExtensionNotFoundError,
} from "../../../../../src/features/hooks/actions/git-action";
import type {
	GitActionParams,
	TemplateContext,
} from "../../../../../src/features/hooks/types";
import { extensions } from "vscode";

vi.mock("vscode", () => ({
	extensions: {
		getExtension: vi.fn(),
	},
}));

interface MockRepository {
	commit: ReturnType<typeof vi.fn>;
	push: ReturnType<typeof vi.fn>;
	createBranch: ReturnType<typeof vi.fn>;
	checkout: ReturnType<typeof vi.fn>;
	pull: ReturnType<typeof vi.fn>;
	merge: ReturnType<typeof vi.fn>;
	tag: ReturnType<typeof vi.fn>;
	createStash: ReturnType<typeof vi.fn>;
}

const getExtension = extensions.getExtension as unknown as ReturnType<
	typeof vi.fn
>;

const createMockRepository = (): MockRepository => ({
	commit: vi.fn().mockResolvedValue(undefined),
	push: vi.fn().mockResolvedValue(undefined),
	createBranch: vi.fn().mockResolvedValue(undefined),
	checkout: vi.fn().mockResolvedValue(undefined),
	pull: vi.fn().mockResolvedValue(undefined),
	merge: vi.fn().mockResolvedValue(undefined),
	tag: vi.fn().mockResolvedValue(undefined),
	createStash: vi.fn().mockResolvedValue(undefined),
});

const mockTemplateContext: TemplateContext = {
	feature: "hooks-module",
	branch: "001-hooks-module",
	timestamp: "2025-12-03T12:00:00.000Z",
	user: "tester",
};

const mockGitExtension = (repo?: MockRepository) => {
	getExtension.mockReturnValue({
		exports: {
			getAPI: () => ({
				repositories: repo ? [repo] : [],
			}),
		},
	});
};

describe("GitActionExecutor", () => {
	let executor: GitActionExecutor;

	beforeEach(() => {
		executor = new GitActionExecutor();
		getExtension.mockReset();
	});

	it("commits with expanded template message", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const params: GitActionParams = {
			operation: "commit",
			messageTemplate: "feat($feature): update $branch",
			pushToRemote: false,
		};

		const result = await executor.execute(params, mockTemplateContext);

		expect(result.success).toBe(true);
		expect(repository.commit).toHaveBeenCalledWith(
			"feat(hooks-module): update 001-hooks-module",
			{ all: true }
		);
		expect(repository.push).not.toHaveBeenCalled();
	});

	it("pushes after commit when pushToRemote is true", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const params: GitActionParams = {
			operation: "commit",
			messageTemplate: "chore: sync",
			pushToRemote: true,
		};

		const result = await executor.execute(params, mockTemplateContext);

		expect(result.success).toBe(true);
		expect(repository.commit).toHaveBeenCalledWith("chore: sync", {
			all: true,
		});
		expect(repository.push).toHaveBeenCalledTimes(1);
	});

	it("executes push operation without committing", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const params: GitActionParams = {
			operation: "push",
			messageTemplate: "unused",
			pushToRemote: false,
		};

		const result = await executor.execute(params, mockTemplateContext);

		expect(result.success).toBe(true);
		expect(repository.commit).not.toHaveBeenCalled();
		expect(repository.push).toHaveBeenCalledTimes(1);
	});

	it("handles missing Git extension gracefully", async () => {
		getExtension.mockReturnValue(undefined);

		const result = await executor.execute(
			{
				operation: "push",
				messageTemplate: "message",
				pushToRemote: false,
			},
			mockTemplateContext
		);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(GitExtensionNotFoundError);
	});

	it("fails when commit message is empty after template expansion", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const params: GitActionParams = {
			operation: "commit",
			messageTemplate: "   $user   ",
			pushToRemote: false,
		};

		const result = await executor.execute(params, {
			...mockTemplateContext,
			user: "",
		});

		expect(result.success).toBe(false);
		expect(repository.commit).not.toHaveBeenCalled();
	});

	it("fails when no repositories are available", async () => {
		mockGitExtension(undefined);

		const result = await executor.execute(
			{
				operation: "commit",
				messageTemplate: "feat: update",
				pushToRemote: false,
			},
			mockTemplateContext
		);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("repository");
	});

	it("creates a branch with the given name", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "create-branch",
				messageTemplate: "",
				branchName: "feature/$feature",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.createBranch).toHaveBeenCalledWith(
			"feature/hooks-module",
			false
		);
	});

	it("fails to create a branch when branchName is missing", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "create-branch",
				messageTemplate: "",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("Branch name");
		expect(repository.createBranch).not.toHaveBeenCalled();
	});

	it("checks out a branch by name", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "checkout-branch",
				messageTemplate: "",
				branchName: "$branch",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.checkout).toHaveBeenCalledWith("001-hooks-module");
	});

	it("pulls from remote", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "pull",
				messageTemplate: "",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.pull).toHaveBeenCalledTimes(1);
	});

	it("merges a branch by name", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "merge",
				messageTemplate: "",
				branchName: "main",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.merge).toHaveBeenCalledWith("main");
	});

	it("creates a tag with name and optional message", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "tag",
				messageTemplate: "",
				tagName: "v1.0.0",
				tagMessage: "Release $feature",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.tag).toHaveBeenCalledWith(
			"v1.0.0",
			"Release hooks-module"
		);
	});

	it("fails to create a tag when tagName is missing", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "tag",
				messageTemplate: "",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain("Tag name");
		expect(repository.tag).not.toHaveBeenCalled();
	});

	it("stashes changes with an optional message", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "stash",
				messageTemplate: "",
				stashMessage: "WIP $feature",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.createStash).toHaveBeenCalledWith("WIP hooks-module");
	});

	it("stashes changes without a message", async () => {
		const repository = createMockRepository();
		mockGitExtension(repository);

		const result = await executor.execute(
			{
				operation: "stash",
				messageTemplate: "",
			},
			mockTemplateContext
		);

		expect(result.success).toBe(true);
		expect(repository.createStash).toHaveBeenCalledWith(undefined);
	});
});
