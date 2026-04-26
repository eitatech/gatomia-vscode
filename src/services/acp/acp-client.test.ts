import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough, type Readable, type Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputChannel } from "vscode";
import { AcpClient } from "./acp-client";
import type { AcpProviderDescriptor } from "./types";

const AUTH_REQUIRED_REGEX = /auth_required/;
const TIMED_OUT_REGEX = /timed out/i;
const CHILD_EXITED_REGEX = /child process exited/;
const NEVER_RESOLVES = <T>(): Promise<T> =>
	new Promise<T>(() => {
		/* intentionally never settles — used to simulate a hung RPC */
	});

vi.mock("node:child_process", () => {
	const spawnMock = vi.fn();
	const execMock = vi.fn();
	return {
		spawn: spawnMock,
		exec: execMock,
		default: { spawn: spawnMock, exec: execMock },
	};
});

vi.mock("../../utils/cli-detector", () => ({
	getExtendedPath: vi.fn(() => process.env.PATH ?? ""),
	checkCLI: vi.fn(),
	locateCLIExecutable: vi.fn(),
}));

const { initializeMock, newSessionMock, promptMock, cancelMock, handlerRef } =
	vi.hoisted(() => ({
		initializeMock: vi.fn(),
		newSessionMock: vi.fn(),
		promptMock: vi.fn(),
		cancelMock: vi.fn(),
		handlerRef: { current: null as unknown },
	}));

vi.mock("@agentclientprotocol/sdk", () => {
	class FakeClientSideConnection {
		initialize = initializeMock;
		newSession = newSessionMock;
		prompt = promptMock;
		cancel = cancelMock;
		constructor(factory: () => unknown) {
			handlerRef.current = factory();
		}
	}
	return {
		PROTOCOL_VERSION: 1,
		ndJsonStream: vi.fn(() => ({
			readable: {},
			writable: {},
		})),
		ClientSideConnection: FakeClientSideConnection,
	};
});

const { readFileMock, writeFileMock } = vi.hoisted(() => ({
	readFileMock: vi.fn(),
	writeFileMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	readFile: readFileMock,
	writeFile: writeFileMock,
	default: { readFile: readFileMock, writeFile: writeFileMock },
}));

const mockedSpawn = vi.mocked(spawn);

class FakeChildProcess extends EventEmitter {
	pid = 4242;
	stdin: Writable = new PassThrough();
	stdout: Readable = new PassThrough();
	stderr: Readable = new PassThrough();
	killed = false;
	kill = vi.fn(() => {
		this.killed = true;
		this.emit("exit", 0, null);
		return true;
	});
}

const makeOutputChannel = (): OutputChannel =>
	({
		name: "test",
		append: vi.fn(),
		appendLine: vi.fn(),
		clear: vi.fn(),
		show: vi.fn(),
		hide: vi.fn(),
		dispose: vi.fn(),
		replace: vi.fn(),
	}) as unknown as OutputChannel;

const descriptor: AcpProviderDescriptor = {
	id: "devin",
	displayName: "Devin CLI",
	preferredHosts: ["windsurf"],
	spawnCommand: "devin",
	spawnArgs: ["acp"],
	installUrl: "",
	authCommand: "devin auth login",
	probe: vi.fn(),
};

describe("AcpClient", () => {
	let fakeProcess: FakeChildProcess;

	beforeEach(() => {
		vi.clearAllMocks();
		fakeProcess = new FakeChildProcess();
		mockedSpawn.mockReturnValue(fakeProcess as unknown as ChildProcess);
		initializeMock.mockResolvedValue({ protocolVersion: 1 });
		newSessionMock.mockResolvedValue({ sessionId: "session-1" });
		promptMock.mockResolvedValue({ stopReason: "end_turn" });
	});

	it("spawns the provider command with ACP args and extended PATH", async () => {
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await client.ensureStarted();

		expect(mockedSpawn).toHaveBeenCalledWith(
			"devin",
			["acp"],
			expect.objectContaining({
				cwd: "/tmp/workspace",
				stdio: ["pipe", "pipe", "pipe"],
				env: expect.objectContaining({ PATH: expect.any(String) }),
			})
		);
		expect(initializeMock).toHaveBeenCalledWith(
			expect.objectContaining({ protocolVersion: 1 })
		);
	});

	it("reuses an existing session key across prompts", async () => {
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await client.sendPrompt("_ws_", "hello");
		await client.sendPrompt("_ws_", "again");

		expect(mockedSpawn).toHaveBeenCalledTimes(1);
		expect(newSessionMock).toHaveBeenCalledTimes(1);
		expect(promptMock).toHaveBeenCalledTimes(2);
		expect(promptMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				sessionId: "session-1",
				prompt: [{ type: "text", text: "again" }],
			})
		);
	});

	it("creates a fresh session for a new session key", async () => {
		newSessionMock.mockResolvedValueOnce({ sessionId: "session-A" });
		newSessionMock.mockResolvedValueOnce({ sessionId: "session-B" });
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await client.sendPrompt("spec:001", "first");
		await client.sendPrompt("spec:002", "second");

		expect(newSessionMock).toHaveBeenCalledTimes(2);
		expect(promptMock).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ sessionId: "session-A" })
		);
		expect(promptMock).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ sessionId: "session-B" })
		);
	});

	it("logs stderr output to the output channel", async () => {
		const output = makeOutputChannel();
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output,
		});
		await client.ensureStarted();

		fakeProcess.stderr.emit("data", Buffer.from("oops\n"));

		expect(output.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("oops")
		);
	});

	it("dispose kills the underlying process", async () => {
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});
		await client.ensureStarted();

		client.dispose();

		expect(fakeProcess.kill).toHaveBeenCalled();
	});

	it("rejects with a timeout when initialize never resolves (H1)", async () => {
		// Make initialize hang forever.
		initializeMock.mockImplementationOnce(() => NEVER_RESOLVES());
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
			initializeTimeoutMs: 20,
		});

		await expect(client.ensureStarted()).rejects.toThrow(TIMED_OUT_REGEX);
		// The stuck process must be killed so the next retry starts clean.
		expect(fakeProcess.kill).toHaveBeenCalled();
	});

	it("rejects pending waiters when the child process exits unexpectedly (H1)", async () => {
		initializeMock.mockImplementationOnce(() => NEVER_RESOLVES());
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
			initializeTimeoutMs: 10_000,
		});

		const pending = client.ensureStarted();
		// Simulate the child process crashing while initialize is pending.
		setImmediate(() => fakeProcess.emit("exit", 137, "SIGKILL"));

		await expect(pending).rejects.toThrow(CHILD_EXITED_REGEX);
	});

	it("removes a per-prompt (once:) session entry after the turn completes (H4)", async () => {
		newSessionMock.mockResolvedValueOnce({ sessionId: "session-once" });
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await client.sendPrompt("once:abc-123", "one-shot");

		expect(client.getSessionKeys()).not.toContain("once:abc-123");
	});

	it("keeps workspace / per-spec session entries across prompts (H4)", async () => {
		newSessionMock.mockResolvedValueOnce({ sessionId: "session-ws" });
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await client.sendPrompt("_ws_", "first");
		await client.sendPrompt("_ws_", "second");

		expect(client.getSessionKeys()).toContain("_ws_");
		// newSession must only have been called once — the second prompt reuses it.
		expect(newSessionMock).toHaveBeenCalledTimes(1);
	});

	it("cancelAll cancels every tracked session regardless of mode (H3)", async () => {
		newSessionMock
			.mockResolvedValueOnce({ sessionId: "session-ws" })
			.mockResolvedValueOnce({ sessionId: "session-spec" });
		cancelMock.mockResolvedValue(undefined);
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await client.sendPrompt("_ws_", "a");
		await client.sendPrompt("spec:001", "b");
		await client.cancelAll();

		expect(cancelMock).toHaveBeenCalledTimes(2);
		expect(cancelMock).toHaveBeenCalledWith({ sessionId: "session-ws" });
		expect(cancelMock).toHaveBeenCalledWith({ sessionId: "session-spec" });
	});

	it("throws a descriptive error when the session cannot be established", async () => {
		newSessionMock.mockRejectedValueOnce(new Error("auth_required"));
		const client = new AcpClient({
			descriptor,
			cwd: "/tmp/workspace",
			output: makeOutputChannel(),
		});

		await expect(client.sendPrompt("_ws_", "hi")).rejects.toThrow(
			AUTH_REQUIRED_REGEX
		);
	});

	describe("requestPermission handler", () => {
		const options = [
			{ optionId: "opt-allow", name: "Allow", kind: "allow_once" as const },
			{
				optionId: "opt-always",
				name: "Allow always",
				kind: "allow_always" as const,
			},
			{ optionId: "opt-reject", name: "Reject", kind: "reject_once" as const },
		];

		const invokeRequestPermission = (): Promise<unknown> =>
			(
				handlerRef.current as {
					requestPermission: (p: unknown) => Promise<unknown>;
				}
			).requestPermission({
				options,
				sessionId: "session-1",
				toolCall: { toolCallId: "tc-1", title: "Execute ls" },
			});

		it("auto-selects an allow option when permissionDefault=allow", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
				permissionDefault: "allow",
			});
			await client.ensureStarted();

			const response = await invokeRequestPermission();

			expect(response).toEqual({
				outcome: { outcome: "selected", optionId: "opt-allow" },
			});
		});

		it("auto-selects a reject option when permissionDefault=deny", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
				permissionDefault: "deny",
			});
			await client.ensureStarted();

			const response = await invokeRequestPermission();

			expect(response).toEqual({
				outcome: { outcome: "selected", optionId: "opt-reject" },
			});
		});

		it("delegates to promptForPermission when permissionDefault=ask", async () => {
			const prompter = vi.fn().mockResolvedValue("opt-always");
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
				permissionDefault: "ask",
				promptForPermission: prompter,
			});
			await client.ensureStarted();

			const response = await invokeRequestPermission();

			expect(prompter).toHaveBeenCalledWith(
				expect.objectContaining({ sessionId: "session-1" })
			);
			expect(response).toEqual({
				outcome: { outcome: "selected", optionId: "opt-always" },
			});
		});

		it("returns cancelled when user cancels via promptForPermission", async () => {
			const prompter = vi.fn().mockResolvedValue(null);
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
				permissionDefault: "ask",
				promptForPermission: prompter,
			});
			await client.ensureStarted();

			const response = await invokeRequestPermission();

			expect(response).toEqual({ outcome: { outcome: "cancelled" } });
		});

		it("defaults to ask but falls back to cancelled when no prompter is wired", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();

			const response = await invokeRequestPermission();

			expect(response).toEqual({ outcome: { outcome: "cancelled" } });
		});

		describe("remembered always-decisions (per AcpClient memo)", () => {
			const invokeWithKind = (toolKind: string): Promise<unknown> =>
				(
					handlerRef.current as {
						requestPermission: (p: unknown) => Promise<unknown>;
					}
				).requestPermission({
					options,
					sessionId: "session-1",
					toolCall: {
						toolCallId: `tc-${Math.random()}`,
						title: `Execute something (${toolKind})`,
						kind: toolKind,
					},
				});

			it("auto-applies allow_always for subsequent calls of the same kind without prompting again", async () => {
				const prompter = vi.fn().mockResolvedValue("opt-always");
				const client = new AcpClient({
					descriptor,
					cwd: "/tmp/workspace",
					output: makeOutputChannel(),
					permissionDefault: "ask",
					promptForPermission: prompter,
				});
				await client.ensureStarted();

				const first = await invokeWithKind("execute");
				const second = await invokeWithKind("execute");
				const third = await invokeWithKind("execute");

				// User was prompted exactly once. The next two calls were
				// auto-resolved from the memo.
				expect(prompter).toHaveBeenCalledTimes(1);
				expect(first).toEqual({
					outcome: { outcome: "selected", optionId: "opt-always" },
				});
				expect(second).toEqual({
					outcome: { outcome: "selected", optionId: "opt-always" },
				});
				expect(third).toEqual({
					outcome: { outcome: "selected", optionId: "opt-always" },
				});
			});

			it("does NOT cache an allow_once decision — every call still prompts", async () => {
				const prompter = vi.fn().mockResolvedValue("opt-allow"); // allow_once
				const client = new AcpClient({
					descriptor,
					cwd: "/tmp/workspace",
					output: makeOutputChannel(),
					permissionDefault: "ask",
					promptForPermission: prompter,
				});
				await client.ensureStarted();

				await invokeWithKind("execute");
				await invokeWithKind("execute");

				expect(prompter).toHaveBeenCalledTimes(2);
			});

			it("isolates the cache per tool kind", async () => {
				const prompter = vi.fn().mockResolvedValue("opt-always");
				const client = new AcpClient({
					descriptor,
					cwd: "/tmp/workspace",
					output: makeOutputChannel(),
					permissionDefault: "ask",
					promptForPermission: prompter,
				});
				await client.ensureStarted();

				await invokeWithKind("execute");
				await invokeWithKind("read");

				// Different kinds → both required prompting.
				expect(prompter).toHaveBeenCalledTimes(2);

				prompter.mockClear();
				await invokeWithKind("execute");
				await invokeWithKind("read");
				// Both kinds are now memoised — no more prompts.
				expect(prompter).not.toHaveBeenCalled();
			});

			it("does not cache when toolCall.kind is missing", async () => {
				const prompter = vi.fn().mockResolvedValue("opt-always");
				const client = new AcpClient({
					descriptor,
					cwd: "/tmp/workspace",
					output: makeOutputChannel(),
					permissionDefault: "ask",
					promptForPermission: prompter,
				});
				await client.ensureStarted();

				const handler = handlerRef.current as {
					requestPermission: (p: unknown) => Promise<unknown>;
				};
				await handler.requestPermission({
					options,
					sessionId: "session-1",
					toolCall: { toolCallId: "tc-1", title: "Untyped" },
				});
				await handler.requestPermission({
					options,
					sessionId: "session-1",
					toolCall: { toolCallId: "tc-2", title: "Untyped" },
				});

				expect(prompter).toHaveBeenCalledTimes(2);
			});

			it("caches reject_always symmetrically", async () => {
				const rejectAlwaysOptions = [
					{
						optionId: "opt-reject-always",
						name: "Reject always",
						kind: "reject_always" as const,
					},
					{
						optionId: "opt-allow",
						name: "Allow",
						kind: "allow_once" as const,
					},
				];
				const prompter = vi.fn().mockResolvedValue("opt-reject-always");
				const client = new AcpClient({
					descriptor,
					cwd: "/tmp/workspace",
					output: makeOutputChannel(),
					permissionDefault: "ask",
					promptForPermission: prompter,
				});
				await client.ensureStarted();

				const handler = handlerRef.current as {
					requestPermission: (p: unknown) => Promise<unknown>;
				};
				const first = await handler.requestPermission({
					options: rejectAlwaysOptions,
					sessionId: "session-1",
					toolCall: { toolCallId: "tc-1", title: "Delete x", kind: "delete" },
				});
				const second = await handler.requestPermission({
					options: rejectAlwaysOptions,
					sessionId: "session-1",
					toolCall: { toolCallId: "tc-2", title: "Delete y", kind: "delete" },
				});

				expect(prompter).toHaveBeenCalledTimes(1);
				expect(first).toEqual({
					outcome: { outcome: "selected", optionId: "opt-reject-always" },
				});
				expect(second).toEqual({
					outcome: { outcome: "selected", optionId: "opt-reject-always" },
				});
			});
		});
	});

	describe("per-session event bus (T012)", () => {
		const invokeSessionUpdate = (params: unknown): Promise<unknown> =>
			(
				handlerRef.current as {
					sessionUpdate: (p: unknown) => Promise<unknown>;
				}
			).sessionUpdate(params);

		it("subscribeSession fans out agent_message_chunk events to the listener AND still writes to the OutputChannel (FR-022)", async () => {
			const output = makeOutputChannel();
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output,
			});
			await client.ensureStarted();
			const listener = vi.fn();
			client.subscribeSession("session-1", listener);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "hello world" },
				},
			});

			// OutputChannel still receives the content (FR-022 regression).
			expect(output.append).toHaveBeenCalledWith("hello world");

			// Event bus listener receives the structured event.
			expect(listener).toHaveBeenCalledTimes(1);
			const event = listener.mock.calls[0][0] as {
				kind: string;
				text: string;
				at: number;
			};
			expect(event.kind).toBe("agent-message-chunk");
			expect(event.text).toBe("hello world");
			expect(typeof event.at).toBe("number");
		});

		it("fans out tool_call and tool_call_update events with structured payloads", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const listener = vi.fn();
			client.subscribeSession("session-1", listener);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "tool_call",
					toolCallId: "tc-1",
					title: "Run tests",
					status: "pending",
				},
			});
			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "tool_call_update",
					toolCallId: "tc-1",
					status: "succeeded",
				},
			});

			expect(listener).toHaveBeenCalledTimes(2);
			const [first, second] = listener.mock.calls.map(
				(c) => c[0] as { kind: string }
			);
			expect(first.kind).toBe("tool-call");
			expect(second.kind).toBe("tool-call-update");
		});

		it("projects ACP `Diff` content into affectedFiles with computed +N/-M stats", async () => {
			// Phase 3 plumbing: when the agent emits a `tool_call` with
			// a `diff` content entry the host must surface the file path,
			// language hint, and lines added / removed so the webview
			// can render the Cursor-style card.
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const listener = vi.fn();
			client.subscribeSession("session-1", listener);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "tool_call",
					toolCallId: "tc-edit",
					title: "Update sidebar",
					status: "pending",
					kind: "edit",
					content: [
						{
							type: "diff",
							path: "/repo/src/sidebar.ts",
							oldText: "alpha\nbeta\n",
							newText: "alpha\nbeta\ngamma\n",
						},
					],
				},
			});

			expect(listener).toHaveBeenCalledTimes(1);
			const event = listener.mock.calls[0][0] as {
				kind: string;
				toolKind?: string;
				affectedFiles?: Array<{
					path: string;
					linesAdded: number;
					linesRemoved: number;
					languageId?: string;
				}>;
			};
			expect(event.kind).toBe("tool-call");
			expect(event.toolKind).toBe("edit");
			expect(event.affectedFiles).toHaveLength(1);
			const [file] = event.affectedFiles ?? [];
			expect(file).toMatchObject({
				path: "/repo/src/sidebar.ts",
				linesAdded: 1,
				linesRemoved: 0,
				languageId: "typescript",
			});
		});

		it("falls back to ToolCall.locations when no diff content is present", async () => {
			// Some agents only ship `locations` (a "follow-along" hint
			// that points the IDE at a file) without a full diff body.
			// We still want to surface the file in the card so the user
			// can scan what is being read, even if `+0 -0`.
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const listener = vi.fn();
			client.subscribeSession("session-1", listener);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "tool_call",
					toolCallId: "tc-read",
					title: "Inspect README",
					status: "pending",
					kind: "read",
					locations: [{ path: "README.md", line: 1 }],
				},
			});

			const event = listener.mock.calls[0][0] as {
				affectedFiles?: Array<{
					path: string;
					linesAdded: number;
					linesRemoved: number;
				}>;
			};
			expect(event.affectedFiles).toEqual([
				{
					path: "README.md",
					linesAdded: 0,
					linesRemoved: 0,
					languageId: "markdown",
				},
			]);
		});

		it("omits affectedFiles when the tool call has no diff and no locations", async () => {
			// Pure execute calls (e.g. `bash`) ship neither diff nor
			// locations — the event must omit `affectedFiles` entirely
			// so the UI falls back to the legacy compact title row.
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const listener = vi.fn();
			client.subscribeSession("session-1", listener);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "tool_call",
					toolCallId: "tc-exec",
					title: "Run shell",
					status: "pending",
					kind: "execute",
				},
			});

			const event = listener.mock.calls[0][0] as {
				affectedFiles?: unknown;
				toolKind?: string;
			};
			expect(event.affectedFiles).toBeUndefined();
			expect(event.toolKind).toBe("execute");
		});

		it("only notifies subscribers for the matching sessionId", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const listenerA = vi.fn();
			const listenerB = vi.fn();
			client.subscribeSession("session-A", listenerA);
			client.subscribeSession("session-B", listenerB);

			await invokeSessionUpdate({
				sessionId: "session-A",
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "for A" },
				},
			});

			expect(listenerA).toHaveBeenCalledTimes(1);
			expect(listenerB).not.toHaveBeenCalled();
		});

		it("supports multiple subscribers per sessionId", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const first = vi.fn();
			const second = vi.fn();
			client.subscribeSession("session-1", first);
			client.subscribeSession("session-1", second);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "x" },
				},
			});

			expect(first).toHaveBeenCalledTimes(1);
			expect(second).toHaveBeenCalledTimes(1);
		});

		it("returns a Disposable that stops further event delivery", async () => {
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const listener = vi.fn();
			const subscription = client.subscribeSession("session-1", listener);

			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "one" },
				},
			});
			subscription.dispose();
			await invokeSessionUpdate({
				sessionId: "session-1",
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: "two" },
				},
			});

			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("filesystem handlers", () => {
		it("readTextFile returns full file content via fs/promises", async () => {
			readFileMock.mockResolvedValueOnce("line1\nline2\nline3\n");
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const handler = handlerRef.current as {
				readTextFile: (p: unknown) => Promise<{ content: string }>;
			};

			const response = await handler.readTextFile({
				path: "/tmp/workspace/a.txt",
				sessionId: "session-1",
			});

			expect(readFileMock).toHaveBeenCalledWith("/tmp/workspace/a.txt", "utf8");
			expect(response.content).toBe("line1\nline2\nline3\n");
		});

		it("readTextFile respects line and limit when slicing", async () => {
			readFileMock.mockResolvedValueOnce("a\nb\nc\nd\ne\n");
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const handler = handlerRef.current as {
				readTextFile: (p: unknown) => Promise<{ content: string }>;
			};

			const response = await handler.readTextFile({
				path: "/tmp/workspace/a.txt",
				sessionId: "session-1",
				line: 2,
				limit: 2,
			});

			expect(response.content).toBe("b\nc");
		});

		it("writeTextFile persists content through fs/promises", async () => {
			writeFileMock.mockResolvedValueOnce(undefined);
			const client = new AcpClient({
				descriptor,
				cwd: "/tmp/workspace",
				output: makeOutputChannel(),
			});
			await client.ensureStarted();
			const handler = handlerRef.current as {
				writeTextFile: (p: unknown) => Promise<unknown>;
			};

			await handler.writeTextFile({
				path: "/tmp/workspace/new.txt",
				content: "hello",
				sessionId: "session-1",
			});

			expect(writeFileMock).toHaveBeenCalledWith(
				"/tmp/workspace/new.txt",
				"hello",
				"utf8"
			);
		});
	});
});
