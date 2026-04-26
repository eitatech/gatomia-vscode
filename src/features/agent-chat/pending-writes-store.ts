/**
 * PendingWritesStore — buffers `writeTextFile` calls coming from an
 * ACP agent so the user can review and accept/reject them before they
 * touch the disk (Phase 4 redesign / image 1 top bar).
 *
 * Lifecycle of a single write:
 *   1. The ACP file-system handler intercepts `writeTextFile(path,
 *      content)` and calls {@link enqueueWrite}.
 *   2. The store appends a `PendingWrite` entry, fans the snapshot out
 *      to subscribers, and hands back a `Promise<"accepted" |
 *      "rejected">`.
 *   3. The agent now blocks: the JSON-RPC reply is not sent until the
 *      user resolves the entry through {@link flush}.
 *   4. {@link flush} settles the matching promises and removes the
 *      entries; subscribers receive the updated snapshot.
 *
 * The host/UI is responsible for actually writing accepted entries to
 * disk — the store deliberately knows nothing about the file system.
 * This keeps the unit tests fast and lets the same store power both
 * the live VS Code surface and any future headless test harness.
 *
 * Concurrency:
 *   - All operations are synchronous from the caller's perspective.
 *   - Subscribers are notified inline; long-running work in a listener
 *     should be deferred via `queueMicrotask` to avoid stalling the
 *     ACP thread.
 */

import { randomUUID } from "node:crypto";

/**
 * Resolution of a pending write. The agent receives `accepted` as a
 * silent ACP success (`writeTextFile` returns `{}`); `rejected` is
 * surfaced to the agent as a thrown error so it can react (e.g. retry,
 * apologise, abort the turn).
 */
export type PendingWriteResolution = "accepted" | "rejected";

export interface PendingWriteRequest {
	/** Absolute path the agent intends to write. */
	path: string;
	/** Proposed file contents. */
	proposedContent: string;
	/**
	 * Pre-edit content captured from disk. `null` means the file does
	 * not yet exist (a `writeTextFile` against a brand-new path).
	 */
	oldText: string | null;
	/** Lines added relative to `oldText`. Computed before enqueue. */
	linesAdded?: number;
	/** Lines removed relative to `oldText`. Computed before enqueue. */
	linesRemoved?: number;
	/** Language hint derived from the path (used by the UI badge). */
	languageId?: string;
}

export interface PendingWrite extends PendingWriteRequest {
	/** Stable id used to address a single entry from {@link flush}. */
	id: string;
	/** Wallclock timestamp the entry was queued at, for ordering. */
	createdAt: number;
}

export type PendingWritesListener = (snapshot: readonly PendingWrite[]) => void;

export type FlushAction =
	| { kind: "accept-all" }
	| { kind: "reject-all" }
	| { kind: "accept-one"; id: string }
	| { kind: "reject-one"; id: string };

interface PendingEntry extends PendingWrite {
	resolve: (value: PendingWriteResolution) => void;
}

export class PendingWritesStore {
	private readonly entries: PendingEntry[] = [];
	private readonly listeners = new Set<PendingWritesListener>();
	private readonly nowFn: () => number;
	private readonly idFactory: () => string;

	constructor(options?: { now?: () => number; idFactory?: () => string }) {
		this.nowFn = options?.now ?? (() => Date.now());
		this.idFactory = options?.idFactory ?? (() => randomUUID());
	}

	/**
	 * Adds a write to the buffer and returns a Promise that resolves
	 * once the user accepts/rejects it. The agent's ACP RPC handler
	 * should `await` this Promise and only return success on
	 * `accepted`; on `rejected` it must throw so the agent can react.
	 */
	enqueueWrite(request: PendingWriteRequest): {
		id: string;
		promise: Promise<PendingWriteResolution>;
	} {
		const id = this.idFactory();
		const promise = new Promise<PendingWriteResolution>((resolve) => {
			this.entries.push({
				id,
				createdAt: this.nowFn(),
				path: request.path,
				proposedContent: request.proposedContent,
				oldText: request.oldText,
				linesAdded: request.linesAdded,
				linesRemoved: request.linesRemoved,
				languageId: request.languageId,
				resolve,
			});
		});
		this.notify();
		return { id, promise };
	}

	/**
	 * Returns the current ordered snapshot of pending writes. Safe to
	 * pass to React state — the array is frozen.
	 */
	peek(): readonly PendingWrite[] {
		return Object.freeze(this.entries.map((entry) => snapshotOf(entry)));
	}

	/**
	 * Resolves entries matching `action`. Returns the entries that were
	 * settled (so callers can write the accepted ones to disk).
	 */
	flush(action: FlushAction): PendingWrite[] {
		const settled: PendingWrite[] = [];
		const remaining: PendingEntry[] = [];

		for (const entry of this.entries) {
			const decision = decideForEntry(entry, action);
			if (decision === null) {
				remaining.push(entry);
			} else {
				entry.resolve(decision);
				settled.push(snapshotOf(entry));
			}
		}

		// Mutate the array in place so existing references remain
		// stable for the watchers that already grabbed `peek()`.
		this.entries.splice(0, this.entries.length, ...remaining);
		if (settled.length > 0) {
			this.notify();
		}
		return settled;
	}

	/**
	 * Rejects every pending write and clears the buffer. Used by
	 * session lifecycle teardown so the agent never hangs on a queued
	 * decision after the session is cancelled.
	 */
	cancelAll(reason = "session-cancelled"): void {
		if (this.entries.length === 0) {
			return;
		}
		for (const entry of this.entries) {
			entry.resolve("rejected");
		}
		this.entries.length = 0;
		this.notify();
		// `reason` is reserved for telemetry hooks the consumer may add
		// later — kept on the signature so the API doesn't break when
		// we surface it. Touch it so biome does not flag it as unused.
		this.lastCancelReason = reason;
	}

	/** Last `reason` passed to {@link cancelAll}; exposed for tests. */
	lastCancelReason?: string;

	subscribe(listener: PendingWritesListener): { dispose: () => void } {
		this.listeners.add(listener);
		// Immediate replay so freshly-attached subscribers see the
		// current state without waiting for the next change.
		listener(this.peek());
		return {
			dispose: () => {
				this.listeners.delete(listener);
			},
		};
	}

	private notify(): void {
		const snapshot = this.peek();
		for (const listener of this.listeners) {
			listener(snapshot);
		}
	}
}

function decideForEntry(
	entry: PendingEntry,
	action: FlushAction
): PendingWriteResolution | null {
	switch (action.kind) {
		case "accept-all":
			return "accepted";
		case "reject-all":
			return "rejected";
		case "accept-one":
			return entry.id === action.id ? "accepted" : null;
		case "reject-one":
			return entry.id === action.id ? "rejected" : null;
		default:
			return null;
	}
}

function snapshotOf(entry: PendingEntry): PendingWrite {
	return {
		id: entry.id,
		createdAt: entry.createdAt,
		path: entry.path,
		proposedContent: entry.proposedContent,
		oldText: entry.oldText,
		linesAdded: entry.linesAdded,
		linesRemoved: entry.linesRemoved,
		languageId: entry.languageId,
	};
}
