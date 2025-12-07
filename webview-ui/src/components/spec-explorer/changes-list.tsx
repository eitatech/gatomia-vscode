/**
 * Changes Lane List for Spec Explorer review flow.
 * Displays active change requests (open, blocked, inProgress) grouped by spec.
 */

import type React from "react";

// Local type aliases matching extension types
export type ChangeRequestStatus =
	| "open"
	| "blocked"
	| "inProgress"
	| "addressed";
export type ChangeRequestSeverity = "low" | "medium" | "high" | "critical";

export interface ChangeRequest {
	id: string;
	specId: string;
	title: string;
	description: string;
	severity: ChangeRequestSeverity;
	status: ChangeRequestStatus;
	tasks: any[];
	submitter: string;
	createdAt: Date;
	updatedAt: Date;
	sentToTasksAt: Date | null;
	notes?: string;
}

export interface Specification {
	id: string;
	title: string;
	owner: string;
	status: string;
	completedAt: Date | null;
	updatedAt: Date;
	links: { specPath: string; docUrl?: string };
	changeRequests?: ChangeRequest[];
}

export interface ChangesListItem {
	spec: Specification;
	changeRequest: ChangeRequest;
}

interface ChangesListProps {
	items: ChangesListItem[];
	onSelectChangeRequest?: (changeRequestId: string, specId: string) => void;
	onRetry?: (changeRequestId: string) => void;
	emptyMessage?: string;
}

const severityLabels: Record<ChangeRequest["severity"], string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

const statusLabels: Record<ChangeRequest["status"], string> = {
	open: "Open",
	blocked: "Blocked",
	inProgress: "In Progress",
	addressed: "Addressed",
};

const ChangesList: React.FC<ChangesListProps> = ({
	items,
	onSelectChangeRequest,
	onRetry,
	emptyMessage = "No active change requests",
}) => {
	if (items.length === 0) {
		return <p className="changes-list-empty">{emptyMessage}</p>;
	}

	return (
		<div className="changes-list">
			{items.map(({ spec, changeRequest }) => (
				<button
					className={`change-request-item status-${changeRequest.status}`}
					key={changeRequest.id}
					onClick={() => onSelectChangeRequest?.(changeRequest.id, spec.id)}
					type="button"
				>
					<div className="change-request-header">
						<h4 className="change-request-title">{changeRequest.title}</h4>
						<span
							className={`severity-badge severity-${changeRequest.severity}`}
						>
							{severityLabels[changeRequest.severity]}
						</span>
					</div>

					<div className="change-request-meta">
						<span className="spec-link" title={spec.links.specPath}>
							Spec: {spec.title}
						</span>
						<span className={`status-badge status-${changeRequest.status}`}>
							{statusLabels[changeRequest.status]}
						</span>
					</div>

					<p className="change-request-description">
						{changeRequest.description}
					</p>

					{changeRequest.tasks.length > 0 && (
						<div className="change-request-tasks">
							<span className="tasks-count">
								{changeRequest.tasks.filter((t) => t.status === "done").length}/
								{changeRequest.tasks.length} tasks completed
							</span>
						</div>
					)}

					{changeRequest.status === "blocked" && onRetry && (
						<div className="change-request-actions">
							<button
								className="btn btn-retry"
								onClick={(e) => {
									e.stopPropagation();
									onRetry(changeRequest.id);
								}}
								type="button"
							>
								Retry dispatch
							</button>
						</div>
					)}
				</button>
			))}
		</div>
	);
};

export default ChangesList;
