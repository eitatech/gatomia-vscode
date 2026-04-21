import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough, type Readable, type Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputChannel } from "vscode";
import { AcpClient } from "./acp-client";
import type { AcpProviderDescriptor } from "./types";

const AUTH_REQUIRED_REGEX = /auth_required/;

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
