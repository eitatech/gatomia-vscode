import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	getSpecState,
	updateSpecStatus,
	sendToReview,
} from "../../../src/features/spec/review-flow/state";
import { logSpecStatusChange } from "../../../src/features/spec/review-flow/telemetry";
import type { Specification } from "../../../src/features/spec/review-flow/types";

// Mock telemetry to track latency
vi.mock("../../../src/features/spec/review-flow/telemetry", () => ({
	logSpecStatusChange: vi.fn(),
	logSendToReviewAction: vi.fn(),
	logOutstandingBlockerCount: vi.fn(),
}));

describe("Review Flow Latency Tests", () => {
	const specId = "spec-latency-test";

	beforeEach(() => {
		vi.useFakeTimers();
		// Setup initial state
		const mockSpec: Specification = {
			id: specId,
			title: "Latency Test Spec",
			owner: "tester",
			status: "current",
			completedAt: null,
			updatedAt: new Date(),
			links: { specPath: "/path/to/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};
		// We need a way to inject state, but getSpecState reads from file/cache.
		// For integration tests, we rely on the state module's internal cache or file I/O.
		// Since we can't easily inject into the private cache of the module without exporting a setter,
		// we'll assume the state module has a way to handle this or we mock the storage layer.
		// BUT, since we are writing an integration test, we should probably interact with the public API.
		// Let's assume for this test we can use a helper or just rely on the fact that getSpecState might return null
		// and we need to handle that.
		// HOWEVER, the state module in previous tasks had a `__testInitSpec` or similar if we added it,
		// or we can mock `fs` to provide the initial state.

		// Let's try to mock the storage part of state.ts or use the __testInitSpec if it exists.
		// Looking at previous file reads, `__testInitSpec` WAS added in `state.ts`.
		// Let's import it dynamically or assume it's available (if exported).
		// If not exported, we might need to rely on mocking `readFileSync`.
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	// Since we can't easily import __testInitSpec if it's not in the public type definition or exported in the file we read,
	// let's check `state.ts` exports again.
	// I recall seeing `export function __testInitSpec(spec: Specification): void { ... }` in the read_file output for state.ts.

	it("SC-001: Spec status transition should take less than 2 seconds", async () => {
		// Import the test helper dynamically to avoid TS issues if not in type defs (though it should be if exported)
		const { __testInitSpec } = await import(
			"../../../src/features/spec/review-flow/state"
		);

		const mockSpec: Specification = {
			id: specId,
			title: "Latency Test Spec",
			owner: "tester",
			status: "current",
			completedAt: null,
			updatedAt: new Date(),
			links: { specPath: "/path/to/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		__testInitSpec(mockSpec);

		const start = performance.now();

		// Action: Send to Review
		const result = sendToReview(specId);

		const end = performance.now();
		const duration = end - start;

		expect(result).not.toBeNull();
		expect(result?.status).toBe("review");

		// Assert SC-001: < 2000ms
		// In a unit/integration test with mocks, this will be near-instant,
		// but this verifies no artificial delays or heavy blocking ops are introduced.
		expect(duration).toBeLessThan(2000);

		// Verify telemetry was called
		expect(logSpecStatusChange).toHaveBeenCalledWith(
			specId,
			"current",
			"review"
		);
	});

	it("SC-006: Data consistency check - no data lost during rapid transitions", async () => {
		const { __testInitSpec } = await import(
			"../../../src/features/spec/review-flow/state"
		);

		const mockSpec: Specification = {
			id: specId,
			title: "Consistency Test Spec",
			owner: "tester",
			status: "current",
			completedAt: null,
			updatedAt: new Date(),
			links: { specPath: "/path/to/spec.md" },
			pendingTasks: 0,
			pendingChecklistItems: 0,
		};

		__testInitSpec(mockSpec);

		// Rapid transitions
		sendToReview(specId); // current -> review
		updateSpecStatus(specId, "reopened"); // review -> reopened
		updateSpecStatus(specId, "review"); // reopened -> review

		const finalState = getSpecState(specId);

		expect(finalState?.status).toBe("review");
		expect(finalState?.links.specPath).toBe("/path/to/spec.md"); // Data preserved
	});
});
