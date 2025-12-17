/**
 * Archived Lane component for Spec Explorer (User Story 3).
 * Displays specs that have been archived after review completion.
 * Provides read-only view with Unarchive action.
 */

import type React from "react";
import { useState } from "react";
import type { Specification } from "../../../../src/features/spec/review-flow/types";

interface ArchivedListProps {
	specs?: Specification[];
	onUnarchive?: (specId: string) => void;
	onOpenSpec?: (specId: string) => void;
}

export const ArchivedList: React.FC<ArchivedListProps> = ({
	specs = [],
	onUnarchive,
	onOpenSpec,
}) => {
	const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);

	if (!specs || specs.length === 0) {
		return (
			<div className="spec-list empty-state">
				<p>No archived specs</p>
			</div>
		);
	}

	const handleUnarchive = (specId: string) => {
		onUnarchive?.(specId);
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
		<div className="spec-list archived-list">
			<ul className="spec-items">
				{specs.map((spec) => (
					<li
						className={`spec-item archived ${selectedSpecId === spec.id ? "selected" : ""}`}
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
								title={`${spec.title} (Read-only)`}
								type="button"
							>
								{spec.title}
								<span className="archived-badge">Archived</span>
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
							{spec.archivedAt && (
								<span className="spec-archived-at">
									<strong>Archived:</strong>{" "}
									{new Date(spec.archivedAt).toLocaleDateString()}
								</span>
							)}
						</div>

						{spec.changeRequests && spec.changeRequests.length > 0 && (
							<div className="spec-change-requests-info">
								<span className="badge">
									{spec.changeRequests.length} change request
									{spec.changeRequests.length !== 1 ? "s" : ""} (
									{
										spec.changeRequests.filter(
											(cr) => cr.status === "addressed"
										).length
									}{" "}
									addressed)
								</span>
							</div>
						)}

						<div className="spec-actions">
							<button
								className="btn btn-secondary"
								onClick={() => handleUnarchive(spec.id)}
								title="Unarchive this spec and return it to reopened status"
								type="button"
							>
								Unarchive
							</button>
							{spec.links?.docUrl && (
								<a
									className="btn btn-secondary"
									href={spec.links.docUrl}
									rel="noopener noreferrer"
									target="_blank"
									title="View spec documentation (read-only)"
								>
									View Doc
								</a>
							)}
						</div>

						<div className="archived-notice">
							<em>This spec is archived and read-only.</em>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
};

export default ArchivedList;
