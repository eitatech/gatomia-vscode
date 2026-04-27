/**
 * handleNewSession unit tests (TDD red).
 *
 * Drives the QuickPick UX wired to `gatomia.agentChat.newSession`:
 *   1. Lists every provider from `AcpProviderRegistry.list()` grouped into
 *      "Installed", "Available via npx", "Install required".
 *   2. After picking, asks for the initial prompt via `showInputBox`.
 *   3. Routes the final payload to the injected `startNew` callback.
 *
 * The npx-launch confirmation modal that used to gate `available-via-npx`
 * providers was removed: the QuickPick choice is already an explicit
 * opt-in and the modal interrupted every launch without adding real
 * safety. The tests below pin the post-removal contract.
 *
 * Pure function — no real VS Code surface; all UI calls are passed in via
 * `deps.window.showQuickPick` / `showInputBox` / `showWarningMessage`.
 */

import { describe, expect, it, vi } from "vitest";
import {
	handleNewSession,
	type NewSessionDeps,
	type NewSessionProviderItem,
} from "../../../src/commands/agent-chat-new-session";

// Top-level regex constant (biome lint/performance/useTopLevelRegex).
const AUGGIE_RE = /Auggie CLI/;

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

interface QuickPickItemLike {
	readonly label: string;
	readonly description?: string;
	readonly detail?: string;
	readonly providerId?: string;
	readonly action?: "open-install-url";
}

function makeProviders(): NewSessionProviderItem[] {
	return [
		{
			id: "claude-acp",
			displayName: "Claude Code",
			description: "ACP wrapper for Claude",
			source: "local",
			availability: "installed",
		},
		{
			id: "auggie",
			displayName: "Auggie CLI",
			description: "Augment Code agent",
			source: "remote",
			availability: "available-via-npx",
			npxPackage: "@augmentcode/auggie@0.24.0",
		},
		{
			id: "amp-acp",
			displayName: "Amp",
			description: "ACP wrapper for Amp",
			source: "remote",
			availability: "install-required",
			installUrl: "https://example.com/install/amp",
		},
	];
}

function makeDeps(overrides: Partial<NewSessionDeps> = {}): {
	deps: NewSessionDeps;
	startNew: ReturnType<typeof vi.fn>;
	openExternal: ReturnType<typeof vi.fn>;
	showQuickPick: ReturnType<typeof vi.fn>;
	showInputBox: ReturnType<typeof vi.fn>;
	showWarningMessage: ReturnType<typeof vi.fn>;
} {
	const startNew = vi.fn(() => Promise.resolve());
	const openExternal = vi.fn(() => Promise.resolve(true));
	const showQuickPick = vi.fn();
	const showInputBox = vi.fn();
	const showWarningMessage = vi.fn();

	const deps: NewSessionDeps = {
		listProviders: () => makeProviders(),
		startNew,
		window: {
			showQuickPick:
				showQuickPick as unknown as NewSessionDeps["window"]["showQuickPick"],
			showInputBox:
				showInputBox as unknown as NewSessionDeps["window"]["showInputBox"],
			showWarningMessage:
				showWarningMessage as unknown as NewSessionDeps["window"]["showWarningMessage"],
		},
		env: {
			openExternal:
				openExternal as unknown as NewSessionDeps["env"]["openExternal"],
		},
		...overrides,
	};
	return {
		deps,
		startNew,
		openExternal,
		showQuickPick,
		showInputBox,
		showWarningMessage,
	};
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("handleNewSession", () => {
	it("groups providers into Installed / Available via npx / Install required", async () => {
		const { deps, showQuickPick } = makeDeps();
		showQuickPick.mockResolvedValueOnce(undefined); // user cancels

		await handleNewSession(deps);

		// 1st call is the provider QuickPick.
		const items = showQuickPick.mock.calls[0]?.[0] as QuickPickItemLike[];
		expect(items).toBeDefined();

		// QuickPick separators carry the group name as label.
		const labels = items.map((item) => item.label);
		expect(labels).toContain("Installed");
		expect(labels).toContain("Available via npx");
		expect(labels).toContain("Install required");

		// Each provider must appear exactly once below its group.
		const providerLabels = items
			.filter((item) => item.providerId)
			.map((item) => item.label);
		expect(providerLabels).toContain("Claude Code");
		expect(providerLabels).toContain("Auggie CLI");
		expect(providerLabels).toContain("Amp");
	});

	it("forwards { providerId, prompt } to startNew when the provider is installed", async () => {
		const { deps, startNew, showQuickPick, showInputBox } = makeDeps();
		showQuickPick.mockResolvedValueOnce({
			label: "Claude Code",
			providerId: "claude-acp",
		});
		showInputBox.mockResolvedValueOnce("write a haiku");

		await handleNewSession(deps);

		expect(startNew).toHaveBeenCalledWith(
			expect.objectContaining({
				agentId: "claude-acp",
				agentDisplayName: "Claude Code",
				taskInstruction: "write a haiku",
			})
		);
	});

	it("aborts without starting when the user dismisses the prompt input", async () => {
		const { deps, startNew, showQuickPick, showInputBox } = makeDeps();
		showQuickPick.mockResolvedValueOnce({
			label: "Claude Code",
			providerId: "claude-acp",
		});
		showInputBox.mockResolvedValueOnce(undefined); // ESC

		await handleNewSession(deps);

		expect(startNew).not.toHaveBeenCalled();
	});

	it("launches available-via-npx providers directly without a confirmation modal", async () => {
		// Regression: the user explicitly asked for npx-based agents to spawn
		// straight through. The QuickPick choice is the opt-in; we do not
		// show any `showWarningMessage` modal between picking and `startNew`.
		const { deps, startNew, showQuickPick, showInputBox, showWarningMessage } =
			makeDeps();
		showQuickPick.mockResolvedValueOnce({
			label: "Auggie CLI",
			providerId: "auggie",
		});
		showInputBox.mockResolvedValueOnce("hi");

		await handleNewSession(deps);

		expect(showWarningMessage).not.toHaveBeenCalled();
		expect(startNew).toHaveBeenCalledTimes(1);
		expect(startNew).toHaveBeenCalledWith(
			expect.objectContaining({
				agentId: "auggie",
				agentDisplayName: expect.stringMatching(AUGGIE_RE),
			})
		);
	});

	it("opens the install URL and aborts startNew when the user picks 'Install required' tier", async () => {
		const { deps, startNew, openExternal, showQuickPick, showInputBox } =
			makeDeps();
		showQuickPick.mockResolvedValueOnce({
			label: "Amp",
			providerId: "amp-acp",
			action: "open-install-url",
		});

		await handleNewSession(deps);

		expect(openExternal).toHaveBeenCalledTimes(1);
		expect(startNew).not.toHaveBeenCalled();
		expect(showInputBox).not.toHaveBeenCalled();
	});
});
