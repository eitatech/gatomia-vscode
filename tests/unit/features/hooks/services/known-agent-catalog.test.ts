/**
 * Unit Tests for KnownAgentCatalog (T073)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 *
 * @see src/features/hooks/services/known-agent-catalog.ts
 * @feature 001-hooks-refactor Phase 8
 */

import { describe, expect, it } from "vitest";
import {
	KNOWN_AGENTS,
	getKnownAgent,
	type KnownAgentId,
	type KnownAgentEntry,
	type InstallCheckStrategy,
} from "../../../../../src/features/hooks/services/known-agent-catalog";

// ---------------------------------------------------------------------------
// Top-level regex constants (Constitution: no inline regex)
// ---------------------------------------------------------------------------
const INSTALL_STRATEGY_PATTERN = /^(npm-global|path)$/;

describe("KnownAgentCatalog", () => {
	describe("KNOWN_AGENTS catalog", () => {
		it("contains exactly 7 agents", () => {
			expect(KNOWN_AGENTS).toHaveLength(7);
		});

		it("contains claude-acp", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("claude-acp");
		});

		it("contains kimi", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("kimi");
		});

		it("contains gemini", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("gemini");
		});

		it("contains github-copilot", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("github-copilot");
		});

		it("contains codex-acp", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("codex-acp");
		});

		it("contains mistral-vibe", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("mistral-vibe");
		});

		it("contains opencode", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(ids).toContain("opencode");
		});

		it("every entry has a non-empty displayName", () => {
			for (const agent of KNOWN_AGENTS) {
				expect(
					agent.displayName,
					`agent ${agent.id} missing displayName`
				).toBeTruthy();
			}
		});

		it("every entry has a non-empty agentCommand", () => {
			for (const agent of KNOWN_AGENTS) {
				expect(
					agent.agentCommand,
					`agent ${agent.id} missing agentCommand`
				).toBeTruthy();
			}
		});

		it("every entry has at least one valid installChecks strategy", () => {
			for (const agent of KNOWN_AGENTS) {
				expect(
					agent.installChecks.length,
					`agent ${agent.id} must have at least one installChecks entry`
				).toBeGreaterThan(0);
				for (const check of agent.installChecks) {
					expect(
						check.strategy,
						`agent ${agent.id} installChecks entry missing strategy`
					).toMatch(INSTALL_STRATEGY_PATTERN);
					expect(
						check.target,
						`agent ${agent.id} installChecks entry missing target`
					).toBeTruthy();
				}
			}
		});

		it("all ids are unique", () => {
			const ids = KNOWN_AGENTS.map((a) => a.id);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe("individual agent entries", () => {
		it("claude-acp has npm-global check for @zed-industries/claude-agent-acp", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "claude-acp");
			const targets = agent?.installChecks.map((c) => c.target) ?? [];
			expect(targets).toContain("@zed-industries/claude-agent-acp");
			expect(agent?.agentCommand).toContain("claude-agent-acp");
		});

		it("gemini has a path check for 'gemini' binary and --experimental-acp flag", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "gemini");
			const pathChecks =
				agent?.installChecks.filter((c) => c.strategy === "path") ?? [];
			expect(pathChecks.some((c) => c.target === "gemini")).toBe(true);
			expect(agent?.agentCommand).toContain("--experimental-acp");
		});

		it("github-copilot has --acp flag in agentCommand", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "github-copilot");
			expect(agent?.installChecks.length).toBeGreaterThan(0);
			expect(agent?.agentCommand).toContain("--acp");
		});

		it("codex-acp uses npx @zed-industries/codex-acp as agentCommand and detects via npm-global or codex-acp binary", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "codex-acp");
			// agentCommand must use the Zed ACP wrapper, not 'codex --acp'
			expect(agent?.agentCommand).toContain("@zed-industries/codex-acp");
			// Detection: npm-global check for the wrapper package
			const npmChecks =
				agent?.installChecks.filter((c) => c.strategy === "npm-global") ?? [];
			expect(
				npmChecks.some((c) => c.target === "@zed-industries/codex-acp")
			).toBe(true);
			// Detection: path check for the standalone binary
			const pathChecks =
				agent?.installChecks.filter((c) => c.strategy === "path") ?? [];
			expect(pathChecks.some((c) => c.target === "codex-acp")).toBe(true);
		});

		it("kimi uses path strategy for 'kimi' binary", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "kimi");
			const pathChecks =
				agent?.installChecks.filter((c) => c.strategy === "path") ?? [];
			expect(pathChecks.some((c) => c.target === "kimi")).toBe(true);
			expect(agent?.agentCommand).toContain("kimi");
		});

		it("mistral-vibe uses path strategy for 'vibe-acp' binary", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "mistral-vibe");
			const pathChecks =
				agent?.installChecks.filter((c) => c.strategy === "path") ?? [];
			expect(pathChecks.some((c) => c.target === "vibe-acp")).toBe(true);
			expect(agent?.agentCommand).toContain("vibe-acp");
		});

		it("opencode uses path strategy for 'opencode' binary", () => {
			const agent = KNOWN_AGENTS.find((a) => a.id === "opencode");
			const pathChecks =
				agent?.installChecks.filter((c) => c.strategy === "path") ?? [];
			expect(pathChecks.some((c) => c.target === "opencode")).toBe(true);
			expect(agent?.agentCommand).toContain("opencode");
		});
	});

	describe("getKnownAgent", () => {
		it("returns the correct entry for a valid id", () => {
			const agent = getKnownAgent("gemini");
			expect(agent).toBeDefined();
			expect(agent?.id).toBe("gemini");
		});

		it("returns undefined for an unknown id", () => {
			const agent = getKnownAgent("nonexistent" as KnownAgentId);
			expect(agent).toBeUndefined();
		});
	});

	describe("type exports", () => {
		it("KnownAgentId covers all 7 agents", () => {
			// Compile-time check: these assignments must type-check
			const ids: KnownAgentId[] = [
				"claude-acp",
				"kimi",
				"gemini",
				"github-copilot",
				"codex-acp",
				"mistral-vibe",
				"opencode",
			];
			expect(ids).toHaveLength(7);
		});

		it("KnownAgentEntry has required fields", () => {
			const entry: KnownAgentEntry = {
				id: "opencode",
				displayName: "OpenCode",
				agentCommand: "opencode acp",
				installChecks: [{ strategy: "path", target: "opencode" }],
			};
			expect(entry.id).toBe("opencode");
		});

		it("InstallCheckStrategy covers both strategies", () => {
			const npm: InstallCheckStrategy = {
				strategy: "npm-global",
				target: "@foo/bar",
			};
			const path: InstallCheckStrategy = { strategy: "path", target: "foo" };
			expect(npm.strategy).toBe("npm-global");
			expect(path.strategy).toBe("path");
		});
	});
});
