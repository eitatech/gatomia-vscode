/**
 * Type definitions for Document Version Tracking feature.
 *
 * Based on contracts from specs/012-spec-version-tracking/contracts/document-version-service.api.ts
 * Feature: 012-spec-version-tracking
 * Date: 2026-01-29
 */

import type { TextDocument, ExtensionContext } from "vscode";

// ============================================================================
// Core Service API
// ============================================================================

/**
 * Main service orchestrating automatic version tracking for SpecKit documents.
 */
export interface IDocumentVersionService {
	processDocumentSave(document: TextDocument): Promise<void>;
	initializeVersionTracking(documentPath: string): Promise<DocumentMetadata>;
	resetDocumentVersion(documentPath: string): Promise<void>;
	getDocumentMetadata(
		documentPath: string
	): Promise<DocumentMetadata | undefined>;
	getVersionHistory(documentPath: string): Promise<VersionHistoryEntry[]>;
}

// ============================================================================
// Component Interfaces
// ============================================================================

/**
 * Pure version increment logic (no I/O, easily testable).
 */
export interface IVersionIncrementer {
	increment(currentVersion: string): string;
	isValid(version: string): boolean;
	normalize(version: string): string;
}

/**
 * YAML frontmatter extraction and manipulation using gray-matter.
 */
export interface IFrontmatterProcessor {
	extract(documentPath: string): Promise<DocumentMetadata>;
	update(
		documentPath: string,
		updates: Partial<DocumentMetadata>
	): Promise<void>;
	hasValidFrontmatter(documentPath: string): Promise<boolean>;
	extractBodyContent(documentPath: string): Promise<string>;
}

/**
 * Manages version history persistence in VS Code Workspace State.
 */
export interface IVersionHistoryManager {
	getHistory(documentPath: string): Promise<VersionHistoryEntry[]>;
	addEntry(documentPath: string, entry: VersionHistoryEntry): Promise<void>;
	getDocumentState(documentPath: string): Promise<DocumentState | undefined>;
	updateDocumentState(
		documentPath: string,
		state: Partial<DocumentState>
	): Promise<void>;
	clearHistory(documentPath: string): Promise<void>;
	getWorkspaceState(): Promise<WorkspaceVersionState>;
}

/**
 * Tracks last version increment timestamp for 30-second debounce.
 */
export interface IDebounceTracker {
	shouldIncrement(documentPath: string): Promise<boolean>;
	recordIncrement(documentPath: string): Promise<void>;
	clear(documentPath: string): Promise<void>;
}

/**
 * Provides Git user.name and user.email for owner attribution.
 */
export interface IGitUserInfoProvider {
	getUserInfo(): GitUserInfo;
	formatOwner(info: GitUserInfo): string;
	isGitConfigured(): boolean;
}

/**
 * Detects if document body content changed (excludes frontmatter formatting).
 */
export interface IFileChangeDetector {
	hasBaseline(documentPath: string): boolean;
	hasBodyContentChanged(documentPath: string): Promise<boolean>;
	updateBaseline(documentPath: string): Promise<void>;
	clearBaseline(documentPath: string): Promise<void>;
}

// ============================================================================
// Data Types
// ============================================================================

/**
 * Document version and ownership metadata.
 */
export interface DocumentMetadata {
	version: string;
	owner: string;
	lastModified?: string; // ISO 8601 timestamp
	createdBy?: string; // Immutable original author
}

/**
 * Version history entry (max 50 per document, FIFO).
 */
export interface VersionHistoryEntry {
	documentPath: string;
	previousVersion: string;
	newVersion: string;
	timestamp: string; // ISO 8601
	author: string;
	changeType:
		| "auto-increment"
		| "manual-set"
		| "initialization"
		| "normalization"
		| "reset";
}

/**
 * Document state in workspace storage.
 */
export interface DocumentState {
	currentVersion: string;
	owner: string;
	createdBy: string;
	history: VersionHistoryEntry[];
	lastIncrementTimestamp?: number; // Unix timestamp (ms)
}

/**
 * Top-level workspace state container.
 */
export interface WorkspaceVersionState {
	schemaVersion: string; // "1.0"
	documents: Record<string, DocumentState>;
}

/**
 * Git user configuration.
 */
export interface GitUserInfo {
	name: string;
	email: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if document is a SpecKit document (spec.md, plan.md, tasks.md).
 *
 * @param documentPath Absolute or relative file path
 * @returns true if document matches SpecKit document pattern
 */
export function isSpecKitDocument(documentPath: string): boolean {
	const fileName = documentPath.split("/").pop() || "";
	return ["spec.md", "plan.md", "tasks.md"].includes(fileName);
}

// ============================================================================
// Service Factory
// ============================================================================

/**
 * Factory function to create DocumentVersionService with all dependencies.
 *
 * @param context VS Code extension context
 * @returns Configured IDocumentVersionService instance
 */
export function createDocumentVersionService(
	context: ExtensionContext
): IDocumentVersionService {
	throw new Error("Not implemented - TDD implementation pending");
}
