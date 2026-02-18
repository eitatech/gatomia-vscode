/**
 * ModelCacheService
 *
 * Provides a cached list of available GitHub Copilot language models via
 * vscode.lm.selectChatModels. Results are cached for MODEL_CACHE_TTL_MS (5 min).
 * The cache is invalidated when vscode.lm.onDidChangeChatModels fires.
 *
 * Never throws — returns stale/empty result on failure.
 *
 * @feature 001-hooks-refactor
 */

import type { Disposable, LanguageModelChat } from "vscode";

/** Cache TTL: 5 minutes in milliseconds */
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

const LOG_PREFIX = "[ModelCacheService]";

/** Minimal lm API shape used by this service. */
export interface VsCodeLmApi {
	selectChatModels(filter: { vendor: string }): Promise<LanguageModelChat[]>;
	onDidChangeChatModels(listener: () => void): Disposable;
}

export interface LanguageModelInfoPayload {
	id: string;
	name: string;
	family: string;
	maxInputTokens: number;
}

export interface ModelCacheResult {
	models: LanguageModelInfoPayload[];
	isStale: boolean;
}

/**
 * Public interface for ModelCacheService.
 * Registered in extension.ts and injected into HookViewProvider.
 */
export interface IModelCacheService {
	/**
	 * Returns available Copilot models.
	 * - First call: fetches via vscode.lm.selectChatModels
	 * - Within TTL: returns cached result without re-fetching
	 * - After onDidChangeChatModels fires: cache is invalidated; next call re-fetches
	 * - On failure: returns last known cache with isStale=true; never throws
	 */
	getAvailableModels(forceRefresh?: boolean): Promise<ModelCacheResult>;

	/** Dispose subscriptions held by this service. */
	dispose(): void;
}

/**
 * Maps a vscode LanguageModelChat to a serialisable payload.
 */
function toPayload(model: LanguageModelChat): LanguageModelInfoPayload {
	return {
		id: model.id,
		name: model.name,
		family: model.family,
		maxInputTokens: model.maxInputTokens,
	};
}

/** No-op disposable used when vscode.lm is unavailable. */
function createNoopDisposable(): Disposable {
	return {
		dispose() {
			/* no subscriptions to release */
		},
	};
}

/**
 * Emits a structured telemetry log for model cache events.
 * Follows the console.log pattern used across this codebase for service-level telemetry.
 */
function logTelemetry(
	event: string,
	properties: Record<string, string | number | boolean>
): void {
	console.log(`${LOG_PREFIX} Telemetry: ${event}`, properties);
}

/**
 * ModelCacheService — implements IModelCacheService.
 *
 * @param getLm - Factory that returns the vscode.lm API or undefined when
 *   unavailable (older VS Code / test environment). Defaults to reading the
 *   `lm` export from the `vscode` module at call-time so tests can inject a
 *   mock via the module alias without using `require`.
 */
export class ModelCacheService implements IModelCacheService {
	private cachedModels: LanguageModelInfoPayload[] | undefined;
	private cacheTimestamp = 0;
	private isCacheStale = false;
	private readonly subscription: Disposable;
	private readonly getLm: () => VsCodeLmApi | undefined;

	constructor(getLm?: () => VsCodeLmApi | undefined) {
		this.getLm = getLm ?? ModelCacheService.defaultGetLm;
		const lm = this.getLm();
		if (lm) {
			this.subscription = lm.onDidChangeChatModels(() => {
				this.isCacheStale = true;
			});
		} else {
			this.subscription = createNoopDisposable();
		}
	}

	/**
	 * Default factory: reads `lm` from the vscode module at call-time.
	 * Using a module-level import would bind the value at module load and miss
	 * runtime availability changes; this lazy accessor avoids that.
	 */
	private static defaultGetLm(): VsCodeLmApi | undefined {
		return (require("vscode") as { lm?: VsCodeLmApi }).lm;
	}

	/**
	 * Returns available models, using cache when fresh.
	 */
	async getAvailableModels(forceRefresh = false): Promise<ModelCacheResult> {
		const now = Date.now();
		const cacheExpired = now - this.cacheTimestamp >= MODEL_CACHE_TTL_MS;
		const shouldFetch =
			forceRefresh ||
			this.isCacheStale ||
			cacheExpired ||
			this.cachedModels === undefined;

		if (!shouldFetch) {
			return { models: this.cachedModels ?? [], isStale: false };
		}

		const lm = this.getLm();
		if (!lm) {
			// Runtime guard: vscode.lm not available (older VS Code or test env)
			logTelemetry("model-cache.stale-fallback", {
				reason: "lm-unavailable",
				cachedCount: this.cachedModels?.length ?? 0,
			});
			return { models: this.cachedModels ?? [], isStale: true };
		}

		try {
			const rawModels = await lm.selectChatModels({ vendor: "copilot" });
			this.cachedModels = rawModels.map(toPayload);
			this.cacheTimestamp = Date.now();
			this.isCacheStale = false;
			logTelemetry("model-cache.fetch-success", {
				modelCount: this.cachedModels.length,
				forceRefresh,
			});
			return { models: this.cachedModels, isStale: false };
		} catch (error) {
			// Return stale cache on failure; never throw
			const errorCode = error instanceof Error ? error.name : "unknown";
			logTelemetry("model-cache.fetch-failure", {
				errorCode,
				cachedCount: this.cachedModels?.length ?? 0,
				forceRefresh,
			});
			return { models: this.cachedModels ?? [], isStale: true };
		}
	}

	dispose(): void {
		this.subscription.dispose();
	}
}
