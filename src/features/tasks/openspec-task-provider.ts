import type {
	NormalizedTask,
	TaskProvider,
	NormalizedTaskStatus,
} from "./task-model";
import { parseTasksFromFile, type TaskGroup } from "../../utils/task-parser";
import { SPEC_SYSTEM_MODE } from "../../constants";

export class OpenSpecTaskProvider implements TaskProvider {
	readonly name = SPEC_SYSTEM_MODE.OPENSPEC;

	canHandle(filePath: string): boolean {
		return filePath.includes("openspec/");
	}

	getTasks(specId: string, filePath: string): Promise<NormalizedTask[]> {
		try {
			const groups = parseTasksFromFile(filePath);
			if (!groups || groups.length === 0) {
				return Promise.resolve([]);
			}

			return Promise.resolve(this.normalizeGroups(specId, filePath, groups));
		} catch (error) {
			// Degrade clearly for unsupported/unparseable files
			return Promise.resolve([
				{
					id: `unsupported-${Date.now()}`,
					title: "Failed to parse tasks.md",
					status: "not-started",
					source: {
						system: this.name,
						filePath,
						isUnsupported: true,
					},
					metadata: {},
				},
			]);
		}
	}

	private normalizeGroups(
		specId: string,
		filePath: string,
		groups: TaskGroup[]
	): NormalizedTask[] {
		const normalized: NormalizedTask[] = [];

		for (const group of groups) {
			for (const task of group.tasks) {
				normalized.push({
					id: `${specId}-${task.id}`,
					title: task.title,
					status: this.mapStatus(task.status),
					source: {
						system: this.name,
						filePath,
						line: task.line,
					},
					metadata: {
						phase: task.phase || group.name,
						priority: task.priority,
						complexity: task.complexity,
					},
					execution: {
						state: this.mapExecutionState(task.status),
					},
				});
			}
		}

		return normalized;
	}

	private mapStatus(status: string): NormalizedTaskStatus {
		switch (status) {
			case "completed":
				return "completed";
			case "in-progress":
				return "in-progress";
			default:
				return "not-started";
		}
	}

	private mapExecutionState(
		status: string
	): "queued" | "running" | "completed" | "ready" {
		switch (status) {
			case "completed":
				return "completed";
			case "in-progress":
				return "running";
			default:
				return "ready";
		}
	}
}
