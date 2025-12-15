/**
 * Send to Review button component for Spec Explorer (User Story 1).
 * Displays button with gating logic and blocker tooltips.
 */

import type React from "react";
import type { Specification } from "../../../../../src/features/spec/review-flow/types";

interface SendToReviewButtonProps {
	spec: Specification;
	onSendToReview: (specId: string) => void;
}

export const SendToReviewButton: React.FC<SendToReviewButtonProps> = ({
	spec,
	onSendToReview,
}) => {
	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	const isDisabled = pendingTasks > 0 || pendingChecklistItems > 0;

	const blockers: string[] = [];
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

	const tooltip = isDisabled
		? `Cannot send to review: ${blockers.join(", ")}`
		: "Send this spec to review";

	return (
		<div className="send-to-review-container">
			<button
				className="btn btn-primary send-to-review-button"
				disabled={isDisabled}
				onClick={() => onSendToReview(spec.id)}
				title={tooltip}
				type="button"
			>
				Send to Review
			</button>
			{isDisabled && (
				<div className="blocker-message" title={tooltip}>
					{blockers.join(", ")}
				</div>
			)}
		</div>
	);
};

export default SendToReviewButton;
