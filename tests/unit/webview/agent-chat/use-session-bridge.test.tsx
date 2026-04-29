/**
 * useSessionBridge webview hook tests (T024).
 *
 * TDD (Constitution III): red before T034.
 *
 * Covers:
 *   - On mount, the hook posts `agent-chat/ready` with the correct sessionId.
 *   - Incoming `agent-chat/session/loaded` replaces the in-memory session +
 *     transcript + selectors.
 *   - Incoming `agent-chat/messages/appended` appends to state.
 *   - Incoming `agent-chat/messages/updated` patches matching messages in place.
 *   - Incoming `agent-chat/session/lifecycle-changed` updates
 *     `session.lifecycleState`.
 *   - `submit(content)` dispatches `agent-chat/input/submit`.
 *   - `cancel()` / `retry()` dispatch the matching `agent-chat/control/*`.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vscode } from "@/bridge/vscode";
import { useSessionBridge } from "@/features/agent-chat/hooks/use-session-bridge";
import type {
	AgentChatSessionView,
	ChatMessage,
	UserChatMessage,
} from "@/features/agent-chat/types";

// The webview-side bridge wraps `acquireVsCodeApi()` at module load time;
// swap the whole module with a fake so tests can assert postMessage calls.
vi.mock("@/bridge/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
		getState: vi.fn(() => ({})),
		setState: vi.fn(),
	},
}));

const fakeVscode = vscode as unknown as {
	postMessage: ReturnType<typeof vi.fn>;
	getState: ReturnType<typeof vi.fn>;
	setState: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
	fakeVscode.postMessage.mockReset();
});

function postFromExtension(message: unknown): void {
	window.dispatchEvent(new MessageEvent("message", { data: message }));
}

function sessionView(
	overrides: Partial<AgentChatSessionView> = {}
): AgentChatSessionView {
	return {
		id: "s-1",
		source: "acp",
		agentDisplayName: "opencode",
		executionTarget: { kind: "local", label: "Local" },
		lifecycleState: "waiting-for-input",
		acceptsFollowUp: true,
		isReadOnly: false,
		...overrides,
	};
}

function agentMessage(
	overrides: Partial<ChatMessage> & { id: string }
): ChatMessage {
	return {
		id: overrides.id,
		sessionId: "s-1",
		timestamp: 1000,
		sequence: 0,
		role: "agent",
		content: "hello",
		turnId: "t-1",
		isTurnComplete: true,
		...overrides,
	} as ChatMessage;
}

function userMessage(
	overrides: Partial<UserChatMessage> & { id: string }
): UserChatMessage {
	return {
		id: overrides.id,
		sessionId: "s-1",
		timestamp: 1000,
		sequence: 0,
		role: "user",
		content: "hi",
		isInitialPrompt: false,
		deliveryStatus: "pending",
		...overrides,
	} as UserChatMessage;
}

// ============================================================================
// Suite
// ============================================================================

describe("useSessionBridge (T024)", () => {
	describe("ready bootstrap", () => {
		it("posts agent-chat/ready with the sessionId on mount", () => {
			renderHook(() => useSessionBridge("s-1"));
			expect(fakeVscode.postMessage).toHaveBeenCalledWith({
				type: "agent-chat/ready",
				payload: { sessionId: "s-1" },
			});
		});

		it("starts in a not-ready state until session/loaded arrives", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			expect(result.current.state.ready).toBe(false);
			expect(result.current.state.session).toBeUndefined();
			expect(result.current.state.messages).toEqual([]);
		});
	});

	describe("session/loaded dispatch", () => {
		it("populates session, messages, and selectors from the payload", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));

			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView({ id: "s-1" }),
						messages: [agentMessage({ id: "m-1" })],
						availableModes: [{ id: "code", displayName: "Code" }],
						availableModels: [
							{
								id: "gpt-4",
								displayName: "GPT-4",
								invocation: "initial-prompt",
							},
						],
						availableTargets: [
							{ kind: "local", label: "Local", enabled: true },
						],
						hasArchivedTranscript: false,
					},
				});
			});

			expect(result.current.state.ready).toBe(true);
			expect(result.current.state.session?.id).toBe("s-1");
			expect(result.current.state.messages).toHaveLength(1);
			expect(result.current.state.availableModes).toHaveLength(1);
		});

		it("ignores session/loaded messages for a different session id", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));

			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView({ id: "s-OTHER" }),
						messages: [],
						availableModes: [],
						availableModels: [],
						availableTargets: [],
						hasArchivedTranscript: false,
					},
				});
			});

			expect(result.current.state.ready).toBe(false);
		});
	});

	describe("messages/appended dispatch", () => {
		it("appends new messages to the transcript", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView(),
						messages: [agentMessage({ id: "m-1" })],
						availableModes: [],
						availableModels: [],
						availableTargets: [],
						hasArchivedTranscript: false,
					},
				});
			});

			act(() => {
				postFromExtension({
					type: "agent-chat/messages/appended",
					payload: {
						sessionId: "s-1",
						messages: [agentMessage({ id: "m-2" })],
					},
				});
			});

			expect(result.current.state.messages.map((m) => m.id)).toEqual([
				"m-1",
				"m-2",
			]);
		});

		it("deduplicates messages with the same id (idempotent append)", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView(),
						messages: [],
						availableModes: [],
						availableModels: [],
						availableTargets: [],
						hasArchivedTranscript: false,
					},
				});
			});

			act(() => {
				postFromExtension({
					type: "agent-chat/messages/appended",
					payload: {
						sessionId: "s-1",
						messages: [agentMessage({ id: "m-dup" })],
					},
				});
			});
			act(() => {
				postFromExtension({
					type: "agent-chat/messages/appended",
					payload: {
						sessionId: "s-1",
						messages: [agentMessage({ id: "m-dup" })],
					},
				});
			});

			expect(result.current.state.messages).toHaveLength(1);
		});
	});

	describe("messages/updated dispatch", () => {
		it("patches the matching message in place", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView(),
						messages: [userMessage({ id: "u-1", deliveryStatus: "pending" })],
						availableModes: [],
						availableModels: [],
						availableTargets: [],
						hasArchivedTranscript: false,
					},
				});
			});

			act(() => {
				postFromExtension({
					type: "agent-chat/messages/updated",
					payload: {
						sessionId: "s-1",
						updates: [{ id: "u-1", patch: { deliveryStatus: "delivered" } }],
					},
				});
			});

			const patched = result.current.state.messages.find(
				(m) => m.id === "u-1"
			) as UserChatMessage;
			expect(patched.deliveryStatus).toBe("delivered");
		});

		it("leaves non-matching messages untouched", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView(),
						messages: [
							userMessage({ id: "u-1", deliveryStatus: "pending" }),
							agentMessage({ id: "m-1", content: "agent reply" }),
						],
						availableModes: [],
						availableModels: [],
						availableTargets: [],
						hasArchivedTranscript: false,
					},
				});
			});

			act(() => {
				postFromExtension({
					type: "agent-chat/messages/updated",
					payload: {
						sessionId: "s-1",
						updates: [{ id: "u-1", patch: { deliveryStatus: "rejected" } }],
					},
				});
			});

			const agent = result.current.state.messages.find((m) => m.id === "m-1");
			expect((agent as { content: string }).content).toBe("agent reply");
		});
	});

	describe("lifecycle-changed dispatch", () => {
		it("updates the session's lifecycleState", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			act(() => {
				postFromExtension({
					type: "agent-chat/session/loaded",
					payload: {
						session: sessionView({ lifecycleState: "running" }),
						messages: [],
						availableModes: [],
						availableModels: [],
						availableTargets: [],
						hasArchivedTranscript: false,
					},
				});
			});
			expect(result.current.state.session?.lifecycleState).toBe("running");

			act(() => {
				postFromExtension({
					type: "agent-chat/session/lifecycle-changed",
					payload: {
						sessionId: "s-1",
						from: "running",
						to: "completed",
						at: 1000,
					},
				});
			});

			expect(result.current.state.session?.lifecycleState).toBe("completed");
		});
	});

	describe("outbound actions", () => {
		it("submit posts agent-chat/input/submit with content and session id", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			fakeVscode.postMessage.mockClear();

			act(() => {
				result.current.submit("hello");
			});

			expect(fakeVscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "agent-chat/input/submit",
					payload: expect.objectContaining({
						sessionId: "s-1",
						content: "hello",
					}),
				})
			);
		});

		it("cancel posts agent-chat/control/cancel", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			fakeVscode.postMessage.mockClear();

			act(() => {
				result.current.cancel();
			});

			expect(fakeVscode.postMessage).toHaveBeenCalledWith({
				type: "agent-chat/control/cancel",
				payload: { sessionId: "s-1" },
			});
		});

		it("retry posts agent-chat/control/retry", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			fakeVscode.postMessage.mockClear();

			act(() => {
				result.current.retry();
			});

			expect(fakeVscode.postMessage).toHaveBeenCalledWith({
				type: "agent-chat/control/retry",
				payload: { sessionId: "s-1" },
			});
		});
	});

	describe("permissionDefault bridge", () => {
		it("starts undefined and is hydrated by permission-default/changed", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			expect(result.current.state.permissionDefault).toBeUndefined();

			act(() => {
				postFromExtension({
					type: "agent-chat/permission-default/changed",
					payload: { mode: "allow" },
				});
			});

			expect(result.current.state.permissionDefault).toBe("allow");
		});

		it("ignores unknown payloads and keeps the previous value", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			act(() => {
				postFromExtension({
					type: "agent-chat/permission-default/changed",
					payload: { mode: "allow" },
				});
			});
			act(() => {
				postFromExtension({
					type: "agent-chat/permission-default/changed",
					payload: { mode: "garbage" },
				});
			});

			expect(result.current.state.permissionDefault).toBe("allow");
		});

		it("changePermissionDefault posts agent-chat/control/change-permission-default", () => {
			const { result } = renderHook(() => useSessionBridge("s-1"));
			fakeVscode.postMessage.mockClear();

			act(() => {
				result.current.changePermissionDefault("deny");
			});

			expect(fakeVscode.postMessage).toHaveBeenCalledWith({
				type: "agent-chat/control/change-permission-default",
				payload: { mode: "deny" },
			});
		});
	});
});
