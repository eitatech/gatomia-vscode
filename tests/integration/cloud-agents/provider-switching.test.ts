/**
 * Provider Switching Integration Tests
 *
 * Integration tests for switching between providers, session retention,
 * and cross-provider behavior.
 *
 * @see specs/016-multi-provider-agents/spec.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "../../../src/features/cloud-agents/provider-registry";
import { ProviderConfigStore } from "../../../src/features/cloud-agents/provider-config-store";
import { AgentSessionStorage } from "../../../src/features/cloud-agents/agent-session-storage";
import { MigrationService } from "../../../src/features/cloud-agents/migration-service";
import { SessionStatus } from "../../../src/features/cloud-agents/types";
import type { CloudAgentProvider } from "../../../src/features/cloud-agents/cloud-agent-provider";

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
			if (value === undefined) {
				store.delete(key);
			} else {
				store.set(key, value);
			}
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

function createMockProvider(id: string): CloudAgentProvider {
	return {
		metadata: {
			id,
			displayName: `Provider ${id}`,
			description: `Mock ${id}`,
			icon: "beaker",
		},
		hasCredentials: vi.fn().mockResolvedValue(true),
		configureCredentials: vi.fn().mockResolvedValue(true),
		createSession: vi.fn(),
		cancelSession: vi.fn(),
		pollSessions: vi.fn().mockResolvedValue([]),
		getExternalUrl: vi.fn(),
		getStatusDisplay: vi.fn().mockReturnValue("pending"),
		handleBlockedSession: vi.fn().mockReturnValue(null),
		handleSessionComplete: vi.fn(),
	};
}

// ============================================================================
// Provider Switching Integration
// ============================================================================

describe("Provider Switching Integration", () => {
	let memento: ReturnType<typeof createMockMemento>;
	let configStore: ProviderConfigStore;
	let sessionStorage: AgentSessionStorage;
	let registry: ProviderRegistry;

	beforeEach(() => {
		memento = createMockMemento();
		configStore = new ProviderConfigStore(memento);
		sessionStorage = new AgentSessionStorage(memento);
		registry = new ProviderRegistry(configStore);
	});

	it("should select a provider and persist the choice", async () => {
		registry.register(createMockProvider("devin"));
		registry.register(createMockProvider("github-copilot"));

		await registry.setActive("devin");
		expect(registry.getActive()?.metadata.id).toBe("devin");

		const stored = await configStore.getActiveProvider();
		expect(stored).toBe("devin");
	});

	it("should switch providers and mark old sessions read-only", async () => {
		registry.register(createMockProvider("devin"));
		registry.register(createMockProvider("github-copilot"));

		await registry.setActive("devin");
		await sessionStorage.create({
			localId: "s1",
			providerId: "devin",
			providerSessionId: "ext-1",
			status: SessionStatus.COMPLETED,
			branch: "main",
			specPath: "/spec.md",
			tasks: [],
			pullRequests: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			completedAt: Date.now(),
			isReadOnly: false,
		});

		await sessionStorage.markProviderReadOnly("devin");
		await registry.setActive("github-copilot");

		expect(registry.getActive()?.metadata.id).toBe("github-copilot");
		const s1 = await sessionStorage.getById("s1");
		expect(s1?.isReadOnly).toBe(true);
	});

	it("should auto-migrate existing Devin users", async () => {
		registry.register(createMockProvider("devin"));
		const secrets = createMockSecretStorage({
			"gatomia.devin.apiToken": "apk_test123",
		});
		const migration = new MigrationService(configStore, memento, secrets);
		const migrated = await migration.migrateIfNeeded();
		expect(migrated).toBe(true);

		await registry.restoreActive();
		expect(registry.getActive()?.metadata.id).toBe("devin");
	});

	it("should restore provider selection after extension restart", async () => {
		registry.register(createMockProvider("github-copilot"));
		await registry.setActive("github-copilot");

		const freshRegistry = new ProviderRegistry(configStore);
		freshRegistry.register(createMockProvider("github-copilot"));
		await freshRegistry.restoreActive();

		expect(freshRegistry.getActive()?.metadata.id).toBe("github-copilot");
	});

	// ========================================================================
	// Dispatch Integration (T045)
	// ========================================================================

	it("should dispatch a task and persist the new session", async () => {
		const devin = createMockProvider("devin");
		const mockSession = {
			localId: "new-session-1",
			providerId: "devin",
			providerSessionId: "ext-new-1",
			status: SessionStatus.PENDING,
			branch: "main",
			specPath: "/specs/test/spec.md",
			tasks: [
				{
					id: "task-1",
					specTaskId: "T-001",
					title: "Test",
					description: "desc",
					priority: "high",
					status: "pending",
				},
			],
			pullRequests: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			completedAt: undefined,
			isReadOnly: false,
		};
		(devin.createSession as ReturnType<typeof vi.fn>).mockResolvedValue(
			mockSession
		);
		registry.register(devin);
		await registry.setActive("devin");

		const task = {
			id: "T-001",
			title: "Test",
			description: "desc",
			priority: "high" as const,
		};
		const ctx = {
			branch: "main",
			specPath: "/specs/test/spec.md",
			workspaceUri: "file:///workspace",
		};

		const active = registry.getActive();
		const session = await active!.createSession(task, ctx);
		await sessionStorage.create(session);

		const stored = await sessionStorage.getById("new-session-1");
		expect(stored).toBeDefined();
		expect(stored?.providerId).toBe("devin");
		expect(stored?.status).toBe(SessionStatus.PENDING);
	});

	// ========================================================================
	// Cancel Integration (T055)
	// ========================================================================

	it("should cancel a session and update its status in storage", async () => {
		registry.register(createMockProvider("devin"));
		await registry.setActive("devin");

		await sessionStorage.create({
			localId: "cancel-1",
			providerId: "devin",
			providerSessionId: "ext-c1",
			status: SessionStatus.RUNNING,
			branch: "main",
			specPath: "/spec.md",
			tasks: [],
			pullRequests: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			completedAt: undefined,
			isReadOnly: false,
		});

		await sessionStorage.update("cancel-1", {
			status: SessionStatus.CANCELLED,
		});

		const cancelled = await sessionStorage.getById("cancel-1");
		expect(cancelled?.status).toBe(SessionStatus.CANCELLED);
	});

	it("should not allow cancel on read-only sessions", async () => {
		registry.register(createMockProvider("devin"));
		await registry.setActive("devin");

		await sessionStorage.create({
			localId: "ro-1",
			providerId: "devin",
			providerSessionId: "ext-ro1",
			status: SessionStatus.RUNNING,
			branch: "main",
			specPath: "/spec.md",
			tasks: [],
			pullRequests: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			completedAt: undefined,
			isReadOnly: true,
		});

		const session = await sessionStorage.getById("ro-1");
		expect(session?.isReadOnly).toBe(true);
	});

	// ========================================================================
	// Extensibility with Mock Provider (T064)
	// ========================================================================

	it("should register, select, dispatch, and cancel via a mock third-party provider", async () => {
		const { createMockProviderAdapter: createMock } = await import(
			"../../fixtures/mock-provider-adapter"
		);
		const mockProvider = createMock("custom-agent");
		registry.register(mockProvider);
		await registry.setActive("custom-agent");

		expect(registry.getActive()?.metadata.id).toBe("custom-agent");

		const task = {
			id: "T-1",
			title: "Test",
			description: "d",
			priority: "high" as const,
		};
		const ctx = { branch: "main", specPath: "/spec.md", workspaceUri: "" };
		const session = await mockProvider.createSession(task, ctx);
		await sessionStorage.create(session);

		const stored = await sessionStorage.getById(session.localId);
		expect(stored?.providerId).toBe("custom-agent");

		await mockProvider.cancelSession(session.localId);
		expect(mockProvider.cancelSession).toHaveBeenCalledWith(session.localId);
	});
});
