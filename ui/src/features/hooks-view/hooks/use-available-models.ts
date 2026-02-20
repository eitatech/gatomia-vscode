import { useEffect, useState } from "react";
import type { LanguageModelInfoPayload } from "../types";

/**
 * State returned by the useAvailableModels hook.
 */
export interface UseAvailableModelsState {
	/** Available language models, populated after the first successful fetch. */
	models: LanguageModelInfoPayload[];
	/** True while awaiting the first response from the extension. */
	isLoading: boolean;
	/** True when models are from stale cache (fetch failed but cache exists). */
	isStale: boolean;
	/** Error message when model fetch fails. Cleared on next successful fetch. */
	error: string | undefined;
}

/**
 * Message sent to the extension to request the available model list.
 */
interface ModelsRequestMessage {
	type: "hooks/models-request";
	command: "hooks.models-request";
	payload?: { forceRefresh?: boolean };
}

/**
 * Message received from the extension with available models.
 */
interface ModelsAvailableMessage {
	type: "hooks/models-available";
	models: LanguageModelInfoPayload[];
	isStale: boolean;
}

/**
 * Message received from the extension when model fetch fails.
 */
interface ModelsErrorMessage {
	type: "hooks/models-error";
	message: string;
}

/**
 * Sends a message to the VS Code extension via the acquireVsCodeApi bridge.
 * Called lazily at post time (not at module load) so test mocks set up in
 * beforeEach are picked up correctly.
 */
function postToExtension(message: ModelsRequestMessage): void {
	const api = window.acquireVsCodeApi?.();
	if (api) {
		api.postMessage(message);
	}
}

const MODELS_AVAILABLE_TYPE = "hooks/models-available";
const MODELS_ERROR_TYPE = "hooks/models-error";

interface ModelHandlers {
	onAvailable: (models: LanguageModelInfoPayload[], isStale: boolean) => void;
	onError: (message: string) => void;
}

/**
 * Processes a raw window message event and dispatches to the appropriate handler.
 * Extracted to keep cognitive complexity within bounds.
 */
function processModelMessage(
	data: Record<string, unknown>,
	handlers: ModelHandlers
): void {
	const messageType = data.type;
	if (messageType === MODELS_AVAILABLE_TYPE) {
		const msg = data as unknown as ModelsAvailableMessage;
		handlers.onAvailable(
			Array.isArray(msg.models) ? msg.models : [],
			Boolean(msg.isStale)
		);
		return;
	}
	if (messageType === MODELS_ERROR_TYPE) {
		const msg = data as unknown as ModelsErrorMessage;
		if (typeof msg.message === "string") {
			handlers.onError(msg.message);
		}
	}
}

/**
 * Hook that fetches the available GitHub Copilot language models from the
 * extension backend (via ModelCacheService) and keeps UI in sync.
 *
 * On mount it sends `hooks/models-request` to the extension. The extension
 * responds with either `hooks/models-available` or `hooks/models-error`.
 */
export function useAvailableModels(): UseAvailableModelsState {
	const [models, setModels] = useState<LanguageModelInfoPayload[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isStale, setIsStale] = useState(false);
	const [error, setError] = useState<string | undefined>();

	// Handle incoming messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent<Record<string, unknown>>) => {
			const data = event.data;
			if (!data || typeof data !== "object") {
				return;
			}
			processModelMessage(data, {
				onAvailable: (availableModels, stale) => {
					setModels(availableModels);
					setIsStale(stale);
					setIsLoading(false);
					setError(undefined);
				},
				onError: (msg) => {
					setError(msg);
					setIsLoading(false);
				},
			});
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, []);

	// Request models on mount
	useEffect(() => {
		postToExtension({
			type: "hooks/models-request",
			command: "hooks.models-request",
		});
	}, []);

	return { models, isLoading, isStale, error };
}
