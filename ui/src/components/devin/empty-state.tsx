/**
 * Empty State Component
 *
 * Displays a friendly message when there are no active Devin sessions.
 */

interface EmptyStateProps {
	readonly onConfigureCredentials?: () => void;
}

export function EmptyState({ onConfigureCredentials }: EmptyStateProps) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "48px 16px",
				gap: "16px",
				textAlign: "center",
			}}
		>
			<span
				className="codicon codicon-robot"
				style={{ fontSize: "48px", opacity: 0.4 }}
			/>
			<div>
				<strong>No Devin Sessions</strong>
				<p style={{ opacity: 0.7, margin: "8px 0 0" }}>
					Start delegating spec tasks to Devin from the Spec Explorer.
				</p>
			</div>
			{onConfigureCredentials && (
				<button onClick={onConfigureCredentials} type="button">
					Configure Devin Credentials
				</button>
			)}
		</div>
	);
}
