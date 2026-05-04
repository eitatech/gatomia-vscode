import { EventEmitter, type Event } from "vscode";
import type { IdeHost } from "../../utils/ide-host-detector";
import type { AcpProviderDescriptor } from "./types";

const REMOTE_REGISTRY_URL =
	"https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
const REGISTRY_CACHE_KEY = "gatomia.acp.registry.cache";
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_FETCH_TIMEOUT_MS = 3000;

/**
 * Per-platform binary distribution. Mirrors the ACP Registry CDN schema:
 *   `darwin-aarch64` | `darwin-x86_64` | `linux-aarch64` | `linux-x86_64`
 *   | `windows-aarch64` | `windows-x86_64`
 */
export interface RemoteRegistryBinaryEntry {
	archive: string;
	cmd: string;
	args?: string[];
}

/**
 * Distribution channels declared by an entry. At least one of `binary` or
 * `npx` MUST be present for the entry to be considered valid; entries with
 * neither are filtered out at fetch time.
 */
export interface RemoteRegistryDistribution {
	binary?: Record<string, RemoteRegistryBinaryEntry>;
	npx?: {
		package: string;
		args?: string[];
		env?: Record<string, string>;
	};
}

/**
 * Subset of the ACP Registry agent schema surfaced to GatomIA users. The
 * registry CDN ships entries with a `name` field; we normalise that to
 * `displayName` so downstream consumers see a single canonical shape.
 *
 * Users must still confirm consent before GatomIA spawns a third-party
 * binary, but the descriptor itself is now runnable (Plan A.3 produces real
 * `AcpProviderDescriptor` instances from these entries).
 */
export interface RemoteRegistryEntry {
	id: string;
	displayName: string;
	installUrl?: string;
	description?: string;
	version?: string;
	repository?: string;
	icon?: string;
	distribution?: RemoteRegistryDistribution;
}

/**
 * Shape of the VS Code `Memento`-like store used for caching the remote
 * registry payload. Expressed structurally so tests can pass a simple Map
 * without pulling in the full VS Code API.
 *
 * Matches VS Code's `Memento.get` overload signatures so that fakes returning
 * `T | undefined` are assignable without casts.
 */
export interface RegistryCacheStore {
	get<T>(key: string): T | undefined;
	get<T>(key: string, fallback: T): T;
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
	private readonly _onDidUpdate = new EventEmitter<void>();

	/**
	 * Fires after `loadRemoteRegistry` resolves successfully with one or more
	 * entries. Consumers (`bootstrapAcpRouter`, `NewSessionPanel`) listen to
	 * this to refresh their views without polling.
	 */
	readonly onDidUpdate: Event<void> = this._onDidUpdate.event;

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

	dispose(): void {
		this._onDidUpdate.dispose();
	}

	/**
	 * Fetches the public ACP Registry, respects a TTL cache in `globalState`,
	 * and falls back to cached data (or empty) on error. Never throws.
	 *
	 * Fires `onDidUpdate` when a fetch succeeds with at least one valid entry
	 * (cache hits and failed fetches are silent so passive listeners aren't
	 * woken up unnecessarily).
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
				agents?: unknown[];
			};
			const normalised = Array.isArray(payload.agents)
				? payload.agents
						.map(normaliseRemoteEntry)
						.filter((entry): entry is RemoteRegistryEntry =>
							isValidRemoteEntry(entry)
						)
				: [];
			this.remoteEntries = normalised;

			await globalState.update(REGISTRY_CACHE_KEY, {
				fetchedAt: Date.now(),
				remote: this.remoteEntries,
			});
			if (this.remoteEntries.length > 0) {
				this._onDidUpdate.fire();
			}
			return this.remoteEntries;
		} catch {
			this.remoteEntries = cached?.remote ?? [];
			return this.remoteEntries;
		}
	}
}

/**
 * The CDN ships entries with `name` instead of `displayName`. Normalise so
 * downstream code only ever sees one shape.
 */
const normaliseRemoteEntry = (value: unknown): unknown => {
	if (!value || typeof value !== "object") {
		return value;
	}
	const entry = value as Record<string, unknown>;
	if (typeof entry.displayName !== "string" && typeof entry.name === "string") {
		return { ...entry, displayName: entry.name };
	}
	return entry;
};

export const isValidRemoteEntry = (
	value: unknown
): value is RemoteRegistryEntry => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const entry = value as Partial<RemoteRegistryEntry>;
	if (typeof entry.id !== "string" || typeof entry.displayName !== "string") {
		return false;
	}
	const distribution = entry.distribution;
	if (!distribution || typeof distribution !== "object") {
		return false;
	}
	const hasNpx =
		distribution.npx !== undefined &&
		typeof distribution.npx.package === "string";
	const hasBinary =
		distribution.binary !== undefined &&
		typeof distribution.binary === "object" &&
		Object.keys(distribution.binary).length > 0;
	return hasNpx || hasBinary;
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
