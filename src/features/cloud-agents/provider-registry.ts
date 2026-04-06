/**
 * Provider Registry
 *
 * Manages registration and active-provider orchestration for cloud agent providers.
 * Supports registering adapters, getting/setting the active provider, and listing all providers.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 * @see specs/016-multi-provider-agents/plan.md
 */

import type { CloudAgentProvider } from "./cloud-agent-provider";
import { logInfo, logError } from "./logging";
import type { ProviderConfigStore } from "./provider-config-store";

// ============================================================================
// ProviderRegistry
// ============================================================================

/**
 * Registry for cloud agent provider adapters.
 * Manages available providers and active provider state.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */
export class ProviderRegistry {
	private readonly providers = new Map<string, CloudAgentProvider>();
	private readonly configStore: ProviderConfigStore;
	private activeProviderId: string | undefined;

	constructor(configStore: ProviderConfigStore) {
		this.configStore = configStore;
	}

	/**
	 * Register a provider adapter. Throws if a provider with the same ID is already registered.
	 * @param provider - The provider to register
	 */
	register(provider: CloudAgentProvider): void {
		const id = provider.metadata.id;
		if (this.providers.has(id)) {
			throw new Error(`Provider "${id}" is already registered`);
		}
		this.providers.set(id, provider);
		logInfo(`Provider registered: ${id}`);
	}

	/**
	 * Get a registered provider by ID.
	 * @param id - The provider ID
	 * @returns The provider or undefined if not found
	 */
	get(id: string): CloudAgentProvider | undefined {
		return this.providers.get(id);
	}

	/**
	 * Get all registered providers.
	 * @returns Array of all registered providers
	 */
	getAll(): CloudAgentProvider[] {
		return [...this.providers.values()];
	}

	/**
	 * Get the currently active provider.
	 * @returns The active provider or undefined if none is set
	 */
	getActive(): CloudAgentProvider | undefined {
		if (!this.activeProviderId) {
			return;
		}
		return this.providers.get(this.activeProviderId);
	}

	/**
	 * Set the active provider. Throws if the provider is not registered.
	 * @param id - The provider ID to activate
	 */
	async setActive(id: string): Promise<void> {
		if (!this.providers.has(id)) {
			throw new Error(`Provider "${id}" is not registered`);
		}
		this.activeProviderId = id;
		await this.configStore.setActiveProvider(id);
		logInfo(`Active provider set to: ${id}`);
	}

	/**
	 * Clear the active provider.
	 */
	async clearActive(): Promise<void> {
		this.activeProviderId = undefined;
		await this.configStore.clearActiveProvider();
		logInfo("Active provider cleared");
	}

	/**
	 * Restore the active provider from the config store.
	 * Called on extension activation to resume state.
	 */
	async restoreActive(): Promise<void> {
		const storedId = await this.configStore.getActiveProvider();
		if (storedId && this.providers.has(storedId)) {
			this.activeProviderId = storedId;
			logInfo(`Active provider restored: ${storedId}`);
		} else if (storedId) {
			logError(`Stored active provider "${storedId}" not found in registry`);
		}
	}
}
