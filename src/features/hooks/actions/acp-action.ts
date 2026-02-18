/**
 * ACPActionExecutor
 *
 * Executes an ACP-compatible local agent subprocess via raw JSON-RPC over stdio.
 * Protocol: initialize → session/new → session/prompt → collect session/update chunks.
 *
 * Errors are actionable per FR-026: format "[Context]: [What happened]. [What to do]."
 *
 * @see specs/001-hooks-refactor/contracts/acp-messages.ts
 * @feature 001-hooks-refactor Phase 6
 */

import { spawn } from "node:child_process";
import type { ACPActionParams } from "../types";
import {
	TemplateVariableParser,
	type TemplateContext,
} from "../template-variable-parser";

const _templateParser = new TemplateVariableParser();

// ============================================================================
// Top-level regex constants (required by useTopLevelRegex rule)
// ============================================================================

const NEWLINE_SPLIT_PATTERN = /\r?\n/;
const WHITESPACE_COMMAND_SPLIT_PATTERN = /\s+/;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30_000;
const LOG_PREFIX = "[ACPActionExecutor]";

// ============================================================================
// Types
// ============================================================================

export interface ACPExecutionResult {
	output: string;
	stopReason:
		| "end_turn"
		| "max_tokens"
		| "max_turn_requests"
		| "refusal"
		| "cancelled";
	durationMs: number;
}

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: number;
	method?: string;
	result?: unknown;
	error?: { code: number; message: string };
	params?: unknown;
}

// ============================================================================
// Error classes
// ============================================================================

/** Base class for ACP execution errors with machine-readable code. */
abstract class ACPBaseError extends Error {
	abstract readonly code: string;
	readonly pid?: number;

	constructor(message: string, pid?: number) {
		super(message);
		this.name = this.constructor.name;
		this.pid = pid;
	}
}

export class ACPSpawnFailedError extends ACPBaseError {
	readonly code = "SPAWN_FAILED" as const;
}

export class ACPTimeoutError extends ACPBaseError {
	readonly code: "HANDSHAKE_TIMEOUT" | "SESSION_TIMEOUT";

	constructor(
		message: string,
		code: "HANDSHAKE_TIMEOUT" | "SESSION_TIMEOUT",
		pid?: number
	) {
		super(message, pid);
		this.code = code;
	}
}

export class ACPProtocolError extends ACPBaseError {
	readonly code = "PROTOCOL_ERROR" as const;
}

export class ACPEmptyResponseError extends ACPBaseError {
	readonly code = "EMPTY_RESPONSE" as const;
}

// ============================================================================
// Helper functions (module-level to satisfy cognitive complexity limits)
// ============================================================================

/** Builds a human-readable timeout message for ACPTimeoutError. */
function buildTimeoutMessage(
	phase: "HANDSHAKE_TIMEOUT" | "SESSION_TIMEOUT",
	agentCommand: string,
	timeoutMs: number,
	pid: number | undefined
): string {
	const pidSuffix = pid ? ` (PID ${pid})` : "";
	if (phase === "HANDSHAKE_TIMEOUT") {
		return (
			`ACP agent timed out after ${timeoutMs}ms waiting for initialize response. ` +
			`Verify the agent '${agentCommand}' starts and responds to ACP initialize.${pidSuffix}`
		);
	}
	return (
		`ACP agent timed out after ${timeoutMs}ms waiting for session/prompt response. ` +
		`Check if the agent is unresponsive. Try increasing the hook timeout.${pidSuffix}`
	);
}

/** Dispatches a pending JSON-RPC response to its resolver. */
function dispatchPendingResponse(
	msg: JsonRpcResponse,
	pendingResolvers: Map<
		number,
		{
			resolve: (res: JsonRpcResponse) => void;
			reject: (err: Error) => void;
		}
	>
): void {
	if (msg.id === undefined) {
		return;
	}
	const pending = pendingResolvers.get(msg.id);
	if (!pending) {
		return;
	}
	pendingResolvers.delete(msg.id);
	if (msg.error) {
		pending.reject(
			new ACPProtocolError(
				`ACP handshake failed: agent returned error code ${msg.error.code} (${msg.error.message}). ` +
					"Confirm the agent supports ACP protocol version 0.14 or later."
			)
		);
	} else {
		pending.resolve(msg);
	}
}

function logTelemetry(
	event: string,
	properties: Record<string, string | number | boolean>
): void {
	console.log(`${LOG_PREFIX} Telemetry: ${event}`, properties);
}

// ============================================================================
// ACPActionExecutor
// ============================================================================

export interface ACPActionExecutorOptions {
	timeoutMs?: number;
}

/**
 * Executes a local ACP-compatible agent subprocess.
 *
 * Protocol flow:
 *   1. spawn(agentCommand)
 *   2. send initialize request (id=1)
 *   3. receive initialize response
 *   4. send session/new request (id=2)
 *   5. receive session/new response → get sessionId
 *   6. send session/prompt request (id=3)
 *   7. receive session/update notifications (collect agent_message_chunk content)
 *   8. receive session/prompt response → get stopReason → resolve
 */
export class ACPActionExecutor {
	private readonly timeoutMs: number;

	constructor(options?: ACPActionExecutorOptions) {
		this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	execute(
		params: ACPActionParams,
		templateContext: TemplateContext
	): Promise<ACPExecutionResult> {
		const startTime = Date.now();

		logTelemetry("acp-action.execute.start", {
			agentCommand: params.agentCommand,
			timeoutMs: this.timeoutMs,
		});

		// Expand template variables in taskInstruction
		const expandedInstruction = _templateParser.substitute(
			params.taskInstruction,
			templateContext
		);

		const [cmd, ...args] = params.agentCommand
			.trim()
			.split(WHITESPACE_COMMAND_SPLIT_PATTERN);

		return new Promise<ACPExecutionResult>((resolve, reject) => {
			const child = spawn(cmd, args, {
				stdio: "pipe",
				...(params.cwd ? { cwd: params.cwd } : {}),
			});

			let spawnError = false;
			let settled = false;
			let messageId = 0;
			let sessionId: string | undefined;
			const outputChunks: string[] = [];
			let lineBuffer = "";

			// Pending responses keyed by JSON-RPC id
			const pendingResolvers = new Map<
				number,
				{
					resolve: (res: JsonRpcResponse) => void;
					reject: (err: Error) => void;
				}
			>();

			// -----------------------------------------------------------------
			// Timeout
			// -----------------------------------------------------------------

			const timer = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				child.kill();
				const phase: "HANDSHAKE_TIMEOUT" | "SESSION_TIMEOUT" = sessionId
					? "SESSION_TIMEOUT"
					: "HANDSHAKE_TIMEOUT";
				const msg = buildTimeoutMessage(
					phase,
					params.agentCommand,
					this.timeoutMs,
					child.pid
				);
				logTelemetry("acp-action.execute.timeout", {
					phase,
					agentCommand: params.agentCommand,
					timeoutMs: this.timeoutMs,
				});
				reject(new ACPTimeoutError(msg, phase, child.pid));
			}, this.timeoutMs);

			// -----------------------------------------------------------------
			// Helpers
			// -----------------------------------------------------------------

			function sendRequest(
				method: string,
				params_: unknown
			): Promise<JsonRpcResponse> {
				messageId += 1;
				const id = messageId;
				const request: JsonRpcRequest = {
					jsonrpc: "2.0",
					id,
					method,
					params: params_,
				};
				return new Promise<JsonRpcResponse>((res, rej) => {
					pendingResolvers.set(id, { resolve: res, reject: rej });
					child.stdin.write(`${JSON.stringify(request)}\n`);
				});
			}

			function handleMessage(raw: string): void {
				let msg: JsonRpcResponse;
				try {
					msg = JSON.parse(raw) as JsonRpcResponse;
				} catch {
					// Ignore non-JSON lines (e.g., startup logs)
					return;
				}

				// Notification: session/update
				if (
					!msg.id &&
					msg.method === "session/update" &&
					typeof msg.params === "object" &&
					msg.params !== null
				) {
					const p = msg.params as { type?: string; content?: string };
					if (
						p.type === "agent_message_chunk" &&
						typeof p.content === "string"
					) {
						outputChunks.push(p.content);
					}
					return;
				}

				// Response to a pending request — delegate to module-level helper
				dispatchPendingResponse(msg, pendingResolvers);
			}

			// -----------------------------------------------------------------
			// stdout: line-buffered JSON parsing
			// -----------------------------------------------------------------

			child.stdout.on("data", (chunk: Buffer) => {
				lineBuffer += chunk.toString("utf8");
				const lines = lineBuffer.split(NEWLINE_SPLIT_PATTERN);
				// Last element may be incomplete — keep it in the buffer
				lineBuffer = lines.pop() ?? "";
				for (const line of lines) {
					const trimmed = line.trim();
					if (trimmed) {
						handleMessage(trimmed);
					}
				}
			});

			child.stderr.on("data", (_chunk: Buffer) => {
				// Intentionally ignore stderr — agent debug output
			});

			// -----------------------------------------------------------------
			// Spawn error
			// -----------------------------------------------------------------

			child.on("error", (err: NodeJS.ErrnoException) => {
				if (settled) {
					return;
				}
				spawnError = true;
				settled = true;
				clearTimeout(timer);
				logTelemetry("acp-action.execute.spawn-failed", {
					agentCommand: params.agentCommand,
					errorCode: err.code ?? "unknown",
				});
				reject(
					new ACPSpawnFailedError(
						`ACP agent spawn failed: command '${params.agentCommand}' not found or not on PATH. ` +
							"Verify the agentCommand is installed and accessible. " +
							`Original error: ${err.message}`,
						child.pid
					)
				);
			});

			child.on("exit", () => {
				if (settled || spawnError) {
					return;
				}
				// Process any remaining buffer content
				const remaining = lineBuffer.trim();
				if (remaining) {
					handleMessage(remaining);
				}
			});

			// -----------------------------------------------------------------
			// Protocol execution
			// -----------------------------------------------------------------

			async function runProtocol(): Promise<void> {
				// Step 1: initialize
				const initResponse = await sendRequest("initialize", {
					protocolVersion: "0.14",
					clientInfo: { name: "gatomia-vscode", version: "1.0.0" },
				});

				if (!initResponse.result) {
					throw new ACPProtocolError(
						"ACP initialize response missing result. " +
							"Confirm the agent supports ACP protocol version 0.14 or later."
					);
				}

				logTelemetry("acp-action.handshake.complete", {
					agentCommand: params.agentCommand,
					pid: child.pid ?? -1,
				});

				// Step 2: session/new
				const sessionResponse = await sendRequest("session/new", {});
				const sessionResult = sessionResponse.result as
					| { sessionId?: string }
					| undefined;
				sessionId =
					typeof sessionResult?.sessionId === "string"
						? sessionResult.sessionId
						: "default";

				// Step 3: session/prompt
				const promptResponse = await sendRequest("session/prompt", {
					sessionId,
					messages: [{ role: "user", content: expandedInstruction }],
				});

				const promptResult = promptResponse.result as
					| { stopReason?: string }
					| undefined;
				const stopReason = (promptResult?.stopReason ??
					"end_turn") as ACPExecutionResult["stopReason"];

				logTelemetry("acp-action.session-prompt.received", {
					agentCommand: params.agentCommand,
					stopReason,
					durationMs: Date.now() - startTime,
				});

				// Validate output
				if (outputChunks.length === 0) {
					throw new ACPEmptyResponseError(
						"ACP agent responded but produced no output. " +
							`Verify the agent '${params.agentCommand}' sends session/update notifications with type 'agent_message_chunk'. ` +
							"Check the agent logs for errors."
					);
				}

				const output = outputChunks.join("");
				const durationMs = Date.now() - startTime;

				clearTimeout(timer);
				settled = true;

				logTelemetry("acp-action.execute.success", {
					agentCommand: params.agentCommand,
					stopReason,
					outputLength: output.length,
					durationMs,
				});

				resolve({ output, stopReason, durationMs });
			}

			runProtocol().catch((err: unknown) => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(timer);
				logTelemetry("acp-action.execute.failure", {
					agentCommand: params.agentCommand,
					errorName: err instanceof Error ? err.constructor.name : "unknown",
				});
				reject(err instanceof Error ? err : new Error(String(err)));
			});
		});
	}
}
