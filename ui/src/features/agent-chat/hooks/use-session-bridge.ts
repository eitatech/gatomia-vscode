/**
 * useSessionBridge — React hook that wires the Agent Chat Panel webview to
 * the extension via the VS Code postMessage bridge.
 *
 * Responsibilities (US1 subset):
 *   - On mount, dispatch `agent-chat/ready` so the extension hydrates the
 *     panel with `agent-chat/session/loaded`.
 *   - Maintain in-memory state for session projection, transcript, and
 *     selector catalogues. React re-renders whenever any of these change.
 *   - Dispatch user actions (submit, cancel, retry, change-mode/model/target)
 *     back to the extension as `agent-chat/*` messages.
 *
 * @see specs/018-agent-chat-panel/contracts/agent-chat-panel-protocol.md
 */

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { vscode } from "@/bridge/vscode";
import type {
	AgentChatSessionView,
	ChatMessage,
	ExecutionTarget,
	ExecutionTargetOption,
	ModeDescriptor,
	ModelDescriptor,
	UserChatMessage,
} from "@/features/agent-chat/types";

// ============================================================================
// Public state + bridge shape
// ============================================================================

export interface AgentChatBridgeState {
	readonly ready: boolean;
	readonly session: AgentChatSessionView | undefined;
	readonly messages: readonly ChatMessage[];
	readonly availableModes: readonly ModeDescriptor[];
	readonly availableModels: readonly ModelDescriptor[];
	readonly availableTargets: readonly ExecutionTargetOption[];
	readonly hasArchivedTranscript: boolean;
}

export interface AgentChatBridge {
	readonly state: AgentChatBridgeState;
	submit(content: string, clientMessageId?: string): void;
	cancel(): void;
	retry(): void;
	changeMode(modeId: string): void;
	changeModel(modelId: string): void;
	changeTarget(target: ExecutionTarget): void;
}

// ============================================================================
// Reducer
// ============================================================================

const INITIAL_STATE: AgentChatBridgeState = {
	ready: false,
	session: undefined,
	messages: [],
	availableModes: [],
	availableModels: [],
	availableTargets: [],
	hasArchivedTranscript: false,
};

type BridgeAction =
	| {
			type: "session/loaded";
			payload: {
				session: AgentChatSessionView;
				messages: ChatMessage[];
				availableModes: ModeDescriptor[];
				availableModels: ModelDescriptor[];
				availableTargets: ExecutionTargetOption[];
				hasArchivedTranscript: boolean;
			};
	  }
	| {
			type: "messages/appended";
			payload: { messages: ChatMessage[] };
	  }
	| {
			type: "messages/updated";
			payload: {
				updates: Array<{ id: string; patch: Partial<ChatMessage> }>;
			};
	  }
	| {
			type: "session/lifecycle-changed";
			payload: { to: AgentChatSessionView["lifecycleState"] };
	  };

function reducer(
	state: AgentChatBridgeState,
	action: BridgeAction
): AgentChatBridgeState {
	switch (action.type) {
		case "session/loaded":
			return {
				ready: true,
				session: action.payload.session,
				messages: [...action.payload.messages],
				availableModes: [...action.payload.availableModes],
				availableModels: [...action.payload.availableModels],
				availableTargets: [...action.payload.availableTargets],
				hasArchivedTranscript: action.payload.hasArchivedTranscript,
			};
		case "messages/appended": {
			const seen = new Set(state.messages.map((m) => m.id));
			const additions = action.payload.messages.filter((m) => !seen.has(m.id));
			if (additions.length === 0) {
				return state;
			}
			return { ...state, messages: [...state.messages, ...additions] };
		}
		case "messages/updated": {
			const patchById = new Map<string, Partial<ChatMessage>>();
			for (const update of action.payload.updates) {
				patchById.set(update.id, update.patch);
			}
			const nextMessages = state.messages.map((m) => {
				const patch = patchById.get(m.id);
				if (!patch) {
					return m;
				}
				return applyPatch(m, patch);
			});
			return { ...state, messages: nextMessages };
		}
		case "session/lifecycle-changed": {
			if (!state.session) {
				return state;
			}
			return {
				...state,
				session: {
					...state.session,
					lifecycleState: action.payload.to,
				},
			};
		}
		default:
			return state;
	}
}

/**
 * Convert an incoming postMessage payload into a reducer action. Returns
 * `undefined` for unknown / unrelated messages so the caller can dispatch
 * unconditionally.
 *
 * Factoring this out of `useSessionBridge` keeps the hook under the project's
 * cognitive-complexity ceiling (biome lint/complexity/noExcessiveCognitiveComplexity).
 */
function translateIncoming(
	sessionId: string,
	data: unknown
): BridgeAction | undefined {
	const typed = data as { type?: string; payload?: unknown } | undefined;
	if (!typed?.type) {
		return;
	}
	switch (typed.type) {
		case "agent-chat/session/loaded": {
			const payload = typed.payload as {
				session: AgentChatSessionView;
				messages: ChatMessage[];
				availableModes: ModeDescriptor[];
				availableModels: ModelDescriptor[];
				availableTargets: ExecutionTargetOption[];
				hasArchivedTranscript: boolean;
			};
			if (payload.session.id !== sessionId) {
				return;
			}
			return { type: "session/loaded", payload };
		}
		case "agent-chat/messages/appended": {
			const payload = typed.payload as {
				sessionId: string;
				messages: ChatMessage[];
			};
			if (payload.sessionId !== sessionId) {
				return;
			}
			return {
				type: "messages/appended",
				payload: { messages: payload.messages },
			};
		}
		case "agent-chat/messages/updated": {
			const payload = typed.payload as {
				sessionId: string;
				updates: Array<{ id: string; patch: Partial<ChatMessage> }>;
			};
			if (payload.sessionId !== sessionId) {
				return;
			}
			return {
				type: "messages/updated",
				payload: { updates: payload.updates },
			};
		}
		case "agent-chat/session/lifecycle-changed": {
			const payload = typed.payload as {
				sessionId: string;
				to: AgentChatSessionView["lifecycleState"];
			};
			if (payload.sessionId !== sessionId) {
				return;
			}
			return {
				type: "session/lifecycle-changed",
				payload: { to: payload.to },
			};
		}
		default:
			return;
	}
}

/**
 * Apply a partial patch to a discriminated-union ChatMessage without widening
 * the variant. Uses a per-variant switch so we never silently drop a role
 * change.
 */
function applyPatch(
	message: ChatMessage,
	patch: Partial<ChatMessage>
): ChatMessage {
	switch (message.role) {
		case "user": {
			const typedPatch = patch as Partial<UserChatMessage>;
			return { ...message, ...typedPatch };
		}
		case "agent":
			return { ...message, ...(patch as Partial<typeof message>) };
		case "system":
			return { ...message, ...(patch as Partial<typeof message>) };
		case "tool":
			return { ...message, ...(patch as Partial<typeof message>) };
		case "error":
			return { ...message, ...(patch as Partial<typeof message>) };
		default:
			return message;
	}
}

// ============================================================================
// Hook
// ============================================================================

export function useSessionBridge(sessionId: string): AgentChatBridge {
	const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

	// Send ready + subscribe to incoming messages on mount.
	useEffect(() => {
		vscode.postMessage({
			type: "agent-chat/ready",
			payload: { sessionId },
		});

		const handler = (event: MessageEvent): void => {
			const action = translateIncoming(sessionId, event.data);
			if (action) {
				dispatch(action);
			}
		};

		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, [sessionId]);

	const submit = useCallback(
		(content: string, clientMessageId?: string) => {
			vscode.postMessage({
				type: "agent-chat/input/submit",
				payload: {
					sessionId,
					content,
					clientMessageId,
				},
			});
		},
		[sessionId]
	);

	const cancel = useCallback(() => {
		vscode.postMessage({
			type: "agent-chat/control/cancel",
			payload: { sessionId },
		});
	}, [sessionId]);

	const retry = useCallback(() => {
		vscode.postMessage({
			type: "agent-chat/control/retry",
			payload: { sessionId },
		});
	}, [sessionId]);

	const changeMode = useCallback(
		(modeId: string) => {
			vscode.postMessage({
				type: "agent-chat/control/change-mode",
				payload: { sessionId, modeId },
			});
		},
		[sessionId]
	);

	const changeModel = useCallback(
		(modelId: string) => {
			vscode.postMessage({
				type: "agent-chat/control/change-model",
				payload: { sessionId, modelId },
			});
		},
		[sessionId]
	);

	const changeTarget = useCallback(
		(target: ExecutionTarget) => {
			vscode.postMessage({
				type: "agent-chat/control/change-target",
				payload: { sessionId, target },
			});
		},
		[sessionId]
	);

	return useMemo<AgentChatBridge>(
		() => ({
			state,
			submit,
			cancel,
			retry,
			changeMode,
			changeModel,
			changeTarget,
		}),
		[state, submit, cancel, retry, changeMode, changeModel, changeTarget]
	);
}
