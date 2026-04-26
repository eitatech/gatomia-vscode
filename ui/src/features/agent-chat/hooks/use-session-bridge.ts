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
	AgentChatCatalog,
	AgentChatSessionView,
	ChatMessage,
	ExecutionTarget,
	ExecutionTargetOption,
	ModeDescriptor,
	ModelDescriptor,
	NewSessionRequest,
	PendingFileWriteSummary,
	SidebarSessionListItem,
	UserChatMessage,
} from "@/features/agent-chat/types";

// ============================================================================
// Public state + bridge shape
// ============================================================================

export type ClearReason =
	| "new-session-requested"
	| "ready-no-binding"
	| "session-not-found";

export interface AgentChatBridgeState {
	readonly ready: boolean;
	readonly session: AgentChatSessionView | undefined;
	readonly messages: readonly ChatMessage[];
	readonly availableModes: readonly ModeDescriptor[];
	readonly availableModels: readonly ModelDescriptor[];
	readonly availableTargets: readonly ExecutionTargetOption[];
	readonly hasArchivedTranscript: boolean;
	/** Sidebar-only: catalogue of providers/models/agent-files. */
	readonly catalog: AgentChatCatalog;
	/** Sidebar-only: every session known to host (active + recent). */
	readonly sessions: readonly SidebarSessionListItem[];
	/** Last "session/cleared" reason emitted by the host (sidebar-only). */
	readonly clearedReason: ClearReason | undefined;
	/** Pending file writes the agent is awaiting Accept/Reject for. */
	readonly pendingWrites: readonly PendingFileWriteSummary[];
}

export interface AgentChatBridge {
	readonly state: AgentChatBridgeState;
	submit(content: string, clientMessageId?: string): void;
	cancel(): void;
	retry(): void;
	changeMode(modeId: string): void;
	changeModel(modelId: string): void;
	changeTarget(target: ExecutionTarget): void;
	/** Sidebar-only: switch the bound session via the host. */
	switchSession(sessionId: string): void;
	/** Sidebar-only: launch a new session from the empty composer. */
	startNewSession(request: NewSessionRequest): void;
	/** Sidebar-only: ask the host to unbind so the empty composer renders. */
	requestNewChat(): void;
	/** Phase 4: settle every pending file write at once. */
	acceptAllPendingWrites(): void;
	rejectAllPendingWrites(): void;
	acceptPendingWrite(id: string): void;
	rejectPendingWrite(id: string): void;
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
	catalog: { providers: [], agentFiles: [] },
	sessions: [],
	clearedReason: undefined,
	pendingWrites: [],
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
	  }
	| {
			type: "session/cleared";
			payload: { reason: ClearReason };
	  }
	| {
			type: "catalog/loaded";
			payload: { catalog: AgentChatCatalog };
	  }
	| {
			type: "sessions/list-changed";
			payload: { sessions: SidebarSessionListItem[] };
	  }
	| {
			type: "pending-writes/changed";
			payload: { writes: readonly PendingFileWriteSummary[] };
	  };

function reducer(
	state: AgentChatBridgeState,
	action: BridgeAction
): AgentChatBridgeState {
	switch (action.type) {
		case "session/loaded":
			return {
				...state,
				ready: true,
				session: action.payload.session,
				messages: [...action.payload.messages],
				availableModes: [...action.payload.availableModes],
				availableModels: [...action.payload.availableModels],
				availableTargets: [...action.payload.availableTargets],
				hasArchivedTranscript: action.payload.hasArchivedTranscript,
				clearedReason: undefined,
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
		case "session/cleared":
			return {
				...state,
				ready: true,
				session: undefined,
				messages: [],
				availableModes: [],
				availableModels: [],
				hasArchivedTranscript: false,
				clearedReason: action.payload.reason,
			};
		case "catalog/loaded":
			return { ...state, catalog: action.payload.catalog };
		case "sessions/list-changed":
			return { ...state, sessions: action.payload.sessions };
		case "pending-writes/changed":
			return { ...state, pendingWrites: action.payload.writes };
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
	activeSessionId: string | undefined,
	initialSessionId: string | undefined,
	data: unknown
): BridgeAction | undefined {
	const typed = data as { type?: string; payload?: unknown } | undefined;
	if (!typed?.type) {
		return;
	}
	const handler = INCOMING_HANDLERS[typed.type];
	if (!handler) {
		return;
	}
	return handler({
		payload: typed.payload,
		activeSessionId,
		initialSessionId,
	});
}

interface TranslateContext {
	payload: unknown;
	activeSessionId: string | undefined;
	initialSessionId: string | undefined;
}

const INCOMING_HANDLERS: Record<
	string,
	(ctx: TranslateContext) => BridgeAction | undefined
> = {
	"agent-chat/session/loaded": (ctx) => {
		const payload = ctx.payload as {
			session: AgentChatSessionView;
			messages: ChatMessage[];
			availableModes: ModeDescriptor[];
			availableModels: ModelDescriptor[];
			availableTargets: ExecutionTargetOption[];
			hasArchivedTranscript: boolean;
		};
		// Panel mode binds to a fixed `initialSessionId` and must drop
		// `session/loaded` messages addressed to other sessions.
		if (ctx.initialSessionId && payload.session.id !== ctx.initialSessionId) {
			return;
		}
		return { type: "session/loaded", payload };
	},
	"agent-chat/messages/appended": (ctx) => {
		const payload = ctx.payload as {
			sessionId: string;
			messages: ChatMessage[];
		};
		if (ctx.activeSessionId && payload.sessionId !== ctx.activeSessionId) {
			return;
		}
		return {
			type: "messages/appended",
			payload: { messages: payload.messages },
		};
	},
	"agent-chat/messages/updated": (ctx) => {
		const payload = ctx.payload as {
			sessionId: string;
			updates: Array<{ id: string; patch: Partial<ChatMessage> }>;
		};
		if (ctx.activeSessionId && payload.sessionId !== ctx.activeSessionId) {
			return;
		}
		return {
			type: "messages/updated",
			payload: { updates: payload.updates },
		};
	},
	"agent-chat/session/lifecycle-changed": (ctx) => {
		const payload = ctx.payload as {
			sessionId: string;
			to: AgentChatSessionView["lifecycleState"];
		};
		if (ctx.activeSessionId && payload.sessionId !== ctx.activeSessionId) {
			return;
		}
		return {
			type: "session/lifecycle-changed",
			payload: { to: payload.to },
		};
	},
	"agent-chat/session/cleared": (ctx) => ({
		type: "session/cleared",
		payload: ctx.payload as { reason: ClearReason },
	}),
	"agent-chat/catalog/loaded": (ctx) => ({
		type: "catalog/loaded",
		payload: ctx.payload as { catalog: AgentChatCatalog },
	}),
	"agent-chat/sessions/list-changed": (ctx) => ({
		type: "sessions/list-changed",
		payload: ctx.payload as { sessions: SidebarSessionListItem[] },
	}),
	"agent-chat/pending-writes/changed": (ctx) => {
		const payload = ctx.payload as {
			sessionId: string;
			writes: readonly PendingFileWriteSummary[];
		};
		if (ctx.activeSessionId && payload.sessionId !== ctx.activeSessionId) {
			return;
		}
		return {
			type: "pending-writes/changed",
			payload: { writes: payload.writes },
		};
	},
};

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

/**
 * @param initialSessionId Optional pre-bound session id (used by the legacy
 *                         editor-area panel which knows its session at
 *                         render time). The sidebar surface omits it and
 *                         relies on `agent-chat/session/loaded` /
 *                         `session/cleared` to drive `state.session`.
 */
export function useSessionBridge(initialSessionId?: string): AgentChatBridge {
	const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
	const activeSessionId = state.session?.id ?? initialSessionId;

	// Send ready + subscribe to incoming messages on mount.
	useEffect(() => {
		vscode.postMessage({
			type: "agent-chat/ready",
			payload: initialSessionId ? { sessionId: initialSessionId } : {},
		});

		const handler = (event: MessageEvent): void => {
			const action = translateIncoming(
				activeSessionId,
				initialSessionId,
				event.data
			);
			if (action) {
				dispatch(action);
			}
		};

		window.addEventListener("message", handler);
		return () => {
			window.removeEventListener("message", handler);
		};
	}, [initialSessionId, activeSessionId]);

	const submit = useCallback(
		(content: string, clientMessageId?: string) => {
			if (!activeSessionId) {
				return;
			}
			vscode.postMessage({
				type: "agent-chat/input/submit",
				payload: {
					sessionId: activeSessionId,
					content,
					clientMessageId,
				},
			});
		},
		[activeSessionId]
	);

	const cancel = useCallback(() => {
		if (!activeSessionId) {
			return;
		}
		vscode.postMessage({
			type: "agent-chat/control/cancel",
			payload: { sessionId: activeSessionId },
		});
	}, [activeSessionId]);

	const retry = useCallback(() => {
		if (!activeSessionId) {
			return;
		}
		vscode.postMessage({
			type: "agent-chat/control/retry",
			payload: { sessionId: activeSessionId },
		});
	}, [activeSessionId]);

	const changeMode = useCallback(
		(modeId: string) => {
			if (!activeSessionId) {
				return;
			}
			vscode.postMessage({
				type: "agent-chat/control/change-mode",
				payload: { sessionId: activeSessionId, modeId },
			});
		},
		[activeSessionId]
	);

	const changeModel = useCallback(
		(modelId: string) => {
			if (!activeSessionId) {
				return;
			}
			vscode.postMessage({
				type: "agent-chat/control/change-model",
				payload: { sessionId: activeSessionId, modelId },
			});
		},
		[activeSessionId]
	);

	const changeTarget = useCallback(
		(target: ExecutionTarget) => {
			if (!activeSessionId) {
				return;
			}
			vscode.postMessage({
				type: "agent-chat/control/change-target",
				payload: { sessionId: activeSessionId, target },
			});
		},
		[activeSessionId]
	);

	const switchSession = useCallback((nextId: string) => {
		vscode.postMessage({
			type: "agent-chat/control/switch-session",
			payload: { sessionId: nextId },
		});
	}, []);

	const startNewSession = useCallback((request: NewSessionRequest) => {
		vscode.postMessage({
			type: "agent-chat/control/new-session",
			payload: request,
		});
	}, []);

	const requestNewChat = useCallback(() => {
		vscode.postMessage({
			type: "agent-chat/control/request-new-chat",
			payload: {},
		});
	}, []);

	const acceptAllPendingWrites = useCallback(() => {
		vscode.postMessage({
			type: "agent-chat/pending-writes/accept-all",
			payload: {},
		});
	}, []);

	const rejectAllPendingWrites = useCallback(() => {
		vscode.postMessage({
			type: "agent-chat/pending-writes/reject-all",
			payload: {},
		});
	}, []);

	const acceptPendingWrite = useCallback((id: string) => {
		vscode.postMessage({
			type: "agent-chat/pending-writes/accept-one",
			payload: { id },
		});
	}, []);

	const rejectPendingWrite = useCallback((id: string) => {
		vscode.postMessage({
			type: "agent-chat/pending-writes/reject-one",
			payload: { id },
		});
	}, []);

	return useMemo<AgentChatBridge>(
		() => ({
			state,
			submit,
			cancel,
			retry,
			changeMode,
			changeModel,
			changeTarget,
			switchSession,
			startNewSession,
			requestNewChat,
			acceptAllPendingWrites,
			rejectAllPendingWrites,
			acceptPendingWrite,
			rejectPendingWrite,
		}),
		[
			state,
			submit,
			cancel,
			retry,
			changeMode,
			changeModel,
			changeTarget,
			switchSession,
			startNewSession,
			requestNewChat,
			acceptAllPendingWrites,
			rejectAllPendingWrites,
			acceptPendingWrite,
			rejectPendingWrite,
		]
	);
}
