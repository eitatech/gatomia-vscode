/**
 * Converts a filename to a friendly display name
 * Examples:
 * - "implementation.md" -> "Implementation"
 * - "user-stories.md" -> "User Stories"
 * - "001-task-name.md" -> "Task Name"
 */
const EXTENSION_PATTERN = /\.[^/.]+$/;
const LEADING_NUMBERS_PATTERN = /^\d+-/;
const WHITESPACE_PATTERN = /[-_]/g;

export function toFriendlyName(filename: string): string {
	// Get just the filename if path provided
	const name = filename.split("/").pop() || filename;

	// Remove extension
	let baseName = name.replace(EXTENSION_PATTERN, "");

	// Remove leading numbers and dashes (e.g., "001-")
	baseName = baseName.replace(LEADING_NUMBERS_PATTERN, "");

	// Replace hyphens and underscores with spaces
	baseName = baseName.replace(WHITESPACE_PATTERN, " ");

	// Capitalize first letter of each word
	baseName = baseName
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");

	return baseName;
}
