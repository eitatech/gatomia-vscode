/**
 * Unit tests for CommandCompletionDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { OutputChannel, FileSystemWatcher } from "vscode";
import { CommandCompletionDetector } from "../../../../../src/features/hooks/services/command-completion-detector";
import type { TriggerRegistry } from "../../../../../src/features/hooks/trigger-registry";

const FILE_WATCHER_COUNT_REGEX = /\d+ file watchers/;

// Mock vscode workspace
vi.mock("vscode", () => {
	const mockWatcher: FileSystemWatcher = {
		onDidCreate: vi.fn(),
		onDidChange: vi.fn(),
		onDidDelete: vi.fn(),
		dispose: vi.fn(),
		ignoreCreateEvents: false,
		ignoreChangeEvents: false,
		ignoreDeleteEvents: false,
	};

	return {
		workspace: {
			createFileSystemWatcher: vi.fn(() => mockWatcher),
		},
		EventEmitter: class {
			fire = vi.fn();
			event = vi.fn();
			dispose = vi.fn();
		},
	};
});

describe("CommandCompletionDetector", () => {
	let detector: CommandCompletionDetector;
	let mockTriggerRegistry: TriggerRegistry;
	let mockOutputChannel: OutputChannel;

	beforeEach(() => {
		// Create mock TriggerRegistry
		mockTriggerRegistry = {
			fireTrigger: vi.fn(),
			fireTriggerWithContext: vi.fn(),
			onTrigger: vi.fn(),
			initialize: vi.fn(),
			dispose: vi.fn(),
			getLastTrigger: vi.fn(),
			getTriggerHistory: vi.fn(),
			clearTriggerHistory: vi.fn(),
		} as unknown as TriggerRegistry;

		// Create mock OutputChannel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as unknown as OutputChannel;

		// Create detector instance
		detector = new CommandCompletionDetector(
			mockTriggerRegistry,
			mockOutputChannel
		);
	});

	afterEach(() => {
		detector.dispose();
		vi.clearAllMocks();
	});

	describe("initialization", () => {
		it("should initialize without errors", () => {
			expect(() => detector.initialize()).not.toThrow();
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Initializing file watchers")
			);
		});

		it("should log number of watchers created", () => {
			detector.initialize();
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Initialized")
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringMatching(FILE_WATCHER_COUNT_REGEX)
			);
		});
	});

	describe("manual trigger", () => {
		it("should fire trigger for manual operation", () => {
			detector.manualTrigger("specify");

			expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
				"speckit",
				"specify",
				"after"
			);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Manual trigger: speckit.specify")
			);
		});

		it("should fire trigger for tasks operation", () => {
			detector.manualTrigger("tasks");

			expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
				"speckit",
				"tasks",
				"after"
			);
		});

		it("should fire trigger for all supported operations", () => {
			const operations = [
				"specify",
				"tasks",
				"plan",
				"design",
				"research",
				"datamodel",
				"checklist",
				"constitution",
				"analyze",
				"implementation",
				"unit-test",
				"integration-test",
				"taskstoissues",
			] as const;

			for (const operation of operations) {
				vi.clearAllMocks();
				detector.manualTrigger(operation);

				expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledWith(
					"speckit",
					operation,
					"after"
				);
			}
		});
	});

	describe("clear history", () => {
		it("should clear trigger history", () => {
			detector.manualTrigger("specify");
			detector.clearHistory();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Trigger history cleared")
			);
		});

		it("should allow re-triggering after clearing history", () => {
			detector.manualTrigger("specify");
			vi.clearAllMocks();

			detector.clearHistory();
			detector.manualTrigger("specify");

			expect(mockTriggerRegistry.fireTrigger).toHaveBeenCalledTimes(1);
		});
	});

	describe("dispose", () => {
		it("should dispose cleanly", () => {
			detector.initialize();
			expect(() => detector.dispose()).not.toThrow();
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Disposed")
			);
		});

		it("should dispose without initialization", () => {
			expect(() => detector.dispose()).not.toThrow();
		});
	});
});
