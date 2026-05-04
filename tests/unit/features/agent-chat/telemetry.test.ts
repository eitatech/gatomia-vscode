/**
 * Telemetry coverage test (T078, spec 018).
 *
 * Every event name in `AGENT_CHAT_TELEMETRY_EVENTS` MUST have at least one
 * real call site outside `telemetry.ts` itself. This guards against:
 *
 *   - adding a new event name without wiring it, and
 *   - removing the last call site without also removing the declaration.
 *
 * The canonical list lives in `plan.md` Constitution row IV.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_CHAT_TELEMETRY_EVENTS } from "../../../../src/features/agent-chat/telemetry";

// Root of the extension source tree.
const SRC_ROOT = join(__dirname, "..", "..", "..", "..", "src");

// Files that contain **declarations** only (not call sites) and therefore
// must not count toward "has a call site".
const DECLARATION_FILES = new Set<string>(["telemetry.ts"]);

function isScanTarget(file: string): boolean {
	return file.endsWith(".ts") || file.endsWith(".tsx");
}

function walk(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			results.push(...walk(full));
		} else if (stats.isFile() && isScanTarget(entry)) {
			results.push(full);
		}
	}
	return results;
}

// Walk src/ once and read every .ts/.tsx file so the per-event assertions
// below only do string `.includes` checks.
const SOURCE_FILES: Array<{ path: string; body: string; baseName: string }> =
	walk(SRC_ROOT).map((p) => ({
		path: p,
		body: readFileSync(p, "utf8"),
		baseName: p.split("/").at(-1) ?? "",
	}));

function findCallSites(eventName: string): string[] {
	return SOURCE_FILES.filter(
		(f) =>
			!DECLARATION_FILES.has(f.baseName) &&
			// Either a literal string match OR a reference to the constant.
			(f.body.includes(`"${eventName}"`) || f.body.includes(`'${eventName}'`))
	).map((f) => f.path);
}

function findConstantRefs(constantSuffix: string): string[] {
	return SOURCE_FILES.filter(
		(f) =>
			!DECLARATION_FILES.has(f.baseName) &&
			f.body.includes(`AGENT_CHAT_TELEMETRY_EVENTS.${constantSuffix}`)
	).map((f) => f.path);
}

// ---------------------------------------------------------------------------

describe("agent-chat telemetry events (T078)", () => {
	it("every declared event has at least one call site outside telemetry.ts", () => {
		const missing: string[] = [];
		for (const [key, eventName] of Object.entries(
			AGENT_CHAT_TELEMETRY_EVENTS
		)) {
			const literalHits = findCallSites(eventName);
			const constantHits = findConstantRefs(key);
			if (literalHits.length === 0 && constantHits.length === 0) {
				missing.push(`${key} (${eventName})`);
			}
		}
		expect(missing, "events without call sites").toEqual([]);
	});

	// Pin down the set of declared events so adding/removing one requires
	// touching this file, which is a human checkpoint against silent
	// churn.
	it("matches the canonical plan.md Constitution row IV enumeration", () => {
		expect(Object.values(AGENT_CHAT_TELEMETRY_EVENTS).sort()).toEqual(
			[
				"agent-chat.capabilities.resolved",
				"agent-chat.concurrent-cap.hit",
				"agent-chat.error",
				"agent-chat.panel.opened",
				"agent-chat.panel.reopened",
				"agent-chat.session.cancelled",
				"agent-chat.session.ended-by-shutdown",
				"agent-chat.session.follow-up-sent",
				"agent-chat.session.started",
				"agent-chat.session.streamed",
				"agent-chat.worktree.abandoned",
				"agent-chat.worktree.cleaned",
				"agent-chat.worktree.created",
				"agent-chat.worktree.failed",
			].sort()
		);
	});
});
