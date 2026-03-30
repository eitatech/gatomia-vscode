/**
 * Cloud Agent Progress View
 *
 * Main webview component for displaying cloud agent session progress.
 * Delegates to active provider for rendering.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 */

import type { CloudAgentState } from "../../stores/cloud-agent-store";
import { EmptyState } from "./empty-state";
import { ErrorDisplay } from "./error-display";
import { LoadingStates } from "./loading-states";
import { SessionList } from "./session-list";

// ============================================================================
// Props
// ============================================================================

interface CloudAgentProgressViewProps {
	state: CloudAgentState;
	onSelectProvider?: () => void;
	onOpenExternal?: (url: string) => void;
	onRetry?: () => void;
}

// ============================================================================
// CloudAgentProgressView
// ============================================================================

/**
 * Main progress view component for the Cloud Agents panel.
 */
export function CloudAgentProgressView({
	state,
	onSelectProvider,
	onOpenExternal,
	onRetry,
}: CloudAgentProgressViewProps): JSX.Element {
	if (state.error) {
		return <ErrorDisplay message={state.error} onRetry={onRetry} />;
	}

	if (state.isLoading) {
		return <LoadingStates message="Fetching session status..." />;
	}

	if (!state.activeProvider) {
		return (
			<EmptyState hasProvider={false} onSelectProvider={onSelectProvider} />
		);
	}

	if (state.sessions.length === 0) {
		return (
			<EmptyState
				hasProvider={true}
				providerName={state.activeProvider.displayName}
			/>
		);
	}

	return (
		<div data-testid="cloud-agent-progress-view">
			<SessionList onOpenExternal={onOpenExternal} sessions={state.sessions} />
		</div>
	);
}
