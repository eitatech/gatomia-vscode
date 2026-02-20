/**
 * Unit Tests for KnownAgentPreferencesService (T077)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * @see src/features/hooks/services/known-agent-preferences-service.ts
 * @feature 001-hooks-refactor Phase 8
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { KnownAgentId } from "../../../../../src/features/hooks/services/known-agent-catalog";
import {
	KnownAgentPreferencesService,
	KNOWN_AGENTS_PREFS_KEY,
} from "../../../../../src/features/hooks/services/known-agent-preferences-service";

// ---------------------------------------------------------------------------
// Mock vscode.ExtensionContext
// ---------------------------------------------------------------------------

function makeContext(initial: Record<string, unknown> = {}): {
	globalState: {
		get: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
} {
	const store = { ...initial };
	return {
		globalState: {
			get: vi.fn((key: string, defaultValue?: unknown) =>
				key in store ? store[key] : defaultValue
			),
			update: vi.fn((key: string, value: unknown) => {
				store[key] = value;
				return Promise.resolve();
			}),
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KnownAgentPreferencesService", () => {
	let ctx: ReturnType<typeof makeContext>;
	let service: KnownAgentPreferencesService;

	beforeEach(() => {
		ctx = makeContext();
		service = new KnownAgentPreferencesService(ctx as never);
	});

	describe("KNOWN_AGENTS_PREFS_KEY", () => {
		it("is a non-empty string constant", () => {
			expect(KNOWN_AGENTS_PREFS_KEY).toBeTruthy();
			expect(typeof KNOWN_AGENTS_PREFS_KEY).toBe("string");
		});
	});

	describe("getEnabledAgents()", () => {
		it("returns an empty array when no prefs are stored", () => {
			const result = service.getEnabledAgents();
			expect(result).toEqual([]);
		});

		it("returns stored enabled agents", () => {
			ctx = makeContext({
				[KNOWN_AGENTS_PREFS_KEY]: ["gemini", "opencode"] as KnownAgentId[],
			});
			service = new KnownAgentPreferencesService(ctx as never);
			const result = service.getEnabledAgents();
			expect(result).toEqual(["gemini", "opencode"]);
		});

		it("returns an empty array when stored value is not an array", () => {
			ctx = makeContext({ [KNOWN_AGENTS_PREFS_KEY]: "not-an-array" });
			service = new KnownAgentPreferencesService(ctx as never);
			const result = service.getEnabledAgents();
			expect(result).toEqual([]);
		});
	});

	describe("setEnabledAgents()", () => {
		it("persists the enabled agents list to globalState", async () => {
			await service.setEnabledAgents(["github-copilot", "gemini"]);
			expect(ctx.globalState.update).toHaveBeenCalledWith(
				KNOWN_AGENTS_PREFS_KEY,
				["github-copilot", "gemini"]
			);
		});

		it("persists an empty array", async () => {
			await service.setEnabledAgents([]);
			expect(ctx.globalState.update).toHaveBeenCalledWith(
				KNOWN_AGENTS_PREFS_KEY,
				[]
			);
		});
	});

	describe("toggleAgent()", () => {
		it("adds an agent when it was not enabled", async () => {
			await service.toggleAgent("gemini", true);
			const enabled = service.getEnabledAgents();
			expect(enabled).toContain("gemini");
		});

		it("removes an agent when disabled", async () => {
			ctx = makeContext({ [KNOWN_AGENTS_PREFS_KEY]: ["gemini", "opencode"] });
			service = new KnownAgentPreferencesService(ctx as never);
			await service.toggleAgent("gemini", false);
			const enabled = service.getEnabledAgents();
			expect(enabled).not.toContain("gemini");
			expect(enabled).toContain("opencode");
		});

		it("does not duplicate an already-enabled agent", async () => {
			ctx = makeContext({ [KNOWN_AGENTS_PREFS_KEY]: ["gemini"] });
			service = new KnownAgentPreferencesService(ctx as never);
			await service.toggleAgent("gemini", true);
			const enabled = service.getEnabledAgents();
			expect(enabled.filter((id) => id === "gemini")).toHaveLength(1);
		});

		it("is a no-op when disabling an agent that was not enabled", async () => {
			await service.toggleAgent("opencode", false);
			const enabled = service.getEnabledAgents();
			expect(enabled).toEqual([]);
		});

		it("persists changes via globalState.update", async () => {
			await service.toggleAgent("kimi", true);
			expect(ctx.globalState.update).toHaveBeenCalledWith(
				KNOWN_AGENTS_PREFS_KEY,
				expect.arrayContaining(["kimi"])
			);
		});
	});

	describe("isAgentEnabled()", () => {
		it("returns true for an enabled agent", () => {
			ctx = makeContext({ [KNOWN_AGENTS_PREFS_KEY]: ["opencode"] });
			service = new KnownAgentPreferencesService(ctx as never);
			expect(service.isAgentEnabled("opencode")).toBe(true);
		});

		it("returns false for an agent not in the enabled list", () => {
			expect(service.isAgentEnabled("opencode")).toBe(false);
		});
	});
});
