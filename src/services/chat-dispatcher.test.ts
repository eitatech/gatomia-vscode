import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, workspace } from "vscode";
import type { AcpSessionManager } from "./acp/acp-session-manager";
import { ChatDispatcher } from "./chat-dispatcher";
import type { ChatRouter } from "./chat-router";

const STARTS_WITH_SLASH_REGEX = /^\//;
const STARTS_WITH_SLASH_SPACE_REGEX = /^\/\s/;

const makeOutput = () => ({
	name: "test",
	append: vi.fn(),
	appendLine: vi.fn(),
	clear: vi.fn(),
	show: vi.fn(),
	hide: vi.fn(),
	dispose: vi.fn(),
	replace: vi.fn(),
});

const makeRouter = (overrides: Partial<ChatRouter> = {}): ChatRouter =>
	({
		resolve: vi.fn().mockResolvedValue({
			target: { kind: "copilot-chat" },
			reason: "default",
		}),
		invalidateCache: vi.fn(),
		...overrides,
	}) as unknown as ChatRouter;

const makeSessionManager = (): AcpSessionManager =>
	({
		send: vi.fn().mockResolvedValue(undefined),
		cancel: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	}) as unknown as AcpSessionManager;

describe("ChatDispatcher", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(workspace.getConfiguration).mockReturnValue({
			get: vi.fn((_key: string, fallback?: unknown) => fallback),
			update: vi.fn().mockResolvedValue(undefined),
		} as unknown as ReturnType<typeof workspace.getConfiguration>);
	});

	it("delivers prompt through Copilot Chat when router selects copilot-chat", async () => {
		const router = makeRouter();
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("hello world", {});

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.action.chat.open",
			{ query: "hello world" }
		);
		expect(sessions.send).not.toHaveBeenCalled();
	});

	it("routes prompt through ACP session manager when router selects ACP", async () => {
		const router = makeRouter({
			resolve: vi.fn().mockResolvedValue({
				target: { kind: "acp", providerId: "devin" },
				reason: "auto",
			}),
		} as Partial<ChatRouter>);
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("refine spec", { specId: "001" });

		expect(sessions.send).toHaveBeenCalledWith("devin", "refine spec", {
			mode: "workspace",
			specId: "001",
		});
		expect(commands.executeCommand).not.toHaveBeenCalled();
	});

	it("passes sessionMode from config to the session manager", async () => {
		vi.mocked(workspace.getConfiguration).mockReturnValue({
			get: vi.fn((key: string, fallback: unknown) =>
				key === "acp.sessionMode" ? "per-spec" : fallback
			),
			update: vi.fn(),
		} as unknown as ReturnType<typeof workspace.getConfiguration>);

		const router = makeRouter({
			resolve: vi.fn().mockResolvedValue({
				target: { kind: "acp", providerId: "gemini" },
				reason: "auto",
			}),
		} as Partial<ChatRouter>);
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("prompt", { specId: "002" });

		expect(sessions.send).toHaveBeenCalledWith("gemini", "prompt", {
			mode: "per-spec",
			specId: "002",
		});
	});

	it("falls back to Copilot Chat when ACP dispatch throws", async () => {
		const router = makeRouter({
			resolve: vi.fn().mockResolvedValue({
				target: { kind: "acp", providerId: "devin" },
				reason: "auto",
			}),
			invalidateCache: vi.fn(),
		} as Partial<ChatRouter>);
		const sessions = makeSessionManager();
		(sessions.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("spawn EACCES")
		);
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("hello", {});

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.action.chat.open",
			{ query: "hello" }
		);
		expect(router.invalidateCache).toHaveBeenCalled();
	});

	it("rewrites VS Code slash-command prompts into natural language before ACP dispatch", async () => {
		const router = makeRouter({
			resolve: vi.fn().mockResolvedValue({
				target: { kind: "acp", providerId: "devin" },
				reason: "auto",
			}),
		} as Partial<ChatRouter>);
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch(
			"/speckit.implement Task42\n\nTasks:\n- do a thing",
			{ specId: "004" }
		);

		const [, promptSent] = (sessions.send as ReturnType<typeof vi.fn>).mock
			.calls[0];
		expect(promptSent).not.toMatch(STARTS_WITH_SLASH_REGEX);
		expect(promptSent).toContain("speckit.implement");
		expect(promptSent).toContain("Task42");
		expect(promptSent).toContain("Tasks:");
		expect(promptSent).toContain("do a thing");
	});

	it("normalises stray whitespace after the slash (e.g. '/ speckit.foo')", async () => {
		const router = makeRouter({
			resolve: vi.fn().mockResolvedValue({
				target: { kind: "acp", providerId: "devin" },
				reason: "auto",
			}),
		} as Partial<ChatRouter>);
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("/ speckit.implement group A ", {});

		const [, promptSent] = (sessions.send as ReturnType<typeof vi.fn>).mock
			.calls[0];
		expect(promptSent).not.toMatch(STARTS_WITH_SLASH_SPACE_REGEX);
		expect(promptSent).toContain("speckit.implement");
		expect(promptSent).toContain("group A");
	});

	it("leaves non-slash prompts untouched for ACP dispatch", async () => {
		const router = makeRouter({
			resolve: vi.fn().mockResolvedValue({
				target: { kind: "acp", providerId: "devin" },
				reason: "auto",
			}),
		} as Partial<ChatRouter>);
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("please refine the spec", {});

		expect(sessions.send).toHaveBeenCalledWith(
			"devin",
			"please refine the spec",
			expect.anything()
		);
	});

	it("does NOT rewrite slash prompts when routed to Copilot Chat", async () => {
		const router = makeRouter();
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		await dispatcher.dispatch("/speckit.implement foo", {});

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.action.chat.open",
			{ query: "/speckit.implement foo" }
		);
	});

	it("passes files to Copilot Chat when provided and supported", async () => {
		const router = makeRouter();
		const sessions = makeSessionManager();
		const dispatcher = new ChatDispatcher({
			router,
			sessionManager: sessions,
			output: makeOutput(),
		});

		const files = [
			{
				fsPath: "/tmp/a.png",
				toString: () => "file:///tmp/a.png",
			},
		];

		await dispatcher.dispatch("analyze", {}, files as never);

		expect(commands.executeCommand).toHaveBeenCalledWith(
			"workbench.action.chat.open",
			expect.objectContaining({
				query: "analyze",
				files,
			})
		);
	});
});
