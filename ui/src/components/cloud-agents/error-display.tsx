/**
 * Error Display
 *
 * Renders error states and messages in the Cloud Agents panel.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

// ============================================================================
// Props
// ============================================================================

interface ErrorDisplayProps {
	message: string;
	onRetry?: () => void;
}

// ============================================================================
// ErrorDisplay
// ============================================================================

/**
 * Error display component for the Cloud Agents panel.
 */
export function ErrorDisplay({
	message,
	onRetry,
}: ErrorDisplayProps): JSX.Element {
	return (
		<div className="error-state" data-testid="error-display">
			<p>{message}</p>
			{onRetry && (
				<button onClick={onRetry} type="button">
					Retry
				</button>
			)}
		</div>
	);
}
