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
}

const getExtension = extensions.getExtension as unknown as ReturnType<
	typeof vi.fn
>;

const createMockRepository = (): MockRepository => ({
	commit: vi.fn().mockResolvedValue(undefined),
	push: vi.fn().mockResolvedValue(undefined),
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
			messageTemplate: "feat({feature}): update {branch}",
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
			messageTemplate: "   {user}   ",
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
});
