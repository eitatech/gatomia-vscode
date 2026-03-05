/**
 * PullRequestActions Component
 *
 * Displays action buttons for Devin-created pull requests.
 * Shows contextual actions based on PR state (open, merged, closed).
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L170-L179
 */

import type { DevinPrView } from "../../stores/devin-store";

// ============================================================================
// Types
// ============================================================================

interface PullRequestActionsProps {
	readonly pullRequests: DevinPrView[];
	readonly onOpenPr?: (url: string) => void;
}

interface PullRequestCardProps {
	readonly pr: DevinPrView;
	readonly onOpen?: (url: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getPrStateLabel(state: string | undefined): string {
	if (!state) {
		return "Open";
	}
	const labels: Record<string, string> = {
		open: "Open",
		merged: "Merged",
		closed: "Closed",
	};
	return labels[state] ?? "Open";
}

function getPrStateColor(state: string | undefined): string {
	if (!state) {
		return "var(--vscode-charts-green)";
	}
	const colors: Record<string, string> = {
		open: "var(--vscode-charts-green)",
		merged: "var(--vscode-charts-purple)",
		closed: "var(--vscode-charts-red)",
	};
	return colors[state] ?? "var(--vscode-charts-green)";
}

function getPrButtonLabel(state: string | undefined): string {
	if (state === "merged") {
		return "View Merged PR";
	}
	if (state === "closed") {
		return "View Closed PR";
	}
	return "Review PR";
}

// ============================================================================
// Components
// ============================================================================

function PullRequestCard({ pr, onOpen }: PullRequestCardProps) {
	const stateLabel = getPrStateLabel(pr.prState);
	const stateColor = getPrStateColor(pr.prState);
	const buttonLabel = getPrButtonLabel(pr.prState);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "6px 8px",
				borderRadius: "3px",
				background: "var(--vscode-editor-inactiveSelectionBackground)",
				marginBottom: "4px",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
				<span
					style={{
						display: "inline-block",
						width: "8px",
						height: "8px",
						borderRadius: "50%",
						background: stateColor,
					}}
				/>
				<span style={{ fontSize: "0.85em" }}>
					{pr.branch || "Pull Request"}
				</span>
				<span
					style={{
						fontSize: "0.75em",
						opacity: 0.7,
						textTransform: "uppercase",
					}}
				>
					{stateLabel}
				</span>
			</div>
			<button
				onClick={() => onOpen?.(pr.prUrl)}
				style={{ fontSize: "0.85em" }}
				type="button"
			>
				{buttonLabel}
			</button>
		</div>
	);
}

export function PullRequestActions({
	pullRequests,
	onOpenPr,
}: PullRequestActionsProps) {
	if (pullRequests.length === 0) {
		return null;
	}

	return (
		<div style={{ marginTop: "8px" }}>
			<div
				style={{
					fontSize: "0.8em",
					fontWeight: 600,
					textTransform: "uppercase",
					opacity: 0.7,
					marginBottom: "4px",
				}}
			>
				Pull Requests ({pullRequests.length})
			</div>
			{pullRequests.map((pr) => (
				<PullRequestCard key={pr.prUrl} onOpen={onOpenPr} pr={pr} />
			))}
		</div>
	);
}
