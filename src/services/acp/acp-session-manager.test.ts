import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputChannel } from "vscode";
import { AcpProviderRegistry } from "./acp-provider-registry";
import { AcpSessionManager } from "./acp-session-manager";
import type { AcpProviderDescriptor } from "./types";

const ONCE_PREFIX_REGEX = /^once:/;
const ONCE_UUID_REGEX = /^once:[0-9a-f-]+$/i;
const UNKNOWN_REGEX = /unknown/i;

const {
	AcpClientCtor,
	sendPromptMock,
	disposeMock,
	cancelMock,
	cancelAllMock,
	getLastSessionKeyMock,
} = vi.hoisted(() => ({
	sendPromptMock: vi.fn(),
	disposeMock: vi.fn(),
	cancelMock: vi.fn(),
	cancelAllMock: vi.fn(),
	getLastSessionKeyMock: vi.fn<() => string | null>(() => null),
	AcpClientCtor: vi.fn(),
}));

vi.mock("./acp-client", () => {
	class AcpClient {
		constructor(options: unknown) {
			AcpClientCtor(options);
		}
		sendPrompt = sendPromptMock;
		cancel = cancelMock;
		cancelAll = cancelAllMock;
		dispose = disposeMock;
		getLastSessionKey = getLastSessionKeyMock;
	}
	return { AcpClient };
});

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

const descriptor = (id: string): AcpProviderDescriptor => ({
	id,
	displayName: id.toUpperCase(),
	preferredHosts: [],
	spawnCommand: id,
	spawnArgs: [],
	installUrl: "",
	authCommand: `${id} login`,
	probe: vi.fn(),
});

describe("AcpSessionManager", () => {
	let registry: AcpProviderRegistry;
	let manager: AcpSessionManager;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new AcpProviderRegistry();
		registry.register(descriptor("devin"));
		registry.register(descriptor("gemini"));
		manager = new AcpSessionManager({
			registry,
			output: makeOutputChannel(),
			cwd: "/tmp/ws",
		});
	});

	it("uses a single session key for mode=workspace", async () => {
		sendPromptMock.mockResolvedValue(undefined);

		await manager.send("devin", "hello", { mode: "workspace" });
		await manager.send("devin", "again", { mode: "workspace" });

		expect(AcpClientCtor).toHaveBeenCalledTimes(1);
		expect(sendPromptMock).toHaveBeenNthCalledWith(1, "_ws_", "hello");
		expect(sendPromptMock).toHaveBeenNthCalledWith(2, "_ws_", "again");
	});

	it("uses per-spec session keys when mode=per-spec and specId is provided", async () => {
		sendPromptMock.mockResolvedValue(undefined);

		await manager.send("devin", "create", {
			mode: "per-spec",
			specId: "001-feature",
		});
		await manager.send("devin", "refine", {
			mode: "per-spec",
			specId: "001-feature",
		});
		await manager.send("devin", "other", {
			mode: "per-spec",
			specId: "002-feature",
		});

		expect(sendPromptMock).toHaveBeenNthCalledWith(
			1,
			"spec:001-feature",
			"create"
		);
		expect(sendPromptMock).toHaveBeenNthCalledWith(
			2,
			"spec:001-feature",
			"refine"
		);
		expect(sendPromptMock).toHaveBeenNthCalledWith(
			3,
			"spec:002-feature",
			"other"
		);
	});

	it("falls back to workspace key when mode=per-spec but specId is missing", async () => {
		sendPromptMock.mockResolvedValue(undefined);

		await manager.send("devin", "hi", { mode: "per-spec" });

		expect(sendPromptMock).toHaveBeenCalledWith("_ws_", "hi");
	});

	it("creates a unique session key per call when mode=per-prompt", async () => {
		sendPromptMock.mockResolvedValue(undefined);

		await manager.send("devin", "p1", { mode: "per-prompt" });
		await manager.send("devin", "p2", { mode: "per-prompt" });

		const calls = sendPromptMock.mock.calls;
		expect(calls[0][0]).not.toBe(calls[1][0]);
		expect(calls[0][0]).toMatch(ONCE_PREFIX_REGEX);
	});

	it("reuses the same AcpClient instance per provider", async () => {
		sendPromptMock.mockResolvedValue(undefined);

		await manager.send("devin", "a", { mode: "workspace" });
		await manager.send("devin", "b", { mode: "workspace" });
		await manager.send("gemini", "c", { mode: "workspace" });

		expect(AcpClientCtor).toHaveBeenCalledTimes(2); // one per provider
		const descriptorsUsed = AcpClientCtor.mock.calls.map(
			(c) => (c[0] as { descriptor: AcpProviderDescriptor }).descriptor.id
		);
		expect(descriptorsUsed.sort()).toEqual(["devin", "gemini"]);
	});

	it("throws a friendly error when the provider is not registered", async () => {
		await expect(
			manager.send("unknown", "hi", { mode: "workspace" })
		).rejects.toThrow(UNKNOWN_REGEX);
	});

	it("dispose disposes every active AcpClient", async () => {
		sendPromptMock.mockResolvedValue(undefined);
		await manager.send("devin", "a", { mode: "workspace" });
		await manager.send("gemini", "b", { mode: "workspace" });

		manager.dispose();

		expect(disposeMock).toHaveBeenCalledTimes(2);
	});

	it("cancel delegates to the client for the given provider and session key", async () => {
		sendPromptMock.mockResolvedValue(undefined);
		await manager.send("devin", "hi", { mode: "workspace" });

		await manager.cancel("devin", { mode: "workspace" });

		expect(cancelMock).toHaveBeenCalledWith("_ws_");
	});

	it("cancel is a no-op when no client exists for the provider", async () => {
		await manager.cancel("devin", { mode: "workspace" });
		expect(cancelMock).not.toHaveBeenCalled();
	});

	it("generates unique once: keys using randomUUID semantics", async () => {
		sendPromptMock.mockResolvedValue(undefined);
		const seen = new Set<string>();
		for (let i = 0; i < 5; i++) {
			await manager.send("devin", `p${i}`, { mode: "per-prompt" });
			seen.add(sendPromptMock.mock.calls.at(-1)?.[0] ?? "");
		}
		expect(seen.size).toBe(5);
		// Sanity: keys look like UUIDs
		expect([...seen][0]).toMatch(ONCE_UUID_REGEX);
		// keep reference to randomUUID to avoid unused import
		expect(typeof randomUUID).toBe("function");
	});

	it("cancel in per-prompt mode falls back to the client's last session key (H3)", async () => {
		sendPromptMock.mockResolvedValue(undefined);
		getLastSessionKeyMock.mockReturnValue("once:last-uuid");
		await manager.send("devin", "p", { mode: "per-prompt" });

		await manager.cancel("devin", { mode: "per-prompt" });

		expect(cancelMock).toHaveBeenCalledWith("once:last-uuid");
	});

	it("cancel in per-prompt mode is a no-op when no prompt has been sent yet (H3)", async () => {
		sendPromptMock.mockResolvedValue(undefined);
		getLastSessionKeyMock.mockReturnValue(null);
		// Ensure the client exists for this provider without sending a prompt.
		await manager.send("devin", "seed", { mode: "workspace" });
		cancelMock.mockClear();
		getLastSessionKeyMock.mockReturnValue(null);

		await manager.cancel("devin", { mode: "per-prompt" });

		expect(cancelMock).not.toHaveBeenCalled();
	});

	it("cancelAll delegates to AcpClient.cancelAll (H3)", async () => {
		sendPromptMock.mockResolvedValue(undefined);
		cancelAllMock.mockResolvedValue(undefined);
		await manager.send("devin", "hi", { mode: "workspace" });

		await manager.cancelAll("devin");

		expect(cancelAllMock).toHaveBeenCalledTimes(1);
	});

	it("cancelAll is a no-op when no client exists for the provider (H3)", async () => {
		await manager.cancelAll("devin");
		expect(cancelAllMock).not.toHaveBeenCalled();
	});
});
