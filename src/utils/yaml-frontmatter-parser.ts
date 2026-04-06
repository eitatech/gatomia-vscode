/**
 * YAML Front Matter Parser
 *
 * Utility to parse YAML front matter from Markdown files and extract document titles.
 * Falls back to first H1 heading if no front matter title, then to friendly filename.
 */

const YAML_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;
const TITLE_FIELD_PATTERN = /^title:\s*["']?(.+?)["']?\s*$/m;
const H1_HEADING_PATTERN = /^#\s+(.+)$/m;
const LINE_BREAK_PATTERN = /\r?\n/;

export interface FrontmatterResult {
	title?: string;
	metadata?: Record<string, string>;
}

/**
 * Parses YAML front matter from Markdown content.
 *
 * @param content - The raw Markdown file content
 * @returns Parsed frontmatter with title and metadata, or empty result if no frontmatter
 *
 * @example
 * ```typescript
 * const result = parseYamlFrontmatter(`---
 * title: Project Overview
 * author: John Doe
 * ---
 * # Content here`);
 *
 * console.log(result.title); // "Project Overview"
 * ```
 */
export function parseYamlFrontmatter(content: string): FrontmatterResult {
	const match = YAML_FRONTMATTER_PATTERN.exec(content);

	if (!match) {
		return {};
	}

	const yamlContent = match[1];
	const metadata: Record<string, string> = {};

	// Parse simple key-value pairs from YAML (without a full YAML parser dependency)
	const lines = yamlContent.split(LINE_BREAK_PATTERN);
	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			let value = line.slice(colonIndex + 1).trim();
			// Remove surrounding quotes if present
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			metadata[key] = value;
		}
	}

	return {
		title: metadata.title,
		metadata,
	};
}

/**
 * Extracts the document title from Markdown content.
 * Priority order:
 * 1. YAML front matter `title` field
 * 2. First H1 heading in the document
 * 3. Returns undefined (caller should use filename fallback)
 *
 * @param content - The raw Markdown file content
 * @returns The extracted title, or undefined if no title found
 */
export function extractDocumentTitle(content: string): string | undefined {
	// First, try YAML front matter
	const frontmatter = parseYamlFrontmatter(content);
	if (frontmatter.title) {
		return frontmatter.title;
	}

	// Fallback to first H1 heading
	// Strip front matter first to avoid false matches
	const contentWithoutFrontmatter = content.replace(
		YAML_FRONTMATTER_PATTERN,
		""
	);
	const h1Match = H1_HEADING_PATTERN.exec(contentWithoutFrontmatter);
	if (h1Match) {
		return h1Match[1].trim();
	}
}

/**
 * Checks if content has YAML front matter.
 *
 * @param content - The raw Markdown file content
 * @returns True if content starts with YAML front matter delimiters
 */
export function hasFrontmatter(content: string): boolean {
	return YAML_FRONTMATTER_PATTERN.test(content);
}
