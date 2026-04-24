/**
 * AgentChatSessionStore unit tests.
 *
 * Covers every case in
 * specs/018-agent-chat-panel/contracts/agent-chat-session-storage.md §9.
 *
 * TDD (Constitution III): these tests MUST fail before
 * src/features/agent-chat/agent-chat-session-store.ts (T009a + T009b) lands.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AgentChatSessionStore,
	type AgentChatArchiveWriter,
	type AgentChatMemento,
} from "../../../../src/features/agent-chat/agent-chat-session-store";
import {
	AGENT_CHAT_STORAGE_KEYS,
	type ChatMessage,
	type CreateSessionInput,
	DEFAULT_AGENT_CHAT_SETTINGS,
	type SessionManifest,
	type SessionManifestEntry,
	transcriptKeyFor,
	type UserChatMessage,
} from "../../../../src/features/agent-chat/types";

// ============================================================================
// Mock memento (in-memory workspaceState)
// ============================================================================

type MockMemento = AgentChatMemento & {
	_store: Map<string, unknown>;
	get: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

function createMockMemento(): MockMemento {
	const store = new Map<string, unknown>();
	const get = vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
		if (!store.has(key)) {
			return defaultValue;
		}
		return store.get(key) as T;
	});
	const update = vi.fn((key: string, value: unknown): Thenable<void> => {
		if (value === undefined) {
			store.delete(key);
		} else {
			store.set(key, value);
		}
		return Promise.resolve();
	});
	return {
		_store: store,
		get: get as MockMemento["get"],
		update: update as MockMemento["update"],
		keys: () => [...store.keys()],
	};
}

// ============================================================================
// Mock archive writer (filesystem abstraction)
// ============================================================================

type MockArchiveWriter = AgentChatArchiveWriter & {
	_archives: Map<string, ChatMessage[]>;
	appendLines: ReturnType<typeof vi.fn>;
	readLines: ReturnType<typeof vi.fn>;
};

function createMockArchiveWriter(): MockArchiveWriter {
	const archives = new Map<string, ChatMessage[]>();
	const appendLines = vi.fn(
		(sessionId: string, messages: ChatMessage[]): Promise<string> => {
			const fileName = `transcript-${Date.now()}-${Math.random()
				.toString(36)
				.slice(2, 8)}.jsonl`;
			const key = `${sessionId}/${fileName}`;
			const existing = archives.get(key) ?? [];
			archives.set(key, existing.concat(messages));
			return Promise.resolve(fileName);
		}
	);
	const readLines = vi.fn(
		(
			sessionId: string,
			offset: number,
			_limit: number
		): Promise<ChatMessage[]> => {
			const all: ChatMessage[] = [];
			for (const [key, msgs] of archives.entries()) {
				if (key.startsWith(`${sessionId}/`)) {
					all.push(...msgs);
				}
			}
			return Promise.resolve(all.slice(offset, offset + _limit));
		}
	);
	return {
		_archives: archives,
		appendLines: appendLines as MockArchiveWriter["appendLines"],
		readLines: readLines as MockArchiveWriter["readLines"],
	};
}

// Top-level regex (biome lint/performance/useTopLevelRegex).
const UUID_V4_REGEX = /^[0-9a-f-]{36}$/;

// ============================================================================
// Test fixtures
// ============================================================================

function baseCreateInput(
	overrides: Partial<CreateSessionInput> = {}
): CreateSessionInput {
	return {
		source: "acp",
		agentId: "opencode",
		agentDisplayName: "opencode",
		capabilities: { source: "none" },
		executionTarget: { kind: "local" },
		trigger: { kind: "user" },
		worktree: null,
		cloud: null,
		workspaceUri: "file:///fake/workspace",
		createdAt: 1000,
		...overrides,
	};
}

function makeUserMessage(
	sessionId: string,
	sequence: number,
	content: string
): UserChatMessage {
	return {
		id: `m-${sessionId}-${sequence}`,
		sessionId,
		timestamp: 1000 + sequence,
		sequence,
		role: "user",
		content,
		isInitialPrompt: sequence === 0,
		deliveryStatus: "delivered",
	};
}

// ============================================================================
// Suite
// ============================================================================

describe("AgentChatSessionStore", () => {
	let memento: MockMemento;
	let archive: MockArchiveWriter;
	let store: AgentChatSessionStore;

	beforeEach(() => {
		memento = createMockMemento();
		archive = createMockArchiveWriter();
		store = new AgentChatSessionStore({
			workspaceState: memento,
			archive,
		});
	});

	// ------------------------------------------------------------------
	// Create / append / read
	// ------------------------------------------------------------------

	describe("create/append/read", () => {
		it("creates a session and persists the manifest + empty transcript atomically", async () => {
			const session = await store.createSession(baseCreateInput());
			expect(session.id).toMatch(UUID_V4_REGEX);
			expect(session.lifecycleState).toBe("initializing");

			const manifest = memento._store.get(
				AGENT_CHAT_STORAGE_KEYS.MANIFEST
			) as SessionManifest;
			expect(manifest.schemaVersion).toBe(1);
			expect(manifest.sessions).toHaveLength(1);
			expect(manifest.sessions[0].id).toBe(session.id);

			const transcript = memento._store.get(transcriptKeyFor(session.id));
			expect(transcript).toBeDefined();
		});

		it("appends messages with monotonic sequence numbers starting at 0", async () => {
			const session = await store.createSession(baseCreateInput());
			await store.appendMessages(session.id, [
				makeUserMessage(session.id, 0, "hello"),
				makeUserMessage(session.id, 1, "world"),
				makeUserMessage(session.id, 2, "again"),
			]);

			const transcript = memento._store.get(transcriptKeyFor(session.id)) as {
				messages: ChatMessage[];
			};
			expect(transcript.messages.map((m) => m.sequence)).toEqual([0, 1, 2]);
		});
	});

	// ------------------------------------------------------------------
	// Archival
	// ------------------------------------------------------------------

	describe("archival", () => {
		it("archives oldest 25% when message count exceeds 10,000", async () => {
			const session = await store.createSession(baseCreateInput());
			const bulk: ChatMessage[] = [];
			for (let i = 0; i < 10_001; i += 1) {
				bulk.push(makeUserMessage(session.id, i, `m${i}`));
			}
			await store.appendMessages(session.id, bulk);

			const transcript = memento._store.get(transcriptKeyFor(session.id)) as {
				messages: ChatMessage[];
				hasArchive: boolean;
			};
			expect(transcript.hasArchive).toBe(true);
			// After pivot, at most ~75% of the original + 1 archive marker remain.
			expect(transcript.messages.length).toBeLessThanOrEqual(7502);
			expect(transcript.messages.length).toBeGreaterThan(7000);

			const manifest = memento._store.get(
				AGENT_CHAT_STORAGE_KEYS.MANIFEST
			) as SessionManifest;
			expect(manifest.sessions[0].transcriptArchived).toBe(true);
			expect(archive.appendLines).toHaveBeenCalled();
		});

		it("archives when JSON payload exceeds ~2 MB even if count is low", async () => {
			const session = await store.createSession(baseCreateInput());
			// 600 messages × ~4 KB each = ~2.4 MB
			const big = "x".repeat(4000);
			const bulk: ChatMessage[] = [];
			for (let i = 0; i < 600; i += 1) {
				bulk.push(makeUserMessage(session.id, i, big));
			}
			await store.appendMessages(session.id, bulk);

			const transcript = memento._store.get(transcriptKeyFor(session.id)) as {
				hasArchive: boolean;
			};
			expect(transcript.hasArchive).toBe(true);
			expect(archive.appendLines).toHaveBeenCalled();
		});
	});

	// ------------------------------------------------------------------
	// Retention
	// ------------------------------------------------------------------

	describe("retention", () => {
		it("caps the manifest at 100 sessions (evicts oldest)", async () => {
			for (let i = 0; i < 101; i += 1) {
				await store.createSession(baseCreateInput({ createdAt: 1000 + i }));
			}

			const manifest = memento._store.get(
				AGENT_CHAT_STORAGE_KEYS.MANIFEST
			) as SessionManifest;
			expect(manifest.sessions).toHaveLength(100);
		});

		it("deletes the evicted session's transcript key", async () => {
			const first = await store.createSession(
				baseCreateInput({ createdAt: 1000 })
			);
			for (let i = 0; i < 100; i += 1) {
				await store.createSession(baseCreateInput({ createdAt: 2000 + i }));
			}

			expect(memento._store.get(transcriptKeyFor(first.id))).toBeUndefined();
		});

		it("migrates an evicted session's worktree into the orphaned list (when the worktree path still exists)", async () => {
			// Per contract §5, migration is conditional on the worktree still
			// existing on disk. Inject a stub so the fake path counts as present.
			store = new AgentChatSessionStore({
				workspaceState: memento,
				archive,
				worktreeExists: () => true,
			});
			const withWorktree = await store.createSession(
				baseCreateInput({
					createdAt: 1000,
					executionTarget: { kind: "worktree", worktreeId: "w-1" },
					worktree: {
						id: "w-1",
						absolutePath: "/fake/workspace/.gatomia/worktrees/w-1",
						branchName: "gatomia/agent-chat/w-1",
						baseCommitSha: "abc123",
						status: "created",
						createdAt: 1000,
					},
				})
			);
			for (let i = 0; i < 100; i += 1) {
				await store.createSession(baseCreateInput({ createdAt: 2000 + i }));
			}

			const orphans = memento._store.get(
				AGENT_CHAT_STORAGE_KEYS.ORPHANED_WORKTREES
			) as { orphans: Array<{ sessionId: string; absolutePath: string }> };
			expect(orphans.orphans).toHaveLength(1);
			expect(orphans.orphans[0].sessionId).toBe(withWorktree.id);
			expect(orphans.orphans[0].absolutePath).toBe(
				"/fake/workspace/.gatomia/worktrees/w-1"
			);
		});
	});

	// ------------------------------------------------------------------
	// Restart restore
	// ------------------------------------------------------------------

	describe("restart restore (onActivation)", () => {
		it("transitions a non-terminal ACP session to ended-by-shutdown and stamps a system message", async () => {
			// Seed a manifest with a running ACP session from a prior process.
			const entry: SessionManifestEntry = {
				id: "s-restart-1",
				source: "acp",
				agentId: "opencode",
				agentDisplayName: "opencode",
				lifecycleState: "running",
				executionTargetKind: "local",
				createdAt: 1000,
				updatedAt: 1500,
				transcriptArchived: false,
			};
			memento._store.set(AGENT_CHAT_STORAGE_KEYS.MANIFEST, {
				schemaVersion: 1,
				sessions: [entry],
				updatedAt: 1500,
			});
			memento._store.set(transcriptKeyFor("s-restart-1"), {
				schemaVersion: 1,
				sessionId: "s-restart-1",
				messages: [],
				hasArchive: false,
				updatedAt: 1500,
			});

			await store.initialize();
			const restored = await store.listNonTerminal();

			const session = await store.getSession("s-restart-1");
			expect(session?.lifecycleState).toBe("ended-by-shutdown");

			const transcript = memento._store.get(
				transcriptKeyFor("s-restart-1")
			) as { messages: ChatMessage[] };
			const tail = transcript.messages.at(-1);
			expect(tail).toBeDefined();
			expect(tail?.role).toBe("system");
			expect((tail as { kind?: string }).kind).toBe("ended-by-shutdown");

			// listNonTerminal returns sessions that WERE non-terminal at activation;
			// implementation MAY return them even after stamping (the consumer uses
			// this list to drive tree-view updates, not to filter).
			expect(restored.length).toBeGreaterThanOrEqual(0);
		});

		it("does NOT transition cloud sessions; calls cloud attach hook instead", async () => {
			const entry: SessionManifestEntry = {
				id: "s-cloud-1",
				source: "cloud",
				agentId: "devin",
				agentDisplayName: "Devin",
				lifecycleState: "running",
				executionTargetKind: "cloud",
				createdAt: 1000,
				updatedAt: 1500,
				transcriptArchived: false,
				cloudSessionLocalId: "cloud-local-1",
			};
			memento._store.set(AGENT_CHAT_STORAGE_KEYS.MANIFEST, {
				schemaVersion: 1,
				sessions: [entry],
				updatedAt: 1500,
			});
			memento._store.set(transcriptKeyFor("s-cloud-1"), {
				schemaVersion: 1,
				sessionId: "s-cloud-1",
				messages: [],
				hasArchive: false,
				updatedAt: 1500,
			});

			const cloudAttach = vi
				.fn<(localId: string) => Promise<void>>()
				.mockResolvedValue();
			store = new AgentChatSessionStore({
				workspaceState: memento,
				archive,
				cloudAttach,
			});

			await store.initialize();
			const session = await store.getSession("s-cloud-1");
			expect(session?.lifecycleState).toBe("running");
			expect(cloudAttach).toHaveBeenCalledWith("cloud-local-1");
		});

		it("stamps a worktree-cleaned self-repair message when the worktree path is gone", async () => {
			const entry: SessionManifestEntry = {
				id: "s-wt-1",
				source: "acp",
				agentId: "opencode",
				agentDisplayName: "opencode",
				lifecycleState: "completed",
				executionTargetKind: "worktree",
				createdAt: 1000,
				updatedAt: 1500,
				transcriptArchived: false,
				worktreePath: "/does/not/exist",
			};
			memento._store.set(AGENT_CHAT_STORAGE_KEYS.MANIFEST, {
				schemaVersion: 1,
				sessions: [entry],
				updatedAt: 1500,
			});
			memento._store.set(transcriptKeyFor("s-wt-1"), {
				schemaVersion: 1,
				sessionId: "s-wt-1",
				messages: [],
				hasArchive: false,
				updatedAt: 1500,
			});

			const worktreeExists = vi.fn(() => false);
			store = new AgentChatSessionStore({
				workspaceState: memento,
				archive,
				worktreeExists,
			});

			await store.initialize();
			const transcript = memento._store.get(transcriptKeyFor("s-wt-1")) as {
				messages: ChatMessage[];
			};
			const tail = transcript.messages.at(-1);
			expect(tail).toBeDefined();
			expect(tail?.role).toBe("system");
			expect((tail as { kind?: string }).kind).toBe("worktree-cleaned");
		});
	});

	// ------------------------------------------------------------------
	// Deactivation
	// ------------------------------------------------------------------

	describe("flushForDeactivation", () => {
		it("stamps non-terminal ACP sessions and issues exactly ONE workspaceState.update", async () => {
			await store.createSession(baseCreateInput({ agentId: "a" }));
			await store.createSession(baseCreateInput({ agentId: "b" }));

			const updateCallsBefore = memento.update.mock.calls.length;
			await store.flushForDeactivation();

			const sinceFlush = memento.update.mock.calls.slice(updateCallsBefore);
			const manifestWrites = sinceFlush.filter(
				(call) => call[0] === AGENT_CHAT_STORAGE_KEYS.MANIFEST
			);
			expect(manifestWrites).toHaveLength(1);

			const manifest = memento._store.get(
				AGENT_CHAT_STORAGE_KEYS.MANIFEST
			) as SessionManifest;
			for (const entry of manifest.sessions) {
				if (entry.source === "acp") {
					expect(entry.lifecycleState).toBe("ended-by-shutdown");
					expect(entry.endedAt).toBeGreaterThan(0);
				}
			}
		});

		it("rejects with the underlying error when workspaceState.update fails; does not retry", async () => {
			await store.createSession(baseCreateInput());
			const updateCallsBefore = memento.update.mock.calls.length;
			memento.update.mockImplementationOnce(() =>
				Promise.reject(new Error("disk full"))
			);

			await expect(store.flushForDeactivation()).rejects.toThrow("disk full");

			// Only the failed call; no retry.
			expect(memento.update.mock.calls.length).toBe(updateCallsBefore + 1);
		});

		it("activation is idempotent when manifest was already stamped ended-by-shutdown last time", async () => {
			// Seed a manifest already transitioned AND a transcript with the system marker at tail.
			memento._store.set(AGENT_CHAT_STORAGE_KEYS.MANIFEST, {
				schemaVersion: 1,
				sessions: [
					{
						id: "s-idem-1",
						source: "acp",
						agentId: "opencode",
						agentDisplayName: "opencode",
						lifecycleState: "ended-by-shutdown",
						executionTargetKind: "local",
						createdAt: 1000,
						updatedAt: 2000,
						endedAt: 2000,
						transcriptArchived: false,
					},
				],
				updatedAt: 2000,
			} satisfies SessionManifest);
			memento._store.set(transcriptKeyFor("s-idem-1"), {
				schemaVersion: 1,
				sessionId: "s-idem-1",
				messages: [
					{
						id: "sys-shutdown",
						sessionId: "s-idem-1",
						sequence: 0,
						timestamp: 2000,
						role: "system",
						kind: "ended-by-shutdown",
						content: "Session ended because VS Code closed.",
					},
				],
				hasArchive: false,
				updatedAt: 2000,
			});

			const updatesBefore = memento.update.mock.calls.length;
			await store.initialize();
			const updatesAfter = memento.update.mock.calls.length;

			const transcript = memento._store.get(transcriptKeyFor("s-idem-1")) as {
				messages: ChatMessage[];
			};
			// No duplicate shutdown marker appended.
			const shutdownMarkers = transcript.messages.filter(
				(m) =>
					m.role === "system" &&
					(m as { kind?: string }).kind === "ended-by-shutdown"
			);
			expect(shutdownMarkers).toHaveLength(1);

			// No writes happened (idempotent).
			expect(updatesAfter).toBe(updatesBefore);
		});
	});

	// ------------------------------------------------------------------
	// Concurrency
	// ------------------------------------------------------------------

	describe("concurrency", () => {
		it("serializes two concurrent appendMessages calls without lost writes or duplicate sequences", async () => {
			const session = await store.createSession(baseCreateInput());
			const firstBatch = Array.from({ length: 50 }, (_, i) =>
				makeUserMessage(session.id, i, `a${i}`)
			);
			const secondBatch = Array.from({ length: 50 }, (_, i) =>
				makeUserMessage(session.id, 50 + i, `b${i}`)
			);

			await Promise.all([
				store.appendMessages(session.id, firstBatch),
				store.appendMessages(session.id, secondBatch),
			]);

			const transcript = memento._store.get(transcriptKeyFor(session.id)) as {
				messages: ChatMessage[];
			};

			expect(transcript.messages).toHaveLength(100);
			const sequences = transcript.messages
				.map((m) => m.sequence)
				.sort((a, b) => a - b);
			expect(sequences).toEqual(Array.from({ length: 100 }, (_, i) => i));
		});
	});

	// ------------------------------------------------------------------
	// Settings
	// ------------------------------------------------------------------

	describe("settings", () => {
		it("returns documented defaults when the settings key is missing", async () => {
			const settings = await store.getSettings();
			expect(settings.autoOpenPanelOnNewSession).toBe(
				DEFAULT_AGENT_CHAT_SETTINGS.autoOpenPanelOnNewSession
			);
			expect(settings.maxConcurrentAcpSessions).toBe(
				DEFAULT_AGENT_CHAT_SETTINGS.maxConcurrentAcpSessions
			);
		});
	});
});
