/**
 * API Contract: Document Version Service
 * 
 * This file defines the public API contract for the DocumentVersionService and its dependencies.
 * These interfaces and types serve as the contract between components and guide TDD implementation.
 * 
 * Feature: 012-spec-version-tracking
 * Date: 2026-01-29
 */

import { TextDocument, ExtensionContext } from 'vscode';

// ============================================================================
// Core Service API
// ============================================================================

/**
 * Main service orchestrating automatic version tracking for SpecKit documents.
 * 
 * Responsibilities:
 * - Process document save events
 * - Coordinate version increment workflow
 * - Manage version history persistence
 * - Handle error recovery and logging
 * 
 * Usage:
 * ```typescript
 * const service = new DocumentVersionService(context, dependencies);
 * workspace.onDidSaveTextDocument((doc) => service.processDocumentSave(doc));
 * ```
 */
export interface IDocumentVersionService {
  /**
   * Process a document save event and update version/owner if applicable.
   * 
   * Workflow:
   * 1. Check if document is SpecKit document (spec.md, plan.md, tasks.md)
   * 2. Check debounce (30s since last increment)
   * 3. Check if body content changed (exclude frontmatter formatting)
   * 4. Increment version + update owner
   * 5. Write back to file
   * 6. Update workspace state history
   * 7. Refresh Spec Explorer tree view
   * 
   * @param document The document that was saved
   * @returns Promise that resolves when processing is complete
   * @throws Error if infinite loop detected (>3 consecutive saves)
   */
  processDocumentSave(document: TextDocument): Promise<void>;
  
  /**
   * Initialize version tracking for a newly created document.
   * Called when document has no VERSION or OWNER fields in frontmatter.
   * 
   * @param documentPath Absolute path to the document
   * @returns Promise<DocumentMetadata> with version "1.0" and Git user as owner
   */
  initializeVersionTracking(documentPath: string): Promise<DocumentMetadata>;
  
  /**
   * Reset document version to "1.0" (used by reset command).
   * Creates version history entry with changeType = "reset".
   * 
   * @param documentPath Absolute path to the document
   * @returns Promise that resolves when reset is complete
   */
  resetDocumentVersion(documentPath: string): Promise<void>;
  
  /**
   * Get current version metadata for a document.
   * Returns cached value from workspace state if available.
   * 
   * @param documentPath Absolute path to the document
   * @returns Promise<DocumentMetadata | undefined> (undefined if never tracked)
   */
  getDocumentMetadata(documentPath: string): Promise<DocumentMetadata | undefined>;
  
  /**
   * Get version history for a document.
   * Returns up to 50 most recent entries (FIFO rotation).
   * 
   * @param documentPath Absolute path to the document
   * @returns Promise<VersionHistoryEntry[]> (empty if no history)
   */
  getVersionHistory(documentPath: string): Promise<VersionHistoryEntry[]>;
}

// ============================================================================
// Version Increment Logic
// ============================================================================

/**
 * Pure version increment logic (no I/O, easily testable).
 * 
 * Responsibilities:
 * - Implement {major}.{minor} increment rules
 * - Handle minor overflow (1.9 → 2.0)
 * - Normalize malformed versions
 * 
 * Usage:
 * ```typescript
 * const incrementer = new VersionIncrementer();
 * const next = incrementer.increment('1.9'); // "2.0"
 * ```
 */
export interface IVersionIncrementer {
  /**
   * Increment version according to {major}.{minor} rules.
   * 
   * Rules:
   * - 1.0 → 1.1 (increment minor)
   * - 1.9 → 2.0 (minor overflow, increment major)
   * - 2.5 → 2.6 (continue in major version 2)
   * 
   * @param currentVersion Version to increment
   * @returns Next version string
   * @throws Error if version is invalid and cannot be normalized
   */
  increment(currentVersion: string): string;
  
  /**
   * Validate version format: /^\d+\.\d$/ (e.g., "1.0", "2.5")
   * 
   * @param version Version string to validate
   * @returns true if valid, false otherwise
   */
  isValid(version: string): boolean;
  
  /**
   * Normalize malformed version to valid format.
   * 
   * Examples:
   * - "1.10" → "2.0" (overflow normalization)
   * - "v1.0" → "1.0" (remove prefix)
   * - "abc" → "1.0" (invalid → default)
   * 
   * @param version Potentially malformed version
   * @returns Normalized valid version
   */
  normalize(version: string): string;
}

// ============================================================================
// Frontmatter Processing
// ============================================================================

/**
 * YAML frontmatter extraction and manipulation using gray-matter.
 * 
 * Responsibilities:
 * - Parse YAML frontmatter from markdown files
 * - Extract version/owner fields
 * - Update frontmatter fields
 * - Write back to file (preserve formatting)
 * 
 * Usage:
 * ```typescript
 * const processor = new FrontmatterProcessor();
 * const metadata = await processor.extract('/path/to/spec.md');
 * await processor.update('/path/to/spec.md', { version: '1.1' });
 * ```
 */
export interface IFrontmatterProcessor {
  /**
   * Extract version and owner from document frontmatter.
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<DocumentMetadata>
   * @throws Error if file read fails or YAML parsing fails
   */
  extract(documentPath: string): Promise<DocumentMetadata>;
  
  /**
   * Update specific fields in document frontmatter.
   * Preserves original formatting and other fields.
   * 
   * @param documentPath Absolute path to document
   * @param updates Partial metadata to update (version and/or owner)
   * @returns Promise that resolves when write completes
   * @throws Error if file write fails or YAML generation fails
   */
  update(documentPath: string, updates: Partial<DocumentMetadata>): Promise<void>;
  
  /**
   * Check if document has valid frontmatter with required fields.
   * 
   * Required fields: title, status (from SpecKit templates)
   * Optional fields: version, owner (added by this feature)
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<boolean> true if valid frontmatter exists
   */
  hasValidFrontmatter(documentPath: string): Promise<boolean>;
  
  /**
   * Extract body content (after frontmatter) for change detection.
   * Used to determine if document body changed (vs. frontmatter-only changes).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<string> body content (normalized whitespace for comparison)
   */
  extractBodyContent(documentPath: string): Promise<string>;
}

// ============================================================================
// Version History Management
// ============================================================================

/**
 * Manages version history persistence in VS Code Workspace State.
 * 
 * Responsibilities:
 * - CRUD operations on version history
 * - FIFO rotation at 50 entries per document
 * - Schema versioning for future migrations
 * - Workspace state serialization/deserialization
 * 
 * Usage:
 * ```typescript
 * const manager = new VersionHistoryManager(context);
 * await manager.addEntry('/path/to/spec.md', historyEntry);
 * const history = await manager.getHistory('/path/to/spec.md');
 * ```
 */
export interface IVersionHistoryManager {
  /**
   * Get version history for a specific document.
   * Returns up to 50 most recent entries (FIFO rotation).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<VersionHistoryEntry[]> (empty array if no history)
   */
  getHistory(documentPath: string): Promise<VersionHistoryEntry[]>;
  
  /**
   * Add new version history entry for a document.
   * Automatically applies FIFO rotation if >50 entries.
   * 
   * @param documentPath Absolute path to document
   * @param entry Version history entry to add
   * @returns Promise that resolves when workspace state is updated
   */
  addEntry(documentPath: string, entry: VersionHistoryEntry): Promise<void>;
  
  /**
   * Get current document state (cached metadata + history).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<DocumentState | undefined> (undefined if never tracked)
   */
  getDocumentState(documentPath: string): Promise<DocumentState | undefined>;
  
  /**
   * Update cached document state (version, owner, lastIncrementTimestamp).
   * Used to keep workspace state synchronized with frontmatter.
   * 
   * @param documentPath Absolute path to document
   * @param state Partial document state to update
   * @returns Promise that resolves when workspace state is updated
   */
  updateDocumentState(documentPath: string, state: Partial<DocumentState>): Promise<void>;
  
  /**
   * Clear all version history for a document (used by reset command).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise that resolves when workspace state is updated
   */
  clearHistory(documentPath: string): Promise<void>;
  
  /**
   * Get entire workspace version state (for debugging/export).
   * 
   * @returns Promise<WorkspaceVersionState>
   */
  getWorkspaceState(): Promise<WorkspaceVersionState>;
}

// ============================================================================
// Debounce Tracking
// ============================================================================

/**
 * Tracks last version increment timestamp per document for 30-second debounce.
 * 
 * Responsibilities:
 * - Determine if version should increment (<30s since last increment)
 * - Per-document independent tracking
 * - Persist timestamps across extension reloads (via workspace state)
 * 
 * Usage:
 * ```typescript
 * const tracker = new DebounceTracker(historyManager);
 * if (await tracker.shouldIncrement('/path/to/spec.md')) {
 *   // Proceed with version increment
 * }
 * ```
 */
export interface IDebounceTracker {
  /**
   * Check if sufficient time has passed since last version increment.
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<boolean> true if ≥30s since last increment (or no previous increment)
   */
  shouldIncrement(documentPath: string): Promise<boolean>;
  
  /**
   * Record successful version increment timestamp.
   * Called after version increment completes and file is written.
   * 
   * @param documentPath Absolute path to document
   * @returns Promise that resolves when timestamp is recorded
   */
  recordIncrement(documentPath: string): Promise<void>;
  
  /**
   * Clear debounce state for a document (used by reset command).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise that resolves when state is cleared
   */
  clear(documentPath: string): Promise<void>;
}

// ============================================================================
// Git User Information
// ============================================================================

/**
 * Provides Git user.name and user.email for owner attribution.
 * 
 * Responsibilities:
 * - Execute Git CLI commands to read user config
 * - Fallback to system username if Git not configured
 * - Format owner string "[Name] <[email]>"
 * 
 * Usage:
 * ```typescript
 * const provider = new GitUserInfoProvider();
 * const info = provider.getUserInfo();
 * const owner = provider.formatOwner(info); // "Italo <email>"
 * ```
 */
export interface IGitUserInfoProvider {
  /**
   * Get Git user.name and user.email from Git config.
   * Falls back to system username if Git not configured.
   * 
   * @returns GitUserInfo object with name and email
   */
  getUserInfo(): GitUserInfo;
  
  /**
   * Format owner string in standard format "[Name] <[email]>".
   * 
   * @param info Git user info
   * @returns Formatted owner string
   */
  formatOwner(info: GitUserInfo): string;
  
  /**
   * Check if Git is available and configured.
   * 
   * @returns true if git config user.name and user.email are set
   */
  isGitConfigured(): boolean;
}

// ============================================================================
// File Change Detection
// ============================================================================

/**
 * Detects if document body content changed (excludes frontmatter formatting).
 * 
 * Responsibilities:
 * - Compare document body content (after frontmatter)
 * - Normalize whitespace for comparison (ignore formatting changes)
 * - Determine if version increment is warranted
 * 
 * Usage:
 * ```typescript
 * const detector = new FileChangeDetector(frontmatterProcessor);
 * if (await detector.hasBodyContentChanged('/path/to/spec.md')) {
 *   // Proceed with version increment
 * }
 * ```
 */
export interface IFileChangeDetector {
  /**
   * Check if document body content changed since last save.
   * Excludes frontmatter formatting changes (whitespace, field order).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise<boolean> true if body content changed
   */
  hasBodyContentChanged(documentPath: string): Promise<boolean>;
  
  /**
   * Store current body content as baseline for future comparison.
   * Called after successful version increment.
   * 
   * @param documentPath Absolute path to document
   * @returns Promise that resolves when baseline is stored
   */
  updateBaseline(documentPath: string): Promise<void>;
  
  /**
   * Clear baseline for a document (e.g., on document delete).
   * 
   * @param documentPath Absolute path to document
   * @returns Promise that resolves when baseline is cleared
   */
  clearBaseline(documentPath: string): Promise<void>;
}

// ============================================================================
// Data Types (from data-model.md)
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
  changeType: 'auto-increment' | 'manual-set' | 'initialization' | 'normalization' | 'reset';
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
  documents: {
    [documentPath: string]: DocumentState;
  };
}

/**
 * Git user configuration.
 */
export interface GitUserInfo {
  name: string;
  email: string;
}

// ============================================================================
// Service Factory
// ============================================================================

/**
 * Factory function to create DocumentVersionService with all dependencies.
 * Used in extension.ts activation.
 * 
 * @param context VS Code extension context
 * @returns Configured IDocumentVersionService instance
 */
export function createDocumentVersionService(context: ExtensionContext): IDocumentVersionService {
  // Implementation in src/features/documents/version-tracking/document-version-service.ts
  throw new Error('Not implemented - stub for contract definition');
}
