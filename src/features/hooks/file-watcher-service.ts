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

import type * as vscode from "vscode";
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
 * - Phase 2 (T008): Skeleton with stub methods ✅ CURRENT
 * - Phase 6 (T060): Implement startWatching() with VS Code FileSystemWatcher - TODO
 * - Phase 6 (T061): Implement debouncing logic (500ms) - TODO
 */
export class FileWatcherService implements IFileWatcherService {
	// Internal state
	private readonly changeListeners: Array<(event: FileChangeEvent) => void> =
		[];
	// biome-ignore lint/style/useReadonlyClassProperties: Will be reassigned in Phase 6 (T060)
	private watcher: vscode.FileSystemWatcher | undefined = undefined;
	// biome-ignore lint/style/useReadonlyClassProperties: Will be reassigned in Phase 6 (T061)
	private debounceTimer: NodeJS.Timeout | undefined = undefined;
	private readonly pendingChanges: Map<string, FileChangeEvent> = new Map();

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Start watching the agents directory
	 *
	 * TODO: Phase 6 (T060) - Implement file watching
	 * - Create VS Code FileSystemWatcher for *.agent.md files
	 * - Use glob pattern from agent-registry-constants (FILE_WATCH_GLOB_PATTERN)
	 * - Register event handlers for create/change/delete
	 * - Pass events through debouncing logic
	 * - Store watcher reference for disposal
	 *
	 * @param agentsDir Absolute path to agents directory
	 */
	startWatching(agentsDir: string): void {
		// TODO: Phase 6 (T060) - Implement watcher setup
		// Stub implementation: do nothing
	}

	/**
	 * Stop watching the agents directory
	 *
	 * TODO: Phase 6 (T060) - Implement cleanup
	 * - Dispose of FileSystemWatcher
	 * - Clear debounce timer
	 * - Clear pending changes
	 * - Reset internal state
	 */
	stopWatching(): void {
		// TODO: Phase 6 (T060) - Implement cleanup
		// Stub implementation: do nothing
	}

	/**
	 * Register callback for file change events
	 *
	 * TODO: Phase 6 (T061) - Implement event subscription
	 * - Add callback to internal listener list
	 * - Return disposable that removes callback
	 *
	 * @param callback Function to call when files change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeFiles(callback: (event: FileChangeEvent) => void): {
		dispose: () => void;
	} {
		// TODO: Phase 6 (T061) - Implement listener registration
		// Stub implementation: return no-op disposable
		return {
			dispose: () => {
				// TODO: Remove callback from changeListeners
			},
		};
	}

	// ============================================================================
	// Private Methods (Stubs for Future Implementation)
	// ============================================================================

	/**
	 * Handle file system change event with debouncing
	 *
	 * TODO: Phase 6 (T061) - Implement debouncing logic
	 * - Add change event to pendingChanges map
	 * - Clear existing debounce timer
	 * - Set new debounce timer (FILE_WATCH_DEBOUNCE_MS = 500ms)
	 * - After timeout, emit all pending changes
	 * - Clear pendingChanges map
	 *
	 * @param type Change type (created/modified/deleted)
	 * @param filePath Absolute path to changed file
	 */
	private handleFileChange(
		type: "created" | "modified" | "deleted",
		filePath: string
	): void {
		// TODO: Phase 6 (T061) - Implement debouncing
		// Stub implementation: do nothing
	}

	/**
	 * Flush pending changes and emit events to listeners
	 *
	 * TODO: Phase 6 (T061) - Implement event emission
	 * - Iterate over pendingChanges
	 * - For each change, extract agent ID from filename
	 * - Create FileChangeEvent with affected agent IDs
	 * - Emit event to all registered listeners
	 * - Clear pendingChanges map
	 */
	private flushPendingChanges(): void {
		// TODO: Phase 6 (T061) - Implement flush logic
		// Stub implementation: do nothing
	}

	/**
	 * Extract agent ID from file path
	 *
	 * TODO: Phase 6 (T061) - Implement agent ID extraction
	 * - Extract filename from path
	 * - Remove .agent.md extension
	 * - Return agent ID in format "local:{name}"
	 *
	 * @param filePath Absolute path to agent file
	 * @returns Agent ID (format: "local:agent-name")
	 */
	private extractAgentIdFromPath(filePath: string): string {
		// TODO: Phase 6 (T061) - Implement extraction
		// Stub implementation: return empty string
		return "";
	}

	// ============================================================================
	// Disposal
	// ============================================================================

	/**
	 * Dispose of all resources
	 *
	 * Called when extension is deactivated
	 * TODO: Phase 6 (T060) - Implement disposal
	 * - Call stopWatching()
	 * - Clear all listeners
	 */
	dispose(): void {
		// TODO: Phase 6 (T060) - Implement disposal
		this.stopWatching();
		this.changeListeners.length = 0;
	}
}

// ============================================================================
// Configuration Constants
// ============================================================================

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
