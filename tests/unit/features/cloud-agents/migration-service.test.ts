/**
 * Migration Service Tests
 *
 * Tests for auto-migration of existing Devin users.
 *
 * @see specs/016-multi-provider-agents/research.md (Decision 4)
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MigrationService } from "../../../../src/features/cloud-agents/migration-service";
import type { ProviderConfigStore } from "../../../../src/features/cloud-agents/provider-config-store";

// ============================================================================
// Helpers
// ============================================================================

function createMockMemento(data: Record<string, unknown> = {}) {
	const store = new Map<string, unknown>(Object.entries(data));
	return {
		get: vi.fn(
			<T>(key: string, defaultValue?: T) =>
				(store.get(key) as T) ?? defaultValue
		),
		update: vi.fn((key: string, value: unknown) => {
			store.set(key, value);
			return Promise.resolve();
		}),
		keys: vi.fn(() => [...store.keys()]),
	};
}

function createMockSecretStorage(data: Record<string, string> = {}) {
	const store = new Map<string, string>(Object.entries(data));
	return {
		get: vi.fn((key: string) => Promise.resolve(store.get(key))),
		store: vi.fn((key: string, value: string) => {
			store.set(key, value);
			return Promise.resolve();
		}),
		delete: vi.fn((key: string) => {
			store.delete(key);
			return Promise.resolve();
		}),
		onDidChange: vi.fn(),
	};
}

function createMockConfigStore(): ProviderConfigStore {
	let active: string | undefined;
	return {
		getActiveProvider: vi.fn(async () => active),
		setActiveProvider: vi.fn((id: string) => {
			active = id;
			return Promise.resolve();
		}),
		clearActiveProvider: vi.fn(),
		getProviderOptions: vi.fn(async () => ({})),
		setProviderOptions: vi.fn(),
	};
}

// ============================================================================
// MigrationService
// ============================================================================

describe("MigrationService", () => {
	let configStore: ProviderConfigStore;

	beforeEach(() => {
		configStore = createMockConfigStore();
	});

	it("should detect existing Devin credentials and set Devin as active", async () => {
		const secrets = createMockSecretStorage({
			"gatomia.devin.apiToken": "apk_test123",
		});
		const memento = createMockMemento();
		const migration = new MigrationService(configStore, memento, secrets);
		const migrated = await migration.migrateIfNeeded();
		expect(migrated).toBe(true);
		expect(configStore.setActiveProvider).toHaveBeenCalledWith("devin");
	});

	it("should detect legacy Devin sessions and set Devin as active", async () => {
		const secrets = createMockSecretStorage();
		const memento = createMockMemento({
			"gatomia.devin.sessions": [{ sessionId: "s1" }],
		});
		const migration = new MigrationService(configStore, memento, secrets);
		const migrated = await migration.migrateIfNeeded();
		expect(migrated).toBe(true);
		expect(configStore.setActiveProvider).toHaveBeenCalledWith("devin");
	});

	it("should skip migration when no legacy data exists", async () => {
		const secrets = createMockSecretStorage();
		const memento = createMockMemento();
		const migration = new MigrationService(configStore, memento, secrets);
		const migrated = await migration.migrateIfNeeded();
		expect(migrated).toBe(false);
		expect(configStore.setActiveProvider).not.toHaveBeenCalled();
	});

	it("should not re-migrate if a provider is already configured", async () => {
		(
			configStore.getActiveProvider as ReturnType<typeof vi.fn>
		).mockResolvedValue("github-copilot");
		const secrets = createMockSecretStorage({
			"gatomia.devin.apiToken": "apk_test123",
		});
		const memento = createMockMemento();
		const migration = new MigrationService(configStore, memento, secrets);
		const migrated = await migration.migrateIfNeeded();
		expect(migrated).toBe(false);
		expect(configStore.setActiveProvider).not.toHaveBeenCalled();
	});
});
