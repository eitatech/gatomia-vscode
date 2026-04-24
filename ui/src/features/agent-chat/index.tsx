/**
 * Agent Chat Panel feature entry (T035, Phase 3 / User Story 1).
 *
 * Composes the webview-side UI:
 *   - StatusHeader: agent name + lifecycle badge
 *   - ChatTranscript: virtualized message list
 *   - RetryAction: shown inside the latest retryable error (FR-020, research R9)
 *   - InputBar: follow-up composer (disabled on read-only / terminal sessions)
 *
 * The `useSessionBridge` hook handles the VS Code postMessage plumbing and
 * exposes session state + action dispatchers; this component is a pure view.
 *
 * The sessionId is read from the container's `data-session-id` attribute
 * which is set by `getWebviewContent` when the extension creates the panel.
 */

import { useMemo } from "react";
import { ChatTranscript } from "@/features/agent-chat/components/chat-transcript";
import { InputBar } from "@/features/agent-chat/components/input-bar";
import { RetryAction } from "@/features/agent-chat/components/retry-action";
import { StatusHeader } from "@/features/agent-chat/components/status-header";
import { useSessionBridge } from "@/features/agent-chat/hooks/use-session-bridge";
import type {
	ChatMessage,
	ErrorChatMessage,
} from "@/features/agent-chat/types";

const DEFAULT_SESSION_ID = "unknown-session";

export function AgentChatFeature(): JSX.Element {
	const sessionId = readSessionIdFromDom();
	const bridge = useSessionBridge(sessionId);
	const { state, submit, cancel, retry } = bridge;

	const latestRetryableError = useMemo(
		() => findLatestRetryableError(state.messages),
		[state.messages]
	);

	if (!state.ready) {
		return (
			<div className="agent-chat-feature agent-chat-feature--loading">
				<div>Loading session…</div>
			</div>
		);
	}

	const session = state.session;
	if (!session) {
		return (
			<div className="agent-chat-feature agent-chat-feature--error">
				<div>Session {sessionId} is not available.</div>
			</div>
		);
	}

	return (
		<div className="agent-chat-feature">
			<StatusHeader
				agentDisplayName={session.agentDisplayName}
				lifecycleState={session.lifecycleState}
			/>
			<ChatTranscript messages={state.messages} />
			{latestRetryableError ? (
				<RetryAction
					message={latestRetryableError}
					onOpenExternal={() => {
						// The extension resolves the actual URL via CloudLinkage; we
						// emit retry() which the panel handler maps to the
						// `agent-chat/control/retry` message. For Cloud sessions the
						// panel will translate this into `open-external`.
						retry();
					}}
					onRedispatch={retry}
					onRetry={retry}
					session={{
						source: session.source,
						externalUrl: session.cloud?.externalUrl,
					}}
				/>
			) : null}
			<InputBar
				acceptsFollowUp={session.acceptsFollowUp}
				onSubmit={submit}
				readOnly={session.isReadOnly}
				readOnlyReason={
					session.isReadOnly ? "This is a read-only cloud session." : undefined
				}
				terminal={isTerminalState(session.lifecycleState)}
			/>
			{/* Cancel button is exposed via the panel's header actions in a later phase;
			    routed here for completeness so the bridge action is exercised. */}
			<button
				aria-label="Cancel session"
				className="agent-chat-feature__cancel"
				onClick={cancel}
				style={{ display: "none" }}
				type="button"
			>
				Cancel
			</button>
		</div>
	);
}

function readSessionIdFromDom(): string {
	if (typeof document === "undefined") {
		return DEFAULT_SESSION_ID;
	}
	const root = document.getElementById("root");
	return root?.dataset.sessionId ?? DEFAULT_SESSION_ID;
}

function isTerminalState(
	state: NonNullable<
		ReturnType<typeof useSessionBridge>["state"]["session"]
	>["lifecycleState"]
): boolean {
	return (
		state === "completed" ||
		state === "failed" ||
		state === "cancelled" ||
		state === "ended-by-shutdown"
	);
}

function findLatestRetryableError(
	messages: readonly ChatMessage[]
): ErrorChatMessage | undefined {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const msg = messages[i];
		if (msg.role === "error" && msg.retryable) {
			return msg;
		}
	}
	return;
}
