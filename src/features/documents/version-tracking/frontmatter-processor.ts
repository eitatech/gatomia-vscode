// biome-ignore lint/performance/noNamespaceImport: Required for consistent API with other components using fs.readFile, fs.writeFile
import * as fs from "node:fs/promises";
import matter from "gray-matter";
import type { IFrontmatterProcessor, DocumentMetadata } from "../../../types";

/**
 * Processes YAML frontmatter in Markdown documents.
 * Handles reading, writing, validating, and extracting frontmatter metadata.
 */
export class FrontmatterProcessor implements IFrontmatterProcessor {
	/**
	 * Extracts version and owner metadata from document frontmatter.
	 * Returns default values (version: "1.0", owner: "Unknown") if fields are missing.
	 *
	 * @param documentPath - Absolute path to the Markdown document
	 * @returns Document metadata with version and owner
	 * @throws Error if file cannot be read
	 */
	async extract(documentPath: string): Promise<DocumentMetadata> {
		try {
			const content = await fs.readFile(documentPath, "utf-8");
			const parsed = matter(content);

			return {
				version: (parsed.data.version as string) || "1.0",
				owner: (parsed.data.owner as string) || "Unknown",
			};
		} catch (error) {
			// If file read fails, propagate error
			if (
				error instanceof Error &&
				(error.message.includes("ENOENT") || error.message.includes("EACCES"))
			) {
				throw error;
			}

			// If YAML parsing fails, return defaults gracefully
			return {
				version: "1.0",
				owner: "Unknown",
			};
		}
	}

	/**
	 * Updates frontmatter fields in a document.
	 * Preserves all existing frontmatter fields and document body content.
	 * Creates frontmatter block if document has none.
	 *
	 * @param documentPath - Absolute path to the Markdown document
	 * @param updates - Partial metadata updates (version and/or owner)
	 * @throws Error if file cannot be read or written
	 */
	async update(
		documentPath: string,
		updates: Partial<DocumentMetadata>
	): Promise<void> {
		const content = await fs.readFile(documentPath, "utf-8");
		const parsed = matter(content);

		// Merge updates with existing data
		const updatedData = {
			...parsed.data,
			...updates,
		};

		// Reconstruct document with updated frontmatter
		const updated = matter.stringify(parsed.content, updatedData);

		await fs.writeFile(documentPath, updated, "utf-8");
	}

	/**
	 * Checks if document has valid frontmatter structure.
	 * Valid frontmatter must be parseable YAML (does not require version/owner fields).
	 *
	 * @param documentPath - Absolute path to the Markdown document
	 * @returns True if frontmatter exists and is valid YAML
	 */
	async hasValidFrontmatter(documentPath: string): Promise<boolean> {
		try {
			const content = await fs.readFile(documentPath, "utf-8");
			const parsed = matter(content);

			// Check if frontmatter exists (matter.data is empty object if none)
			return Object.keys(parsed.data).length > 0;
		} catch {
			// Any parsing error means invalid frontmatter
			return false;
		}
	}

	/**
	 * Extracts body content without frontmatter.
	 * Normalizes whitespace for consistent comparison in change detection.
	 *
	 * @param documentPath - Absolute path to the Markdown document
	 * @returns Body content with normalized whitespace
	 * @throws Error if file cannot be read
	 */
	async extractBodyContent(documentPath: string): Promise<string> {
		const content = await fs.readFile(documentPath, "utf-8");
		const parsed = matter(content);

		// Normalize whitespace: trim and reduce multiple newlines
		return parsed.content.trim().replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines
	}
}
