/**
 * diff-stats — pure helpers that compute "+N -M" hints for the
 * tool-call diff cards (Phase 3 redesign).
 *
 * Why a custom helper instead of pulling `diff` or `jsdiff`? The card
 * only needs the *count* of added/removed lines for a glance summary.
 * Reaching for a full Myers algorithm to get those two numbers would
 * pull a sizeable dependency into the extension bundle. This module
 * trades a bit of accuracy on whitespace-only edits for a 30-line
 * implementation with zero deps.
 *
 * The algorithm:
 *   1. Split both texts on `\n`.
 *   2. For each unique line, count how many copies appear in each side.
 *   3. Lines present more times in `newText` than `oldText` are
 *      "added"; the reverse is "removed".
 *
 * That count matches what `git diff --shortstat` reports for clean
 * insert/delete edits, the dominant case for AI tool calls. It will
 * over-count moves (a line moved within the file shows up as one
 * added + one removed) which mirrors `git`'s default behaviour.
 */

export interface DiffStats {
	/** Number of lines that exist in `newText` but not in `oldText`. */
	linesAdded: number;
	/** Number of lines that existed in `oldText` but were removed. */
	linesRemoved: number;
}

export interface DiffInput {
	/** Pre-edit content. `null` / `undefined` means the file is new. */
	oldText?: string | null;
	/** Post-edit content. Always present. */
	newText: string;
}

/**
 * Compute add/remove line counts between `oldText` and `newText`.
 * Treats `\r\n` and `\n` as equivalent line terminators so DOS-style
 * inputs don't skew the numbers.
 */
export function computeDiffStats(input: DiffInput): DiffStats {
	const newLines = splitLines(input.newText);
	const oldLines = splitLines(input.oldText ?? "");

	if (input.oldText == null || input.oldText.length === 0) {
		// New file — every non-empty line is an addition.
		return { linesAdded: newLines.length, linesRemoved: 0 };
	}

	const newCounts = countLines(newLines);
	const oldCounts = countLines(oldLines);

	let linesAdded = 0;
	let linesRemoved = 0;

	for (const [line, count] of newCounts) {
		const previous = oldCounts.get(line) ?? 0;
		if (count > previous) {
			linesAdded += count - previous;
		}
	}

	for (const [line, count] of oldCounts) {
		const next = newCounts.get(line) ?? 0;
		if (count > next) {
			linesRemoved += count - next;
		}
	}

	return { linesAdded, linesRemoved };
}

function splitLines(text: string): string[] {
	if (text.length === 0) {
		return [];
	}
	// Normalise CRLF to LF so identical content with different line
	// endings does not register as added/removed lines.
	const normalised = text.replace(/\r\n?/g, "\n");
	const lines = normalised.split("\n");
	// Trim a trailing empty string produced by a terminal newline so
	// `"foo\n"` and `"foo"` are treated as equivalent — that avoids
	// the diff card flickering "+1 -1" when the agent only re-saved
	// the file with the same content.
	if (lines.length > 0 && lines.at(-1) === "") {
		lines.pop();
	}
	return lines;
}

function countLines(lines: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const line of lines) {
		counts.set(line, (counts.get(line) ?? 0) + 1);
	}
	return counts;
}
