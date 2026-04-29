/**
 * Cap-warning QuickPick prompt tests (T073a, spec 018 US4).
 *
 * TDD: red before implementation.
 *
 * @see specs/018-agent-chat-panel/research.md §R5
 */

import { describe, expect, it, vi } from "vitest";
import {
	type CapWarningDecision,
	type CapWarningPromptDeps,
	promptForCapWarning,
} from "../../../../src/features/agent-chat/cap-warning-prompt";
import type { AgentChatSession } from "../../../../src/features/agent-chat/types";

const NOW = 10_000;

const OPENCODE_RE = /OpenCode/;
const PLAN_RE = /plan/;
const WORKTREE_RE = /worktree/;
const IDLE_3M_RE = /3m ago/;
const CLAUDE_RE = /Claude/;
const LOCAL_RE = /local/;

function session(
	id: string,
	overrides: Partial<AgentChatSession> = {}
): AgentChatSession {
	return {
		id,
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "OpenCode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		lifecycleState: "waiting-for-input",
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		createdAt: 0,
		updatedAt: NOW - 60_000,
		workspaceUri: "file:///fake",
		selectedModeId: "code",
		...overrides,
	} as AgentChatSession;
}

interface FakeWindow extends CapWarningPromptDeps {
	picks: Parameters<CapWarningPromptDeps["showQuickPick"]>[];
	warnings: Parameters<CapWarningPromptDeps["showWarningMessage"]>[];
	picked?: { label: string; sessionId?: string; action?: string };
	confirmed?: string;
}

function createWindow(): FakeWindow {
	const win: FakeWindow = {
		picks: [],
		warnings: [],
		picked: undefined,
		confirmed: undefined,
		showQuickPick: vi.fn((items, options) => {
			win.picks.push([items, options]);
			return Promise.resolve(win.picked);
		}) as CapWarningPromptDeps["showQuickPick"],
		showWarningMessage: vi.fn((message, ...actions) => {
			win.warnings.push([message, ...actions]);
			return Promise.resolve(win.confirmed);
		}) as CapWarningPromptDeps["showWarningMessage"],
	};
	return win;
}

describe("promptForCapWarning (T073a)", () => {
	it("returns { kind: 'abort' } when the user dismisses the QuickPick", async () => {
		const win = createWindow();
		const decision = await promptForCapWarning({
			idleSessions: [session("s-1")],
			cap: 5,
			window: win,
			now: () => NOW,
		});
		expect(decision).toEqual<CapWarningDecision>({ kind: "abort" });
	});

	it("renders one item per idle session with 'agent · mode · target · idleFor' label", async () => {
		const win = createWindow();
		const sessions = [
			session("s-a", {
				agentDisplayName: "OpenCode",
				selectedModeId: "plan",
				executionTarget: { kind: "worktree", worktreeId: "wt-1" },
				updatedAt: NOW - 3 * 60_000,
			}),
			session("s-b", {
				agentDisplayName: "Claude",
				selectedModeId: "code",
				executionTarget: { kind: "local" },
				updatedAt: NOW - 15_000,
			}),
		];
		win.picked = undefined; // user dismisses
		await promptForCapWarning({
			idleSessions: sessions,
			cap: 5,
			window: win,
			now: () => NOW,
		});
		const [items] = win.picks[0];
		const labels = (items as Array<{ label: string }>).map((i) => i.label);
		expect(labels[0]).toMatch(OPENCODE_RE);
		expect(labels[0]).toMatch(PLAN_RE);
		expect(labels[0]).toMatch(WORKTREE_RE);
		expect(labels[0]).toMatch(IDLE_3M_RE);
		expect(labels[1]).toMatch(CLAUDE_RE);
		expect(labels[1]).toMatch(LOCAL_RE);
	});

	it("returns 'cancel-and-start' when user picks a session with the default action", async () => {
		const win = createWindow();
		win.picked = {
			label: "OpenCode · code · local · 1m ago",
			sessionId: "s-1",
			action: "cancel-and-start",
		};
		const decision = await promptForCapWarning({
			idleSessions: [session("s-1")],
			cap: 5,
			window: win,
			now: () => NOW,
		});
		expect(decision).toEqual<CapWarningDecision>({
			kind: "cancel-and-start",
			sessionIdToCancel: "s-1",
		});
	});

	it("returns 'cancel-only' when user picks the cancel-without-start action", async () => {
		const win = createWindow();
		win.picked = {
			label: "OpenCode · code · local · 1m ago",
			sessionId: "s-1",
			action: "cancel-only",
		};
		const decision = await promptForCapWarning({
			idleSessions: [session("s-1")],
			cap: 5,
			window: win,
			now: () => NOW,
		});
		expect(decision).toEqual<CapWarningDecision>({
			kind: "cancel-only",
			sessionIdToCancel: "s-1",
		});
	});

	it("returns 'abort' when user picks 'Keep all, do not start'", async () => {
		const win = createWindow();
		win.picked = {
			label: "Keep all, do not start",
			action: "keep-all",
		};
		const decision = await promptForCapWarning({
			idleSessions: [session("s-1")],
			cap: 5,
			window: win,
			now: () => NOW,
		});
		expect(decision).toEqual<CapWarningDecision>({ kind: "abort" });
	});
});
