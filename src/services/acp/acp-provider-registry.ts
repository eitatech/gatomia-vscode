import type { IdeHost } from "../../utils/ide-host-detector";
import type { AcpProviderDescriptor } from "./types";

const REMOTE_REGISTRY_URL =
	"https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const REGISTRY_CACHE_KEY = "gatomia.acp.registry.cache";
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_FETCH_TIMEOUT_MS = 3000;

/**
 * Minimal subset of the ACP Registry agent schema surfaced to GatomIA users.
 * Kept intentionally small: GatomIA only exposes suggestions in the Welcome
 * screen; users have to explicitly opt-in before any third-party binary is
 * spawned (to avoid trust issues with unsigned remote registries).
 */
export interface RemoteRegistryEntry {
	id: string;
	displayName: string;
	installUrl?: string;
	description?: string;
}

/**
 * Shape of the VS Code `Memento`-like store used for caching the remote
 * registry payload. Expressed structurally so tests can pass a simple Map
 * without pulling in the full VS Code API.
 */
export interface RegistryCacheStore {
	get<T>(key: string, fallback?: T): T;
	update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

interface CachedRegistryPayload {
	fetchedAt: number;
	remote: RemoteRegistryEntry[];
}

export interface LoadRemoteRegistryOptions {
	globalState: RegistryCacheStore;
	/** Override for tests. Defaults to the global `fetch`. */
	fetchImpl?: typeof fetch;
	/** TTL in milliseconds before we refetch. */
	cacheTtlMs?: number;
	/** Network timeout for a single fetch attempt. */
	fetchTimeoutMs?: number;
}

/**
 * Registry of ACP-capable providers that GatomIA knows how to drive.
 *
 * - Built-in descriptors (Devin, Gemini) are registered by the extension at
 *   activation time.
 * - `loadRemoteRegistry` optionally augments the catalog with entries from the
 *   public ACP Registry so the welcome screen can suggest more agents. Those
 *   entries are **metadata-only** and do not produce runnable descriptors:
 *   users must still provide a spawn command manually before GatomIA will
 *   execute a third-party binary.
 */
export class AcpProviderRegistry {
	private readonly providers = new Map<string, AcpProviderDescriptor>();
	private remoteEntries: RemoteRegistryEntry[] = [];

	register(descriptor: AcpProviderDescriptor): void {
		this.providers.set(descriptor.id, descriptor);
	}

	get(id: string): AcpProviderDescriptor | undefined {
		return this.providers.get(id);
	}

	list(): AcpProviderDescriptor[] {
		return Array.from(this.providers.values());
	}

	listRemote(): RemoteRegistryEntry[] {
		return [...this.remoteEntries];
	}

	forHost(host: IdeHost): AcpProviderDescriptor | undefined {
		for (const provider of this.providers.values()) {
			if (provider.preferredHosts.includes(host)) {
				return provider;
			}
		}
		return;
	}

	/**
	 * Fetches the public ACP Registry, respects a TTL cache in `globalState`,
	 * and falls back to cached data (or empty) on error. Never throws.
	 */
	async loadRemoteRegistry(
		options: LoadRemoteRegistryOptions
	): Promise<RemoteRegistryEntry[]> {
		const {
			globalState,
			fetchImpl = typeof fetch === "function" ? fetch : undefined,
			cacheTtlMs = DEFAULT_CACHE_TTL_MS,
			fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
		} = options;

		const cached = globalState.get<CachedRegistryPayload | undefined>(
			REGISTRY_CACHE_KEY,
			undefined
		);

		if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) {
			this.remoteEntries = cached.remote;
			return this.remoteEntries;
		}

		if (!fetchImpl) {
			this.remoteEntries = cached?.remote ?? [];
			return this.remoteEntries;
		}

		try {
			const response = await withTimeout(
				fetchImpl(REMOTE_REGISTRY_URL, { method: "GET" }),
				fetchTimeoutMs
			);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const payload = (await response.json()) as {
				agents?: RemoteRegistryEntry[];
			};
			this.remoteEntries = Array.isArray(payload.agents)
				? payload.agents.filter(isValidRemoteEntry)
				: [];

			await globalState.update(REGISTRY_CACHE_KEY, {
				fetchedAt: Date.now(),
				remote: this.remoteEntries,
			});
			return this.remoteEntries;
		} catch {
			this.remoteEntries = cached?.remote ?? [];
			return this.remoteEntries;
		}
	}
}

const isValidRemoteEntry = (value: unknown): value is RemoteRegistryEntry => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const entry = value as Partial<RemoteRegistryEntry>;
	return typeof entry.id === "string" && typeof entry.displayName === "string";
};

const withTimeout = async <T>(
	promise: Promise<T>,
	timeoutMs: number
): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_resolve, reject) => {
				timer = setTimeout(() => {
					reject(new Error(`fetch timeout after ${timeoutMs}ms`));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
};
