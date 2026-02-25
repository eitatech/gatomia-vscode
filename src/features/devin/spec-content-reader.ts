/**
 * Spec File Content Reader
 *
 * Reads spec markdown files and extracts task details for Devin delegation.
 * Parses task IDs, titles, descriptions, and acceptance criteria from
 * structured spec files.
 *
 * @see specs/001-devin-integration/spec.md (FR-003)
 */

import { Uri, workspace } from "vscode";

// ============================================================================
// Types
// ============================================================================

/**
 * Extracted task details from a spec file.
 */
export interface SpecTaskDetails {
	readonly taskId: string;
	readonly title: string;
	readonly description: string;
	readonly acceptanceCriteria: string[];
}

// ============================================================================
// Reader
// ============================================================================

/**
 * Read the content of a spec file.
 *
 * @param specPath - Absolute path to the spec markdown file
 * @returns The raw markdown content
 */
export async function readSpecContent(specPath: string): Promise<string> {
	const uri = Uri.file(specPath);
	const bytes = await workspace.fs.readFile(uri);
	return new TextDecoder().decode(bytes);
}

/**
 * Extract task details from spec markdown content.
 *
 * Looks for task lines matching the format: `- [ ] TXXX Description`
 * or `- [x] TXXX Description`.
 *
 * @param content - Raw markdown content
 * @param taskId - The task ID to find (e.g., "T001")
 * @returns Extracted task details, or undefined if not found
 */
export function extractTaskFromSpec(
	content: string,
	taskId: string
): SpecTaskDetails | undefined {
	const lines = content.split("\n");
	const taskPattern = new RegExp(
		`^\\s*-\\s*\\[[ xX]\\]\\s*${escapeRegExp(taskId)}\\b(.*)$`
	);

	for (let i = 0; i < lines.length; i++) {
		const match = taskPattern.exec(lines[i]);
		if (match) {
			const title = match[1].trim();
			const description = extractFollowingContent(lines, i + 1);
			const acceptanceCriteria = extractAcceptanceCriteria(lines, i + 1);

			return {
				taskId,
				title: title || taskId,
				description: description || title || taskId,
				acceptanceCriteria,
			};
		}
	}
}

/**
 * Extract all incomplete tasks from spec content.
 *
 * @param content - Raw markdown content
 * @returns Array of task IDs that are not yet completed
 */
export function extractIncompleteTasks(content: string): string[] {
	const lines = content.split("\n");
	const tasks: string[] = [];

	for (const line of lines) {
		const match = INCOMPLETE_TASK_PATTERN.exec(line);
		if (match) {
			tasks.push(match[1]);
		}
	}

	return tasks;
}

// ============================================================================
// Private Helpers
// ============================================================================

const INCOMPLETE_TASK_PATTERN = /^\s*-\s*\[ \]\s*(T\d+)\b/;
const TASK_LINE_PATTERN = /^\s*-\s*\[[ xX]\]/;
const HEADING_PATTERN = /^#{1,6}\s/;
const BULLET_PATTERN = /^\s*[-*]\s+(.+)/;

function extractFollowingContent(lines: string[], startIndex: number): string {
	const contentLines: string[] = [];

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i];
		if (TASK_LINE_PATTERN.test(line) || HEADING_PATTERN.test(line)) {
			break;
		}
		const trimmed = line.trim();
		if (trimmed.length > 0) {
			contentLines.push(trimmed);
		}
		if (contentLines.length >= 10) {
			break;
		}
	}

	return contentLines.join(" ");
}

function extractAcceptanceCriteria(
	lines: string[],
	startIndex: number
): string[] {
	const criteria: string[] = [];

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i];
		if (TASK_LINE_PATTERN.test(line) || HEADING_PATTERN.test(line)) {
			break;
		}
		const bulletMatch = BULLET_PATTERN.exec(line);
		if (bulletMatch) {
			criteria.push(bulletMatch[1].trim());
		}
	}

	return criteria;
}

function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
