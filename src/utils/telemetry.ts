/**
 * Telemetry utilities for tracking preview performance metrics
 *
 * Tracks:
 * - Preview load times (SC-001: 95% within 3 seconds)
 * - Diagram render success rates (SC-002: 90% success)
 * - Form interaction metrics
 * - Refinement request submission tracking
 */

import type { DocumentType } from "../types/spec-kit-types";

// ==================== Interfaces ====================

export interface PreviewLoadMetrics {
	documentId: string;
	documentType: DocumentType;
	loadStartTime: number;
	loadEndTime?: number;
	duration?: number;
	success: boolean;
	error?: string;
	diagramCount: number;
	formFieldCount: number;
	sectionCount: number;
}

export interface DiagramRenderMetrics {
	documentId: string;
	diagramId: string;
	language: "mermaid" | "c4" | "plantuml" | "other";
	renderStartTime: number;
	renderEndTime?: number;
	duration?: number;
	success: boolean;
	error?: string;
	retryCount: number;
}

export interface FormInteractionMetrics {
	documentId: string;
	sessionId: string;
	fieldId: string;
	fieldType: "checkbox" | "dropdown" | "text" | "textarea" | "multiselect";
	interactionType: "focus" | "change" | "blur" | "submit";
	timestamp: number;
	validationSuccess?: boolean;
	validationError?: string;
}

export interface RefinementRequestMetrics {
	documentId: string;
	documentType: DocumentType;
	sessionId: string;
	issueType: "missingDetail" | "incorrectInfo" | "missingAsset" | "other";
	timestamp: number;
	success: boolean;
	requestId?: string;
	error?: string;
}

export interface PerformanceSummary {
	totalPreviews: number;
	successfulPreviews: number;
	failedPreviews: number;
	averageLoadTime: number;
	medianLoadTime: number;
	p95LoadTime: number;
	previewsUnder3Seconds: number;
	previewsUnder3SecondsPercentage: number;
	totalDiagrams: number;
	successfulDiagrams: number;
	failedDiagrams: number;
	diagramSuccessRate: number;
	byDocumentType: Map<
		DocumentType,
		{
			count: number;
			averageLoadTime: number;
			successRate: number;
		}
	>;
}

// ==================== In-Memory Storage ====================

class TelemetryStore {
	private previewMetrics: PreviewLoadMetrics[] = [];
	private diagramMetrics: DiagramRenderMetrics[] = [];
	private formMetrics: FormInteractionMetrics[] = [];
	private refinementMetrics: RefinementRequestMetrics[] = [];
	private readonly maxStoredMetrics = 1000; // Prevent unbounded growth

	addPreviewMetric(metric: PreviewLoadMetrics): void {
		this.previewMetrics.push(metric);
		this.pruneIfNeeded(this.previewMetrics);
	}

	addDiagramMetric(metric: DiagramRenderMetrics): void {
		this.diagramMetrics.push(metric);
		this.pruneIfNeeded(this.diagramMetrics);
	}

	addFormMetric(metric: FormInteractionMetrics): void {
		this.formMetrics.push(metric);
		this.pruneIfNeeded(this.formMetrics);
	}

	addRefinementMetric(metric: RefinementRequestMetrics): void {
		this.refinementMetrics.push(metric);
		this.pruneIfNeeded(this.refinementMetrics);
	}

	getPreviewMetrics(): readonly PreviewLoadMetrics[] {
		return this.previewMetrics;
	}

	getDiagramMetrics(): readonly DiagramRenderMetrics[] {
		return this.diagramMetrics;
	}

	getFormMetrics(): readonly FormInteractionMetrics[] {
		return this.formMetrics;
	}

	getRefinementMetrics(): readonly RefinementRequestMetrics[] {
		return this.refinementMetrics;
	}

	clear(): void {
		this.previewMetrics = [];
		this.diagramMetrics = [];
		this.formMetrics = [];
		this.refinementMetrics = [];
	}

	private pruneIfNeeded<T>(array: T[]): void {
		if (array.length > this.maxStoredMetrics) {
			array.splice(0, array.length - this.maxStoredMetrics);
		}
	}
}

// Singleton instance
const telemetryStore = new TelemetryStore();

// ==================== Preview Load Time Tracking ====================

export class PreviewLoadTracker {
	private readonly documentId: string;
	private readonly documentType: DocumentType;
	private readonly startTime: number;
	private diagramCount = 0;
	private formFieldCount = 0;
	private sectionCount = 0;

	constructor(documentId: string, documentType: DocumentType) {
		this.documentId = documentId;
		this.documentType = documentType;
		this.startTime = Date.now();
	}

	setMetadata(metadata: {
		diagramCount?: number;
		formFieldCount?: number;
		sectionCount?: number;
	}): void {
		if (metadata.diagramCount !== undefined) {
			this.diagramCount = metadata.diagramCount;
		}
		if (metadata.formFieldCount !== undefined) {
			this.formFieldCount = metadata.formFieldCount;
		}
		if (metadata.sectionCount !== undefined) {
			this.sectionCount = metadata.sectionCount;
		}
	}

	complete(success = true, error?: string): void {
		const endTime = Date.now();
		const duration = endTime - this.startTime;

		const metric: PreviewLoadMetrics = {
			documentId: this.documentId,
			documentType: this.documentType,
			loadStartTime: this.startTime,
			loadEndTime: endTime,
			duration,
			success,
			error,
			diagramCount: this.diagramCount,
			formFieldCount: this.formFieldCount,
			sectionCount: this.sectionCount,
		};

		telemetryStore.addPreviewMetric(metric);

		// Log for debugging in development
		if (process.env.NODE_ENV === "development") {
			console.log("[Telemetry] Preview Load:", {
				documentId: this.documentId,
				duration: `${duration}ms`,
				success,
				diagrams: this.diagramCount,
				forms: this.formFieldCount,
			});
		}
	}
}

// ==================== Diagram Render Tracking ====================

export class DiagramRenderTracker {
	private readonly documentId: string;
	private readonly diagramId: string;
	private readonly language: DiagramRenderMetrics["language"];
	private startTime: number;
	private retryCount = 0;

	constructor(
		documentId: string,
		diagramId: string,
		language: DiagramRenderMetrics["language"]
	) {
		this.documentId = documentId;
		this.diagramId = diagramId;
		this.language = language;
		this.startTime = Date.now();
	}

	retry(): void {
		this.retryCount += 1;
		this.startTime = Date.now();
	}

	complete(success = true, error?: string): void {
		const endTime = Date.now();
		const duration = endTime - this.startTime;

		const metric: DiagramRenderMetrics = {
			documentId: this.documentId,
			diagramId: this.diagramId,
			language: this.language,
			renderStartTime: this.startTime,
			renderEndTime: endTime,
			duration,
			success,
			error,
			retryCount: this.retryCount,
		};

		telemetryStore.addDiagramMetric(metric);

		// Log for debugging in development
		if (process.env.NODE_ENV === "development") {
			console.log("[Telemetry] Diagram Render:", {
				diagramId: this.diagramId,
				language: this.language,
				duration: `${duration}ms`,
				success,
				retries: this.retryCount,
			});
		}
	}
}

// ==================== Form Interaction Tracking ====================

export interface TrackFormInteractionOptions {
	documentId: string;
	sessionId: string;
	fieldId: string;
	fieldType: FormInteractionMetrics["fieldType"];
	interactionType: FormInteractionMetrics["interactionType"];
	validationSuccess?: boolean;
	validationError?: string;
}

export function trackFormInteraction(
	options: TrackFormInteractionOptions
): void {
	const metric: FormInteractionMetrics = {
		documentId: options.documentId,
		sessionId: options.sessionId,
		fieldId: options.fieldId,
		fieldType: options.fieldType,
		interactionType: options.interactionType,
		timestamp: Date.now(),
		validationSuccess: options.validationSuccess,
		validationError: options.validationError,
	};

	telemetryStore.addFormMetric(metric);
}

// ==================== Refinement Request Tracking ====================

export interface TrackRefinementRequestOptions {
	documentId: string;
	documentType: DocumentType;
	sessionId: string;
	issueType: RefinementRequestMetrics["issueType"];
	success: boolean;
	requestId?: string;
	error?: string;
}

export function trackRefinementRequest(
	options: TrackRefinementRequestOptions
): void {
	const metric: RefinementRequestMetrics = {
		documentId: options.documentId,
		documentType: options.documentType,
		sessionId: options.sessionId,
		issueType: options.issueType,
		timestamp: Date.now(),
		success: options.success,
		requestId: options.requestId,
		error: options.error,
	};

	telemetryStore.addRefinementMetric(metric);

	// Log for debugging in development
	if (process.env.NODE_ENV === "development") {
		console.log("[Telemetry] Refinement Request:", {
			documentId: options.documentId,
			issueType: options.issueType,
			success: options.success,
			requestId: options.requestId,
		});
	}
}

// ==================== Performance Analysis ====================

export function getPerformanceSummary(): PerformanceSummary {
	const previewMetrics = telemetryStore.getPreviewMetrics();
	const diagramMetrics = telemetryStore.getDiagramMetrics();

	// Preview metrics
	const successfulPreviews = previewMetrics.filter((m) => m.success);
	const failedPreviews = previewMetrics.filter((m) => !m.success);
	const durations = successfulPreviews
		.map((m) => m.duration!)
		.filter((d) => d !== undefined)
		.sort((a, b) => a - b);

	const averageLoadTime =
		durations.length > 0
			? durations.reduce((sum, d) => sum + d, 0) / durations.length
			: 0;

	const medianLoadTime =
		durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;

	const p95Index = Math.floor(durations.length * 0.95);
	const p95LoadTime = durations.length > 0 ? durations[p95Index] : 0;

	const previewsUnder3Seconds = durations.filter((d) => d <= 3000).length;
	const previewsUnder3SecondsPercentage =
		durations.length > 0 ? (previewsUnder3Seconds / durations.length) * 100 : 0;

	// Diagram metrics
	const successfulDiagrams = diagramMetrics.filter((m) => m.success);
	const failedDiagrams = diagramMetrics.filter((m) => !m.success);
	const diagramSuccessRate =
		diagramMetrics.length > 0
			? (successfulDiagrams.length / diagramMetrics.length) * 100
			: 0;

	// By document type
	const byDocumentType = new Map<
		DocumentType,
		{
			count: number;
			averageLoadTime: number;
			successRate: number;
		}
	>();

	for (const metric of previewMetrics) {
		const existing = byDocumentType.get(metric.documentType) || {
			count: 0,
			averageLoadTime: 0,
			successRate: 0,
		};

		const typeMetrics = previewMetrics.filter(
			(m) => m.documentType === metric.documentType
		);
		const typeSuccessful = typeMetrics.filter((m) => m.success);
		const typeDurations = typeSuccessful
			.map((m) => m.duration!)
			.filter((d) => d !== undefined);

		byDocumentType.set(metric.documentType, {
			count: typeMetrics.length,
			averageLoadTime:
				typeDurations.length > 0
					? typeDurations.reduce((sum, d) => sum + d, 0) / typeDurations.length
					: 0,
			successRate:
				typeMetrics.length > 0
					? (typeSuccessful.length / typeMetrics.length) * 100
					: 0,
		});
	}

	return {
		totalPreviews: previewMetrics.length,
		successfulPreviews: successfulPreviews.length,
		failedPreviews: failedPreviews.length,
		averageLoadTime,
		medianLoadTime,
		p95LoadTime,
		previewsUnder3Seconds,
		previewsUnder3SecondsPercentage,
		totalDiagrams: diagramMetrics.length,
		successfulDiagrams: successfulDiagrams.length,
		failedDiagrams: failedDiagrams.length,
		diagramSuccessRate,
		byDocumentType,
	};
}

// ==================== Utility Functions ====================

/**
 * Check if preview performance meets SC-001 target (95% within 3 seconds)
 */
export function meetsPreviewPerformanceTarget(): boolean {
	const summary = getPerformanceSummary();
	return summary.previewsUnder3SecondsPercentage >= 95;
}

/**
 * Check if diagram rendering meets SC-002 target (90% success rate)
 */
export function meetsDiagramSuccessTarget(): boolean {
	const summary = getPerformanceSummary();
	return summary.diagramSuccessRate >= 90;
}

/**
 * Get a human-readable performance report
 */
export function getPerformanceReport(): string {
	const summary = getPerformanceSummary();

	const lines = [
		"=== Preview Performance Report ===",
		"",
		"Preview Load Times:",
		`  Total Previews: ${summary.totalPreviews}`,
		`  Successful: ${summary.successfulPreviews}`,
		`  Failed: ${summary.failedPreviews}`,
		`  Average Load Time: ${summary.averageLoadTime.toFixed(0)}ms`,
		`  Median Load Time: ${summary.medianLoadTime.toFixed(0)}ms`,
		`  P95 Load Time: ${summary.p95LoadTime.toFixed(0)}ms`,
		`  Under 3 seconds: ${summary.previewsUnder3Seconds} (${summary.previewsUnder3SecondsPercentage.toFixed(1)}%)`,
		`  SC-001 Target (95% < 3s): ${meetsPreviewPerformanceTarget() ? "✓ PASS" : "✗ FAIL"}`,
		"",
		"Diagram Rendering:",
		`  Total Diagrams: ${summary.totalDiagrams}`,
		`  Successful: ${summary.successfulDiagrams}`,
		`  Failed: ${summary.failedDiagrams}`,
		`  Success Rate: ${summary.diagramSuccessRate.toFixed(1)}%`,
		`  SC-002 Target (90% success): ${meetsDiagramSuccessTarget() ? "✓ PASS" : "✗ FAIL"}`,
		"",
		"By Document Type:",
	];

	for (const [docType, stats] of summary.byDocumentType.entries()) {
		lines.push(
			`  ${docType}: ${stats.count} previews, ${stats.averageLoadTime.toFixed(0)}ms avg, ${stats.successRate.toFixed(1)}% success`
		);
	}

	return lines.join("\n");
}

/**
 * Clear all stored metrics (useful for testing)
 */
export function clearTelemetry(): void {
	telemetryStore.clear();
}

/**
 * Export metrics for external analysis or persistence
 */
export function exportMetrics(): {
	previews: readonly PreviewLoadMetrics[];
	diagrams: readonly DiagramRenderMetrics[];
	forms: readonly FormInteractionMetrics[];
	refinements: readonly RefinementRequestMetrics[];
} {
	return {
		previews: telemetryStore.getPreviewMetrics(),
		diagrams: telemetryStore.getDiagramMetrics(),
		forms: telemetryStore.getFormMetrics(),
		refinements: telemetryStore.getRefinementMetrics(),
	};
}
