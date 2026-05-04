/**
 * CloudChatAdapter — read-only bridge from spec 016 cloud-agent sessions to
 * the Agent Chat Panel runtime (T060).
 *
 * @see specs/018-agent-chat-panel/tasks.md T060
 *
 * Responsibilities:
 *   - Subscribe to {@link AgentPollingService.onSessionUpdated} events.
 *   - Map provider-canonical {@link SessionStatus} transitions into
 *     {@link AgentChatEvent} values consumed by `AgentChatPanel`.
 *   - Route cancels to the active provider's `cancelSession`.
 *   - Refuse follow-up input by not exposing `submit`/`retry` (FR-003).
 *   - Enforce one-adapter-per-cloudSessionLocalId via an internal registry so
 *     repeated `attach()` calls are idempotent and `dispose()` is reliably
 *     balanced.
 */

import type { Disposable } from "vscode";
import type {
	AgentChatEvent,
	AgentChatRunnerHandle,
	SessionLifecycleState,
} from "./types";

// ----------------------------------------------------------------------------
// Re-exports & decoupled shims
// ----------------------------------------------------------------------------
//
// We intentionally keep the dependency on `src/features/cloud-agents/**`
// one-way by re-declaring the *subset* of interfaces the adapter needs rather
// than importing the concrete classes. This keeps the agent-chat bundle free
// of cloud-agents-specific imports in tests and avoids the transitive VS Code
// API surface for unit isolation.

export interface AgentSession {
	readonly localId: string;
	readonly providerId: string;
	status:
		| "pending"
		| "running"
		| "blocked"
		| "completed"
		| "failed"
		| "cancelled";
	readonly errorMessage?: string;
}

export interface AgentSessionUpdatedEvent {
	readonly localId: string;
	readonly session: AgentSession;
}

export interface AgentPollingLike {
	onSessionUpdated(
		listener: (event: AgentSessionUpdatedEvent) => void
	): Disposable;
}

export interface CloudAgentProvider {
	readonly metadata: { readonly id: string };
	cancelSession(sessionId: string): Promise<void>;
}

export interface ProviderRegistry {
	getActive(): CloudAgentProvider | undefined;
	get(id: string): CloudAgentProvider | undefined;
}

// ----------------------------------------------------------------------------
// Adapter
// ----------------------------------------------------------------------------

export interface CloudChatAdapterAttachOptions {
	/** `AgentSession.localId` (spec 016 storage key). */
	cloudSessionLocalId: string;
	/** `AgentChatSession.id` — the agent-chat-side identifier. */
	sessionId: string;
	poller: AgentPollingLike;
	registry: ProviderRegistry;
	onEvent: (event: AgentChatEvent) => void;
}

const STATUS_TO_LIFECYCLE: Record<
	AgentSession["status"],
	SessionLifecycleState
> = {
	pending: "initializing",
	running: "running",
	blocked: "waiting-for-input",
	completed: "completed",
	failed: "failed",
	cancelled: "cancelled",
};

export class CloudChatAdapter implements AgentChatRunnerHandle {
	/**
	 * One-adapter-per-cloudSessionLocalId to keep `attach()` idempotent.
	 * Keyed by localId because that is the provider-authoritative identifier.
	 */
	private static readonly instances = new Map<string, CloudChatAdapter>();

	readonly sessionId: string;
	private readonly cloudSessionLocalId: string;
	private readonly registry: ProviderRegistry;
	private readonly onEvent: (event: AgentChatEvent) => void;
	private readonly subscription: Disposable;
	private lastStatus: AgentSession["status"] | undefined;
	private disposed = false;

	private constructor(options: CloudChatAdapterAttachOptions) {
		this.sessionId = options.sessionId;
		this.cloudSessionLocalId = options.cloudSessionLocalId;
		this.registry = options.registry;
		this.onEvent = options.onEvent;
		this.subscription = options.poller.onSessionUpdated((event) => {
			this.handleUpdate(event);
		});
	}

	/**
	 * Attach or re-attach to a cloud session. Safe to call repeatedly — the
	 * first call creates the adapter; subsequent calls with the same
	 * `cloudSessionLocalId` return the same instance.
	 */
	static attach(options: CloudChatAdapterAttachOptions): CloudChatAdapter {
		const existing = CloudChatAdapter.instances.get(
			options.cloudSessionLocalId
		);
		if (existing && !existing.disposed) {
			return existing;
		}
		const adapter = new CloudChatAdapter(options);
		CloudChatAdapter.instances.set(options.cloudSessionLocalId, adapter);
		return adapter;
	}

	async cancel(): Promise<void> {
		const provider = this.registry.getActive();
		if (!provider) {
			return;
		}
		await provider.cancelSession(this.cloudSessionLocalId);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.subscription.dispose();
		const current = CloudChatAdapter.instances.get(this.cloudSessionLocalId);
		if (current === this) {
			CloudChatAdapter.instances.delete(this.cloudSessionLocalId);
		}
	}

	private handleUpdate(event: AgentSessionUpdatedEvent): void {
		if (event.localId !== this.cloudSessionLocalId) {
			return;
		}
		const next = event.session.status;
		const at = Date.now();
		if (next !== this.lastStatus) {
			const from: SessionLifecycleState =
				this.lastStatus === undefined
					? "initializing"
					: STATUS_TO_LIFECYCLE[this.lastStatus];
			const to = STATUS_TO_LIFECYCLE[next];
			this.lastStatus = next;
			this.onEvent({
				type: "lifecycle/transitioned",
				sessionId: this.sessionId,
				from,
				to,
				at,
			});
		}
		if (next === "failed" && event.session.errorMessage) {
			this.onEvent({
				type: "error",
				sessionId: this.sessionId,
				category: "cloud-dispatch-failed",
				message: event.session.errorMessage,
				retryable: true,
				at,
			});
		}
	}
}
