import type { IFileChangeDetector } from "../types/version-tracking";
import type { IFrontmatterProcessor } from "../features/documents/version-tracking/types";

/**
 * Detects meaningful changes in document body content by comparing against stored baselines.
 * Normalizes whitespace to avoid false positives from formatting-only changes.
 */
export class FileChangeDetector implements IFileChangeDetector {
	private readonly baselines: Map<string, string> = new Map();
	private readonly frontmatterProcessor: IFrontmatterProcessor;

	constructor(frontmatterProcessor: IFrontmatterProcessor) {
		this.frontmatterProcessor = frontmatterProcessor;
	}

	/**
	 * Checks if the body content has changed compared to the stored baseline.
	 * Returns true if no baseline exists or if content differs after normalization.
	 */
	async hasBodyContentChanged(documentPath: string): Promise<boolean> {
		const currentBody =
			await this.frontmatterProcessor.extractBodyContent(documentPath);
		const normalized = this.normalizeWhitespace(currentBody);

		if (!this.baselines.has(documentPath)) {
			return true; // No baseline = treat as changed
		}

		return this.baselines.get(documentPath) !== normalized;
	}

	/**
	 * Updates the baseline for a document with its current body content.
	 */
	async updateBaseline(documentPath: string): Promise<void> {
		const body =
			await this.frontmatterProcessor.extractBodyContent(documentPath);
		this.baselines.set(documentPath, this.normalizeWhitespace(body));
	}

	/**
	 * Clears the stored baseline for a document.
	 */
	clearBaseline(documentPath: string): void {
		this.baselines.delete(documentPath);
	}

	/**
	 * Normalizes whitespace to prevent false positives from formatting changes:
	 * - Converts CRLF line endings to LF
	 * - Collapses multiple spaces to single space (preserves newlines)
	 * - Collapses multiple newlines to double newline
	 * - Trims leading/trailing whitespace
	 */
	private normalizeWhitespace(content: string): string {
		return content
			.replace(/\r\n/g, "\n") // CRLF → LF
			.replace(/[^\S\n]+/g, " ") // Multiple non-newline whitespace → single space
			.replace(/\n{3,}/g, "\n\n") // Multiple newlines → double
			.trim(); // Remove leading/trailing whitespace
	}
}
