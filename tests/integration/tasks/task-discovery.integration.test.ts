import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TaskService } from "../../../src/features/tasks/task-service";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Task Discovery Integration", () => {
	let workspaceRoot: string;
	let service: TaskService;

	beforeAll(() => {
		// Set up a mock workspace with SpecKit and OpenSpec layouts
		workspaceRoot = mkdtempSync(join(tmpdir(), "gatomia-test-"));

		// SpecKit layout
		const speckitDir = join(workspaceRoot, ".specify", "test-feature");
		mkdirSync(speckitDir, { recursive: true });
		writeFileSync(
			join(speckitDir, "tasks.md"),
			"## Phase 1: Setup\n- [x] T001 Initial setup\n- [ ] T002 Implement core logic\n"
		);

		// OpenSpec layout
		const openspecDir = join(
			workspaceRoot,
			"openspec",
			"specs",
			"another-feature"
		);
		mkdirSync(openspecDir, { recursive: true });
		writeFileSync(
			join(openspecDir, "tasks.md"),
			"## Phase 1: Main\n- [ ] T100 Do openspec things\n"
		);

		service = new TaskService();
	});

	afterAll(() => {
		rmSync(workspaceRoot, { recursive: true, force: true });
	});

	it("should discover and parse tasks from SpecKit layout", async () => {
		const filePath = join(
			workspaceRoot,
			".specify",
			"test-feature",
			"tasks.md"
		);
		const tasks = await service.getTasksFromFile("test-feature", filePath);

		expect(tasks.length).toBe(2);
		expect(tasks[0].title).toBe("Initial setup");
		expect(tasks[0].status).toBe("completed");
		expect(tasks[0].source.system).toBe("speckit");

		expect(tasks[1].title).toBe("Implement core logic");
		expect(tasks[1].status).toBe("not-started");
	});

	it("should discover and parse tasks from OpenSpec layout", async () => {
		const filePath = join(
			workspaceRoot,
			"openspec",
			"specs",
			"another-feature",
			"tasks.md"
		);
		const tasks = await service.getTasksFromFile("another-feature", filePath);

		expect(tasks.length).toBe(1);
		expect(tasks[0].title).toBe("Do openspec things");
		expect(tasks[0].status).toBe("not-started");
		expect(tasks[0].source.system).toBe("openspec");
	});
});
