import { beforeEach, describe, expect, it, vi } from "vitest";
import { env, window } from "vscode";
import { OnboardingService } from "./onboarding-service";
import type { AcpProviderDescriptor } from "./acp/types";

const makeGlobalState = () => {
	const store = new Map<string, unknown>();
	return {
		get: vi.fn(<T>(key: string, fallback?: T) =>
			store.has(key) ? (store.get(key) as T) : fallback
		),
		update: vi.fn((key: string, value: unknown) => {
			store.set(key, value);
			return Promise.resolve();
		}),
	};
};

const descriptor: AcpProviderDescriptor = {
	id: "devin",
	displayName: "Devin CLI",
	preferredHosts: ["windsurf"],
	spawnCommand: "devin",
	spawnArgs: ["acp"],
	installUrl: "https://cli.devin.ai/docs/installation",
	authCommand: "devin auth login",
	probe: vi.fn(),
};

describe("OnboardingService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("promptInstall", () => {
		it("shows a notification once and opens the install URL when accepted", async () => {
			const state = makeGlobalState();
			const service = new OnboardingService(state);
			vi.mocked(window.showInformationMessage).mockResolvedValueOnce(
				"Install" as unknown as undefined
			);

			await service.promptInstall(descriptor);

			expect(window.showInformationMessage).toHaveBeenCalledWith(
				expect.stringContaining("Devin CLI"),
				"Install",
				"Use Copilot Chat",
				"Don't ask again"
			);
			expect(env.openExternal).toHaveBeenCalled();
		});

		it("does not prompt again within the same session after dismissal", async () => {
			const state = makeGlobalState();
			const service = new OnboardingService(state);
			vi.mocked(window.showInformationMessage).mockResolvedValueOnce(
				"Use Copilot Chat" as unknown as undefined
			);

			await service.promptInstall(descriptor);
			await service.promptInstall(descriptor);

			expect(window.showInformationMessage).toHaveBeenCalledTimes(1);
		});

		it("persists 'dont ask again' to globalState", async () => {
			const state = makeGlobalState();
			const service = new OnboardingService(state);
			vi.mocked(window.showInformationMessage).mockResolvedValueOnce(
				"Don't ask again" as unknown as undefined
			);

			await service.promptInstall(descriptor);

			expect(state.update).toHaveBeenCalledWith(
				"gatomia.onboarding.acp.devin.dismissed",
				true
			);
		});

		it("respects persisted dismissal from a previous run", async () => {
			const state = makeGlobalState();
			await state.update("gatomia.onboarding.acp.devin.dismissed", true);
			const service = new OnboardingService(state);

			await service.promptInstall(descriptor);

			expect(window.showInformationMessage).not.toHaveBeenCalled();
		});
	});

	describe("promptAuth", () => {
		it("offers an Authenticate option that opens a terminal running the auth command", async () => {
			const state = makeGlobalState();
			const service = new OnboardingService(state);
			const sendText = vi.fn();
			const show = vi.fn();
			vi.mocked(window.createTerminal).mockReturnValue({
				sendText,
				show,
				dispose: vi.fn(),
				name: "ACP Auth",
				processId: Promise.resolve(undefined),
				creationOptions: {},
				exitStatus: undefined,
				state: { isInteractedWith: false },
				shellIntegration: undefined,
			} as unknown as ReturnType<typeof window.createTerminal>);
			vi.mocked(window.showInformationMessage).mockResolvedValueOnce(
				"Authenticate" as unknown as undefined
			);

			await service.promptAuth(descriptor);

			expect(window.createTerminal).toHaveBeenCalled();
			expect(sendText).toHaveBeenCalledWith("devin auth login");
			expect(show).toHaveBeenCalled();
		});
	});

	describe("reset", () => {
		it("clears all dismissal flags so prompts reappear", async () => {
			const state = makeGlobalState();
			await state.update("gatomia.onboarding.acp.devin.dismissed", true);
			const service = new OnboardingService(state);

			await service.reset(descriptor);

			expect(state.update).toHaveBeenLastCalledWith(
				"gatomia.onboarding.acp.devin.dismissed",
				false
			);
		});
	});
});
