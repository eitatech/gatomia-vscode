/**
 * Cloud Agent Store
 *
 * Provider-agnostic state store for the Cloud Agents webview.
 * Manages session data, provider info, and UI state.
 *
 * @see specs/016-multi-provider-agents/contracts/ui-events.md
 * @see specs/016-multi-provider-agents/plan.md
 */

// ============================================================================
// Types
// ============================================================================

/**
 * View model for a session displayed in the webview.
 */
export interface AgentSessionView {
	localId: string;
	providerId: string;
	status: string;
	displayStatus: string;
	branch: string;
	specPath: string;
	externalUrl?: string;
	createdAt: number;
	updatedAt: number;
	isReadOnly: boolean;
	tasks: AgentTaskView[];
	pullRequests: PullRequestView[];
}

/**
 * View model for a task displayed in the webview.
 */
export interface AgentTaskView {
	taskId: string;
	specTaskId: string;
	title: string;
	priority: string;
	status: string;
	progress?: number;
}

/**
 * View model for a pull request displayed in the webview.
 */
export interface PullRequestView {
	url: string;
	state: string;
	number?: number;
	title?: string;
}

/**
 * Active provider info for the webview.
 */
export interface ActiveProviderInfo {
	id: string;
	displayName: string;
}

/**
 * Full state shape for the Cloud Agent webview.
 */
export interface CloudAgentState {
	sessions: AgentSessionView[];
	activeProvider: ActiveProviderInfo | null;
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// Store
// ============================================================================

/**
 * Creates a simple state store for the Cloud Agents webview.
 * No external dependencies - framework-agnostic.
 */
export function createCloudAgentStore() {
	let state: CloudAgentState = {
		sessions: [],
		activeProvider: null,
		isLoading: false,
		error: null,
	};

	return {
		getState(): CloudAgentState {
			return state;
		},

		setSessions(sessions: AgentSessionView[]): void {
			state = { ...state, sessions };
		},

		setActiveProvider(provider: ActiveProviderInfo | null): void {
			state = { ...state, activeProvider: provider };
		},

		setLoading(isLoading: boolean): void {
			state = { ...state, isLoading };
		},

		setError(error: string | null): void {
			state = { ...state, error };
		},
	};
}
