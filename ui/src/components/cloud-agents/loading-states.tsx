/**
 * Loading States
 *
 * Loading indicator components for the Cloud Agents panel.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

// ============================================================================
// Props
// ============================================================================

interface LoadingStatesProps {
	message?: string;
}

// ============================================================================
// LoadingStates
// ============================================================================

/**
 * Loading state component for the Cloud Agents panel.
 */
export function LoadingStates({ message }: LoadingStatesProps): JSX.Element {
	return (
		<div className="loading-state" data-testid="loading-states">
			<span>{message ?? "Loading..."}</span>
		</div>
	);
}
