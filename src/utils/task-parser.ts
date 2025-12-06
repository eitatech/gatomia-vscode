import { readFileSync, existsSync } from "node:fs";
import { workspace } from "vscode";
import { join } from "node:path";

/**
 * Task status enum
 */
export type TaskStatus = "completed" | "in-progress" | "not-started";

/**
 * Parsed task from tasks.md
 */
export interface ParsedTask {
	id: string;
	title: string;
	status: TaskStatus;
	phase?: string;
	priority?: string;
	complexity?: string;
	line: number;
}

/**
 * Task group (phase or section)
 */
export interface TaskGroup {
	name: string;
	tasks: ParsedTask[];
}

/**
 * Pattern to match task headers like "### T1.1: Create Type Definitions"
 */
const TASK_HEADER_PATTERN = /^###\s+(T[\d.]+):\s*(.+)$/;

/**
 * Pattern to match inline task format like "- [X] T001 Add mongodb crate"
 * or "- [ ] T038 [P] [US2] Create MigrationEngine struct"
 * Captures: checkbox state, task ID, optional tags, and description
 */
const INLINE_TASK_PATTERN =
	/^-\s*\[([ Xx])\]\s+(T\d+)\s*(?:\[P\])?\s*(?:\[US\d+\])?\s*(.+)$/;

/**
 * Pattern to match acceptance criteria items like "- [X] All entity types match"
 * This pattern should NOT match inline task format (no T### ID after checkbox)
 */
const CHECKBOX_PATTERN = /^-\s*\[([ Xx])\]\s+(?!T\d+\s)(.+)$/;

/**
 * Pattern to match phase headers like "## Phase 1: Foundation & Core Types (P1)"
 */
const PHASE_HEADER_PATTERN = /^##\s+(?:Phase\s+\d+:\s*)?(.+?)(?:\s*\(P\d+\))?$/;

/**
 * Pattern to match priority/complexity in task description
 */
const PRIORITY_PATTERN = /\*\*Priority\*\*:\s*(P\d+)/;
const COMPLEXITY_PATTERN = /\*\*Complexity\*\*:\s*(\w+)/;

/**
 * Pattern for STATUS markers like "**STATUS**: ✅ **COMPLETE**"
 */
const STATUS_COMPLETE_PATTERN =
	/\*\*STATUS\*\*:\s*✅?\s*\*\*COMPLETE\*\*|STATUS:\s*✅|COMPLETE|COMPLETED/i;
const STATUS_IN_PROGRESS_PATTERN =
	/\*\*STATUS\*\*:\s*🔄?\s*\*\*IN[- ]?PROGRESS\*\*|STATUS:\s*🔄|IN[- ]?PROGRESS/i;

/**
 * Parse tasks from a tasks.md file
 */
export function parseTasksFromFile(filePath: string): TaskGroup[] {
	if (!existsSync(filePath)) {
		return [];
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		return parseTasksContent(content);
	} catch {
		return [];
	}
}

/**
 * Parse tasks from content string
 */
export function parseTasksContent(content: string): TaskGroup[] {
	const lines = content.split("\n");
	const groups: TaskGroup[] = [];

	let currentGroup: TaskGroup | null = null;
	let currentTask: ParsedTask | null = null;
	let taskContentLines: string[] = [];
	let inAcceptanceCriteria = false;
	let acceptanceCriteriaItems: { checked: boolean; text: string }[] = [];

	const finalizeTask = () => {
		if (currentTask && currentGroup) {
			// Determine task status based on acceptance criteria (only for header-style tasks)
			if (acceptanceCriteriaItems.length > 0) {
				const completedCount = acceptanceCriteriaItems.filter(
					(item) => item.checked
				).length;
				const totalCount = acceptanceCriteriaItems.length;

				if (completedCount === totalCount) {
					currentTask.status = "completed";
				} else if (completedCount > 0) {
					currentTask.status = "in-progress";
				} else {
					currentTask.status = "not-started";
				}
			}

			// Check for explicit STATUS marker in task content
			const taskContent = taskContentLines.join("\n");
			if (STATUS_COMPLETE_PATTERN.test(taskContent)) {
				currentTask.status = "completed";
			} else if (STATUS_IN_PROGRESS_PATTERN.test(taskContent)) {
				currentTask.status = "in-progress";
			}

			// Extract priority and complexity
			const priorityMatch = taskContent.match(PRIORITY_PATTERN);
			if (priorityMatch) {
				currentTask.priority = priorityMatch[1];
			}

			const complexityMatch = taskContent.match(COMPLEXITY_PATTERN);
			if (complexityMatch) {
				currentTask.complexity = complexityMatch[1];
			}

			currentGroup.tasks.push(currentTask);
		}

		currentTask = null;
		taskContentLines = [];
		inAcceptanceCriteria = false;
		acceptanceCriteriaItems = [];
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNumber = i + 1;

		// Check for phase header (## Phase N: Name or ## Section Name)
		const phaseMatch = line.match(PHASE_HEADER_PATTERN);
		if (
			phaseMatch &&
			!line.includes("Task Count") &&
			!line.includes("Summary") &&
			!line.includes("Risk") &&
			!line.includes("Next Steps") &&
			!line.includes("Testing Coverage") &&
			!line.includes("Recommended") &&
			!line.includes("Dependencies") &&
			!line.includes("Execution Order") &&
			!line.includes("Parallel Example") &&
			!line.includes("Implementation Strategy") &&
			!line.includes("Format:") &&
			!line.includes("Notes") &&
			line.startsWith("##") &&
			!line.startsWith("###")
		) {
			// Finalize previous task before starting new group
			finalizeTask();

			currentGroup = {
				name: phaseMatch[1].trim(),
				tasks: [],
			};
			groups.push(currentGroup);
			continue;
		}

		// Check for inline task format: - [X] T001 Description or - [ ] T038 [P] [US2] Description
		const inlineTaskMatch = line.match(INLINE_TASK_PATTERN);
		if (inlineTaskMatch && currentGroup) {
			// Finalize any previous header-style task
			finalizeTask();

			const isChecked = inlineTaskMatch[1].toLowerCase() === "x";
			const taskId = inlineTaskMatch[2];
			const taskTitle = inlineTaskMatch[3].trim();

			// Add inline task directly to group (no multi-line content)
			currentGroup.tasks.push({
				id: taskId,
				title: taskTitle,
				status: isChecked ? "completed" : "not-started",
				phase: currentGroup.name,
				line: lineNumber,
			});
			continue;
		}

		// Check for header-style task: ### T1.1: Create Type Definitions
		const taskMatch = line.match(TASK_HEADER_PATTERN);
		if (taskMatch) {
			// Finalize previous task
			finalizeTask();

			currentTask = {
				id: taskMatch[1],
				title: taskMatch[2].trim(),
				status: "not-started",
				phase: currentGroup?.name,
				line: lineNumber,
			};
			continue;
		}

		// If we're in a header-style task, collect content
		if (currentTask) {
			taskContentLines.push(line);

			// Check for acceptance criteria section
			if (
				line.includes("**Acceptance Criteria**") ||
				line.includes("Acceptance Criteria:")
			) {
				inAcceptanceCriteria = true;
				continue;
			}

			// Check if we're exiting acceptance criteria (new section or task)
			if (
				inAcceptanceCriteria &&
				(line.startsWith("---") ||
					line.startsWith("##") ||
					(line.startsWith("**") && !line.match(CHECKBOX_PATTERN)))
			) {
				inAcceptanceCriteria = false;
			}

			// Parse checkbox items in acceptance criteria
			if (inAcceptanceCriteria) {
				const checkboxMatch = line.match(CHECKBOX_PATTERN);
				if (checkboxMatch) {
					acceptanceCriteriaItems.push({
						checked: checkboxMatch[1].toLowerCase() === "x",
						text: checkboxMatch[2],
					});
				}
			}
		}
	}

	// Finalize last task
	finalizeTask();

	// Filter out empty groups
	return groups.filter((group) => group.tasks.length > 0);
}

/**
 * Get the absolute path for a tasks.md file
 */
export function getTasksFilePath(
	specName: string,
	isChange = false
): string | null {
	const workspaceFolders = workspace.workspaceFolders;
	if (!workspaceFolders) {
		return null;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;

	// Try different possible paths
	const possiblePaths = isChange
		? [
				join(workspaceRoot, "openspec", "changes", specName, "tasks.md"),
				join(workspaceRoot, ".specify", specName, "tasks.md"),
				join(workspaceRoot, "specs", specName, "tasks.md"),
			]
		: [
				join(workspaceRoot, ".specify", specName, "tasks.md"),
				join(workspaceRoot, "specs", specName, "tasks.md"),
				join(workspaceRoot, "openspec", "specs", specName, "tasks.md"),
			];

	for (const path of possiblePaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

/**
 * Get the icon name for a task status
 * Uses the same icons as VS Code Testing extension
 */
export function getTaskStatusIcon(status: TaskStatus): string {
	switch (status) {
		case "completed":
			return "pass"; // Green checkmark
		case "in-progress":
			return "sync~spin"; // Spinning/in-progress icon
		case "not-started":
			return "record"; // Circle/record icon
		default:
			return "record";
	}
}

/**
 * Get the icon name for a group status (folder/phase)
 */
export function getGroupStatusIcon(status: TaskStatus): string {
	switch (status) {
		case "completed":
			return "pass"; // All tasks completed
		case "in-progress":
			return "sync~spin"; // Some tasks completed
		case "not-started":
			return "record"; // No tasks completed
		default:
			return "record";
	}
}

/**
 * Calculate the aggregate status of a group of tasks
 */
export function calculateGroupStatus(tasks: ParsedTask[]): TaskStatus {
	if (tasks.length === 0) {
		return "not-started";
	}

	const completedCount = tasks.filter((t) => t.status === "completed").length;

	if (completedCount === tasks.length) {
		return "completed";
	}

	if (completedCount > 0) {
		return "in-progress";
	}

	return "not-started";
}

/**
 * Calculate the aggregate status of all task groups
 */
export function calculateOverallStatus(groups: TaskGroup[]): TaskStatus {
	const allTasks = groups.flatMap((g) => g.tasks);
	return calculateGroupStatus(allTasks);
}

/**
 * Get tooltip text for a task status
 */
export function getTaskStatusTooltip(status: TaskStatus): string {
	switch (status) {
		case "completed":
			return "Completed";
		case "in-progress":
			return "In Progress";
		case "not-started":
			return "Not Started";
		default:
			return "Unknown";
	}
}
