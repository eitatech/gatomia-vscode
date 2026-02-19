/**
 * Unit Tests for AcpAgentDiscoveryService — Phase 8 merged discovery (T081)
 *
 * TDD: tests written BEFORE implementation. All tests should FAIL initially.
 * Tests cover the new constructor signature that accepts KnownAgentDetector
 * and KnownAgentPreferencesService, and the merged discoverAgents() behavior.
 *
 * @see src/features/hooks/services/acp-agent-discovery-service.ts
 * @feature 001-hooks-refactor Phase 8
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock node:fs/promises (for workspace scan)
// ---------------------------------------------------------------------------

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
	mockReaddir: vi.fn(),
	mockReadFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	default: { readdir: mockReaddir, readFile: mockReadFile },
	readdir: mockReaddir,
	readFile: mockReadFile,
}));

// ---------------------------------------------------------------------------
// Mock gray-matter
// ---------------------------------------------------------------------------

const { mockMatter } = vi.hoisted(() => ({
	mockMatter: vi.fn(),
}));

vi.mock("gray-matter", () => ({
	default: mockMatter,
}));

import { AcpAgentDiscoveryService } from "../../../../../src/features/hooks/services/acp-agent-discovery-service";
import type { IKnownAgentPreferencesService } from "../../../../../src/features/hooks/services/known-agent-preferences-service";
import type { KnownAgentDetector } from "../../../../../src/features/hooks/services/known-agent-detector";
import type { KnownAgentId } from "../../../../../src/features/hooks/services/known-agent-catalog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGrayMatterResult(data: Record<string, unknown>) {
	return { data, content: "" };
}

function makePrefsService(
	enabled: KnownAgentId[] = []
): IKnownAgentPreferencesService {
	return {
		getEnabledAgents: vi.fn(() => enabled),
		setEnabledAgents: vi.fn(),
		toggleAgent: vi.fn(),
		isAgentEnabled: vi.fn((id: KnownAgentId) => enabled.includes(id)),
	};
}

function makeDetector(detectedTargets: string[] = []): KnownAgentDetector {
	return {
		isInstalledAny: vi.fn(async (strategies: { target: string }[]) =>
			strategies.some((s) => detectedTargets.includes(s.target))
		),
	} as unknown as KnownAgentDetector;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AcpAgentDiscoveryService (Phase 8 — merged discovery)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: workspace directory does not exist
		mockReaddir.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" })
		);
	});

	describe("constructor with new dependencies", () => {
		it("accepts KnownAgentDetector and IKnownAgentPreferencesService", () => {
			const prefs = makePrefsService();
			const detector = makeDetector();
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);
			expect(service).toBeInstanceOf(AcpAgentDiscoveryService);
		});

		it("works without optional dependencies (backward-compat)", () => {
			const service = new AcpAgentDiscoveryService("/root");
			expect(service).toBeInstanceOf(AcpAgentDiscoveryService);
		});
	});

	describe("discoverAgents() — known agent merging", () => {
		it("returns known agents when user has enabled+detected ones", async () => {
			// User enabled "gemini", detector finds it on npm global
			const prefs = makePrefsService(["gemini"]);
			const detector = makeDetector(["@google/gemini-cli"]);
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			const agents = await service.discoverAgents();
			const known = agents.filter((a) => a.source === "known");
			expect(known).toHaveLength(1);
			expect(known[0].agentDisplayName).toBe("Gemini CLI");
			expect(known[0].agentCommand).toContain("gemini-cli");
			expect(known[0].knownAgentId).toBe("gemini");
		});

		it("does not include known agents that are enabled but NOT detected", async () => {
			const prefs = makePrefsService(["opencode"]);
			const detector = makeDetector([]); // opencode not found on PATH
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			const agents = await service.discoverAgents();
			const known = agents.filter((a) => a.source === "known");
			expect(known).toHaveLength(0);
		});

		it("does not include known agents that are detected but NOT enabled", async () => {
			const prefs = makePrefsService([]); // nothing enabled
			const detector = makeDetector(["opencode"]); // but it's on PATH
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			const agents = await service.discoverAgents();
			const known = agents.filter((a) => a.source === "known");
			expect(known).toHaveLength(0);
		});

		it("merges workspace agents and known agents", async () => {
			// Set up workspace agent
			mockReaddir.mockResolvedValue(["my-agent.agent.md"]);
			mockReadFile.mockResolvedValue("---");
			mockMatter.mockReturnValue(
				makeGrayMatterResult({ acp: true, agentCommand: "npx my-agent --acp" })
			);
			// Set up known agent
			const prefs = makePrefsService(["github-copilot"]);
			const detector = makeDetector(["@github/copilot-language-server"]);
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			const agents = await service.discoverAgents();
			const sources = agents.map((a) => a.source);
			expect(sources).toContain("workspace");
			expect(sources).toContain("known");
		});

		it("returns workspace agents only when no known agents are enabled", async () => {
			mockReaddir.mockResolvedValue(["my-agent.agent.md"]);
			mockReadFile.mockResolvedValue("---");
			mockMatter.mockReturnValue(
				makeGrayMatterResult({ acp: true, agentCommand: "npx my-agent --acp" })
			);
			const prefs = makePrefsService([]);
			const detector = makeDetector([]);
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			const agents = await service.discoverAgents();
			expect(agents).toHaveLength(1);
			expect(agents[0].source).toBe("workspace");
		});

		it("never throws when known agent detection fails", async () => {
			const prefs = makePrefsService(["opencode"]);
			const detector = {
				isInstalledAny: vi
					.fn()
					.mockRejectedValue(new Error("detection failed")),
			} as unknown as KnownAgentDetector;
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			await expect(service.discoverAgents()).resolves.not.toThrow();
		});

		it("returns multiple known agents when multiple are enabled and detected", async () => {
			const prefs = makePrefsService(["gemini", "opencode"]);
			const detector = makeDetector(["@google/gemini-cli", "opencode"]);
			const service = new AcpAgentDiscoveryService("/root", detector, prefs);

			const agents = await service.discoverAgents();
			const known = agents.filter((a) => a.source === "known");
			expect(known).toHaveLength(2);
		});
	});
});
