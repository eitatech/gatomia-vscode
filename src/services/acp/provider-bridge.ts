/**
 * provider-bridge — converts entries from the local known-agent catalog and
 * the remote ACP Registry into runnable {@link AcpProviderDescriptor}s.
 *
 * This module is intentionally side-effect-free: it only assembles
 * descriptors. Spawning is handled by `AcpSessionManager` / `AcpClient`.
 *
 * @see specs/018-agent-chat-panel — Plan A.3
 */

import { arch, platform } from "node:os";
import type {
	KnownAgentEntry,
	InstallCheckStrategy,
} from "../../features/hooks/services/known-agent-catalog";
import type { KnownAgentDetector } from "../../features/hooks/services/known-agent-detector";
import type {
	RemoteRegistryBinaryEntry,
	RemoteRegistryEntry,
} from "./acp-provider-registry";
import type { AcpProviderDescriptor, AcpProviderProbe } from "./types";

const COMMAND_SPLIT_RE = /\s+/;
const RELATIVE_PREFIX_RE = /^\.\//;

function archKeyFor(cpu: string): "aarch64" | "x86_64" | undefined {
	if (cpu === "arm64" || cpu === "arm") {
		return "aarch64";
	}
	if (cpu === "x64") {
		return "x86_64";
	}
	return;
}

// ---------------------------------------------------------------------------
// Platform handling
// ---------------------------------------------------------------------------

export type ProviderBridgePlatform =
	| "darwin-aarch64"
	| "darwin-x86_64"
	| "linux-aarch64"
	| "linux-x86_64"
	| "windows-aarch64"
	| "windows-x86_64";

/**
 * Best-effort mapping of Node's `os.platform()` + `os.arch()` to the
 * 6-key matrix used by the ACP Registry. Returns `undefined` when the host
 * doesn't match any supported combination (BSD, exotic Linux ARMs, etc.).
 */
export function detectHostPlatform(): ProviderBridgePlatform | undefined {
	const os = platform();
	const archKey = archKeyFor(arch());
	if (!archKey) {
		return;
	}
	if (os === "darwin") {
		return `darwin-${archKey}` as ProviderBridgePlatform;
	}
	if (os === "linux") {
		return `linux-${archKey}` as ProviderBridgePlatform;
	}
	if (os === "win32") {
		return `windows-${archKey}` as ProviderBridgePlatform;
	}
	return;
}

/**
 * Picks the binary entry for the requested platform from a registry-shaped
 * map. Returns `undefined` when the key is absent.
 */
export function selectPlatformBinary(
	binaries: Record<string, RemoteRegistryBinaryEntry> | undefined,
	preferred: ProviderBridgePlatform
): RemoteRegistryBinaryEntry | undefined {
	if (!binaries) {
		return;
	}
	return binaries[preferred];
}

// ---------------------------------------------------------------------------
// Local catalog -> AcpProviderDescriptor
// ---------------------------------------------------------------------------

/**
 * Build a runnable descriptor for a local catalog entry. The probe delegates
 * to {@link KnownAgentDetector.isInstalledAny} so the existing detection
 * pipeline (login shell PATH + npm-global lookups) drives availability.
 */
export function createDescriptorFromKnownAgent(
	entry: KnownAgentEntry,
	detector: KnownAgentDetector
): AcpProviderDescriptor {
	const [spawnCommand, ...spawnArgs] = entry.agentCommand
		.trim()
		.split(COMMAND_SPLIT_RE);
	if (!spawnCommand) {
		throw new Error(
			`[provider-bridge] empty agentCommand for known agent '${entry.id}'`
		);
	}

	return {
		id: entry.id,
		displayName: entry.displayName,
		preferredHosts: [],
		spawnCommand,
		spawnArgs,
		installUrl: entry.installUrl ?? "",
		authCommand: "",
		source: "local",
		description: entry.description,
		probe: () => probeKnownAgent(entry.installChecks, detector),
	};
}

async function probeKnownAgent(
	checks: readonly InstallCheckStrategy[],
	detector: KnownAgentDetector
): Promise<AcpProviderProbe> {
	try {
		const installed = await detector.isInstalledAny([...checks]);
		return {
			installed,
			version: null,
			authenticated: installed, // Local catalog has no first-class auth probe.
			acpSupported: installed,
			executablePath: null,
		};
	} catch (error) {
		return {
			installed: false,
			version: null,
			authenticated: false,
			acpSupported: false,
			executablePath: null,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ---------------------------------------------------------------------------
// Remote registry -> AcpProviderDescriptor
// ---------------------------------------------------------------------------

export interface RemoteDescriptorOptions {
	/** Override the host platform — primarily for tests. */
	platform: ProviderBridgePlatform;
}

/**
 * Build a runnable descriptor for a remote registry entry. Prefers a
 * platform-specific binary archive when present and falls back to the npx
 * channel otherwise.
 *
 * The probe is intentionally simple: GatomIA does not download archives or
 * pre-resolve binaries — it sets `canRunViaNpx` so the UI can warn before
 * spawning, and lets `npx -y <package>` perform any download lazily.
 */
export function createDescriptorFromRemoteEntry(
	entry: RemoteRegistryEntry,
	options: RemoteDescriptorOptions
): AcpProviderDescriptor {
	const distribution = entry.distribution;
	const binary = selectPlatformBinary(distribution?.binary, options.platform);

	let spawnCommand: string;
	let spawnArgs: string[];
	let canRunViaNpx = false;
	let npxPackage: string | undefined;

	if (binary) {
		// The CDN ships `cmd` as a bare executable name (`./agent`). We strip
		// the `./` prefix when it's there because we will spawn from PATH after
		// the user has placed the unpacked archive in a known location. (For
		// v1 we treat binary entries as opaque commands; the user is expected
		// to install the archive themselves.)
		spawnCommand = binary.cmd.replace(RELATIVE_PREFIX_RE, "");
		spawnArgs = [...(binary.args ?? [])];
	} else if (distribution?.npx) {
		canRunViaNpx = true;
		npxPackage = distribution.npx.package;
		spawnCommand = "npx";
		spawnArgs = [
			"-y",
			distribution.npx.package,
			...(distribution.npx.args ?? []),
		];
	} else {
		// Should never happen: `isValidRemoteEntry` filters these out at fetch
		// time. We keep a defensive fallback so downstream code can still build
		// a descriptor without throwing.
		spawnCommand = entry.id;
		spawnArgs = [];
	}

	return {
		id: entry.id,
		displayName: entry.displayName,
		preferredHosts: [],
		spawnCommand,
		spawnArgs,
		installUrl: entry.installUrl ?? entry.repository ?? "",
		authCommand: "",
		source: "remote",
		description: entry.description,
		iconUrl: entry.icon,
		probe: () =>
			Promise.resolve({
				installed: false,
				version: entry.version ?? null,
				authenticated: false,
				acpSupported: true,
				executablePath: null,
				canRunViaNpx,
				npxPackage,
			}),
	};
}
