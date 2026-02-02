import {
	workspace,
	type TextDocument,
	type ExtensionContext,
	type OutputChannel,
	EventEmitter,
	type Event,
} from "vscode";
import { FrontmatterProcessor } from "./frontmatter-processor";
import { GitUserInfoProvider } from "../../../utils/git-user-info";
import { VersionHistoryManager } from "./version-history-manager";
import { VersionIncrementer } from "./version-incrementer";
import { DebounceTracker } from "./debounce-tracker";
import { FileChangeDetector } from "../../../utils/file-change-detector";
import { basename } from "node:path";
import type {
	IDocumentVersionService,
	IFrontmatterProcessor,
	IGitUserInfoProvider,
	IVersionHistoryManager,
	IVersionIncrementer,
	IDebounceTracker,
	IFileChangeDetector,
	DocumentMetadata,
	VersionHistoryEntry,
} from "./types";

/**
 * Main service orchestrating automatic version tracking for SpecKit documents.
 *
 * Responsibilities:
 * - Initialize version tracking for new documents
 * - Process document save events
 * - Coordinate version increment workflow
 * - Manage version history persistence
 * - Handle error recovery and logging
 *
 * Feature: 012-spec-version-tracking (User Story 1 - Automatic Version Initialization)
 */
export class DocumentVersionService implements IDocumentVersionService {
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private readonly frontmatterProcessor: IFrontmatterProcessor;
	private readonly gitUserInfoProvider: IGitUserInfoProvider;
	private readonly versionHistoryManager: IVersionHistoryManager;
	private readonly versionIncrementer: IVersionIncrementer;
	private readonly debounceTracker: IDebounceTracker;
	private readonly fileChangeDetector: IFileChangeDetector;
	private readonly processingDocuments: Set<string> = new Set();
	private readonly _onDidUpdateVersion = new EventEmitter<string>();

	/**
	 * Event fired when a document's version is updated.
	 * Payload: document file path.
	 */
	readonly onDidUpdateVersion: Event<string> = this._onDidUpdateVersion.event;

	// biome-ignore lint/nursery/useMaxParams: Dependency injection requires all 7 parameters
	constructor(
		context: ExtensionContext,
		outputChannel: OutputChannel,
		frontmatterProcessor: IFrontmatterProcessor,
		gitUserInfoProvider: IGitUserInfoProvider,
		versionHistoryManager: IVersionHistoryManager,
		versionIncrementer: IVersionIncrementer,
		debounceTracker: IDebounceTracker,
		fileChangeDetector: IFileChangeDetector
	) {
		this.context = context;
		this.outputChannel = outputChannel;
		this.frontmatterProcessor = frontmatterProcessor;
		this.gitUserInfoProvider = gitUserInfoProvider;
		this.versionHistoryManager = versionHistoryManager;
		this.versionIncrementer = versionIncrementer;
		this.debounceTracker = debounceTracker;
		this.fileChangeDetector = fileChangeDetector;
	}

	/**
	 * Log version change to extension output channel (FR-010 compliance).
	 * Format: [timestamp] [level] Version: document prev→new by author (message)
	 */
	private logVersionChange(options: {
		level: "info" | "warning" | "error";
		event: "increment" | "reset" | "normalization" | "initialization" | "error";
		documentPath: string;
		newVersion: string;
		author: string;
		previousVersion?: string;
		message?: string;
	}): void {
		const {
			level,
			event,
			documentPath,
			newVersion,
			author,
			previousVersion,
			message,
		} = options;
		const timestamp = new Date().toISOString();
		// Use workspace.asRelativePath if available (production), otherwise use basename (tests)
		let relativePath: string;
		try {
			relativePath = workspace.asRelativePath(documentPath);
		} catch {
			relativePath = basename(documentPath);
		}
		const versionChange = previousVersion
			? `${previousVersion}→${newVersion}`
			: newVersion;
		const contextMsg = message ? ` (${message})` : "";

		this.outputChannel.appendLine(
			`[${timestamp}] [${level.toUpperCase()}] Version: ${relativePath} ${versionChange} by ${author}${contextMsg}`
		);

		// Send telemetry event for metrics collection
		this.sendTelemetry(`version.${event}`, {
			level,
			documentType: basename(documentPath),
			previousVersion,
			newVersion,
			success: level !== "error",
		});
	}

	/**
	 * Send telemetry event for version tracking operations.
	 * Tracks success/failure rates, operation types, and performance metrics.
	 */
	private sendTelemetry(
		eventName: string,
		properties?: Record<string, unknown>
	): void {
		try {
			// Log telemetry to output channel (in production, this would be sent to a telemetry service)
			this.outputChannel.appendLine(
				`[DocumentVersionService] Telemetry: ${eventName} ${JSON.stringify(properties || {})}`
			);
		} catch {
			// Silently fail telemetry - don't block version tracking operations
		}
	}

	/**
	 * Activate the service and initialize version tracking for existing documents.
	 * Scans workspace for SpecKit documents without version/owner fields.
	 *
	 * Called once during extension activation.
	 */
	async activate(): Promise<void> {
		const workspaceFolders = workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			return;
		}

		// Scan for SpecKit documents in specs/ and .specify/ directories
		const patterns = [
			"**/specs/**/spec.md",
			"**/specs/**/plan.md",
			"**/specs/**/tasks.md",
			"**/.specify/**/spec.md",
			"**/.specify/**/plan.md",
			"**/.specify/**/tasks.md",
		];

		try {
			for (const pattern of patterns) {
				const files = await workspace.findFiles(
					pattern,
					"**/node_modules/**",
					1000
				);

				for (const uri of files) {
					await this.initializeIfNeeded(uri.fsPath);
				}
			}
		} catch (error) {
			// Log error but don't fail activation
			console.error("Failed to scan for SpecKit documents:", error);
		}
	}

	/**
	 * Initialize document if it doesn't have version/owner fields.
	 *
	 * @param documentPath - Absolute path to the document
	 */
	private async initializeIfNeeded(documentPath: string): Promise<void> {
		try {
			// Check if document already has version/owner
			const metadata = await this.frontmatterProcessor.extract(documentPath);

			// If version is "1.0" (default) and owner is "Unknown" (default),
			// or if document has no frontmatter, initialize it
			if (metadata.version === "1.0" && metadata.owner === "Unknown") {
				await this.initializeVersionTracking(documentPath);
			}
		} catch {
			// Ignore errors (document might not exist or be readable)
		}
	}

	/**
	 * Initialize version tracking for a newly created document.
	 * Sets VERSION to "1.0" and OWNER to Git user info.
	 *
	 * User Story 1: When a user creates a new spec/plan/tasks document,
	 * the system automatically initializes VERSION to "1.0" and OWNER
	 * to Git user info.
	 *
	 * @param documentPath - Absolute path to the document
	 * @returns DocumentMetadata with version "1.0" and Git user as owner
	 */
	async initializeVersionTracking(
		documentPath: string
	): Promise<DocumentMetadata> {
		try {
			// Get Git user info with error recovery
			const owner = await this.getGitUserInfoForInit(documentPath);

			// Initialize metadata
			const metadata: DocumentMetadata = {
				version: "1.0",
				owner,
				lastModified: new Date().toISOString(),
				createdBy: owner,
			};

			// Update document frontmatter with error recovery
			await this.updateFrontmatterForInit(
				documentPath,
				metadata.version,
				metadata.owner
			);

			// Add history entry and update workspace state (non-fatal)
			await this.addHistoryAndStateForInit(
				documentPath,
				owner,
				metadata.lastModified
			);

			// Fire event for UI refresh
			this._onDidUpdateVersion.fire(documentPath);

			// Log initialization
			this.logVersionChange({
				level: "info",
				event: "initialization",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion: undefined,
				message: this.gitUserInfoProvider.isGitConfigured()
					? "version tracking initialized"
					: "version tracking initialized (Git not configured)",
			});

			return metadata;
		} catch (error) {
			// Catch-all for unexpected errors
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: "system",
				previousVersion: undefined,
				message: `Initialization failed: ${errorMsg}`,
			});
			throw error;
		}
	}

	/**
	 * Process a document save event and update version/owner if applicable.
	 *
	 * User Story 2: When a user modifies an existing document, the system
	 * detects the change and automatically increments the version number.
	 *
	 * Workflow:
	 * 1. Check if document is SpecKit document (spec.md, plan.md, tasks.md)
	 * 2. Prevent infinite loop (check processingDocuments set)
	 * 3. Check debounce (30s since last increment)
	 * 4. Check if body content changed (exclude frontmatter formatting)
	 * 5. Increment version + update owner
	 * 6. Write back to file
	 * 7. Update workspace state history
	 *
	 * @param document - The document that was saved
	 */
	async processDocumentSave(document: TextDocument): Promise<void> {
		const documentPath = document.uri.fsPath;

		// Check if SpecKit document
		if (!this.isSpecKitDocument(documentPath)) {
			return;
		}

		// Prevent infinite loop (dirty flag pattern)
		if (this.processingDocuments.has(documentPath)) {
			console.info(
				`Skipping version increment for ${documentPath} (already processing)`
			);
			return;
		}

		try {
			this.processingDocuments.add(documentPath);

			// Check if save should be processed (debounce + body changes)
			const shouldProcessResult = await this.shouldProcessSave(documentPath);
			if (!shouldProcessResult.shouldProcess) {
				console.info(
					`Skipping version increment for ${documentPath} (${shouldProcessResult.reason})`
				);
				return;
			}

			// Extract and validate metadata (with error recovery)
			const metadataResult =
				await this.extractAndValidateMetadata(documentPath);
			if (!metadataResult) {
				return; // Error already logged
			}
			const { metadata, validVersion } = metadataResult;

			// Increment version and get owner (with error recovery)
			const incrementResult = this.incrementVersionAndGetOwner(
				documentPath,
				validVersion
			);
			if (!incrementResult) {
				return; // Error already logged
			}
			const { newVersion, newOwner } = incrementResult;

			// Persist version update (frontmatter, history, state)
			const persistSuccess = await this.persistVersionUpdate(
				documentPath,
				newVersion,
				newOwner,
				validVersion
			);
			if (!persistSuccess) {
				return; // Error already logged
			}

			// Record debounce timestamp
			await this.debounceTracker.recordIncrement(documentPath);

			// Update baseline for change detection
			await this.fileChangeDetector.updateBaseline(documentPath);

			// Log successful increment
			this.logVersionChange({
				level: "info",
				event: "increment",
				documentPath,
				newVersion,
				author: newOwner,
				previousVersion: validVersion,
			});

			// Fire event for UI refresh
			this._onDidUpdateVersion.fire(documentPath);
		} catch (error) {
			// Catch-all for unexpected errors
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "n/a",
				author: "system",
				previousVersion: undefined,
				message: `Unexpected error: ${errorMessage}`,
			});
			// Don't throw - allow save to complete even if version tracking fails
		} finally {
			this.processingDocuments.delete(documentPath);
		}
	}

	/**
	 * Check if document is a SpecKit document (spec.md, plan.md, tasks.md).
	 * Used to filter file system watcher events and determine which documents to process.
	 *
	 * @param documentPath - Absolute or relative file path
	 * @returns true if document matches SpecKit document pattern
	 */
	private isSpecKitDocument(documentPath: string): boolean {
		const filename = basename(documentPath);
		return (
			filename === "spec.md" ||
			filename === "plan.md" ||
			filename === "tasks.md"
		);
	}

	/**
	 * Reset document version to "1.0" (used by reset command).
	 *
	 * Creates a version history entry with changeType = "reset"
	 * and updates the owner to the current Git user.
	 *
	 * @param documentPath - Absolute path to the document
	 */
	async resetDocumentVersion(documentPath: string): Promise<void> {
		try {
			// Get current version (with error recovery)
			const previousVersion =
				await this.getCurrentVersionForReset(documentPath);

			// Get Git user info (with error recovery)
			const owner = this.getGitUserInfoForReset(documentPath, previousVersion);

			// Perform reset operations (frontmatter, history, state)
			await this.performResetOperations(documentPath, owner, previousVersion);

			// Fire event for UI refresh
			this._onDidUpdateVersion.fire(documentPath);

			// Log reset
			this.logVersionChange({
				level: "info",
				event: "reset",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion,
				message: "user command",
			});
		} catch (error) {
			// Catch-all for unexpected errors
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: "system",
				previousVersion: undefined,
				message: `Reset failed: ${errorMsg}`,
			});
			throw error;
		}
	}

	/**
	 * Get current version metadata for a document.
	 *
	 * @param documentPath - Absolute path to the document
	 * @returns DocumentMetadata or undefined if never tracked
	 */
	async getDocumentMetadata(
		documentPath: string
	): Promise<DocumentMetadata | undefined> {
		const state =
			await this.versionHistoryManager.getDocumentState(documentPath);

		if (!state) {
			return;
		}

		return {
			version: state.currentVersion,
			owner: state.owner,
			createdBy: state.createdBy,
		};
	}

	/**
	 * Get version history for a document.
	 *
	 * @param documentPath - Absolute path to the document
	 * @returns VersionHistoryEntry[] (empty if no history)
	 */
	// biome-ignore lint/suspicious/useAwait: Delegates to async manager method
	async getVersionHistory(
		documentPath: string
	): Promise<VersionHistoryEntry[]> {
		return this.versionHistoryManager.getHistory(documentPath);
	}

	/**
	 * Extract Git user info for initialization with error recovery.
	 * @returns Formatted owner string
	 * @throws Error if Git info cannot be obtained
	 */
	private getGitUserInfoForInit(documentPath: string): string {
		try {
			const gitInfo = this.gitUserInfoProvider.getUserInfo();
			if (!this.gitUserInfoProvider.isGitConfigured()) {
				console.warn(
					`Git not configured for ${documentPath}, using system username`
				);
			}
			return this.gitUserInfoProvider.formatOwner(gitInfo);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: "system",
				previousVersion: undefined,
				message: `Failed to get Git user info: ${errorMsg}`,
			});
			throw error;
		}
	}

	/**
	 * Update frontmatter for initialization with error recovery.
	 * @throws Error if frontmatter update fails
	 */
	private async updateFrontmatterForInit(
		documentPath: string,
		version: string,
		owner: string
	): Promise<void> {
		try {
			await this.frontmatterProcessor.update(documentPath, { version, owner });
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion: undefined,
				message: `Failed to update frontmatter during initialization: ${errorMsg}`,
			});
			throw error;
		}
	}

	/**
	 * Add history entry and update workspace state for initialization (non-fatal).
	 */
	private async addHistoryAndStateForInit(
		documentPath: string,
		owner: string,
		timestamp: string
	): Promise<void> {
		const historyEntry: VersionHistoryEntry = {
			documentPath,
			previousVersion: "",
			newVersion: "1.0",
			timestamp: timestamp || new Date().toISOString(),
			author: owner,
			changeType: "initialization",
		};

		// Add history entry (non-fatal)
		try {
			await this.versionHistoryManager.addEntry(documentPath, historyEntry);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion: undefined,
				message: `Failed to add history entry (initialization succeeded): ${errorMsg}`,
			});
		}

		// Update workspace state (non-fatal)
		try {
			await this.versionHistoryManager.updateDocumentState(documentPath, {
				currentVersion: "1.0",
				owner,
				createdBy: owner,
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion: undefined,
				message: `Failed to update workspace state (initialization succeeded): ${errorMsg}`,
			});
		}

		// Update baseline (non-fatal)
		try {
			await this.fileChangeDetector.updateBaseline(documentPath);
		} catch (error) {
			console.warn(
				`Failed to set baseline for ${documentPath}:`,
				error instanceof Error ? error.message : String(error)
			);
		}
	}

	/**
	 * Check if save should be processed (debounce, body changes).
	 * @returns true if save should proceed
	 */
	private async shouldProcessSave(
		documentPath: string
	): Promise<{ shouldProcess: boolean; reason?: string }> {
		// Check debounce (30s window)
		if (!(await this.debounceTracker.shouldIncrement(documentPath))) {
			this.sendTelemetry("version.debounce.blocked", {
				documentType: basename(documentPath),
				reason: "debounce_active",
			});
			return { shouldProcess: false, reason: "debounce active" };
		}

		// Check if body content changed
		const hasChanged =
			await this.fileChangeDetector.hasBodyContentChanged(documentPath);
		if (!hasChanged) {
			this.sendTelemetry("version.increment.skipped", {
				documentType: basename(documentPath),
				reason: "no_body_content_change",
			});
			return { shouldProcess: false, reason: "no body content change" };
		}

		return { shouldProcess: true };
	}

	/**
	 * Extract and validate metadata with error recovery.
	 * @returns Metadata and valid version, or null if extraction fails
	 */
	private async extractAndValidateMetadata(
		documentPath: string
	): Promise<{ metadata: DocumentMetadata; validVersion: string } | null> {
		// Extract metadata
		let metadata: DocumentMetadata;
		try {
			metadata = await this.frontmatterProcessor.extract(documentPath);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion: "n/a",
				author: "system",
				previousVersion: undefined,
				message: `YAML parse error, skipping version increment: ${errorMsg}`,
			});
			return null;
		}

		// Validate and normalize version
		let validVersion = metadata.version;
		if (!this.versionIncrementer.isValid(validVersion)) {
			const normalizedVersion = this.versionIncrementer.normalize(validVersion);
			this.logVersionChange({
				level: "warning",
				event: "normalization",
				documentPath,
				newVersion: normalizedVersion,
				author: metadata.owner,
				previousVersion: validVersion,
				message: "malformed version normalized",
			});
			validVersion = normalizedVersion;
		}

		return { metadata, validVersion };
	}

	/**
	 * Increment version and get Git user info with error recovery.
	 * @returns New version and owner, or null if increment fails
	 */
	private incrementVersionAndGetOwner(
		documentPath: string,
		validVersion: string
	): { newVersion: string; newOwner: string } | null {
		// Increment version
		let newVersion: string;
		try {
			newVersion = this.versionIncrementer.increment(validVersion);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "n/a",
				author: "system",
				previousVersion: validVersion,
				message: `Version increment failed: ${errorMsg}`,
			});
			return null;
		}

		// Get Git user info
		let gitInfo: { name: string; email: string };
		try {
			gitInfo = this.gitUserInfoProvider.getUserInfo();
			if (!this.gitUserInfoProvider.isGitConfigured()) {
				this.logVersionChange({
					level: "warning",
					event: "increment",
					documentPath,
					newVersion,
					author: this.gitUserInfoProvider.formatOwner(gitInfo),
					previousVersion: validVersion,
					message: "Git not configured - using system username",
				});
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "n/a",
				author: "system",
				previousVersion: validVersion,
				message: `Git user info failed: ${errorMsg}`,
			});
			return null;
		}

		return {
			newVersion,
			newOwner: this.gitUserInfoProvider.formatOwner(gitInfo),
		};
	}

	/**
	 * Persist version update (frontmatter, history, state) with error recovery.
	 * @returns true if update succeeded, false otherwise
	 */
	private async persistVersionUpdate(
		documentPath: string,
		newVersion: string,
		newOwner: string,
		validVersion: string
	): Promise<boolean> {
		// Update frontmatter
		try {
			await this.frontmatterProcessor.update(documentPath, {
				version: newVersion,
				owner: newOwner,
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion,
				author: newOwner,
				previousVersion: validVersion,
				message: `Frontmatter update failed: ${errorMsg}`,
			});
			return false;
		}

		// Create history entry (non-fatal)
		const historyEntry: VersionHistoryEntry = {
			documentPath,
			previousVersion: validVersion,
			newVersion,
			timestamp: new Date().toISOString(),
			author: newOwner,
			changeType: "auto-increment",
		};

		try {
			await this.versionHistoryManager.addEntry(documentPath, historyEntry);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion,
				author: newOwner,
				previousVersion: validVersion,
				message: `History entry failed (version updated but not logged): ${errorMsg}`,
			});
		}

		// Update workspace state (non-fatal)
		try {
			await this.versionHistoryManager.updateDocumentState(documentPath, {
				currentVersion: newVersion,
				owner: newOwner,
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion,
				author: newOwner,
				previousVersion: validVersion,
				message: `Workspace state update failed: ${errorMsg}`,
			});
		}

		return true;
	}

	/**
	 * Get current version for reset operation with error recovery.
	 * @returns Previous version string
	 */
	private async getCurrentVersionForReset(
		documentPath: string
	): Promise<string> {
		let previousVersion = "0.0";
		try {
			const currentMetadata =
				await this.frontmatterProcessor.extract(documentPath);
			previousVersion = currentMetadata.version || "0.0";
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "reset",
				documentPath,
				newVersion: "1.0",
				author: "system",
				previousVersion,
				message: `Failed to read current version: ${errorMsg}`,
			});
		}
		return previousVersion;
	}

	/**
	 * Get Git user info for reset operation with error recovery.
	 * @returns Formatted owner string
	 * @throws Error if Git info cannot be obtained
	 */
	private getGitUserInfoForReset(
		documentPath: string,
		previousVersion: string
	): string {
		let userInfo: { name: string; email: string };
		try {
			userInfo = this.gitUserInfoProvider.getUserInfo();
			if (!this.gitUserInfoProvider.isGitConfigured()) {
				this.logVersionChange({
					level: "warning",
					event: "reset",
					documentPath,
					newVersion: "1.0",
					author: this.gitUserInfoProvider.formatOwner(userInfo),
					previousVersion,
					message: "Git not configured - using system username",
				});
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: "system",
				previousVersion,
				message: `Failed to get Git user info: ${errorMsg}`,
			});
			throw error;
		}
		return this.gitUserInfoProvider.formatOwner(userInfo);
	}

	/**
	 * Perform reset operations (frontmatter, history, state) with error recovery.
	 * @throws Error if frontmatter update fails (fatal)
	 */
	private async performResetOperations(
		documentPath: string,
		owner: string,
		previousVersion: string
	): Promise<void> {
		// Update frontmatter (fatal error)
		try {
			await this.frontmatterProcessor.update(documentPath, {
				version: "1.0",
				owner,
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "error",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion,
				message: `Failed to update frontmatter during reset: ${errorMsg}`,
			});
			throw error;
		}

		// Create history entry (non-fatal)
		const historyEntry: VersionHistoryEntry = {
			documentPath,
			previousVersion,
			newVersion: "1.0",
			timestamp: new Date().toISOString(),
			author: owner,
			changeType: "reset",
		};

		try {
			await this.versionHistoryManager.addEntry(documentPath, historyEntry);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion,
				message: `Failed to add history entry (reset succeeded): ${errorMsg}`,
			});
		}

		// Update workspace state (non-fatal)
		try {
			await this.versionHistoryManager.updateDocumentState(documentPath, {
				currentVersion: "1.0",
				owner,
				createdBy: owner,
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logVersionChange({
				level: "warning",
				event: "error",
				documentPath,
				newVersion: "1.0",
				author: owner,
				previousVersion,
				message: `Failed to update workspace state (reset succeeded): ${errorMsg}`,
			});
		}

		// Update baseline (non-fatal)
		try {
			await this.fileChangeDetector.updateBaseline(documentPath);
		} catch (error) {
			console.warn(
				`Failed to update baseline for ${documentPath}:`,
				error instanceof Error ? error.message : String(error)
			);
		}
	}
}

/**
 * Factory function to create DocumentVersionService with all dependencies.
 * Used in extension.ts activation.
 *
 * @param context - VS Code extension context
 * @returns Configured IDocumentVersionService instance
 */
export function createDocumentVersionService(
	context: ExtensionContext,
	outputChannel: OutputChannel
): IDocumentVersionService {
	// Instantiate dependencies
	const frontmatterProcessor = new FrontmatterProcessor();
	const gitUserInfoProvider = new GitUserInfoProvider();
	const versionHistoryManager = new VersionHistoryManager(context);
	const versionIncrementer = new VersionIncrementer();
	const debounceTracker = new DebounceTracker(versionHistoryManager);
	const fileChangeDetector = new FileChangeDetector(frontmatterProcessor);

	// Create and return service
	return new DocumentVersionService(
		context,
		outputChannel,
		frontmatterProcessor,
		gitUserInfoProvider,
		versionHistoryManager,
		versionIncrementer,
		debounceTracker,
		fileChangeDetector
	);
}
