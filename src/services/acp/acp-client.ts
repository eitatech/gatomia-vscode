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
import { computeDiffStats } from "../../features/agent-chat/diff-stats";
import {
	type FlushAction,
	type PendingWrite,
	type PendingWritesListener,
	PendingWritesStore,
} from "../../features/agent-chat/pending-writes-store";
import { getExtendedPath } from "../../utils/cli-detector";
import type { AcpProviderDescriptor } from "./types";

/**
 * Resolves a permission decision interactively. Return the `optionId` to
 * select (e.g. `"allow-once"`), or `null` to cancel the request.
 */
export interface PermissionPromptRequest {
	options: Array<{ optionId: string; name: string; kind: string }>;
	sessionId: string;
	toolCall?: {
		title?: string | null;
		/**
		 * ACP tool category used by the host to remember "always" decisions
		 * across calls. See `ToolKind` in @agentclientprotocol/sdk.
		 */
		kind?: string | null;
	} | null;
}
export type PermissionPrompter = (
	request: PermissionPromptRequest
) => Promise<string | null>;

export type PermissionMode = "ask" | "allow" | "deny";

/**
 * Decisions remembered for the lifetime of an `AcpClient` so that an
 * `allow_always` / `reject_always` answer is honoured for subsequent tool
 * calls of the same `ToolKind` without re-prompting the user. The store is
 * keyed by tool kind (e.g. `"execute"`, `"read"`) and holds the option
 * `kind` the user selected; the live `optionId` is re-resolved from the
 * incoming options array because optionIds rotate per request.
 */
type RememberedDecisionKind = "allow_always" | "reject_always";
const REMEMBERABLE_KINDS = new Set<RememberedDecisionKind>([
	"allow_always",
	"reject_always",
]);

/**
 * Structured per-session events fanned out by {@link AcpClient.subscribeSession}.
 *
 * Shape is authoritative per
 * specs/018-agent-chat-panel/research.md §R2 — do not rename kinds without
 * updating the research doc and every downstream consumer.
 */
/**
 * Per-event projection of a file affected by a tool call. Surfaced so
 * the UI can render the Cursor-style `arquivo.ts +47 -1` cards without
 * having to re-parse the raw ACP `Diff` payload on every chunk update.
 */
export interface AcpAffectedFile {
	/** Absolute or workspace-relative path reported by the agent. */
	path: string;
	/** Lines added relative to `oldText`. */
	linesAdded: number;
	/** Lines removed relative to `oldText`. */
	linesRemoved: number;
	/**
	 * Best-effort language guess derived from the path extension. The
	 * webview uses this purely to pick an icon — it is *not* an
	 * authoritative VS Code `LanguageId`.
	 */
	languageId?: string;
}

export type AcpSessionEvent =
	| { kind: "agent-message-chunk"; text: string; at: number }
	| {
			kind: "tool-call";
			toolCallId: string;
			title?: string;
			status?: string;
			toolKind?: string;
			affectedFiles?: AcpAffectedFile[];
			at: number;
	  }
	| {
			kind: "tool-call-update";
			toolCallId: string;
			status?: string;
			toolKind?: string;
			affectedFiles?: AcpAffectedFile[];
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
	/**
	 * When true, every `writeTextFile` request from the agent is buffered
	 * in the {@link PendingWritesStore} and only persisted to disk after
	 * the user accepts it via the chat UI. Defaults to false (legacy
	 * "fire and forget" behaviour) so the redesign can ship dark and be
	 * toggled on per workspace.
	 */
	bufferFileWrites?: boolean;
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
	private permissionDefault: PermissionMode;
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

	/**
	 * Remembered `allow_always` / `reject_always` decisions keyed by ACP
	 * `ToolKind`. Lives for the lifetime of the AcpClient (one per provider
	 * + cwd) so users do not have to re-authorise the same category of
	 * action — e.g. confirming "Allow always" once for an `execute` tool
	 * call covers every subsequent shell-style invocation in the session.
	 */
	private readonly rememberedDecisions = new Map<
		string,
		RememberedDecisionKind
	>();

	/**
	 * Buffer of `writeTextFile` calls awaiting user approval. Only
	 * touched when {@link AcpClientOptions.bufferFileWrites} is true;
	 * otherwise stays empty and the legacy direct-write path runs.
	 */
	private readonly pendingWritesStore = new PendingWritesStore();

	private readonly bufferFileWrites: boolean;

	constructor(options: AcpClientOptions) {
		this.descriptor = options.descriptor;
		this.cwd = options.cwd;
		this.output = options.output;
		this.permissionDefault = options.permissionDefault ?? "ask";
		this.promptForPermission = options.promptForPermission;
		this.initializeTimeoutMs =
			options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS;
		this.bufferFileWrites = options.bufferFileWrites ?? false;
	}

	/**
	 * Subscribe to pending-writes snapshot changes. Used by the host
	 * (chat runner) to forward updates to the webview.
	 */
	subscribePendingWrites(listener: PendingWritesListener): {
		dispose: () => void;
	} {
		return this.pendingWritesStore.subscribe(listener);
	}

	/**
	 * Settle one or more pending writes. The store rejects the matching
	 * promises in `writeTextFile` (see {@link AcpClient.buildClientHandler})
	 * which then either persists the file or surfaces the rejection to
	 * the agent.
	 */
	flushPendingWrites(action: FlushAction): readonly PendingWrite[] {
		return this.pendingWritesStore.flush(action);
	}

	/**
	 * Cancels every queued write — the matching agent calls receive a
	 * rejection. Called from session shutdown / cancel paths so the
	 * agent never hangs waiting on a decision that nobody can make.
	 */
	cancelPendingWrites(reason?: string): void {
		this.pendingWritesStore.cancelAll(reason);
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

	/**
	 * Update the in-memory permission strategy without recycling the child
	 * process. The next `requestPermission` call from the agent honours the
	 * new mode.
	 *
	 * The handler returned by {@link buildClientHandler} reads the current
	 * value via `() => this.permissionDefault` so we don't need to rebuild
	 * the connection.
	 */
	setPermissionDefault(mode: PermissionMode): void {
		if (this.permissionDefault === mode) {
			return;
		}
		this.permissionDefault = mode;
		this.output.appendLine(
			`[ACP][${this.descriptor.id}] permissionDefault updated to ${mode}`
		);
	}

	private buildClientHandler(): Client {
		const output = this.output;
		const providerId = this.descriptor.id;
		const getPermissionDefault = (): PermissionMode => this.permissionDefault;
		const promptForPermission = this.promptForPermission;
		const rememberedDecisions = this.rememberedDecisions;
		const pendingWritesStore = this.pendingWritesStore;
		const bufferFileWrites = this.bufferFileWrites;
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
						emitToolCallEvent({
							output,
							providerId,
							sessionId,
							update,
							at,
							emit,
							kind: "tool-call",
						});
						break;
					case "tool_call_update":
						emitToolCallEvent({
							output,
							providerId,
							sessionId,
							update,
							at,
							emit,
							kind: "tool-call-update",
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
					mode: getPermissionDefault(),
					prompter: promptForPermission,
					output,
					providerId,
					rememberedDecisions,
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
				if (bufferFileWrites) {
					return await handleBufferedWrite({
						params,
						store: pendingWritesStore,
						providerId,
						output,
					});
				}
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

/**
 * Buffers a `writeTextFile` request through the pending-writes store
 * and only persists the file once the user accepts. Rejection is
 * surfaced as a thrown error so the agent's ACP RPC reply carries the
 * failure (and the agent can react / retry / abort the turn).
 *
 * Reads `oldText` from disk on a best-effort basis: missing files map
 * to `null`, every other read error is logged and treated as `null`
 * so we never block the queue waiting on a flaky `stat`.
 */
async function handleBufferedWrite(args: {
	params: { path: string; content: string };
	store: PendingWritesStore;
	providerId: string;
	output: OutputChannel;
}): Promise<Record<string, never>> {
	const { params, store, providerId, output } = args;
	let oldText: string | null;
	try {
		oldText = await readFile(params.path, "utf8");
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException | undefined)?.code;
		if (code !== "ENOENT") {
			output.appendLine(
				`[ACP][${providerId}] writeTextFile pre-read failed (${params.path}): ${toMessage(error)} — treating as new file`
			);
		}
		oldText = null;
	}

	const stats = computeDiffStats({ oldText, newText: params.content });
	output.appendLine(
		`[ACP][${providerId}] writeTextFile buffered (${params.path}); awaiting user accept/reject (+${stats.linesAdded} -${stats.linesRemoved})`
	);
	const { promise } = store.enqueueWrite({
		path: params.path,
		proposedContent: params.content,
		oldText,
		linesAdded: stats.linesAdded,
		linesRemoved: stats.linesRemoved,
		languageId: guessLanguageId(params.path),
	});
	const decision = await promise;
	if (decision === "rejected") {
		output.appendLine(
			`[ACP][${providerId}] writeTextFile rejected by user (${params.path})`
		);
		throw new Error(`User rejected file write: ${params.path}`);
	}
	try {
		await writeFile(params.path, params.content, "utf8");
		output.appendLine(
			`[ACP][${providerId}] writeTextFile accepted (${params.path})`
		);
		return {};
	} catch (error) {
		output.appendLine(
			`[ACP][${providerId}] writeTextFile flush failed (${params.path}): ${toMessage(error)}`
		);
		throw error;
	}
}

/**
 * Emits a `tool-call` / `tool-call-update` event with the affected
 * files projection attached. Pulled out of the giant `sessionUpdate`
 * switch so the parent function stays under the cyclomatic complexity
 * cap enforced by ultracite (max 15).
 */
function emitToolCallEvent(args: {
	output: OutputChannel;
	providerId: string;
	sessionId: string;
	at: number;
	emit: (sessionId: string, event: AcpSessionEvent) => void;
	kind: "tool-call" | "tool-call-update";
	update: {
		toolCallId: string;
		title?: string | null;
		status?: string | null;
		kind?: string | null;
		content?: ReadonlyArray<{
			type?: string;
			path?: string;
			oldText?: string | null;
			newText?: string;
		}> | null;
		locations?: ReadonlyArray<{ path?: string }> | null;
	};
}): void {
	const { output, providerId, sessionId, at, emit, kind, update } = args;
	if (kind === "tool-call") {
		output.appendLine(
			`\n[ACP][${providerId}] tool_call: ${update.title ?? ""} (${update.status ?? "pending"})`
		);
	} else {
		output.appendLine(
			`[ACP][${providerId}] tool_call_update: ${update.toolCallId} -> ${update.status ?? "unknown"}`
		);
	}
	const affectedFiles = extractAffectedFiles(update);
	const sharedPayload = {
		toolCallId: update.toolCallId,
		status: update.status ?? undefined,
		toolKind: update.kind ?? undefined,
		affectedFiles: affectedFiles.length > 0 ? affectedFiles : undefined,
		at,
	};
	if (kind === "tool-call") {
		emit(sessionId, {
			kind,
			...sharedPayload,
			title: update.title ?? undefined,
		});
	} else {
		emit(sessionId, { kind, ...sharedPayload });
	}
}

/**
 * Walks an ACP `tool_call` / `tool_call_update` payload and returns
 * one {@link AcpAffectedFile} per `Diff` content entry. Used by the UI
 * to render the Cursor-style `arquivo.ts +N -M` cards. Tool calls that
 * do not modify files (everything except `kind: edit | delete | move`)
 * naturally produce an empty array because they ship no `Diff` content.
 *
 * Falls back gracefully for partial / malformed payloads — every field
 * is optional in the ACP schema and we never throw out of the event
 * handler.
 */
function extractAffectedFiles(update: {
	content?: ReadonlyArray<{
		type?: string;
		path?: string;
		oldText?: string | null;
		newText?: string;
	}> | null;
	locations?: ReadonlyArray<{ path?: string }> | null;
}): AcpAffectedFile[] {
	const result: AcpAffectedFile[] = [];
	const diffs = update.content?.filter((entry) => entry?.type === "diff") ?? [];
	for (const diff of diffs) {
		if (typeof diff.path !== "string" || typeof diff.newText !== "string") {
			continue;
		}
		const stats = computeDiffStats({
			oldText: diff.oldText ?? null,
			newText: diff.newText,
		});
		result.push({
			path: diff.path,
			linesAdded: stats.linesAdded,
			linesRemoved: stats.linesRemoved,
			languageId: guessLanguageId(diff.path),
		});
	}

	// If the agent only reports `locations` (no diff body) still surface
	// the path so the card can render the file name with no stats.
	if (result.length === 0 && update.locations) {
		for (const location of update.locations) {
			if (typeof location?.path !== "string") {
				continue;
			}
			result.push({
				path: location.path,
				linesAdded: 0,
				linesRemoved: 0,
				languageId: guessLanguageId(location.path),
			});
		}
	}
	return result;
}

/**
 * Guesses a `LanguageId`-ish hint from a file path's extension. The
 * webview only uses this to pick an icon — it is not authoritative and
 * does not need to match the VS Code `languages` registry. Unknown
 * extensions return `undefined` so the card falls back to a generic
 * file icon.
 */
function guessLanguageId(path: string): string | undefined {
	const dot = path.lastIndexOf(".");
	if (dot < 0) {
		return;
	}
	const ext = path.slice(dot + 1).toLowerCase();
	const map: Record<string, string> = {
		ts: "typescript",
		tsx: "typescriptreact",
		js: "javascript",
		jsx: "javascriptreact",
		json: "json",
		md: "markdown",
		py: "python",
		rs: "rust",
		go: "go",
		java: "java",
		kt: "kotlin",
		rb: "ruby",
		cs: "csharp",
		cpp: "cpp",
		cc: "cpp",
		c: "c",
		h: "cpp",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		sh: "shellscript",
		bash: "shellscript",
		css: "css",
		scss: "scss",
		html: "html",
		sql: "sql",
	};
	return map[ext];
}

type PermissionOutcome =
	| { outcome: { outcome: "cancelled" } }
	| { outcome: { outcome: "selected"; optionId: string } };

interface ResolvePermissionArgs {
	params: {
		options?: Array<{ optionId: string; name: string; kind: string }>;
		sessionId: string;
		toolCall?: {
			title?: string | null;
			kind?: string | null;
		} | null;
	};
	mode: PermissionMode;
	prompter: PermissionPrompter | undefined;
	output: OutputChannel;
	providerId: string;
	/**
	 * Per-AcpClient memo of `allow_always` / `reject_always` decisions
	 * keyed by tool kind. Mutated in-place when the user picks an "always"
	 * option, and consulted on subsequent prompts to short-circuit the UI.
	 */
	rememberedDecisions: Map<string, RememberedDecisionKind>;
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

interface MemoContext {
	toolKind: string | null;
	options: Array<{ optionId: string; kind: string }>;
	rememberedDecisions: Map<string, RememberedDecisionKind>;
	output: OutputChannel;
	providerId: string;
	title: string;
}

/**
 * Returns a `PermissionOutcome` from the per-AcpClient memo when an
 * `allow_always` / `reject_always` decision has been recorded for this
 * tool kind. Returns `null` when there is no remembered decision (or when
 * the agent dropped support for the matching option, in which case the
 * stale entry is purged).
 */
function applyRememberedDecision(ctx: MemoContext): PermissionOutcome | null {
	const { toolKind, options, rememberedDecisions, output, providerId, title } =
		ctx;
	if (!toolKind) {
		return null;
	}
	const remembered = rememberedDecisions.get(toolKind);
	if (!remembered) {
		return null;
	}
	const optionId =
		options.find((opt) => opt.kind === remembered)?.optionId ??
		pickAuto(
			options,
			remembered === "allow_always" ? ALLOW_KINDS : REJECT_KINDS
		);
	if (!optionId) {
		rememberedDecisions.delete(toolKind);
		return null;
	}
	output.appendLine(
		`[ACP][${providerId}] permission auto-resolved (${title}) from remembered ${remembered} for kind=${toolKind}`
	);
	return toSelected(optionId);
}

/**
 * Stores the user's choice when it carries `allow_always` /
 * `reject_always` semantics so future calls of the same tool kind skip
 * the prompt.
 */
function rememberAlwaysDecision(
	ctx: MemoContext & { chosenOptionId: string }
): void {
	const {
		toolKind,
		chosenOptionId,
		options,
		rememberedDecisions,
		output,
		providerId,
	} = ctx;
	if (!toolKind) {
		return;
	}
	const chosenOption = options.find((opt) => opt.optionId === chosenOptionId);
	const chosenKind = chosenOption?.kind;
	if (!isRememberable(chosenKind)) {
		return;
	}
	rememberedDecisions.set(toolKind, chosenKind);
	output.appendLine(
		`[ACP][${providerId}] remembered ${chosenKind} for kind=${toolKind} — future calls of this kind will not prompt`
	);
}

function isRememberable(
	kind: string | undefined
): kind is RememberedDecisionKind {
	return (
		kind !== undefined && REMEMBERABLE_KINDS.has(kind as RememberedDecisionKind)
	);
}

async function resolvePermission(
	args: ResolvePermissionArgs
): Promise<PermissionOutcome> {
	const { params, mode, prompter, output, providerId, rememberedDecisions } =
		args;
	const options = params.options ?? [];
	const title = params.toolCall?.title ?? "unknown";
	const toolKind = params.toolCall?.kind ?? null;

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

	const memoCtx: MemoContext = {
		toolKind,
		options,
		rememberedDecisions,
		output,
		providerId,
		title,
	};
	const remembered = applyRememberedDecision(memoCtx);
	if (remembered) {
		return remembered;
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

	rememberAlwaysDecision({ ...memoCtx, chosenOptionId: chosen });

	output.appendLine(
		`[ACP][${providerId}] permission selected (${title}) -> ${chosen}`
	);
	return toSelected(chosen);
}
