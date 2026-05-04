import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpecKitTaskProvider } from "../../../../src/features/tasks/speckit-task-provider";
import { OpenSpecTaskProvider } from "../../../../src/features/tasks/openspec-task-provider";
// biome-ignore lint/performance/noNamespaceImport: needed for vi.spyOn
import * as taskParser from "../../../../src/utils/task-parser";
import { SPEC_SYSTEM_MODE } from "../../../../src/constants";

describe("Task Providers", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe("SpecKitTaskProvider", () => {
		const provider = new SpecKitTaskProvider();

		it("should handle speckit paths", () => {
			expect(provider.canHandle("/workspace/.specify/feature-1/tasks.md")).toBe(
				true
			);
			expect(provider.canHandle("/workspace/specs/feature-2/tasks.md")).toBe(
				true
			);
			expect(provider.canHandle("/workspace/docs/readme.md")).toBe(false);
		});

		it("should normalize parsed tasks", async () => {
			vi.spyOn(taskParser, "parseTasksFromFile").mockReturnValue([
				{
					name: "Phase 1",
					tasks: [
						{
							id: "T1",
							title: "A simple task",
							status: "in-progress",
							line: 5,
							phase: "Phase 1",
						},
					],
				},
			]);

			const tasks = await provider.getTasks("feature-1", "/path/to/tasks.md");

			expect(tasks.length).toBe(1);
			const task = tasks[0];
			expect(task.id).toBe("feature-1-T1");
			expect(task.title).toBe("A simple task");
			expect(task.status).toBe("in-progress");
			expect(task.source.system).toBe(SPEC_SYSTEM_MODE.SPECKIT);
			expect(task.source.filePath).toBe("/path/to/tasks.md");
			expect(task.source.line).toBe(5);
			expect(task.metadata.phase).toBe("Phase 1");
			expect(task.execution?.state).toBe("running"); // mapped from in-progress
		});

		it("should return unsupported format task gracefully on throw", async () => {
			vi.spyOn(taskParser, "parseTasksFromFile").mockImplementation(() => {
				throw new Error("Parser error");
			});

			const tasks = await provider.getTasks("feature-err", "/path/to/tasks.md");
			expect(tasks.length).toBe(1);
			expect(tasks[0].source.isUnsupported).toBe(true);
			expect(tasks[0].status).toBe("not-started");
		});
	});

	describe("OpenSpecTaskProvider", () => {
		const provider = new OpenSpecTaskProvider();

		it("should handle openspec paths", () => {
			expect(
				provider.canHandle("/workspace/openspec/specs/feature/tasks.md")
			).toBe(true);
			expect(provider.canHandle("/workspace/.specify/feature/tasks.md")).toBe(
				false
			);
		});

		it("should map status to execution state correctly", async () => {
			vi.spyOn(taskParser, "parseTasksFromFile").mockReturnValue([
				{
					name: "Setup",
					tasks: [
						{ id: "T1", title: "Task 1", status: "completed", line: 1 },
						{ id: "T2", title: "Task 2", status: "not-started", line: 2 },
					],
				},
			]);

			const tasks = await provider.getTasks("os-feature", "/openspec/tasks.md");

			expect(tasks[0].execution?.state).toBe("completed");
			expect(tasks[1].execution?.state).toBe("ready");
		});
	});
});
