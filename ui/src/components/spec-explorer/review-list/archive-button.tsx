/**
 * Archive button component for Spec Explorer (User Story 3).
 * Displays button with gating logic and blocker tooltips.
 */

import type React from "react";
import type { Specification } from "../../../../../src/features/spec/review-flow/types";

interface ArchiveButtonProps {
	spec: Specification;
	onArchive: (specId: string) => void;
}

function getArchivalBlockers(spec: Specification): string[] {
	const blockers: string[] = [];
	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	const openChangeRequests =
		spec.changeRequests?.filter((cr) => cr.status !== "addressed").length ?? 0;
	const incompleteTasksInChangeRequests =
		spec.changeRequests?.some((cr) =>
			cr.tasks.some((t) => t.status !== "done")
		) ?? false;

	if (pendingTasks > 0) {
		blockers.push(
			`${pendingTasks} pending task${pendingTasks === 1 ? "" : "s"}`
		);
	}
	if (pendingChecklistItems > 0) {
		blockers.push(
			`${pendingChecklistItems} pending checklist item${pendingChecklistItems === 1 ? "" : "s"}`
		);
	}
	if (openChangeRequests > 0) {
		blockers.push(
			`${openChangeRequests} open change request${openChangeRequests === 1 ? "" : "s"}`
		);
	}
	if (incompleteTasksInChangeRequests) {
		blockers.push("incomplete tasks in change requests");
	}
	return blockers;
}

export const ArchiveButton: React.FC<ArchiveButtonProps> = ({
	spec,
	onArchive,
}) => {
	const blockers = getArchivalBlockers(spec);
	const isDisabled = blockers.length > 0;

	const tooltip = isDisabled
		? `Cannot archive: ${blockers.join(", ")}`
		: "Archive this spec";

	return (
		<div className="archive-button-container">
			<button
				className="btn btn-secondary archive-button"
				disabled={isDisabled}
				onClick={() => onArchive(spec.id)}
				title={tooltip}
				type="button"
			>
				Send to Archived
			</button>
			{isDisabled && (
				<div className="blocker-message" title={tooltip}>
					{blockers.join(", ")}
				</div>
			)}
		</div>
	);
};

export default ArchiveButton;
