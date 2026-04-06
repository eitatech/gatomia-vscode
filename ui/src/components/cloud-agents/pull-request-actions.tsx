/**
 * Pull Request Actions
 *
 * Renders pull request links and actions for agent sessions.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import type { PullRequestView } from "../../stores/cloud-agent-store";

// ============================================================================
// Props
// ============================================================================

interface PullRequestActionsProps {
	pullRequests: PullRequestView[];
	onOpenPr?: (url: string) => void;
}

// ============================================================================
// PullRequestActions
// ============================================================================

/**
 * Pull request actions component for the Cloud Agents panel.
 */
export function PullRequestActions({
	pullRequests,
	onOpenPr,
}: PullRequestActionsProps): JSX.Element {
	return (
		<div className="pr-list" data-testid="pull-request-actions">
			{pullRequests.map((pr) => (
				<div className="pr-item" key={pr.url}>
					<span className="pr-state">{pr.state}</span>
					{pr.title && <span className="pr-title">{pr.title}</span>}
					{onOpenPr && (
						<button onClick={() => onOpenPr(pr.url)} type="button">
							Open PR
						</button>
					)}
				</div>
			))}
		</div>
	);
}
