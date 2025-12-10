import { basename } from "node:path";

const EXTENSION_PATTERN = /\.[^/.]+$/;
const LEADING_NUMBERS_PATTERN = /^\d+-/;
const WHITESPACE_PATTERN = /[-_]/g;

/**
 * Converts a filename to a friendly display name
 * Examples:
 * - "implementation.md" -> "Implementation"
 * - "user-stories.md" -> "User Stories"
 * - "001-task-name.md" -> "Task Name"
 */
export function toFriendlyName(filename: string): string {
	// Remove extension
	let name = basename(filename).replace(EXTENSION_PATTERN, "");

	// Remove leading numbers and dashes (e.g., "001-")
	name = name.replace(LEADING_NUMBERS_PATTERN, "");

	// Replace hyphens and underscores with spaces
	name = name.replace(WHITESPACE_PATTERN, " ");

	// Capitalize first letter of each word
	name = name
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");

	return name;
}

/**
 * Converts absolute file path to workspace-relative path
 * Used for display purposes only
 */
export function getRelativePath(
	absolutePath: string,
	workspacePath?: string
): string {
	if (!workspacePath) {
		return basename(absolutePath);
	}

	if (absolutePath.startsWith(workspacePath)) {
		return absolutePath.slice(workspacePath.length + 1);
	}

	return absolutePath;
}
