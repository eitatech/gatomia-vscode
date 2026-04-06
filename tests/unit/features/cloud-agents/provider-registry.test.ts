/**
 * Provider Registry Tests
 *
 * Tests for provider registration, active-provider orchestration, and listing.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "../../../../src/features/cloud-agents/provider-registry";
import type { CloudAgentProvider } from "../../../../src/features/cloud-agents/cloud-agent-provider";
import type { ProviderConfigStore } from "../../../../src/features/cloud-agents/provider-config-store";

// ============================================================================
// Helpers
// ============================================================================

function createMockProvider(id: string): CloudAgentProvider {
	return {
		metadata: {
			id,
			displayName: `Provider ${id}`,
			description: `Mock provider ${id}`,
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

function createMockConfigStore(): ProviderConfigStore {
	let active: string | undefined;
	return {
		getActiveProvider: vi.fn(async () => active),
		setActiveProvider: vi.fn((id: string) => {
			active = id;
			return Promise.resolve();
		}),
		clearActiveProvider: vi.fn(() => {
			active = undefined;
			return Promise.resolve();
		}),
		getProviderOptions: vi.fn(async () => ({})),
		setProviderOptions: vi.fn(),
	};
}

// ============================================================================
// ProviderRegistry
// ============================================================================

describe("ProviderRegistry", () => {
	let registry: ProviderRegistry;
	let configStore: ProviderConfigStore;

	beforeEach(() => {
		configStore = createMockConfigStore();
		registry = new ProviderRegistry(configStore);
	});

	it("should register a provider", () => {
		const provider = createMockProvider("devin");
		registry.register(provider);
		expect(registry.get("devin")).toBe(provider);
	});

	it("should return undefined for unregistered provider", () => {
		expect(registry.get("nonexistent")).toBeUndefined();
	});

	it("should list all registered providers", () => {
		registry.register(createMockProvider("devin"));
		registry.register(createMockProvider("github-copilot"));
		const all = registry.getAll();
		expect(all).toHaveLength(2);
		expect(all.map((p) => p.metadata.id)).toContain("devin");
		expect(all.map((p) => p.metadata.id)).toContain("github-copilot");
	});

	it("should throw on duplicate provider registration", () => {
		registry.register(createMockProvider("devin"));
		expect(() => registry.register(createMockProvider("devin"))).toThrow();
	});

	it("should set and get the active provider", async () => {
		registry.register(createMockProvider("devin"));
		await registry.setActive("devin");
		expect(registry.getActive()?.metadata.id).toBe("devin");
	});

	it("should persist active provider via config store", async () => {
		registry.register(createMockProvider("devin"));
		await registry.setActive("devin");
		expect(configStore.setActiveProvider).toHaveBeenCalledWith("devin");
	});

	it("should throw when setting unknown provider as active", async () => {
		await expect(registry.setActive("unknown")).rejects.toThrow();
	});

	it("should return undefined active when none is set", () => {
		expect(registry.getActive()).toBeUndefined();
	});

	it("should restore active provider from config store", async () => {
		registry.register(createMockProvider("devin"));
		(
			configStore.getActiveProvider as ReturnType<typeof vi.fn>
		).mockResolvedValue("devin");
		await registry.restoreActive();
		expect(registry.getActive()?.metadata.id).toBe("devin");
	});

	it("should clear active provider", async () => {
		registry.register(createMockProvider("devin"));
		await registry.setActive("devin");
		await registry.clearActive();
		expect(registry.getActive()).toBeUndefined();
		expect(configStore.clearActiveProvider).toHaveBeenCalled();
	});
});
