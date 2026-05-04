/**
 * SessionSwitcher — header dropdown for picking the active session in the
 * sidebar surface. Mirrors the way Copilot Chat's history button surfaces
 * past conversations.
 *
 * Pure presentation: receives the canonical list from the bridge and
 * dispatches `switchSession` / `startNewSession` callbacks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SidebarSessionListItem } from "@/features/agent-chat/types";

interface SessionSwitcherProps {
	readonly sessions: readonly SidebarSessionListItem[];
	readonly activeSessionId: string | undefined;
	readonly onSwitchSession: (sessionId: string) => void;
	readonly onNewChat: () => void;
}

export function SessionSwitcher({
	sessions,
	activeSessionId,
	onSwitchSession,
	onNewChat,
}: SessionSwitcherProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const popupRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (event: MouseEvent): void => {
			if (
				popupRef.current &&
				!popupRef.current.contains(event.target as Node)
			) {
				setOpen(false);
			}
		};
		window.addEventListener("mousedown", handler);
		return () => {
			window.removeEventListener("mousedown", handler);
		};
	}, [open]);

	const handlePick = useCallback(
		(sessionId: string) => {
			setOpen(false);
			if (sessionId !== activeSessionId) {
				onSwitchSession(sessionId);
			}
		},
		[activeSessionId, onSwitchSession]
	);

	const handleNewChat = useCallback(() => {
		setOpen(false);
		onNewChat();
	}, [onNewChat]);

	return (
		<div className="agent-chat-switcher" ref={popupRef}>
			<button
				aria-expanded={open}
				aria-haspopup="menu"
				className="agent-chat-switcher__toggle"
				onClick={() => setOpen((v) => !v)}
				title="Switch agent chat session"
				type="button"
			>
				<span aria-hidden="true">⌄</span>
				<span className="agent-chat-switcher__count">
					{sessions.length === 0 ? "No sessions" : `${sessions.length}`}
				</span>
			</button>
			{open ? (
				<div className="agent-chat-switcher__popup" role="menu">
					<button
						className="agent-chat-switcher__action"
						onClick={handleNewChat}
						role="menuitem"
						type="button"
					>
						<span aria-hidden="true">＋</span> New chat
					</button>
					{sessions.length === 0 ? (
						<div className="agent-chat-switcher__empty">
							No previous sessions yet.
						</div>
					) : (
						<ul className="agent-chat-switcher__list">
							{sessions.map((session) => (
								<li key={session.id}>
									<button
										aria-current={
											session.id === activeSessionId ? "true" : "false"
										}
										className={
											session.id === activeSessionId
												? "agent-chat-switcher__item agent-chat-switcher__item--active"
												: "agent-chat-switcher__item"
										}
										onClick={() => handlePick(session.id)}
										role="menuitem"
										type="button"
									>
										<span className="agent-chat-switcher__item-name">
											{session.agentDisplayName}
										</span>
										<span className="agent-chat-switcher__item-meta">
											{lifecycleLabel(session.lifecycleState)}
											{session.selectedModelId
												? ` · ${session.selectedModelId}`
												: ""}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}
		</div>
	);
}

function lifecycleLabel(
	state: SidebarSessionListItem["lifecycleState"]
): string {
	switch (state) {
		case "initializing":
			return "Starting…";
		case "running":
			return "Running";
		case "waiting-for-input":
			return "Waiting";
		case "completed":
			return "Completed";
		case "failed":
			return "Failed";
		case "cancelled":
			return "Cancelled";
		case "ended-by-shutdown":
			return "Closed";
		default:
			return state;
	}
}
