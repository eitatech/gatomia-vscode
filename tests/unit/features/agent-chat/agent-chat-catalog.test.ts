/**
 * AgentChatCatalog projection tests.
 *
 * Verifies that the sidebar catalogue surfaces ACP providers + workspace
 * agent files in the shape the React picker expects, including the
 * availability classification used to disable unreachable providers.
 */

import { describe, expect, it } from "vitest";
import { buildAgentChatCatalog } from "../../../../src/features/agent-chat/agent-chat-catalog";

interface FakeProviderDescriptor {
	readonly id: string;
	readonly displayName: string;
	readonly description?: string;
	readonly source?: "built-in" | "local" | "remote";
	readonly spawnCommand: string;
	readonly spawnArgs: string[];
	readonly installUrl?: string;
}

function makeProviderRegistry(descriptors: FakeProviderDescriptor[]): {
	list(): FakeProviderDescriptor[];
} {
	return { list: () => descriptors };
}

function makeAgentRegistry(
	entries: Array<{
		id: string;
		displayName: string;
		description?: string;
		source: "file" | "extension";
		sourcePath?: string;
		available: boolean;
	}>
): { getAllAgents(): typeof entries } {
	return { getAllAgents: () => entries };
}

describe("buildAgentChatCatalog", () => {
	it("returns empty lists when no sources are wired", () => {
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: null,
			agentRegistry: null,
		});
		expect(catalog.providers).toHaveLength(0);
		expect(catalog.agentFiles).toHaveLength(0);
	});

	it("classifies built-in providers as installed and enabled", () => {
		const acpProviderRegistry = makeProviderRegistry([
			{
				id: "claude-code",
				displayName: "Claude Code",
				description: "Anthropic CLI",
				source: "built-in",
				spawnCommand: "claude-code",
				spawnArgs: [],
			},
		]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: acpProviderRegistry as never,
			agentRegistry: null,
		});
		expect(catalog.providers).toHaveLength(1);
		const provider = catalog.providers[0];
		expect(provider).toMatchObject({
			id: "claude-code",
			displayName: "Claude Code",
			availability: "installed",
			enabled: true,
			source: "built-in",
		});
	});

	it("flags npx-spawned remote providers as available-via-npx", () => {
		const acpProviderRegistry = makeProviderRegistry([
			{
				id: "opencode",
				displayName: "opencode",
				source: "remote",
				spawnCommand: "npx",
				spawnArgs: ["-y", "@some/opencode-acp"],
			},
		]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: acpProviderRegistry as never,
			agentRegistry: null,
		});
		expect(catalog.providers[0]).toMatchObject({
			availability: "available-via-npx",
			enabled: true,
			npxPackage: "@some/opencode-acp",
		});
	});

	it("disables remote providers without an npx hint", () => {
		const acpProviderRegistry = makeProviderRegistry([
			{
				id: "custom-bin",
				displayName: "Custom Binary",
				source: "remote",
				spawnCommand: "custom-bin",
				spawnArgs: [],
				installUrl: "https://example.com/install",
			},
		]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: acpProviderRegistry as never,
			agentRegistry: null,
		});
		expect(catalog.providers[0]).toMatchObject({
			availability: "install-required",
			enabled: false,
			installUrl: "https://example.com/install",
		});
	});

	it("only surfaces available agent-file entries", () => {
		const agentRegistry = makeAgentRegistry([
			{
				id: "available",
				displayName: "Available",
				source: "file",
				sourcePath: "/abs/path.md",
				available: true,
			},
			{
				id: "missing",
				displayName: "Missing",
				source: "file",
				available: false,
			},
		]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: null,
			agentRegistry: agentRegistry as never,
		});
		expect(catalog.agentFiles).toHaveLength(1);
		expect(catalog.agentFiles[0]).toMatchObject({
			id: "available",
			displayName: "Available",
			absolutePath: "/abs/path.md",
		});
	});

	it("excludes extension-sourced chat participants from the agent-file picker", () => {
		// Regression: GitHub Copilot Chat declares several
		// `chatParticipants` in its manifest with the same
		// `displayName` (e.g. "GitHubCopilot (Extension)"), and the
		// AgentRegistry surfaces all of them. Those are not
		// user-authored AGENT.md presets — the picker showed a wall
		// of duplicate "Extension" rows instead of the workspace's
		// `.github/agents/*.agent.md` files.
		const agentRegistry = makeAgentRegistry([
			{
				id: "file:my-preset",
				displayName: "My Preset",
				source: "file",
				sourcePath: "/abs/path.md",
				available: true,
			},
			{
				id: "extension:GitHub.copilot-chat:editor",
				displayName: "GitHubCopilot (Extension)",
				description: "Ask or edit in context",
				source: "extension",
				available: true,
			},
			{
				id: "extension:GitHub.copilot-chat:workspace",
				displayName: "GitHubCopilot (Extension)",
				description: "Edit files in your workspace",
				source: "extension",
				available: true,
			},
		]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: null,
			agentRegistry: agentRegistry as never,
		});
		expect(catalog.agentFiles).toHaveLength(1);
		expect(catalog.agentFiles[0]?.id).toBe("file:my-preset");
		expect(catalog.agentFiles.every((entry) => entry.source === "file")).toBe(
			true
		);
	});

	it("downgrades a local provider to install-required when the probe says missing", () => {
		// Regression: opencode/junie were marked "installed" purely because
		// their descriptor.source was "local" — even when their binary was
		// absent. Now the probe cache wins.
		const acpProviderRegistry = makeProviderRegistry([
			{
				id: "junie",
				displayName: "JetBrains Junie",
				source: "local",
				spawnCommand: "junie",
				spawnArgs: ["--acp=true"],
			},
		]);
		const probeCache = new Map([["junie", { installed: false }]]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: acpProviderRegistry as never,
			agentRegistry: null,
			probeCache,
		});
		expect(catalog.providers[0]).toMatchObject({
			availability: "install-required",
			enabled: false,
		});
	});

	it("upgrades a remote provider to installed when the probe says installed", () => {
		// Symmetric regression: a remote-registry entry whose binary is
		// already on the user's PATH should not be flagged as "install
		// required" — the probe cache promotes it to "installed".
		const acpProviderRegistry = makeProviderRegistry([
			{
				id: "custom-bin",
				displayName: "Custom Binary",
				source: "remote",
				spawnCommand: "custom-bin",
				spawnArgs: [],
			},
		]);
		const probeCache = new Map([["custom-bin", { installed: true }]]);
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: acpProviderRegistry as never,
			agentRegistry: null,
			probeCache,
		});
		expect(catalog.providers[0]).toMatchObject({
			availability: "installed",
			enabled: true,
		});
	});

	it("survives an agent registry that throws", () => {
		const throwingRegistry = {
			getAllAgents: () => {
				throw new Error("registry not ready");
			},
		};
		const catalog = buildAgentChatCatalog({
			acpProviderRegistry: null,
			agentRegistry: throwingRegistry as never,
		});
		expect(catalog.agentFiles).toHaveLength(0);
	});
});
