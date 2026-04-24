// Agent Chat Panel feature entry.
//
// Phase 1 (T004) placeholder: this stub exists so that
// `getWebviewContent(webview, extensionUri, "agent-chat")` resolves to a
// registered React renderer in `page-registry.tsx`.
//
// T035 (Phase 3 / User Story 1) will replace this body with the real
// composition: ChatTranscript + InputBar + StatusHeader + RetryAction,
// consuming `use-session-bridge`.

export function AgentChatFeature(): JSX.Element {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				padding: 24,
				textAlign: "center",
				color: "var(--vscode-foreground)",
				opacity: 0.7,
			}}
		>
			<div>
				<div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
					Agent Chat Panel
				</div>
				<div style={{ fontSize: 12 }}>
					Phase 1 scaffolding complete. Chat surface lands in User Story 1
					(T035) — feature <code>018-agent-chat-panel</code>.
				</div>
			</div>
		</div>
	);
}
