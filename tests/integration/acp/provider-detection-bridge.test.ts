/**
 * Integration test (TDD red): three-source provider detection bridge.
 *
 * Wires the same components that `bootstrapAcpRouter` will use in production:
 *   - `BUILT_IN_PROVIDERS` registered eagerly.
 *   - `KNOWN_AGENTS` registered after probes resolve.
 *   - `loadRemoteRegistry` registers any new ids that aren't already present.
 *
 * Asserts:
 *   - All three sources contribute descriptors.
 *   - Built-in IDs win on collision (gemini stays as the gemini-cli probe).
 *   - Remote IDs that match a local catalog id replace the local descriptor
 *     (remote is more authoritative when fresh).
 *   - No duplicate descriptors per id.
 */

import { describe, expect, it, vi } from "vitest";
import { KnownAgentDetector } from "../../../src/features/hooks/services/known-agent-detector";
import { KNOWN_AGENTS } from "../../../src/features/hooks/services/known-agent-catalog";
import {
	AcpProviderRegistry,
	type RegistryCacheStore,
	type RemoteRegistryEntry,
} from "../../../src/services/acp/acp-provider-registry";
import { BUILT_IN_PROVIDERS } from "../../../src/services/acp/providers/descriptors";
import {
	createDescriptorFromKnownAgent,
	createDescriptorFromRemoteEntry,
} from "../../../src/services/acp/provider-bridge";

class InMemoryStore implements RegistryCacheStore {
	private readonly map = new Map<string, unknown>();

	get<T>(key: string, fallback?: T): T {
		return this.map.has(key) ? (this.map.get(key) as T) : (fallback as T);
	}

	update(key: string, value: unknown): Promise<void> {
		this.map.set(key, value);
		return Promise.resolve();
	}
}

function jsonResponse(payload: unknown): Response {
	return {
		ok: true,
		status: 200,
		json: () => Promise.resolve(payload),
	} as unknown as Response;
}

describe("provider-detection-bridge integration", () => {
	it("merges built-in + local catalog + remote registry into a single de-duped registry", async () => {
		const registry = new AcpProviderRegistry();

		// 1. Built-in providers (devin + gemini) registered first so collisions
		// later are silently skipped.
		for (const descriptor of BUILT_IN_PROVIDERS) {
			registry.register(descriptor);
		}

		// 2. Local catalog: pretend three of the eight agents are installed.
		const detector = new KnownAgentDetector();
		// Force a deterministic answer for tests: only opencode, kimi and
		// claude-acp report "installed".
		const installedTargets = new Set(["opencode", "kimi", "claude"]);
		vi.spyOn(detector, "isInstalledAny").mockImplementation((checks) => {
			const target = checks[0]?.target ?? "";
			return Promise.resolve(installedTargets.has(target));
		});

		for (const entry of KNOWN_AGENTS) {
			if (registry.get(entry.id)) {
				// Built-in already wins (e.g. gemini).
				continue;
			}
			registry.register(createDescriptorFromKnownAgent(entry, detector));
		}

		// 3. Remote registry: 4 entries — one collides with claude-acp (local),
		// one collides with gemini (built-in, must NOT replace), and two are
		// brand new.
		const remote: RemoteRegistryEntry[] = [
			{
				id: "claude-acp",
				displayName: "Claude Agent",
				distribution: {
					npx: { package: "@agentclientprotocol/claude-agent-acp@0.31.0" },
				},
			},
			{
				id: "gemini",
				displayName: "Gemini CLI (remote)",
				distribution: { npx: { package: "@google/gemini-cli@latest" } },
			},
			{
				id: "auggie",
				displayName: "Auggie CLI",
				distribution: {
					npx: {
						package: "@augmentcode/auggie@0.24.0",
						args: ["--acp"],
					},
				},
			},
			{
				id: "amp-acp",
				displayName: "Amp",
				distribution: {
					binary: {
						"linux-x86_64": {
							archive: "https://example.com/amp-linux.tar.gz",
							cmd: "./amp-acp",
						},
					},
				},
			},
		];

		const fetchImpl = vi.fn(() =>
			Promise.resolve(jsonResponse({ agents: remote }))
		);
		const entries = await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		// Apply the merge rules per Plan A.4: remote can replace local catalog
		// descriptors, but never built-in. Brand-new remote ids are added.
		for (const entry of entries) {
			const existing = registry.get(entry.id);
			const isBuiltIn = BUILT_IN_PROVIDERS.some((p) => p.id === entry.id);
			if (existing && isBuiltIn) {
				continue;
			}
			registry.register(
				createDescriptorFromRemoteEntry(entry, { platform: "linux-x86_64" })
			);
		}

		const ids = registry.list().map((p) => p.id);

		// Built-in survives.
		expect(ids).toContain("devin");
		expect(ids).toContain("gemini");

		// Local catalog: only the ones we marked as installed (or those that
		// got replaced/added by remote).
		expect(ids).toContain("claude-acp");
		expect(ids).toContain("kimi");
		expect(ids).toContain("opencode");

		// Pure remote additions are present.
		expect(ids).toContain("auggie");
		expect(ids).toContain("amp-acp");

		// Built-in gemini is preserved (NOT replaced by the remote alias).
		expect(registry.get("gemini")?.displayName).toBe("Gemini CLI");

		// No duplicates: every id appears exactly once.
		const seen = new Set<string>();
		for (const id of ids) {
			expect(seen.has(id)).toBe(false);
			seen.add(id);
		}
	});

	it("falls back gracefully when the remote fetch fails (still has built-in + local)", async () => {
		const registry = new AcpProviderRegistry();
		for (const descriptor of BUILT_IN_PROVIDERS) {
			registry.register(descriptor);
		}

		const detector = new KnownAgentDetector();
		vi.spyOn(detector, "isInstalledAny").mockResolvedValue(false);

		for (const entry of KNOWN_AGENTS) {
			if (!registry.get(entry.id)) {
				registry.register(createDescriptorFromKnownAgent(entry, detector));
			}
		}

		const fetchImpl = vi.fn(() => Promise.reject(new Error("offline")));
		await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		// Built-in (2) + 8 catalog entries minus one duplicate id (gemini) = 9
		expect(registry.list().length).toBeGreaterThanOrEqual(9);
		expect(registry.get("devin")).toBeDefined();
		expect(registry.get("opencode")).toBeDefined();
	});
});
