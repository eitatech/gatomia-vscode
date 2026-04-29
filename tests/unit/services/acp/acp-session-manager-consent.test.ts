/**
 * AcpSessionManager — beforeSpawn consent gate (TDD red).
 *
 * Verifies the npx-consent hook added by Plan A.5:
 *   - Triggered the first time a descriptor with `spawnCommand === "npx"` is
 *     about to spawn a client.
 *   - Skipped for non-npx descriptors.
 *   - Result is cached per (providerId, cwd) so subsequent calls don't
 *     re-prompt.
 *   - When the hook returns false, `send()` rejects and no client is created.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AcpSessionManager,
	type AcpSessionManagerOptions,
} from "../../../../src/services/acp/acp-session-manager";
import type { AcpProviderRegistry } from "../../../../src/services/acp/acp-provider-registry";
import type { AcpProviderDescriptor } from "../../../../src/services/acp/types";

const DECLINED_RE = /declined/i;

// We mock the AcpClient so no subprocess is ever spawned.
const sendPromptSpy = vi.fn(() => Promise.resolve());
const disposeSpy = vi.fn();

vi.mock("../../../../src/services/acp/acp-client", () => {
	class FakeAcpClient {
		sendPrompt = sendPromptSpy;
		cancel = vi.fn(() => Promise.resolve());
		cancelAll = vi.fn(() => Promise.resolve());
		dispose = disposeSpy;
		getLastSessionKey = vi.fn(() => {
			return;
		});
		subscribeSession = vi.fn(() => ({ dispose: vi.fn() }));
	}
	return { AcpClient: FakeAcpClient };
});

function createOutput(): AcpSessionManagerOptions["output"] {
	return {
		appendLine: vi.fn(),
		append: vi.fn(),
		clear: vi.fn(),
		dispose: vi.fn(),
		hide: vi.fn(),
		show: vi.fn(),
		name: "test",
		replace: vi.fn(),
	} as unknown as AcpSessionManagerOptions["output"];
}

function createRegistry(
	descriptor: AcpProviderDescriptor
): AcpProviderRegistry {
	return {
		get: vi.fn((id: string) => (id === descriptor.id ? descriptor : undefined)),
	} as unknown as AcpProviderRegistry;
}

function makeNpxDescriptor(): AcpProviderDescriptor {
	return {
		id: "auggie",
		displayName: "Auggie",
		preferredHosts: [],
		spawnCommand: "npx",
		spawnArgs: ["-y", "@augmentcode/auggie@0.24.0"],
		installUrl: "",
		authCommand: "",
		source: "remote",
		probe: () =>
			Promise.resolve({
				installed: false,
				version: null,
				authenticated: false,
				acpSupported: true,
				executablePath: null,
				canRunViaNpx: true,
				npxPackage: "@augmentcode/auggie@0.24.0",
			}),
	};
}

function makeLocalDescriptor(): AcpProviderDescriptor {
	return {
		id: "claude-acp",
		displayName: "Claude",
		preferredHosts: [],
		spawnCommand: "npx",
		spawnArgs: ["@zed-industries/claude-agent-acp"],
		installUrl: "",
		authCommand: "",
		source: "local",
		probe: () =>
			Promise.resolve({
				installed: true,
				version: null,
				authenticated: true,
				acpSupported: true,
				executablePath: null,
			}),
	};
}

describe("AcpSessionManager — beforeSpawn consent (A.5)", () => {
	beforeEach(() => {
		sendPromptSpy.mockClear();
		disposeSpy.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("invokes beforeSpawn the first time an npx descriptor is about to spawn", async () => {
		const descriptor = makeNpxDescriptor();
		const beforeSpawn = vi.fn(() => Promise.resolve(true));
		const manager = new AcpSessionManager({
			registry: createRegistry(descriptor),
			output: createOutput(),
			cwd: "/ws",
			beforeSpawn,
		});

		await manager.send("auggie", "hello", { mode: "workspace" });

		expect(beforeSpawn).toHaveBeenCalledTimes(1);
		expect(beforeSpawn.mock.calls[0]?.[0]).toMatchObject({
			id: "auggie",
			spawnCommand: "npx",
		});
		expect(sendPromptSpy).toHaveBeenCalledTimes(1);
	});

	it("rejects send and never spawns a client when beforeSpawn returns false", async () => {
		const descriptor = makeNpxDescriptor();
		const beforeSpawn = vi.fn(() => Promise.resolve(false));
		const manager = new AcpSessionManager({
			registry: createRegistry(descriptor),
			output: createOutput(),
			cwd: "/ws",
			beforeSpawn,
		});

		await expect(
			manager.send("auggie", "hi", { mode: "workspace" })
		).rejects.toThrow(DECLINED_RE);
		expect(sendPromptSpy).not.toHaveBeenCalled();
	});

	it("caches consent: a second send for the same (provider, cwd) does not re-prompt", async () => {
		const descriptor = makeNpxDescriptor();
		const beforeSpawn = vi.fn(() => Promise.resolve(true));
		const manager = new AcpSessionManager({
			registry: createRegistry(descriptor),
			output: createOutput(),
			cwd: "/ws",
			beforeSpawn,
		});

		await manager.send("auggie", "first", { mode: "workspace" });
		await manager.send("auggie", "second", { mode: "workspace" });

		expect(beforeSpawn).toHaveBeenCalledTimes(1);
		expect(sendPromptSpy).toHaveBeenCalledTimes(2);
	});

	it("re-prompts for the same provider when the cwd is different (worktree isolation)", async () => {
		const descriptor = makeNpxDescriptor();
		const beforeSpawn = vi.fn(() => Promise.resolve(true));
		const manager = new AcpSessionManager({
			registry: createRegistry(descriptor),
			output: createOutput(),
			cwd: "/ws",
			beforeSpawn,
		});

		await manager.send("auggie", "first", { mode: "workspace" });
		await manager.send("auggie", "second", {
			mode: "workspace",
			cwd: "/worktrees/feat-1",
		});

		expect(beforeSpawn).toHaveBeenCalledTimes(2);
	});

	it("does NOT call beforeSpawn for installed local descriptors (non-npx flow)", async () => {
		const descriptor = makeLocalDescriptor();
		// Make sure spawnCommand is something other than 'npx' so the gate
		// has a clean negative case. Mutate a copy to keep the helper simple.
		const installedDescriptor: AcpProviderDescriptor = {
			...descriptor,
			spawnCommand: "claude",
			spawnArgs: ["--acp"],
		};
		const beforeSpawn = vi.fn(() => Promise.resolve(true));
		const manager = new AcpSessionManager({
			registry: createRegistry(installedDescriptor),
			output: createOutput(),
			cwd: "/ws",
			beforeSpawn,
		});

		await manager.send("claude-acp", "hi", { mode: "workspace" });

		expect(beforeSpawn).not.toHaveBeenCalled();
		expect(sendPromptSpy).toHaveBeenCalledTimes(1);
	});

	it("is a no-op when no beforeSpawn is provided (backward compat)", async () => {
		const descriptor = makeNpxDescriptor();
		const manager = new AcpSessionManager({
			registry: createRegistry(descriptor),
			output: createOutput(),
			cwd: "/ws",
		});

		await manager.send("auggie", "hi", { mode: "workspace" });

		expect(sendPromptSpy).toHaveBeenCalledTimes(1);
	});
});
