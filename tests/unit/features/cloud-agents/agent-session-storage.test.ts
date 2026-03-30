/**
 * Agent Session Storage Tests
 *
 * Tests for session CRUD, read-only marking, and retention behavior.
 *
 * @see specs/016-multi-provider-agents/contracts/storage-interface.md
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSessionStorage } from "../../../../src/features/cloud-agents/agent-session-storage";
import {
	type AgentSession,
	SessionStatus,
} from "../../../../src/features/cloud-agents/types";

// ============================================================================
// Helpers
// ============================================================================

function createMockMemento() {
	const store = new Map<string, unknown>();
	return {
		get: vi.fn(
			<T>(key: string, defaultValue?: T) =>
				(store.get(key) as T) ?? defaultValue
		),
		update: vi.fn((key: string, value: unknown) => {
			if (value === undefined) {
				store.delete(key);
			} else {
				store.set(key, value);
			}
			return Promise.resolve();
		}),
		keys: vi.fn(() => [...store.keys()]),
	};
}

function createTestSession(
	overrides: Partial<AgentSession> = {}
): AgentSession {
	return {
		localId: `local-${Date.now()}-${Math.random()}`,
		providerId: "devin",
		providerSessionId: "ext-1",
		status: SessionStatus.PENDING,
		branch: "main",
		specPath: "/specs/test/spec.md",
		tasks: [],
		pullRequests: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
		completedAt: undefined,
		isReadOnly: false,
		...overrides,
	};
}

// ============================================================================
// AgentSessionStorage
// ============================================================================

describe("AgentSessionStorage", () => {
	let storage: AgentSessionStorage;
	let memento: ReturnType<typeof createMockMemento>;

	beforeEach(() => {
		memento = createMockMemento();
		storage = new AgentSessionStorage(memento);
	});

	describe("CRUD operations", () => {
		it("should create and retrieve a session by local ID", async () => {
			const session = createTestSession({ localId: "s-1" });
			await storage.create(session);
			const result = await storage.getById("s-1");
			expect(result).toEqual(session);
		});

		it("should throw when creating a session with duplicate localId", async () => {
			const session = createTestSession({ localId: "s-dup" });
			await storage.create(session);
			await expect(storage.create(session)).rejects.toThrow();
		});

		it("should return undefined for unknown localId", async () => {
			const result = await storage.getById("nonexistent");
			expect(result).toBeUndefined();
		});

		it("should update an existing session", async () => {
			const session = createTestSession({ localId: "s-upd" });
			await storage.create(session);
			await storage.update("s-upd", { status: SessionStatus.RUNNING });
			const result = await storage.getById("s-upd");
			expect(result?.status).toBe(SessionStatus.RUNNING);
		});

		it("should throw when updating a nonexistent session", async () => {
			await expect(
				storage.update("nope", { status: SessionStatus.FAILED })
			).rejects.toThrow();
		});

		it("should delete a session", async () => {
			const session = createTestSession({ localId: "s-del" });
			await storage.create(session);
			await storage.delete("s-del");
			const result = await storage.getById("s-del");
			expect(result).toBeUndefined();
		});

		it("should return all sessions", async () => {
			await storage.create(createTestSession({ localId: "a" }));
			await storage.create(createTestSession({ localId: "b" }));
			const all = await storage.getAll();
			expect(all).toHaveLength(2);
		});
	});

	describe("filtering", () => {
		it("should get sessions by provider", async () => {
			await storage.create(
				createTestSession({ localId: "d1", providerId: "devin" })
			);
			await storage.create(
				createTestSession({ localId: "g1", providerId: "github-copilot" })
			);
			const devinSessions = await storage.getByProvider("devin");
			expect(devinSessions).toHaveLength(1);
			expect(devinSessions[0].providerId).toBe("devin");
		});

		it("should get active (non-read-only) sessions", async () => {
			await storage.create(
				createTestSession({ localId: "active", isReadOnly: false })
			);
			await storage.create(
				createTestSession({ localId: "readonly", isReadOnly: true })
			);
			const active = await storage.getActive();
			expect(active).toHaveLength(1);
			expect(active[0].localId).toBe("active");
		});
	});

	describe("read-only marking", () => {
		it("should mark all sessions from a provider as read-only", async () => {
			await storage.create(
				createTestSession({ localId: "d1", providerId: "devin" })
			);
			await storage.create(
				createTestSession({ localId: "d2", providerId: "devin" })
			);
			await storage.create(
				createTestSession({ localId: "g1", providerId: "github-copilot" })
			);
			await storage.markProviderReadOnly("devin");
			const d1 = await storage.getById("d1");
			const d2 = await storage.getById("d2");
			const g1 = await storage.getById("g1");
			expect(d1?.isReadOnly).toBe(true);
			expect(d2?.isReadOnly).toBe(true);
			expect(g1?.isReadOnly).toBe(false);
		});
	});

	describe("cleanup", () => {
		it("should return sessions eligible for cleanup based on cutoff time", async () => {
			const oldTime = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
			const newTime = Date.now();
			await storage.create(
				createTestSession({
					localId: "old",
					status: SessionStatus.COMPLETED,
					updatedAt: oldTime,
					completedAt: oldTime,
				})
			);
			await storage.create(
				createTestSession({ localId: "new", updatedAt: newTime })
			);
			const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
			const forCleanup = await storage.getForCleanup(cutoff);
			expect(forCleanup).toHaveLength(1);
			expect(forCleanup[0].localId).toBe("old");
		});
	});
});
