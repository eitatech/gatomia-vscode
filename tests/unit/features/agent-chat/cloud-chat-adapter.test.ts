/**
 * CloudChatAdapter unit tests (T052).
 *
 * TDD (Constitution III): red before T060.
 *
 * Covers:
 *   - `attach(localId)` is idempotent (same adapter instance returned).
 *   - Polling updates from `AgentPollingService.onSessionUpdated` are mapped
 *     into `AgentChatEvent`s (`lifecycle/transitioned` + `error`).
 *   - `cancel()` routes through the active provider adapter.
 *   - Read-only invariant: the adapter does NOT expose `submit`/`retry`
 *     (cloud sessions refuse follow-up input per FR-003).
 */

import type { Disposable } from "vscode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AgentSession,
	AgentSessionUpdatedEvent,
	CloudAgentProvider,
	ProviderRegistry,
} from "../../../../src/features/agent-chat/cloud-chat-adapter";
import { CloudChatAdapter } from "../../../../src/features/agent-chat/cloud-chat-adapter";
import type {
	AgentChatEvent,
	SessionLifecycleState,
} from "../../../../src/features/agent-chat/types";

type Listener = (event: AgentSessionUpdatedEvent) => void;

interface FakePollerHandle {
	readonly listeners: Set<Listener>;
	readonly poller: {
		onSessionUpdated: (l: Listener) => Disposable;
	};
	emit(event: AgentSessionUpdatedEvent): void;
}

function createFakePoller(): FakePollerHandle {
	const listeners = new Set<Listener>();
	return {
		listeners,
		poller: {
			onSessionUpdated(l: Listener): Disposable {
				listeners.add(l);
				return { dispose: () => listeners.delete(l) };
			},
		},
		emit(event) {
			for (const l of [...listeners]) {
				l(event);
			}
		},
	};
}

function createFakeProvider(): CloudAgentProvider {
	return {
		metadata: { id: "devin" },
		cancelSession: vi.fn(() => Promise.resolve()),
	};
}

function createFakeRegistry(
	provider: CloudAgentProvider | undefined
): ProviderRegistry {
	return {
		getActive: () => provider,
		get: (id: string) => (provider?.metadata.id === id ? provider : undefined),
	};
}

function session(
	localId: string,
	status: AgentSession["status"]
): AgentSession {
	return {
		localId,
		providerId: "devin",
		status,
	};
}

describe("CloudChatAdapter", () => {
	let events: AgentChatEvent[];
	let pollerHandle: FakePollerHandle;
	let provider: CloudAgentProvider;

	beforeEach(() => {
		events = [];
		pollerHandle = createFakePoller();
		provider = createFakeProvider();
	});

	it("attach is idempotent: the same adapter is returned for the same localId", () => {
		const adapter = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-1",
			sessionId: "sess-1",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		const again = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-1",
			sessionId: "sess-1",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		expect(again).toBe(adapter);
	});

	it("dispose releases the subscription and a subsequent attach returns a fresh adapter", () => {
		const first = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-2",
			sessionId: "sess-2",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		first.dispose();
		expect(pollerHandle.listeners.size).toBe(0);

		const second = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-2",
			sessionId: "sess-2",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		expect(second).not.toBe(first);
	});

	it.each([
		["pending", "initializing"],
		["running", "running"],
		["blocked", "waiting-for-input"],
		["completed", "completed"],
		["failed", "failed"],
		["cancelled", "cancelled"],
	] as [
		AgentSession["status"],
		SessionLifecycleState,
	][])("maps provider status %s -> lifecycle %s", (status, expectedLifecycle) => {
		// Unique localId per case so the attach-idempotency cache (keyed by
		// localId) doesn't cross-pollute between parametrised runs.
		const cloudId = `cloud-3-${status}`;
		const sessId = `sess-3-${status}`;
		CloudChatAdapter.attach({
			cloudSessionLocalId: cloudId,
			sessionId: sessId,
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		pollerHandle.emit({
			localId: cloudId,
			session: session(cloudId, status),
		});
		const lifecycleEvents = events.filter(
			(e) => e.type === "lifecycle/transitioned"
		);
		expect(lifecycleEvents).toHaveLength(1);
		const event = lifecycleEvents[0];
		if (event.type !== "lifecycle/transitioned") {
			throw new Error("unreachable");
		}
		expect(event.to).toBe(expectedLifecycle);
		expect(event.sessionId).toBe(sessId);
	});

	it("ignores updates for other localIds", () => {
		CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-filter",
			sessionId: "sess-filter",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		pollerHandle.emit({
			localId: "some-other-id",
			session: session("some-other-id", "running"),
		});
		expect(events).toEqual([]);
	});

	it("emits an error event when the session status becomes failed with errorMessage", () => {
		CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-err",
			sessionId: "sess-err",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		pollerHandle.emit({
			localId: "cloud-err",
			session: {
				...session("cloud-err", "failed"),
				errorMessage: "Cloud provider rejected the task",
			} as AgentSession,
		});
		const errorEvents = events.filter((e) => e.type === "error");
		expect(errorEvents).toHaveLength(1);
		const event = errorEvents[0];
		if (event.type !== "error") {
			throw new Error("unreachable");
		}
		expect(event.category).toBe("cloud-dispatch-failed");
		expect(event.message).toContain("rejected");
	});

	it("cancel() routes through the active provider adapter", async () => {
		const adapter = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-cancel",
			sessionId: "sess-cancel",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		await adapter.cancel();
		expect(provider.cancelSession).toHaveBeenCalledWith("cloud-cancel");
	});

	it("cancel() is a no-op when no provider is active (defensive)", async () => {
		const adapter = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-no-provider",
			sessionId: "sess-no-provider",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(undefined),
			onEvent: (e) => events.push(e),
		});
		await expect(adapter.cancel()).resolves.toBeUndefined();
	});

	it("does NOT expose submit/retry (read-only invariant, FR-003)", () => {
		const adapter = CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-readonly",
			sessionId: "sess-readonly",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		expect(adapter.submit).toBeUndefined();
		expect(adapter.retry).toBeUndefined();
	});

	it("does not emit duplicate lifecycle events when status is unchanged", () => {
		CloudChatAdapter.attach({
			cloudSessionLocalId: "cloud-dedup",
			sessionId: "sess-dedup",
			poller: pollerHandle.poller,
			registry: createFakeRegistry(provider),
			onEvent: (e) => events.push(e),
		});
		pollerHandle.emit({
			localId: "cloud-dedup",
			session: session("cloud-dedup", "running"),
		});
		pollerHandle.emit({
			localId: "cloud-dedup",
			session: session("cloud-dedup", "running"),
		});
		const lifecycleEvents = events.filter(
			(e) => e.type === "lifecycle/transitioned"
		);
		expect(lifecycleEvents).toHaveLength(1);
	});
});
