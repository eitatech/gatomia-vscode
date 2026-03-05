/**
 * Loading States Component
 *
 * Displays loading indicators for Devin session data.
 */

interface LoadingSpinnerProps {
	readonly message?: string;
}

export function LoadingSpinner({
	message = "Loading...",
}: LoadingSpinnerProps) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "32px 16px",
				gap: "12px",
			}}
		>
			<span
				className="codicon codicon-loading codicon-modifier-spin"
				style={{ fontSize: "24px" }}
			/>
			<span style={{ opacity: 0.7 }}>{message}</span>
		</div>
	);
}

export function SessionLoadingSkeleton() {
	return (
		<div style={{ padding: "8px 16px" }}>
			{[1, 2, 3].map((i) => (
				<div
					key={i}
					style={{
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: "4px",
						padding: "12px",
						marginBottom: "8px",
						opacity: 0.5,
					}}
				>
					<div
						style={{
							height: "16px",
							width: "60%",
							background: "var(--vscode-editor-inactiveSelectionBackground)",
							borderRadius: "2px",
							marginBottom: "8px",
						}}
					/>
					<div
						style={{
							height: "12px",
							width: "40%",
							background: "var(--vscode-editor-inactiveSelectionBackground)",
							borderRadius: "2px",
						}}
					/>
				</div>
			))}
		</div>
	);
}
