/**
 * AcpProviderRegistry — extension tests for the expanded RemoteRegistryEntry
 * schema and the new `onDidUpdate` emitter (TDD red).
 *
 * The base CRUD tests live alongside the implementation in
 * `src/services/acp/`. These cover the additive behaviour introduced by Plan
 * A.1:
 *   - `RemoteRegistryEntry.distribution` is required (npx OR binary OR both).
 *   - Entries missing `distribution` are silently filtered by
 *     `loadRemoteRegistry`.
 *   - `onDidUpdate` fires after `loadRemoteRegistry` resolves with at least
 *     one new entry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AcpProviderRegistry,
	type RegistryCacheStore,
	type RemoteRegistryEntry,
} from "../../../../src/services/acp/acp-provider-registry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("AcpProviderRegistry — A.1 schema expansion", () => {
	let originalDateNow: typeof Date.now;

	beforeEach(() => {
		originalDateNow = Date.now;
		Date.now = () => 1_700_000_000_000;
	});

	afterEach(() => {
		Date.now = originalDateNow;
	});

	it("accepts entries with a full distribution schema (npx + binary)", async () => {
		const remote: RemoteRegistryEntry = {
			id: "codex-acp",
			displayName: "Codex CLI",
			description: "ACP adapter for OpenAI's coding assistant",
			version: "0.12.0",
			distribution: {
				binary: {
					"darwin-aarch64": {
						archive: "https://example.com/d-a.tar.gz",
						cmd: "./codex-acp",
					},
					"linux-x86_64": {
						archive: "https://example.com/l-x.tar.gz",
						cmd: "./codex-acp",
					},
				},
				npx: { package: "@zed-industries/codex-acp@0.12.0" },
			},
		};

		const registry = new AcpProviderRegistry();
		const fetchImpl = vi.fn(() =>
			Promise.resolve(jsonResponse({ agents: [remote] }))
		);
		const entries = await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(entries).toHaveLength(1);
		expect(entries[0].id).toBe("codex-acp");
		expect(entries[0].distribution).toBeDefined();
	});

	it("accepts entries with only distribution.npx", async () => {
		const remote: RemoteRegistryEntry = {
			id: "auggie",
			displayName: "Auggie CLI",
			distribution: {
				npx: {
					package: "@augmentcode/auggie@0.24.0",
					args: ["--acp"],
				},
			},
		};

		const registry = new AcpProviderRegistry();
		const fetchImpl = vi.fn(() =>
			Promise.resolve(jsonResponse({ agents: [remote] }))
		);
		const entries = await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(entries).toHaveLength(1);
	});

	it("filters out entries missing distribution entirely", async () => {
		const malformed = {
			id: "bad",
			displayName: "No Distribution",
		};

		const registry = new AcpProviderRegistry();
		const fetchImpl = vi.fn(() =>
			Promise.resolve(jsonResponse({ agents: [malformed] }))
		);
		const entries = await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(entries).toHaveLength(0);
	});

	it("normalises payloads that use the public 'name' field instead of 'displayName'", async () => {
		// The CDN ships entries shaped as `{ id, name, distribution }`. The
		// registry MUST normalise `name` → `displayName` so downstream
		// consumers see one canonical shape.
		const fromCdn = {
			id: "amp-acp",
			name: "Amp",
			distribution: {
				binary: {
					"linux-x86_64": {
						archive: "https://example.com/amp.tar.gz",
						cmd: "./amp-acp",
					},
				},
			},
		};

		const registry = new AcpProviderRegistry();
		const fetchImpl = vi.fn(() =>
			Promise.resolve(jsonResponse({ agents: [fromCdn] }))
		);
		const entries = await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(entries).toHaveLength(1);
		expect(entries[0].displayName).toBe("Amp");
	});

	it("fires onDidUpdate after a successful remote fetch with non-empty entries", async () => {
		const remote: RemoteRegistryEntry = {
			id: "auggie",
			displayName: "Auggie CLI",
			distribution: {
				npx: { package: "@augmentcode/auggie@0.24.0" },
			},
		};

		const registry = new AcpProviderRegistry();
		const listener = vi.fn();
		registry.onDidUpdate(listener);

		const fetchImpl = vi.fn(() =>
			Promise.resolve(jsonResponse({ agents: [remote] }))
		);
		await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("does NOT fire onDidUpdate when the fetch fails and we fall back to empty", async () => {
		const registry = new AcpProviderRegistry();
		const listener = vi.fn();
		registry.onDidUpdate(listener);

		const fetchImpl = vi.fn(() => Promise.reject(new Error("network down")));
		await registry.loadRemoteRegistry({
			globalState: new InMemoryStore(),
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		expect(listener).not.toHaveBeenCalled();
	});
});
