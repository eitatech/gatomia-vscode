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
	workspace: {
		workspaceFolders: [
			{ uri: { fsPath: "/mock/workspace" }, name: "workspace", index: 0 },
		],
		fs: {
			readFile: vi.fn(),
			writeFile: vi.fn().mockResolvedValue(undefined),
		},
	},
}));

import type { DevinSession } from "../../../src/features/devin/entities";
import { SessionStatus } from "../../../src/features/devin/types";

function createCompletedSessionWithPR(): DevinSession {
	return {
		sessionId: "devin-sess-pr-001",
		localId: "local-pr-001",
		status: SessionStatus.COMPLETED,
		branch: "feature/devin-task",
		specPath: ".specify/specs/001-feature/tasks.md",
		tasks: [
			{
				taskId: "task-uuid-001",
				specTaskId: "T001",
				title: "Create Type Definitions",
				description: "Implement types",
				priority: "P1",
				status: "completed",
				devinSessionId: "devin-sess-pr-001",
				startedAt: 1_700_000_000,
				completedAt: 1_700_001_000,
			},
		],
		createdAt: 1_700_000_000,
		updatedAt: 1_700_001_000,
		completedAt: 1_700_001_000,
		devinUrl: "https://app.devin.ai/sessions/devin-sess-pr-001",
		pullRequests: [
			{
				prUrl: "https://github.com/org/repo/pull/42",
				prState: "open",
				branch: "devin/T001-create-type-definitions",
				createdAt: 1_700_000_500,
			},
		],
		apiVersion: "v1",
		retryCount: 0,
	};
}

describe("PR Review Workflow Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should open a PR from a completed session", async () => {
		const { openPullRequest, extractPullRequestUrls } = await import(
			"../../../src/features/devin/pr-link-handler"
		);
		const vscode = await import("vscode");

		const session = createCompletedSessionWithPR();
		const urls = extractPullRequestUrls(session.pullRequests);

		expect(urls).toHaveLength(1);
		expect(urls[0]).toBe("https://github.com/org/repo/pull/42");

		const result = await openPullRequest(urls[0]);
		expect(result).toBe(true);
		expect(vscode.env.openExternal).toHaveBeenCalledOnce();
	});

	it("should notify user when a PR is available after session completion", async () => {
		const { promptUserForPrAction } = await import(
			"../../../src/features/devin/pr-link-handler"
		);
		const vscode = await import("vscode");
		vi.mocked(vscode.window.showInformationMessage).mockResolvedValueOnce(
			"Review PR" as never
		);

		const session = createCompletedSessionWithPR();

		await promptUserForPrAction(session.pullRequests, "T001");

		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
			expect.stringContaining("T001"),
			expect.any(String)
		);
	});

	it("should update spec task status when PR is merged", async () => {
		const { updateSpecTaskStatusOnMerge } = await import(
			"../../../src/features/devin/spec-status-updater"
		);

		const session = createCompletedSessionWithPR();
		const mergedSession: DevinSession = {
			...session,
			pullRequests: [
				{
					...session.pullRequests[0],
					prState: "merged",
					mergedAt: 1_700_002_000,
				},
			],
		};

		// Should not throw
		await expect(
			updateSpecTaskStatusOnMerge(
				mergedSession.specPath,
				mergedSession.tasks[0].specTaskId,
				mergedSession.pullRequests[0]
			)
		).resolves.not.toThrow();
	});

	it("should handle PR notification for completed sessions with PRs", async () => {
		const { handlePrNotification } = await import(
			"../../../src/features/devin/pr-notification-handler"
		);
		const vscode = await import("vscode");

		const session = createCompletedSessionWithPR();

		await handlePrNotification(session);

		expect(vscode.window.showInformationMessage).toHaveBeenCalled();
	});

	it("should not notify for sessions without PRs", async () => {
		const { handlePrNotification } = await import(
			"../../../src/features/devin/pr-notification-handler"
		);
		const vscode = await import("vscode");

		const session: DevinSession = {
			...createCompletedSessionWithPR(),
			pullRequests: [],
		};

		await handlePrNotification(session);

		expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
	});
});
