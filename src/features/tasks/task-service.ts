import type { NormalizedTask, TaskProvider } from "./task-model";
import { SpecKitTaskProvider } from "./speckit-task-provider";
import { OpenSpecTaskProvider } from "./openspec-task-provider";
import { getSpecSystemAdapter } from "../../utils/spec-kit-adapter";

export class TaskService {
	private readonly providers: TaskProvider[] = [];

	constructor() {
		// Register built-in providers
		this.registerProvider(new SpecKitTaskProvider());
		this.registerProvider(new OpenSpecTaskProvider());
	}

	registerProvider(provider: TaskProvider): void {
		this.providers.push(provider);
	}

	/**
	 * Get normalized tasks for a specific spec.
	 * Discovers the tasks.md path using SpecSystemAdapter.
	 */
	getTasksForSpec(specId: string): Promise<NormalizedTask[]> {
		const adapter = getSpecSystemAdapter();
		const files = adapter.getSpecFiles(specId);

		const tasksFilePath = files.tasks;
		if (!tasksFilePath) {
			return [];
		}

		return this.getTasksFromFile(specId, tasksFilePath);
	}

	/**
	 * Read normalized tasks from a direct file path by matching the right provider.
	 */
	getTasksFromFile(
		specId: string,
		filePath: string
	): Promise<NormalizedTask[]> {
		const provider = this.providers.find((p) => p.canHandle(filePath));

		if (!provider) {
			// Fallback degrading gracefully
			return [
				{
					id: `unsupported-${Date.now()}`,
					title: `No task provider handles file: ${filePath}`,
					status: "not-started",
					source: {
						system: "unknown",
						filePath,
						isUnsupported: true,
					},
					metadata: {},
				},
			];
		}

		return provider.getTasks(specId, filePath);
	}
}

// Singleton export
let _taskServiceInstance: TaskService | null = null;
export function getTaskService(): TaskService {
	if (!_taskServiceInstance) {
		_taskServiceInstance = new TaskService();
	}
	return _taskServiceInstance;
}
