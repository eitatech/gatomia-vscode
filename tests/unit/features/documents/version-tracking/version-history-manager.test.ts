import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { VersionHistoryManager } from "../../../../../src/features/documents/version-tracking/version-history-manager";
import type {
	VersionHistoryEntry,
	WorkspaceVersionState,
} from "../../../../../src/types";

// Mock VS Code API
const mockWorkspaceState = {
	get: vi.fn(),
	update: vi.fn(),
	keys: vi.fn(() => []),
};

const mockContext = {
	workspaceState: mockWorkspaceState,
	subscriptions: [],
	extensionPath: "/mock/path",
	extensionUri: { fsPath: "/mock/path" } as any,
	globalState: {} as any,
	secrets: {} as any,
	storageUri: undefined,
	storagePath: undefined,
	globalStorageUri: { fsPath: "/mock/global" } as any,
	globalStoragePath: "/mock/global",
	logUri: { fsPath: "/mock/log" } as any,
	logPath: "/mock/log",
	extensionMode: 3 as any,
	extension: {} as any,
	environmentVariableCollection: {} as any,
	asAbsolutePath: (path: string) => `/mock/${path}`,
};

describe("VersionHistoryManager", () => {
	let manager: VersionHistoryManager;

	beforeEach(() => {
		manager = new VersionHistoryManager(mockContext as any);
		mockWorkspaceState.get.mockClear();
		mockWorkspaceState.update.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getHistory()", () => {
		it("should return empty array for document with no history", async () => {
			mockWorkspaceState.get.mockReturnValue(undefined);

			const history = await manager.getHistory("/path/to/untracked-spec.md");

			expect(history).toEqual([]);
		});

		it("should return history entries for tracked document", async () => {
			const mockState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Author <author@example.com>",
						createdBy: "Creator <creator@example.com>",
						history: [
							{
								documentPath: "/path/to/spec.md",
								previousVersion: "1.4",
								newVersion: "1.5",
								timestamp: "2024-01-15T10:00:00Z",
								author: "Author <author@example.com>",
								changeType: "auto-increment",
							},
						],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(mockState);

			const history = await manager.getHistory("/path/to/spec.md");

			expect(history).toHaveLength(1);
			expect(history[0].newVersion).toBe("1.5");
			expect(history[0].changeType).toBe("auto-increment");
		});

		it("should return up to 50 most recent entries", async () => {
			const mockHistory: VersionHistoryEntry[] = Array.from(
				{ length: 60 },
				(_, i) => ({
					documentPath: "/path/to/spec.md",
					previousVersion: `1.${i}`,
					newVersion: `1.${i + 1}`,
					timestamp: new Date(2024, 0, i + 1).toISOString(),
					author: "Author",
					changeType: "auto-increment" as const,
				})
			);

			const mockState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.60",
						owner: "Author",
						createdBy: "Creator",
						history: mockHistory,
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(mockState);

			const history = await manager.getHistory("/path/to/spec.md");

			// Should only return 50 most recent (FIFO already applied)
			expect(history.length).toBeLessThanOrEqual(50);
		});
	});

	describe("addEntry()", () => {
		it("should add first entry to empty history", async () => {
			mockWorkspaceState.get.mockReturnValue(undefined);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			const entry: VersionHistoryEntry = {
				documentPath: "/path/to/spec.md",
				previousVersion: "1.0",
				newVersion: "1.1",
				timestamp: "2024-01-15T10:00:00Z",
				author: "Author <author@example.com>",
				changeType: "auto-increment",
			};

			await manager.addEntry("/path/to/spec.md", entry);

			expect(mockWorkspaceState.update).toHaveBeenCalledOnce();
			const [key, state] = mockWorkspaceState.update.mock.calls[0];

			expect(key).toBe("gatomia.versionTracking.state");
			expect(state.schemaVersion).toBe("1.0");
			expect(state.documents["/path/to/spec.md"].history).toHaveLength(1);
			expect(state.documents["/path/to/spec.md"].history[0].newVersion).toBe(
				"1.1"
			);
		});

		it("should append entry to existing history", async () => {
			const existingState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Author",
						createdBy: "Creator",
						history: [
							{
								documentPath: "/path/to/spec.md",
								previousVersion: "1.4",
								newVersion: "1.5",
								timestamp: "2024-01-15T10:00:00Z",
								author: "Author",
								changeType: "auto-increment",
							},
						],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(existingState);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			const newEntry: VersionHistoryEntry = {
				documentPath: "/path/to/spec.md",
				previousVersion: "1.5",
				newVersion: "1.6",
				timestamp: "2024-01-15T11:00:00Z",
				author: "Author",
				changeType: "auto-increment",
			};

			await manager.addEntry("/path/to/spec.md", newEntry);

			const [, state] = mockWorkspaceState.update.mock.calls[0];
			expect(state.documents["/path/to/spec.md"].history).toHaveLength(2);
			expect(state.documents["/path/to/spec.md"].history[1].newVersion).toBe(
				"1.6"
			);
		});

		it("should apply FIFO rotation when history exceeds 50 entries", async () => {
			const oldHistory: VersionHistoryEntry[] = Array.from(
				{ length: 50 },
				(_, i) => ({
					documentPath: "/path/to/spec.md",
					previousVersion: `1.${i}`,
					newVersion: `1.${i + 1}`,
					timestamp: new Date(2024, 0, i + 1).toISOString(),
					author: "Author",
					changeType: "auto-increment" as const,
				})
			);

			const existingState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.50",
						owner: "Author",
						createdBy: "Creator",
						history: oldHistory,
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(existingState);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			const newEntry: VersionHistoryEntry = {
				documentPath: "/path/to/spec.md",
				previousVersion: "1.50",
				newVersion: "1.51",
				timestamp: "2024-01-15T10:00:00Z",
				author: "Author",
				changeType: "auto-increment",
			};

			await manager.addEntry("/path/to/spec.md", newEntry);

			const [, state] = mockWorkspaceState.update.mock.calls[0];
			const history = state.documents["/path/to/spec.md"].history;

			// Should have exactly 50 entries after FIFO rotation
			expect(history).toHaveLength(50);

			// Oldest entry should be removed (1.0→1.1)
			expect(history[0].newVersion).not.toBe("1.1");
			expect(history[0].newVersion).toBe("1.2");

			// Newest entry should be added
			expect(history[49].newVersion).toBe("1.51");
		});

		it("should preserve other documents' history when adding entry", async () => {
			const existingState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/other-spec.md": {
						currentVersion: "2.3",
						owner: "Other Author",
						createdBy: "Other Creator",
						history: [
							{
								documentPath: "/path/to/other-spec.md",
								previousVersion: "2.2",
								newVersion: "2.3",
								timestamp: "2024-01-10T10:00:00Z",
								author: "Other Author",
								changeType: "auto-increment",
							},
						],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(existingState);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			const newEntry: VersionHistoryEntry = {
				documentPath: "/path/to/spec.md",
				previousVersion: "1.0",
				newVersion: "1.1",
				timestamp: "2024-01-15T10:00:00Z",
				author: "Author",
				changeType: "auto-increment",
			};

			await manager.addEntry("/path/to/spec.md", newEntry);

			const [, state] = mockWorkspaceState.update.mock.calls[0];

			// Other document should remain unchanged
			expect(state.documents["/path/to/other-spec.md"].history).toHaveLength(1);
			expect(state.documents["/path/to/other-spec.md"].currentVersion).toBe(
				"2.3"
			);

			// New document should be added
			expect(state.documents["/path/to/spec.md"].history).toHaveLength(1);
		});
	});

	describe("getDocumentState()", () => {
		it("should return undefined for untracked document", async () => {
			mockWorkspaceState.get.mockReturnValue(undefined);

			const state = await manager.getDocumentState("/path/to/untracked.md");

			expect(state).toBeUndefined();
		});

		it("should return document state for tracked document", async () => {
			const mockState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Author <author@example.com>",
						createdBy: "Creator <creator@example.com>",
						lastIncrementTimestamp: 1_705_315_200_000,
						history: [],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(mockState);

			const state = await manager.getDocumentState("/path/to/spec.md");

			expect(state).toBeDefined();
			expect(state?.currentVersion).toBe("1.5");
			expect(state?.owner).toBe("Author <author@example.com>");
			expect(state?.lastIncrementTimestamp).toBe(1_705_315_200_000);
		});
	});

	describe("updateDocumentState()", () => {
		it("should create document state if not exists", async () => {
			mockWorkspaceState.get.mockReturnValue(undefined);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			await manager.updateDocumentState("/path/to/spec.md", {
				currentVersion: "1.2",
				owner: "Author <author@example.com>",
			});

			const [, state] = mockWorkspaceState.update.mock.calls[0];

			expect(state.documents["/path/to/spec.md"]).toBeDefined();
			expect(state.documents["/path/to/spec.md"].currentVersion).toBe("1.2");
			expect(state.documents["/path/to/spec.md"].owner).toBe(
				"Author <author@example.com>"
			);
		});

		it("should update existing document state fields", async () => {
			const existingState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Old Author",
						createdBy: "Creator",
						history: [],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(existingState);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			await manager.updateDocumentState("/path/to/spec.md", {
				currentVersion: "1.6",
				lastIncrementTimestamp: Date.now(),
			});

			const [, state] = mockWorkspaceState.update.mock.calls[0];

			expect(state.documents["/path/to/spec.md"].currentVersion).toBe("1.6");
			expect(
				state.documents["/path/to/spec.md"].lastIncrementTimestamp
			).toBeDefined();
			// Owner should be preserved
			expect(state.documents["/path/to/spec.md"].owner).toBe("Old Author");
		});

		it("should preserve history when updating state", async () => {
			const existingState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Author",
						createdBy: "Creator",
						history: [
							{
								documentPath: "/path/to/spec.md",
								previousVersion: "1.4",
								newVersion: "1.5",
								timestamp: "2024-01-15T10:00:00Z",
								author: "Author",
								changeType: "auto-increment",
							},
						],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(existingState);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			await manager.updateDocumentState("/path/to/spec.md", {
				currentVersion: "1.6",
			});

			const [, state] = mockWorkspaceState.update.mock.calls[0];

			expect(state.documents["/path/to/spec.md"].history).toHaveLength(1);
		});
	});

	describe("clearHistory()", () => {
		it("should clear history for specific document", async () => {
			const existingState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Author",
						createdBy: "Creator",
						lastIncrementTimestamp: 1_705_315_200_000,
						history: [
							{
								documentPath: "/path/to/spec.md",
								previousVersion: "1.4",
								newVersion: "1.5",
								timestamp: "2024-01-15T10:00:00Z",
								author: "Author",
								changeType: "auto-increment",
							},
						],
					},
					"/path/to/other-spec.md": {
						currentVersion: "2.3",
						owner: "Other",
						createdBy: "Other",
						history: [],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(existingState);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			await manager.clearHistory("/path/to/spec.md");

			const [, state] = mockWorkspaceState.update.mock.calls[0];

			// Target document should have empty history and cleared timestamp
			expect(state.documents["/path/to/spec.md"].history).toEqual([]);
			expect(
				state.documents["/path/to/spec.md"].lastIncrementTimestamp
			).toBeUndefined();

			// Other document should be unchanged
			expect(state.documents["/path/to/other-spec.md"]).toBeDefined();
		});

		it("should do nothing if document not tracked", async () => {
			mockWorkspaceState.get.mockReturnValue(undefined);
			mockWorkspaceState.update.mockResolvedValue(undefined);

			await manager.clearHistory("/path/to/untracked.md");

			// Should not attempt to update if no state exists
			expect(mockWorkspaceState.update).not.toHaveBeenCalled();
		});
	});

	describe("getWorkspaceState()", () => {
		it("should return empty workspace state if no documents tracked", async () => {
			mockWorkspaceState.get.mockReturnValue(undefined);

			const state = await manager.getWorkspaceState();

			expect(state.schemaVersion).toBe("1.0");
			expect(state.documents).toEqual({});
		});

		it("should return full workspace state", async () => {
			const mockState: WorkspaceVersionState = {
				schemaVersion: "1.0",
				documents: {
					"/path/to/spec.md": {
						currentVersion: "1.5",
						owner: "Author",
						createdBy: "Creator",
						history: [],
					},
					"/path/to/other-spec.md": {
						currentVersion: "2.3",
						owner: "Other",
						createdBy: "Other",
						history: [],
					},
				},
			};

			mockWorkspaceState.get.mockReturnValue(mockState);

			const state = await manager.getWorkspaceState();

			expect(Object.keys(state.documents)).toHaveLength(2);
			expect(state.documents["/path/to/spec.md"].currentVersion).toBe("1.5");
			expect(state.documents["/path/to/other-spec.md"].currentVersion).toBe(
				"2.3"
			);
		});
	});
});
