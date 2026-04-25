import { randomUUID } from "node:crypto";
import type { Disposable, OutputChannel } from "vscode";
import {
	AcpClient,
	type AcpSessionEventListener,
	type PermissionMode,
	type PermissionPrompter,
} from "./acp-client";
import type { AcpProviderRegistry } from "./acp-provider-registry";
import type { AcpProviderDescriptor, SessionMode } from "./types";

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

/**
 * Resolver invoked the first time a descriptor whose `spawnCommand === "npx"`
 * is about to spawn a fresh subprocess. Returning `false` aborts the spawn and
 * causes `send()` to reject. The result is cached per `(providerId, cwd)`.
 */
export type BeforeSpawnHook = (
	descriptor: AcpProviderDescriptor,
	context: { cwd: string }
) => Promise<boolean>;

export interface AcpSessionManagerOptions {
	registry: AcpProviderRegistry;
	output: OutputChannel;
	cwd: string;
	/** Permission strategy forwarded to every spawned {@link AcpClient}. */
	permissionDefault?: PermissionMode;
	/** Interactive resolver used when `permissionDefault` is `"ask"`. */
	promptForPermission?: PermissionPrompter;
	/**
	 * Optional consent hook used to gate `npx -y <package>` spawns. The hook
	 * is only invoked for descriptors whose `spawnCommand` is `"npx"`.
	 */
	beforeSpawn?: BeforeSpawnHook;
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
	private readonly beforeSpawn: BeforeSpawnHook | undefined;
	/**
	 * Cached clients keyed by `${providerId}::${cwd}` (F1 remediation) so two
	 * concurrent worktree sessions for the same provider never share a
	 * subprocess.
	 */
	private readonly clients = new Map<string, AcpClient>();
	/**
	 * Set of `(providerId, cwd)` keys for which the user has already accepted
	 * an `npx -y` spawn. Prevents re-prompting on every call.
	 */
	private readonly consentedSpawns = new Set<string>();

	constructor(options: AcpSessionManagerOptions) {
		this.registry = options.registry;
		this.output = options.output;
		this.cwd = options.cwd;
		this.permissionDefault = options.permissionDefault;
		this.promptForPermission = options.promptForPermission;
		this.beforeSpawn = options.beforeSpawn;
	}

	async send(
		providerId: string,
		prompt: string,
		context: AcpSessionContext
	): Promise<void> {
		const cwd = this.resolveCwd(context);
		await this.ensureSpawnConsent(providerId, cwd);
		const client = this.ensureClient(providerId, cwd);
		const sessionKey = resolveSessionKey(context);
		await client.sendPrompt(sessionKey, prompt);
	}

	/**
	 * Variant of {@link send} that takes a caller-supplied session id directly,
	 * skipping the {@link SessionMode} → key mapping. Used by `AcpChatRunner`
	 * which mints its own ids via {@link deriveAcpSessionId}.
	 */
	async sendPromptDirect(
		providerId: string,
		cwd: string | undefined,
		sessionId: string,
		prompt: string
	): Promise<void> {
		const resolvedCwd = cwd ?? this.cwd;
		await this.ensureSpawnConsent(providerId, resolvedCwd);
		const client = this.ensureClient(providerId, resolvedCwd);
		await client.sendPrompt(sessionId, prompt);
	}

	/**
	 * Variant of {@link cancel} that targets a caller-supplied session id
	 * directly. Pair with {@link sendPromptDirect}.
	 */
	async cancelDirect(
		providerId: string,
		cwd: string | undefined,
		sessionId: string
	): Promise<void> {
		const client = this.findClient(providerId, cwd ?? this.cwd);
		if (!client) {
			return;
		}
		await client.cancel(sessionId);
	}

	private async ensureSpawnConsent(
		providerId: string,
		cwd: string
	): Promise<void> {
		if (!this.beforeSpawn) {
			return;
		}
		const key = this.clientKey(providerId, cwd);
		// A pre-existing client means we already spawned (or are spawning) the
		// process for this key — no consent prompt needed.
		if (this.clients.has(key) || this.consentedSpawns.has(key)) {
			return;
		}
		const descriptor = this.registry.get(providerId);
		if (!descriptor || descriptor.spawnCommand !== "npx") {
			return;
		}
		const consented = await this.beforeSpawn(descriptor, { cwd });
		if (!consented) {
			throw new Error(
				`[ACP] user declined npx spawn for provider '${providerId}'`
			);
		}
		this.consentedSpawns.add(key);
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
