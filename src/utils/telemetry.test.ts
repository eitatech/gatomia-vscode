import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	PreviewLoadTracker,
	DiagramRenderTracker,
	trackFormInteraction,
	trackRefinementRequest,
	getPerformanceSummary,
	meetsPreviewPerformanceTarget,
	meetsDiagramSuccessTarget,
	getPerformanceReport,
	clearTelemetry,
	exportMetrics,
} from "./telemetry";

describe("telemetry", () => {
	beforeEach(() => {
		clearTelemetry();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("PreviewLoadTracker", () => {
		it("should track successful preview load", () => {
			const tracker = new PreviewLoadTracker("doc-123", "spec");
			vi.advanceTimersByTime(1500); // 1.5 seconds
			tracker.complete(true);

			const metrics = exportMetrics().previews;
			expect(metrics).toHaveLength(1);
			expect(metrics[0].documentId).toBe("doc-123");
			expect(metrics[0].documentType).toBe("spec");
			expect(metrics[0].duration).toBe(1500);
			expect(metrics[0].success).toBe(true);
		});

		it("should track failed preview load", () => {
			const tracker = new PreviewLoadTracker("doc-456", "task");
			vi.advanceTimersByTime(500);
			tracker.complete(false, "Network error");

			const metrics = exportMetrics().previews;
			expect(metrics).toHaveLength(1);
			expect(metrics[0].success).toBe(false);
			expect(metrics[0].error).toBe("Network error");
		});

		it("should capture metadata", () => {
			const tracker = new PreviewLoadTracker("doc-789", "plan");
			tracker.setMetadata({
				diagramCount: 3,
				formFieldCount: 5,
				sectionCount: 10,
			});
			tracker.complete(true);

			const metrics = exportMetrics().previews;
			expect(metrics[0].diagramCount).toBe(3);
			expect(metrics[0].formFieldCount).toBe(5);
			expect(metrics[0].sectionCount).toBe(10);
		});

		it("should allow partial metadata updates", () => {
			const tracker = new PreviewLoadTracker("doc-abc", "research");
			tracker.setMetadata({ diagramCount: 2 });
			tracker.setMetadata({ formFieldCount: 3 });
			tracker.complete(true);

			const metrics = exportMetrics().previews;
			expect(metrics[0].diagramCount).toBe(2);
			expect(metrics[0].formFieldCount).toBe(3);
			expect(metrics[0].sectionCount).toBe(0);
		});
	});

	describe("DiagramRenderTracker", () => {
		it("should track successful diagram render", () => {
			const tracker = new DiagramRenderTracker(
				"doc-123",
				"diagram-1",
				"mermaid"
			);
			vi.advanceTimersByTime(200);
			tracker.complete(true);

			const metrics = exportMetrics().diagrams;
			expect(metrics).toHaveLength(1);
			expect(metrics[0].documentId).toBe("doc-123");
			expect(metrics[0].diagramId).toBe("diagram-1");
			expect(metrics[0].language).toBe("mermaid");
			expect(metrics[0].duration).toBe(200);
			expect(metrics[0].success).toBe(true);
			expect(metrics[0].retryCount).toBe(0);
		});

		it("should track failed diagram render", () => {
			const tracker = new DiagramRenderTracker("doc-456", "diagram-2", "c4");
			vi.advanceTimersByTime(100);
			tracker.complete(false, "Syntax error");

			const metrics = exportMetrics().diagrams;
			expect(metrics[0].success).toBe(false);
			expect(metrics[0].error).toBe("Syntax error");
		});

		it("should track retries", () => {
			const tracker = new DiagramRenderTracker(
				"doc-789",
				"diagram-3",
				"plantuml"
			);
			vi.advanceTimersByTime(100);
			tracker.retry();
			vi.advanceTimersByTime(150);
			tracker.retry();
			vi.advanceTimersByTime(200);
			tracker.complete(true);

			const metrics = exportMetrics().diagrams;
			expect(metrics[0].retryCount).toBe(2);
			expect(metrics[0].duration).toBe(200); // Last attempt duration
		});
	});

	describe("trackFormInteraction", () => {
		it("should track form field focus", () => {
			trackFormInteraction({
				documentId: "doc-123",
				sessionId: "session-1",
				fieldId: "field-1",
				fieldType: "text",
				interactionType: "focus",
			});

			const metrics = exportMetrics().forms;
			expect(metrics).toHaveLength(1);
			expect(metrics[0].documentId).toBe("doc-123");
			expect(metrics[0].sessionId).toBe("session-1");
			expect(metrics[0].fieldId).toBe("field-1");
			expect(metrics[0].fieldType).toBe("text");
			expect(metrics[0].interactionType).toBe("focus");
		});

		it("should track form field change with validation", () => {
			trackFormInteraction({
				documentId: "doc-456",
				sessionId: "session-2",
				fieldId: "field-2",
				fieldType: "dropdown",
				interactionType: "change",
				validationSuccess: true,
			});

			const metrics = exportMetrics().forms;
			expect(metrics[0].validationSuccess).toBe(true);
		});

		it("should track validation errors", () => {
			trackFormInteraction({
				documentId: "doc-789",
				sessionId: "session-3",
				fieldId: "field-3",
				fieldType: "text",
				interactionType: "blur",
				validationSuccess: false,
				validationError: "Required field is empty",
			});

			const metrics = exportMetrics().forms;
			expect(metrics[0].validationSuccess).toBe(false);
			expect(metrics[0].validationError).toBe("Required field is empty");
		});
	});

	describe("trackRefinementRequest", () => {
		it("should track successful refinement request", () => {
			trackRefinementRequest({
				documentId: "doc-123",
				documentType: "spec",
				sessionId: "session-1",
				issueType: "missingDetail",
				success: true,
				requestId: "req-abc",
			});

			const metrics = exportMetrics().refinements;
			expect(metrics).toHaveLength(1);
			expect(metrics[0].documentId).toBe("doc-123");
			expect(metrics[0].documentType).toBe("spec");
			expect(metrics[0].sessionId).toBe("session-1");
			expect(metrics[0].issueType).toBe("missingDetail");
			expect(metrics[0].success).toBe(true);
			expect(metrics[0].requestId).toBe("req-abc");
		});

		it("should track failed refinement request", () => {
			trackRefinementRequest({
				documentId: "doc-456",
				documentType: "task",
				sessionId: "session-2",
				issueType: "incorrectInfo",
				success: false,
				error: "API timeout",
			});

			const metrics = exportMetrics().refinements;
			expect(metrics[0].success).toBe(false);
			expect(metrics[0].error).toBe("API timeout");
			expect(metrics[0].requestId).toBeUndefined();
		});
	});

	describe("getPerformanceSummary", () => {
		it("should calculate correct summary for empty metrics", () => {
			const summary = getPerformanceSummary();

			expect(summary.totalPreviews).toBe(0);
			expect(summary.successfulPreviews).toBe(0);
			expect(summary.failedPreviews).toBe(0);
			expect(summary.averageLoadTime).toBe(0);
			expect(summary.medianLoadTime).toBe(0);
			expect(summary.p95LoadTime).toBe(0);
			expect(summary.previewsUnder3Seconds).toBe(0);
			expect(summary.previewsUnder3SecondsPercentage).toBe(0);
			expect(summary.totalDiagrams).toBe(0);
			expect(summary.diagramSuccessRate).toBe(0);
		});

		it("should calculate correct summary with mixed results", () => {
			// Add 10 previews: 8 fast, 2 slow
			for (let i = 0; i < 8; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(2000); // 2 seconds (under target)
				tracker.complete(true);
			}

			for (let i = 8; i < 10; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(4000); // 4 seconds (over target)
				tracker.complete(true);
			}

			const summary = getPerformanceSummary();

			expect(summary.totalPreviews).toBe(10);
			expect(summary.successfulPreviews).toBe(10);
			expect(summary.failedPreviews).toBe(0);
			expect(summary.previewsUnder3Seconds).toBe(8);
			expect(summary.previewsUnder3SecondsPercentage).toBe(80);
		});

		it("should calculate diagram success rate", () => {
			// Add 9 successful and 1 failed diagram
			for (let i = 0; i < 9; i++) {
				const tracker = new DiagramRenderTracker(
					"doc-1",
					`diagram-${i}`,
					"mermaid"
				);
				vi.advanceTimersByTime(100);
				tracker.complete(true);
			}

			const failTracker = new DiagramRenderTracker(
				"doc-1",
				"diagram-9",
				"mermaid"
			);
			vi.advanceTimersByTime(100);
			failTracker.complete(false, "Parse error");

			const summary = getPerformanceSummary();

			expect(summary.totalDiagrams).toBe(10);
			expect(summary.successfulDiagrams).toBe(9);
			expect(summary.failedDiagrams).toBe(1);
			expect(summary.diagramSuccessRate).toBe(90);
		});

		it("should group metrics by document type", () => {
			const tracker1 = new PreviewLoadTracker("doc-1", "spec");
			vi.advanceTimersByTime(1000);
			tracker1.complete(true);

			const tracker2 = new PreviewLoadTracker("doc-2", "spec");
			vi.advanceTimersByTime(2000);
			tracker2.complete(true);

			const tracker3 = new PreviewLoadTracker("doc-3", "task");
			vi.advanceTimersByTime(3000);
			tracker3.complete(true);

			const summary = getPerformanceSummary();

			expect(summary.byDocumentType.size).toBe(2);
			expect(summary.byDocumentType.get("spec")?.count).toBe(2);
			expect(summary.byDocumentType.get("spec")?.averageLoadTime).toBe(1500);
			expect(summary.byDocumentType.get("spec")?.successRate).toBe(100);
			expect(summary.byDocumentType.get("task")?.count).toBe(1);
			expect(summary.byDocumentType.get("task")?.averageLoadTime).toBe(3000);
		});
	});

	describe("meetsPreviewPerformanceTarget", () => {
		it("should return false when under 95% threshold", () => {
			// 9 fast, 1 slow = 90%
			for (let i = 0; i < 9; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(2000);
				tracker.complete(true);
			}

			const tracker = new PreviewLoadTracker("doc-slow", "spec");
			vi.advanceTimersByTime(5000);
			tracker.complete(true);

			expect(meetsPreviewPerformanceTarget()).toBe(false);
		});

		it("should return true when at 95% threshold", () => {
			// 19 fast, 1 slow = 95%
			for (let i = 0; i < 19; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(2000);
				tracker.complete(true);
			}

			const tracker = new PreviewLoadTracker("doc-slow", "spec");
			vi.advanceTimersByTime(5000);
			tracker.complete(true);

			expect(meetsPreviewPerformanceTarget()).toBe(true);
		});

		it("should return true when above 95% threshold", () => {
			// 20 fast, 0 slow = 100%
			for (let i = 0; i < 20; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(2000);
				tracker.complete(true);
			}

			expect(meetsPreviewPerformanceTarget()).toBe(true);
		});
	});

	describe("meetsDiagramSuccessTarget", () => {
		it("should return false when under 90% threshold", () => {
			// 8 success, 2 fail = 80%
			for (let i = 0; i < 8; i++) {
				const tracker = new DiagramRenderTracker(
					"doc-1",
					`diagram-${i}`,
					"mermaid"
				);
				vi.advanceTimersByTime(100);
				tracker.complete(true);
			}

			for (let i = 8; i < 10; i++) {
				const tracker = new DiagramRenderTracker(
					"doc-1",
					`diagram-${i}`,
					"mermaid"
				);
				vi.advanceTimersByTime(100);
				tracker.complete(false);
			}

			expect(meetsDiagramSuccessTarget()).toBe(false);
		});

		it("should return true when at 90% threshold", () => {
			// 9 success, 1 fail = 90%
			for (let i = 0; i < 9; i++) {
				const tracker = new DiagramRenderTracker(
					"doc-1",
					`diagram-${i}`,
					"mermaid"
				);
				vi.advanceTimersByTime(100);
				tracker.complete(true);
			}

			const failTracker = new DiagramRenderTracker(
				"doc-1",
				"diagram-9",
				"mermaid"
			);
			vi.advanceTimersByTime(100);
			failTracker.complete(false);

			expect(meetsDiagramSuccessTarget()).toBe(true);
		});

		it("should return true when above 90% threshold", () => {
			// 10 success, 0 fail = 100%
			for (let i = 0; i < 10; i++) {
				const tracker = new DiagramRenderTracker(
					"doc-1",
					`diagram-${i}`,
					"mermaid"
				);
				vi.advanceTimersByTime(100);
				tracker.complete(true);
			}

			expect(meetsDiagramSuccessTarget()).toBe(true);
		});
	});

	describe("getPerformanceReport", () => {
		it("should generate readable report", () => {
			// Add some sample data
			const tracker1 = new PreviewLoadTracker("doc-1", "spec");
			vi.advanceTimersByTime(1500);
			tracker1.complete(true);

			const tracker2 = new PreviewLoadTracker("doc-2", "task");
			vi.advanceTimersByTime(2500);
			tracker2.complete(true);

			const diagram1 = new DiagramRenderTracker(
				"doc-1",
				"diagram-1",
				"mermaid"
			);
			vi.advanceTimersByTime(200);
			diagram1.complete(true);

			const diagram2 = new DiagramRenderTracker("doc-2", "diagram-2", "c4");
			vi.advanceTimersByTime(300);
			diagram2.complete(false);

			const report = getPerformanceReport();

			expect(report).toContain("Preview Performance Report");
			expect(report).toContain("Total Previews: 2");
			expect(report).toContain("Successful: 2");
			expect(report).toContain("Total Diagrams: 2");
			expect(report).toContain("Success Rate: 50.0%");
			expect(report).toContain("spec:");
			expect(report).toContain("task:");
		});

		it("should show PASS/FAIL indicators", () => {
			// Create enough data to pass both targets
			for (let i = 0; i < 20; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(2000);
				tracker.complete(true);
			}

			for (let i = 0; i < 10; i++) {
				const diagram = new DiagramRenderTracker(
					"doc-1",
					`diagram-${i}`,
					"mermaid"
				);
				vi.advanceTimersByTime(100);
				diagram.complete(true);
			}

			const report = getPerformanceReport();

			expect(report).toContain("SC-001 Target (95% < 3s): ✓ PASS");
			expect(report).toContain("SC-002 Target (90% success): ✓ PASS");
		});
	});

	describe("clearTelemetry", () => {
		it("should clear all metrics", () => {
			const tracker = new PreviewLoadTracker("doc-1", "spec");
			tracker.complete(true);

			trackFormInteraction({
				documentId: "doc-1",
				sessionId: "session-1",
				fieldId: "field-1",
				fieldType: "text",
				interactionType: "focus",
			});
			trackRefinementRequest({
				documentId: "doc-1",
				documentType: "spec",
				sessionId: "session-1",
				issueType: "missingDetail",
				success: true,
			});

			const diagram = new DiagramRenderTracker("doc-1", "diagram-1", "mermaid");
			diagram.complete(true);

			expect(exportMetrics().previews.length).toBeGreaterThan(0);
			expect(exportMetrics().forms.length).toBeGreaterThan(0);
			expect(exportMetrics().refinements.length).toBeGreaterThan(0);
			expect(exportMetrics().diagrams.length).toBeGreaterThan(0);

			clearTelemetry();

			expect(exportMetrics().previews.length).toBe(0);
			expect(exportMetrics().forms.length).toBe(0);
			expect(exportMetrics().refinements.length).toBe(0);
			expect(exportMetrics().diagrams.length).toBe(0);
		});
	});

	describe("exportMetrics", () => {
		it("should export all metric types", () => {
			const tracker = new PreviewLoadTracker("doc-1", "spec");
			tracker.complete(true);

			const diagram = new DiagramRenderTracker("doc-1", "diagram-1", "mermaid");
			diagram.complete(true);

			trackFormInteraction({
				documentId: "doc-1",
				sessionId: "session-1",
				fieldId: "field-1",
				fieldType: "text",
				interactionType: "focus",
			});
			trackRefinementRequest({
				documentId: "doc-1",
				documentType: "spec",
				sessionId: "session-1",
				issueType: "missingDetail",
				success: true,
			});

			const exported = exportMetrics();

			expect(exported.previews).toHaveLength(1);
			expect(exported.diagrams).toHaveLength(1);
			expect(exported.forms).toHaveLength(1);
			expect(exported.refinements).toHaveLength(1);
		});

		it("should return arrays with data", () => {
			const tracker = new PreviewLoadTracker("doc-1", "spec");
			tracker.complete(true);

			const exported = exportMetrics();

			// TypeScript enforces readonly at compile time
			// Here we just verify the structure is correct
			expect(Array.isArray(exported.previews)).toBe(true);
			expect(Array.isArray(exported.diagrams)).toBe(true);
			expect(Array.isArray(exported.forms)).toBe(true);
			expect(Array.isArray(exported.refinements)).toBe(true);
		});
	});

	describe("pruning", () => {
		it("should limit stored metrics to prevent memory issues", () => {
			// Add more than the max (1000)
			for (let i = 0; i < 1100; i++) {
				const tracker = new PreviewLoadTracker(`doc-${i}`, "spec");
				vi.advanceTimersByTime(1000);
				tracker.complete(true);
			}

			const metrics = exportMetrics().previews;
			expect(metrics.length).toBeLessThanOrEqual(1000);
		});
	});
});
