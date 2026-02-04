import type { IFileChangeDetector } from "../features/documents/version-tracking/types";
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
	 * Checks if a baseline exists for the given document.
	 */
	hasBaseline(documentPath: string): boolean {
		return this.baselines.has(documentPath);
	}

	/**
	 * Checks if the body content has changed compared to the stored baseline.
	 * If no baseline exists, assumes content has changed (returns true) and establishes baseline.
	 *
	 * NOTE: Baseline should be established during document initialization via updateBaseline().
	 * If called without prior baseline, we cannot detect change, so we assume "changed" for safety.
	 */
	async hasBodyContentChanged(documentPath: string): Promise<boolean> {
		const currentBody =
			await this.frontmatterProcessor.extractBodyContent(documentPath);
		const normalized = this.normalizeWhitespace(currentBody);

		if (!this.baselines.has(documentPath)) {
			// No baseline = cannot determine change, assume changed for safety
			// This handles cases where documents are loaded/created without initialization
			this.baselines.set(documentPath, normalized);
			return true; // Treat as changed (no baseline to compare against)
		}

		const hasChanged = this.baselines.get(documentPath) !== normalized;

		// Don't update baseline here - that's done explicitly after successful increment
		return hasChanged;
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
	clearBaseline(documentPath: string): Promise<void> {
		this.baselines.delete(documentPath);
		return Promise.resolve();
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
