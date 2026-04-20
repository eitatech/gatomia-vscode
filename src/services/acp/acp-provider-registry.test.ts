import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AcpProviderRegistry,
	type RemoteRegistryEntry,
} from "./acp-provider-registry";
import type { AcpProviderDescriptor, AcpProviderProbe } from "./types";

const makeDescriptor = (
	id: string,
	overrides: Partial<AcpProviderDescriptor> = {}
): AcpProviderDescriptor => ({
	id,
	displayName: id.toUpperCase(),
	preferredHosts: [],
	spawnCommand: id,
	spawnArgs: [],
	installUrl: `https://example.com/${id}`,
	authCommand: `${id} login`,
	probe: vi.fn(
		async (): Promise<AcpProviderProbe> => ({
			installed: false,
			version: null,
			authenticated: false,
			acpSupported: false,
			executablePath: null,
		})
	),
	...overrides,
});

const makeGlobalState = () => {
	const store = new Map<string, unknown>();
	return {
		get: vi.fn(<T>(key: string, fallback?: T) =>
			store.has(key) ? (store.get(key) as T) : fallback
		),
		update: vi.fn((key: string, value: unknown) => {
			store.set(key, value);
			return Promise.resolve();
		}),
		keys: () => Array.from(store.keys()),
	};
};

describe("AcpProviderRegistry", () => {
	let registry: AcpProviderRegistry;

	beforeEach(() => {
		registry = new AcpProviderRegistry();
	});

	it("registers and retrieves providers by id", () => {
		const devin = makeDescriptor("devin", { preferredHosts: ["windsurf"] });
		registry.register(devin);

		expect(registry.get("devin")).toBe(devin);
		expect(registry.get("missing")).toBeUndefined();
	});

	it("lists providers in insertion order", () => {
		registry.register(makeDescriptor("one"));
		registry.register(makeDescriptor("two"));
		registry.register(makeDescriptor("three"));

		expect(registry.list().map((p: AcpProviderDescriptor) => p.id)).toEqual([
			"one",
			"two",
			"three",
		]);
	});

	it("replaces an existing provider when registered twice", () => {
		const v1 = makeDescriptor("devin", { displayName: "v1" });
		const v2 = makeDescriptor("devin", { displayName: "v2" });
		registry.register(v1);
		registry.register(v2);

		expect(registry.list()).toHaveLength(1);
		expect(registry.get("devin")?.displayName).toBe("v2");
	});

	it("forHost returns the first provider whose preferredHosts match", () => {
		registry.register(
			makeDescriptor("devin", { preferredHosts: ["windsurf"] })
		);
		registry.register(
			makeDescriptor("gemini", { preferredHosts: ["antigravity"] })
		);

		expect(registry.forHost("windsurf")?.id).toBe("devin");
		expect(registry.forHost("antigravity")?.id).toBe("gemini");
		expect(registry.forHost("vscode")).toBeUndefined();
	});

	it("forHost can accept providers listing multiple hosts", () => {
		registry.register(
			makeDescriptor("multi", {
				preferredHosts: ["windsurf", "antigravity"],
			})
		);
		expect(registry.forHost("windsurf")?.id).toBe("multi");
		expect(registry.forHost("antigravity")?.id).toBe("multi");
	});

	describe("loadRemoteRegistry", () => {
		const REGISTRY_URL =
			"https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";

		it("does nothing when globalState returns a fresh cached payload", async () => {
			const state = makeGlobalState();
			await state.update("gatomia.acp.registry.cache", {
				fetchedAt: Date.now() - 1000,
				remote: [{ id: "amp", displayName: "Amp" }],
			});

			const fetchMock = vi.fn();
			const loaded = await registry.loadRemoteRegistry({
				globalState: state,
				fetchImpl: fetchMock,
				cacheTtlMs: 60_000,
			});

			expect(fetchMock).not.toHaveBeenCalled();
			expect(loaded.map((p: RemoteRegistryEntry) => p.id)).toContain("amp");
		});

		it("fetches and caches when no cache exists", async () => {
			const state = makeGlobalState();
			const fetchMock = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					agents: [{ id: "codex", displayName: "Codex" }],
				}),
			});

			const loaded = await registry.loadRemoteRegistry({
				globalState: state,
				fetchImpl: fetchMock,
				cacheTtlMs: 60_000,
			});

			expect(fetchMock).toHaveBeenCalledWith(REGISTRY_URL, expect.any(Object));
			expect(loaded.map((p: RemoteRegistryEntry) => p.id)).toContain("codex");
			expect(state.update).toHaveBeenCalledWith(
				"gatomia.acp.registry.cache",
				expect.objectContaining({
					remote: expect.arrayContaining([
						expect.objectContaining({ id: "codex" }),
					]),
				})
			);
		});

		it("returns cached data silently when fetch fails", async () => {
			const state = makeGlobalState();
			await state.update("gatomia.acp.registry.cache", {
				fetchedAt: Date.now() - 9_999_999,
				remote: [{ id: "cached", displayName: "Cached" }],
			});
			const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

			const loaded = await registry.loadRemoteRegistry({
				globalState: state,
				fetchImpl: fetchMock,
				cacheTtlMs: 60_000,
			});

			expect(loaded.map((p: RemoteRegistryEntry) => p.id)).toContain("cached");
		});

		it("returns empty array when fetch fails and no cache exists", async () => {
			const state = makeGlobalState();
			const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));

			const loaded = await registry.loadRemoteRegistry({
				globalState: state,
				fetchImpl: fetchMock,
				cacheTtlMs: 60_000,
			});

			expect(loaded).toEqual([]);
		});
	});
});
