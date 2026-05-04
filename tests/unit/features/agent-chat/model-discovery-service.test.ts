/**
 * Unit tests for {@link ModelDiscoveryService}.
 *
 * Covers the per-source lookup chain documented in the service header:
 *
 *   1. GitHub Copilot → `IModelCacheService.getAvailableModels()`.
 *   2. ACP providers → `acpSessionManager.probeProviderModels()`.
 *   3. Catalog fallback when the probe yields nothing.
 *   4. `peek` / `invalidate` cache semantics.
 *
 * The tests use injected fakes so we never spawn a real ACP child
 * process; the service is the pure projection on top.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
	GITHUB_COPILOT_PROVIDER_ID,
	MODEL_DISCOVERY_TTL_MS,
	ModelDiscoveryService,
	type ModelDiscoveryAcpManager,
} from "../../../../src/features/agent-chat/model-discovery-service";
import type {
	IModelCacheService,
	ModelCacheResult,
} from "../../../../src/features/hooks/services/model-cache-service";
import type { AcpSessionModelState } from "../../../../src/services/acp/types";

interface ServiceHandles {
	service: ModelDiscoveryService;
	modelCache: IModelCacheService & { _result: ModelCacheResult };
	probe: ReturnType<typeof vi.fn>;
	tick: () => void;
}

function makeService(opts: {
	now?: () => number;
	probe?: ModelDiscoveryAcpManager["probeProviderModels"];
	copilotResult?: ModelCacheResult;
}): ServiceHandles {
	const baseResult: ModelCacheResult = opts.copilotResult ?? {
		models: [],
		isStale: false,
	};
	const modelCache = {
		_result: baseResult,
		getAvailableModels: vi.fn(async () => modelCache._result),
		dispose: vi.fn(),
	};
	const probe = vi.fn(
		opts.probe ??
			((): Promise<AcpSessionModelState | undefined> =>
				Promise.resolve(undefined))
	);
	let now = 0;
	const service = new ModelDiscoveryService({
		modelCache: modelCache as unknown as IModelCacheService,
		acpSessionManager: { probeProviderModels: probe },
		now: opts.now ?? (() => now),
	});
	return {
		service,
		modelCache,
		probe,
		tick: () => {
			now += MODEL_DISCOVERY_TTL_MS + 1;
		},
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ModelDiscoveryService", () => {
	describe("github-copilot delegation", () => {
		it("delegates to ModelCacheService and projects vscode-lm models", async () => {
			const { service, modelCache } = makeService({
				copilotResult: {
					models: [
						{ id: "gpt-5", name: "GPT-5" },
						{ id: "claude", name: "Claude" },
					],
					isStale: false,
				},
			});

			const result = await service.getModels(GITHUB_COPILOT_PROVIDER_ID);

			expect(modelCache.getAvailableModels).toHaveBeenCalledOnce();
			expect(result.source).toBe("vscode-lm");
			expect(result.models).toHaveLength(2);
			expect(result.models[0]).toMatchObject({
				id: "gpt-5",
				displayName: "GPT-5",
				invocation: "initial-prompt",
			});
		});

		it("returns source=none when the cache exposes no models", async () => {
			const { service } = makeService({
				copilotResult: { models: [], isStale: false },
			});
			const result = await service.getModels(GITHUB_COPILOT_PROVIDER_ID);
			expect(result.source).toBe("none");
			expect(result.models).toEqual([]);
		});

		it("falls back to source=none when the cache throws", async () => {
			const { service, modelCache } = makeService({});
			modelCache.getAvailableModels = vi.fn(() =>
				Promise.reject(new Error("offline"))
			);
			const result = await service.getModels(GITHUB_COPILOT_PROVIDER_ID);
			expect(result.source).toBe("none");
		});
	});

	describe("ACP probe path", () => {
		it("returns source=agent when the probe surfaces models", async () => {
			const probeResult: AcpSessionModelState = {
				availableModels: [
					{ modelId: "sonnet", name: "Sonnet" },
					{ modelId: "opus", name: "Opus" },
				],
				currentModelId: "sonnet",
			};
			const { service, probe } = makeService({
				probe: vi.fn(async () => probeResult),
			});

			const result = await service.getModels("claude-acp");

			expect(probe).toHaveBeenCalledWith("claude-acp", undefined);
			expect(result.source).toBe("agent");
			expect(result.models).toHaveLength(2);
			expect(result.currentModelId).toBe("sonnet");
		});

		it("falls back to the static catalog when the probe yields nothing", async () => {
			const { service } = makeService({
				probe: vi.fn(
					(): Promise<AcpSessionModelState | undefined> =>
						Promise.resolve(undefined)
				),
			});
			// `claude-acp` has a non-empty catalog entry seeded in
			// `agent-capabilities-catalog.ts`.
			const result = await service.getModels("claude-acp");
			expect(result.source).toBe("catalog");
			expect(result.models.length).toBeGreaterThan(0);
		});

		it("returns source=none when the probe throws AND no catalog entry exists", async () => {
			const { service } = makeService({
				probe: vi.fn(() => Promise.reject(new Error("spawn failed"))),
			});
			const result = await service.getModels("does-not-exist");
			expect(result.source).toBe("none");
		});
	});

	describe("caching semantics", () => {
		it("returns cached results without re-probing within the TTL", async () => {
			const { service, probe } = makeService({
				probe: vi.fn(async () => ({
					availableModels: [{ modelId: "sonnet", name: "Sonnet" }],
					currentModelId: "sonnet",
				})),
			});

			await service.getModels("claude-acp");
			await service.getModels("claude-acp");

			expect(probe).toHaveBeenCalledTimes(1);
		});

		it("invalidate forces a fresh probe on the next read", async () => {
			const { service, probe } = makeService({
				probe: vi.fn(async () => ({
					availableModels: [{ modelId: "sonnet", name: "Sonnet" }],
					currentModelId: "sonnet",
				})),
			});

			await service.getModels("claude-acp");
			service.invalidate("claude-acp");
			await service.getModels("claude-acp");

			expect(probe).toHaveBeenCalledTimes(2);
		});

		it("peek returns undefined before the first probe", () => {
			const { service } = makeService({});
			expect(service.peek("claude-acp")).toBeUndefined();
		});

		it("peek returns the cached entry after a probe lands", async () => {
			const { service } = makeService({
				probe: vi.fn(async () => ({
					availableModels: [{ modelId: "sonnet", name: "Sonnet" }],
					currentModelId: "sonnet",
				})),
			});
			await service.getModels("claude-acp");
			expect(service.peek("claude-acp")?.source).toBe("agent");
		});
	});

	describe("event coalescing", () => {
		it("fires onDidChange for each provider that lands a probe", async () => {
			const { service } = makeService({
				probe: vi.fn(async () => ({
					availableModels: [{ modelId: "sonnet", name: "Sonnet" }],
					currentModelId: "sonnet",
				})),
			});
			const events: string[] = [];
			service.onDidChange((evt) => {
				events.push(evt.providerId);
			});
			await service.getModels("claude-acp");
			await service.getModels("github-copilot");
			expect(events).toEqual(["claude-acp", "github-copilot"]);
		});

		it("coalesces concurrent calls into a single in-flight probe", async () => {
			let resolve!: (value: AcpSessionModelState) => void;
			const probe = vi.fn(
				() =>
					new Promise<AcpSessionModelState>((r) => {
						resolve = r;
					})
			);
			const { service } = makeService({ probe });

			const a = service.getModels("claude-acp");
			const b = service.getModels("claude-acp");
			expect(probe).toHaveBeenCalledTimes(1);

			resolve({
				availableModels: [{ modelId: "sonnet", name: "Sonnet" }],
				currentModelId: "sonnet",
			});
			await Promise.all([a, b]);
			expect(probe).toHaveBeenCalledTimes(1);
		});
	});
});
