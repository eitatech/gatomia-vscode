import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecAsync } = vi.hoisted(() => ({
	mockExecAsync: vi.fn(),
}));

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
	},
}));

vi.mock("node:child_process", () => ({
	default: { exec: vi.fn() },
	exec: vi.fn(),
}));

vi.mock("node:util", () => ({
	default: { promisify: () => mockExecAsync },
	promisify: () => mockExecAsync,
}));

vi.mock("../../../../src/features/devin/logging", () => ({
	logInfo: vi.fn(),
	logError: vi.fn(),
}));

import { commitAndPush } from "../../../../src/features/devin/git-operations";

describe("commitAndPush", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("commits changes and pushes when there are uncommitted changes", async () => {
		mockExecAsync
			.mockResolvedValueOnce({ stdout: "feature/task-001\n", stderr: "" })
			.mockResolvedValueOnce({ stdout: "", stderr: "" })
			.mockResolvedValueOnce({ stdout: " M src/file.ts\n", stderr: "" })
			.mockResolvedValueOnce({ stdout: "", stderr: "" })
			.mockResolvedValueOnce({ stdout: "abc123\n", stderr: "" })
			.mockResolvedValueOnce({ stdout: "", stderr: "" });

		const result = await commitAndPush("T001", "Implement login");

		expect(result.success).toBe(true);
		expect(result.branch).toBe("feature/task-001");
		expect(result.commitSha).toBe("abc123");

		expect(mockExecAsync).toHaveBeenCalledWith(
			"git rev-parse --abbrev-ref HEAD",
			{ cwd: "/workspace" }
		);
		expect(mockExecAsync).toHaveBeenCalledWith("git add -A", {
			cwd: "/workspace",
		});

		const commitCall = mockExecAsync.mock.calls.find(
			(c: string[]) => typeof c[0] === "string" && c[0].includes("git commit")
		);
		expect(commitCall).toBeDefined();
		expect(commitCall[0]).toContain("T001");
		expect(commitCall[0]).toContain("Implement login");

		const pushCall = mockExecAsync.mock.calls.find(
			(c: string[]) => typeof c[0] === "string" && c[0].includes("git push")
		);
		expect(pushCall).toBeDefined();
		expect(pushCall[0]).toContain("feature/task-001");
	});

	it("skips commit when working directory is clean", async () => {
		mockExecAsync
			.mockResolvedValueOnce({ stdout: "main\n", stderr: "" })
			.mockResolvedValueOnce({ stdout: "", stderr: "" })
			.mockResolvedValueOnce({ stdout: "\n", stderr: "" })
			.mockResolvedValueOnce({ stdout: "def456\n", stderr: "" })
			.mockResolvedValueOnce({ stdout: "", stderr: "" });

		const result = await commitAndPush("T002", "Clean task");

		expect(result.success).toBe(true);
		expect(result.branch).toBe("main");

		const commitCall = mockExecAsync.mock.calls.find(
			(c: string[]) => typeof c[0] === "string" && c[0].includes("git commit")
		);
		expect(commitCall).toBeUndefined();
	});

	it("returns error when git operation fails", async () => {
		mockExecAsync.mockRejectedValueOnce(new Error("not a git repository"));

		const result = await commitAndPush("T003", "Fail task");

		expect(result.success).toBe(false);
		expect(result.error).toContain("not a git repository");
	});
});
