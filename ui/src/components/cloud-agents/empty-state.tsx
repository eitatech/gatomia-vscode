/**
 * Empty State
 *
 * Welcome and empty state view for the Cloud Agents panel.
 * Shown when no provider is configured or no sessions exist.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

// ============================================================================
// Props
// ============================================================================

interface EmptyStateProps {
	hasProvider: boolean;
	providerName?: string;
	onSelectProvider?: () => void;
}

// ============================================================================
// EmptyState
// ============================================================================

/**
 * Empty/welcome state component for the Cloud Agents panel.
 */
export function EmptyState({
	hasProvider,
	providerName,
	onSelectProvider,
}: EmptyStateProps): JSX.Element {
	if (!hasProvider) {
		return (
			<div className="empty-state" data-testid="empty-state">
				<p>Select a cloud agent provider to get started.</p>
				{onSelectProvider && (
					<button onClick={onSelectProvider} type="button">
						Select Provider
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="empty-state" data-testid="empty-state">
			<p>No active sessions for {providerName ?? "the current provider"}.</p>
		</div>
	);
}
