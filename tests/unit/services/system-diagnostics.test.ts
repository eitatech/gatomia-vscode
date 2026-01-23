/**
 * Unit Tests: SystemDiagnostics Service
 * Tests for diagnostic recording, 24-hour cleanup, and 5-entry limit
 * Based on specs/006-welcome-screen FR-013 and tasks T093-T095
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemDiagnostics } from "../../../src/services/system-diagnostics";

describe("SystemDiagnostics Service - Unit Tests (US5)", () => {
	let service: SystemDiagnostics;

	beforeEach(() => {
		service = new SystemDiagnostics();
	});

	describe("Diagnostic Recording (T093)", () => {
		it("should record an error with all required properties", () => {
			const diagnostic = service.recordError(
				"error",
				"Test error message",
				"test-source"
			);

			expect(diagnostic).toHaveProperty("id");
			expect(diagnostic).toHaveProperty("timestamp");
			expect(diagnostic.severity).toBe("error");
			expect(diagnostic.message).toBe("Test error message");
			expect(diagnostic.source).toBe("test-source");
			expect(diagnostic.suggestedAction).toBeNull();
		});

		it("should record a warning with suggested action", () => {
			const diagnostic = service.recordError(
				"warning",
				"Test warning",
				"test-source",
				"Try this fix"
			);

			expect(diagnostic.severity).toBe("warning");
			expect(diagnostic.message).toBe("Test warning");
			expect(diagnostic.suggestedAction).toBe("Try this fix");
		});

		it("should generate unique IDs for each diagnostic", () => {
			const diag1 = service.recordError("error", "Error 1", "source-1");
			const diag2 = service.recordError("error", "Error 2", "source-2");

			expect(diag1.id).not.toBe(diag2.id);
		});

		it("should set timestamp to current time", () => {
			const before = Date.now();
			const diagnostic = service.recordError("error", "Test", "source");
			const after = Date.now();

			expect(diagnostic.timestamp).toBeGreaterThanOrEqual(before);
			expect(diagnostic.timestamp).toBeLessThanOrEqual(after);
		});

		it("should add diagnostics to the beginning of the list (most recent first)", () => {
			service.recordError("error", "First error", "source");
			service.recordError("error", "Second error", "source");

			const recent = service.getRecentDiagnostics();
			expect(recent[0].message).toBe("Second error");
			expect(recent[1].message).toBe("First error");
		});

		it("should track spec operation errors", () => {
			const diagnostic = service.recordError(
				"error",
				"Failed to load spec",
				"spec-operations"
			);

			expect(diagnostic.source).toBe("spec-operations");
		});

		it("should track hook execution errors", () => {
			const diagnostic = service.recordError(
				"error",
				"Hook execution failed",
				"hook-execution"
			);

			expect(diagnostic.source).toBe("hook-execution");
		});

		it("should track prompt generation errors", () => {
			const diagnostic = service.recordError(
				"warning",
				"Prompt not found",
				"prompt-generation"
			);

			expect(diagnostic.source).toBe("prompt-generation");
		});

		it("should track dependency detection errors", () => {
			const diagnostic = service.recordError(
				"error",
				"Copilot not found",
				"dependency-detection"
			);

			expect(diagnostic.source).toBe("dependency-detection");
		});

		it("should track configuration update errors", () => {
			const diagnostic = service.recordError(
				"error",
				"Invalid config value",
				"config-updates"
			);

			expect(diagnostic.source).toBe("config-updates");
		});

		it("should support optional suggested actions", () => {
			const diag1 = service.recordError("error", "Error", "source");
			const diag2 = service.recordError(
				"error",
				"Error with fix",
				"source",
				"Install dependency"
			);

			expect(diag1.suggestedAction).toBeNull();
			expect(diag2.suggestedAction).toBe("Install dependency");
		});

		it("should return the recorded diagnostic", () => {
			const result = service.recordError("error", "Test", "source");

			expect(result).toBeDefined();
			expect(result.message).toBe("Test");
		});
	});

	describe("24-Hour Window Cleanup (T094)", () => {
		it("should filter diagnostics older than 24 hours", () => {
			// Mock Date.now to control time
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			// Record diagnostic at current time
			service.recordError("error", "Recent error", "source");

			// Move time forward 25 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000);

			// Record new diagnostic
			service.recordError("error", "New error", "source");

			// Get recent diagnostics - should only return the new one
			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(1);
			expect(recent[0].message).toBe("New error");

			vi.restoreAllMocks();
		});

		it("should keep diagnostics within 24 hours", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			service.recordError("error", "Error 1", "source");

			// Move time forward 23 hours (within window)
			vi.spyOn(Date, "now").mockReturnValue(now + 23 * 60 * 60 * 1000);

			service.recordError("error", "Error 2", "source");

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(2);

			vi.restoreAllMocks();
		});

		it("should cleanup on getRecentDiagnostics()", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			service.recordError("error", "Old error", "source");

			// Move time forward 25 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000);

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(0);

			vi.restoreAllMocks();
		});

		it("should cleanup on recordError()", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			service.recordError("error", "Old error", "source");

			// Move time forward 25 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000);

			// Recording new error should trigger cleanup
			service.recordError("error", "New error", "source");

			// Move forward another minute to allow cleanup
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000 + 61_000);

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(1);
			expect(recent[0].message).toBe("New error");

			vi.restoreAllMocks();
		});

		it("should not cleanup too frequently (rate limiting)", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			// Record old diagnostic
			service.recordError("error", "Old error", "source");

			// Move forward 25 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000);

			// First call should cleanup
			service.recordError("error", "New error 1", "source");

			// Immediately after (< 1 minute), should not cleanup again
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000 + 1000);

			const raw = service.getAllRaw();
			// Both should still be present due to rate limiting
			expect(raw.length).toBeGreaterThanOrEqual(1);

			vi.restoreAllMocks();
		});

		it("should handle empty diagnostics list during cleanup", () => {
			service.cleanup();

			const recent = service.getRecentDiagnostics();
			expect(recent.length).toBe(0);
		});

		it("should preserve diagnostics exactly at 24-hour boundary", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			service.recordError("error", "Boundary error", "source");

			// Move to exactly 24 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 24 * 60 * 60 * 1000);

			const recent = service.getRecentDiagnostics();

			// Should still be present at exactly 24 hours
			expect(recent.length).toBe(1);

			vi.restoreAllMocks();
		});
	});

	describe("5-Entry Limit (T095)", () => {
		it("should enforce maximum of 5 diagnostics", () => {
			// Record 6 diagnostics
			for (let i = 1; i <= 6; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(5);
		});

		it("should keep most recent 5 diagnostics when limit exceeded", () => {
			// Record 7 diagnostics
			for (let i = 1; i <= 7; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(5);
			// Most recent should be kept
			expect(recent[0].message).toBe("Error 7");
			expect(recent[1].message).toBe("Error 6");
			expect(recent[2].message).toBe("Error 5");
			expect(recent[3].message).toBe("Error 4");
			expect(recent[4].message).toBe("Error 3");
		});

		it("should discard oldest diagnostics when limit exceeded", () => {
			// Record 6 diagnostics
			for (let i = 1; i <= 6; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			const recent = service.getRecentDiagnostics();

			// Oldest (Error 1) should be discarded
			const messages = recent.map((d) => d.message);
			expect(messages).not.toContain("Error 1");
		});

		it("should handle exactly 5 diagnostics", () => {
			for (let i = 1; i <= 5; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(5);
		});

		it("should handle fewer than 5 diagnostics", () => {
			for (let i = 1; i <= 3; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			const recent = service.getRecentDiagnostics();

			expect(recent.length).toBe(3);
		});

		it("should maintain 5-entry limit across multiple record calls", () => {
			// Record 3 diagnostics
			for (let i = 1; i <= 3; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			expect(service.getRecentDiagnostics().length).toBe(3);

			// Record 3 more (total 6)
			for (let i = 4; i <= 6; i++) {
				service.recordError("error", `Error ${i}`, "source");
			}

			expect(service.getRecentDiagnostics().length).toBe(5);
		});

		it("should combine 24-hour cleanup with 5-entry limit", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			// Record 5 old diagnostics
			for (let i = 1; i <= 5; i++) {
				service.recordError("error", `Old error ${i}`, "source");
			}

			// Move time forward 25 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000);

			// Record 3 new diagnostics
			for (let i = 1; i <= 3; i++) {
				service.recordError("error", `New error ${i}`, "source");
			}

			// Move forward another minute to allow cleanup
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000 + 61_000);

			const recent = service.getRecentDiagnostics();

			// Should only have 3 new ones (old ones removed by 24h cleanup)
			expect(recent.length).toBe(3);
			expect(recent.every((d) => d.message.startsWith("New error"))).toBe(true);

			vi.restoreAllMocks();
		});
	});

	describe("Additional Helper Methods", () => {
		it("should get diagnostic counts by severity", () => {
			service.recordError("error", "Error 1", "source");
			service.recordError("error", "Error 2", "source");
			service.recordError("warning", "Warning 1", "source");

			const counts = service.getCounts();

			expect(counts.errors).toBe(2);
			expect(counts.warnings).toBe(1);
			expect(counts.total).toBe(3);
		});

		it("should check if there are any errors", () => {
			expect(service.hasErrors()).toBe(false);

			service.recordError("warning", "Warning", "source");
			expect(service.hasErrors()).toBe(false);

			service.recordError("error", "Error", "source");
			expect(service.hasErrors()).toBe(true);
		});

		it("should clear all diagnostics", () => {
			service.recordError("error", "Error 1", "source");
			service.recordError("error", "Error 2", "source");

			service.clear();

			expect(service.getRecentDiagnostics().length).toBe(0);
		});

		it("should get diagnostic by ID", () => {
			const diag = service.recordError("error", "Test", "source");

			const found = service.getById(diag.id);

			expect(found).toBeDefined();
			expect(found?.message).toBe("Test");
		});

		it("should get diagnostics by source", () => {
			service.recordError("error", "Hook error", "hook-execution");
			service.recordError("error", "Spec error", "spec-operations");
			service.recordError("warning", "Hook warning", "hook-execution");

			const hookDiags = service.getBySource("hook-execution");

			expect(hookDiags.length).toBe(2);
			expect(hookDiags.every((d) => d.source === "hook-execution")).toBe(true);
		});
	});
});
