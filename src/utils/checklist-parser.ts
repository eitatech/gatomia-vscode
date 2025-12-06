import { readFileSync, existsSync } from "node:fs";
import type { TaskStatus } from "./task-parser";

/**
 * Parsed checklist item
 */
export interface ChecklistItem {
	text: string;
	checked: boolean;
	line: number;
}

/**
 * Checklist status with details
 */
export interface ChecklistStatus {
	status: TaskStatus;
	total: number;
	completed: number;
}

/**
 * Pattern to match checkbox items like "- [x] Item text" or "- [ ] Item text"
 */
const CHECKBOX_PATTERN = /^-\s*\[([ Xx])\]\s+(.+)$/;

/**
 * Parse checklist items from a checklist file
 */
export function parseChecklistFromFile(filePath: string): ChecklistItem[] {
	if (!existsSync(filePath)) {
		return [];
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		return parseChecklistContent(content);
	} catch {
		return [];
	}
}

/**
 * Parse checklist items from content string
 */
export function parseChecklistContent(content: string): ChecklistItem[] {
	const lines = content.split("\n");
	const items: ChecklistItem[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(CHECKBOX_PATTERN);

		if (match) {
			items.push({
				text: match[2].trim(),
				checked: match[1].toLowerCase() === "x",
				line: i + 1,
			});
		}
	}

	return items;
}

/**
 * Calculate checklist status from items
 */
export function calculateChecklistStatus(
	items: ChecklistItem[]
): ChecklistStatus {
	if (items.length === 0) {
		return {
			status: "not-started",
			total: 0,
			completed: 0,
		};
	}

	const completed = items.filter((item) => item.checked).length;
	const total = items.length;

	let status: TaskStatus;
	if (completed === total) {
		status = "completed";
	} else if (completed > 0) {
		status = "in-progress";
	} else {
		status = "not-started";
	}

	return {
		status,
		total,
		completed,
	};
}

/**
 * Get checklist status from file path
 */
export function getChecklistStatusFromFile(filePath: string): ChecklistStatus {
	const items = parseChecklistFromFile(filePath);
	return calculateChecklistStatus(items);
}
