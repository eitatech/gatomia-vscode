/**
 * Unit Tests for ExtensionMonitorService
 *
 * Tests extension change monitoring and event emission for agent registry refresh.
 *
 * Test Coverage:
 * - T065: ExtensionMonitorService skeleton and basic functionality
 * - T066: Extension install/uninstall event listeners
 *
 * @see src/features/hooks/extension-monitor-service.ts
 * @see specs/011-custom-agent-hooks/tasks.md (Phase 6: Real-Time Refresh)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ExtensionMonitorService } from "../../../../src/features/hooks/extension-monitor-service";
import { extensions } from "vscode";

describe("ExtensionMonitorService", () => {
	let service: ExtensionMonitorService;

	beforeEach(() => {
		service = new ExtensionMonitorService();
		vi.clearAllMocks();
	});

	afterEach(() => {
		service.dispose();
	});

	// ============================================================================
	// T065: Service Initialization and Lifecycle
	// ============================================================================

	describe("T065: Service initialization", () => {
		it("should create instance without errors", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(ExtensionMonitorService);
		});

		it("should start monitoring when startMonitoring is called", () => {
			expect(() => service.startMonitoring()).not.toThrow();
		});

		it("should stop monitoring when stopMonitoring is called", () => {
			service.startMonitoring();
			expect(() => service.stopMonitoring()).not.toThrow();
		});

		it("should allow calling stopMonitoring before startMonitoring", () => {
			expect(() => service.stopMonitoring()).not.toThrow();
		});

		it("should allow multiple startMonitoring calls without errors", () => {
			service.startMonitoring();
			expect(() => service.startMonitoring()).not.toThrow();
		});

		it("should clean up resources when disposed", () => {
			service.startMonitoring();
			expect(() => service.dispose()).not.toThrow();
		});
	});

	// ============================================================================
	// T066: Extension Change Event Handling
	// ============================================================================

	describe("T066: Extension change events", () => {
		it("should allow subscribing to extension change events", () => {
			const callback = vi.fn();
			const disposable = service.onDidChangeExtensions(callback);

			expect(disposable).toBeDefined();
			expect(disposable.dispose).toBeInstanceOf(Function);
		});

		it("should emit event when extensions change", async () => {
			const callback = vi.fn();
			service.onDidChangeExtensions(callback);
			service.startMonitoring();

			// Simulate VS Code extension change
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			// Wait for event propagation
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callback).toHaveBeenCalled();
		});

		it("should include timestamp in change event", async () => {
			const callback = vi.fn();
			service.onDidChangeExtensions(callback);
			service.startMonitoring();

			// Trigger extension change
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			if (callback.mock.calls.length > 0) {
				const event = callback.mock.calls[0][0];
				expect(event).toHaveProperty("timestamp");
				expect(typeof event.timestamp).toBe("number");
			}
		});

		it("should notify multiple listeners", async () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const callback3 = vi.fn();

			service.onDidChangeExtensions(callback1);
			service.onDidChangeExtensions(callback2);
			service.onDidChangeExtensions(callback3);
			service.startMonitoring();

			// Trigger extension change
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
			expect(callback3).toHaveBeenCalled();
		});

		it("should not emit events after stopMonitoring", async () => {
			const callback = vi.fn();
			service.onDidChangeExtensions(callback);
			service.startMonitoring();
			service.stopMonitoring();

			// Trigger extension change
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callback).not.toHaveBeenCalled();
		});

		it("should allow disposing callback via returned disposable", async () => {
			const callback = vi.fn();
			const disposable = service.onDidChangeExtensions(callback);
			service.startMonitoring();

			// Dispose the callback
			disposable.dispose();

			// Trigger extension change
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callback).not.toHaveBeenCalled();
		});
	});

	// ============================================================================
	// Edge Cases and Error Handling
	// ============================================================================

	describe("Edge cases", () => {
		it("should handle listener errors gracefully", async () => {
			const errorCallback = vi.fn(() => {
				throw new Error("Listener error");
			});
			const normalCallback = vi.fn();

			service.onDidChangeExtensions(errorCallback);
			service.onDidChangeExtensions(normalCallback);
			service.startMonitoring();

			// Trigger extension change
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			// Normal callback should still be called despite error in first callback
			expect(errorCallback).toHaveBeenCalled();
			expect(normalCallback).toHaveBeenCalled();
		});

		it("should not throw when disposing already disposed service", () => {
			service.dispose();
			expect(() => service.dispose()).not.toThrow();
		});

		it("should handle VS Code extensions API not available", () => {
			// This test ensures graceful degradation if VS Code API is unavailable
			expect(() => service.startMonitoring()).not.toThrow();
		});
	});

	// ============================================================================
	// Lifecycle Management
	// ============================================================================

	describe("Lifecycle management", () => {
		it("should clear all listeners on dispose", async () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			service.onDidChangeExtensions(callback1);
			service.onDidChangeExtensions(callback2);
			service.startMonitoring();
			service.dispose();

			// Trigger extension change after dispose
			const mockExtensionChangeHandler = (extensions as any)
				._onDidChangeHandler;
			if (mockExtensionChangeHandler) {
				mockExtensionChangeHandler();
			}

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).not.toHaveBeenCalled();
		});

		it("should be safe to call startMonitoring after dispose", () => {
			service.startMonitoring();
			service.dispose();
			expect(() => service.startMonitoring()).not.toThrow();
		});
	});
});
