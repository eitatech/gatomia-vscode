/**
 * Extension Monitor Service
 *
 * Monitors VS Code extensions for install/uninstall events and triggers agent registry refresh.
 * This ensures that agents provided by extensions are automatically discovered without manual refresh.
 *
 * Features:
 * - Monitor VS Code extension changes
 * - Emit extension change events
 * - Support disposal for cleanup
 *
 * @see specs/011-custom-agent-hooks/tasks.md (Phase 6: T065-T067)
 */

import { extensions, type Disposable } from "vscode";

// ============================================================================
// Core Types
// ============================================================================

/**
 * ExtensionChangeEvent - Event emitted when extensions change
 */
export interface ExtensionChangeEvent {
	timestamp: number; // Unix timestamp (milliseconds)
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * IExtensionMonitorService - Monitors VS Code extensions for changes
 */
export interface IExtensionMonitorService {
	/**
	 * Start monitoring extension changes
	 */
	startMonitoring(): void;

	/**
	 * Stop monitoring extension changes
	 */
	stopMonitoring(): void;

	/**
	 * Register callback for extension change events
	 * @param callback Function to call when extensions change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeExtensions(callback: (event: ExtensionChangeEvent) => void): {
		dispose: () => void;
	};
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * ExtensionMonitorService - Implements extension monitoring
 *
 * Responsibilities:
 * - Monitor VS Code extensions for install/uninstall events
 * - Emit events to trigger agent registry refresh
 * - Handle graceful degradation if extensions API unavailable
 *
 * Implementation phases:
 * - Phase 6 (T065): Skeleton with lifecycle methods ✅ CURRENT
 * - Phase 6 (T066): Implement extension change listeners ✅ CURRENT
 */
export class ExtensionMonitorService implements IExtensionMonitorService {
	// Internal state
	private readonly changeListeners: Array<
		(event: ExtensionChangeEvent) => void
	> = [];
	private extensionWatcher: Disposable | undefined = undefined;
	private isMonitoring = false;

	// ============================================================================
	// Public API
	// ============================================================================

	/**
	 * Start monitoring extension changes
	 */
	startMonitoring(): void {
		// Dispose existing watcher if present
		if (this.extensionWatcher) {
			this.extensionWatcher.dispose();
		}

		// Mark as monitoring
		this.isMonitoring = true;

		// Register extension change listener
		try {
			this.extensionWatcher = extensions.onDidChange(() => {
				this.handleExtensionChange();
			});
		} catch (error) {
			// Graceful degradation if extensions API not available
			console.error("Failed to start extension monitoring:", error);
		}
	}

	/**
	 * Stop monitoring extension changes
	 */
	stopMonitoring(): void {
		// Mark as not monitoring
		this.isMonitoring = false;

		// Dispose watcher
		if (this.extensionWatcher) {
			this.extensionWatcher.dispose();
			this.extensionWatcher = undefined;
		}
	}

	/**
	 * Register callback for extension change events
	 *
	 * @param callback Function to call when extensions change
	 * @returns Disposable to unregister callback
	 */
	onDidChangeExtensions(callback: (event: ExtensionChangeEvent) => void): {
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
	// Private Methods
	// ============================================================================

	/**
	 * Handle extension change event
	 */
	private handleExtensionChange(): void {
		// Ignore if not monitoring
		if (!this.isMonitoring) {
			return;
		}

		// Create change event
		const event: ExtensionChangeEvent = {
			timestamp: Date.now(),
		};

		// Emit event to all listeners
		for (const listener of this.changeListeners) {
			try {
				listener(event);
			} catch (error) {
				// Log error but don't interrupt other listeners
				console.error("Extension monitor listener error:", error);
			}
		}
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
		this.stopMonitoring();
		this.changeListeners.length = 0;
	}
}
