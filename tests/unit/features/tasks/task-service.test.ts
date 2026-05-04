import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskService } from "../../../../src/features/tasks/task-service";
// biome-ignore lint/performance/noNamespaceImport: needed for vi.spyOn
import * as adapter from "../../../../src/utils/spec-kit-adapter";

describe("TaskService", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("should find and return tasks from spec adapter discovery", async () => {
		const service = new TaskService();

		const mockAdapter = {
			getSpecFiles: vi.fn().mockReturnValue({
				tasks: "/workspace/.specify/test-spec/tasks.md",
			}),
		} as any;

		vi.spyOn(adapter, "getSpecSystemAdapter").mockReturnValue(mockAdapter);

		// Provider mock since it hits SpecKitTaskProvider
		vi.spyOn((service as any).providers[0], "getTasks").mockResolvedValue([
			{
				id: "test-spec-T1",
				title: "Test Task",
				status: "completed",
				source: { system: "speckit", filePath: "/path" },
				metadata: {},
			} as any,
		]);

		const tasks = await service.getTasksForSpec("test-spec");

		expect(mockAdapter.getSpecFiles).toHaveBeenCalledWith("test-spec");
		expect(tasks.length).toBe(1);
		expect(tasks[0].id).toBe("test-spec-T1");
	});

	it("should return fallback task if no provider handles file", async () => {
		const service = new TaskService();
		const tasks = await service.getTasksFromFile(
			"spec-1",
			"/random/unsupported.json"
		);

		expect(tasks.length).toBe(1);
		expect(tasks[0].source.isUnsupported).toBe(true);
		expect(tasks[0].title).toContain("No task provider handles file");
	});
});
