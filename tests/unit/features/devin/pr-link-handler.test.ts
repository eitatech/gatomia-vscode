import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("vscode", () => ({
	Uri: {
		parse: vi.fn((url: string) => ({ toString: () => url, scheme: "https" })),
	},
	env: {
		openExternal: vi.fn().mockResolvedValue(true),
	},
	window: {
		showInformationMessage: vi.fn().mockResolvedValue(undefined),
		showWarningMessage: vi.fn().mockResolvedValue(undefined),
		showErrorMessage: vi.fn().mockResolvedValue(undefined),
	},
}));

import type { PullRequest } from "../../../../src/features/devin/entities";

describe("PrLinkHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("openPullRequest", () => {
		it("should open a valid PR URL in the external browser", async () => {
			const { openPullRequest } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);
			const vscode = await import("vscode");

			const result = await openPullRequest(
				"https://github.com/org/repo/pull/42"
			);

			expect(result).toBe(true);
			expect(vscode.env.openExternal).toHaveBeenCalledOnce();
		});

		it("should return false for an empty URL", async () => {
			const { openPullRequest } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);
			const vscode = await import("vscode");

			const result = await openPullRequest("");

			expect(result).toBe(false);
			expect(vscode.env.openExternal).not.toHaveBeenCalled();
		});

		it("should return false when openExternal fails", async () => {
			const vscode = await import("vscode");
			vi.mocked(vscode.env.openExternal).mockResolvedValueOnce(false);

			const { openPullRequest } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			const result = await openPullRequest(
				"https://github.com/org/repo/pull/42"
			);

			expect(result).toBe(false);
		});
	});

	describe("extractPullRequestUrls", () => {
		it("should extract URLs from a list of pull requests", async () => {
			const { extractPullRequestUrls } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			const pullRequests: PullRequest[] = [
				{
					prUrl: "https://github.com/org/repo/pull/1",
					prState: "open",
					branch: "feature/a",
					createdAt: 1_700_000_000,
				},
				{
					prUrl: "https://github.com/org/repo/pull/2",
					prState: "merged",
					branch: "feature/b",
					createdAt: 1_700_000_001,
				},
			];

			const urls = extractPullRequestUrls(pullRequests);

			expect(urls).toEqual([
				"https://github.com/org/repo/pull/1",
				"https://github.com/org/repo/pull/2",
			]);
		});

		it("should return an empty array when no pull requests exist", async () => {
			const { extractPullRequestUrls } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			const urls = extractPullRequestUrls([]);

			expect(urls).toEqual([]);
		});

		it("should skip pull requests with empty URLs", async () => {
			const { extractPullRequestUrls } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			const pullRequests: PullRequest[] = [
				{
					prUrl: "",
					prState: "open",
					branch: "feature/a",
					createdAt: 1_700_000_000,
				},
				{
					prUrl: "https://github.com/org/repo/pull/3",
					prState: "open",
					branch: "feature/b",
					createdAt: 1_700_000_001,
				},
			];

			const urls = extractPullRequestUrls(pullRequests);

			expect(urls).toEqual(["https://github.com/org/repo/pull/3"]);
		});
	});

	describe("getPrActionLabel", () => {
		it("should return 'Review PR' for open PRs", async () => {
			const { getPrActionLabel } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			expect(getPrActionLabel("open")).toBe("Review PR");
		});

		it("should return 'View Merged PR' for merged PRs", async () => {
			const { getPrActionLabel } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			expect(getPrActionLabel("merged")).toBe("View Merged PR");
		});

		it("should return 'View Closed PR' for closed PRs", async () => {
			const { getPrActionLabel } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			expect(getPrActionLabel("closed")).toBe("View Closed PR");
		});

		it("should return 'Open PR' for undefined state", async () => {
			const { getPrActionLabel } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			expect(getPrActionLabel(undefined)).toBe("Open PR");
		});
	});

	describe("promptUserForPrAction", () => {
		it("should show notification with PR actions when PRs are available", async () => {
			const vscode = await import("vscode");
			vi.mocked(vscode.window.showInformationMessage).mockResolvedValueOnce(
				"Open PR" as never
			);

			const { promptUserForPrAction } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			const pullRequests: PullRequest[] = [
				{
					prUrl: "https://github.com/org/repo/pull/5",
					prState: "open",
					branch: "feature/x",
					createdAt: 1_700_000_000,
				},
			];

			await promptUserForPrAction(pullRequests, "T001");

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("T001"),
				expect.any(String)
			);
		});

		it("should do nothing when no PRs exist", async () => {
			const vscode = await import("vscode");

			const { promptUserForPrAction } = await import(
				"../../../../src/features/devin/pr-link-handler"
			);

			await promptUserForPrAction([], "T001");

			expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
		});
	});
});
