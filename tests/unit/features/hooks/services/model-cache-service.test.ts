import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VsCodeLmApi } from "../../../../../src/features/hooks/services/model-cache-service";

describe("ModelCacheService", () => {
	let selectChatModelsMock: ReturnType<typeof vi.fn>;
	let onDidChangeChatModelsMock: ReturnType<typeof vi.fn>;
	let changeChatModelsListeners: Array<() => void>;
	let currentLm: VsCodeLmApi | undefined;

	const FAKE_MODELS = [
		{
			id: "claude-sonnet-4.5",
			name: "Claude Sonnet 4.5",
			family: "claude",
			maxInputTokens: 200_000,
			vendor: "copilot",
			version: "4.5",
			sendRequest: vi.fn(),
			countTokens: vi.fn(),
		},
		{
			id: "gpt-4o",
			name: "GPT-4o",
			family: "gpt-4",
			maxInputTokens: 128_000,
			vendor: "copilot",
			version: "4o",
			sendRequest: vi.fn(),
			countTokens: vi.fn(),
		},
	];

	beforeEach(() => {
		vi.useFakeTimers();
		changeChatModelsListeners = [];
		selectChatModelsMock = vi.fn().mockResolvedValue(FAKE_MODELS);
		onDidChangeChatModelsMock = vi.fn((listener: () => void) => {
			changeChatModelsListeners.push(listener);
			return { dispose: vi.fn() };
		});
		currentLm = {
			selectChatModels: selectChatModelsMock,
			onDidChangeChatModels: onDidChangeChatModelsMock,
		};
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
		vi.resetModules();
	});

	async function createService() {
		// Dynamic import after vi.resetModules ensures fresh module state.
		// Pass a getLm factory so no require("vscode") is needed in tests.
		const { ModelCacheService } = await import(
			"../../../../../src/features/hooks/services/model-cache-service"
		);
		return new ModelCacheService(() => currentLm);
	}

	describe("getAvailableModels", () => {
		it("fresh fetch populates cache and returns model list", async () => {
			const service = await createService();
			const result = await service.getAvailableModels();

			expect(selectChatModelsMock).toHaveBeenCalledOnce();
			expect(result.models).toHaveLength(2);
			expect(result.models[0]).toEqual({
				id: "claude-sonnet-4.5",
				name: "Claude Sonnet 4.5",
				family: "claude",
				maxInputTokens: 200_000,
			});
			expect(result.isStale).toBe(false);

			service.dispose();
		});

		it("returns cached result within TTL without re-fetching", async () => {
			const service = await createService();

			await service.getAvailableModels();
			await service.getAvailableModels();

			// Should only have called selectChatModels once
			expect(selectChatModelsMock).toHaveBeenCalledOnce();

			service.dispose();
		});

		it("re-fetches when TTL expires (5 minutes)", async () => {
			const service = await createService();

			await service.getAvailableModels();
			// Advance time past 5-minute TTL
			vi.advanceTimersByTime(5 * 60 * 1000 + 1);
			await service.getAvailableModels();

			expect(selectChatModelsMock).toHaveBeenCalledTimes(2);

			service.dispose();
		});

		it("forceRefresh bypasses cache and re-fetches", async () => {
			const service = await createService();

			await service.getAvailableModels();
			await service.getAvailableModels(true);

			expect(selectChatModelsMock).toHaveBeenCalledTimes(2);

			service.dispose();
		});

		it("onDidChangeChatModels invalidates cache so next call re-fetches", async () => {
			const service = await createService();

			await service.getAvailableModels();
			expect(selectChatModelsMock).toHaveBeenCalledOnce();

			// Fire the model change event
			for (const listener of changeChatModelsListeners) {
				listener();
			}

			await service.getAvailableModels();
			expect(selectChatModelsMock).toHaveBeenCalledTimes(2);

			service.dispose();
		});

		it("returns stale cache with isStale=true when fetch fails after first success", async () => {
			const service = await createService();

			// First successful fetch populates cache
			await service.getAvailableModels();

			// Next forced fetch will fail
			selectChatModelsMock.mockRejectedValueOnce(new Error("Network error"));
			const result = await service.getAvailableModels(true);

			// Should return stale cache without throwing
			expect(result.isStale).toBe(true);
			expect(result.models).toHaveLength(2);

			service.dispose();
		});

		it("returns empty models with isStale=true on first fetch failure (no cache)", async () => {
			selectChatModelsMock.mockRejectedValue(new Error("Network error"));

			const service = await createService();
			const result = await service.getAvailableModels();

			expect(result.models).toEqual([]);
			expect(result.isStale).toBe(true);

			service.dispose();
		});

		it("returns empty models with isStale=true when vscode.lm is undefined", async () => {
			currentLm = undefined;

			const service = await createService();
			const result = await service.getAvailableModels();

			expect(result.models).toEqual([]);
			expect(result.isStale).toBe(true);
			expect(selectChatModelsMock).not.toHaveBeenCalled();

			service.dispose();
		});
	});

	describe("dispose", () => {
		it("disposes event subscription without throwing", async () => {
			const service = await createService();
			await service.getAvailableModels();
			expect(() => service.dispose()).not.toThrow();
		});
	});
});
