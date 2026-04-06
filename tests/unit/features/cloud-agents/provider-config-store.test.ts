/**
 * Provider Config Store Tests
 *
 * Tests for provider configuration persistence using workspace state.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderConfigStore } from "../../../../src/features/cloud-agents/provider-config-store";

// ============================================================================
// Helpers
// ============================================================================

function createMockMemento() {
	const store = new Map<string, unknown>();
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

// ============================================================================
// ProviderConfigStore
// ============================================================================

describe("ProviderConfigStore", () => {
	let configStore: ProviderConfigStore;
	let memento: ReturnType<typeof createMockMemento>;

	beforeEach(() => {
		memento = createMockMemento();
		configStore = new ProviderConfigStore(memento);
	});

	describe("active provider", () => {
		it("should return undefined when no active provider is set", async () => {
			const result = await configStore.getActiveProvider();
			expect(result).toBeUndefined();
		});

		it("should persist and retrieve active provider", async () => {
			await configStore.setActiveProvider("devin");
			const result = await configStore.getActiveProvider();
			expect(result).toBe("devin");
		});

		it("should overwrite existing active provider", async () => {
			await configStore.setActiveProvider("devin");
			await configStore.setActiveProvider("github-copilot");
			const result = await configStore.getActiveProvider();
			expect(result).toBe("github-copilot");
		});

		it("should clear active provider", async () => {
			await configStore.setActiveProvider("devin");
			await configStore.clearActiveProvider();
			const result = await configStore.getActiveProvider();
			expect(result).toBeUndefined();
		});
	});

	describe("provider options", () => {
		it("should return empty object for unconfigured provider", async () => {
			const result = await configStore.getProviderOptions("devin");
			expect(result).toEqual({});
		});

		it("should persist and retrieve provider-specific options", async () => {
			const options = { orgId: "org-123", apiVersion: "v3" };
			await configStore.setProviderOptions("devin", options);
			const result = await configStore.getProviderOptions("devin");
			expect(result).toEqual(options);
		});

		it("should isolate options between providers", async () => {
			await configStore.setProviderOptions("devin", { key: "devin-val" });
			await configStore.setProviderOptions("github-copilot", {
				key: "gh-val",
			});
			expect(await configStore.getProviderOptions("devin")).toEqual({
				key: "devin-val",
			});
			expect(await configStore.getProviderOptions("github-copilot")).toEqual({
				key: "gh-val",
			});
		});
	});
});
