/**
 * Agent Chat feature entry.
 *
 * Two surfaces share the same React tree:
 *   - **sidebar** (canonical): no pre-bound session id; the bridge listens
 *     for `agent-chat/session/loaded` and `session/cleared` to drive the
 *     active session, and renders the {@link NewSessionComposer} when no
 *     session is bound. Header exposes the {@link SessionSwitcher} so
 *     users can swap between sessions or start a new chat.
 *   - **panel** (legacy editor area): pre-bound to the session id encoded
 *     in `data-session-id`. Behaves like the original Phase 3 panel.
 *
 * The surface is selected via `data-surface` on the webview root (set by
 * `getWebviewContent`). When absent we infer `panel` for backward compat.
 */

import { useMemo } from "react";
import { ChatTranscript } from "@/features/agent-chat/components/chat-transcript";
import { InputBar } from "@/features/agent-chat/components/input-bar";
import { NewSessionComposer } from "@/features/agent-chat/components/new-session-composer";
import { PendingChangesBar } from "@/features/agent-chat/components/pending-changes-bar";
import { RetryAction } from "@/features/agent-chat/components/retry-action";
import { SessionsList } from "@/features/agent-chat/components/sessions-list";
import { SessionSwitcher } from "@/features/agent-chat/components/session-switcher";
import { StatusHeader } from "@/features/agent-chat/components/status-header";
import { useSessionBridge } from "@/features/agent-chat/hooks/use-session-bridge";
import type {
	ChatMessage,
	ErrorChatMessage,
} from "@/features/agent-chat/types";

type Surface = "sidebar" | "panel";

export function AgentChatFeature(): JSX.Element {
	const surface = readSurfaceFromDom();
	const initialSessionId = readSessionIdFromDom();
	const bridge = useSessionBridge(
		surface === "panel" ? initialSessionId : undefined
	);
	const {
		state,
		submit,
		cancel,
		retry,
		switchSession,
		startNewSession,
		requestNewChat,
		acceptAllPendingWrites,
		rejectAllPendingWrites,
		acceptPendingWrite,
		rejectPendingWrite,
		changePermissionDefault,
		changeModel,
		changeThinkingLevel,
		changeAgentRole,
		probeModels,
	} = bridge;

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

	// Sidebar empty state — no session bound. The recent SessionsList
	// fills the upper area (so users can resume) while the
	// NewSessionComposer is anchored to the bottom of the viewport, just
	// like the on-session InputBar. The redundant "Agent Chat" topbar
	// was removed — the view title in the sidebar header already conveys
	// that context.
	if (!session && surface === "sidebar") {
		return (
			<div className="agent-chat-feature agent-chat-feature--empty">
				<div className="agent-chat-feature__empty-main">
					<SessionsList
						activeSessionId={undefined}
						onPick={switchSession}
						sessions={state.sessions}
					/>
				</div>
				<NewSessionComposer
					agentFiles={state.catalog.agentFiles}
					modelsLoading={state.modelsLoading}
					onChangePermissionDefault={changePermissionDefault}
					onProbeProviderModels={probeModels}
					onStart={startNewSession}
					permissionDefault={state.permissionDefault}
					providers={state.catalog.providers}
				/>
			</div>
		);
	}

	// Legacy / panel surface with a missing session — restored fallback.
	if (!session) {
		return (
			<div className="agent-chat-feature agent-chat-feature--error">
				<div>Session {initialSessionId ?? ""} is not available.</div>
			</div>
		);
	}

	return (
		<div className="agent-chat-feature">
			{surface === "sidebar" ? (
				<div className="agent-chat-feature__topbar">
					<StatusHeader
						agentDisplayName={session.agentDisplayName}
						lifecycleState={session.lifecycleState}
					/>
					<SessionSwitcher
						activeSessionId={session.id}
						onNewChat={requestNewChat}
						onSwitchSession={switchSession}
						sessions={state.sessions}
					/>
				</div>
			) : (
				<StatusHeader
					agentDisplayName={session.agentDisplayName}
					lifecycleState={session.lifecycleState}
				/>
			)}
			<ChatTranscript messages={state.messages} />
			{latestRetryableError ? (
				<RetryAction
					message={latestRetryableError}
					onOpenExternal={() => {
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
			<PendingChangesBar
				onAcceptAll={acceptAllPendingWrites}
				onAcceptOne={acceptPendingWrite}
				onRejectAll={rejectAllPendingWrites}
				onRejectOne={rejectPendingWrite}
				writes={state.pendingWrites}
			/>
			<InputBar
				acceptsFollowUp={session.acceptsFollowUp}
				availableAgentRoles={session.availableAgentRoles}
				availableModels={session.availableModels ?? state.availableModels}
				availableThinkingLevels={session.availableThinkingLevels}
				busy={isBusyState(session.lifecycleState)}
				currentModelId={session.currentModelId ?? session.selectedModelId}
				modelLabel={session.selectedModelId ?? session.agentDisplayName}
				modelsLoading={Boolean(
					state.modelsLoading?.[deriveProviderIdForSession(session)]
				)}
				onCancel={cancel}
				onChangeAgentRole={changeAgentRole}
				onChangeModel={changeModel}
				onChangePermissionDefault={changePermissionDefault}
				onChangeThinkingLevel={changeThinkingLevel}
				onRefreshModels={() => probeModels(deriveProviderIdForSession(session))}
				onSubmit={submit}
				permissionDefault={state.permissionDefault}
				providerDisplayName={session.agentDisplayName}
				providerId={deriveProviderIdForSession(session)}
				readOnly={session.isReadOnly}
				readOnlyReason={
					session.isReadOnly ? "This is a read-only cloud session." : undefined
				}
				selectedAgentRoleId={session.selectedAgentRoleId}
				selectedThinkingLevelId={session.selectedThinkingLevelId}
				terminal={isTerminalState(session.lifecycleState)}
			/>
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

function readSurfaceFromDom(): Surface {
	if (typeof document === "undefined") {
		return "panel";
	}
	const root = document.getElementById("root");
	const raw = root?.dataset.surface;
	return raw === "sidebar" ? "sidebar" : "panel";
}

function readSessionIdFromDom(): string | undefined {
	if (typeof document === "undefined") {
		return;
	}
	const root = document.getElementById("root");
	const raw = root?.dataset.sessionId;
	return raw && raw !== "unknown-session" ? raw : undefined;
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

function isBusyState(
	state: NonNullable<
		ReturnType<typeof useSessionBridge>["state"]["session"]
	>["lifecycleState"]
): boolean {
	return state === "running" || state === "initializing";
}

/**
 * Resolve the provider id used for `probe-models` lookups from a
 * session view. Cloud sessions surface the provider on `cloud`; ACP
 * sessions stamp the descriptor id on `agentId`. Falls back to the
 * empty string so the caller can short-circuit gracefully.
 */
function deriveProviderIdForSession(
	session: NonNullable<ReturnType<typeof useSessionBridge>["state"]["session"]>
): string {
	if (session.cloud?.providerId) {
		return session.cloud.providerId;
	}
	return session.agentId ?? "";
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
