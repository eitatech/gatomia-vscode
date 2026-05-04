import { env, type OutputChannel, workspace } from "vscode";
import { detectIdeHost } from "../utils/ide-host-detector";
import type { AcpProviderRegistry } from "./acp/acp-provider-registry";
import type { AcpProviderDescriptor } from "./acp/types";
import type { OnboardingService } from "./onboarding-service";

export type { IdeHost } from "../utils/ide-host-detector";

export type ChatTarget =
	| { kind: "acp"; providerId: string }
	| { kind: "copilot-chat" };

export interface ChatRouterDecision {
	target: ChatTarget;
	reason: string;
	providerId?: string;
}

export interface ChatRouterOptions {
	registry: AcpProviderRegistry;
	onboarding: OnboardingService;
	output: OutputChannel;
	/** Override for tests: how long to cache a decision (defaults to 60s). */
	cacheTtlMs?: number;
}

const DEFAULT_CACHE_TTL_MS = 60_000;
const CONFIG_PROVIDER_KEY = "chat.provider";
const CONFIG_SECTION = "gatomia";

/**
 * Decides where a chat prompt should be delivered (ACP provider vs Copilot
 * Chat). The router is purely declarative — it does not start subprocesses
 * or invoke the chat API; that is the dispatcher's job.
 */
export class ChatRouter {
	private readonly registry: AcpProviderRegistry;
	private readonly onboarding: OnboardingService;
	private readonly output: OutputChannel;
	private readonly cacheTtlMs: number;
	private cached: { decision: ChatRouterDecision; expiresAt: number } | null =
		null;

	constructor(options: ChatRouterOptions) {
		this.registry = options.registry;
		this.onboarding = options.onboarding;
		this.output = options.output;
		this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
	}

	async resolve(): Promise<ChatRouterDecision> {
		if (this.cached && this.cached.expiresAt > Date.now()) {
			return this.cached.decision;
		}

		const decision = await this.decide();
		this.cached = {
			decision,
			expiresAt: Date.now() + this.cacheTtlMs,
		};
		this.output.appendLine(
			`[ChatRouter] target=${JSON.stringify(decision.target)} reason=${decision.reason}`
		);
		return decision;
	}

	invalidateCache(): void {
		this.cached = null;
	}

	private decide(): Promise<ChatRouterDecision> {
		const configured = this.getConfiguredProvider();
		if (configured === "copilot-chat") {
			return Promise.resolve({
				target: { kind: "copilot-chat" },
				reason: "user override: copilot-chat",
			});
		}

		if (configured && configured !== "auto") {
			const descriptor = this.registry.get(configured);
			if (!descriptor) {
				return Promise.resolve({
					target: { kind: "copilot-chat" },
					reason: `unknown provider in config: ${configured}`,
				});
			}
			return this.resolveFor(descriptor, "user override");
		}

		// Auto mode
		if (isRemoteWorkspace()) {
			return Promise.resolve({
				target: { kind: "copilot-chat" },
				reason: "ACP disabled in remote workspaces",
			});
		}

		const host = detectIdeHost();
		const descriptor = this.registry.forHost(host);
		if (!descriptor) {
			return Promise.resolve({
				target: { kind: "copilot-chat" },
				reason: `no ACP provider registered for host=${host}`,
			});
		}

		return this.resolveFor(descriptor, `auto (host=${host})`);
	}

	private async resolveFor(
		descriptor: AcpProviderDescriptor,
		reasonPrefix: string
	): Promise<ChatRouterDecision> {
		const probe = await descriptor.probe();

		if (!probe.installed) {
			schedulePrompt(
				() => this.onboarding.promptInstall(descriptor),
				this.output
			);
			return {
				target: { kind: "copilot-chat" },
				reason: `${reasonPrefix}: ${descriptor.displayName} not installed`,
				providerId: descriptor.id,
			};
		}

		if (!probe.acpSupported) {
			return {
				target: { kind: "copilot-chat" },
				reason: `${reasonPrefix}: ${descriptor.displayName} does not support ACP`,
				providerId: descriptor.id,
			};
		}

		if (!probe.authenticated) {
			schedulePrompt(() => this.onboarding.promptAuth(descriptor), this.output);
			return {
				target: { kind: "copilot-chat" },
				reason: `${reasonPrefix}: ${descriptor.displayName} not authenticated`,
				providerId: descriptor.id,
			};
		}

		return {
			target: { kind: "acp", providerId: descriptor.id },
			reason: `${reasonPrefix}: ${descriptor.displayName} ready`,
			providerId: descriptor.id,
		};
	}

	private getConfiguredProvider(): string {
		const config = workspace.getConfiguration(CONFIG_SECTION);
		return config.get<string>(CONFIG_PROVIDER_KEY, "auto");
	}
}

const isRemoteWorkspace = (): boolean => Boolean(env.remoteName);

/**
 * Fires an onboarding notification without blocking the router. The router
 * must stay responsive so chat dispatch is never gated on the user reacting
 * to a modal-ish info message.
 */
const schedulePrompt = (
	fn: () => Promise<void>,
	output: OutputChannel
): void => {
	Promise.resolve()
		.then(fn)
		.catch((error: unknown) => {
			output.appendLine(
				`[ChatRouter] onboarding prompt failed: ${error instanceof Error ? error.message : String(error)}`
			);
		});
};
