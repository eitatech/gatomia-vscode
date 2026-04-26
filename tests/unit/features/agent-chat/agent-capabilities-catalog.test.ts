/**
 * AgentCapabilitiesCatalog unit tests (T050).
 *
 * TDD (Constitution III): red before T057.
 *
 * Scope per contracts/agent-capabilities-contract.md §5:
 *   1. Shape stability — every entry has a non-empty string `id`; `capabilities`
 *      (when present) conforms to `KnownAgentCapabilities`.
 *   2. Snapshot — the set of seeded provider ids is stable (adding a new
 *      entry requires an intentional snapshot update).
 *   3. Resolver — the resolver returns the expected `ResolvedCapabilities`
 *      for each seeded entry when the agent reports nothing.
 */

import { describe, expect, it } from "vitest";
import {
	AGENT_CAPABILITIES_CATALOG,
	lookupCatalogEntry,
	resolveFromCatalog,
} from "../../../../src/features/agent-chat/agent-capabilities-catalog";
import type {
	ModeDescriptor,
	ModelDescriptor,
} from "../../../../src/features/agent-chat/types";

const VALID_INVOCATIONS: readonly ModelDescriptor["invocation"][] = [
	"initial-prompt",
	"cli-flag",
];

function describeInvalidModeOrModel(
	modes: readonly ModeDescriptor[],
	models: readonly ModelDescriptor[]
): string | null {
	for (const mode of modes) {
		if (mode.id.length === 0 || mode.displayName.length === 0) {
			return `mode ${JSON.stringify(mode)} missing id/displayName`;
		}
	}
	for (const model of models) {
		if (model.id.length === 0 || model.displayName.length === 0) {
			return `model ${JSON.stringify(model)} missing id/displayName`;
		}
		if (!VALID_INVOCATIONS.includes(model.invocation)) {
			return `model ${model.id} has invalid invocation ${String(model.invocation)}`;
		}
	}
	return null;
}

describe("AGENT_CAPABILITIES_CATALOG", () => {
	it("every entry has a non-empty id", () => {
		expect(AGENT_CAPABILITIES_CATALOG.length).toBeGreaterThan(0);
		for (const entry of AGENT_CAPABILITIES_CATALOG) {
			expect(typeof entry.id).toBe("string");
			expect(entry.id.length).toBeGreaterThan(0);
		}
	});

	it("entry capabilities conform to the documented shape", () => {
		for (const entry of AGENT_CAPABILITIES_CATALOG) {
			if (!entry.capabilities) {
				continue;
			}
			expect(Array.isArray(entry.capabilities.modes)).toBe(true);
			expect(Array.isArray(entry.capabilities.models)).toBe(true);
			expect(typeof entry.capabilities.acceptsFollowUp).toBe("boolean");
			const badShape = describeInvalidModeOrModel(
				entry.capabilities.modes,
				entry.capabilities.models
			);
			expect(badShape, `entry ${entry.id}: ${badShape ?? "ok"}`).toBeNull();
		}
	});

	it("exposes stable ids (snapshot)", () => {
		// Any intentional change to the seed list requires updating this
		// snapshot (that's the point of the test: it's a merge gate).
		// Ids MUST match `AcpProviderDescriptor.id` from the
		// known-agent catalog so `lookupCatalogEntry` resolves.
		const ids = AGENT_CAPABILITIES_CATALOG.map((entry) => entry.id).sort();
		expect(ids).toMatchInlineSnapshot(`
			[
			  "claude-acp",
			  "devin",
			  "gemini",
			  "github-copilot",
			  "junie",
			  "opencode",
			]
		`);
	});
});

describe("lookupCatalogEntry", () => {
	it("returns undefined for unknown ids", () => {
		expect(lookupCatalogEntry("nope-not-a-real-agent")).toBeUndefined();
	});

	it("returns the entry for every seeded id", () => {
		for (const entry of AGENT_CAPABILITIES_CATALOG) {
			expect(lookupCatalogEntry(entry.id)).toStrictEqual(entry);
		}
	});

	it("opencode entry seeds at least one model so the picker dropdown is not empty", () => {
		// Regression: the agent had `models: []` which made the model
		// dropdown render as an empty select after the user picked
		// "OpenCode" in the chat composer. The CLI accepts any
		// `<provider>/<model>` ID; we seed the most common providers.
		const entry = lookupCatalogEntry("opencode");
		expect(entry).toBeDefined();
		expect(entry?.capabilities?.models.length).toBeGreaterThan(0);
		// Sanity-check the shape so a future refactor cannot quietly
		// drop the provider/model prefix that OpenCode requires on the
		// CLI flag.
		const ids = entry?.capabilities?.models.map((m) => m.id) ?? [];
		expect(ids.every((id) => id.includes("/"))).toBe(true);
	});

	it("claude-acp entry resolves under the same id known-agents register", () => {
		// Regression: the catalog was keyed under `claude-code` but
		// the runtime registry keys it under `claude-acp` (the
		// `@zed-industries/claude-agent-acp` package). The mismatch
		// made the lookup miss and the model dropdown stayed empty.
		const entry = lookupCatalogEntry("claude-acp");
		expect(entry).toBeDefined();
		expect(entry?.capabilities?.models.length).toBeGreaterThan(0);
		// Belt-and-suspenders: the legacy id MUST NOT be re-introduced.
		expect(lookupCatalogEntry("claude-code")).toBeUndefined();
	});

	it("junie entry exists so the picker dropdown is populated", () => {
		// Regression: the JetBrains Junie agent (registry id `junie`)
		// had no entry here. After the fix the catalog seeds at least
		// one model so the picker renders a non-empty select.
		const entry = lookupCatalogEntry("junie");
		expect(entry).toBeDefined();
		expect(entry?.capabilities?.models.length).toBeGreaterThan(0);
	});
});

describe("resolveFromCatalog", () => {
	it("returns { source: 'none' } for unknown agents", () => {
		const resolved = resolveFromCatalog("nope-not-a-real-agent");
		expect(resolved).toStrictEqual({ source: "none" });
	});

	it("returns { source: 'none' } for a catalog entry without capabilities", () => {
		const entryWithoutCaps = AGENT_CAPABILITIES_CATALOG.find(
			(entry) => entry.capabilities === undefined
		);
		if (!entryWithoutCaps) {
			// If every entry seeds capabilities this assertion is moot, but the
			// resolver algorithm still MUST handle the case — verify with a
			// synthetic lookup miss.
			expect(resolveFromCatalog("synthetic-miss")).toStrictEqual({
				source: "none",
			});
			return;
		}
		expect(resolveFromCatalog(entryWithoutCaps.id)).toStrictEqual({
			source: "none",
		});
	});

	it("returns { source: 'catalog', ... } for every entry that seeds capabilities", () => {
		for (const entry of AGENT_CAPABILITIES_CATALOG) {
			if (!entry.capabilities) {
				continue;
			}
			const resolved = resolveFromCatalog(entry.id);
			expect(resolved).toStrictEqual({
				source: "catalog",
				modes: entry.capabilities.modes,
				models: entry.capabilities.models,
				acceptsFollowUp: entry.capabilities.acceptsFollowUp,
			});
		}
	});
});
