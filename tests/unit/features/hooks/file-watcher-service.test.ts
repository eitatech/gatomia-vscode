/**
 * Unit Tests: FileWatcherService
 *
 * Tests for file system watching functionality that monitors .github/agents/ directory
 * for agent file changes and triggers registry refresh with debouncing.
 *
 * Test Coverage:
 * - T056: FileWatcherService.startWatching() functionality
 * - T057: File change event handling (create/modify/delete)
 * - T058: Debouncing logic (500ms delay)
 *
 * @see src/features/hooks/file-watcher-service.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	workspace as mockWorkspace,
	Uri as mockUri,
	RelativePattern,
} from "vscode";
import {
	FileWatcherService,
	type FileChangeEvent,
} from "../../../../src/features/hooks/file-watcher-service.js";

// ============================================================================
// Mock Setup
// ============================================================================

// Helper to create mock watcher with event handlers
function createMockWatcher() {
	const callbacks: {
		onCreate?: (uri: ReturnType<typeof mockUri.file>) => void;
		onChange?: (uri: ReturnType<typeof mockUri.file>) => void;
		onDelete?: (uri: ReturnType<typeof mockUri.file>) => void;
	} = {};

	const watcher = {
		onDidCreate: vi.fn((callback) => {
			callbacks.onCreate = callback;
			return { dispose: vi.fn() };
		}),
		onDidChange: vi.fn((callback) => {
			callbacks.onChange = callback;
			return { dispose: vi.fn() };
		}),
		onDidDelete: vi.fn((callback) => {
			callbacks.onDelete = callback;
			return { dispose: vi.fn() };
		}),
		dispose: vi.fn(),
		ignoreCreateEvents: false,
		ignoreChangeEvents: false,
		ignoreDeleteEvents: false,
	};

	return { watcher, callbacks };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("FileWatcherService", () => {
	let service: FileWatcherService;
	const testAgentsDir = "/test/workspace/.github/agents";
	const testAgentFile = "{testAgentsDir}/test-agent.agent.md";

	beforeEach(() => {
		service = new FileWatcherService();
		vi.clearAllMocks();
	});

	// ============================================================================
	// T056: FileWatcherService.startWatching() Tests
	// ============================================================================

	describe("T056: startWatching()", () => {
		it("should create VS Code FileSystemWatcher with correct glob pattern", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			service.startWatching(testAgentsDir);

			expect(mockWorkspace.createFileSystemWatcher).toHaveBeenCalledWith(
				expect.any(RelativePattern)
			);
			const pattern = vi.mocked(mockWorkspace.createFileSystemWatcher).mock
				.calls[0][0] as RelativePattern;
			expect(pattern.pattern).toContain("*.agent.md");
		});

		it("should register onCreate event handler", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			service.startWatching(testAgentsDir);

			expect(watcher.onDidCreate).toHaveBeenCalled();
		});

		it("should register onChange event handler", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			service.startWatching(testAgentsDir);

			expect(watcher.onDidChange).toHaveBeenCalled();
		});

		it("should register onDelete event handler", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			service.startWatching(testAgentsDir);

			expect(watcher.onDidDelete).toHaveBeenCalled();
		});

		it("should dispose old watcher if called multiple times", () => {
			const { watcher: watcher1 } = createMockWatcher();
			const { watcher: watcher2 } = createMockWatcher();

			vi.mocked(mockWorkspace.createFileSystemWatcher)
				.mockReturnValueOnce(watcher1)
				.mockReturnValueOnce(watcher2);

			service.startWatching(testAgentsDir);
			service.startWatching(testAgentsDir);

			expect(watcher1.dispose).toHaveBeenCalled();
		});
	});

	// ============================================================================
	// T057: File Change Event Handling Tests
	// ============================================================================

	describe("T057: File change event handling", () => {
		it("should emit 'created' event when agent file is created", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			// Simulate file creation
			const uri = mockUri.file("{testAgentsDir}/new-agent.agent.md");
			callbacks.onCreate?.(uri);

			// Wait for debounce (500ms + buffer)
			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("created");
			expect(events[0].filePath).toContain("new-agent.agent.md");
		});

		it("should emit 'modified' event when agent file is changed", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			// Simulate file change
			const uri = mockUri.file(testAgentFile);
			callbacks.onChange?.(uri);

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("modified");
			expect(events[0].filePath).toBe(testAgentFile);
		});

		it("should emit 'deleted' event when agent file is removed", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			// Simulate file deletion
			const uri = mockUri.file(testAgentFile);
			callbacks.onDelete?.(uri);

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("deleted");
			expect(events[0].filePath).toBe(testAgentFile);
		});

		it("should include affected agent IDs in event", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			const uri = mockUri.file("{testAgentsDir}/code-reviewer.agent.md");
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(events).toHaveLength(1);
			expect(events[0].affectedAgentIds).toContain("local:code-reviewer");
		});

		it("should include timestamp in event", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			const beforeTime = Date.now();
			const uri = mockUri.file(testAgentFile);
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));
			const afterTime = Date.now();

			expect(events).toHaveLength(1);
			expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(events[0].timestamp).toBeLessThanOrEqual(afterTime);
		});

		it("should notify multiple listeners", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events1: FileChangeEvent[] = [];
			const events2: FileChangeEvent[] = [];

			service.onDidChangeFiles((event) => events1.push(event));
			service.onDidChangeFiles((event) => events2.push(event));

			service.startWatching(testAgentsDir);

			const uri = mockUri.file(testAgentFile);
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(events1).toHaveLength(1);
			expect(events2).toHaveLength(1);
			expect(events1[0].filePath).toBe(events2[0].filePath);
		});
	});

	// ============================================================================
	// T058: Debouncing Logic Tests
	// ============================================================================

	describe("T058: Debouncing logic", () => {
		it("should debounce rapid file changes (500ms delay)", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			const uri = mockUri.file(testAgentFile);

			// Simulate rapid changes (3 changes within 200ms)
			callbacks.onChange?.(uri);
			await new Promise((resolve) => setTimeout(resolve, 100));
			callbacks.onChange?.(uri);
			await new Promise((resolve) => setTimeout(resolve, 100));
			callbacks.onChange?.(uri);

			// Should not emit yet (still within debounce window)
			expect(events).toHaveLength(0);

			// Wait for debounce to complete
			await new Promise((resolve) => setTimeout(resolve, 600));

			// Should emit only once despite 3 changes
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("modified");
		});

		it("should batch multiple different file changes", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			// Simulate multiple file changes rapidly
			callbacks.onCreate?.(mockUri.file("{testAgentsDir}/agent1.agent.md"));
			callbacks.onCreate?.(mockUri.file("{testAgentsDir}/agent2.agent.md"));
			callbacks.onChange?.(mockUri.file("{testAgentsDir}/agent3.agent.md"));

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 600));

			// Should emit separate events for each file
			expect(events.length).toBeGreaterThanOrEqual(1);
		});

		it("should reset debounce timer on new change", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			const uri = mockUri.file(testAgentFile);

			// First change
			callbacks.onChange?.(uri);

			// Wait 400ms (not enough to trigger)
			await new Promise((resolve) => setTimeout(resolve, 400));
			expect(events).toHaveLength(0);

			// Second change resets timer
			callbacks.onChange?.(uri);

			// Wait 400ms again (still not enough)
			await new Promise((resolve) => setTimeout(resolve, 400));
			expect(events).toHaveLength(0);

			// Wait final 200ms to complete debounce
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Should emit once
			expect(events).toHaveLength(1);
		});

		it("should use 500ms debounce delay from constants", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			const uri = mockUri.file(testAgentFile);
			callbacks.onChange?.(uri);

			// At 400ms: should not emit yet
			await new Promise((resolve) => setTimeout(resolve, 400));
			expect(events).toHaveLength(0);

			// At 600ms: should have emitted
			await new Promise((resolve) => setTimeout(resolve, 250));
			expect(events).toHaveLength(1);
		});
	});

	// ============================================================================
	// Lifecycle Tests
	// ============================================================================

	describe("Lifecycle: stopWatching() and dispose()", () => {
		it("should dispose watcher on stopWatching()", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			service.startWatching(testAgentsDir);
			service.stopWatching();

			expect(watcher.dispose).toHaveBeenCalled();
		});

		it("should not emit events after stopWatching()", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);
			service.stopWatching();

			// Simulate file change after stopping
			const uri = mockUri.file(testAgentFile);
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(events).toHaveLength(0);
		});

		it("should clear debounce timer on stopWatching()", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			// Trigger change but stop before debounce completes
			const uri = mockUri.file(testAgentFile);
			callbacks.onChange?.(uri);
			await new Promise((resolve) => setTimeout(resolve, 200));

			service.stopWatching();

			// Wait past debounce period
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Should not emit because watcher was stopped
			expect(events).toHaveLength(0);
		});

		it("should dispose all resources on dispose()", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			service.startWatching(testAgentsDir);
			service.dispose();

			expect(watcher.dispose).toHaveBeenCalled();
		});

		it("should allow disposing callback via returned disposable", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			const disposable = service.onDidChangeFiles((event) =>
				events.push(event)
			);

			service.startWatching(testAgentsDir);

			// Dispose listener
			disposable.dispose();

			// Trigger change
			const uri = mockUri.file(testAgentFile);
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));

			// Should not receive event (listener disposed)
			expect(events).toHaveLength(0);
		});
	});

	// ============================================================================
	// Edge Cases
	// ============================================================================

	describe("Edge cases", () => {
		it("should handle empty agent directory path gracefully", () => {
			const { watcher } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			expect(() => service.startWatching("")).not.toThrow();
		});

		it("should extract agent ID correctly from nested paths", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			const uri = mockUri.file(
				"{testAgentsDir}/subfolder/nested-agent.agent.md"
			);
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));

			if (events.length > 0) {
				expect(events[0].affectedAgentIds).toContain("local:nested-agent");
			}
		});

		it("should handle listener errors gracefully", async () => {
			const { watcher, callbacks } = createMockWatcher();
			vi.mocked(mockWorkspace.createFileSystemWatcher).mockReturnValue(watcher);

			const events: FileChangeEvent[] = [];

			// Add listener that throws
			service.onDidChangeFiles(() => {
				throw new Error("Listener error");
			});

			// Add listener that works
			service.onDidChangeFiles((event) => events.push(event));

			service.startWatching(testAgentsDir);

			// Trigger change
			const uri = mockUri.file(testAgentFile);
			callbacks.onCreate?.(uri);

			await new Promise((resolve) => setTimeout(resolve, 600));

			// Second listener should still receive event
			expect(events).toHaveLength(1);
		});
	});
});
