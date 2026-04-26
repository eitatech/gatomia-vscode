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
