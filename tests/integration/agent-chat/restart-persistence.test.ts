/**
 * Integration test: restart persistence (T077, spec 018 §6 Quickstart).
 *
 * Exercises the full Quickstart §6 flow end-to-end against the real
 * `AgentChatSessionStore` (no UI, no subprocess). Verifies:
 *
 *   1. Before shutdown: two ACP sessions + one Cloud session are live in the
 *      manifest with `running` state and full transcripts.
 *   2. `flushForDeactivation()` stamps ACP sessions to `ended-by-shutdown` in
 *      a SINGLE `workspaceState.update` call (contract §6.2 single-atomic).
 *   3. After "restart" (a fresh `AgentChatSessionStore` sharing the same
 *      `workspaceState` memento), `initialize()`:
 *        a. restores the two ACP sessions with `lifecycleState` still equal
 *           to `ended-by-shutdown` (they were stamped before shutdown);
 *        b. appends an `ended-by-shutdown` system marker ONLY if it isn't
 *           already present (idempotent — §6.1);
 *        c. calls the provided `cloudAttach` for the Cloud session's
 *           `cloudSessionLocalId` so spec 016's polling can re-attach;
 *        d. leaves the worktree-backed ACP session's `worktreePath` reachable
 *           so the Running Agents tree can still render it.
 *   4. Full transcripts survive: every user/agent message the tests appended
 *      before shutdown is still readable after restart.
 *
 * Contract references:
 *   - contracts/agent-chat-session-storage.md §6.1 (restart restore)
 *   - contracts/agent-chat-session-storage.md §6.2 (single-atomic flush)
 *   - spec.md FR-019a/b/c
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type AgentChatArchiveWriter,
	type AgentChatMemento,
	AgentChatSessionStore,
} from "../../../src/features/agent-chat/agent-chat-session-store";
import {
	type ChatMessage,
	type SessionManifest,
	type SystemChatMessage,
	type UserChatMessage,
	AGENT_CHAT_STORAGE_KEYS,
	transcriptKeyFor,
} from "../../../src/features/agent-chat/types";

// -- Shared memento fake: survives across the two store instances. -----------

interface CountingMemento extends AgentChatMemento {
	readonly updateCount: () => number;
	readonly resetUpdateCount: () => void;
	readonly callsInsideWindow: () => number;
	readonly startWindow: () => void;
	readonly endWindow: () => void;
}

function createSharedMemento(): CountingMemento {
	const map = new Map<string, unknown>();
	let updateCount = 0;
	let windowCount = 0;
	let inWindow = false;
	return {
		get: <T>(key: string, defaultValue?: T): T | undefined =>
			map.has(key) ? (map.get(key) as T) : defaultValue,
		update: (key, value) => {
			updateCount += 1;
			if (inWindow) {
				windowCount += 1;
			}
			if (value === undefined) {
				map.delete(key);
			} else {
				map.set(key, value);
			}
			return Promise.resolve();
		},
		keys: () => [...map.keys()],
		updateCount: () => updateCount,
		resetUpdateCount: () => {
			updateCount = 0;
		},
		callsInsideWindow: () => windowCount,
		startWindow: () => {
			windowCount = 0;
			inWindow = true;
		},
		endWindow: () => {
			inWindow = false;
		},
	};
}

function createArchive(): AgentChatArchiveWriter {
	return {
		appendLines: () => Promise.resolve("archive.jsonl") as never,
		readLines: () => Promise.resolve([] as ChatMessage[]) as never,
	};
}

function makeUserMessage(
	id: string,
	sessionId: string,
	content: string
): UserChatMessage {
	return {
		id,
		sessionId,
		role: "user",
		content,
		isInitialPrompt: true,
		deliveryStatus: "delivered",
		timestamp: Date.now(),
		sequence: 0,
	};
}

// ---------------------------------------------------------------------------

describe("restart persistence (T077, FR-019a/b/c)", () => {
	let memento: CountingMemento;

	beforeEach(() => {
		memento = createSharedMemento();
	});

	it("restores 2 ACP + 1 Cloud sessions with transcripts, calls cloudAttach, and leaves worktrees untouched", async () => {
		// ------ First boot: seed sessions and simulate live work. ---------
		const bootOne = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
		});
		await bootOne.initialize();

		const acpLocal = await bootOne.createSession({
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "local" },
			trigger: { kind: "user" },
			worktree: null,
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		const acpWorktree = await bootOne.createSession({
			source: "acp",
			agentId: "claude",
			agentDisplayName: "Claude",
			capabilities: { source: "none" },
			executionTarget: { kind: "worktree", worktreeId: "wt-1" },
			trigger: { kind: "user" },
			worktree: {
				id: "wt-1",
				absolutePath: "/tmp/worktree-1",
				branchName: "gatomia/agent-chat/acp-worktree",
				baseCommitSha: "abc",
				createdAt: 1,
				status: "in-use",
			},
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		const cloudSession = await bootOne.createSession({
			source: "cloud",
			agentId: "devin",
			agentDisplayName: "Devin",
			capabilities: { source: "none" },
			executionTarget: {
				kind: "cloud",
				providerId: "devin",
				cloudSessionId: "rs-9",
			},
			trigger: { kind: "user" },
			worktree: null,
			cloud: { providerId: "devin", cloudSessionLocalId: "rs-9" },
			workspaceUri: "file:///fake/workspace",
		});

		await bootOne.appendMessages(acpLocal.id, [
			makeUserMessage("msg-a-1", acpLocal.id, "first prompt to local ACP"),
		]);
		await bootOne.appendMessages(acpWorktree.id, [
			makeUserMessage(
				"msg-b-1",
				acpWorktree.id,
				"first prompt to worktree ACP"
			),
		]);
		await bootOne.appendMessages(cloudSession.id, [
			makeUserMessage("msg-c-1", cloudSession.id, "first prompt to cloud"),
		]);

		// Sanity: all three are persisted and in their initial running-equivalent state.
		const beforeFlushManifest = memento.get<SessionManifest>(
			AGENT_CHAT_STORAGE_KEYS.MANIFEST
		);
		expect(beforeFlushManifest?.sessions.map((s) => s.id).sort()).toEqual(
			[acpLocal.id, acpWorktree.id, cloudSession.id].sort()
		);

		// ------ flushForDeactivation is single-atomic. --------------------
		memento.startWindow();
		await bootOne.flushForDeactivation();
		memento.endWindow();

		// The contract says ONE workspaceState.update call for the manifest,
		// not per-entry updates. Allow up to 1 to cover the single manifest write.
		expect(memento.callsInsideWindow()).toBeLessThanOrEqual(1);

		const postFlushManifest = memento.get<SessionManifest>(
			AGENT_CHAT_STORAGE_KEYS.MANIFEST
		);
		const postFlushAcpStates = postFlushManifest?.sessions
			.filter((s) => s.source === "acp")
			.map((s) => s.lifecycleState)
			.sort();
		expect(postFlushAcpStates).toEqual([
			"ended-by-shutdown",
			"ended-by-shutdown",
		]);
		// Cloud sessions MUST NOT be stamped — the provider adapter owns
		// their terminal transitions via polling.
		const cloudEntry = postFlushManifest?.sessions.find(
			(s) => s.source === "cloud"
		);
		expect(cloudEntry?.lifecycleState).not.toBe("ended-by-shutdown");

		// ------ Second boot: simulate VS Code reopening the workspace. ----
		const cloudAttach = vi.fn(() => Promise.resolve());
		// The worktree directory is "still on disk" — our stub just
		// resolves truthy for the path we recorded.
		const worktreeExists = (p: string) => p === "/tmp/worktree-1";

		const bootTwo = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
			cloudAttach,
			worktreeExists,
		});
		await bootTwo.initialize();

		// (a) Both ACP sessions are still present with ended-by-shutdown state.
		const recoveredLocal = await bootTwo.getSession(acpLocal.id);
		const recoveredWorktree = await bootTwo.getSession(acpWorktree.id);
		expect(recoveredLocal?.lifecycleState).toBe("ended-by-shutdown");
		expect(recoveredWorktree?.lifecycleState).toBe("ended-by-shutdown");

		// (b) A single `ended-by-shutdown` system marker is appended (idempotent).
		const localTranscript = memento.get<{ messages: ChatMessage[] }>(
			transcriptKeyFor(acpLocal.id)
		);
		const shutdownMarkers = (localTranscript?.messages ?? []).filter(
			(m): m is SystemChatMessage =>
				m.role === "system" &&
				(m as SystemChatMessage).kind === "ended-by-shutdown"
		);
		expect(shutdownMarkers).toHaveLength(1);

		// (c) cloudAttach was invoked for the live Cloud session's local id.
		expect(cloudAttach).toHaveBeenCalledTimes(1);
		expect(cloudAttach).toHaveBeenCalledWith("rs-9");

		// (d) Worktree-backed session still carries the worktree pointer and
		//     the store did NOT inject a "worktree-cleaned" marker (because
		//     our `worktreeExists` stub reports the path is still on disk).
		expect(recoveredWorktree?.worktree?.absolutePath).toBe("/tmp/worktree-1");
		const worktreeTranscript = memento.get<{ messages: ChatMessage[] }>(
			transcriptKeyFor(acpWorktree.id)
		);
		const worktreeCleanedMarkers = (worktreeTranscript?.messages ?? []).filter(
			(m): m is SystemChatMessage =>
				m.role === "system" &&
				(m as SystemChatMessage).kind === "worktree-cleaned"
		);
		expect(worktreeCleanedMarkers).toHaveLength(0);

		// Full transcripts survive the round-trip.
		expect(
			(localTranscript?.messages ?? []).some((m) => m.id === "msg-a-1")
		).toBe(true);
		expect(
			(worktreeTranscript?.messages ?? []).some((m) => m.id === "msg-b-1")
		).toBe(true);
		const cloudTranscript = memento.get<{ messages: ChatMessage[] }>(
			transcriptKeyFor(cloudSession.id)
		);
		expect(
			(cloudTranscript?.messages ?? []).some((m) => m.id === "msg-c-1")
		).toBe(true);
	});

	it("surfaces a worktree-cleaned marker when the worktree was deleted between shutdown and restart", async () => {
		const bootOne = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
		});
		await bootOne.initialize();

		const s = await bootOne.createSession({
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "worktree", worktreeId: "wt-x" },
			trigger: { kind: "user" },
			worktree: {
				id: "wt-x",
				absolutePath: "/tmp/deleted-by-user",
				branchName: "gatomia/agent-chat/s",
				baseCommitSha: "abc",
				createdAt: 1,
				status: "in-use",
			},
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		await bootOne.appendMessages(s.id, [
			makeUserMessage("m-1", s.id, "only prompt"),
		]);
		await bootOne.flushForDeactivation();

		// Simulate the user deleting the worktree directory out-of-band.
		const bootTwo = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
			worktreeExists: () => false,
		});
		await bootTwo.initialize();

		const transcript = memento.get<{ messages: ChatMessage[] }>(
			transcriptKeyFor(s.id)
		);
		const cleanedMarkers = (transcript?.messages ?? []).filter(
			(m): m is SystemChatMessage =>
				m.role === "system" &&
				(m as SystemChatMessage).kind === "worktree-cleaned"
		);
		expect(cleanedMarkers).toHaveLength(1);
	});

	it("is idempotent: a second initialize() call does not duplicate the shutdown marker", async () => {
		const bootOne = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
		});
		await bootOne.initialize();
		const s = await bootOne.createSession({
			source: "acp",
			agentId: "opencode",
			agentDisplayName: "OpenCode",
			capabilities: { source: "none" },
			executionTarget: { kind: "local" },
			trigger: { kind: "user" },
			worktree: null,
			cloud: null,
			workspaceUri: "file:///fake/workspace",
		});
		await bootOne.flushForDeactivation();

		const bootTwo = new AgentChatSessionStore({
			workspaceState: memento,
			archive: createArchive(),
		});
		await bootTwo.initialize();
		await bootTwo.initialize(); // simulate re-activation (e.g. after a reload)

		const transcript = memento.get<{ messages: ChatMessage[] }>(
			transcriptKeyFor(s.id)
		);
		const markers = (transcript?.messages ?? []).filter(
			(m): m is SystemChatMessage =>
				m.role === "system" &&
				(m as SystemChatMessage).kind === "ended-by-shutdown"
		);
		expect(markers).toHaveLength(1);
	});
});
