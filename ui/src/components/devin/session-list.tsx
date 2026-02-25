/**
 * SessionList Component
 *
 * Displays a list of Devin sessions grouped by active and completed.
 */

import type { DevinSessionView } from "../../stores/devin-store";
import { TaskStatus } from "./task-status";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

interface SessionListProps {
	readonly sessions: DevinSessionView[];
	readonly onCancelSession?: (localId: string) => void;
	readonly onOpenDevin?: (url: string) => void;
	readonly onOpenPr?: (url: string) => void;
}

export function SessionList({
	sessions,
	onCancelSession,
	onOpenDevin,
	onOpenPr,
}: SessionListProps) {
	const active = sessions.filter((s) => !TERMINAL_STATUSES.has(s.status));
	const completed = sessions.filter((s) => TERMINAL_STATUSES.has(s.status));

	if (sessions.length === 0) {
		return (
			<div style={{ padding: "16px", textAlign: "center", opacity: 0.7 }}>
				No Devin sessions yet. Start one from the Spec Explorer.
			</div>
		);
	}

	return (
		<div>
			{active.length > 0 && (
				<section>
					<h3 style={{ margin: "8px 0 4px" }}>Active ({active.length})</h3>
					{active.map((session) => (
						<SessionCard
							key={session.localId}
							onCancel={onCancelSession}
							onOpenDevin={onOpenDevin}
							onOpenPr={onOpenPr}
							session={session}
						/>
					))}
				</section>
			)}
			{completed.length > 0 && (
				<section>
					<h3 style={{ margin: "16px 0 4px" }}>Recent ({completed.length})</h3>
					{completed.slice(0, 10).map((session) => (
						<SessionCard
							key={session.localId}
							onOpenDevin={onOpenDevin}
							onOpenPr={onOpenPr}
							session={session}
						/>
					))}
				</section>
			)}
		</div>
	);
}

interface SessionCardProps {
	readonly session: DevinSessionView;
	readonly onCancel?: (localId: string) => void;
	readonly onOpenDevin?: (url: string) => void;
	readonly onOpenPr?: (url: string) => void;
}

function SessionCard({
	session,
	onCancel,
	onOpenDevin,
	onOpenPr,
}: SessionCardProps) {
	const isActive = !TERMINAL_STATUSES.has(session.status);

	return (
		<div
			style={{
				border: "1px solid var(--vscode-panel-border)",
				borderRadius: "4px",
				padding: "8px 12px",
				marginBottom: "8px",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "4px",
				}}
			>
				<strong>
					{session.tasks[0]?.title ?? `Session ${session.localId.slice(0, 8)}`}
				</strong>
				<span
					style={{
						fontSize: "0.85em",
						textTransform: "uppercase",
						opacity: 0.8,
					}}
				>
					{session.status}
				</span>
			</div>

			<div
				style={{
					fontSize: "0.85em",
					opacity: 0.7,
					marginBottom: "8px",
				}}
			>
				Branch: {session.branch}
			</div>

			{session.tasks.map((task) => (
				<TaskStatus key={task.taskId} task={task} />
			))}

			{session.pullRequests.length > 0 && (
				<div style={{ marginTop: "8px" }}>
					{session.pullRequests.map((pr) => (
						<button
							key={pr.prUrl}
							onClick={() => onOpenPr?.(pr.prUrl)}
							style={{ marginRight: "4px" }}
							type="button"
						>
							Open PR
						</button>
					))}
				</div>
			)}

			<div
				style={{
					display: "flex",
					gap: "4px",
					marginTop: "8px",
				}}
			>
				{session.devinUrl && (
					<button
						onClick={() => onOpenDevin?.(session.devinUrl!)}
						type="button"
					>
						Open in Devin
					</button>
				)}
				{isActive && onCancel && (
					<button onClick={() => onCancel(session.localId)} type="button">
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}
