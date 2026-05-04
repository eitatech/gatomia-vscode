/**
 * diff-stats — unit coverage for the lightweight `+N -M` counter used
 * by the tool-call diff cards.
 */

import { describe, expect, it } from "vitest";
import { computeDiffStats } from "../../../../src/features/agent-chat/diff-stats";

describe("computeDiffStats", () => {
	it("returns zeros when both sides are empty", () => {
		expect(computeDiffStats({ oldText: "", newText: "" })).toEqual({
			linesAdded: 0,
			linesRemoved: 0,
		});
	});

	it("treats a missing oldText as a brand-new file (every line added)", () => {
		const stats = computeDiffStats({
			oldText: null,
			newText: "alpha\nbeta\ngamma",
		});
		expect(stats).toEqual({ linesAdded: 3, linesRemoved: 0 });
	});

	it("counts lines added by an append-only edit", () => {
		const stats = computeDiffStats({
			oldText: "first\nsecond",
			newText: "first\nsecond\nthird",
		});
		expect(stats).toEqual({ linesAdded: 1, linesRemoved: 0 });
	});

	it("counts lines removed when the new text drops content", () => {
		const stats = computeDiffStats({
			oldText: "first\nsecond\nthird",
			newText: "first",
		});
		expect(stats).toEqual({ linesAdded: 0, linesRemoved: 2 });
	});

	it("reports both sides for a swap edit", () => {
		const stats = computeDiffStats({
			oldText: "old line\nshared",
			newText: "new line\nshared",
		});
		expect(stats).toEqual({ linesAdded: 1, linesRemoved: 1 });
	});

	it("ignores trailing newline differences", () => {
		// Saving the same content with a trailing newline should not
		// be reported as +1 -1 in the card.
		const stats = computeDiffStats({
			oldText: "value",
			newText: "value\n",
		});
		expect(stats).toEqual({ linesAdded: 0, linesRemoved: 0 });
	});

	it("normalises CRLF and LF line endings", () => {
		const stats = computeDiffStats({
			oldText: "alpha\r\nbeta\r\n",
			newText: "alpha\nbeta\n",
		});
		expect(stats).toEqual({ linesAdded: 0, linesRemoved: 0 });
	});

	it("counts duplicate lines correctly when only one copy was edited", () => {
		const stats = computeDiffStats({
			oldText: "x\nx\ny",
			newText: "x\ny",
		});
		expect(stats).toEqual({ linesAdded: 0, linesRemoved: 1 });
	});
});
