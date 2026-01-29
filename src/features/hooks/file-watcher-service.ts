/**
 * File Watcher Service
 *
 * Monitors the .github/agents/ directory for agent file changes (creation, modification, deletion)
 * and triggers registry refresh with debouncing to prevent excessive re-scanning.
 *
 * Features:
 * - Watch agent directory for file changes
 * - Debounce rapid changes (500ms)
 * - Emit file change events
 * - Support disposal for cleanup
 *
 * @see specs/011-custom-agent-hooks/contracts/agent-registry-api.ts:L178-L216
 * @see specs/011-custom-agent-hooks/data-model.md
 */

import {
	workspace,
	type FileSystemWatcher,
	type Uri,
	RelativePattern,
} from "vscode";
import { FILE_WATCH_DEBOUNCE_MS } from "./agent-registry-constants";

// ============================================================================
// Core Types
// ============================================================================

/**
 * FileChangeEvent - Event emitted when agent files change
 */
export interface FileChangeEvent {
	type: "created" | "modified" | "deleted";
	filePath: string; // Absolute path
	affectedAgentIds: string[]; // Agent IDs that need refresh
	timestamp: number; // Unix timestamp (milliseconds)
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * IFileWatcherService - Monitors .github/agents/ directory for changes
 */
export interface IFileWatcherService {
	/**
	 * Start watching the agents directory
	 * @param agentsDir Absolute path to agents directory
	 */
	startWatching(agentsDir: string): void;

	/**
	 * Stop watching the agents directory
	 */
	stopWatching(): void;

	/**
	 * Register callback for file change events
	 * @param callback Function to call when files change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeFiles(callback: (event: FileChangeEvent) => void): {
		dispose: () => void;
	};
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * FileWatcherService - Implements file watching for agent directory
 *
 * Responsibilities:
 * - Watch for agent file creation/modification/deletion
 * - Debounce rapid changes to prevent excessive re-scanning
 * - Emit events to trigger registry refresh
 *
 * Implementation phases:
 * - Phase 2 (T008): Skeleton with stub methods (CURRENT)
 * - Phase 6 (T060): Implement startWatching() with VS Code FileSystemWatcher - TODO
 * - Phase 6 (T061): Implement debouncing logic (500ms) - TODO
 */
export class FileWatcherService implements IFileWatcherService {
	// Internal state
	private readonly changeListeners: Array<(event: FileChangeEvent) => void> =
		[];
	private watcher: FileSystemWatcher | undefined = undefined;
	private debounceTimer: NodeJS.Timeout | undefined = undefined;
	private readonly pendingChanges: Map<string, FileChangeEvent> = new Map();
	private isWatching = false;

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Start watching the agents directory
	 *
	 * @param agentsDir Absolute path to agents directory
	 */
	startWatching(agentsDir: string): void {
		// Dispose existing watcher if present
		if (this.watcher) {
			this.watcher.dispose();
		}

		// Mark as watching
		this.isWatching = true;

		// Create RelativePattern for *.agent.md files in the agents directory
		const pattern = new RelativePattern(agentsDir, "**/*.agent.md");

		// Create file system watcher
		this.watcher = workspace.createFileSystemWatcher(pattern);

		// Register event handlers
		this.watcher.onDidCreate((uri: Uri) =>
			this.handleFileChange("created", uri.fsPath)
		);
		this.watcher.onDidChange((uri: Uri) =>
			this.handleFileChange("modified", uri.fsPath)
		);
		this.watcher.onDidDelete((uri: Uri) =>
			this.handleFileChange("deleted", uri.fsPath)
		);
	}

	/**
	 * Stop watching the agents directory
	 */
	stopWatching(): void {
		// Mark as not watching
		this.isWatching = false;

		// Dispose watcher
		if (this.watcher) {
			this.watcher.dispose();
			this.watcher = undefined;
		}

		// Clear debounce timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = undefined;
		}

		// Clear pending changes
		this.pendingChanges.clear();
	}

	/**
	 * Register callback for file change events
	 *
	 * @param callback Function to call when files change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeFiles(callback: (event: FileChangeEvent) => void): {
		dispose: () => void;
	} {
		// Add callback to listener list
		this.changeListeners.push(callback);

		// Return disposable that removes callback
		return {
			dispose: () => {
				const index = this.changeListeners.indexOf(callback);
				if (index >= 0) {
					this.changeListeners.splice(index, 1);
				}
			},
		};
	}

	// ============================================================================
	// Private Methods (Stubs for Future Implementation)
	// ============================================================================

	/**
	 * Handle file system change event with debouncing
	 *
	 * @param type Change type (created/modified/deleted)
	 * @param filePath Absolute path to changed file
	 */
	private handleFileChange(
		type: "created" | "modified" | "deleted",
		filePath: string
	): void {
		// Ignore if not watching
		if (!this.isWatching) {
			return;
		}

		// Extract agent ID from file path
		const agentId = this.extractAgentIdFromPath(filePath);

		// Add change event to pending changes (overwrites existing for same file)
		this.pendingChanges.set(filePath, {
			type,
			filePath,
			affectedAgentIds: [agentId],
			timestamp: Date.now(),
		});

		// Clear existing debounce timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		// Set new debounce timer
		this.debounceTimer = setTimeout(() => {
			this.flushPendingChanges();
		}, FILE_WATCH_DEBOUNCE_MS);
	}

	/**
	 * Flush pending changes and emit events to listeners
	 */
	private flushPendingChanges(): void {
		// Get all pending changes
		const changes = Array.from(this.pendingChanges.values());

		// Clear pending changes map
		this.pendingChanges.clear();

		// Clear debounce timer
		this.debounceTimer = undefined;

		// Emit each change to all listeners
		for (const change of changes) {
			for (const listener of this.changeListeners) {
				try {
					listener(change);
				} catch (error) {
					// Log error but don't interrupt other listeners
					console.error("File watcher listener error:", error);
				}
			}
		}
	}

	/**
	 * Extract agent ID from file path
	 *
	 * @param filePath Absolute path to agent file
	 * @returns Agent ID (format: "local:agent-name")
	 */
	private extractAgentIdFromPath(filePath: string): string {
		// Extract filename from path
		const filename =
			filePath.split("/").pop() || filePath.split("\\").pop() || "";

		// Remove .agent.md extension
		const agentName = filename.replace(AGENT_FILE_EXTENSION_PATTERN, "");

		// Return agent ID in format "local:{name}"
		return `local:${agentName}`;
	}

	// ============================================================================
	// Disposal
	// ============================================================================

	/**
	 * Dispose of all resources
	 *
	 * Called when extension is deactivated
	 */
	dispose(): void {
		this.stopWatching();
		this.changeListeners.length = 0;
	}
}

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Regex pattern to match .agent.md file extension
 */
const AGENT_FILE_EXTENSION_PATTERN = /\.agent\.md$/;

/**
 * Debounce delay for file change events (milliseconds)
 * @see agent-registry-constants.ts:FILE_WATCH_DEBOUNCE_MS
 */
export const DEBOUNCE_DELAY_MS = FILE_WATCH_DEBOUNCE_MS;

/**
 * Glob pattern for agent files
 * Matches: .github/agents/*.agent.md
 */
export const AGENT_FILE_GLOB_PATTERN = "**/.github/agents/*.agent.md";
