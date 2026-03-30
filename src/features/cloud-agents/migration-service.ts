/**
 * Migration Service
 *
 * Auto-migrates existing Devin users to the multi-provider system.
 * Detects legacy Devin credentials/sessions and sets Devin as the active provider.
 *
 * @see specs/016-multi-provider-agents/research.md (Decision 4)
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */

import { logInfo, logDebug, logWarn } from "./logging";
import type { Memento } from "./provider-config-store";
import type { ProviderConfigStore } from "./provider-config-store";
import type { ProviderRegistry } from "./provider-registry";

// ============================================================================
// Legacy Storage Keys
// ============================================================================

const LEGACY_KEYS = {
	DEVIN_SESSIONS: "gatomia.devin.sessions",
	DEVIN_API_TOKEN: "gatomia.devin.apiToken",
} as const;

// ============================================================================
// SecretStorage Interface (subset of vscode.SecretStorage)
// ============================================================================

/**
 * Minimal SecretStorage interface for credential access.
 * Compatible with `vscode.SecretStorage`.
 */
export interface SecretStorage {
	get(key: string): Thenable<string | undefined>;
}

// ============================================================================
// MigrationService
// ============================================================================

/**
 * Handles auto-migration of existing Devin users to the provider-agnostic system.
 *
 * @see specs/016-multi-provider-agents/research.md (Decision 4: Migration Strategy)
 */
export class MigrationService {
	private readonly configStore: ProviderConfigStore;
	private readonly workspaceState: Memento;
	private readonly secrets: SecretStorage;

	constructor(
		configStore: ProviderConfigStore,
		workspaceState: Memento,
		secrets: SecretStorage
	) {
		this.configStore = configStore;
		this.workspaceState = workspaceState;
		this.secrets = secrets;
	}

	/**
	 * Check for legacy Devin data and auto-migrate if needed.
	 * @returns True if migration was performed, false otherwise
	 */
	async migrateIfNeeded(): Promise<boolean> {
		const existing = await this.configStore.getActiveProvider();
		if (existing) {
			logDebug("Provider already configured, skipping migration");
			return false;
		}

		const hasLegacy = await this.detectLegacyDevinStorage();
		if (!hasLegacy) {
			logDebug("No legacy Devin data found, skipping migration");
			return false;
		}

		await this.configStore.setActiveProvider("devin");
		logInfo("Auto-migrated existing Devin user to multi-provider system");
		return true;
	}

	/**
	 * Detect orphaned provider config on activation (FR-021).
	 * If stored activeProviderId does not exist in the registry,
	 * clears the config and returns the orphaned ID.
	 * @param registry - The provider registry to check against
	 * @returns The orphaned provider ID, or undefined if config is valid
	 */
	async detectOrphanedConfig(
		registry: ProviderRegistry
	): Promise<string | undefined> {
		const storedId = await this.configStore.getActiveProvider();
		if (!storedId) {
			return;
		}
		if (registry.get(storedId)) {
			return;
		}
		logWarn(`Orphaned provider config detected: "${storedId}" not in registry`);
		await this.configStore.clearActiveProvider();
		return storedId;
	}

	private async detectLegacyDevinStorage(): Promise<boolean> {
		const hasSessions =
			this.workspaceState.get(LEGACY_KEYS.DEVIN_SESSIONS) !== undefined;
		if (hasSessions) {
			return true;
		}

		const hasToken =
			(await this.secrets.get(LEGACY_KEYS.DEVIN_API_TOKEN)) !== undefined;
		return hasToken;
	}
}
