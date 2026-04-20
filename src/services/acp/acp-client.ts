import { readFile, writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
	ClientSideConnection,
	PROTOCOL_VERSION,
	ndJsonStream,
	type Client,
} from "@agentclientprotocol/sdk";
import type { OutputChannel } from "vscode";
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
}

const ALLOW_KINDS = new Set(["allow_once", "allow_always"]);
const REJECT_KINDS = new Set(["reject_once", "reject_always"]);

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
	private connection: ClientSideConnection | null = null;
	private process: ChildProcess | null = null;
	private readonly sessions = new Map<string, SessionEntry>();
	private startingPromise: Promise<void> | null = null;

	constructor(options: AcpClientOptions) {
		this.descriptor = options.descriptor;
		this.cwd = options.cwd;
		this.output = options.output;
		this.permissionDefault = options.permissionDefault ?? "ask";
		this.promptForPermission = options.promptForPermission;
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

		this.output.appendLine(
			`[ACP][${this.descriptor.id}] session=${sessionId} prompt=${prompt.length}chars`
		);

		const result = await this.connection.prompt({
			sessionId,
			prompt: [{ type: "text", text: prompt }],
		});
		this.output.appendLine(
			`[ACP][${this.descriptor.id}] turn finished (stopReason=${result.stopReason})`
		);
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

		await this.connection.initialize({
			protocolVersion: PROTOCOL_VERSION,
			clientCapabilities: {
				fs: { readTextFile: true, writeTextFile: true },
			},
		});
		this.output.appendLine(
			`[ACP][${this.descriptor.id}] initialised (protocolVersion=${PROTOCOL_VERSION})`
		);
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

		return {
			sessionUpdate(params) {
				const update = params.update;
				switch (update.sessionUpdate) {
					case "agent_message_chunk":
						if (update.content.type === "text") {
							output.append(update.content.text);
						}
						break;
					case "tool_call":
						output.appendLine(
							`\n[ACP][${providerId}] tool_call: ${update.title ?? ""} (${update.status ?? "pending"})`
						);
						break;
					case "tool_call_update":
						output.appendLine(
							`[ACP][${providerId}] tool_call_update: ${update.toolCallId} -> ${update.status ?? "unknown"}`
						);
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
