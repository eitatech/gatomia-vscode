import { randomUUID } from "node:crypto";
import type { Disposable, OutputChannel } from "vscode";
import {
	AcpClient,
	type AcpSessionEventListener,
	type PermissionMode,
	type PermissionPrompter,
} from "./acp-client";
import type { AcpProviderRegistry } from "./acp-provider-registry";
import type { SessionMode } from "./types";

export interface AcpSessionContext {
	mode: SessionMode;
	specId?: string;
	/**
	 * Optional working directory. When present, the manager keys its cached
	 * `AcpClient` instances by `(providerId, cwd)` so two concurrent sessions
	 * that run in different worktrees get isolated subprocesses (F1
	 * remediation). Omit to reuse the manager's constructor cwd (default
	 * behavior — backward compatible).
	 */
	cwd?: string;
}

export interface AcpSessionManagerOptions {
	registry: AcpProviderRegistry;
	output: OutputChannel;
	cwd: string;
	/** Permission strategy forwarded to every spawned {@link AcpClient}. */
	permissionDefault?: PermissionMode;
	/** Interactive resolver used when `permissionDefault` is `"ask"`. */
	promptForPermission?: PermissionPrompter;
}

/**
 * Coordinates ACP clients and the session keys used to scope conversations.
 *
 * A single `AcpClient` is created per provider id and reused across calls.
 * The session key is derived from the requested `SessionMode`:
 *
 * - `workspace`: a shared key (`_ws_`) for all prompts in the workspace.
 * - `per-spec`: key is `spec:<specId>`; falls back to workspace when missing.
 * - `per-prompt`: a fresh `once:<uuid>` key generated per call.
 */
export class AcpSessionManager {
	private readonly registry: AcpProviderRegistry;
	private readonly output: OutputChannel;
	private readonly cwd: string;
	private readonly permissionDefault: PermissionMode | undefined;
	private readonly promptForPermission: PermissionPrompter | undefined;
	/**
	 * Cached clients keyed by `${providerId}::${cwd}` (F1 remediation) so two
	 * concurrent worktree sessions for the same provider never share a
	 * subprocess.
	 */
	private readonly clients = new Map<string, AcpClient>();

	constructor(options: AcpSessionManagerOptions) {
		this.registry = options.registry;
		this.output = options.output;
		this.cwd = options.cwd;
		this.permissionDefault = options.permissionDefault;
		this.promptForPermission = options.promptForPermission;
	}

	async send(
		providerId: string,
		prompt: string,
		context: AcpSessionContext
	): Promise<void> {
		const client = this.ensureClient(providerId, this.resolveCwd(context));
		const sessionKey = resolveSessionKey(context);
		await client.sendPrompt(sessionKey, prompt);
	}

	async cancel(providerId: string, context: AcpSessionContext): Promise<void> {
		const client = this.findClient(providerId, this.resolveCwd(context));
		if (!client) {
			return;
		}
		// per-prompt keys are fresh UUIDs, so deriving a new key here would never
		// match any tracked session. Fall back to the client's last-used key
		// (which is what the user most recently interacted with).
		if (context.mode === "per-prompt") {
			const lastKey = client.getLastSessionKey();
			if (!lastKey) {
				return;
			}
			await client.cancel(lastKey);
			return;
		}
		const sessionKey = resolveSessionKey(context);
		await client.cancel(sessionKey);
	}

	/**
	 * Cancels every active session for the provider across all cached cwd
	 * variants. Useful for a UI-level "cancel active ACP session" action where
	 * the exact session key is not known (e.g. per-prompt or per-spec modes).
	 */
	async cancelAll(providerId: string): Promise<void> {
		const prefix = `${providerId}::`;
		const matches: AcpClient[] = [];
		for (const [key, client] of this.clients.entries()) {
			if (key.startsWith(prefix)) {
				matches.push(client);
			}
		}
		for (const client of matches) {
			await client.cancelAll();
		}
	}

	/**
	 * Subscribe to structured events emitted by the underlying {@link AcpClient}
	 * for a given session. The manager resolves the correct client via the
	 * `(providerId, cwd)` pair and forwards the subscription.
	 */
	subscribe(
		providerId: string,
		cwd: string | undefined,
		sessionId: string,
		listener: AcpSessionEventListener
	): Disposable {
		const client = this.ensureClient(providerId, cwd ?? this.cwd);
		return client.subscribeSession(sessionId, listener);
	}

	dispose(): void {
		for (const client of this.clients.values()) {
			try {
				client.dispose();
			} catch (error) {
				this.output.appendLine(
					`[ACP] dispose failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
		this.clients.clear();
	}

	private resolveCwd(context: AcpSessionContext): string {
		return context.cwd ?? this.cwd;
	}

	private clientKey(providerId: string, cwd: string): string {
		return `${providerId}::${cwd}`;
	}

	private findClient(providerId: string, cwd: string): AcpClient | undefined {
		return this.clients.get(this.clientKey(providerId, cwd));
	}

	private ensureClient(providerId: string, cwd: string): AcpClient {
		const key = this.clientKey(providerId, cwd);
		const existing = this.clients.get(key);
		if (existing) {
			return existing;
		}
		const descriptor = this.registry.get(providerId);
		if (!descriptor) {
			throw new Error(`[ACP] unknown provider: ${providerId}`);
		}
		const client = new AcpClient({
			descriptor,
			cwd,
			output: this.output,
			permissionDefault: this.permissionDefault,
			promptForPermission: this.promptForPermission,
		});
		this.clients.set(key, client);
		return client;
	}
}

const WORKSPACE_KEY = "_ws_";

const resolveSessionKey = (context: AcpSessionContext): string => {
	switch (context.mode) {
		case "per-spec":
			return context.specId ? `spec:${context.specId}` : WORKSPACE_KEY;
		case "per-prompt":
			return `once:${randomUUID()}`;
		default:
			return WORKSPACE_KEY;
	}
};
