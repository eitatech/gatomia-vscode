/**
 * Integration Tests: Welcome Screen Status Display
 * Tests for status section, diagnostics, and health indicators
 * Based on specs/006-welcome-screen FR-013 and tasks T096-T097
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type * as vscode from "vscode";
import { WelcomeScreenProvider } from "../../../src/providers/welcome-screen-provider";
import { SystemDiagnostics } from "../../../src/services/system-diagnostics";

describe("Welcome Screen Status Integration (US5)", () => {
	let provider: WelcomeScreenProvider;
	let mockContext: vscode.ExtensionContext;
	let mockOutputChannel: vscode.OutputChannel;

	beforeEach(() => {
		// Mock extension context
		mockContext = {
			subscriptions: [],
			extensionPath: "/fake/extension/path",
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(() => []),
			},
		} as unknown as vscode.ExtensionContext;

		// Mock output channel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel;

		provider = new WelcomeScreenProvider(mockContext, mockOutputChannel);
	});

	describe("Status Display in Welcome State (T096)", () => {
		it("should include diagnostics array in welcome state", async () => {
			const state = await provider.getWelcomeState();

			expect(state).toHaveProperty("diagnostics");
			expect(Array.isArray(state.diagnostics)).toBe(true);
		});

		it("should return empty diagnostics array initially", async () => {
			const state = await provider.getWelcomeState();

			expect(state.diagnostics).toEqual([]);
		});

		it("should include diagnostic with all properties", async () => {
			// Record a diagnostic through the provider
			provider.systemDiagnostics.recordError(
				"error",
				"Test error",
				"test-source",
				"Try this fix"
			);

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(1);
			const diag = state.diagnostics[0];
			expect(diag).toHaveProperty("id");
			expect(diag).toHaveProperty("timestamp");
			expect(diag.severity).toBe("error");
			expect(diag.message).toBe("Test error");
			expect(diag.source).toBe("test-source");
			expect(diag.suggestedAction).toBe("Try this fix");
		});

		it("should include multiple diagnostics in state", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "Error 1", "source-1");
			diagnostics.recordError("warning", "Warning 1", "source-2");
			diagnostics.recordError("error", "Error 2", "source-3");

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(3);
		});

		it("should order diagnostics by most recent first", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "First error", "source");
			diagnostics.recordError("error", "Second error", "source");
			diagnostics.recordError("error", "Third error", "source");

			const state = await provider.getWelcomeState();

			expect(state.diagnostics[0].message).toBe("Third error");
			expect(state.diagnostics[1].message).toBe("Second error");
			expect(state.diagnostics[2].message).toBe("First error");
		});

		it("should include both errors and warnings", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "Critical error", "source");
			diagnostics.recordError("warning", "Minor warning", "source");

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(2);
			const severities = state.diagnostics.map((d) => d.severity);
			expect(severities).toContain("error");
			expect(severities).toContain("warning");
		});

		it("should respect 5-entry limit in state", async () => {
			const diagnostics = provider.systemDiagnostics;

			// Record 7 diagnostics
			for (let i = 1; i <= 7; i++) {
				diagnostics.recordError("error", `Error ${i}`, "source");
			}

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(5);
		});

		it("should filter diagnostics older than 24 hours", async () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);

			const diagnostics = provider.systemDiagnostics;

			// Record old diagnostic
			diagnostics.recordError("error", "Old error", "source");

			// Move time forward 25 hours
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000);

			// Record new diagnostic
			diagnostics.recordError("error", "New error", "source");

			// Move forward another minute to allow cleanup
			vi.spyOn(Date, "now").mockReturnValue(now + 25 * 60 * 60 * 1000 + 61_000);

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(1);
			expect(state.diagnostics[0].message).toBe("New error");

			vi.restoreAllMocks();
		});

		it("should include diagnostics from different sources", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "Spec error", "spec-operations");
			diagnostics.recordError("error", "Hook error", "hook-execution");
			diagnostics.recordError("warning", "Prompt warning", "prompt-generation");
			diagnostics.recordError(
				"error",
				"Dependency error",
				"dependency-detection"
			);

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(4);
			const sources = state.diagnostics.map((d) => d.source);
			expect(sources).toContain("spec-operations");
			expect(sources).toContain("hook-execution");
			expect(sources).toContain("prompt-generation");
			expect(sources).toContain("dependency-detection");
		});

		it("should include suggested actions when provided", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError(
				"error",
				"Missing dependency",
				"dependency-detection",
				"Install GitHub Copilot extension"
			);

			const state = await provider.getWelcomeState();

			expect(state.diagnostics[0].suggestedAction).toBe(
				"Install GitHub Copilot extension"
			);
		});
	});

	describe("Real-Time Diagnostic Updates (T097)", () => {
		it("should not crash if no webview is active", () => {
			const diagnostics = new SystemDiagnostics();

			// Should not throw when recording without webview
			expect(() => {
				diagnostics.recordError("error", "Test", "source");
			}).not.toThrow();
		});

		it("should handle rapid diagnostic recording", async () => {
			const diagnostics = provider.systemDiagnostics;

			// Record multiple diagnostics quickly
			for (let i = 1; i <= 5; i++) {
				diagnostics.recordError("error", `Rapid error ${i}`, "source");
			}

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(5);
		});

		it("should maintain diagnostic order after recording", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "First", "source");
			diagnostics.recordError("error", "Second", "source");

			const state = await provider.getWelcomeState();

			expect(state.diagnostics[0].message).toBe("Second");
			expect(state.diagnostics[1].message).toBe("First");
		});
	});

	describe("Health Status Indicators (T097)", () => {
		it("should indicate healthy state with no diagnostics", async () => {
			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(0);
		});

		it("should indicate degraded state with warnings", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("warning", "Warning", "source");

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.length).toBe(1);
			expect(state.diagnostics.some((d) => d.severity === "warning")).toBe(
				true
			);
		});

		it("should indicate error state with errors", async () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "Error", "source");

			const state = await provider.getWelcomeState();

			expect(state.diagnostics.some((d) => d.severity === "error")).toBe(true);
		});

		it("should count errors and warnings separately", () => {
			const diagnostics = provider.systemDiagnostics;

			diagnostics.recordError("error", "Error 1", "source");
			diagnostics.recordError("error", "Error 2", "source");
			diagnostics.recordError("warning", "Warning 1", "source");

			const counts = diagnostics.getCounts();

			expect(counts.errors).toBe(2);
			expect(counts.warnings).toBe(1);
			expect(counts.total).toBe(3);
		});

		it("should detect presence of errors", () => {
			const diagnostics = provider.systemDiagnostics;

			expect(diagnostics.hasErrors()).toBe(false);

			diagnostics.recordError("warning", "Warning", "source");
			expect(diagnostics.hasErrors()).toBe(false);

			diagnostics.recordError("error", "Error", "source");
			expect(diagnostics.hasErrors()).toBe(true);
		});
	});
});
