import { type ExtensionContext, type Uri, workspace } from "vscode";
import { formatGitUser, getGitUserInfo } from "../utils/git-user-info";
import { DocumentVersionService } from "./document-version-service";

/**
 * Service to process document templates with version and owner information.
 * Called after template-based document creation to inject actual values.
 */
export class DocumentTemplateProcessor {
	private static instance: DocumentTemplateProcessor | null = null;
	private readonly versionService: DocumentVersionService;

	private constructor(context: ExtensionContext) {
		this.versionService = DocumentVersionService.getInstance(context);
	}

	static getInstance(context: ExtensionContext): DocumentTemplateProcessor {
		if (!DocumentTemplateProcessor.instance) {
			DocumentTemplateProcessor.instance = new DocumentTemplateProcessor(
				context
			);
		}
		return DocumentTemplateProcessor.instance;
	}

	/**
	 * Process a newly created document from template.
	 * Replaces [AUTHOR] placeholder with actual git user.
	 * Ensures version is set to 1.0 for new documents.
	 */
	async processNewDocument(documentUri: Uri): Promise<void> {
		const gitUser = await getGitUserInfo();
		const owner = formatGitUser(gitUser);

		let content = await this.readDocument(documentUri);

		// Replace [AUTHOR] placeholder with actual author
		content = content.replace(/\[AUTHOR\]/g, owner);

		// Ensure version is set to 1.0 (template should have this, but enforce it)
		content = this.versionService.updateFrontmatter(content, "1.0", owner);

		await this.writeDocument(documentUri, content);
	}

	/**
	 * Process an existing document update.
	 * Increments version and updates owner if needed.
	 */
	async processDocumentUpdate(documentUri: Uri): Promise<void> {
		let content = await this.readDocument(documentUri);

		// Get next version based on current version
		const nextVersion = await this.versionService.getNextVersion(documentUri);

		// Get current owner or set from git if not present
		const gitUser = await getGitUserInfo();
		const owner = formatGitUser(gitUser);

		// Update frontmatter with new version
		content = this.versionService.updateFrontmatter(
			content,
			nextVersion,
			owner
		);

		await this.writeDocument(documentUri, content);

		// Clear cache so next read gets the updated version
		this.versionService.clearCache(documentUri);
	}

	/**
	 * Get document version and owner info without modifying the document
	 */
	async getDocumentMetadata(documentUri: Uri): Promise<{
		version: string;
		owner: string | undefined;
	}> {
		const gitUser = await getGitUserInfo();
		const defaultOwner = formatGitUser(gitUser);

		const version = await this.versionService.getCurrentVersion(documentUri);

		try {
			const bytes = await workspace.fs.readFile(documentUri);
			const content = Buffer.from(bytes).toString("utf8");
			const matter = await import("gray-matter");
			const parsed = matter.default(content);

			const owner = (parsed.data?.owner as string | undefined) || defaultOwner;

			return { version, owner };
		} catch {
			return { version, owner: defaultOwner };
		}
	}

	private async readDocument(uri: Uri): Promise<string> {
		const bytes = await workspace.fs.readFile(uri);
		return Buffer.from(bytes).toString("utf8");
	}

	private async writeDocument(uri: Uri, content: string): Promise<void> {
		const bytes = Buffer.from(content, "utf8");
		await workspace.fs.writeFile(uri, bytes);
	}
}
