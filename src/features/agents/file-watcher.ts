/**
 * FileWatcher
 * Watches for file system changes in resources directory with debouncing
 * Triggers callbacks after 500ms of inactivity to batch changes
 */

import type { FileSystemWatcher, Disposable, OutputChannel } from "vscode";

type ChangeHandler = (changedFiles: string[]) => void;

/**
 * Watches file system for changes with debouncing
 * Batches multiple rapid changes into single callback invocation
 */
export class FileWatcher implements Disposable {
	private readonly watcher: FileSystemWatcher;
	private readonly changeHandler: ChangeHandler;
	private readonly outputChannel: OutputChannel;
	private readonly pendingChanges: Set<string> = new Set();
	private debounceTimer: NodeJS.Timeout | null = null;
	private readonly debounceDelayMs = 500;

	constructor(
		outputChannel: OutputChannel,
		watcher: FileSystemWatcher,
		changeHandler: ChangeHandler
	) {
		this.outputChannel = outputChannel;
		this.watcher = watcher;
		this.changeHandler = changeHandler;

		// Register event handlers
		this.watcher.onDidChange(this.onFileChange.bind(this));
		this.watcher.onDidCreate(this.onFileChange.bind(this));
		this.watcher.onDidDelete(this.onFileChange.bind(this));

		this.outputChannel.appendLine("[FileWatcher] Initialized");
	}

	/**
	 * Handle file change event
	 * Adds to pending changes and starts/resets debounce timer
	 */
	private onFileChange(uri: { fsPath: string }): void {
		this.pendingChanges.add(uri.fsPath);
		this.outputChannel.appendLine(
			`[FileWatcher] Detected change: ${uri.fsPath} (pending: ${this.pendingChanges.size})`
		);

		// Clear existing timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		// Start new debounce timer
		this.debounceTimer = setTimeout(() => {
			this.flushPendingChanges();
		}, this.debounceDelayMs);
	}

	/**
	 * Flush pending changes and invoke callback
	 */
	private flushPendingChanges(): void {
		if (this.pendingChanges.size === 0) {
			return;
		}

		const changedFiles = Array.from(this.pendingChanges);
		this.pendingChanges.clear();
		this.debounceTimer = null;

		this.outputChannel.appendLine(
			`[FileWatcher] Flushing ${changedFiles.length} pending change(s)`
		);

		try {
			this.changeHandler(changedFiles);
		} catch (error) {
			this.outputChannel.appendLine(
				`[FileWatcher] Error in change handler: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Cleanup watcher and pending timers
	 */
	dispose(): void {
		// Clear pending timer
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Clear pending changes without invoking callback
		this.pendingChanges.clear();

		// Dispose watcher
		this.watcher.dispose();

		this.outputChannel.appendLine("[FileWatcher] Disposed");
	}
}
