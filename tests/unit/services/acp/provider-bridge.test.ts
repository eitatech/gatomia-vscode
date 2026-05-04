/**
 * provider-bridge unit tests (TDD red).
 *
 * Coverage:
 *   - createDescriptorFromKnownAgent: command split, probe delegation,
 *     duplicate-id guard, Junie entry presence.
 *   - createDescriptorFromRemoteEntry: prefers binary/<platform> over npx,
 *     falls back to `npx -y <package>`, sets `canRunViaNpx` correctly,
 *     marks descriptor with `source: "remote"`.
 *   - selectPlatformBinary helper covers all 6 darwin/linux/windows × aarch64/x86_64
 *     keys plus a graceful "no match" fallback.
 *
 * The implementation lives in `src/services/acp/provider-bridge.ts` and does
 * NOT exist yet — these tests are the red side of TDD.
 */

import { describe, expect, it, vi } from "vitest";
import {
	KNOWN_AGENTS,
	type KnownAgentEntry,
} from "../../../../src/features/hooks/services/known-agent-catalog";
import type { KnownAgentDetector } from "../../../../src/features/hooks/services/known-agent-detector";
import {
	createDescriptorFromKnownAgent,
	createDescriptorFromRemoteEntry,
	selectPlatformBinary,
	type ProviderBridgePlatform,
} from "../../../../src/services/acp/provider-bridge";
import type { RemoteRegistryEntry } from "../../../../src/services/acp/acp-provider-registry";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function createDetector(installed: boolean): KnownAgentDetector {
	return {
		preloadAll: vi.fn(() => Promise.resolve()),
		isInstalledAny: vi.fn(() => Promise.resolve(installed)),
		isInstalled: vi.fn(() => Promise.resolve(installed)),
	} as unknown as KnownAgentDetector;
}

const opencodeEntry: KnownAgentEntry = {
	id: "opencode",
	displayName: "OpenCode",
	agentCommand: "opencode acp",
	installChecks: [{ strategy: "path", target: "opencode" }],
};

// ---------------------------------------------------------------------------
// createDescriptorFromKnownAgent
// ---------------------------------------------------------------------------

describe("createDescriptorFromKnownAgent", () => {
	it("splits the agentCommand into spawnCommand + spawnArgs", () => {
		const detector = createDetector(true);
		const descriptor = createDescriptorFromKnownAgent(opencodeEntry, detector);

		expect(descriptor.spawnCommand).toBe("opencode");
		expect(descriptor.spawnArgs).toEqual(["acp"]);
	});

	it("preserves multi-arg commands (e.g. npx packages with flags)", () => {
		const detector = createDetector(true);
		const entry: KnownAgentEntry = {
			id: "gemini",
			displayName: "Gemini CLI",
			agentCommand: "npx @google/gemini-cli --experimental-acp",
			installChecks: [{ strategy: "path", target: "gemini" }],
		};

		const descriptor = createDescriptorFromKnownAgent(entry, detector);

		expect(descriptor.spawnCommand).toBe("npx");
		expect(descriptor.spawnArgs).toEqual([
			"@google/gemini-cli",
			"--experimental-acp",
		]);
	});

	it("delegates probe.installed to KnownAgentDetector.isInstalledAny", async () => {
		const detector = createDetector(true);
		const descriptor = createDescriptorFromKnownAgent(opencodeEntry, detector);
		const probe = await descriptor.probe();

		expect(probe.installed).toBe(true);
		expect(detector.isInstalledAny).toHaveBeenCalledWith(
			opencodeEntry.installChecks
		);
	});

	it("returns installed=false when the detector reports the binary missing", async () => {
		const detector = createDetector(false);
		const descriptor = createDescriptorFromKnownAgent(opencodeEntry, detector);
		const probe = await descriptor.probe();

		expect(probe.installed).toBe(false);
		expect(probe.acpSupported).toBe(false);
	});

	it("tags the descriptor with source='local'", () => {
		const detector = createDetector(true);
		const descriptor = createDescriptorFromKnownAgent(opencodeEntry, detector);
		expect(descriptor.source).toBe("local");
	});

	it("includes JetBrains Junie in the catalog (added by A.2)", () => {
		const junie = KNOWN_AGENTS.find((entry) => entry.id === "junie");
		expect(junie).toBeDefined();
		expect(junie?.displayName).toBe("JetBrains Junie");
	});
});

// ---------------------------------------------------------------------------
// selectPlatformBinary
// ---------------------------------------------------------------------------

describe("selectPlatformBinary", () => {
	const allPlatforms: Record<
		string,
		{ archive: string; cmd: string; args?: string[] }
	> = {
		"darwin-aarch64": { archive: "u1", cmd: "./agent" },
		"darwin-x86_64": { archive: "u2", cmd: "./agent" },
		"linux-aarch64": { archive: "u3", cmd: "./agent" },
		"linux-x86_64": { archive: "u4", cmd: "./agent" },
		"windows-aarch64": { archive: "u5", cmd: "./agent.exe" },
		"windows-x86_64": { archive: "u6", cmd: "./agent.exe" },
	};

	const cases: [ProviderBridgePlatform, string][] = [
		["darwin-aarch64", "u1"],
		["darwin-x86_64", "u2"],
		["linux-aarch64", "u3"],
		["linux-x86_64", "u4"],
		["windows-aarch64", "u5"],
		["windows-x86_64", "u6"],
	];

	it.each(cases)("selects %s -> %s", (platform, expectedArchive) => {
		const result = selectPlatformBinary(allPlatforms, platform);
		expect(result?.archive).toBe(expectedArchive);
	});

	it("returns undefined when the requested platform key is absent", () => {
		const partial = {
			"linux-x86_64": { archive: "u4", cmd: "./agent" },
		};
		expect(selectPlatformBinary(partial, "darwin-aarch64")).toBeUndefined();
	});

	it("returns undefined when the binary map is empty", () => {
		expect(selectPlatformBinary({}, "linux-x86_64")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// createDescriptorFromRemoteEntry
// ---------------------------------------------------------------------------

describe("createDescriptorFromRemoteEntry", () => {
	const npxOnlyEntry: RemoteRegistryEntry = {
		id: "auggie",
		displayName: "Auggie CLI",
		description: "Augment Code's powerful software agent",
		distribution: {
			npx: {
				package: "@augmentcode/auggie@0.24.0",
				args: ["--acp"],
			},
		},
	};

	const binaryAndNpxEntry: RemoteRegistryEntry = {
		id: "codex-acp",
		displayName: "Codex CLI",
		distribution: {
			binary: {
				"darwin-aarch64": {
					archive: "https://example.com/codex-darwin-aarch64.tar.gz",
					cmd: "./codex-acp",
				},
				"linux-x86_64": {
					archive: "https://example.com/codex-linux-x86_64.tar.gz",
					cmd: "./codex-acp",
				},
			},
			npx: {
				package: "@zed-industries/codex-acp@0.12.0",
			},
		},
	};

	it("uses npx -y <package> [args] when only distribution.npx is present", async () => {
		const descriptor = createDescriptorFromRemoteEntry(npxOnlyEntry, {
			platform: "linux-x86_64",
		});

		expect(descriptor.spawnCommand).toBe("npx");
		expect(descriptor.spawnArgs[0]).toBe("-y");
		expect(descriptor.spawnArgs).toContain("@augmentcode/auggie@0.24.0");
		expect(descriptor.spawnArgs).toContain("--acp");

		const probe = await descriptor.probe();
		expect(probe.canRunViaNpx).toBe(true);
		expect(probe.npxPackage).toBe("@augmentcode/auggie@0.24.0");
	});

	it("prefers binary/<platform> when the platform key resolves", () => {
		const descriptor = createDescriptorFromRemoteEntry(binaryAndNpxEntry, {
			platform: "darwin-aarch64",
		});

		// Spawn must invoke the downloaded binary, not npx.
		expect(descriptor.spawnCommand).not.toBe("npx");
		expect(descriptor.spawnCommand).toContain("codex-acp");
	});

	it("falls back to npx when the binary map lacks the host platform", () => {
		const descriptor = createDescriptorFromRemoteEntry(binaryAndNpxEntry, {
			platform: "windows-aarch64",
		});

		expect(descriptor.spawnCommand).toBe("npx");
		expect(descriptor.spawnArgs).toContain("@zed-industries/codex-acp@0.12.0");
	});

	it("tags the descriptor with source='remote'", () => {
		const descriptor = createDescriptorFromRemoteEntry(npxOnlyEntry, {
			platform: "linux-x86_64",
		});
		expect(descriptor.source).toBe("remote");
	});

	it("propagates installUrl from the remote entry", () => {
		const entry: RemoteRegistryEntry = {
			...npxOnlyEntry,
			installUrl: "https://example.com/install",
		};
		const descriptor = createDescriptorFromRemoteEntry(entry, {
			platform: "linux-x86_64",
		});
		expect(descriptor.installUrl).toBe("https://example.com/install");
	});
});
