/**
 * SystemDiagnostics Service
 * Collects and manages error/warning diagnostics from extension operations
 * Based on specs/006-welcome-screen/data-model.md and spec.md FR-013
 */

import type { SystemDiagnostic } from "../types/welcome";

export class SystemDiagnostics {
	private static readonly MAX_DIAGNOSTICS = 5;
	private static readonly RETENTION_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

	private diagnostics: SystemDiagnostic[] = [];
	private lastCleanup: number = Date.now();

	/**
	 * Record a new error or warning
	 * Automatically cleans up old entries and enforces 5-entry limit
	 * @param severity - 'error' or 'warning'
	 * @param message - Human-readable error description
	 * @param source - Which component generated the error
	 * @param suggestedAction - Optional actionable fix description
	 */
	recordError(
		severity: "error" | "warning",
		message: string,
		source: string,
		suggestedAction?: string
	): SystemDiagnostic {
		// Cleanup old diagnostics periodically
		this.cleanup();

		const diagnostic: SystemDiagnostic = {
			id: this.generateId(),
			timestamp: Date.now(),
			severity,
			message,
			source,
			suggestedAction: suggestedAction || null,
		};

		// Add to beginning of array (most recent first)
		this.diagnostics.unshift(diagnostic);

		// Enforce 5-entry limit
		if (this.diagnostics.length > SystemDiagnostics.MAX_DIAGNOSTICS) {
			this.diagnostics = this.diagnostics.slice(
				0,
				SystemDiagnostics.MAX_DIAGNOSTICS
			);
		}

		return diagnostic;
	}

	/**
	 * Get recent diagnostics from the past 24 hours, limited to 5 entries
	 * Returns most recent diagnostics first
	 */
	getRecentDiagnostics(): SystemDiagnostic[] {
		// Cleanup before returning
		this.cleanup();

		// Already limited to 5 and filtered by age during cleanup
		return [...this.diagnostics];
	}

	/**
	 * Remove diagnostics older than 24 hours
	 * Runs automatically on recordError and getRecentDiagnostics
	 */
	cleanup(): void {
		const cutoffTime = Date.now() - SystemDiagnostics.RETENTION_PERIOD_MS;

		// Only cleanup once per minute to avoid excessive filtering
		const timeSinceLastCleanup = Date.now() - this.lastCleanup;
		if (timeSinceLastCleanup < 60_000 && this.diagnostics.length > 0) {
			return;
		}

		const beforeCount = this.diagnostics.length;
		this.diagnostics = this.diagnostics.filter(
			(d) => d.timestamp >= cutoffTime
		);

		const removed = beforeCount - this.diagnostics.length;
		if (removed > 0) {
			this.lastCleanup = Date.now();
		}
	}

	/**
	 * Clear all diagnostics (for testing or manual reset)
	 */
	clear(): void {
		this.diagnostics = [];
		this.lastCleanup = Date.now();
	}

	/**
	 * Get count of diagnostics by severity
	 */
	getCounts(): { errors: number; warnings: number; total: number } {
		this.cleanup();

		const errors = this.diagnostics.filter(
			(d) => d.severity === "error"
		).length;
		const warnings = this.diagnostics.filter(
			(d) => d.severity === "warning"
		).length;

		return {
			errors,
			warnings,
			total: this.diagnostics.length,
		};
	}

	/**
	 * Check if there are any recent errors
	 */
	hasErrors(): boolean {
		this.cleanup();
		return this.diagnostics.some((d) => d.severity === "error");
	}

	/**
	 * Generate unique diagnostic ID
	 */
	private generateId(): string {
		return `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Get diagnostic by ID (for testing)
	 */
	getById(id: string): SystemDiagnostic | undefined {
		return this.diagnostics.find((d) => d.id === id);
	}

	/**
	 * Get diagnostics from specific source
	 */
	getBySource(source: string): SystemDiagnostic[] {
		this.cleanup();
		return this.diagnostics.filter((d) => d.source === source);
	}

	/**
	 * Get all diagnostics without cleanup (for testing)
	 */
	getAllRaw(): SystemDiagnostic[] {
		return [...this.diagnostics];
	}
}
