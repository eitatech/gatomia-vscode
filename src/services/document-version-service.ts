import { type ExtensionContext, type Uri, workspace } from "vscode";
import matter from "gray-matter";

/**
 * Document version in major.minor format (e.g., "1.0", "1.9", "2.0")
 */
export interface DocumentVersion {
	major: number;
	minor: number;
}

/**
 * Service to manage document versioning.
 * Versions follow {major}.{minor} format: 1.0 to 1.9, then 2.0, etc.
 */
export class DocumentVersionService {
	private static instance: DocumentVersionService | null = null;
	private readonly context: ExtensionContext;

	// In-memory cache of document versions
	// Key: document path, Value: current version string
	private readonly versionCache: Map<string, string> = new Map();

	private constructor(context: ExtensionContext) {
		this.context = context;
	}

	static getInstance(context: ExtensionContext): DocumentVersionService {
		if (!DocumentVersionService.instance) {
			DocumentVersionService.instance = new DocumentVersionService(context);
		}
		return DocumentVersionService.instance;
	}

	/**
	 * Parse version string to DocumentVersion object
	 */
	parseVersion(versionString: string): DocumentVersion {
		const parts = versionString.split(".");
		const major = Number.parseInt(parts[0] || "1", 10);
		const minor = Number.parseInt(parts[1] || "0", 10);

		return { major, minor };
	}

	/**
	 * Format DocumentVersion to string
	 */
	formatVersion(version: DocumentVersion): string {
		return `${version.major}.${version.minor}`;
	}

	/**
	 * Increment version following the rules:
	 * - Minor increments from 0 to 9
	 * - When minor reaches 9, next version is major+1.0
	 */
	incrementVersion(currentVersion: string): string {
		const version = this.parseVersion(currentVersion);

		if (version.minor < 9) {
			version.minor += 1;
		} else {
			version.major += 1;
			version.minor = 0;
		}

		return this.formatVersion(version);
	}

	/**
	 * Get current version from document's frontmatter.
	 * Returns "1.0" if no version is found.
	 */
	async getCurrentVersion(documentUri: Uri): Promise<string> {
		// Check cache first
		const cached = this.versionCache.get(documentUri.fsPath);
		if (cached) {
			return cached;
		}

		try {
			const bytes = await workspace.fs.readFile(documentUri);
			const content = Buffer.from(bytes).toString("utf8");
			const parsed = matter(content);

			const version = (parsed.data?.version as string | undefined) || "1.0";
			this.versionCache.set(documentUri.fsPath, version);

			return version;
		} catch (error) {
			// Document doesn't exist yet or error reading, return initial version
			return "1.0";
		}
	}

	/**
	 * Get next version for a document (increments current version).
	 * If document doesn't exist, returns "1.0".
	 */
	async getNextVersion(documentUri: Uri): Promise<string> {
		const currentVersion = await this.getCurrentVersion(documentUri);
		return this.incrementVersion(currentVersion);
	}

	/**
	 * Update frontmatter in markdown content with new version and owner.
	 * Preserves all other frontmatter fields.
	 */
	updateFrontmatter(content: string, version: string, owner?: string): string {
		const parsed = matter(content);

		// Update or add version and owner
		parsed.data = parsed.data || {};
		parsed.data.version = version;
		if (owner !== undefined) {
			parsed.data.owner = owner;
		}

		// Reconstruct markdown with updated frontmatter
		return matter.stringify(parsed.content, parsed.data);
	}

	/**
	 * Clear cached version for a document (call when document is updated)
	 */
	clearCache(documentUri: Uri): void {
		this.versionCache.delete(documentUri.fsPath);
	}

	/**
	 * Clear all cached versions
	 */
	clearAllCache(): void {
		this.versionCache.clear();
	}
}
