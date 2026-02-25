/**
 * Batch Progress Tracker
 *
 * Tracks the progress of a batch task delegation and provides
 * VS Code progress bar integration via window.withProgress.
 *
 * @see specs/001-devin-integration/spec.md (User Story 2)
 */

import { ProgressLocation, window } from "vscode";
import type {
	BatchProcessor,
	BatchProgressEvent,
	BatchRequest,
	BatchResult,
} from "./batch-processor";

// ============================================================================
// Batch Progress Tracker
// ============================================================================

/**
 * Wraps BatchProcessor execution with a VS Code progress notification.
 *
 * Shows a progress bar that updates as each task is processed.
 */
export async function runBatchWithProgress(
	processor: BatchProcessor,
	request: BatchRequest
): Promise<BatchResult> {
	return await window.withProgress(
		{
			location: ProgressLocation.Notification,
			title: "Delegating tasks to Devin",
			cancellable: false,
		},
		async (progress) => {
			const total = request.tasks.length;

			const dispose = processor.onProgress((event: BatchProgressEvent) => {
				const percentage = ((event.index + 1) / total) * 100;
				progress.report({
					increment: 100 / total,
					message: `${event.taskId} (${event.index + 1}/${total}) - ${event.status}`,
				});
			});

			try {
				return await processor.processBatch(request);
			} finally {
				dispose();
			}
		}
	);
}
