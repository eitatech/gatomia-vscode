/**
 * PendingChangesBar — Cursor-style review bar that sits above the
 * composer when the agent has queued one or more `writeTextFile` calls
 * awaiting Accept/Reject (image 1 in the redesign brief).
 *
 * Single-file mode (the dominant case):
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ 1 file +58 -2 ›        [Reject all] [Accept all]            │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Multi-file mode collapses behind the chevron and expands into a
 * per-file list with individual Accept/Reject controls.
 *
 * Renders nothing when `writes` is empty so the caller can mount it
 * unconditionally above the input bar without empty-state padding.
 */

import { useState } from "react";
import type { PendingFileWriteSummary } from "@/features/agent-chat/types";

interface PendingChangesBarProps {
	readonly writes: readonly PendingFileWriteSummary[];
	readonly onAcceptAll: () => void;
	readonly onRejectAll: () => void;
	readonly onAcceptOne: (id: string) => void;
	readonly onRejectOne: (id: string) => void;
}

export function PendingChangesBar({
	writes,
	onAcceptAll,
	onRejectAll,
	onAcceptOne,
	onRejectOne,
}: PendingChangesBarProps): JSX.Element | null {
	const [expanded, setExpanded] = useState(false);

	if (writes.length === 0) {
		return null;
	}

	const totalAdded = writes.reduce((sum, w) => sum + w.linesAdded, 0);
	const totalRemoved = writes.reduce((sum, w) => sum + w.linesRemoved, 0);
	const fileCount = writes.length;
	const canExpand = writes.length > 0;

	return (
		<div className="agent-chat-pending-bar" data-testid="pending-changes-bar">
			<div className="agent-chat-pending-bar__row">
				<button
					aria-expanded={canExpand ? expanded : undefined}
					className="agent-chat-pending-bar__summary"
					onClick={() => canExpand && setExpanded((v) => !v)}
					type="button"
				>
					<span className="agent-chat-pending-bar__count">
						{fileCount === 1 ? "1 file" : `${fileCount} files`}
					</span>
					<span className="agent-chat-pending-bar__stats">
						<span className="agent-chat-pending-bar__added">+{totalAdded}</span>{" "}
						<span className="agent-chat-pending-bar__removed">
							-{totalRemoved}
						</span>
					</span>
					<span
						aria-hidden="true"
						className={`agent-chat-pending-bar__chevron${expanded ? "agent-chat-pending-bar__chevron--open" : ""}`}
					>
						›
					</span>
				</button>
				<div className="agent-chat-pending-bar__actions">
					<button
						className="agent-chat-pending-bar__reject"
						onClick={onRejectAll}
						type="button"
					>
						Reject all
					</button>
					<button
						className="agent-chat-pending-bar__accept"
						onClick={onAcceptAll}
						type="button"
					>
						Accept all
					</button>
				</div>
			</div>
			{expanded ? (
				<ul className="agent-chat-pending-bar__list">
					{writes.map((write) => (
						<li className="agent-chat-pending-bar__item" key={write.id}>
							<span className="agent-chat-pending-bar__path" title={write.path}>
								{basename(write.path)}
							</span>
							<span className="agent-chat-pending-bar__stats">
								<span className="agent-chat-pending-bar__added">
									+{write.linesAdded}
								</span>{" "}
								<span className="agent-chat-pending-bar__removed">
									-{write.linesRemoved}
								</span>
							</span>
							<button
								aria-label={`Reject ${write.path}`}
								className="agent-chat-pending-bar__reject-one"
								onClick={() => onRejectOne(write.id)}
								type="button"
							>
								Reject
							</button>
							<button
								aria-label={`Accept ${write.path}`}
								className="agent-chat-pending-bar__accept-one"
								onClick={() => onAcceptOne(write.id)}
								type="button"
							>
								Accept
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

function basename(path: string): string {
	const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	return idx < 0 ? path : path.slice(idx + 1);
}
