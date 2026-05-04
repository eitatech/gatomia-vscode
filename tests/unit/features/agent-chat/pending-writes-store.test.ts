/**
 * PendingWritesStore — unit coverage.
 *
 * The buffer-then-apply contract has two halves:
 *   - The agent calls `enqueueWrite` and receives a Promise that
 *     stays pending until the user resolves it.
 *   - The host calls `flush` (or `cancelAll`) to settle queued
 *     entries and notifies subscribers with the new snapshot.
 *
 * These tests pin both halves so future refactors cannot silently
 * drop pending writes or leak un-resolved promises.
 */

import { describe, expect, it, vi } from "vitest";
import {
	PendingWritesStore,
	type PendingWrite,
} from "../../../../src/features/agent-chat/pending-writes-store";

const ID_PREFIX_RE = /pw-/;

function makeStore(seed = 0): {
	store: PendingWritesStore;
	nextId: () => string;
} {
	let counter = seed;
	const idFactory = (): string => {
		counter += 1;
		return `pw-${counter}`;
	};
	return {
		store: new PendingWritesStore({ now: () => 1000, idFactory }),
		nextId: idFactory,
	};
}

describe("PendingWritesStore", () => {
	describe("enqueueWrite", () => {
		it("appends an entry visible to subsequent peek() calls", () => {
			const { store } = makeStore();
			store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			expect(store.peek()).toHaveLength(1);
			expect(store.peek()[0]).toMatchObject({ path: "/a.ts", oldText: null });
		});

		it("returns a promise that stays pending until flushed", async () => {
			const { store } = makeStore();
			const { promise } = store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			let resolved = false;
			promise.then(() => {
				resolved = true;
			});
			// One microtask flush — promise must still be pending.
			await Promise.resolve();
			expect(resolved).toBe(false);
		});

		it("notifies subscribers synchronously after each enqueue", () => {
			const { store } = makeStore();
			const listener = vi.fn();
			store.subscribe(listener);
			// Immediate replay: 1 call with empty array.
			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenLastCalledWith([]);

			store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			expect(listener).toHaveBeenCalledTimes(2);
			const [snapshot] = listener.mock.calls[1] as [readonly PendingWrite[]];
			expect(snapshot).toHaveLength(1);
		});
	});

	describe("flush", () => {
		it("accept-all resolves every pending promise with 'accepted' and clears the buffer", async () => {
			const { store } = makeStore();
			const a = store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			const b = store.enqueueWrite({
				path: "/b.ts",
				proposedContent: "y",
				oldText: null,
			});
			const settled = store.flush({ kind: "accept-all" });
			await expect(a.promise).resolves.toBe("accepted");
			await expect(b.promise).resolves.toBe("accepted");
			expect(store.peek()).toHaveLength(0);
			expect(settled).toHaveLength(2);
		});

		it("reject-all resolves every pending promise with 'rejected' and clears the buffer", async () => {
			const { store } = makeStore();
			const a = store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			store.flush({ kind: "reject-all" });
			await expect(a.promise).resolves.toBe("rejected");
			expect(store.peek()).toHaveLength(0);
		});

		it("accept-one only settles the matching id, leaves others pending", async () => {
			const { store } = makeStore();
			const a = store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			const b = store.enqueueWrite({
				path: "/b.ts",
				proposedContent: "y",
				oldText: null,
			});
			store.flush({ kind: "accept-one", id: a.id });
			await expect(a.promise).resolves.toBe("accepted");

			let bResolved = false;
			b.promise.then(() => {
				bResolved = true;
			});
			await Promise.resolve();
			expect(bResolved).toBe(false);
			expect(store.peek()).toHaveLength(1);
			expect(store.peek()[0]?.id).toBe(b.id);
		});

		it("reject-one only settles the matching id, leaves others pending", async () => {
			const { store } = makeStore();
			const a = store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			const b = store.enqueueWrite({
				path: "/b.ts",
				proposedContent: "y",
				oldText: null,
			});
			store.flush({ kind: "reject-one", id: a.id });
			await expect(a.promise).resolves.toBe("rejected");
			expect(store.peek()).toHaveLength(1);
			expect(store.peek()[0]?.id).toBe(b.id);
			// Reference `b` again so it isn't reported as unused; the
			// promise stays pending intentionally.
			expect(b.id).toMatch(ID_PREFIX_RE);
		});

		it("notifies subscribers when entries are settled", () => {
			const { store } = makeStore();
			store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			const listener = vi.fn();
			store.subscribe(listener);
			listener.mockClear();
			store.flush({ kind: "accept-all" });
			expect(listener).toHaveBeenCalledWith([]);
		});

		it("does not notify when no entry matches accept-one / reject-one", () => {
			const { store } = makeStore();
			store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			const listener = vi.fn();
			store.subscribe(listener);
			listener.mockClear();
			store.flush({ kind: "accept-one", id: "does-not-exist" });
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("cancelAll", () => {
		it("rejects every pending entry and clears the buffer", async () => {
			const { store } = makeStore();
			const a = store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			store.cancelAll("session-cancelled");
			await expect(a.promise).resolves.toBe("rejected");
			expect(store.peek()).toHaveLength(0);
			expect(store.lastCancelReason).toBe("session-cancelled");
		});

		it("is a no-op when the queue is empty", () => {
			const { store } = makeStore();
			const listener = vi.fn();
			store.subscribe(listener);
			listener.mockClear();
			store.cancelAll();
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("subscribe", () => {
		it("replays the current snapshot immediately on attach", () => {
			const { store } = makeStore();
			store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			const listener = vi.fn();
			store.subscribe(listener);
			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener.mock.calls[0]?.[0]).toHaveLength(1);
		});

		it("dispose stops further notifications", () => {
			const { store } = makeStore();
			const listener = vi.fn();
			const subscription = store.subscribe(listener);
			subscription.dispose();
			listener.mockClear();
			store.enqueueWrite({
				path: "/a.ts",
				proposedContent: "x",
				oldText: null,
			});
			expect(listener).not.toHaveBeenCalled();
		});
	});
});
