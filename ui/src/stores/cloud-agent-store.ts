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

type Listener = () => void;

/**
 * Creates a simple state store for the Cloud Agents webview.
 * Includes subscribe/notify pattern for React integration.
 */
export function createCloudAgentStore() {
	let state: CloudAgentState = {
		sessions: [],
		activeProvider: null,
		isLoading: false,
		error: null,
	};

	const listeners = new Set<Listener>();

	function notify(): void {
		for (const listener of listeners) {
			listener();
		}
	}

	return {
		getState(): CloudAgentState {
			return state;
		},

		subscribe(listener: Listener): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		setSessions(sessions: AgentSessionView[]): void {
			state = { ...state, sessions };
			notify();
		},

		setActiveProvider(provider: ActiveProviderInfo | null): void {
			state = { ...state, activeProvider: provider };
			notify();
		},

		setLoading(isLoading: boolean): void {
			state = { ...state, isLoading };
			notify();
		},

		setError(error: string | null): void {
			state = { ...state, error };
			notify();
		},
	};
}
