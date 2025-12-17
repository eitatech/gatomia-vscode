/**
 * Ready to Review Lane component for Spec Explorer.
 * Displays specs that have been completed and are ready for review.
 * Allows reviewers to file change requests directly from this view.
 */

import type React from "react";
import { useState } from "react";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

interface ReadyToReviewListProps {
	specs?: Specification[];
	onFileChangeRequest?: (specId: string) => void;
	onOpenSpec?: (specId: string) => void;
}

export const ReadyToReviewList: React.FC<ReadyToReviewListProps> = ({
	specs = [],
	onFileChangeRequest,
	onOpenSpec,
}) => {
	const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);

	if (!specs || specs.length === 0) {
		return (
			<div className="spec-list empty-state">
				<p>No specs ready for review</p>
			</div>
		);
	}

	const handleFileChangeRequest = (specId: string) => {
		setSelectedSpecId(specId);
		onFileChangeRequest?.(specId);
	};

	const handleOpenSpec = (
		specId: string,
		e: React.MouseEvent | React.KeyboardEvent
	) => {
		e.stopPropagation();
		onOpenSpec?.(specId);
	};

	const handleSpecSelect = (
		specId: string,
		e: React.MouseEvent | React.KeyboardEvent
	) => {
		if ("key" in e && e.key !== "Enter" && e.key !== " ") {
			return;
		}
		setSelectedSpecId(specId);
		if ("key" in e) {
			e.preventDefault();
		}
	};

	return (
		<div className="spec-list ready-to-review-list">
			<ul className="spec-items">
				{specs.map((spec) => (
					<li
						className={`spec-item ${selectedSpecId === spec.id ? "selected" : ""}`}
						key={spec.id}
					>
						<div className="spec-header">
							<button
								className="spec-title"
								onClick={(e) => handleOpenSpec(spec.id, e)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										handleOpenSpec(spec.id, e);
										e.preventDefault();
									}
								}}
								title={spec.title}
								type="button"
							>
								{spec.title}
							</button>
						</div>

						<div className="spec-metadata">
							{spec.owner && (
								<span className="spec-owner">
									<strong>Owner:</strong> {spec.owner}
								</span>
							)}
							{spec.completedAt && (
								<span className="spec-completed-at">
									<strong>Completed:</strong>{" "}
									{new Date(spec.completedAt).toLocaleDateString()}
								</span>
							)}
						</div>

						{spec.changeRequests && spec.changeRequests.length > 0 && (
							<div className="spec-change-requests-info">
								<span className="badge">
									{spec.changeRequests.length} change request
									{spec.changeRequests.length !== 1 ? "s" : ""}
								</span>
							</div>
						)}

						<div className="spec-actions">
							<button
								className="btn btn-primary"
								onClick={() => handleFileChangeRequest(spec.id)}
								title="File a change request for this spec"
								type="button"
							>
								File Change Request
							</button>
							{spec.links?.docUrl && (
								<a
									className="btn btn-secondary"
									href={spec.links.docUrl}
									rel="noopener noreferrer"
									target="_blank"
									title="Open spec documentation"
								>
									View Doc
								</a>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
};

export default ReadyToReviewList;
