import { describe, it, expect, beforeEach, vi } from "vitest";
import type { OutputChannel } from "vscode";
import { TriggerRegistry } from "../../../../src/features/hooks/TriggerRegistry";
import type { TriggerEvent } from "../../../../src/features/hooks/types";

// Mock OutputChannel
const createMockOutputChannel = (): OutputChannel => ({
	name: "Test Output",
	append: vi.fn(),
	appendLine: vi.fn(),
	replace: vi.fn(),
	clear: vi.fn(),
	show: vi.fn(),
	hide: vi.fn(),
	dispose: vi.fn(),
});

describe("TriggerRegistry", () => {
	let registry: TriggerRegistry;
	let mockOutputChannel: OutputChannel;

	beforeEach(() => {
		mockOutputChannel = createMockOutputChannel();
		registry = new TriggerRegistry(mockOutputChannel);
		registry.initialize();
	});

	describe("initialization", () => {
		it("should initialize successfully", () => {
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[TriggerRegistry] Initialized"
			);
		});

		it("should throw error if initialized after disposal", () => {
			registry.dispose();
			expect(() => registry.initialize()).toThrow(
				"TriggerRegistry has been disposed"
			);
		});
	});

	describe("fireTrigger", () => {
		it("should fire a trigger event", () => {
			const listener = vi.fn();
			registry.onTrigger(listener);

			registry.fireTrigger("speckit", "specify");

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith(
				expect.objectContaining({
					agent: "speckit",
					operation: "specify",
					timestamp: expect.any(Number),
				})
			);
		});

		it("should log trigger event", () => {
			registry.fireTrigger("speckit", "clarify");

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Trigger fired: speckit.clarify")
			);
		});

		it("should store event in history", () => {
			registry.fireTrigger("speckit", "plan");

			const history = registry.getTriggerHistory();
			expect(history).toHaveLength(1);
			expect(history[0]).toMatchObject({
				agent: "speckit",
				operation: "plan",
			});
		});

		it("should not fire trigger if disposed", () => {
			const listener = vi.fn();
			registry.onTrigger(listener);

			registry.dispose();
			registry.fireTrigger("speckit", "specify");

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("fireTriggerWithContext", () => {
		it("should fire trigger with metadata", () => {
			const listener = vi.fn();
			registry.onTrigger(listener);

			const event: TriggerEvent = {
				agent: "speckit",
				operation: "specify",
				timestamp: Date.now(),
				metadata: {
					featureName: "test-feature",
				},
			};

			registry.fireTriggerWithContext(event);

			expect(listener).toHaveBeenCalledWith(event);
		});

		it("should reject invalid trigger events", () => {
			const listener = vi.fn();
			registry.onTrigger(listener);

			// Invalid agent
			registry.fireTriggerWithContext({
				agent: "invalid",
				operation: "specify",
				timestamp: Date.now(),
			});

			expect(listener).not.toHaveBeenCalled();
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Invalid trigger event")
			);
		});

		it("should reject events with invalid operation", () => {
			const listener = vi.fn();
			registry.onTrigger(listener);

			registry.fireTriggerWithContext({
				agent: "speckit",
				operation: "invalid-operation",
				timestamp: Date.now(),
			});

			expect(listener).not.toHaveBeenCalled();
		});

		it("should reject events with invalid timestamp", () => {
			const listener = vi.fn();
			registry.onTrigger(listener);

			registry.fireTriggerWithContext({
				agent: "speckit",
				operation: "specify",
				timestamp: -1,
			});

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("trigger history", () => {
		it("should store triggers in chronological order", () => {
			registry.fireTrigger("speckit", "specify");
			registry.fireTrigger("speckit", "clarify");
			registry.fireTrigger("speckit", "plan");

			const history = registry.getTriggerHistory();
			expect(history).toHaveLength(3);
			expect(history[0].operation).toBe("specify");
			expect(history[1].operation).toBe("clarify");
			expect(history[2].operation).toBe("plan");
		});

		it("should prune history when MAX_TRIGGER_HISTORY exceeded (FIFO)", () => {
			const operations: Array<
				"specify" | "clarify" | "plan" | "analyze" | "checklist"
			> = ["specify", "clarify", "plan", "analyze", "checklist"];

			// Fire 51 triggers (max is 50)
			for (let i = 0; i < 51; i++) {
				registry.fireTrigger("speckit", operations[i % operations.length]);
			}

			const history = registry.getTriggerHistory();
			expect(history).toHaveLength(50);
			// First trigger should be removed (was "specify")
			expect(history[0].operation).toBe("clarify");
			// Last trigger should be present
			expect(history[49].operation).toBe("specify"); // 51 % 5 = 1, operations[1] = "clarify", wait 50 % 5 = 0
		});

		it("should return last N triggers when limit specified", () => {
			registry.fireTrigger("speckit", "specify");
			registry.fireTrigger("speckit", "clarify");
			registry.fireTrigger("speckit", "plan");
			registry.fireTrigger("speckit", "analyze");

			const lastTwo = registry.getTriggerHistory(2);
			expect(lastTwo).toHaveLength(2);
			expect(lastTwo[0].operation).toBe("plan");
			expect(lastTwo[1].operation).toBe("analyze");
		});

		it("should return all triggers when no limit specified", () => {
			registry.fireTrigger("speckit", "specify");
			registry.fireTrigger("speckit", "clarify");

			const all = registry.getTriggerHistory();
			expect(all).toHaveLength(2);
		});

		it("should return copy of history (not mutable reference)", () => {
			registry.fireTrigger("speckit", "specify");

			const history1 = registry.getTriggerHistory();
			history1.push({
				agent: "speckit",
				operation: "clarify",
				timestamp: Date.now(),
			});

			const history2 = registry.getTriggerHistory();
			expect(history2).toHaveLength(1); // Not affected by mutation
		});
	});

	describe("getLastTrigger", () => {
		it("should return undefined when no triggers fired", () => {
			const last = registry.getLastTrigger();
			expect(last).toBeUndefined();
		});

		it("should return the last fired trigger", () => {
			registry.fireTrigger("speckit", "specify");
			registry.fireTrigger("speckit", "clarify");

			const last = registry.getLastTrigger();
			expect(last).toBeDefined();
			expect(last?.operation).toBe("clarify");
		});
	});

	describe("clearTriggerHistory", () => {
		it("should clear all trigger history", () => {
			registry.fireTrigger("speckit", "specify");
			registry.fireTrigger("speckit", "clarify");

			registry.clearTriggerHistory();

			const history = registry.getTriggerHistory();
			expect(history).toHaveLength(0);
		});

		it("should log when history is cleared", () => {
			registry.clearTriggerHistory();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[TriggerRegistry] Trigger history cleared"
			);
		});
	});

	describe("multiple subscribers", () => {
		it("should notify all subscribers", () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();
			const listener3 = vi.fn();

			registry.onTrigger(listener1);
			registry.onTrigger(listener2);
			registry.onTrigger(listener3);

			registry.fireTrigger("speckit", "specify");

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
			expect(listener3).toHaveBeenCalledTimes(1);
		});

		it("should handle errors in event emission", () => {
			const listener = vi.fn(() => {
				throw new Error("Listener error");
			});

			registry.onTrigger(listener);

			// Fire trigger - should not throw
			expect(() => registry.fireTrigger("speckit", "specify")).not.toThrow();

			// Listener should still have been called
			expect(listener).toHaveBeenCalled();

			// Error should be logged
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining("Error emitting trigger event")
			);
		});
	});

	describe("disposal", () => {
		it("should dispose successfully", () => {
			registry.dispose();

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[TriggerRegistry] Disposed"
			);
		});

		it("should clear history on disposal", () => {
			registry.fireTrigger("speckit", "specify");
			registry.dispose();

			// Can't call getTriggerHistory after disposal, but we can check it was cleared
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				"[TriggerRegistry] Disposed"
			);
		});
	});
});
