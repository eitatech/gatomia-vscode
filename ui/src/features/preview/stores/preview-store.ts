import type { PreviewDocumentPayload } from "../types";

export interface PreviewStoreSnapshot {
	document?: PreviewDocumentPayload;
	staleReason?: string;
}

type Listener = () => void;

class PreviewStore {
	private snapshot: PreviewStoreSnapshot = {};
	private readonly listeners = new Set<Listener>();

	subscribe = (listener: Listener) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = () => this.snapshot;

	setDocument(document: PreviewDocumentPayload) {
		this.snapshot = { document, staleReason: undefined };
		this.emit();
	}

	markStale(reason?: string) {
		this.snapshot = {
			...this.snapshot,
			staleReason:
				reason ??
				"Underlying document changed. Reload to view the latest content.",
		};
		this.emit();
	}

	private emit() {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

export const previewStore = new PreviewStore();
