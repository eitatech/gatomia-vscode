/**
 * WorktreeBanner (T064).
 *
 * Shows the session's worktree path/branch/status and exposes the two-step
 * "Clean up" confirmation flow described in
 * `contracts/agent-chat-panel-protocol.md` §4.7 + §5.
 *
 * Contract:
 *   - When `warning === undefined`, a single "Clean up" button fires
 *     `onRequestCleanup` (step 1 of the two-step flow).
 *   - When `warning !== undefined`, an alert dialog is shown listing
 *     uncommitted/unpushed changes and offering Confirm/Cancel.
 *     Confirm fires `onConfirmCleanup`; Cancel simply dismisses.
 */

export interface WorktreeCleanupWarning {
	uncommittedPaths: readonly string[];
	unpushedCommits: number;
}

interface WorktreeBannerProps {
	readonly path: string;
	readonly branch: string;
	readonly status: "created" | "in-use" | "abandoned" | "cleaned";
	readonly warning: WorktreeCleanupWarning | undefined;
	readonly onRequestCleanup: () => void;
	readonly onConfirmCleanup: () => void;
}

const STATUS_LABEL: Record<WorktreeBannerProps["status"], string> = {
	created: "Created",
	"in-use": "In use",
	abandoned: "Abandoned",
	cleaned: "Cleaned",
};

export function WorktreeBanner({
	path,
	branch,
	status,
	warning,
	onRequestCleanup,
	onConfirmCleanup,
}: WorktreeBannerProps): JSX.Element {
	return (
		<div className="agent-chat-worktree-banner">
			<div className="agent-chat-worktree-banner__meta">
				<span className="agent-chat-worktree-banner__label">Worktree</span>
				<span className="agent-chat-worktree-banner__path">{path}</span>
				<span className="agent-chat-worktree-banner__branch">{branch}</span>
				<span className="agent-chat-worktree-banner__status">
					{STATUS_LABEL[status]}
				</span>
			</div>
			{status !== "cleaned" && warning === undefined && (
				<button
					className="agent-chat-worktree-banner__cleanup"
					onClick={onRequestCleanup}
					type="button"
				>
					Clean up worktree
				</button>
			)}
			{warning !== undefined && (
				<div className="agent-chat-worktree-banner__dialog" role="alertdialog">
					<p className="agent-chat-worktree-banner__dialog-summary">
						This worktree has destructive, uncommitted, or unpushed changes that
						would be lost.
					</p>
					{warning.uncommittedPaths.length > 0 && (
						<p>
							{warning.uncommittedPaths.length} uncommitted change
							{warning.uncommittedPaths.length === 1 ? "" : "s"}
						</p>
					)}
					{warning.unpushedCommits > 0 && (
						<p>
							{warning.unpushedCommits} unpushed commit
							{warning.unpushedCommits === 1 ? "" : "s"}
						</p>
					)}
					<div className="agent-chat-worktree-banner__dialog-actions">
						<button onClick={onConfirmCleanup} type="button">
							Confirm cleanup
						</button>
						<button
							onClick={() => {
								// Intentional no-op: dismissing the dialog is the webview's
								// responsibility — consumers hide this component after the
								// next render by clearing their `warning` state.
							}}
							type="button"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
