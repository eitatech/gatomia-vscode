import { describe, it, expect, vi, beforeEach } from "vitest";
import { workspace } from "vscode";
import {
	markTaskAsCompleted,
	updateSpecTasksOnSessionComplete,
} from "../../../../src/features/devin/spec-status-updater";
import type { DevinSession } from "../../../../src/features/devin/entities";
import {
	SessionStatus,
	TaskStatus,
} from "../../../../src/features/devin/types";

// ============================================================================
// markTaskAsCompleted (pure function)
// ============================================================================

describe("markTaskAsCompleted", () => {
	it("should mark an incomplete task as completed", () => {
		const content = "- [ ] T001 Some task description\n- [ ] T002 Another task";
		const result = markTaskAsCompleted(content, "T001");
		expect(result).toBe(
			"- [x] T001 Some task description\n- [ ] T002 Another task"
		);
	});

	it("should not change an already completed task", () => {
		const content = "- [x] T001 Already done\n- [ ] T002 Pending";
		const result = markTaskAsCompleted(content, "T001");
		expect(result).toBe(content);
	});

	it("should not change content when task ID is not found", () => {
		const content = "- [ ] T001 Some task\n- [ ] T002 Another task";
		const result = markTaskAsCompleted(content, "T999");
		expect(result).toBe(content);
	});

	it("should handle task IDs with annotations like [P1] [US1]", () => {
		const content = "- [ ] T001 [P1] [US1] Task with annotations";
		const result = markTaskAsCompleted(content, "T001");
		expect(result).toBe("- [x] T001 [P1] [US1] Task with annotations");
	});

	it("should not partially match task IDs (T001 vs T0011)", () => {
		const content = "- [ ] T0011 Extended ID task\n- [ ] T001 Target task";
		const result = markTaskAsCompleted(content, "T001");
		expect(result).toBe("- [ ] T0011 Extended ID task\n- [x] T001 Target task");
	});
});

// ============================================================================
// updateSpecTasksOnSessionComplete
// ============================================================================

// Access the mocked vscode.workspace.fs functions from the global __mocks__/vscode.ts
const mockReadFile = workspace.fs.readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = workspace.fs.writeFile as ReturnType<typeof vi.fn>;

function createSession(overrides: Partial<DevinSession> = {}): DevinSession {
	return {
		sessionId: "devin-sess-001",
		localId: "local-001",
		status: SessionStatus.COMPLETED,
		branch: "feature/test",
		specPath: "/fake/workspace/specs/001-test/tasks.md",
		tasks: [
			{
				taskId: "uuid-001",
				specTaskId: "T001",
				title: "Create package structure",
				description: "Set up the project",
				priority: "P1",
				status: TaskStatus.COMPLETED,
				devinSessionId: "devin-sess-001",
				startedAt: 1_700_000_000,
				completedAt: 1_700_001_000,
			},
		],
		createdAt: 1_700_000_000,
		updatedAt: 1_700_001_000,
		completedAt: 1_700_001_000,
		pullRequests: [],
		apiVersion: "v3",
		retryCount: 0,
		...overrides,
	};
}

describe("updateSpecTasksOnSessionComplete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should mark completed tasks in the tasks.md file", async () => {
		const tasksContent =
			"- [ ] T001 Create package structure\n- [ ] T002 Implement API";
		mockReadFile.mockResolvedValue(new TextEncoder().encode(tasksContent));
		mockWriteFile.mockResolvedValue(undefined);

		await updateSpecTasksOnSessionComplete(createSession());

		expect(mockWriteFile).toHaveBeenCalledTimes(1);
		const writtenContent = new TextDecoder().decode(
			mockWriteFile.mock.calls[0][1]
		);
		expect(writtenContent).toContain("- [x] T001 Create package structure");
		expect(writtenContent).toContain("- [ ] T002 Implement API");
	});

	it("should mark multiple completed tasks in a single write", async () => {
		const tasksContent =
			"- [ ] T001 First task\n- [ ] T002 Second task\n- [ ] T003 Third task";
		mockReadFile.mockResolvedValue(new TextEncoder().encode(tasksContent));
		mockWriteFile.mockResolvedValue(undefined);

		const session = createSession({
			tasks: [
				{
					taskId: "uuid-001",
					specTaskId: "T001",
					title: "First task",
					description: "",
					priority: "P1",
					status: TaskStatus.COMPLETED,
					startedAt: 1_700_000_000,
					completedAt: 1_700_001_000,
				},
				{
					taskId: "uuid-002",
					specTaskId: "T002",
					title: "Second task",
					description: "",
					priority: "P1",
					status: TaskStatus.COMPLETED,
					startedAt: 1_700_000_000,
					completedAt: 1_700_001_000,
				},
			],
		});

		await updateSpecTasksOnSessionComplete(session);

		expect(mockWriteFile).toHaveBeenCalledTimes(1);
		const writtenContent = new TextDecoder().decode(
			mockWriteFile.mock.calls[0][1]
		);
		expect(writtenContent).toContain("- [x] T001 First task");
		expect(writtenContent).toContain("- [x] T002 Second task");
		expect(writtenContent).toContain("- [ ] T003 Third task");
	});

	it("should skip tasks that are not in completed status", async () => {
		const tasksContent = "- [ ] T001 Task one\n- [ ] T002 Task two";
		mockReadFile.mockResolvedValue(new TextEncoder().encode(tasksContent));
		mockWriteFile.mockResolvedValue(undefined);

		const session = createSession({
			tasks: [
				{
					taskId: "uuid-001",
					specTaskId: "T001",
					title: "Task one",
					description: "",
					priority: "P1",
					status: TaskStatus.COMPLETED,
					startedAt: 1_700_000_000,
					completedAt: 1_700_001_000,
				},
				{
					taskId: "uuid-002",
					specTaskId: "T002",
					title: "Task two",
					description: "",
					priority: "P1",
					status: TaskStatus.FAILED,
					startedAt: 1_700_000_000,
				},
			],
		});

		await updateSpecTasksOnSessionComplete(session);

		expect(mockWriteFile).toHaveBeenCalledTimes(1);
		const writtenContent = new TextDecoder().decode(
			mockWriteFile.mock.calls[0][1]
		);
		expect(writtenContent).toContain("- [x] T001 Task one");
		expect(writtenContent).toContain("- [ ] T002 Task two");
	});

	it("should not write if no tasks were updated", async () => {
		const tasksContent = "- [x] T001 Already done";
		mockReadFile.mockResolvedValue(new TextEncoder().encode(tasksContent));

		await updateSpecTasksOnSessionComplete(createSession());

		expect(mockWriteFile).not.toHaveBeenCalled();
	});

	it("should not throw when the tasks file does not exist", async () => {
		mockReadFile.mockRejectedValue(new Error("File not found"));

		await expect(
			updateSpecTasksOnSessionComplete(createSession())
		).resolves.not.toThrow();
	});

	it("should skip sessions with no completed tasks", async () => {
		const session = createSession({ tasks: [] });

		await updateSpecTasksOnSessionComplete(session);

		expect(mockReadFile).not.toHaveBeenCalled();
	});
});
