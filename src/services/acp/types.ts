import type { IdeHost } from "../../utils/ide-host-detector";

/**
 * Mirror of the experimental `ModelInfo` shape exposed by
 * `@agentclientprotocol/sdk` for {@link SessionModelState.availableModels}.
 *
 * Kept as a local re-declaration so the rest of the extension code does
 * not have to import the SDK's `schema` namespace directly. The fields
 * match the wire format 1:1 — see
 * `node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts`.
 */
export interface AcpModelInfo {
	/** Stable identifier reported by the agent (e.g. `"claude-sonnet-4-5"`). */
	modelId: string;
	/** Human-readable label the agent surfaces in pickers. */
	name: string;
	/** Optional long-form description (markdown / plain text). */
	description?: string | null;
}

/**
 * Mirror of the experimental `SessionModelState` payload shipped on
 * `NewSessionResponse.models`, `LoadSessionResponse.models`, etc.
 */
export interface AcpSessionModelState {
	availableModels: AcpModelInfo[];
	currentModelId: string;
}

/**
 * Sentinel error code thrown by {@link AcpClient.setSessionModel} when
 * the provider's `ClientSideConnection` does not implement the
 * experimental `setSessionModel` method (older CLIs / providers that
 * only support `--model` at spawn time). Callers catch this to fall
 * back to the legacy "record model change" flow which applies on the
 * next turn.
 */
export const ACP_NOT_SUPPORTED = "ACP_NOT_SUPPORTED";

/**
 * Result returned by provider-specific CLI probes.
 *
 * - `installed`: the CLI binary is reachable on PATH (or via `locateCLIExecutable`).
 * - `version`: parsed semver string when available.
 * - `authenticated`: best-effort check (exit code of an auth status command or
 *   presence of an expected env var / credentials file). Providers should err
 *   on the side of `false` when unsure so the UI can prompt the user.
 * - `acpSupported`: whether the installed version exposes an ACP subcommand or
 *   flag. When `false`, ACP routing is disabled for this provider.
 * - `executablePath`: absolute path when resolvable (used for spawning).
 * - `authHint`: short, actionable message shown in onboarding notifications.
 * - `canRunViaNpx`: true when the descriptor declares an npx fallback; the UI
 *   uses this to add the consent warning before spawning.
 * - `npxPackage`: the package name passed to `npx -y <package>` when the
 *   provider runs through the npx fallback.
 */
export interface AcpProviderProbe {
	installed: boolean;
	version: string | null;
	authenticated: boolean;
	acpSupported: boolean;
	executablePath: string | null;
	authHint?: string;
	error?: string;
	canRunViaNpx?: boolean;
	npxPackage?: string;
}

export type SessionMode = "workspace" | "per-spec" | "per-prompt";

/**
 * Where this descriptor came from. Used by `bootstrapAcpRouter` to apply
 * collision rules (built-in beats remote beats local) and by the picker
 * to badge entries with their origin.
 */
export type AcpProviderSource = "built-in" | "local" | "remote";

/**
 * Descriptor for an ACP-capable provider. Lives in the provider registry and
 * tells GatomIA how to detect, spawn, and communicate with the underlying CLI.
 */
export interface AcpProviderDescriptor {
	/** Stable identifier used in configs, onboarding, and logs (e.g. "devin"). */
	id: string;
	/** Human-readable label shown in QuickPicks and notifications. */
	displayName: string;
	/** IDE hosts where this provider is the preferred ACP target. */
	preferredHosts: IdeHost[];
	/** Binary to spawn (resolved through PATH). */
	spawnCommand: string;
	/** CLI arguments required to enter ACP server mode. */
	spawnArgs: string[];
	/** Optional env vars that count as authentication (e.g. `WINDSURF_API_KEY`). */
	envAuthVars?: string[];
	/** URL shown in onboarding when the CLI is missing. */
	installUrl: string;
	/** Short hint for the auth step (e.g. "devin auth login"). */
	authCommand: string;
	/** Minimal CLI version that supports ACP (semver string, optional). */
	minVersion?: string;
	/**
	 * Origin of this descriptor (defaults to "built-in" when omitted, for
	 * backwards compatibility with the original Devin/Gemini providers).
	 */
	source?: AcpProviderSource;
	/** Optional human-readable description used by the New Session picker. */
	description?: string;
	/** Optional icon URL surfaced by remote registry entries. */
	iconUrl?: string;
	/** Probe implementation. Must never throw; returns probe info. */
	probe(timeoutMs?: number): Promise<AcpProviderProbe>;
}
