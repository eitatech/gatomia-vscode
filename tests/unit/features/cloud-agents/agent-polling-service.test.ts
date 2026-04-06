/**
 * Agent Polling Service Tests
 *
 * Tests for polling orchestration and provider hooks.
 *
 * @see specs/016-multi-provider-agents/contracts/provider-interface.md
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPollingService } from "../../../../src/features/cloud-agents/agent-polling-service";
import type { ProviderRegistry } from "../../../../src/features/cloud-agents/provider-registry";
import type { AgentSessionStorage } from "../../../../src/features/cloud-agents/agent-session-storage";
import type { CloudAgentProvider } from "../../../../src/features/cloud-agents/cloud-agent-provider";
import {
	type AgentSession,
	type AgentTask,
	type SessionUpdate,
	SessionStatus,
	TaskStatus,
} from "../../../../src/features/cloud-agents/types";

// ============================================================================
// Helpers
// ============================================================================

function createTestSession(
	overrides: Partial<AgentSession> = {}
): AgentSession {
	return {
		localId: "local-1",
		providerId: "devin",
		providerSessionId: "ext-1",
		status: SessionStatus.RUNNING,
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

function createMockProvider(): CloudAgentProvider {
	return {
		metadata: { id: "devin", displayName: "Devin", description: "", icon: "" },
		hasCredentials: vi.fn().mockResolvedValue(true),
		configureCredentials: vi.fn().mockResolvedValue(true),
		createSession: vi.fn(),
		cancelSession: vi.fn(),
		pollSessions: vi.fn().mockResolvedValue([]),
		getExternalUrl: vi.fn(),
		getStatusDisplay: vi.fn().mockReturnValue("running"),
		handleBlockedSession: vi.fn().mockReturnValue(null),
		handleSessionComplete: vi.fn(),
	};
}

function createMockRegistry(
	activeProvider?: CloudAgentProvider
): ProviderRegistry {
	return {
		getActive: vi.fn(() => activeProvider),
	} as unknown as ProviderRegistry;
}

function createMockSessionStorage(
	sessions: AgentSession[] = []
): AgentSessionStorage {
	return {
		getActive: vi.fn(async () =>
			sessions.filter(
				(s) =>
					!s.isReadOnly &&
					s.status !== SessionStatus.COMPLETED &&
					s.status !== SessionStatus.FAILED &&
					s.status !== SessionStatus.CANCELLED
			)
		),
		getAll: vi.fn(async () => sessions),
		getById: vi.fn(async (id: string) =>
			sessions.find((s) => s.localId === id)
		),
		update: vi.fn(),
	} as unknown as AgentSessionStorage;
}

function createTestTask(overrides: Partial<AgentTask> = {}): AgentTask {
	return {
		id: "task-1",
		specTaskId: "T001",
		title: "Test Task",
		description: "A test task",
		priority: "medium",
		status: TaskStatus.PENDING,
		...overrides,
	};
}

// ============================================================================
// AgentPollingService
// ============================================================================

describe("AgentPollingService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should poll active sessions via the active provider", async () => {
		const session = createTestSession();
		const provider = createMockProvider();
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([session]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(provider.pollSessions).toHaveBeenCalledWith([session]);
	});

	it("should apply session updates from polling results", async () => {
		const session = createTestSession({ localId: "s1" });
		const update: SessionUpdate = {
			localId: "s1",
			status: SessionStatus.COMPLETED,
			timestamp: Date.now(),
		};
		const provider = createMockProvider();
		(provider.pollSessions as ReturnType<typeof vi.fn>).mockResolvedValue([
			update,
		]);
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([session]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(sessionStorage.update).toHaveBeenCalledWith(
			"s1",
			expect.objectContaining({
				status: SessionStatus.COMPLETED,
				completedAt: Date.now(),
			})
		);
	});

	it("should not poll when no active provider is set", async () => {
		const registry = createMockRegistry(undefined);
		const sessionStorage = createMockSessionStorage();

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(sessionStorage.getActive).not.toHaveBeenCalled();
	});

	it("should handle polling errors gracefully without crashing", async () => {
		const session = createTestSession();
		const provider = createMockProvider();
		(provider.pollSessions as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("API timeout")
		);
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([session]);

		const poller = new AgentPollingService(registry, sessionStorage);
		// Should not throw
		await expect(poller.pollOnce()).resolves.not.toThrow();
	});

	it("should start and stop interval-based polling", () => {
		const provider = createMockProvider();
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage();

		const poller = new AgentPollingService(registry, sessionStorage);
		poller.start(30_000);
		expect(poller.isRunning).toBe(true);
		poller.stop();
		expect(poller.isRunning).toBe(false);
	});

	it("should derive task statuses when session reaches completed", async () => {
		const task = createTestTask({ status: TaskStatus.PENDING });
		const session = createTestSession({
			localId: "s1",
			tasks: [task],
		});
		const update: SessionUpdate = {
			localId: "s1",
			status: SessionStatus.COMPLETED,
			timestamp: Date.now(),
		};
		const provider = createMockProvider();
		(provider.pollSessions as ReturnType<typeof vi.fn>).mockResolvedValue([
			update,
		]);
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([session]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(sessionStorage.update).toHaveBeenCalledWith(
			"s1",
			expect.objectContaining({
				status: SessionStatus.COMPLETED,
				tasks: [
					expect.objectContaining({
						specTaskId: "T001",
						status: TaskStatus.COMPLETED,
					}),
				],
			})
		);
	});

	it("should derive task statuses as failed when session fails", async () => {
		const task = createTestTask({ status: TaskStatus.IN_PROGRESS });
		const session = createTestSession({
			localId: "s1",
			tasks: [task],
		});
		const update: SessionUpdate = {
			localId: "s1",
			status: SessionStatus.FAILED,
			timestamp: Date.now(),
		};
		const provider = createMockProvider();
		(provider.pollSessions as ReturnType<typeof vi.fn>).mockResolvedValue([
			update,
		]);
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([session]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(sessionStorage.update).toHaveBeenCalledWith(
			"s1",
			expect.objectContaining({
				tasks: [
					expect.objectContaining({
						status: TaskStatus.FAILED,
					}),
				],
			})
		);
	});

	it("should not override already-terminal task statuses", async () => {
		const completedTask = createTestTask({
			id: "t1",
			specTaskId: "T001",
			status: TaskStatus.COMPLETED,
		});
		const pendingTask = createTestTask({
			id: "t2",
			specTaskId: "T002",
			status: TaskStatus.PENDING,
		});
		const session = createTestSession({
			localId: "s1",
			tasks: [completedTask, pendingTask],
		});
		const update: SessionUpdate = {
			localId: "s1",
			status: SessionStatus.FAILED,
			timestamp: Date.now(),
		};
		const provider = createMockProvider();
		(provider.pollSessions as ReturnType<typeof vi.fn>).mockResolvedValue([
			update,
		]);
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([session]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(sessionStorage.update).toHaveBeenCalledWith(
			"s1",
			expect.objectContaining({
				tasks: [
					expect.objectContaining({
						specTaskId: "T001",
						status: TaskStatus.COMPLETED,
					}),
					expect.objectContaining({
						specTaskId: "T002",
						status: TaskStatus.FAILED,
					}),
				],
			})
		);
	});

	it("should include recently-completed sessions with open PRs in polling", async () => {
		const completedSession = createTestSession({
			localId: "s-completed",
			status: SessionStatus.COMPLETED,
			completedAt: Date.now() - 60_000,
			pullRequests: [
				{
					url: "https://github.com/org/repo/pull/1",
					state: "open",
					branch: "main",
					createdAt: Date.now(),
				},
			],
		});
		const provider = createMockProvider();
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([completedSession]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(provider.pollSessions).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ localId: "s-completed" }),
			])
		);
	});

	it("should NOT include completed sessions with merged PRs in polling", async () => {
		const completedSession = createTestSession({
			localId: "s-merged",
			status: SessionStatus.COMPLETED,
			completedAt: Date.now() - 60_000,
			pullRequests: [
				{
					url: "https://github.com/org/repo/pull/1",
					state: "merged",
					branch: "main",
					createdAt: Date.now(),
				},
			],
		});
		const provider = createMockProvider();
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([completedSession]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(provider.pollSessions).not.toHaveBeenCalled();
	});

	it("should NOT include completed sessions past the grace period", async () => {
		const oldCompletedSession = createTestSession({
			localId: "s-old",
			status: SessionStatus.COMPLETED,
			completedAt: Date.now() - 10 * 60 * 1000,
			pullRequests: [
				{
					url: "https://github.com/org/repo/pull/1",
					state: "open",
					branch: "main",
					createdAt: Date.now(),
				},
			],
		});
		const provider = createMockProvider();
		const registry = createMockRegistry(provider);
		const sessionStorage = createMockSessionStorage([oldCompletedSession]);

		const poller = new AgentPollingService(registry, sessionStorage);
		await poller.pollOnce();

		expect(provider.pollSessions).not.toHaveBeenCalled();
	});
});
