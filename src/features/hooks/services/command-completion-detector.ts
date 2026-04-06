/**
 * Command Completion Detector
 *
 * Monitors file system changes AND successful parsing to detect when SpecKit/OpenSpec
 * commands have completed. This solves the problem of triggering hooks AFTER command
 * completion rather than immediately after sending the command to Copilot Chat.
 *
 * Uses a hybrid approach:
 * 1. FileSystemWatcher detects when files are created/modified
 * 2. Validates that files are parseable before triggering
 * 3. Debounces to avoid duplicate triggers
 */

import {
	workspace,
	type OutputChannel,
	type FileSystemWatcher,
	type Uri,
} from "vscode";
import { parseTasksFromFile } from "../../../utils/task-parser";
import type { TriggerRegistry } from "../trigger-registry";
import type { OperationType } from "../types";

/**
 * File patterns that indicate specific SpecKit operation completions
 */
const OPERATION_FILE_PATTERNS: Record<string, string[]> = {
	// Specification created/updated
	specify: ["**/specs/*/spec.md"],

	// Tasks generated/updated
	tasks: ["**/specs/*/tasks.md"],

	// Plan generated/updated
	plan: ["**/specs/*/plan.md"],

	// Design generated/updated
	design: ["**/specs/*/design.md"],

	// Research completed
	research: ["**/specs/*/research.md"],

	// Data model defined
	datamodel: ["**/specs/*/data-model.md"],

	// Checklists created/updated
	checklist: ["**/specs/*/checklists/*.md"],

	// Constitution updated
	constitution: ["**/.specify/memory/constitution.md"],

	// Analysis completed
	analyze: ["**/specs/*/analysis.md"],

	// Implementation guidance
	implementation: ["**/specs/*/implementation.md"],

	// Unit tests
	"unit-test": ["**/specs/*/tests/unit/*.md"],

	// Integration tests
	"integration-test": ["**/specs/*/tests/integration/*.md"],

	// Tasks to issues (creates issue markers or updates task status)
	taskstoissues: ["**/specs/*/tasks.md", "**/specs/*/.github-issues.json"],
};

/**
 * Debounce delay in milliseconds to avoid triggering multiple times
 * for the same operation
 */
const DEBOUNCE_DELAY_MS = 2000;

/**
 * CommandCompletionDetector - Monitors file changes to detect command completion
 */
export class CommandCompletionDetector {
	private readonly triggerRegistry: TriggerRegistry;
	private readonly outputChannel: OutputChannel;
	private watchers: FileSystemWatcher[] = [];
	private readonly debounceTimers: Map<string, NodeJS.Timeout> = new Map();
	private readonly lastTriggered: Map<string, number> = new Map();

	constructor(triggerRegistry: TriggerRegistry, outputChannel: OutputChannel) {
		this.triggerRegistry = triggerRegistry;
		this.outputChannel = outputChannel;
	}

	/**
	 * Initialize file watchers for all operations
	 */
	initialize(): void {
		this.outputChannel.appendLine(
			"[CommandCompletionDetector] Initializing file watchers..."
		);

		// Create watchers for each operation
		for (const [operation, patterns] of Object.entries(
			OPERATION_FILE_PATTERNS
		)) {
			for (const pattern of patterns) {
				const watcher = workspace.createFileSystemWatcher(pattern);

				// Watch for both create and change events
				watcher.onDidCreate((uri) =>
					this.handleFileChange(uri, operation as OperationType)
				);
				watcher.onDidChange((uri) =>
					this.handleFileChange(uri, operation as OperationType)
				);

				this.watchers.push(watcher);
			}
		}

		this.outputChannel.appendLine(
			`[CommandCompletionDetector] Initialized ${this.watchers.length} file watchers`
		);
	}

	/**
	 * Handle file creation/modification
	 */
	private handleFileChange(uri: Uri, operation: OperationType): void {
		const key = `speckit.${operation}`;
		const now = Date.now();

		// Check if we recently triggered this operation (avoid duplicates)
		const lastTrigger = this.lastTriggered.get(key) || 0;
		if (now - lastTrigger < DEBOUNCE_DELAY_MS) {
			this.outputChannel.appendLine(
				`[CommandCompletionDetector] Ignoring duplicate trigger for ${key} (too soon)`
			);
			return;
		}

		// Clear existing debounce timer
		const existingTimer = this.debounceTimers.get(key);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Create new debounce timer
		const timer = setTimeout(async () => {
			// Validate that the file was successfully processed before triggering
			const isValid = await this.validateFileProcessing(uri, operation);

			if (!isValid) {
				this.outputChannel.appendLine(
					`[CommandCompletionDetector] Skipping trigger for ${key} - file not yet valid`
				);
				this.debounceTimers.delete(key);
				return;
			}

			this.outputChannel.appendLine(
				`[CommandCompletionDetector] Detected completion: ${key} (file: ${uri.fsPath})`
			);

			// Read file content for output capture
			let outputContent = "";
			try {
				const { promises: fs } = await import("node:fs");
				outputContent = await fs.readFile(uri.fsPath, "utf-8");
			} catch (error) {
				this.outputChannel.appendLine(
					`[CommandCompletionDetector] Warning: Failed to read output file: ${error}`
				);
			}

			// Fire the trigger with output data
			this.triggerRegistry.fireTrigger("speckit", operation, "after", {
				outputPath: uri.fsPath,
				outputContent,
			});

			// Record trigger time
			this.lastTriggered.set(key, Date.now());

			// Clean up timer
			this.debounceTimers.delete(key);
		}, DEBOUNCE_DELAY_MS);

		this.debounceTimers.set(key, timer);
	}

	/**
	 * Validate that a file has been successfully processed
	 *
	 * This ensures we only trigger hooks when:
	 * 1. The file exists and is readable
	 * 2. The content is valid and parseable
	 * 3. For tasks files, tasks are valid and processable
	 */
	private async validateFileProcessing(
		uri: Uri,
		operation: OperationType
	): Promise<boolean> {
		try {
			// Check if file exists and is readable
			const stat = await workspace.fs.stat(uri);
			if (stat.size === 0) {
				this.outputChannel.appendLine(
					`[CommandCompletionDetector] File is empty: ${uri.fsPath}`
				);
				return false;
			}

			// For tasks operation, validate that tasks are parseable
			if (operation === "tasks" || operation === "taskstoissues") {
				try {
					const tasks = await parseTasksFromFile(uri.fsPath);

					// Check if we have valid tasks
					if (!tasks || tasks.length === 0) {
						this.outputChannel.appendLine(
							`[CommandCompletionDetector] No valid tasks found in: ${uri.fsPath}`
						);
						return false;
					}

					this.outputChannel.appendLine(
						`[CommandCompletionDetector] Successfully parsed ${tasks.length} tasks from: ${uri.fsPath}`
					);
				} catch (parseError) {
					this.outputChannel.appendLine(
						`[CommandCompletionDetector] Failed to parse tasks: ${parseError}`
					);
					return false;
				}
			}

			// For other operations, just check the file exists and has content
			// In the future, we could add specific validators for each operation type
			this.outputChannel.appendLine(
				`[CommandCompletionDetector] File validated successfully: ${uri.fsPath}`
			);

			return true;
		} catch (error) {
			this.outputChannel.appendLine(
				`[CommandCompletionDetector] Error validating file: ${error}`
			);
			return false;
		}
	}

	/**
	 * Dispose of all watchers
	 */
	dispose(): void {
		// Clear all debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();

		// Dispose all watchers
		for (const watcher of this.watchers) {
			watcher.dispose();
		}
		this.watchers = [];

		this.outputChannel.appendLine("[CommandCompletionDetector] Disposed");
	}

	/**
	 * Manually trigger completion for an operation
	 * (useful for testing or manual triggers)
	 */
	manualTrigger(operation: OperationType): void {
		this.outputChannel.appendLine(
			`[CommandCompletionDetector] Manual trigger: speckit.${operation}`
		);
		// Manual triggers don't have output capture
		this.triggerRegistry.fireTrigger("speckit", operation, "after");
		this.lastTriggered.set(`speckit.${operation}`, Date.now());
	}

	/**
	 * Clear trigger history (useful for testing)
	 */
	clearHistory(): void {
		this.lastTriggered.clear();
		this.outputChannel.appendLine(
			"[CommandCompletionDetector] Trigger history cleared"
		);
	}
}
