/**
 * Send to Review button component for Spec Explorer (User Story 1).
 * Displays button with gating logic and blocker tooltips.
 */

import type React from "react";
import type { Specification } from "../../../../../src/features/spec/review-flow/types";

interface SendToReviewButtonProps {
	spec: Specification;
	onSendToReview: (specId: string) => void;
	isSending?: boolean;
}

export const SendToReviewButton: React.FC<SendToReviewButtonProps> = ({
	spec,
	onSendToReview,
	isSending = false,
}) => {
	const pendingTasks = spec.pendingTasks ?? 0;
	const pendingChecklistItems = spec.pendingChecklistItems ?? 0;
	const isDisabled = isSending || pendingTasks > 0 || pendingChecklistItems > 0;

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

	let tooltip = "Send this spec to review";
	if (isDisabled) {
		tooltip = isSending
			? "Sending spec to review..."
			: `Cannot send to review: ${blockers.join(", ")}`;
	}
	const showReturnNotice = spec.status === "reopened";

	return (
		<div className="send-to-review-container">
			<button
				aria-busy={isSending}
				className="btn btn-primary send-to-review-button"
				data-testid="send-to-review-button"
				disabled={isDisabled}
				onClick={() => onSendToReview(spec.id)}
				title={tooltip}
				type="button"
			>
				{isSending ? "Sending..." : "Send to Review"}
			</button>
			{isDisabled && (
				<div className="blocker-message" title={tooltip}>
					{blockers.join(", ")}
				</div>
			)}
			{showReturnNotice && (
				<div className="review-return-message">
					Returned from Review due to reopened work
				</div>
			)}
		</div>
	);
};

export default SendToReviewButton;
