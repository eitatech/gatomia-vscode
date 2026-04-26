/**
 * SessionsList — persistent history list rendered at the top of the empty
 * state (Copilot Chat-style "SESSIONS" header).
 *
 * Pure presentation: receives the canonical session list from the bridge
 * and dispatches `onPick` when the user clicks a row. The component does
 * not own any state aside from the "show all" toggle.
 *
 * Layout (matches the agreed redesign — image 2):
 *
 *   ┌──────────────────────────────────────┐
 *   │ SESSIONS                             │  ← header (uppercase)
 *   ├──────────────────────────────────────┤
 *   │ ●  Refactor Welcome Screen   2d ago  │
 *   │ ●  Review ACP Integration    3d ago  │
 *   │ ●  Iteration 2 — task        1 wk ago│
 *   │ MORE                              N  │  ← only when > MAX_VISIBLE
 *   └──────────────────────────────────────┘
 *
 * The status dot is a codicon and its colour comes from the theme via
 * `agent-chat-sessions-list__status-dot--<lifecycleState>` modifiers in
 * `app.css`. No emojis or hard-coded colours.
 */

import { useCallback, useState } from "react";
import { formatRelativeTime } from "@/utils/relative-time";
import type { SidebarSessionListItem } from "@/features/agent-chat/types";

interface SessionsListProps {
	readonly sessions: readonly SidebarSessionListItem[];
	readonly onPick: (sessionId: string) => void;
	readonly activeSessionId?: string;
}

/** Number of rows shown before the user clicks "MORE". */
const MAX_VISIBLE = 5;

export function SessionsList({
	sessions,
	onPick,
	activeSessionId,
}: SessionsListProps): JSX.Element | null {
	const [expanded, setExpanded] = useState(false);

	const handlePick = useCallback(
		(sessionId: string) => {
			onPick(sessionId);
		},
		[onPick]
	);

	if (sessions.length === 0) {
		return null;
	}

	const visible = expanded ? sessions : sessions.slice(0, MAX_VISIBLE);
	const hidden = sessions.length - visible.length;

	return (
		<section aria-label="Recent sessions" className="agent-chat-sessions-list">
			<header className="agent-chat-sessions-list__header">
				<span className="agent-chat-sessions-list__title">SESSIONS</span>
			</header>
			<ul className="agent-chat-sessions-list__items">
				{visible.map((session) => (
					<li key={session.id}>
						<button
							aria-current={session.id === activeSessionId ? "true" : "false"}
							className={
								session.id === activeSessionId
									? "agent-chat-sessions-list__item agent-chat-sessions-list__item--active"
									: "agent-chat-sessions-list__item"
							}
							onClick={() => handlePick(session.id)}
							type="button"
						>
							<span
								aria-hidden="true"
								className={`agent-chat-sessions-list__status-dot agent-chat-sessions-list__status-dot--${session.lifecycleState}`}
							/>
							<span className="agent-chat-sessions-list__item-label">
								{session.title ?? session.agentDisplayName}
							</span>
							<span className="agent-chat-sessions-list__item-meta">
								{formatRelativeTime(session.updatedAt)}
							</span>
						</button>
					</li>
				))}
			</ul>
			{hidden > 0 ? (
				<button
					aria-label={`Show ${hidden} more sessions`}
					className="agent-chat-sessions-list__more"
					onClick={() => setExpanded(true)}
					type="button"
				>
					<span>MORE</span>
					<span>{hidden}</span>
				</button>
			) : null}
		</section>
	);
}
