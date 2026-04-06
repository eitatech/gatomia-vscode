/**
 * Devin Store for Webview State
 *
 * Manages Devin session state in the webview using useSyncExternalStore.
 * Receives updates from the extension host via postMessage.
 *
 * @see specs/001-devin-integration/contracts/extension-api.ts:L118-L192
 */

import { useSyncExternalStore } from "react";

// ============================================================================
// Types
// ============================================================================

export interface DevinSessionView {
	readonly localId: string;
	readonly sessionId: string;
	readonly status: string;
	readonly branch: string;
	readonly specPath: string;
	readonly devinUrl?: string;
	readonly errorMessage?: string;
	readonly retryCount: number;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly completedAt?: number;
	readonly tasks: DevinTaskView[];
	readonly pullRequests: DevinPrView[];
}

export interface DevinTaskView {
	readonly taskId: string;
	readonly specTaskId: string;
	readonly title: string;
	readonly description: string;
	readonly priority: string;
	readonly status: string;
	readonly startedAt?: number;
	readonly completedAt?: number;
}

export interface DevinPrView {
	readonly prUrl: string;
	readonly prState?: string;
	readonly branch: string;
	readonly createdAt: number;
}

export interface DevinStoreState {
	readonly sessions: DevinSessionView[];
	readonly isLoading: boolean;
}

// ============================================================================
// Store
// ============================================================================

type Listener = () => void;

class DevinStore {
	private state: DevinStoreState = {
		sessions: [],
		isLoading: true,
	};

	private readonly listeners: Set<Listener> = new Set();

	getState(): DevinStoreState {
		return this.state;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	setSessions(sessions: DevinSessionView[]): void {
		this.state = {
			...this.state,
			sessions,
			isLoading: false,
		};
		this.notify();
	}

	setLoading(isLoading: boolean): void {
		this.state = {
			...this.state,
			isLoading,
		};
		this.notify();
	}
}

// ============================================================================
// Singleton + Hook
// ============================================================================

export const devinStore = new DevinStore();

/**
 * React hook to consume Devin store state.
 */
export function useDevinStore(): DevinStoreState {
	return useSyncExternalStore(
		(listener) => devinStore.subscribe(listener),
		() => devinStore.getState()
	);
}
