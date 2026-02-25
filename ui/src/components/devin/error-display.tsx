/**
 * Error Display Component
 *
 * Displays error states in the Devin progress webview.
 */

interface ErrorDisplayProps {
	readonly title?: string;
	readonly message: string;
	readonly onRetry?: () => void;
}

export function ErrorDisplay({
	title = "Error",
	message,
	onRetry,
}: ErrorDisplayProps) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "32px 16px",
				gap: "12px",
				textAlign: "center",
			}}
		>
			<span
				className="codicon codicon-error"
				style={{
					fontSize: "32px",
					color: "var(--vscode-errorForeground)",
				}}
			/>
			<strong>{title}</strong>
			<span style={{ opacity: 0.7, maxWidth: "300px" }}>{message}</span>
			{onRetry && (
				<button onClick={onRetry} type="button">
					Retry
				</button>
			)}
		</div>
	);
}
