/**
 * Provider Configuration Store
 *
 * Manages workspace-backed provider configuration persistence.
 * Stores the active provider preference and provider-specific options.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 * @see specs/016-multi-provider-agents/data-model.md
 */

import { logInfo } from "./logging";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
	ACTIVE_PROVIDER: "gatomia.cloudAgent.activeProvider",
	PROVIDER_OPTIONS_PREFIX: "gatomia.cloudAgent.options.",
} as const;

// ============================================================================
// Memento Interface (subset of vscode.Memento)
// ============================================================================

/**
 * Minimal Memento interface for workspace state access.
 * Compatible with `vscode.Memento` (ExtensionContext.workspaceState).
 */
export interface Memento {
	get<T>(key: string, defaultValue?: T): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
}

// ============================================================================
// ProviderConfigStore
// ============================================================================

/**
 * Workspace-backed provider configuration persistence.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */
export class ProviderConfigStore {
	private readonly workspaceState: Memento;

	constructor(workspaceState: Memento) {
		this.workspaceState = workspaceState;
	}

	/**
	 * Get the currently active provider ID for this workspace.
	 * @returns Provider ID or undefined if not configured
	 */
	getActiveProvider(): Promise<string | undefined> {
		return Promise.resolve(
			this.workspaceState.get<string>(STORAGE_KEYS.ACTIVE_PROVIDER)
		);
	}

	/**
	 * Set the active provider for this workspace.
	 * @param providerId - The provider to activate
	 */
	async setActiveProvider(providerId: string): Promise<void> {
		await this.workspaceState.update(STORAGE_KEYS.ACTIVE_PROVIDER, providerId);
		logInfo(`Active provider persisted: ${providerId}`);
	}

	/**
	 * Clear the active provider configuration.
	 */
	async clearActiveProvider(): Promise<void> {
		await this.workspaceState.update(STORAGE_KEYS.ACTIVE_PROVIDER, undefined);
		logInfo("Active provider cleared from storage");
	}

	/**
	 * Get provider-specific configuration options.
	 * @param providerId - The provider to get options for
	 * @returns Options object or empty object if none stored
	 */
	getProviderOptions(providerId: string): Promise<Record<string, unknown>> {
		const key = `${STORAGE_KEYS.PROVIDER_OPTIONS_PREFIX}${providerId}`;
		return Promise.resolve(
			this.workspaceState.get<Record<string, unknown>>(key) ?? {}
		);
	}

	/**
	 * Set provider-specific configuration options.
	 * @param providerId - The provider to configure
	 * @param options - Options to store
	 */
	async setProviderOptions(
		providerId: string,
		options: Record<string, unknown>
	): Promise<void> {
		const key = `${STORAGE_KEYS.PROVIDER_OPTIONS_PREFIX}${providerId}`;
		await this.workspaceState.update(key, options);
	}
}
