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
	setPermissionDefaultMock,
} = vi.hoisted(() => ({
	sendPromptMock: vi.fn(),
	disposeMock: vi.fn(),
	cancelMock: vi.fn(),
	cancelAllMock: vi.fn(),
	getLastSessionKeyMock: vi.fn<() => string | null>(() => null),
	setPermissionDefaultMock: vi.fn(),
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
		setPermissionDefault = setPermissionDefaultMock;
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

	// --------------------------------------------------------------------
	// T014 — Per-(providerId, cwd) client keying for worktree sessions.
	// --------------------------------------------------------------------

	describe("per-(providerId, cwd) client keying (T014, F1 remediation)", () => {
		it("returns distinct AcpClient instances for two different cwd values with the same providerId", async () => {
			sendPromptMock.mockResolvedValue(undefined);

			await manager.send("devin", "a", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-1",
			});
			await manager.send("devin", "b", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-2",
			});

			// One client per distinct (providerId, cwd) pair.
			expect(AcpClientCtor).toHaveBeenCalledTimes(2);
			const cwds = AcpClientCtor.mock.calls.map(
				(c) => (c[0] as { cwd: string }).cwd
			);
			expect(cwds.sort()).toEqual(["/tmp/ws/worktree-1", "/tmp/ws/worktree-2"]);
		});

		it("returns the cached instance for the same (providerId, cwd) pair", async () => {
			sendPromptMock.mockResolvedValue(undefined);

			await manager.send("devin", "a", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-1",
			});
			await manager.send("devin", "b", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-1",
			});

			expect(AcpClientCtor).toHaveBeenCalledTimes(1);
		});

		it("dispose tears down every cached client, including per-cwd instances", async () => {
			sendPromptMock.mockResolvedValue(undefined);
			await manager.send("devin", "a", {
				mode: "workspace",
				cwd: "/tmp/ws/a",
			});
			await manager.send("devin", "b", {
				mode: "workspace",
				cwd: "/tmp/ws/b",
			});
			await manager.send("gemini", "c", { mode: "workspace" });

			manager.dispose();

			// Three distinct clients: devin@/a, devin@/b, gemini@default.
			expect(disposeMock).toHaveBeenCalledTimes(3);
		});

		it("defaults cwd to the manager's constructor cwd when the call omits it (backward compatible)", async () => {
			sendPromptMock.mockResolvedValue(undefined);

			await manager.send("devin", "hello", { mode: "workspace" });

			const [args] = AcpClientCtor.mock.calls[0] as [{ cwd: string }];
			expect(args.cwd).toBe("/tmp/ws");
		});

		it("cancel honours the (providerId, cwd) pair so worktree sessions cancel independently", async () => {
			sendPromptMock.mockResolvedValue(undefined);
			await manager.send("devin", "a", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-1",
			});
			await manager.send("devin", "b", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-2",
			});
			cancelMock.mockClear();

			await manager.cancel("devin", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-1",
			});

			// Exactly one client was asked to cancel — the one bound to wt-1.
			expect(cancelMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("setPermissionDefault", () => {
		it("propagates the new mode to every cached client", async () => {
			sendPromptMock.mockResolvedValue(undefined);
			// Two distinct clients (different cwd) so we can verify fan-out.
			await manager.send("devin", "a", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-1",
			});
			await manager.send("devin", "b", {
				mode: "workspace",
				cwd: "/tmp/ws/worktree-2",
			});
			setPermissionDefaultMock.mockClear();

			manager.setPermissionDefault("allow");

			expect(setPermissionDefaultMock).toHaveBeenCalledTimes(2);
			expect(setPermissionDefaultMock).toHaveBeenNthCalledWith(1, "allow");
			expect(setPermissionDefaultMock).toHaveBeenNthCalledWith(2, "allow");
		});

		it("is a no-op when the new mode equals the current one", () => {
			manager.setPermissionDefault("ask");
			setPermissionDefaultMock.mockClear();

			// `permissionDefault` was undefined at construction; the first
			// call sets it to "ask" and propagates (no clients yet, so 0
			// calls). Repeating the same value is idempotent.
			manager.setPermissionDefault("ask");

			expect(setPermissionDefaultMock).not.toHaveBeenCalled();
		});

		it("propagates to a client created AFTER the manager-level mode changes", async () => {
			manager.setPermissionDefault("deny");
			AcpClientCtor.mockClear();
			sendPromptMock.mockResolvedValue(undefined);

			await manager.send("devin", "hello", { mode: "workspace" });

			// New clients pick up the current mode through the constructor
			// `permissionDefault` option, not via `setPermissionDefault`.
			const [args] = AcpClientCtor.mock.calls[0] as [
				{ permissionDefault?: string },
			];
			expect(args.permissionDefault).toBe("deny");
		});
	});
});
