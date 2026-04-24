import { readFile, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
	ClientSideConnection,
	PROTOCOL_VERSION,
	ndJsonStream,
	type Client,
} from "@agentclientprotocol/sdk";
import type { Disposable, OutputChannel } from "vscode";
import { getExtendedPath } from "../../utils/cli-detector";
import type { AcpProviderDescriptor } from "./types";

/**
 * Resolves a permission decision interactively. Return the `optionId` to
 * select (e.g. `"allow-once"`), or `null` to cancel the request.
 */
export interface PermissionPromptRequest {
	options: Array<{ optionId: string; name: string; kind: string }>;
	sessionId: string;
	toolCall?: { title?: string | null } | null;
}
export type PermissionPrompter = (
	request: PermissionPromptRequest
) => Promise<string | null>;

export type PermissionMode = "ask" | "allow" | "deny";

/**
 * Structured per-session events fanned out by {@link AcpClient.subscribeSession}.
 *
 * Shape is authoritative per
 * specs/018-agent-chat-panel/research.md §R2 — do not rename kinds without
 * updating the research doc and every downstream consumer.
 */
export type AcpSessionEvent =
	| { kind: "agent-message-chunk"; text: string; at: number }
	| {
			kind: "tool-call";
			toolCallId: string;
			title?: string;
			status?: string;
			at: number;
	  }
	| {
			kind: "tool-call-update";
			toolCallId: string;
			status?: string;
			at: number;
	  }
	| { kind: "turn-finished"; stopReason: string; at: number }
	| { kind: "error"; message: string; at: number };

export type AcpSessionEventListener = (event: AcpSessionEvent) => void;

export interface AcpClientOptions {
	descriptor: AcpProviderDescriptor;
	cwd: string;
	output: OutputChannel;
	/** Optional default permission strategy when tool calls require auth. */
	permissionDefault?: PermissionMode;
	/**
	 * Invoked when `permissionDefault` is `"ask"` and the agent requests a
	 * tool-call permission. When omitted, every request is cancelled.
	 */
	promptForPermission?: PermissionPrompter;
	/**
	 * Maximum time (ms) to wait for `initialize` before giving up and killing
	 * the child process. Defaults to 15 s.
	 */
	initializeTimeoutMs?: number;
}

const ALLOW_KINDS = new Set(["allow_once", "allow_always"]);
const REJECT_KINDS = new Set(["reject_once", "reject_always"]);
const DEFAULT_INITIALIZE_TIMEOUT_MS = 15_000;
const ONCE_SESSION_KEY_PREFIX = "once:";

interface SessionEntry {
	sessionId: string;
}

/**
 * Thin wrapper around the ACP SDK that manages a long-lived child process
 * running `<provider> acp` (or equivalent) and exposes a minimal surface for
 * sending prompts scoped to session keys.
 *
 * The underlying child process is started lazily on the first prompt and
 * reused across subsequent prompts belonging to the same provider.
 */
export class AcpClient {
	private readonly descriptor: AcpProviderDescriptor;
	private readonly cwd: string;
	private readonly output: OutputChannel;
	private readonly permissionDefault: PermissionMode;
	private readonly promptForPermission: PermissionPrompter | undefined;
	private readonly initializeTimeoutMs: number;
	private connection: ClientSideConnection | null = null;
	private process: ChildProcess | null = null;
	private readonly sessions = new Map<string, SessionEntry>();
	private readonly pendingWaiters = new Set<(reason: Error) => void>();
	private startingPromise: Promise<void> | null = null;
	private lastSessionKey: string | null = null;

	/**
	 * Per-session event bus (T013). Each session id maps to a set of listeners
	 * that receive structured {@link AcpSessionEvent} payloads. Additive to the
	 * existing {@link OutputChannel} writes — FR-022 requires the log stream to
	 * remain unchanged.
	 */
	private readonly sessionListeners = new Map<
		string,
		Set<AcpSessionEventListener>
	>();

	constructor(options: AcpClientOptions) {
		this.descriptor = options.descriptor;
		this.cwd = options.cwd;
		this.output = options.output;
		this.permissionDefault = options.permissionDefault ?? "ask";
		this.promptForPermission = options.promptForPermission;
		this.initializeTimeoutMs =
			options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS;
	}

	/** Returns the most recently used session key, or null when no prompt has run. */
	getLastSessionKey(): string | null {
		return this.lastSessionKey;
	}

	/** Returns a snapshot of the currently tracked session keys. */
	getSessionKeys(): string[] {
		return [...this.sessions.keys()];
	}

	/**
	 * Subscribe to structured events for a specific ACP `sessionId`. The returned
	 * {@link Disposable} removes the listener without disturbing other subscribers.
	 *
	 * Event delivery is synchronous and best-effort: a throwing listener does
	 * not affect other listeners or the ACP protocol handler. All events are
	 *in addition to* the existing {@link OutputChannel} writes preserved for
	 * FR-022 backwards compatibility.
	 */
	subscribeSession(
		sessionId: string,
		listener: AcpSessionEventListener
	): Disposable {
		let bucket = this.sessionListeners.get(sessionId);
		if (!bucket) {
			bucket = new Set();
			this.sessionListeners.set(sessionId, bucket);
		}
		bucket.add(listener);
		return {
			dispose: () => {
				const current = this.sessionListeners.get(sessionId);
				if (!current) {
					return;
				}
				current.delete(listener);
				if (current.size === 0) {
					this.sessionListeners.delete(sessionId);
				}
			},
		};
	}

	/** Fan out an event to every subscriber for a session. Best-effort. */
	private emitSessionEvent(sessionId: string, event: AcpSessionEvent): void {
		const bucket = this.sessionListeners.get(sessionId);
		if (!bucket || bucket.size === 0) {
			return;
		}
		// Snapshot to tolerate listeners that dispose themselves during delivery.
		for (const listener of [...bucket]) {
			try {
				listener(event);
			} catch {
				// Best-effort fanout; never let a misbehaving listener break ACP.
			}
		}
	}

	/**
	 * Guarantees the subprocess is running and the connection is initialised.
	 * Safe to call multiple times; concurrent callers share a single start.
	 */
	async ensureStarted(): Promise<void> {
		if (this.connection) {
			return;
		}
		if (this.startingPromise) {
			await this.startingPromise;
			return;
		}
		this.startingPromise = this.start();
		try {
			await this.startingPromise;
		} finally {
			this.startingPromise = null;
		}
	}

	/**
	 * Sends a prompt on the session identified by `sessionKey`, creating the
	 * session on demand. Resolves when the ACP turn completes.
	 */
	async sendPrompt(sessionKey: string, prompt: string): Promise<void> {
		await this.ensureStarted();
		if (!this.connection) {
			throw new Error(
				`[ACP][${this.descriptor.id}] connection failed to initialise`
			);
		}

		const existing = this.sessions.get(sessionKey);
		const sessionId = existing
			? existing.sessionId
			: await this.createSession(sessionKey);

		this.lastSessionKey = sessionKey;

		this.output.appendLine(
			`[ACP][${this.descriptor.id}] session=${sessionId} prompt=${prompt.length}chars`
		);

		try {
			const result = await this.connection.prompt({
				sessionId,
				prompt: [{ type: "text", text: prompt }],
			});
			this.output.appendLine(
				`[ACP][${this.descriptor.id}] turn finished (stopReason=${result.stopReason})`
			);
		} finally {
			// Single-shot sessions should not accumulate: the next prompt with the
			// same key would be a new one-off anyway.
			if (sessionKey.startsWith(ONCE_SESSION_KEY_PREFIX)) {
				this.sessions.delete(sessionKey);
			}
		}
	}

	/**
	 * Cancels the in-flight prompt for a session, if any.
	 */
	async cancel(sessionKey: string): Promise<void> {
		const entry = this.sessions.get(sessionKey);
		if (!entry) {
			return;
		}
		if (!this.connection) {
			return;
		}
		try {
			await this.connection.cancel({ sessionId: entry.sessionId });
			this.output.appendLine(
				`[ACP][${this.descriptor.id}] cancelled session ${entry.sessionId}`
			);
		} catch (error) {
			this.output.appendLine(
				`[ACP][${this.descriptor.id}] cancel failed: ${toMessage(error)}`
			);
		} finally {
			// Drop single-shot sessions regardless of cancel outcome so subsequent
			// cancelAll() calls do not target them.
			if (sessionKey.startsWith(ONCE_SESSION_KEY_PREFIX)) {
				this.sessions.delete(sessionKey);
			}
			if (this.lastSessionKey === sessionKey) {
				this.lastSessionKey = null;
			}
		}
	}

	/**
	 * Cancels every currently tracked session. Useful when the caller doesn't
	 * know the specific session key (e.g. the UI-level "Cancel active ACP
	 * session" command under per-prompt or per-spec routing).
	 */
	async cancelAll(): Promise<void> {
		const keys = [...this.sessions.keys()];
		for (const key of keys) {
			await this.cancel(key);
		}
	}

	/**
	 * Kills the subprocess and clears in-memory state. Safe to call repeatedly.
	 */
	dispose(): void {
		if (this.process && !this.process.killed) {
			try {
				this.process.kill();
			} catch (error) {
				this.output.appendLine(
					`[ACP][${this.descriptor.id}] kill failed: ${toMessage(error)}`
				);
			}
		}
		this.process = null;
		this.connection = null;
		this.sessions.clear();
		this.lastSessionKey = null;
		this.rejectPendingWaiters(
			new Error(`[ACP][${this.descriptor.id}] client disposed`)
		);
	}

	private async start(): Promise<void> {
		this.output.appendLine(
			`[ACP][${this.descriptor.id}] spawning ${this.descriptor.spawnCommand} ${this.descriptor.spawnArgs.join(" ")} (cwd=${this.cwd})`
		);

		const child = spawn(
			this.descriptor.spawnCommand,
			this.descriptor.spawnArgs,
			{
				cwd: this.cwd,
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					PATH: getExtendedPath(),
				},
			}
		);

		this.process = child;

		child.on("exit", (code, signal) => {
			this.output.appendLine(
				`[ACP][${this.descriptor.id}] process exited code=${code} signal=${signal}`
			);
			this.process = null;
			this.connection = null;
			this.sessions.clear();
			this.lastSessionKey = null;
			this.rejectPendingWaiters(
				new Error(
					`[ACP][${this.descriptor.id}] child process exited (code=${code} signal=${signal})`
				)
			);
		});

		child.on("error", (error) => {
			this.output.appendLine(
				`[ACP][${this.descriptor.id}] spawn error: ${toMessage(error)}`
			);
			this.rejectPendingWaiters(
				error instanceof Error ? error : new Error(String(error))
			);
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString().trimEnd();
			if (text) {
				this.output.appendLine(`[ACP][${this.descriptor.id}][stderr] ${text}`);
			}
		});

		if (!child.stdin) {
			throw new Error(
				`[ACP][${this.descriptor.id}] child process has no stdin`
			);
		}
		if (!child.stdout) {
			throw new Error(
				`[ACP][${this.descriptor.id}] child process has no stdout`
			);
		}

		const writable = Writable.toWeb(child.stdin) as WritableStream<Uint8Array>;
		const readable = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
		const stream = ndJsonStream(writable, readable);

		const clientHandler = this.buildClientHandler();
		this.connection = new ClientSideConnection(() => clientHandler, stream);

		try {
			await this.withStartupTimeout(
				this.connection.initialize({
					protocolVersion: PROTOCOL_VERSION,
					clientCapabilities: {
						fs: { readTextFile: true, writeTextFile: true },
					},
				}),
				"initialize"
			);
		} catch (error) {
			// Best-effort cleanup so the next ensureStarted() call retries cleanly.
			this.output.appendLine(
				`[ACP][${this.descriptor.id}] initialize failed: ${toMessage(error)}`
			);
			this.connection = null;
			if (this.process && !this.process.killed) {
				try {
					this.process.kill();
				} catch {
					// swallow — exit handler will clean up state.
				}
			}
			throw error;
		}

		this.output.appendLine(
			`[ACP][${this.descriptor.id}] initialised (protocolVersion=${PROTOCOL_VERSION})`
		);
	}

	private withStartupTimeout<T>(
		promise: Promise<T>,
		label: string
	): Promise<T> {
		const timeoutMs = this.initializeTimeoutMs;
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
			return promise;
		}
		return new Promise<T>((resolve, reject) => {
			const rejectWaiter = (reason: Error) => reject(reason);
			this.pendingWaiters.add(rejectWaiter);

			const timer = setTimeout(() => {
				this.pendingWaiters.delete(rejectWaiter);
				reject(
					new Error(
						`[ACP][${this.descriptor.id}] ${label} timed out after ${timeoutMs}ms`
					)
				);
			}, timeoutMs);

			promise.then(
				(value) => {
					clearTimeout(timer);
					this.pendingWaiters.delete(rejectWaiter);
					resolve(value);
				},
				(error: unknown) => {
					clearTimeout(timer);
					this.pendingWaiters.delete(rejectWaiter);
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			);
		});
	}

	private rejectPendingWaiters(reason: Error): void {
		if (this.pendingWaiters.size === 0) {
			return;
		}
		const waiters = [...this.pendingWaiters];
		this.pendingWaiters.clear();
		for (const waiter of waiters) {
			try {
				waiter(reason);
			} catch {
				// Ignore — waiters are just reject callbacks.
			}
		}
	}

	private async createSession(sessionKey: string): Promise<string> {
		if (!this.connection) {
			throw new Error(
				`[ACP][${this.descriptor.id}] connection not ready for session ${sessionKey}`
			);
		}
		const response = await this.connection.newSession({
			cwd: this.cwd,
			mcpServers: [],
		});
		this.sessions.set(sessionKey, { sessionId: response.sessionId });
		this.output.appendLine(
			`[ACP][${this.descriptor.id}] session created key=${sessionKey} id=${response.sessionId}`
		);
		return response.sessionId;
	}

	private buildClientHandler(): Client {
		const output = this.output;
		const providerId = this.descriptor.id;
		const permissionDefault = this.permissionDefault;
		const promptForPermission = this.promptForPermission;
		// Bind the bus emitter so the handler object (not the AcpClient
		// instance) can still fan out events without losing `this`.
		const emit = (sessionId: string, event: AcpSessionEvent): void =>
			this.emitSessionEvent(sessionId, event);

		return {
			sessionUpdate(params) {
				const update = params.update;
				const sessionId = params.sessionId;
				const at = Date.now();
				switch (update.sessionUpdate) {
					case "agent_message_chunk":
						if (update.content.type === "text") {
							output.append(update.content.text);
							emit(sessionId, {
								kind: "agent-message-chunk",
								text: update.content.text,
								at,
							});
						}
						break;
					case "tool_call":
						output.appendLine(
							`\n[ACP][${providerId}] tool_call: ${update.title ?? ""} (${update.status ?? "pending"})`
						);
						emit(sessionId, {
							kind: "tool-call",
							toolCallId: update.toolCallId,
							title: update.title ?? undefined,
							status: update.status ?? undefined,
							at,
						});
						break;
					case "tool_call_update":
						output.appendLine(
							`[ACP][${providerId}] tool_call_update: ${update.toolCallId} -> ${update.status ?? "unknown"}`
						);
						emit(sessionId, {
							kind: "tool-call-update",
							toolCallId: update.toolCallId,
							status: update.status ?? undefined,
							at,
						});
						break;
					default:
						break;
				}
				return Promise.resolve();
			},
			requestPermission: (params) =>
				resolvePermission({
					params,
					mode: permissionDefault,
					prompter: promptForPermission,
					output,
					providerId,
				}),
			async readTextFile(params) {
				try {
					const buffer = await readFile(params.path, "utf8");
					if (params.line == null && params.limit == null) {
						return { content: buffer };
					}
					const lines = buffer.split("\n");
					const start = Math.max(0, (params.line ?? 1) - 1);
					const end = params.limit ? start + params.limit : lines.length;
					return { content: lines.slice(start, end).join("\n") };
				} catch (error) {
					output.appendLine(
						`[ACP][${providerId}] readTextFile failed (${params.path}): ${toMessage(error)}`
					);
					throw error;
				}
			},
			async writeTextFile(params) {
				try {
					await writeFile(params.path, params.content, "utf8");
					return {};
				} catch (error) {
					output.appendLine(
						`[ACP][${providerId}] writeTextFile failed (${params.path}): ${toMessage(error)}`
					);
					throw error;
				}
			},
		};
	}
}

const toMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

type PermissionOutcome =
	| { outcome: { outcome: "cancelled" } }
	| { outcome: { outcome: "selected"; optionId: string } };

interface ResolvePermissionArgs {
	params: {
		options?: Array<{ optionId: string; name: string; kind: string }>;
		sessionId: string;
		toolCall?: { title?: string | null } | null;
	};
	mode: PermissionMode;
	prompter: PermissionPrompter | undefined;
	output: OutputChannel;
	providerId: string;
}

const toCancelled = (): PermissionOutcome => ({
	outcome: { outcome: "cancelled" },
});
const toSelected = (optionId: string): PermissionOutcome => ({
	outcome: { outcome: "selected", optionId },
});

const pickAuto = (
	options: Array<{ optionId: string; kind: string }>,
	kinds: Set<string>
): string | undefined => options.find((opt) => kinds.has(opt.kind))?.optionId;

async function resolvePermission(
	args: ResolvePermissionArgs
): Promise<PermissionOutcome> {
	const { params, mode, prompter, output, providerId } = args;
	const options = params.options ?? [];
	const title = params.toolCall?.title ?? "unknown";

	if (mode === "allow") {
		const optionId = pickAuto(options, ALLOW_KINDS) ?? options[0]?.optionId;
		if (!optionId) {
			return toCancelled();
		}
		output.appendLine(
			`[ACP][${providerId}] permission auto-allowed (${title}) -> ${optionId}`
		);
		return toSelected(optionId);
	}

	if (mode === "deny") {
		const optionId = pickAuto(options, REJECT_KINDS);
		if (!optionId) {
			return toCancelled();
		}
		output.appendLine(
			`[ACP][${providerId}] permission auto-denied (${title}) -> ${optionId}`
		);
		return toSelected(optionId);
	}

	if (!prompter) {
		output.appendLine(
			`[ACP][${providerId}] permission requested (${title}); no prompter registered, cancelling`
		);
		return toCancelled();
	}

	output.appendLine(
		`[ACP][${providerId}] permission requested (${title}); awaiting user choice`
	);
	const chosen = await prompter({
		options,
		sessionId: params.sessionId,
		toolCall: params.toolCall ?? undefined,
	});
	if (!chosen) {
		output.appendLine(
			`[ACP][${providerId}] permission cancelled by user (${title})`
		);
		return toCancelled();
	}
	output.appendLine(
		`[ACP][${providerId}] permission selected (${title}) -> ${chosen}`
	);
	return toSelected(chosen);
}
