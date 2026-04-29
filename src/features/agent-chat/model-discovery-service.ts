/**
 * ModelDiscoveryService — single source of truth for the model list a
 * given ACP provider can offer.
 *
 * @see docs/spec acp-dynamic-models for the design.
 *
 * The service implements a per-provider lookup chain:
 *
 *   1. **GitHub Copilot** (`github-copilot`) → delegates to the
 *      `ModelCacheService` so the picker mirrors the user's actual
 *      `vscode.lm.selectChatModels({ vendor: "copilot" })` subscription.
 *   2. **Other ACP providers** → run a lazy probe via
 *      `acpSessionManager.probeProviderModels(providerId)` (spawns the
 *      CLI when needed, then issues a `newSession` RPC and reads
 *      `response.models.availableModels`). Cached in memory for
 *      `MODEL_DISCOVERY_TTL_MS` (5 min).
 *   3. **Static catalog** → falls back to
 *      `agent-capabilities-catalog.ts` when the agent silently refuses
 *      to surface a model list (older CLIs).
 *   4. **Nothing** → returns `source: "none"` so the UI can hide the
 *      `<select>` entirely (per the redesign).
 *
 * The service exposes both a synchronous read of the cached state
 * ({@link ModelDiscoveryService.peek}) and an asynchronous fetch
 * ({@link ModelDiscoveryService.getModels}) that triggers a probe on
 * cache miss. Subscribers are notified via {@link onDidChange} whenever
 * a probe lands so the host can rebroadcast the catalog.
 */

import { EventEmitter, type Disposable } from "vscode";
import type { IModelCacheService } from "../hooks/services/model-cache-service";
import type { AcpSessionModelState } from "../../services/acp/types";
import { lookupCatalogEntry } from "./agent-capabilities-catalog";
import type { ModelDescriptor } from "./types";

/** Cache TTL for ACP probes (5 minutes). */
export const MODEL_DISCOVERY_TTL_MS = 5 * 60 * 1000;

/** Provider id reserved for the GitHub Copilot CLI. */
export const GITHUB_COPILOT_PROVIDER_ID = "github-copilot";

/** Source the discovered models came from. */
export type ModelDiscoverySource = "vscode-lm" | "agent" | "catalog" | "none";

export interface DiscoveredModels {
	models: ModelDescriptor[];
	source: ModelDiscoverySource;
	currentModelId?: string;
	fetchedAt: number;
}

export interface ModelDiscoveryEvent {
	providerId: string;
	result: DiscoveredModels;
}

/**
 * Subset of {@link AcpSessionManager} actually consumed by this
 * service. Declared structurally so tests can inject a fake without
 * spinning up the real ACP machinery.
 */
export interface ModelDiscoveryAcpManager {
	probeProviderModels(
		providerId: string,
		cwd?: string
	): Promise<AcpSessionModelState | undefined>;
}

export interface ModelDiscoveryServiceOptions {
	readonly modelCache: IModelCacheService;
	readonly acpSessionManager: ModelDiscoveryAcpManager;
	/**
	 * Optional cwd resolver used for ACP probes. The service falls back
	 * to `undefined` (which delegates to the manager's constructor cwd)
	 * when omitted.
	 */
	readonly resolveCwd?: () => string | undefined;
	/** Optional clock injection for deterministic tests. */
	readonly now?: () => number;
	/** Optional log sink. Defaults to a no-op. */
	readonly log?: (message: string) => void;
}

/**
 * Empty / "no source" result emitted when no probe has run yet and no
 * catalog entry is available. Reused for legacy callers that key off
 * `source === "none"` to hide the `<select>` entirely.
 */
const EMPTY_RESULT: DiscoveredModels = {
	models: [],
	source: "none",
	fetchedAt: 0,
};

/** Default cwd resolver: always returns `undefined` so the manager uses its constructor cwd. */
function defaultResolveCwd(): string | undefined {
	return;
}

/** Default log sink: discards messages. */
function defaultLog(_message: string): void {
	// intentional no-op
}

export class ModelDiscoveryService implements Disposable {
	private readonly modelCache: IModelCacheService;
	private readonly manager: ModelDiscoveryAcpManager;
	private readonly resolveCwd: () => string | undefined;
	private readonly now: () => number;
	private readonly log: (message: string) => void;
	private readonly cache = new Map<string, DiscoveredModels>();
	/** Promises in flight per provider — coalesces concurrent callers. */
	private readonly inFlight = new Map<string, Promise<DiscoveredModels>>();
	private readonly emitter = new EventEmitter<ModelDiscoveryEvent>();

	readonly onDidChange = this.emitter.event;

	constructor(options: ModelDiscoveryServiceOptions) {
		this.modelCache = options.modelCache;
		this.manager = options.acpSessionManager;
		this.resolveCwd = options.resolveCwd ?? defaultResolveCwd;
		this.now = options.now ?? Date.now;
		this.log = options.log ?? defaultLog;
	}

	/**
	 * Returns the cached result for `providerId` without triggering a
	 * probe. The caller can use this to render synchronously while
	 * awaiting {@link getModels}. Returns `undefined` when no entry is
	 * cached yet — the UI should treat that as "loading".
	 */
	peek(providerId: string): DiscoveredModels | undefined {
		return this.cache.get(providerId);
	}

	/**
	 * Resolve the model list for `providerId`. Honours the per-source
	 * lookup chain documented at the top of this file. Coalesces
	 * concurrent calls.
	 */
	getModels(providerId: string): Promise<DiscoveredModels> {
		const cached = this.cache.get(providerId);
		if (cached && this.isFresh(cached)) {
			return Promise.resolve(cached);
		}
		const inFlight = this.inFlight.get(providerId);
		if (inFlight) {
			return inFlight;
		}
		const work = this.fetch(providerId).finally(() => {
			this.inFlight.delete(providerId);
		});
		this.inFlight.set(providerId, work);
		return work;
	}

	/**
	 * Drop the cached entry for `providerId` so the next call to
	 * {@link getModels} re-runs the probe. Used when the user clicks
	 * the refresh button next to the model `<select>`.
	 */
	invalidate(providerId: string): void {
		this.cache.delete(providerId);
	}

	dispose(): void {
		this.cache.clear();
		this.inFlight.clear();
		this.emitter.dispose();
	}

	// ------------------------------------------------------------------
	// Internals
	// ------------------------------------------------------------------

	private isFresh(entry: DiscoveredModels): boolean {
		if (entry.source === "none") {
			// `none` results expire faster — they were never authoritative
			// and re-probing on the next click is cheap once the CLI is
			// already spawned.
			return this.now() - entry.fetchedAt < MODEL_DISCOVERY_TTL_MS / 5;
		}
		return this.now() - entry.fetchedAt < MODEL_DISCOVERY_TTL_MS;
	}

	private async fetch(providerId: string): Promise<DiscoveredModels> {
		const result =
			providerId === GITHUB_COPILOT_PROVIDER_ID
				? await this.fetchCopilot()
				: await this.fetchAcp(providerId);
		this.cache.set(providerId, result);
		this.emitter.fire({ providerId, result });
		return result;
	}

	private async fetchCopilot(): Promise<DiscoveredModels> {
		try {
			const cacheResult = await this.modelCache.getAvailableModels();
			const models: ModelDescriptor[] = cacheResult.models.map((m) => ({
				id: m.id,
				displayName: m.name,
				// Copilot models are applied to the next chat turn — they
				// do not flow through ACP `set_model`. The "initial-prompt"
				// invocation marker keeps the legacy code path intact.
				invocation: "initial-prompt",
			}));
			return {
				models,
				source: models.length === 0 ? "none" : "vscode-lm",
				fetchedAt: this.now(),
			};
		} catch (error) {
			this.log(
				`[ModelDiscovery] copilot fetch failed: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return { ...EMPTY_RESULT, fetchedAt: this.now() };
		}
	}

	private async fetchAcp(providerId: string): Promise<DiscoveredModels> {
		try {
			const probe = await this.manager.probeProviderModels(
				providerId,
				this.resolveCwd()
			);
			if (probe && probe.availableModels.length > 0) {
				return {
					models: probe.availableModels.map(
						(m): ModelDescriptor => ({
							id: m.modelId,
							displayName: m.name,
							invocation: "initial-prompt",
						})
					),
					source: "agent",
					currentModelId: probe.currentModelId,
					fetchedAt: this.now(),
				};
			}
		} catch (error) {
			this.log(
				`[ModelDiscovery] probe failed for ${providerId}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
		return this.fallbackToCatalog(providerId);
	}

	private fallbackToCatalog(providerId: string): DiscoveredModels {
		const entry = lookupCatalogEntry(providerId);
		const catalogModels = entry?.capabilities?.models ?? [];
		if (catalogModels.length === 0) {
			return { ...EMPTY_RESULT, fetchedAt: this.now() };
		}
		return {
			models: catalogModels.map(
				(m): ModelDescriptor => ({
					id: m.id,
					displayName: m.displayName,
					invocation: m.invocation,
					invocationTemplate: m.invocationTemplate,
				})
			),
			source: "catalog",
			fetchedAt: this.now(),
		};
	}
}
