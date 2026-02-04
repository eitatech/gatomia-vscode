import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { IVersionHistoryManager } from "../../../../../src/features/documents/version-tracking/types";
import type { DocumentState } from "../../../../../specs/012-spec-version-tracking/contracts/document-version-service.api";

// We'll import the class after implementing it
let DebounceTracker: any;

describe("DebounceTracker", () => {
	let mockHistoryManager: IVersionHistoryManager;
	let tracker: any;
	const testDocPath = "/workspace/specs/feature-001/spec.md";
	const DEBOUNCE_WINDOW_MS = 30_000; // 30 seconds

	beforeEach(async () => {
		// Dynamic import after implementation
		try {
			const module = await import(
				"../../../../../src/features/documents/version-tracking/debounce-tracker"
			);
			DebounceTracker = module.DebounceTracker;
		} catch {
			// Implementation doesn't exist yet (RED phase)
		}

		// Mock VersionHistoryManager
		mockHistoryManager = {
			getHistory: vi.fn(),
			addEntry: vi.fn(),
			getDocumentState: vi.fn(),
			updateDocumentState: vi.fn(),
			clearHistory: vi.fn(),
			getWorkspaceState: vi.fn(),
		};

		if (DebounceTracker) {
			tracker = new DebounceTracker(mockHistoryManager);
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("shouldIncrement", () => {
		test("should return true when no previous increment exists", async () => {
			// Document has no state (never incremented before)
			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(undefined);

			const result = await tracker.shouldIncrement(testDocPath);

			expect(result).toBe(true);
			expect(mockHistoryManager.getDocumentState).toHaveBeenCalledWith(
				testDocPath
			);
		});

		test("should return true when lastIncrementTimestamp is undefined", async () => {
			// Document state exists but no timestamp recorded
			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.0",
				history: [],
				// lastIncrementTimestamp is undefined
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			expect(result).toBe(true);
		});

		test("should return true when more than 30 seconds have passed", async () => {
			const now = Date.now();
			const lastIncrement = now - 35_000; // 35 seconds ago

			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.1",
				history: [],
				lastIncrementTimestamp: lastIncrement,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			expect(result).toBe(true);
		});

		test("should return false when less than 30 seconds have passed", async () => {
			const now = Date.now();
			const lastIncrement = now - 10_000; // 10 seconds ago

			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.1",
				history: [],
				lastIncrementTimestamp: lastIncrement,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			expect(result).toBe(false);
		});

		test("should return false when exactly 30 seconds have passed", async () => {
			const now = Date.now();
			const lastIncrement = now - DEBOUNCE_WINDOW_MS; // Exactly 30s

			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.1",
				history: [],
				lastIncrementTimestamp: lastIncrement,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			// At exactly 30s, we haven't exceeded the window yet
			expect(result).toBe(false);
		});

		test("should return true when exactly 30.001 seconds have passed", async () => {
			const now = Date.now();
			const lastIncrement = now - DEBOUNCE_WINDOW_MS - 1; // 30.001s

			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.1",
				history: [],
				lastIncrementTimestamp: lastIncrement,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			expect(result).toBe(true);
		});

		test("should handle different documents independently", async () => {
			const doc1 = "/workspace/spec1.md";
			const doc2 = "/workspace/spec2.md";
			const now = Date.now();

			// Doc1: recent increment (10s ago) - should block
			const doc1State: DocumentState = {
				documentPath: doc1,
				currentVersion: "1.0",
				history: [],
				lastIncrementTimestamp: now - 10_000,
			};

			// Doc2: old increment (60s ago) - should allow
			const doc2State: DocumentState = {
				documentPath: doc2,
				currentVersion: "2.0",
				history: [],
				lastIncrementTimestamp: now - 60_000,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockImplementation(
				(path) => {
					if (path === doc1) {
						return doc1State;
					}
					if (path === doc2) {
						return doc2State;
					}
					return;
				}
			);

			const result1 = await tracker.shouldIncrement(doc1);
			const result2 = await tracker.shouldIncrement(doc2);

			expect(result1).toBe(false); // Doc1 blocked
			expect(result2).toBe(true); // Doc2 allowed
		});
	});

	describe("recordIncrement", () => {
		test("should record current timestamp in document state", async () => {
			const now = Date.now();
			vi.setSystemTime(now);

			await tracker.recordIncrement(testDocPath);

			expect(mockHistoryManager.updateDocumentState).toHaveBeenCalledWith(
				testDocPath,
				{
					lastIncrementTimestamp: now,
				}
			);
		});

		test("should update timestamp for previously tracked document", async () => {
			const oldTimestamp = Date.now() - 60_000; // 1 minute ago
			const newTimestamp = Date.now();

			const existingState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.5",
				history: [],
				lastIncrementTimestamp: oldTimestamp,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(
				existingState
			);
			vi.setSystemTime(newTimestamp);

			await tracker.recordIncrement(testDocPath);

			expect(mockHistoryManager.updateDocumentState).toHaveBeenCalledWith(
				testDocPath,
				{
					lastIncrementTimestamp: newTimestamp,
				}
			);
		});

		test("should handle recording for multiple documents", async () => {
			const doc1 = "/workspace/spec1.md";
			const doc2 = "/workspace/spec2.md";
			const timestamp1 = Date.now();
			const timestamp2 = timestamp1 + 5000; // 5 seconds later

			vi.setSystemTime(timestamp1);
			await tracker.recordIncrement(doc1);

			vi.setSystemTime(timestamp2);
			await tracker.recordIncrement(doc2);

			expect(mockHistoryManager.updateDocumentState).toHaveBeenNthCalledWith(
				1,
				doc1,
				{ lastIncrementTimestamp: timestamp1 }
			);
			expect(mockHistoryManager.updateDocumentState).toHaveBeenNthCalledWith(
				2,
				doc2,
				{ lastIncrementTimestamp: timestamp2 }
			);
		});
	});

	describe("clear", () => {
		test("should clear lastIncrementTimestamp from document state", async () => {
			await tracker.clear(testDocPath);

			expect(mockHistoryManager.updateDocumentState).toHaveBeenCalledWith(
				testDocPath,
				{
					lastIncrementTimestamp: undefined,
				}
			);
		});

		test("should work even if document has no previous timestamp", async () => {
			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(undefined);

			// Should not throw
			await expect(tracker.clear(testDocPath)).resolves.toBeUndefined();

			expect(mockHistoryManager.updateDocumentState).toHaveBeenCalledWith(
				testDocPath,
				{
					lastIncrementTimestamp: undefined,
				}
			);
		});

		test("should clear timestamps for specific document only", async () => {
			const doc1 = "/workspace/spec1.md";
			const doc2 = "/workspace/spec2.md";

			await tracker.clear(doc1);

			// Only doc1 should be cleared
			expect(mockHistoryManager.updateDocumentState).toHaveBeenCalledTimes(1);
			expect(mockHistoryManager.updateDocumentState).toHaveBeenCalledWith(
				doc1,
				{
					lastIncrementTimestamp: undefined,
				}
			);
		});
	});

	describe("edge cases", () => {
		test("should handle future timestamps gracefully", async () => {
			const now = Date.now();
			const futureTimestamp = now + 60_000; // 1 minute in future

			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.0",
				history: [],
				lastIncrementTimestamp: futureTimestamp,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			// Future timestamp means we're still "in the window" (negative elapsed time)
			expect(result).toBe(false);
		});

		test("should handle very old timestamps (timestamp = 0)", async () => {
			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.0",
				history: [],
				lastIncrementTimestamp: 0, // Epoch time
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			// 0 is over 30 seconds ago from any modern timestamp
			expect(result).toBe(true);
		});

		test("should handle negative timestamps", async () => {
			const docState: DocumentState = {
				documentPath: testDocPath,
				currentVersion: "1.0",
				history: [],
				lastIncrementTimestamp: -1000,
			};

			vi.mocked(mockHistoryManager.getDocumentState).mockReturnValue(docState);

			const result = await tracker.shouldIncrement(testDocPath);

			// Negative is definitely > 30s ago
			expect(result).toBe(true);
		});
	});
});
