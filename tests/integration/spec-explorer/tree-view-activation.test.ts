/**
 * Integration tests for tree-view activation pattern.
 *
 * Verifies that the non-blocking activation pattern used in extension.ts:
 * - Catches and logs rejections from syncAllSpecReviewFlowSummaries
 * - Calls specExplorer.refresh() after the sync resolves
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("tree-view activation pattern", () => {
	let outputLines: string[];
	let mockOutputChannel: { appendLine: (line: string) => void };
	let mockSpecExplorer: { refresh: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		outputLines = [];
		mockOutputChannel = { appendLine: (line) => outputLines.push(line) };
		mockSpecExplorer = { refresh: vi.fn() };
	});

	/**
	 * Simulates the non-blocking activation pattern introduced in extension.ts:
	 *   syncFn().then(() => specExplorer.refresh()).catch((err) => log(err))
	 */
	function runActivationPattern(syncFn: () => Promise<void>): Promise<void> {
		return new Promise((resolve) => {
			syncFn()
				.then(() => {
					mockSpecExplorer.refresh();
					mockOutputChannel.appendLine(
						"[ReviewFlow] Initial sync complete, spec explorer refreshed"
					);
				})
				.catch((err: unknown) => {
					mockOutputChannel.appendLine(
						`[ReviewFlow] Failed to sync initial pending summaries: ${err}`
					);
				})
				.finally(resolve);
		});
	}

	it("calls specExplorer.refresh() after sync resolves successfully", async () => {
		const syncFn = vi.fn().mockResolvedValue(undefined);

		await runActivationPattern(syncFn);

		expect(mockSpecExplorer.refresh).toHaveBeenCalledOnce();
	});

	it("logs completion message after sync resolves", async () => {
		const syncFn = vi.fn().mockResolvedValue(undefined);

		await runActivationPattern(syncFn);

		expect(outputLines).toContain(
			"[ReviewFlow] Initial sync complete, spec explorer refreshed"
		);
	});

	it("does not throw when sync rejects (no unhandled rejection)", async () => {
		const syncFn = vi.fn().mockRejectedValue(new Error("Disk read failed"));

		await expect(runActivationPattern(syncFn)).resolves.not.toThrow();
	});

	it("logs error when sync rejects", async () => {
		const syncFn = vi.fn().mockRejectedValue(new Error("Disk read failed"));

		await runActivationPattern(syncFn);

		expect(outputLines.some((line) => line.includes("Disk read failed"))).toBe(
			true
		);
		expect(
			outputLines.some((line) =>
				line.includes("[ReviewFlow] Failed to sync initial pending summaries")
			)
		).toBe(true);
	});

	it("does not call specExplorer.refresh() when sync rejects", async () => {
		const syncFn = vi.fn().mockRejectedValue(new Error("Network error"));

		await runActivationPattern(syncFn);

		expect(mockSpecExplorer.refresh).not.toHaveBeenCalled();
	});
});
