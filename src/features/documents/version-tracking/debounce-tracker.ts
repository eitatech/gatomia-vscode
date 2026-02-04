import type { IDebounceTracker } from "../../../specs/012-spec-version-tracking/contracts/document-version-service.api";
import type { IVersionHistoryManager } from "./types";

/**
 * Debounce window duration in milliseconds (30 seconds).
 * Version increments within this window are blocked.
 */
const DEBOUNCE_WINDOW_MS = 30_000;

/**
 * Tracks last version increment timestamp per document for 30-second debounce.
 *
 * Prevents rapid version increments by enforcing a minimum 30-second window
 * between consecutive increments for the same document.
 *
 * Timestamps are persisted via VersionHistoryManager's workspace state.
 */
export class DebounceTracker implements IDebounceTracker {
	private readonly historyManager: IVersionHistoryManager;

	constructor(historyManager: IVersionHistoryManager) {
		this.historyManager = historyManager;
	}

	/**
	 * Check if sufficient time has passed since last version increment.
	 *
	 * @param documentPath Absolute path to document
	 * @returns true if ≥30s since last increment (or no previous increment)
	 */
	async shouldIncrement(documentPath: string): Promise<boolean> {
		const docState = await this.historyManager.getDocumentState(documentPath);

		// No previous state or no timestamp recorded → allow increment
		if (!docState || docState.lastIncrementTimestamp === undefined) {
			return true;
		}

		const now = Date.now();
		const elapsed = now - docState.lastIncrementTimestamp;

		// Allow increment if more than 30 seconds have passed
		return elapsed > DEBOUNCE_WINDOW_MS;
	}

	/**
	 * Record successful version increment timestamp.
	 * Called after version increment completes and file is written.
	 *
	 * @param documentPath Absolute path to document
	 */
	async recordIncrement(documentPath: string): Promise<void> {
		const now = Date.now();

		await this.historyManager.updateDocumentState(documentPath, {
			lastIncrementTimestamp: now,
		});
	}

	/**
	 * Clear debounce state for a document (used by reset command).
	 *
	 * @param documentPath Absolute path to document
	 */
	async clear(documentPath: string): Promise<void> {
		await this.historyManager.updateDocumentState(documentPath, {
			lastIncrementTimestamp: undefined,
		});
	}
}
