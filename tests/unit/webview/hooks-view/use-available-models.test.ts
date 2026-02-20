import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvailableModels } from "../../../../ui/src/features/hooks-view/hooks/use-available-models";

// Helper to dispatch a message event from "the extension"
function dispatchExtensionMessage(data: unknown) {
	window.dispatchEvent(new MessageEvent("message", { data }));
}

describe("useAvailableModels", () => {
	let postMessageMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		postMessageMock = vi.fn();
		(window as { acquireVsCodeApi?: unknown }).acquireVsCodeApi = () => ({
			postMessage: postMessageMock,
			getState: vi.fn(),
			setState: vi.fn(),
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		(window as { acquireVsCodeApi?: unknown }).acquireVsCodeApi = undefined;
	});

	it("starts in loading state with empty models", () => {
		const { result } = renderHook(() => useAvailableModels());

		expect(result.current.isLoading).toBe(true);
		expect(result.current.models).toEqual([]);
		expect(result.current.error).toBeUndefined();
		expect(result.current.isStale).toBe(false);
	});

	it("sends hooks/models-request message on mount", () => {
		renderHook(() => useAvailableModels());

		expect(postMessageMock).toHaveBeenCalledOnce();
		expect(postMessageMock).toHaveBeenCalledWith(
			expect.objectContaining({ type: "hooks/models-request" })
		);
	});

	it("transitions to populated state after hooks/models-available message", async () => {
		const { result } = renderHook(() => useAvailableModels());

		await act(() => {
			dispatchExtensionMessage({
				type: "hooks/models-available",
				models: [
					{
						id: "claude-sonnet-4.5",
						name: "Claude Sonnet 4.5",
						family: "claude",
						maxInputTokens: 200_000,
					},
				],
				isStale: false,
			});
		});

		expect(result.current.isLoading).toBe(false);
		expect(result.current.models).toHaveLength(1);
		expect(result.current.models[0].id).toBe("claude-sonnet-4.5");
		expect(result.current.error).toBeUndefined();
		expect(result.current.isStale).toBe(false);
	});

	it("sets isStale=true when models-available has isStale=true", async () => {
		const { result } = renderHook(() => useAvailableModels());

		await act(() => {
			dispatchExtensionMessage({
				type: "hooks/models-available",
				models: [
					{
						id: "gpt-4o",
						name: "GPT-4o",
						family: "gpt-4",
						maxInputTokens: 128_000,
					},
				],
				isStale: true,
			});
		});

		expect(result.current.isStale).toBe(true);
		expect(result.current.models).toHaveLength(1);
		expect(result.current.isLoading).toBe(false);
	});

	it("transitions to error state after hooks/models-error message", async () => {
		const { result } = renderHook(() => useAvailableModels());

		await act(() => {
			dispatchExtensionMessage({
				type: "hooks/models-error",
				message: "Failed to fetch models: API unavailable",
			});
		});

		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBe(
			"Failed to fetch models: API unavailable"
		);
		expect(result.current.models).toEqual([]);
	});

	it("ignores unrelated messages", async () => {
		const { result } = renderHook(() => useAvailableModels());

		await act(() => {
			dispatchExtensionMessage({ type: "hooks/sync", payload: { hooks: [] } });
		});

		expect(result.current.isLoading).toBe(true);
		expect(result.current.models).toEqual([]);
	});

	it("clears error when subsequent models-available message arrives", async () => {
		const { result } = renderHook(() => useAvailableModels());

		await act(() => {
			dispatchExtensionMessage({
				type: "hooks/models-error",
				message: "Temporary error",
			});
		});

		expect(result.current.error).toBe("Temporary error");

		await act(() => {
			dispatchExtensionMessage({
				type: "hooks/models-available",
				models: [],
				isStale: false,
			});
		});

		expect(result.current.error).toBeUndefined();
	});
});
