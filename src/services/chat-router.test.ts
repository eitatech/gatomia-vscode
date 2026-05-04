import { beforeEach, describe, expect, it, vi } from "vitest";
import { env, workspace } from "vscode";
import { AcpProviderRegistry } from "./acp/acp-provider-registry";
import type { AcpProviderDescriptor, AcpProviderProbe } from "./acp/types";
import { ChatRouter } from "./chat-router";
import type { OnboardingService } from "./onboarding-service";

const COPILOT_REASON_REGEX = /vscode|copilot/i;
const NOT_INSTALLED_REGEX = /not installed/i;
const AUTH_REASON_REGEX = /auth/i;
const NO_ACP_SUPPORT_REGEX = /does not support acp/i;
const OVERRIDE_REGEX = /override/i;
const UNKNOWN_PROVIDER_REGEX = /unknown provider/i;
const REMOTE_REGEX = /remote/i;

const probeResult = (
	overrides: Partial<AcpProviderProbe> = {}
): AcpProviderProbe => ({
	installed: true,
	version: "1.0.0",
	authenticated: true,
	acpSupported: true,
	executablePath: "/usr/local/bin/fake",
	...overrides,
});

const makeDescriptor = (
	id: string,
	overrides: Partial<AcpProviderDescriptor> = {}
): AcpProviderDescriptor => ({
	id,
	displayName: id.toUpperCase(),
	preferredHosts: [],
	spawnCommand: id,
	spawnArgs: ["acp"],
	installUrl: "",
	authCommand: `${id} login`,
	probe: vi.fn().mockResolvedValue(probeResult()),
	...overrides,
});

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

const makeOnboarding = (): OnboardingService =>
	({
		promptInstall: vi.fn().mockResolvedValue(undefined),
		promptAuth: vi.fn().mockResolvedValue(undefined),
		reset: vi.fn().mockResolvedValue(undefined),
	}) as unknown as OnboardingService;

type ConfigOverride = Record<string, unknown>;

const setConfig = (overrides: ConfigOverride) => {
	vi.mocked(workspace.getConfiguration).mockImplementation(
		() =>
			({
				get: (key: string, fallback: unknown) =>
					overrides[key] !== undefined ? overrides[key] : fallback,
				update: vi.fn(),
			}) as unknown as ReturnType<typeof workspace.getConfiguration>
	);
};

describe("ChatRouter", () => {
	let registry: AcpProviderRegistry;
	let onboarding: OnboardingService;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", { preferredHosts: ["windsurf"] })
		);
		registry.register(
			makeDescriptor("gemini", { preferredHosts: ["antigravity"] })
		);
		onboarding = makeOnboarding();
		setConfig({});
		Object.defineProperty(env, "appName", {
			value: "Visual Studio Code",
			configurable: true,
		});
		Object.defineProperty(env, "remoteName", {
			value: undefined,
			configurable: true,
		});
	});

	it("returns copilot-chat when host is VS Code (auto)", async () => {
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(COPILOT_REASON_REGEX);
	});

	it("returns devin ACP when host is Windsurf and Devin probe is ready", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target).toEqual({ kind: "acp", providerId: "devin" });
	});

	it("returns gemini ACP when host is Antigravity and Gemini probe is ready", async () => {
		Object.defineProperty(env, "appName", {
			value: "Antigravity",
			configurable: true,
		});
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target).toEqual({ kind: "acp", providerId: "gemini" });
	});

	it("falls back to copilot-chat and triggers install prompt when CLI is missing", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", {
				preferredHosts: ["windsurf"],
				probe: vi.fn().mockResolvedValue(
					probeResult({
						installed: false,
						version: null,
						authenticated: false,
						acpSupported: false,
						executablePath: null,
					})
				),
			})
		);
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(NOT_INSTALLED_REGEX);
		expect(onboarding.promptInstall).toHaveBeenCalled();
	});

	it("falls back to copilot-chat and triggers auth prompt when CLI exists but is unauthenticated", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", {
				preferredHosts: ["windsurf"],
				probe: vi.fn().mockResolvedValue(probeResult({ authenticated: false })),
			})
		);
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(AUTH_REASON_REGEX);
		expect(onboarding.promptAuth).toHaveBeenCalled();
	});

	it("falls back when acpSupported is false", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", {
				preferredHosts: ["windsurf"],
				probe: vi.fn().mockResolvedValue(probeResult({ acpSupported: false })),
			})
		);
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(NO_ACP_SUPPORT_REGEX);
	});

	it("honours config override gatomia.chat.provider=copilot-chat even on Windsurf", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		setConfig({ "chat.provider": "copilot-chat" });
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(OVERRIDE_REGEX);
	});

	it("honours config override gatomia.chat.provider=devin when probe is ready", async () => {
		Object.defineProperty(env, "appName", {
			value: "Visual Studio Code",
			configurable: true,
		});
		setConfig({ "chat.provider": "devin" });
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target).toEqual({ kind: "acp", providerId: "devin" });
	});

	it("falls back to copilot-chat when chosen provider is unknown", async () => {
		setConfig({ "chat.provider": "mystery" });
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(UNKNOWN_PROVIDER_REGEX);
	});

	it("disables ACP in remote workspaces even when host is Windsurf", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		Object.defineProperty(env, "remoteName", {
			value: "ssh-remote",
			configurable: true,
		});
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await router.resolve();

		expect(decision.target.kind).toBe("copilot-chat");
		expect(decision.reason).toMatch(REMOTE_REGEX);
	});

	it("does NOT block routing while onboarding.promptInstall is pending (H2)", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", {
				preferredHosts: ["windsurf"],
				probe: vi.fn().mockResolvedValue(
					probeResult({
						installed: false,
						version: null,
						authenticated: false,
						acpSupported: false,
						executablePath: null,
					})
				),
			})
		);
		// Simulate a user who never clicks a button — prompt hangs forever.
		onboarding = {
			...onboarding,
			promptInstall: vi.fn(
				() =>
					new Promise<void>(() => {
						/* never resolves */
					})
			),
		} as unknown as OnboardingService;
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await Promise.race([
			router.resolve(),
			new Promise<"timeout">((resolve) =>
				setTimeout(() => resolve("timeout"), 250)
			),
		]);

		expect(decision).not.toBe("timeout");
		expect((decision as { target: { kind: string } }).target.kind).toBe(
			"copilot-chat"
		);
		expect(onboarding.promptInstall).toHaveBeenCalled();
	});

	it("does NOT block routing while onboarding.promptAuth is pending (H2)", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", {
				preferredHosts: ["windsurf"],
				probe: vi.fn().mockResolvedValue(probeResult({ authenticated: false })),
			})
		);
		onboarding = {
			...onboarding,
			promptAuth: vi.fn(
				() =>
					new Promise<void>(() => {
						/* never resolves */
					})
			),
		} as unknown as OnboardingService;
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		const decision = await Promise.race([
			router.resolve(),
			new Promise<"timeout">((resolve) =>
				setTimeout(() => resolve("timeout"), 250)
			),
		]);

		expect(decision).not.toBe("timeout");
		expect(onboarding.promptAuth).toHaveBeenCalled();
	});

	it("caches decisions and invalidateCache forces a new probe", async () => {
		Object.defineProperty(env, "appName", {
			value: "Windsurf",
			configurable: true,
		});
		const probeFn = vi.fn().mockResolvedValue(probeResult());
		registry = new AcpProviderRegistry();
		registry.register(
			makeDescriptor("devin", {
				preferredHosts: ["windsurf"],
				probe: probeFn,
			})
		);
		const router = new ChatRouter({
			registry,
			onboarding,
			output: makeOutput(),
		});

		await router.resolve();
		await router.resolve();
		expect(probeFn).toHaveBeenCalledTimes(1);

		router.invalidateCache();
		await router.resolve();
		expect(probeFn).toHaveBeenCalledTimes(2);
	});
});
