import { createHash } from "node:crypto";
import type { ExtensionContext } from "vscode";
import type { PreviewDocumentType } from "../types/preview";

const SPEC_NAME_PATTERN = /^([^/]+)/;

export interface DocumentVersion {
	documentId: string;
	documentType: PreviewDocumentType;
	contentHash: string;
	lastModified: number;
	structuralHash?: string; // For tasks/checklists - ignores checkbox changes
}

export interface DocumentDependency {
	documentId: string;
	documentType: PreviewDocumentType;
	dependsOn: string[]; // Array of document IDs this depends on
}

export interface OutdatedDocumentInfo {
	documentId: string;
	documentType: PreviewDocumentType;
	outdatedSince: number;
	changedDependencies: Array<{
		documentId: string;
		documentType: PreviewDocumentType;
		lastChanged: number;
	}>;
}

/**
 * Tracks document versions and dependencies to detect when documents
 * need to be updated due to changes in their dependencies.
 */
export class DocumentDependencyTracker {
	private static instance: DocumentDependencyTracker;
	private readonly context: ExtensionContext;
	private readonly VERSIONS_KEY = "gatomia.document.versions";
	private readonly DEPENDENCIES_KEY = "gatomia.document.dependencies";

	/**
	 * Document dependency hierarchy in SpecKit/OpenSpec
	 */
	private readonly dependencyRules: Record<
		PreviewDocumentType,
		PreviewDocumentType[]
	> = {
		spec: [], // Base document - no dependencies
		research: [], // Supports spec but doesn't depend on it
		dataModel: ["spec"], // Data model depends on spec
		api: ["spec", "dataModel"], // API depends on spec and data model
		plan: ["spec"], // Plan depends on spec
		task: ["spec", "plan"], // Tasks depend on spec and plan
		checklist: ["task"], // Checklist depends on tasks
		quickstart: ["spec", "plan"], // Quickstart depends on spec and plan
	};

	private constructor(context: ExtensionContext) {
		this.context = context;
	}

	static getInstance(context?: ExtensionContext): DocumentDependencyTracker {
		if (!DocumentDependencyTracker.instance) {
			if (!context) {
				throw new Error(
					"DocumentDependencyTracker must be initialized with context first"
				);
			}
			DocumentDependencyTracker.instance = new DocumentDependencyTracker(
				context
			);
		}
		return DocumentDependencyTracker.instance;
	}

	/**
	 * Computes content hash for a document
	 */
	private computeContentHash(content: string): string {
		return createHash("sha256").update(content).digest("hex");
	}

	/**
	 * Computes structural hash for tasks/checklists (ignores checkbox states)
	 */
	private computeStructuralHash(
		content: string,
		docType: PreviewDocumentType
	): string {
		if (docType === "task" || docType === "checklist") {
			// Remove checkbox markers to detect only structural changes
			const normalized = content
				.replace(/- \[[ xX]\]/g, "- [ ]") // Normalize checkboxes
				.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "DATE") // Normalize dates
				.replace(
					/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
					"UUID"
				); // Normalize UUIDs
			return this.computeContentHash(normalized);
		}
		return this.computeContentHash(content);
	}

	/**
	 * Records the current version of a document
	 */
	async recordDocumentVersion(
		documentId: string,
		documentType: PreviewDocumentType,
		content: string
	): Promise<void> {
		const versions = this.getStoredVersions();
		const contentHash = this.computeContentHash(content);
		const structuralHash = this.computeStructuralHash(content, documentType);

		versions[documentId] = {
			documentId,
			documentType,
			contentHash,
			structuralHash,
			lastModified: Date.now(),
		};

		await this.context.workspaceState.update(this.VERSIONS_KEY, versions);

		// Auto-register dependencies based on document type
		await this.registerDependency(documentId, documentType);
	}

	/**
	 * Registers a document's dependencies based on its type
	 */
	private async registerDependency(
		documentId: string,
		documentType: PreviewDocumentType
	): Promise<void> {
		const dependencies = this.getStoredDependencies();
		const dependsOnTypes = this.dependencyRules[documentType] || [];

		// Extract spec name from document ID (e.g., "001-feature" from "001-feature/spec.md")
		const specName = this.extractSpecName(documentId);
		if (!specName) {
			return;
		}

		// Build list of dependency document IDs based on the same spec
		const dependsOn = dependsOnTypes.map((type) => `${specName}/${type}.md`);

		dependencies[documentId] = {
			documentId,
			documentType,
			dependsOn,
		};

		await this.context.workspaceState.update(
			this.DEPENDENCIES_KEY,
			dependencies
		);
	}

	/**
	 * Extracts spec name from document ID
	 */
	private extractSpecName(documentId: string): string | null {
		// Handle formats like "001-feature/spec.md" or "001-feature"
		const match = documentId.match(SPEC_NAME_PATTERN);
		return match ? match[1] : null;
	}

	/**
	 * Checks if a document is outdated based on its dependencies
	 */
	isDocumentOutdated(
		documentId: string,
		documentType: PreviewDocumentType
	): OutdatedDocumentInfo | null {
		const versions = this.getStoredVersions();
		const dependencies = this.getStoredDependencies();

		const currentDoc = versions[documentId];
		if (!currentDoc) {
			// Document not tracked yet - not outdated
			return null;
		}

		const dependency = dependencies[documentId];
		if (!dependency || dependency.dependsOn.length === 0) {
			// No dependencies - never outdated
			return null;
		}

		const changedDependencies: OutdatedDocumentInfo["changedDependencies"] = [];

		for (const depId of dependency.dependsOn) {
			const depVersion = versions[depId];
			if (!depVersion) {
				continue;
			}

			// Check if dependency was modified after this document
			if (depVersion.lastModified > currentDoc.lastModified) {
				// Dependency changed after this document was last updated
				changedDependencies.push({
					documentId: depId,
					documentType: depVersion.documentType,
					lastChanged: depVersion.lastModified,
				});
			}
		}

		if (changedDependencies.length > 0) {
			return {
				documentId,
				documentType,
				outdatedSince: Math.min(
					...changedDependencies.map((d) => d.lastChanged)
				),
				changedDependencies,
			};
		}

		return null;
	}

	/**
	 * Marks a document as updated (resets its timestamp)
	 */
	async markDocumentUpdated(documentId: string): Promise<void> {
		const versions = this.getStoredVersions();
		const version = versions[documentId];
		if (!version) {
			return;
		}

		version.lastModified = Date.now();
		await this.context.workspaceState.update(this.VERSIONS_KEY, versions);
	}

	/**
	 * Gets the dependency chain for a document (what depends on what)
	 */
	getDependencyChain(documentId: string): string[] {
		const dependencies = this.getStoredDependencies();
		const dep = dependencies[documentId];
		return dep ? dep.dependsOn : [];
	}

	/**
	 * Gets all documents that depend on a given document
	 */
	getDependentDocuments(documentId: string): string[] {
		const dependencies = this.getStoredDependencies();
		return Object.values(dependencies)
			.filter((dep) => dep.dependsOn.includes(documentId))
			.map((dep) => dep.documentId);
	}

	/**
	 * Clears all tracking data (for testing/debugging)
	 */
	async clearAllTracking(): Promise<void> {
		await this.context.workspaceState.update(this.VERSIONS_KEY, undefined);
		await this.context.workspaceState.update(this.DEPENDENCIES_KEY, undefined);
	}

	private getStoredVersions(): Record<string, DocumentVersion> {
		return this.context.workspaceState.get(this.VERSIONS_KEY, {});
	}

	private getStoredDependencies(): Record<string, DocumentDependency> {
		return this.context.workspaceState.get(this.DEPENDENCIES_KEY, {});
	}
}
