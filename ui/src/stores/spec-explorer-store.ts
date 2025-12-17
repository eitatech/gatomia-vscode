import { useSyncExternalStore } from "react";
import type { Specification } from "../../../src/features/spec/review-flow/types";

export interface SpecExplorerState {
	reviewSpecs: Specification[];
	archivedSpecs: Specification[];
}

type Listener = () => void;

class SpecExplorerStore {
	private state: SpecExplorerState = {
		reviewSpecs: [],
		archivedSpecs: [],
	};

	private readonly listeners: Set<Listener> = new Set();

	getState(): SpecExplorerState {
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

	setReviewSpecs(specs: Specification[]): void {
		this.state = {
			...this.state,
			reviewSpecs: specs,
		};
		this.notify();
	}

	setArchivedSpecs(specs: Specification[]): void {
		this.state = {
			...this.state,
			archivedSpecs: specs,
		};
		this.notify();
	}

	updateSpec(specId: string, updates: Partial<Specification>): void {
		const mapSpec = (spec: Specification) =>
			spec.id === specId ? { ...spec, ...updates } : spec;
		this.state = {
			reviewSpecs: this.state.reviewSpecs.map(mapSpec),
			archivedSpecs: this.state.archivedSpecs.map(mapSpec),
		};
		this.notify();
	}

	reset(): void {
		this.state = {
			reviewSpecs: [],
			archivedSpecs: [],
		};
		this.notify();
	}
}

const store = new SpecExplorerStore();

export function useSpecExplorerStore<T>(
	selector: (state: SpecExplorerState) => T
): T {
	return useSyncExternalStore(
		(listener) => store.subscribe(listener),
		() => selector(store.getState()),
		() => selector(store.getState())
	);
}

export const specExplorerActions = {
	setReviewSpecs: (specs: Specification[]) => store.setReviewSpecs(specs),
	setArchivedSpecs: (specs: Specification[]) => store.setArchivedSpecs(specs),
	updateSpec: (specId: string, updates: Partial<Specification>) =>
		store.updateSpec(specId, updates),
	reset: () => store.reset(),
};
